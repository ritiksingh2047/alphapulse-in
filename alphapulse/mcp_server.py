"""FastMCP server and tool ecosystem for AlphaPulse-IN.

Exposes Model Context Protocol (MCP) tools for LLM integration (FastMCP/LangChain):
- mcp_yfinance_realtime(ticker: str)
- mcp_fundamental_data(ticker: str)
- mcp_technical_signals(ticker: str, timeframe: str)
- mcp_dashboard_sync(data_payload: dict)
- mcp_telegram_notifier(message: str)
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from alphapulse.config import Config
from alphapulse.database import Database
from alphapulse.fetcher import MarketDataFetcher
from alphapulse.fundamental import FundamentalAnalyzer
from alphapulse.models import MarketBreadth, StockSignal
from alphapulse.technical import TechnicalAnalyzer
from alphapulse.telegram_bot import TelegramNotifier

logger = logging.getLogger(__name__)

# Singletons for tools
_fetcher = MarketDataFetcher()
_tech_analyzer = TechnicalAnalyzer()
_fund_analyzer = FundamentalAnalyzer()
_db = Database()
_notifier = TelegramNotifier()


def mcp_yfinance_realtime(ticker: str) -> dict[str, Any]:
    """Pulls live quotes, OHLCV, 52-week range, market cap, and volume using .NS / .BO tickers.

    Args:
        ticker: Equity ticker symbol with exchange suffix (e.g., 'RELIANCE.NS', 'TCS.NS', 'SBIN.BO')

    Returns:
        Structured dictionary with LTP, 52W high/low, volume, market cap, and price changes.
    """
    if not (ticker.endswith(".NS") or ticker.endswith(".BO")):
        ticker = f"{ticker}.NS"

    stock_data = _fetcher.get_stock_data(ticker)
    if not stock_data:
        return {"status": "error", "message": f"Failed to fetch real-time data for {ticker}"}

    hist = _fetcher.get_historical_data(ticker, period="5d")
    recent_volume = int(hist["Volume"].iloc[-1]) if hist is not None and not hist.empty and "Volume" in hist else None

    return {
        "status": "success",
        "ticker": ticker,
        "company_name": stock_data.get("company_name"),
        "ltp": stock_data.get("ltp"),
        "week52_low": stock_data.get("week52_low"),
        "week52_high": stock_data.get("week52_high"),
        "pct_from_low": round((stock_data["ltp"] - stock_data["week52_low"]) / stock_data["week52_low"] * 100, 2)
        if stock_data.get("ltp") and stock_data.get("week52_low")
        else None,
        "pct_from_high": round((stock_data["week52_high"] - stock_data["ltp"]) / stock_data["week52_high"] * 100, 2)
        if stock_data.get("ltp") and stock_data.get("week52_high")
        else None,
        "market_cap_cr": stock_data.get("market_cap_cr"),
        "volume": recent_volume,
        "sector": stock_data.get("sector"),
    }


def mcp_fundamental_data(ticker: str) -> dict[str, Any]:
    """Extracts Balance Sheet & P/L metrics for an equity.

    Metrics include: Trailing/Forward P/E, Debt-to-Equity, ROE, ROCE, Free Cash Flow, Promoter Stake.

    Args:
        ticker: Equity ticker symbol with exchange suffix (e.g., 'HDFCBANK.NS')

    Returns:
        Fundamental valuation metrics and institutional filter evaluation.
    """
    if not (ticker.endswith(".NS") or ticker.endswith(".BO")):
        ticker = f"{ticker}.NS"

    stock_data = _fetcher.get_stock_data(ticker)
    if not stock_data:
        return {"status": "error", "message": f"Failed to fetch fundamental data for {ticker}"}

    sector = stock_data.get("sector", "")
    passes_buy, reason = _fund_analyzer.passes_buy_filters(stock_data, sector=sector)
    valuation_stretched = _fund_analyzer.is_valuation_stretched(
        stock_data.get("pe_ratio"), stock_data.get("forward_pe")
    )

    return {
        "status": "success",
        "ticker": ticker,
        "company_name": stock_data.get("company_name"),
        "sector": sector,
        "pe_ratio": stock_data.get("pe_ratio"),
        "forward_pe": stock_data.get("forward_pe"),
        "debt_to_equity": stock_data.get("debt_to_equity"),
        "roe_pct": stock_data.get("roe"),
        "roce_pct": stock_data.get("roce"),
        "free_cash_flow": stock_data.get("free_cash_flow"),
        "promoter_holding_pct": stock_data.get("promoter_holding"),
        "passes_buy_filters": passes_buy,
        "filter_evaluation": reason,
        "valuation_stretched": valuation_stretched,
    }


def mcp_technical_signals(ticker: str, timeframe: str = "6mo") -> dict[str, Any]:
    """Computes technical indicators: RSI(14), MACD, 20/50/200 EMA, and Bollinger Bands.

    Args:
        ticker: Equity ticker symbol (e.g., 'INFY.NS')
        timeframe: Historical period ('1mo', '3mo', '6mo', '1y', '2y')

    Returns:
        Dictionary containing RSI(14), MACD status, EMA trends, and Bollinger Bands.
    """
    if not (ticker.endswith(".NS") or ticker.endswith(".BO")):
        ticker = f"{ticker}.NS"

    hist = _fetcher.get_historical_data(ticker, period=timeframe)
    if hist is None or hist.empty:
        return {"status": "error", "message": f"Insufficient historical OHLCV data for {ticker}"}

    indicators = _tech_analyzer.compute_all_indicators(hist)
    bearish_div = _tech_analyzer.detect_volume_divergence(hist)

    return {
        "status": "success",
        "ticker": ticker,
        "timeframe": timeframe,
        "rsi_14": indicators.get("rsi_14"),
        "macd_trend": indicators.get("macd_trend"),
        "macd_value": indicators.get("macd"),
        "macd_signal": indicators.get("macd_signal"),
        "ema_20": indicators.get("ema_20"),
        "ema_50": indicators.get("ema_50"),
        "ema_200": indicators.get("ema_200"),
        "bb_upper": indicators.get("bb_upper"),
        "bb_middle": indicators.get("bb_middle"),
        "bb_lower": indicators.get("bb_lower"),
        "bearish_volume_divergence": bearish_div,
    }


def mcp_dashboard_sync(data_payload: dict[str, Any]) -> dict[str, Any]:
    """Pushes analyzed signals and structured logs to the frontend state store / SQLite database.

    Args:
        data_payload: Dictionary containing signal list or market snapshot to persist.

    Returns:
        Sync confirmation status with persisted record count.
    """
    try:
        saved_signals = 0
        if "signals" in data_payload and isinstance(data_payload["signals"], list):
            for sig_dict in data_payload["signals"]:
                signal = StockSignal(
                    symbol=sig_dict["symbol"],
                    ticker=sig_dict.get("ticker", f"{sig_dict['symbol']}.NS"),
                    company_name=sig_dict.get("company_name", sig_dict["symbol"]),
                    ltp=float(sig_dict["ltp"]),
                    week52_low=float(sig_dict["week52_low"]),
                    week52_high=float(sig_dict["week52_high"]),
                    pct_from_low=float(sig_dict.get("pct_from_low", 0.0)),
                    pct_from_high=float(sig_dict.get("pct_from_high", 0.0)),
                    market_cap_cr=float(sig_dict.get("market_cap_cr", 0.0)),
                    pe_ratio=sig_dict.get("pe_ratio"),
                    forward_pe=sig_dict.get("forward_pe"),
                    debt_to_equity=sig_dict.get("debt_to_equity"),
                    roe=sig_dict.get("roe"),
                    roce=sig_dict.get("roce"),
                    free_cash_flow=sig_dict.get("free_cash_flow"),
                    promoter_holding=sig_dict.get("promoter_holding"),
                    rsi_14=sig_dict.get("rsi_14"),
                    macd_signal=sig_dict.get("macd_signal"),
                    ema_20=sig_dict.get("ema_20"),
                    ema_50=sig_dict.get("ema_50"),
                    ema_200=sig_dict.get("ema_200"),
                    signal_type=sig_dict.get("signal_type", "BUY_SETUP"),
                    thesis=sig_dict.get("thesis", ""),
                    entry_min=sig_dict.get("entry_min"),
                    entry_max=sig_dict.get("entry_max"),
                    stop_loss=sig_dict.get("stop_loss"),
                    target_1=sig_dict.get("target_1"),
                    target_2=sig_dict.get("target_2"),
                    trailing_sl=sig_dict.get("trailing_sl"),
                    sell_pct=sig_dict.get("sell_pct"),
                    sector=sig_dict.get("sector", ""),
                )
                _db.save_signal(signal)
                saved_signals += 1

        if "breadth" in data_payload and isinstance(data_payload["breadth"], dict):
            b = data_payload["breadth"]
            breadth = MarketBreadth(
                nifty_ltp=float(b.get("nifty_ltp", 0.0)),
                nifty_change_pct=float(b.get("nifty_change_pct", 0.0)),
                banknifty_ltp=float(b.get("banknifty_ltp", 0.0)),
                banknifty_change_pct=float(b.get("banknifty_change_pct", 0.0)),
                advances=int(b.get("advances", 0)),
                declines=int(b.get("declines", 0)),
                unchanged=int(b.get("unchanged", 0)),
            )
            _db.save_market_snapshot(breadth)

        return {
            "status": "success",
            "message": f"Successfully synced state to database. Saved {saved_signals} signal(s).",
            "saved_signals": saved_signals,
        }
    except Exception as e:
        logger.exception("Error syncing dashboard payload")
        return {"status": "error", "message": str(e)}


def mcp_telegram_notifier(message: str) -> dict[str, Any]:
    """Dispatches trade alerts and market opening summaries directly to the Telegram bot channel.

    Args:
        message: Markdown formatted alert message string.

    Returns:
        Dispatch confirmation status.
    """
    if not Config.TELEGRAM_BOT_TOKEN or not Config.TELEGRAM_CHAT_ID:
        return {
            "status": "skipped",
            "message": "Telegram bot token or chat ID not configured in environment (ALPHAPULSE_TG_TOKEN, ALPHAPULSE_TG_CHAT_ID).",
        }

    success = _notifier.send_message_sync(message)
    return {
        "status": "success" if success else "failed",
        "message": "Alert dispatched to Telegram channel" if success else "Failed to send Telegram message",
    }
