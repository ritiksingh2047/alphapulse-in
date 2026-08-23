"""SQLite persistence layer for AlphaPulse signals, snapshots, and scan logs."""

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Optional

from .models import MarketBreadth, StockSignal


class Database:
    """Thin wrapper around SQLite for signal/snapshot/scan-log CRUD."""

    def __init__(self, db_path: str = 'data/alphapulse.db') -> None:
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_tables()

    # ── connection helper ───────────────────────────────────────────────

    @contextmanager
    def _connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    # ── schema bootstrap ────────────────────────────────────────────────

    def _init_tables(self) -> None:
        with self._connect() as conn:
            cur = conn.cursor()
            cur.execute("""
                CREATE TABLE IF NOT EXISTS signals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol TEXT NOT NULL,
                    ticker TEXT NOT NULL,
                    company_name TEXT,
                    ltp REAL,
                    week52_low REAL,
                    week52_high REAL,
                    pct_from_low REAL,
                    pct_from_high REAL,
                    market_cap_cr REAL,
                    pe_ratio REAL,
                    debt_to_equity REAL,
                    roe REAL,
                    roce REAL,
                    free_cash_flow REAL,
                    rsi_14 REAL,
                    signal_type TEXT,
                    thesis TEXT,
                    entry_min REAL,
                    entry_max REAL,
                    stop_loss REAL,
                    target_1 REAL,
                    target_2 REAL,
                    trailing_sl REAL,
                    sell_pct REAL,
                    sector TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS market_snapshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nifty_ltp REAL,
                    nifty_change_pct REAL,
                    banknifty_ltp REAL,
                    banknifty_change_pct REAL,
                    advances INTEGER,
                    declines INTEGER,
                    unchanged INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS scan_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    scan_type TEXT,
                    stocks_scanned INTEGER,
                    signals_generated INTEGER,
                    duration_seconds REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

    # ── writes ──────────────────────────────────────────────────────────

    def save_signal(self, signal: StockSignal) -> None:
        """Insert a StockSignal record."""
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO signals (
                    symbol, ticker, company_name, ltp,
                    week52_low, week52_high, pct_from_low, pct_from_high,
                    market_cap_cr, pe_ratio, debt_to_equity, roe, roce,
                    free_cash_flow, rsi_14, signal_type, thesis,
                    entry_min, entry_max, stop_loss, target_1, target_2,
                    trailing_sl, sell_pct, sector
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    signal.symbol, signal.ticker, signal.company_name, signal.ltp,
                    signal.week52_low, signal.week52_high,
                    signal.pct_from_low, signal.pct_from_high,
                    signal.market_cap_cr, signal.pe_ratio,
                    signal.debt_to_equity, signal.roe, signal.roce,
                    signal.free_cash_flow, signal.rsi_14,
                    signal.signal_type, signal.thesis,
                    signal.entry_min, signal.entry_max, signal.stop_loss,
                    signal.target_1, signal.target_2,
                    signal.trailing_sl, signal.sell_pct, signal.sector,
                ),
            )

    def save_market_snapshot(self, breadth: MarketBreadth) -> None:
        """Insert a MarketBreadth snapshot."""
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO market_snapshots (
                    nifty_ltp, nifty_change_pct,
                    banknifty_ltp, banknifty_change_pct,
                    advances, declines, unchanged
                ) VALUES (?,?,?,?,?,?,?)
                """,
                (
                    breadth.nifty_ltp, breadth.nifty_change_pct,
                    breadth.banknifty_ltp, breadth.banknifty_change_pct,
                    breadth.advances, breadth.declines, breadth.unchanged,
                ),
            )

    def log_scan(
        self,
        scan_type: str,
        stocks_scanned: int,
        signals_generated: int,
        duration_seconds: float,
    ) -> None:
        """Insert a scan-log entry."""
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO scan_log (scan_type, stocks_scanned, signals_generated, duration_seconds)
                VALUES (?,?,?,?)
                """,
                (scan_type, stocks_scanned, signals_generated, duration_seconds),
            )

    # ── reads ───────────────────────────────────────────────────────────

    def get_latest_signals(
        self, signal_type: Optional[str] = None, limit: int = 50
    ) -> list[dict]:
        """Fetch recent signals, optionally filtered by signal_type."""
        with self._connect() as conn:
            if signal_type:
                rows = conn.execute(
                    "SELECT * FROM signals WHERE signal_type = ? ORDER BY created_at DESC LIMIT ?",
                    (signal_type, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM signals ORDER BY created_at DESC LIMIT ?",
                    (limit,),
                ).fetchall()
            return [dict(r) for r in rows]

    def get_latest_snapshot(self) -> Optional[dict]:
        """Return the most recent market snapshot, or None."""
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM market_snapshots ORDER BY created_at DESC LIMIT 1"
            ).fetchone()
            return dict(row) if row else None

    def get_scan_history(self, limit: int = 20) -> list[dict]:
        """Return recent scan-log entries."""
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM scan_log ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return [dict(r) for r in rows]

    def get_signals_for_date(self, date_str: str) -> list[dict]:
        """Return all signals whose created_at falls on *date_str* (YYYY-MM-DD)."""
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM signals WHERE DATE(created_at) = ? ORDER BY created_at DESC",
                (date_str,),
            ).fetchall()
            return [dict(r) for r in rows]
