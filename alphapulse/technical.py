"""Technical analysis engine — pure pandas/numpy, no external TA dependency."""

from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd


class TechnicalAnalyzer:
    """Compute technical indicators on OHLCV DataFrames."""

    # ------------------------------------------------------------------
    # RSI (Wilder's smoothing via EWM alpha=1/period)
    # ------------------------------------------------------------------
    @staticmethod
    def compute_rsi(df: pd.DataFrame, period: int = 14) -> pd.Series:
        """Wilder's RSI.  Returns a Series aligned with *df*."""
        delta = df["Close"].diff()
        gain = delta.where(delta > 0, 0.0)
        loss = -delta.where(delta < 0, 0.0)
        avg_gain = gain.ewm(alpha=1 / period, min_periods=period).mean()
        avg_loss = loss.ewm(alpha=1 / period, min_periods=period).mean()
        rs = avg_gain / avg_loss
        rsi: pd.Series = 100.0 - (100.0 / (1.0 + rs))
        return rsi

    # ------------------------------------------------------------------
    # MACD
    # ------------------------------------------------------------------
    @staticmethod
    def compute_macd(
        df: pd.DataFrame,
        fast: int = 12,
        slow: int = 26,
        signal: int = 9,
    ) -> dict[str, object]:
        """MACD line, signal line, histogram, and trend string.

        Returns the *latest* values as a flat dict.
        """
        close = df["Close"]
        ema_fast = close.ewm(span=fast, adjust=False).mean()
        ema_slow = close.ewm(span=slow, adjust=False).mean()
        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=signal, adjust=False).mean()
        histogram = macd_line - signal_line

        macd_val = macd_line.iloc[-1] if len(macd_line) else np.nan
        signal_val = signal_line.iloc[-1] if len(signal_line) else np.nan
        hist_val = histogram.iloc[-1] if len(histogram) else np.nan
        trend = "BULLISH" if macd_val > signal_val else "BEARISH"

        return {
            "macd": float(macd_val),
            "signal": float(signal_val),
            "histogram": float(hist_val),
            "trend": trend,
        }

    # ------------------------------------------------------------------
    # EMA
    # ------------------------------------------------------------------
    @staticmethod
    def compute_ema(df: pd.DataFrame, period: int) -> pd.Series:
        """Standard exponential moving average on Close prices."""
        return df["Close"].ewm(span=period, adjust=False).mean()

    # ------------------------------------------------------------------
    # Bollinger Bands
    # ------------------------------------------------------------------
    @staticmethod
    def compute_bollinger_bands(
        df: pd.DataFrame,
        period: int = 20,
        std_dev: int = 2,
    ) -> dict[str, float]:
        """Returns latest upper / middle / lower bands and bandwidth."""
        close = df["Close"]
        middle = close.rolling(window=period).mean()
        rolling_std = close.rolling(window=period).std()
        upper = middle + std_dev * rolling_std
        lower = middle - std_dev * rolling_std
        bandwidth = upper - lower

        return {
            "upper": float(upper.iloc[-1]),
            "middle": float(middle.iloc[-1]),
            "lower": float(lower.iloc[-1]),
            "bandwidth": float(bandwidth.iloc[-1]),
        }

    # ------------------------------------------------------------------
    # Consolidated indicator computation
    # ------------------------------------------------------------------
    def compute_all_indicators(self, df: pd.DataFrame) -> dict[str, object]:
        """Compute RSI-14, MACD, EMA-20/50/200, Bollinger Bands.

        Indicators that require more bars than available are set to *None*.
        """
        length = len(df)
        result: dict[str, object] = {
            "rsi_14": None,
            "macd_signal": None,
            "ema_20": None,
            "ema_50": None,
            "ema_200": None,
            "bb_upper": None,
            "bb_lower": None,
            "bb_middle": None,
        }

        if length < 2:
            return result

        # RSI — needs >= period+1 rows for a meaningful value
        if length >= 15:
            rsi_series = self.compute_rsi(df)
            val = rsi_series.iloc[-1]
            result["rsi_14"] = round(float(val), 2) if not np.isnan(val) else None

        # MACD — needs >= slow(26) bars ideally
        if length >= 26:
            macd = self.compute_macd(df)
            result["macd_signal"] = macd["trend"]

        # EMAs
        if length >= 20:
            ema20 = self.compute_ema(df, 20).iloc[-1]
            result["ema_20"] = round(float(ema20), 2) if not np.isnan(ema20) else None
        if length >= 50:
            ema50 = self.compute_ema(df, 50).iloc[-1]
            result["ema_50"] = round(float(ema50), 2) if not np.isnan(ema50) else None
        if length >= 200:
            ema200 = self.compute_ema(df, 200).iloc[-1]
            result["ema_200"] = round(float(ema200), 2) if not np.isnan(ema200) else None

        # Bollinger Bands — needs >= period(20) bars
        if length >= 20:
            bb = self.compute_bollinger_bands(df)
            if not np.isnan(bb["upper"]):
                result["bb_upper"] = round(bb["upper"], 2)
                result["bb_middle"] = round(bb["middle"], 2)
                result["bb_lower"] = round(bb["lower"], 2)

        return result

    # ------------------------------------------------------------------
    # Volume divergence
    # ------------------------------------------------------------------
    @staticmethod
    def detect_volume_divergence(df: pd.DataFrame, lookback: int = 10) -> bool:
        """Bearish volume divergence: price making higher highs while
        volume is declining over the last *lookback* bars."""
        if len(df) < lookback:
            return False

        recent = df.iloc[-lookback:]
        highs = recent["High"].values
        volumes = recent["Volume"].values

        # Check for higher highs in the second half vs first half
        mid = lookback // 2
        first_half_high = float(np.max(highs[:mid]))
        second_half_high = float(np.max(highs[mid:]))
        higher_highs = second_half_high > first_half_high

        # Check for declining average volume
        first_half_vol = float(np.mean(volumes[:mid]))
        second_half_vol = float(np.mean(volumes[mid:]))
        declining_volume = second_half_vol < first_half_vol

        return higher_highs and declining_volume
