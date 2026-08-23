"""AlphaPulse-IN: Institutional Indian Equities Quant & Fundamental Intelligence Engine."""

from alphapulse.config import Config
from alphapulse.database import Database
from alphapulse.fetcher import MarketDataFetcher
from alphapulse.fundamental import FundamentalAnalyzer
from alphapulse.models import MarketBreadth, StockSignal
from alphapulse.scanner import AlphaPulseScanner
from alphapulse.technical import TechnicalAnalyzer
from alphapulse.telegram_bot import TelegramNotifier
from alphapulse.universe import NSE_UNIVERSE, NIFTY_50_SYMBOLS, get_all_tickers, get_by_sector

__version__ = "1.0.0"
__author__ = "AlphaPulse-IN Quantitative Research"

__all__ = [
    "Config",
    "Database",
    "MarketBreadth",
    "MarketDataFetcher",
    "FundamentalAnalyzer",
    "TechnicalAnalyzer",
    "StockSignal",
    "AlphaPulseScanner",
    "TelegramNotifier",
    "NSE_UNIVERSE",
    "NIFTY_50_SYMBOLS",
    "get_all_tickers",
    "get_by_sector",
]
