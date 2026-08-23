"""Fundamental analysis engine — buy/exit filters, thesis, trade levels."""

from __future__ import annotations

from typing import Optional

from alphapulse.config import Config


class FundamentalAnalyzer:
    """Fundamental screening, thesis generation, and trade-level computation."""

    # ------------------------------------------------------------------
    # Buy-side filter gate
    # ------------------------------------------------------------------
    @staticmethod
    def passes_buy_filters(
        stock_data: dict,
        sector: str = "",
    ) -> tuple[bool, str]:
        """Check fundamental buy criteria.

        Returns ``(True, 'Passes all filters')`` or ``(False, reason)``.
        Metrics that are *None* / missing are silently skipped (not auto-failed).
        BFSI sectors are exempt from the debt-to-equity check.
        """
        failures: list[str] = []

        # a. Market cap
        mcap = stock_data.get("market_cap_cr")
        if mcap is not None and mcap < Config.MIN_MARKET_CAP_CR:
            failures.append(
                f"Market cap ₹{mcap:.0f}Cr below ₹{Config.MIN_MARKET_CAP_CR:.0f}Cr"
            )

        # b. Debt-to-equity (skip for BFSI)
        if sector not in Config.BFSI_SECTORS:
            de = stock_data.get("debt_to_equity")
            if de is not None and de > Config.MAX_DEBT_TO_EQUITY:
                failures.append(
                    f"D/E={de:.2f} exceeds limit {Config.MAX_DEBT_TO_EQUITY}"
                )

        # c. ROE
        roe = stock_data.get("roe")
        if roe is not None and roe < Config.MIN_ROE:
            failures.append(f"ROE={roe:.1f}% below {Config.MIN_ROE}%")

        # d. ROCE
        roce = stock_data.get("roce")
        if roce is not None and roce < Config.MIN_ROCE:
            failures.append(f"ROCE={roce:.1f}% below {Config.MIN_ROCE}%")

        # e. Free cash flow — must be positive
        fcf = stock_data.get("free_cash_flow")
        if fcf is not None and fcf <= 0:
            failures.append(f"Negative FCF={fcf:.0f}")

        if failures:
            return False, "Failed: " + "; ".join(failures)
        return True, "Passes all filters"

    # ------------------------------------------------------------------
    # Thesis generators
    # ------------------------------------------------------------------
    @staticmethod
    def generate_buy_thesis(stock_data: dict, pct_from_low: float) -> str:
        """One-line institutional buy thesis built from available metrics."""
        parts: list[str] = []

        # Fundamentals snippet
        fund_bits: list[str] = []
        roe = stock_data.get("roe")
        if roe is not None:
            fund_bits.append(f"ROE: {roe:.0f}%")
        de = stock_data.get("debt_to_equity")
        if de is not None:
            fund_bits.append(f"D/E: {de:.1f}")
        pe = stock_data.get("pe_ratio")
        if pe is not None:
            fund_bits.append(f"P/E: {pe:.1f}x")
        if fund_bits:
            parts.append(f"Strong fundamentals ({', '.join(fund_bits)})")

        # Proximity to 52-week low
        if pct_from_low < 20:
            parts.append("near 52W low on broad market correction")
        elif pct_from_low < 40:
            parts.append("within striking range of 52W low")

        # FCF
        fcf = stock_data.get("free_cash_flow")
        if fcf is not None and fcf > 0:
            parts.append("positive FCF")

        # Sector context
        sector = stock_data.get("sector", "")
        if sector:
            parts.append(f"sector: {sector}")

        return "; ".join(parts) if parts else "Value buy setup identified"

    @staticmethod
    def generate_exit_thesis(
        stock_data: dict,
        rsi: float,
        pct_from_high: float,
    ) -> str:
        """One-line exit / profit-booking thesis."""
        parts: list[str] = []

        if rsi is not None:
            parts.append(f"RSI at {rsi:.0f}")

        if pct_from_high < 5:
            parts.append("near 52W high")

        pe = stock_data.get("pe_ratio")
        if pe is not None and pe > 40:
            parts.append(f"trailing P/E {pe:.0f}x stretched")

        forward_pe = stock_data.get("forward_pe")
        if forward_pe is not None and forward_pe > 35:
            parts.append(f"forward P/E {forward_pe:.0f}x elevated")

        parts.append("book partial profits")
        return "; ".join(parts)

    # ------------------------------------------------------------------
    # Trade-level computation
    # ------------------------------------------------------------------
    @staticmethod
    def compute_trade_levels(
        ltp: float,
        week52_low: float,
        week52_high: float,
        signal_type: str,
    ) -> dict[str, Optional[float]]:
        """Compute entry / SL / target levels.

        *signal_type*: ``"BUY_SETUP"`` or ``"EXIT_SETUP"``.
        """
        if signal_type == "BUY_SETUP":
            return {
                "entry_min": round(ltp * 0.98, 2),
                "entry_max": round(ltp * 1.01, 2),
                "stop_loss": round(week52_low * 0.97, 2),
                "target_1": round(ltp * 1.15, 2),
                "target_2": round(ltp * 1.30, 2),
                "trailing_sl": None,
                "sell_pct": None,
            }
        # EXIT_SETUP (or anything else — safe fallback)
        return {
            "entry_min": None,
            "entry_max": None,
            "stop_loss": None,
            "target_1": None,
            "target_2": None,
            "trailing_sl": round(ltp * 0.95, 2),
            "sell_pct": 50.0,
        }

    # ------------------------------------------------------------------
    # Valuation stretch heuristic
    # ------------------------------------------------------------------
    @staticmethod
    def is_valuation_stretched(
        pe_ratio: Optional[float] = None,
        forward_pe: Optional[float] = None,
    ) -> bool:
        """True if trailing PE > 50 or forward PE > 40."""
        if pe_ratio is not None and pe_ratio > 50:
            return True
        if forward_pe is not None and forward_pe > 40:
            return True
        return False
