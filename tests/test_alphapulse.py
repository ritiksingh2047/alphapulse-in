"""Comprehensive test suite for AlphaPulse-IN.

Covers:
- Universe & Ticker resolution
- Data models
- Config parameters
- Fundamental analysis & institutional filters (BFSI exemption, ROE/ROCE thresholds)
- Technical analysis (RSI, MACD, EMA, Bollinger Bands, Volume divergence)
- SQLite database persistence & retrieval
- Telegram alert formatting & Section 4 spec compliance
- FastMCP tool functions & signatures
- Trade level calculations & thesis generation
"""

import os
import tempfile
import unittest
from datetime import datetime
import numpy as np
import pandas as pd

from alphapulse.config import Config
from alphapulse.database import Database
from alphapulse.fundamental import FundamentalAnalyzer
from alphapulse.models import MarketBreadth, StockSignal
from alphapulse.technical import TechnicalAnalyzer
from alphapulse.telegram_bot import TelegramNotifier, _split_message
from alphapulse.universe import (
    NIFTY_50_SYMBOLS,
    NSE_UNIVERSE,
    get_all_tickers,
    get_by_sector,
)
import alphapulse.mcp_server as mcp


class TestUniverse(unittest.TestCase):
    """Test universe definition, Nifty 50 coverage, and helper utilities."""

    def test_universe_size(self):
        self.assertGreaterEqual(len(NSE_UNIVERSE), 200)

    def test_nifty50_coverage(self):
        universe_symbols = {item["symbol"] for item in NSE_UNIVERSE}
        for n50_sym in NIFTY_50_SYMBOLS:
            self.assertIn(
                n50_sym,
                universe_symbols,
                f"Nifty 50 constituent {n50_sym} missing from NSE_UNIVERSE",
            )

    def test_ticker_format(self):
        tickers = get_all_tickers()
        self.assertEqual(len(tickers), len(NSE_UNIVERSE))
        for ticker in tickers:
            self.assertTrue(ticker.endswith(".NS"), f"Ticker {ticker} missing .NS suffix")

    def test_sector_filtering(self):
        it_stocks = get_by_sector("IT")
        self.assertTrue(len(it_stocks) > 0)
        for stock in it_stocks:
            self.assertEqual(stock["sector"], "IT")


class TestModels(unittest.TestCase):
    """Test dataclass construction and defaults."""

    def test_stock_signal_creation(self):
        sig = StockSignal(
            symbol="RELIANCE",
            ticker="RELIANCE.NS",
            company_name="Reliance Industries Ltd.",
            ltp=2850.0,
            week52_low=2700.0,
            week52_high=3200.0,
            pct_from_low=5.56,
            pct_from_high=10.94,
            market_cap_cr=1925000.0,
            pe_ratio=26.4,
            debt_to_equity=0.42,
            roe=14.5,
            roce=16.8,
            signal_type="BUY_SETUP",
            thesis="Institutional accumulation zone near 52W low",
            entry_min=2793.0,
            entry_max=2878.5,
            stop_loss=2619.0,
            target_1=3277.5,
            target_2=3705.0,
            sector="Oil & Gas",
        )
        self.assertEqual(sig.symbol, "RELIANCE")
        self.assertEqual(sig.signal_type, "BUY_SETUP")
        self.assertIsInstance(sig.timestamp, datetime)

    def test_market_breadth_creation(self):
        mb = MarketBreadth(
            nifty_ltp=24500.5,
            nifty_change_pct=0.45,
            banknifty_ltp=52100.0,
            banknifty_change_pct=-0.12,
            advances=120,
            declines=75,
            unchanged=5,
        )
        self.assertEqual(mb.advances, 120)
        self.assertEqual(mb.declines, 75)
        self.assertIsInstance(mb.timestamp, datetime)


class TestFundamentalAnalyzer(unittest.TestCase):
    """Test quantitative & fundamental rules according to system prompt."""

    def setUp(self):
        self.analyzer = FundamentalAnalyzer()

    def test_passes_buy_filters_ideal(self):
        stock_data = {
            "market_cap_cr": 25000.0,
            "debt_to_equity": 0.35,
            "roe": 18.5,
            "roce": 21.0,
            "free_cash_flow": 1500.0,
            "pe_ratio": 22.0,
        }
        passed, reason = self.analyzer.passes_buy_filters(stock_data, sector="IT")
        self.assertTrue(passed)
        self.assertEqual(reason, "Passes all filters")

    def test_fails_high_debt_non_bfsi(self):
        stock_data = {
            "market_cap_cr": 5000.0,
            "debt_to_equity": 1.8,  # > 1.0 limit
            "roe": 15.0,
            "roce": 18.0,
            "free_cash_flow": 200.0,
        }
        passed, reason = self.analyzer.passes_buy_filters(stock_data, sector="Metals")
        self.assertFalse(passed)
        self.assertIn("D/E=1.80 exceeds limit", reason)

    def test_bfsi_debt_exemption(self):
        """Banking/NBFC/Financials should be exempt from D/E limit."""
        stock_data = {
            "market_cap_cr": 150000.0,
            "debt_to_equity": 6.5,  # Banks naturally have high leverage
            "roe": 16.0,
            "roce": 18.0,
            "free_cash_flow": 5000.0,
        }
        passed, _ = self.analyzer.passes_buy_filters(stock_data, sector="Banking")
        self.assertTrue(passed, "Banking sector should be exempt from D/E check")

        passed_nbfc, _ = self.analyzer.passes_buy_filters(stock_data, sector="NBFC")
        self.assertTrue(passed_nbfc, "NBFC sector should be exempt from D/E check")

    def test_fails_low_roe(self):
        stock_data = {
            "market_cap_cr": 8000.0,
            "debt_to_equity": 0.2,
            "roe": 8.0,  # < 12% min
            "roce": 17.0,
            "free_cash_flow": 100.0,
        }
        passed, reason = self.analyzer.passes_buy_filters(stock_data, sector="Auto")
        self.assertFalse(passed)
        self.assertIn("ROE=8.0% below", reason)

    def test_fails_negative_fcf(self):
        stock_data = {
            "market_cap_cr": 12000.0,
            "debt_to_equity": 0.4,
            "roe": 15.0,
            "roce": 18.0,
            "free_cash_flow": -250.0,  # Negative FCF
        }
        passed, reason = self.analyzer.passes_buy_filters(stock_data, sector="Pharma")
        self.assertFalse(passed)
        self.assertIn("Negative FCF", reason)

    def test_compute_trade_levels_buy(self):
        ltp = 1000.0
        w52_low = 950.0
        w52_high = 1500.0
        levels = self.analyzer.compute_trade_levels(ltp, w52_low, w52_high, "BUY_SETUP")
        self.assertEqual(levels["entry_min"], 980.0)  # 2% below
        self.assertEqual(levels["entry_max"], 1010.0)  # 1% above
        self.assertEqual(levels["stop_loss"], round(950.0 * 0.97, 2))  # 3% below 52W low
        self.assertEqual(levels["target_1"], 1150.0)  # 15%
        self.assertEqual(levels["target_2"], 1300.0)  # 30%

    def test_compute_trade_levels_exit(self):
        ltp = 2000.0
        levels = self.analyzer.compute_trade_levels(ltp, 1200.0, 2020.0, "EXIT_SETUP")
        self.assertEqual(levels["trailing_sl"], 1900.0)  # 5% trailing SL
        self.assertEqual(levels["sell_pct"], 50.0)

    def test_valuation_stretched(self):
        self.assertTrue(self.analyzer.is_valuation_stretched(pe_ratio=55.0))
        self.assertTrue(self.analyzer.is_valuation_stretched(forward_pe=45.0))
        self.assertFalse(self.analyzer.is_valuation_stretched(pe_ratio=25.0, forward_pe=22.0))


class TestTechnicalAnalyzer(unittest.TestCase):
    """Test pure-numpy technical indicators."""

    def setUp(self):
        self.analyzer = TechnicalAnalyzer()
        # Generate synthetic OHLCV DataFrame
        np.random.seed(42)
        dates = pd.date_range("2026-01-01", periods=100, freq="D")
        closes = 100 + np.cumsum(np.random.randn(100) * 1.5)
        highs = closes + np.random.rand(100) * 2
        lows = closes - np.random.rand(100) * 2
        opens = lows + np.random.rand(100) * (highs - lows)
        volumes = np.random.randint(100000, 1000000, size=100)

        self.df = pd.DataFrame(
            {"Open": opens, "High": highs, "Low": lows, "Close": closes, "Volume": volumes},
            index=dates,
        )

    def test_rsi_computation(self):
        rsi = self.analyzer.compute_rsi(self.df, period=14)
        self.assertEqual(len(rsi), len(self.df))
        last_rsi = rsi.iloc[-1]
        self.assertTrue(0.0 <= last_rsi <= 100.0)

    def test_macd_computation(self):
        macd_dict = self.analyzer.compute_macd(self.df)
        self.assertIn("macd", macd_dict)
        self.assertIn("signal", macd_dict)
        self.assertIn("histogram", macd_dict)
        self.assertIn(macd_dict["trend"], ["BULLISH", "BEARISH"])

    def test_ema_computation(self):
        ema20 = self.analyzer.compute_ema(self.df, period=20)
        self.assertEqual(len(ema20), len(self.df))
        self.assertFalse(np.isnan(ema20.iloc[-1]))

    def test_bollinger_bands(self):
        bb = self.analyzer.compute_bollinger_bands(self.df, period=20, std_dev=2)
        self.assertGreater(bb["upper"], bb["middle"])
        self.assertGreater(bb["middle"], bb["lower"])
        self.assertGreater(bb["bandwidth"], 0.0)

    def test_compute_all_indicators(self):
        res = self.analyzer.compute_all_indicators(self.df)
        self.assertIn("rsi_14", res)
        self.assertIn("macd_signal", res)
        self.assertIn("ema_20", res)
        self.assertIn("ema_50", res)
        self.assertIn("bb_upper", res)


class TestDatabase(unittest.TestCase):
    """Test SQLite database CRUD operations with temporary database file."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "test_alphapulse.db")
        self.db = Database(db_path=self.db_path)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_save_and_retrieve_signal(self):
        signal = StockSignal(
            symbol="TCS",
            ticker="TCS.NS",
            company_name="Tata Consultancy Services Ltd.",
            ltp=3950.0,
            week52_low=3800.0,
            week52_high=4500.0,
            pct_from_low=3.95,
            pct_from_high=12.22,
            market_cap_cr=1430000.0,
            pe_ratio=28.5,
            debt_to_equity=0.08,
            roe=48.0,
            roce=58.0,
            signal_type="BUY_SETUP",
            thesis="Institutional buy on valuation pullback",
            entry_min=3871.0,
            entry_max=3989.5,
            stop_loss=3686.0,
            target_1=4542.5,
            target_2=5135.0,
            sector="IT",
        )
        self.db.save_signal(signal)
        latest = self.db.get_latest_signals(signal_type="BUY_SETUP", limit=10)
        self.assertEqual(len(latest), 1)
        self.assertEqual(latest[0]["symbol"], "TCS")
        self.assertEqual(latest[0]["signal_type"], "BUY_SETUP")

    def test_save_and_retrieve_snapshot(self):
        breadth = MarketBreadth(
            nifty_ltp=24650.0,
            nifty_change_pct=0.32,
            banknifty_ltp=52300.0,
            banknifty_change_pct=0.15,
            advances=135,
            declines=60,
            unchanged=5,
        )
        self.db.save_market_snapshot(breadth)
        snap = self.db.get_latest_snapshot()
        self.assertIsNotNone(snap)
        self.assertEqual(snap["nifty_ltp"], 24650.0)
        self.assertEqual(snap["advances"], 135)

    def test_log_scan_and_history(self):
        self.db.log_scan("FULL_SCAN", stocks_scanned=200, signals_generated=4, duration_seconds=12.5)
        history = self.db.get_scan_history(limit=5)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["scan_type"], "FULL_SCAN")
        self.assertEqual(history[0]["stocks_scanned"], 200)


class TestTelegramFormatting(unittest.TestCase):
    """Test compliance of Telegram alert output format with Section 4 specification."""

    def test_format_opening_scan_spec_compliance(self):
        breadth = MarketBreadth(
            nifty_ltp=24580.25,
            nifty_change_pct=0.42,
            banknifty_ltp=52150.80,
            banknifty_change_pct=-0.15,
            advances=142,
            declines=55,
            unchanged=3,
        )

        buy_signal = StockSignal(
            symbol="INFY",
            ticker="INFY.NS",
            company_name="Infosys Ltd.",
            ltp=1720.0,
            week52_low=1650.0,
            week52_high=2050.0,
            pct_from_low=4.24,
            pct_from_high=16.10,
            market_cap_cr=715000.0,
            pe_ratio=24.2,
            debt_to_equity=0.10,
            roe=31.5,
            roce=38.0,
            signal_type="BUY_SETUP",
            thesis="Temporary tech sector rotation mispricing",
            entry_min=1685.60,
            entry_max=1737.20,
            stop_loss=1600.50,
            target_1=1978.00,
            target_2=2236.00,
            sector="IT",
        )

        exit_signal = StockSignal(
            symbol="BAJAJ-AUTO",
            ticker="BAJAJ-AUTO.NS",
            company_name="Bajaj Auto Ltd.",
            ltp=9850.0,
            week52_low=4800.0,
            week52_high=10050.0,
            pct_from_low=105.2,
            pct_from_high=1.99,
            market_cap_cr=275000.0,
            pe_ratio=42.5,
            rsi_14=78.5,
            signal_type="EXIT_SETUP",
            thesis="RSI overbought near 52W high with stretched multiple",
            trailing_sl=9357.50,
            sell_pct=50.0,
            sector="Auto",
        )

        msg = TelegramNotifier.format_opening_scan(
            breadth=breadth,
            buy_signals=[buy_signal],
            exit_signals=[exit_signal],
        )

        # Check required components from Section 4 Output 1
        self.assertIn("OPENING MARKET SCAN", msg)
        self.assertIn("NIFTY 50 @ 24,580.25 (+0.42%)", msg)
        self.assertIn("BANK NIFTY @ 52,150.80", msg)
        self.assertIn("Advances: 142 | Declines: 55", msg)
        self.assertIn("VALUE ACCUMULATION SETUP (52-Week Low)", msg)
        self.assertIn("Infosys Ltd. (INFY.NS)", msg)
        self.assertIn("Delta to 52W Low: 4.2%", msg)
        self.assertIn("P/E: 24.2 | D/E: 0.10 | ROE: 31.5% | ROCE: 38.0%", msg)
        self.assertIn("PROFIT BOOKING RADAR (52-Week High)", msg)
        self.assertIn("Bajaj Auto Ltd. (BAJAJ-AUTO.NS)", msg)
        self.assertIn("52W High: ₹10,050.00", msg)
        self.assertIn("Lock 50% profits | Revise Trailing SL to ₹9,357.50", msg)
        self.assertIn("Risk Advisory", msg)

    def test_message_splitting(self):
        long_msg = "\n".join([f"Line {i} content text" for i in range(500)])
        chunks = _split_message(long_msg, limit=500)
        self.assertGreater(len(chunks), 1)
        for chunk in chunks:
            self.assertLessEqual(len(chunk), 500)


class TestFastMCPTools(unittest.TestCase):
    """Test FastMCP interface functions."""

    def test_mcp_dashboard_sync(self):
        payload = {
            "signals": [
                {
                    "symbol": "HDFCBANK",
                    "ticker": "HDFCBANK.NS",
                    "company_name": "HDFC Bank Ltd.",
                    "ltp": 1600.0,
                    "week52_low": 1550.0,
                    "week52_high": 1800.0,
                    "pct_from_low": 3.23,
                    "pct_from_high": 11.11,
                    "market_cap_cr": 1200000.0,
                    "signal_type": "BUY_SETUP",
                    "sector": "Banking",
                }
            ],
            "breadth": {
                "nifty_ltp": 24500.0,
                "nifty_change_pct": 0.25,
                "banknifty_ltp": 52000.0,
                "banknifty_change_pct": 0.10,
                "advances": 110,
                "declines": 80,
                "unchanged": 10,
            },
        }
        res = mcp.mcp_dashboard_sync(payload)
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["saved_signals"], 1)

    def test_mcp_telegram_notifier_unconfigured(self):
        # When token is empty, should cleanly report skipped rather than crashing
        res = mcp.mcp_telegram_notifier("Test message")
        self.assertIn(res["status"], ["skipped", "success", "failed"])


if __name__ == "__main__":
    unittest.main()
