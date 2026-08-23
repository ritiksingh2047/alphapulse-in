"""Core market data fetcher using yfinance for NSE equities."""

import time
import logging
from typing import Optional

import numpy as np
import pandas as pd
import yfinance as yf

logger = logging.getLogger(__name__)

# Keys yfinance may use for LTP, ordered by reliability
_LTP_KEYS = ("regularMarketPrice", "currentPrice", "previousClose")


class MarketDataFetcher:
    """Fetches and normalises Indian equity data from Yahoo Finance."""

    # -----------------------------------------------------------------
    # 1. Single-stock fundamentals
    # -----------------------------------------------------------------
    def get_stock_data(self, ticker: str) -> Optional[dict]:
        """Fetch fundamental + price snapshot for *one* NSE ticker.

        Parameters
        ----------
        ticker : str
            Yahoo-format ticker, e.g. ``"RELIANCE.NS"``.

        Returns
        -------
        dict | None
            Normalised dict or ``None`` on failure.
        """
        try:
            info: dict = yf.Ticker(ticker).info or {}
            if not info or info.get("regularMarketPrice") is None and info.get("currentPrice") is None:
                logger.warning("Empty .info for %s", ticker)
                return None

            ltp = _first(info, *_LTP_KEYS)
            if ltp is None:
                logger.warning("No LTP found for %s", ticker)
                return None

            raw_mc = info.get("marketCap")
            market_cap_cr = raw_mc / 1e7 if raw_mc else 0.0

            roe_raw = info.get("returnOnEquity")
            # yfinance returns ROE/ROCE as decimals (0.15 = 15%)
            roe = _to_pct(roe_raw)

            # returnOnCapitalEmployed rarely available; proxy with returnOnAssets
            roce_raw = info.get("returnOnCapitalEmployed") or info.get("returnOnAssets")
            roce = _to_pct(roce_raw)

            week52_low = info.get("fiftyTwoWeekLow")
            week52_high = info.get("fiftyTwoWeekHigh")

            return {
                "ticker": ticker,
                "company_name": info.get("longName") or info.get("shortName") or ticker.replace(".NS", ""),
                "ltp": float(ltp),
                "week52_low": float(week52_low) if week52_low else 0.0,
                "week52_high": float(week52_high) if week52_high else 0.0,
                "market_cap_cr": market_cap_cr,
                "pe_ratio": _safe_float(info.get("trailingPE")),
                "forward_pe": _safe_float(info.get("forwardPE")),
                "debt_to_equity": _safe_float(info.get("debtToEquity")),
                "roe": roe,
                "roce": roce,
                "free_cash_flow": _safe_float(info.get("freeCashflow")),
                "sector": info.get("sector") or "",
                "promoter_holding": _safe_float(info.get("heldPercentInsiders")),
            }
        except Exception:
            logger.exception("Failed to fetch stock data for %s", ticker)
            return None

    # -----------------------------------------------------------------
    # 2. Historical OHLCV
    # -----------------------------------------------------------------
    def get_historical_data(
        self,
        ticker: str,
        period: str = "1y",
        interval: str = "1d",
    ) -> Optional[pd.DataFrame]:
        """Download OHLCV history for a single ticker.

        Returns ``None`` on failure or when the resulting frame is empty.
        """
        try:
            df: pd.DataFrame = yf.download(
                ticker,
                period=period,
                interval=interval,
                progress=False,
                auto_adjust=True,
            )
            if df is None or df.empty:
                logger.warning("No historical data for %s (period=%s)", ticker, period)
                return None
            # yf.download with a single ticker may return MultiIndex columns;
            # flatten to simple column names.
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
            return df
        except Exception:
            logger.exception("Historical download failed for %s", ticker)
            return None

    # -----------------------------------------------------------------
    # 3. Index snapshot
    # -----------------------------------------------------------------
    def get_index_data(self, index_ticker: str = "^NSEI") -> Optional[dict]:
        """Current value + daily change for an NSE index.

        Parameters
        ----------
        index_ticker : str
            ``"^NSEI"`` (Nifty 50) or ``"^NSEBANK"`` (Bank Nifty).
        """
        try:
            info: dict = yf.Ticker(index_ticker).info or {}
            ltp = _first(info, *_LTP_KEYS)
            if ltp is None:
                # Fallback: grab the last close from history
                hist = yf.download(index_ticker, period="5d", progress=False, auto_adjust=True)
                if hist is None or hist.empty:
                    logger.warning("No data for index %s", index_ticker)
                    return None
                if isinstance(hist.columns, pd.MultiIndex):
                    hist.columns = hist.columns.get_level_values(0)
                ltp = float(hist["Close"].iloc[-1])
                prev = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else ltp
                return {
                    "ltp": ltp,
                    "prev_close": prev,
                    "change_pct": _change_pct(ltp, prev),
                }

            prev_close = info.get("regularMarketPreviousClose") or info.get("previousClose")
            prev_close = float(prev_close) if prev_close else float(ltp)
            return {
                "ltp": float(ltp),
                "prev_close": prev_close,
                "change_pct": _change_pct(float(ltp), prev_close),
            }
        except Exception:
            logger.exception("Index fetch failed for %s", index_ticker)
            return None

    # -----------------------------------------------------------------
    # 4. Market breadth
    # -----------------------------------------------------------------
    def get_market_breadth(self, tickers: list[str]) -> tuple[int, int, int]:
        """Count advances / declines / unchanged across *tickers*.

        Uses a batch 2-day download so only two trading days are fetched.
        Returns ``(advances, declines, unchanged)``; on total failure all
        counts are zero.
        """
        advances = declines = unchanged = 0
        if not tickers:
            return (0, 0, 0)

        try:
            df = yf.download(tickers, period="2d", group_by="ticker", progress=False, auto_adjust=True)
            if df is None or df.empty or len(df) < 2:
                logger.warning("Insufficient breadth data (%d rows)", 0 if df is None else len(df))
                return (0, 0, 0)

            for tkr in tickers:
                try:
                    if len(tickers) == 1:
                        closes = df["Close"]
                    else:
                        closes = df[(tkr, "Close")] if (tkr, "Close") in df.columns else df[tkr]["Close"]

                    closes = closes.dropna()
                    if len(closes) < 2:
                        continue
                    change = float(closes.iloc[-1]) - float(closes.iloc[-2])
                    if change > 0:
                        advances += 1
                    elif change < 0:
                        declines += 1
                    else:
                        unchanged += 1
                except Exception:
                    logger.debug("Breadth: skipping %s", tkr)
        except Exception:
            logger.exception("Market breadth batch download failed")

        return (advances, declines, unchanged)

    # -----------------------------------------------------------------
    # 5. Bulk quotes
    # -----------------------------------------------------------------
    def get_bulk_quotes(self, tickers: list[str]) -> dict[str, dict]:
        """Batch-fetch LTP + 52-week range for many tickers.

        Strategy: download 1 year of daily closes via ``yf.download`` to
        compute 52-week high/low from actual history (faster than
        per-ticker ``.info`` calls). Falls back to individual fetches on
        batch failure.
        """
        results: dict[str, dict] = {}
        if not tickers:
            return results

        try:
            df = yf.download(
                tickers,
                period="1y",
                group_by="ticker",
                progress=False,
                auto_adjust=True,
            )
            if df is not None and not df.empty:
                results = self._parse_bulk_frame(df, tickers)
        except Exception:
            logger.exception("Bulk download failed; falling back to individual fetches")

        # Fall back for any tickers missing from batch result
        missing = [t for t in tickers if t not in results]
        for tkr in missing:
            data = self.get_stock_data(tkr)
            if data:
                results[tkr] = data
            time.sleep(1)  # rate-limit individual calls

        return results

    # ------ internal helpers -----------------------------------------

    def _parse_bulk_frame(
        self,
        df: pd.DataFrame,
        tickers: list[str],
    ) -> dict[str, dict]:
        """Extract per-ticker stats from a batch-downloaded DataFrame."""
        out: dict[str, dict] = {}

        for tkr in tickers:
            try:
                if len(tickers) == 1:
                    close = df["Close"]
                    high = df["High"]
                    low = df["Low"]
                else:
                    close = df[(tkr, "Close")] if (tkr, "Close") in df.columns else df[tkr]["Close"]
                    high = df[(tkr, "High")] if (tkr, "High") in df.columns else df[tkr]["High"]
                    low = df[(tkr, "Low")] if (tkr, "Low") in df.columns else df[tkr]["Low"]

                close = close.dropna()
                high = high.dropna()
                low = low.dropna()

                if close.empty:
                    continue

                ltp = float(close.iloc[-1])
                w52_high = float(high.max())
                w52_low = float(low.min())

                out[tkr] = {
                    "ticker": tkr,
                    "company_name": tkr.replace(".NS", ""),
                    "ltp": ltp,
                    "week52_low": w52_low,
                    "week52_high": w52_high,
                    "market_cap_cr": 0.0,
                    "pe_ratio": None,
                    "forward_pe": None,
                    "debt_to_equity": None,
                    "roe": None,
                    "roce": None,
                    "free_cash_flow": None,
                    "sector": "",
                    "promoter_holding": None,
                }
            except Exception:
                logger.debug("Bulk parse: skipping %s", tkr)

        return out


# =====================================================================
# Module-level helpers (not part of the public API)
# =====================================================================

def _first(d: dict, *keys: str):
    """Return the first non-``None`` value from *d* for the given keys."""
    for k in keys:
        v = d.get(k)
        if v is not None:
            return v
    return None


def _safe_float(v) -> Optional[float]:
    """Convert to float if possible; return ``None`` otherwise."""
    if v is None:
        return None
    try:
        f = float(v)
        return f if np.isfinite(f) else None
    except (ValueError, TypeError):
        return None


def _to_pct(v) -> Optional[float]:
    """Convert a decimal ratio (0.15) to a percentage (15.0).

    yfinance sometimes returns the value already as a percentage (>1),
    so we only multiply when the absolute value is < 1.
    """
    f = _safe_float(v)
    if f is None:
        return None
    if abs(f) < 1:
        return round(f * 100, 2)
    return round(f, 2)


def _change_pct(current: float, previous: float) -> float:
    if previous == 0:
        return 0.0
    return round((current - previous) / previous * 100, 2)
