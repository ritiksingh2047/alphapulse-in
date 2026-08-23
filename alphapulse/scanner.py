"""AlphaPulse-IN scanning pipeline: 52-week low/high setups + market breadth."""

from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import Optional

from alphapulse.config import Config
from alphapulse.database import Database
from alphapulse.fetcher import MarketDataFetcher
from alphapulse.fundamental import FundamentalAnalyzer
from alphapulse.models import MarketBreadth, StockSignal
from alphapulse.technical import TechnicalAnalyzer
from alphapulse.universe import NSE_UNIVERSE, get_all_tickers

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
BATCH_SIZE = 50
BATCH_PAUSE_SECONDS = 5


def _lookup_name_sector(symbol: str) -> tuple[str, str]:
    """Return (company_name, sector) from universe, or defaults."""
    for entry in NSE_UNIVERSE:
        if entry["symbol"] == symbol:
            return entry["name"], entry["sector"]
    return symbol, "Unknown"


class AlphaPulseScanner:
    """Orchestrates full market scans and produces :class:`StockSignal` lists."""

    def __init__(self) -> None:
        self.fetcher = MarketDataFetcher()
        self.technical = TechnicalAnalyzer()
        self.fundamental = FundamentalAnalyzer()
        self.db = Database()

    # ------------------------------------------------------------------
    # Market breadth
    # ------------------------------------------------------------------
    def scan_market_breadth(self) -> MarketBreadth:
        """Fetch Nifty 50 / Bank Nifty quotes and compute market breadth."""
        logger.info("Scanning market breadth …")

        nifty_data = self.fetcher.get_index_data("^NSEI") or {}
        banknifty_data = self.fetcher.get_index_data("^NSEBANK") or {}

        nifty_ltp = nifty_data.get("ltp", 0.0)
        nifty_change_pct = nifty_data.get("change_pct", 0.0)

        banknifty_ltp = banknifty_data.get("ltp", 0.0)
        banknifty_change_pct = banknifty_data.get("change_pct", 0.0)

        # Breadth: use fetcher's batch method
        tickers = get_all_tickers()
        advances, declines, unchanged = self.fetcher.get_market_breadth(tickers)

        breadth = MarketBreadth(
            nifty_ltp=nifty_ltp,
            nifty_change_pct=round(nifty_change_pct, 2),
            banknifty_ltp=banknifty_ltp,
            banknifty_change_pct=round(banknifty_change_pct, 2),
            advances=advances,
            declines=declines,
            unchanged=unchanged,
        )

        self.db.save_market_snapshot(breadth)
        logger.info(
            "Breadth: A=%d D=%d U=%d | Nifty %.2f (%.2f%%) | BankNifty %.2f (%.2f%%)",
            advances,
            declines,
            unchanged,
            nifty_ltp,
            nifty_change_pct,
            banknifty_ltp,
            banknifty_change_pct,
        )
        return breadth

    # ------------------------------------------------------------------
    # 52-week low scan  →  BUY_SETUP
    # ------------------------------------------------------------------
    def scan_52w_lows(self) -> list[StockSignal]:
        """Identify stocks within 7% of 52-week low and run fundamental filters."""
        logger.info("Starting 52W-low scan …")
        t0 = time.time()
        signals: list[StockSignal] = []
        scanned = 0
        tickers = get_all_tickers()

        for batch_start in range(0, len(tickers), BATCH_SIZE):
            batch = tickers[batch_start : batch_start + BATCH_SIZE]
            for ticker in batch:
                scanned += 1
                symbol = ticker.replace(".NS", "")
                try:
                    self._process_low_candidate(ticker, symbol, signals)
                except Exception:
                    logger.debug("Error processing %s (low scan), skipping", ticker, exc_info=True)

            processed = min(batch_start + BATCH_SIZE, len(tickers))
            logger.info("52W-low scan progress: %d / %d tickers", processed, len(tickers))
            if batch_start + BATCH_SIZE < len(tickers):
                time.sleep(BATCH_PAUSE_SECONDS)

        elapsed = time.time() - t0
        self.db.log_scan("52W_LOW", scanned, len(signals), elapsed)
        logger.info(
            "52W-low scan complete: %d scanned, %d signals, %.1fs",
            scanned,
            len(signals),
            elapsed,
        )
        return signals

    def _process_low_candidate(
        self, ticker: str, symbol: str, signals: list[StockSignal]
    ) -> None:
        stock_data = self.fetcher.get_stock_data(ticker)
        if stock_data is None:
            return

        ltp = stock_data.get("ltp", 0.0)
        week52_low = stock_data.get("week52_low", 0.0)
        week52_high = stock_data.get("week52_high", 0.0)

        if week52_low <= 0 or ltp <= 0:
            return

        pct_from_low = (ltp - week52_low) / week52_low * 100
        if pct_from_low > Config.LOW_THRESHOLD_PCT:
            return

        pct_from_high = (week52_high - ltp) / week52_high * 100 if week52_high else 0.0
        company_name, sector = _lookup_name_sector(symbol)
        market_cap_cr = stock_data.get("market_cap_cr", 0.0)

        # Extract fundamentals from stock_data (already fetched from yfinance .info)
        pe_ratio = stock_data.get("pe_ratio")
        forward_pe = stock_data.get("forward_pe")
        debt_to_equity = stock_data.get("debt_to_equity")
        roe = stock_data.get("roe")
        roce = stock_data.get("roce")
        free_cash_flow = stock_data.get("free_cash_flow")
        promoter_holding = stock_data.get("promoter_holding")

        # Run fundamental buy filters
        passed, reason = self.fundamental.passes_buy_filters(stock_data, sector)
        if not passed:
            logger.debug("%s: fundamental filter failed — %s", symbol, reason)
            return

        # Technical indicators
        hist = self.fetcher.get_historical_data(ticker, period="6mo")
        technicals = self.technical.compute_all_indicators(hist) if hist is not None and not hist.empty else {}

        rsi_14 = technicals.get("rsi_14")
        macd_signal = technicals.get("macd_signal")
        ema_20 = technicals.get("ema_20")
        ema_50 = technicals.get("ema_50")
        ema_200 = technicals.get("ema_200")

        # Compute trade levels
        levels = self.fundamental.compute_trade_levels(ltp, week52_low, week52_high, "BUY_SETUP")

        # Build thesis
        thesis = self.fundamental.generate_buy_thesis(stock_data, pct_from_low)

        signal = StockSignal(
            symbol=symbol,
            ticker=ticker,
            company_name=company_name,
            ltp=ltp,
            week52_low=week52_low,
            week52_high=week52_high,
            pct_from_low=round(pct_from_low, 2),
            pct_from_high=round(pct_from_high, 2),
            market_cap_cr=market_cap_cr,
            pe_ratio=pe_ratio,
            forward_pe=forward_pe,
            debt_to_equity=debt_to_equity,
            roe=roe,
            roce=roce,
            free_cash_flow=free_cash_flow,
            promoter_holding=promoter_holding,
            rsi_14=rsi_14,
            macd_signal=macd_signal,
            ema_20=ema_20,
            ema_50=ema_50,
            ema_200=ema_200,
            signal_type="BUY_SETUP",
            thesis=thesis,
            entry_min=levels.get("entry_min"),
            entry_max=levels.get("entry_max"),
            stop_loss=levels.get("stop_loss"),
            target_1=levels.get("target_1"),
            target_2=levels.get("target_2"),
            sector=sector,
        )
        signals.append(signal)
        self.db.save_signal(signal)
        logger.info("BUY_SETUP: %s @ %.2f (%.1f%% from 52W low)", symbol, ltp, pct_from_low)

    # ------------------------------------------------------------------
    # 52-week high scan  →  EXIT_SETUP
    # ------------------------------------------------------------------
    def scan_52w_highs(self) -> list[StockSignal]:
        """Identify stocks within 3% of 52-week high — potential exits."""
        logger.info("Starting 52W-high scan …")
        t0 = time.time()
        signals: list[StockSignal] = []
        scanned = 0
        tickers = get_all_tickers()

        for batch_start in range(0, len(tickers), BATCH_SIZE):
            batch = tickers[batch_start : batch_start + BATCH_SIZE]
            for ticker in batch:
                scanned += 1
                symbol = ticker.replace(".NS", "")
                try:
                    self._process_high_candidate(ticker, symbol, signals)
                except Exception:
                    logger.debug("Error processing %s (high scan), skipping", ticker, exc_info=True)

            processed = min(batch_start + BATCH_SIZE, len(tickers))
            logger.info("52W-high scan progress: %d / %d tickers", processed, len(tickers))
            if batch_start + BATCH_SIZE < len(tickers):
                time.sleep(BATCH_PAUSE_SECONDS)

        elapsed = time.time() - t0
        self.db.log_scan("52W_HIGH", scanned, len(signals), elapsed)
        logger.info(
            "52W-high scan complete: %d scanned, %d signals, %.1fs",
            scanned,
            len(signals),
            elapsed,
        )
        return signals

    def _process_high_candidate(
        self, ticker: str, symbol: str, signals: list[StockSignal]
    ) -> None:
        stock_data = self.fetcher.get_stock_data(ticker)
        if stock_data is None:
            return

        ltp = stock_data.get("ltp", 0.0)
        week52_low = stock_data.get("week52_low", 0.0)
        week52_high = stock_data.get("week52_high", 0.0)

        if week52_high <= 0 or ltp <= 0:
            return

        pct_from_high = (week52_high - ltp) / week52_high * 100
        if pct_from_high > Config.HIGH_THRESHOLD_PCT:
            return

        pct_from_low = (ltp - week52_low) / week52_low * 100 if week52_low else 0.0
        company_name, sector = _lookup_name_sector(symbol)
        market_cap_cr = stock_data.get("market_cap_cr", 0.0)

        # Extract fundamentals
        pe_ratio = stock_data.get("pe_ratio")
        forward_pe = stock_data.get("forward_pe")
        debt_to_equity = stock_data.get("debt_to_equity")
        roe = stock_data.get("roe")
        roce = stock_data.get("roce")
        free_cash_flow = stock_data.get("free_cash_flow")
        promoter_holding = stock_data.get("promoter_holding")

        # Technical indicators
        hist = self.fetcher.get_historical_data(ticker, period="6mo")
        technicals = self.technical.compute_all_indicators(hist) if hist is not None and not hist.empty else {}

        rsi_14 = technicals.get("rsi_14")
        macd_signal = technicals.get("macd_signal")
        ema_20 = technicals.get("ema_20")
        ema_50 = technicals.get("ema_50")
        ema_200 = technicals.get("ema_200")

        # EXIT criteria: RSI >= 75 OR valuation stretched
        rsi_overbought = rsi_14 is not None and rsi_14 >= Config.RSI_OVERBOUGHT
        valuation_stretched = self.fundamental.is_valuation_stretched(pe_ratio, forward_pe)

        if not (rsi_overbought or valuation_stretched):
            return

        # Compute exit levels
        levels = self.fundamental.compute_trade_levels(ltp, week52_low, week52_high, "EXIT_SETUP")
        trailing_sl = levels.get("trailing_sl")
        sell_pct = levels.get("sell_pct", 50.0)

        # Build thesis
        thesis = self.fundamental.generate_exit_thesis(stock_data, rsi_14 or 0.0, pct_from_high)

        signal = StockSignal(
            symbol=symbol,
            ticker=ticker,
            company_name=company_name,
            ltp=ltp,
            week52_low=week52_low,
            week52_high=week52_high,
            pct_from_low=round(pct_from_low, 2),
            pct_from_high=round(pct_from_high, 2),
            market_cap_cr=market_cap_cr,
            pe_ratio=pe_ratio,
            forward_pe=forward_pe,
            debt_to_equity=debt_to_equity,
            roe=roe,
            roce=roce,
            free_cash_flow=free_cash_flow,
            promoter_holding=promoter_holding,
            rsi_14=rsi_14,
            macd_signal=macd_signal,
            ema_20=ema_20,
            ema_50=ema_50,
            ema_200=ema_200,
            signal_type="EXIT_SETUP",
            thesis=thesis,
            trailing_sl=trailing_sl,
            sell_pct=sell_pct,
            sector=sector,
        )
        signals.append(signal)
        self.db.save_signal(signal)
        logger.info("EXIT_SETUP: %s @ %.2f (%.1f%% from 52W high)", symbol, ltp, pct_from_high)

    # ------------------------------------------------------------------
    # Full scan orchestration
    # ------------------------------------------------------------------
    def run_full_scan(self) -> dict:
        """Execute breadth + 52W-low + 52W-high scans and return combined results."""
        logger.info("=" * 60)
        logger.info("AlphaPulse full scan started")
        logger.info("=" * 60)
        t0 = time.time()

        breadth = self.scan_market_breadth()
        buy_setups = self.scan_52w_lows()
        exit_setups = self.scan_52w_highs()

        elapsed = time.time() - t0
        self.db.log_scan("FULL_SCAN", len(get_all_tickers()), len(buy_setups) + len(exit_setups), elapsed)

        logger.info("=" * 60)
        logger.info(
            "Full scan complete in %.1fs — %d BUY setups, %d EXIT setups",
            elapsed,
            len(buy_setups),
            len(exit_setups),
        )
        logger.info("=" * 60)

        return {
            "breadth": breadth,
            "buy_setups": buy_setups,
            "exit_setups": exit_setups,
        }
