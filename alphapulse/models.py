from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class StockSignal:
    symbol: str              # e.g. "RELIANCE"
    ticker: str              # e.g. "RELIANCE.NS"
    company_name: str
    ltp: float
    week52_low: float
    week52_high: float
    pct_from_low: float      # (ltp - 52w_low) / 52w_low * 100
    pct_from_high: float     # (52w_high - ltp) / 52w_high * 100
    market_cap_cr: float     # in crores
    pe_ratio: Optional[float] = None
    forward_pe: Optional[float] = None
    debt_to_equity: Optional[float] = None
    roe: Optional[float] = None
    roce: Optional[float] = None
    free_cash_flow: Optional[float] = None
    promoter_holding: Optional[float] = None
    rsi_14: Optional[float] = None
    macd_signal: Optional[str] = None  # "BULLISH" / "BEARISH"
    ema_20: Optional[float] = None
    ema_50: Optional[float] = None
    ema_200: Optional[float] = None
    signal_type: str = ""    # "BUY_SETUP" or "EXIT_SETUP"
    thesis: str = ""
    entry_min: Optional[float] = None
    entry_max: Optional[float] = None
    stop_loss: Optional[float] = None
    target_1: Optional[float] = None
    target_2: Optional[float] = None
    trailing_sl: Optional[float] = None
    sell_pct: Optional[float] = None
    timestamp: datetime = field(default_factory=datetime.now)
    sector: str = ""


@dataclass
class MarketBreadth:
    nifty_ltp: float
    nifty_change_pct: float
    banknifty_ltp: float
    banknifty_change_pct: float
    advances: int
    declines: int
    unchanged: int
    timestamp: datetime = field(default_factory=datetime.now)
