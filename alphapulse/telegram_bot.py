"""Telegram notification module for AlphaPulse-IN."""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

import telegram

from alphapulse.config import Config
from alphapulse.models import MarketBreadth, StockSignal

logger = logging.getLogger(__name__)

TELEGRAM_MSG_LIMIT = 4096


class TelegramNotifier:
    """Format and dispatch scan results via Telegram."""

    def __init__(
        self,
        token: Optional[str] = None,
        chat_id: Optional[str] = None,
    ) -> None:
        cfg = Config()
        self.token = token or cfg.TELEGRAM_BOT_TOKEN
        self.chat_id = chat_id or cfg.TELEGRAM_CHAT_ID
        if not self.token or not self.chat_id:
            logger.warning("Telegram token or chat_id not configured")

    # ------------------------------------------------------------------
    # Formatters
    # ------------------------------------------------------------------
    @staticmethod
    def format_opening_scan(
        breadth: MarketBreadth,
        buy_signals: list[StockSignal],
        exit_signals: list[StockSignal],
    ) -> str:
        """Produce the full opening-scan Telegram message matching exact system prompt spec."""
        lines: list[str] = []

        # Header
        scan_time_str = breadth.timestamp.strftime("%I:%M %p IST")
        lines.append(f"⚡ *[NSE/BSE] OPENING MARKET SCAN | {scan_time_str}*")
        lines.append("")

        # Index & Breadth
        nifty_chg = f"{breadth.nifty_change_pct:+.2f}" if breadth.nifty_change_pct is not None else "0.00"
        lines.append(
            f"📊 *INDEX:* NIFTY 50 @ {breadth.nifty_ltp:,.2f} ({nifty_chg}%) | "
            f"BANK NIFTY @ {breadth.banknifty_ltp:,.2f}"
        )
        lines.append(
            f"⚖️ *BREADTH:* Advances: {breadth.advances} | Declines: {breadth.declines}"
        )
        lines.append("")

        # Value Accumulation Setup (52-Week Low)
        lines.append("🟢 *VALUE ACCUMULATION SETUP (52-Week Low)*")
        if not buy_signals:
            lines.append("• _No qualified 52-week low accumulation setups detected in current scan._")
        else:
            for s in buy_signals:
                lines.append(f"• *{s.company_name} ({s.symbol}.NS)*")
                lines.append(f"  - *LTP:* ₹{s.ltp:,.2f} (Delta to 52W Low: {s.pct_from_low:.1f}%)")
                
                pe_str = f"{s.pe_ratio:.1f}" if s.pe_ratio is not None else "N/A"
                de_str = f"{s.debt_to_equity:.2f}" if s.debt_to_equity is not None else "N/A"
                roe_str = f"{s.roe:.1f}" if s.roe is not None else "N/A"
                roce_str = f"{s.roce:.1f}" if s.roce is not None else "N/A"
                lines.append(f"  - *Metrics:* P/E: {pe_str} | D/E: {de_str} | ROE: {roe_str}% | ROCE: {roce_str}%")
                
                thesis = s.thesis or "Value mispricing near 52W low with resilient balance sheet"
                lines.append(f"  - *Thesis:* {thesis}")
                
                buy_min = f"{s.entry_min:,.2f}" if s.entry_min is not None else f"{s.ltp * 0.98:,.2f}"
                buy_max = f"{s.entry_max:,.2f}" if s.entry_max is not None else f"{s.ltp * 1.01:,.2f}"
                lines.append(f"  - *Entry Range:* ₹{buy_min} - ₹{buy_max}")
                
                sl = f"{s.stop_loss:,.2f}" if s.stop_loss is not None else f"{s.week52_low * 0.97:,.2f}"
                t1 = f"{s.target_1:,.2f}" if s.target_1 is not None else f"{s.ltp * 1.15:,.2f}"
                t2 = f"{s.target_2:,.2f}" if s.target_2 is not None else f"{s.ltp * 1.30:,.2f}"
                lines.append(f"  - *Stop Loss:* ₹{sl} | *Targets:* T1: ₹{t1} | T2: ₹{t2}")
                lines.append("")

        # Profit Booking Radar (52-Week High)
        lines.append("🔴 *PROFIT BOOKING RADAR (52-Week High)*")
        if not exit_signals:
            lines.append("• _No overextended 52-week high exit triggers detected in current scan._")
        else:
            for s in exit_signals:
                lines.append(f"• *{s.company_name} ({s.symbol}.NS)*")
                lines.append(f"  - *LTP:* ₹{s.ltp:,.2f} | *52W High:* ₹{s.week52_high:,.2f}")
                
                # Determine signal description
                sig_desc = []
                if s.rsi_14 is not None and s.rsi_14 >= 70:
                    sig_desc.append(f"RSI Divergence ({s.rsi_14:.1f})")
                if s.pe_ratio is not None and s.pe_ratio > 40:
                    sig_desc.append(f"Valuation Stretch (P/E {s.pe_ratio:.1f}x)")
                if not sig_desc:
                    sig_desc.append("Overextended Momentum / Volume Exhaustion")
                signal_str = " / ".join(sig_desc)
                lines.append(f"  - *Signal:* {signal_str}")
                
                sell_pct = int(s.sell_pct) if s.sell_pct is not None else 50
                tsl = f"{s.trailing_sl:,.2f}" if s.trailing_sl is not None else f"{s.ltp * 0.95:,.2f}"
                lines.append(f"  - *Action:* Lock {sell_pct}% profits | Revise Trailing SL to ₹{tsl}.")
                lines.append("")

        # Footer
        lines.append("⚠️ *Risk Advisory:* Maintain 2-3% max risk per trade. Not financial advice.")
        return "\n".join(lines)
    @staticmethod
    def format_alert(signal: StockSignal) -> str:
        """Format a single-stock alert message."""
        emoji = "🟢" if signal.signal_type == "BUY_SETUP" else "🔴"
        tag = "BUY SETUP" if signal.signal_type == "BUY_SETUP" else "EXIT SETUP"

        lines: list[str] = [
            f"*{emoji} {tag}: {signal.company_name}* (`{signal.symbol}`)",
            f"LTP: ₹{signal.ltp:,.2f}",
        ]

        if signal.signal_type == "BUY_SETUP":
            lines.append(f"📉 {signal.pct_from_low:.1f}% from 52W Low (₹{signal.week52_low:,.2f})")
            if signal.entry_min and signal.entry_max:
                lines.append(f"*Entry:* ₹{signal.entry_min:,.2f} – ₹{signal.entry_max:,.2f}")
            if signal.stop_loss:
                lines.append(f"*SL:* ₹{signal.stop_loss:,.2f}")
            if signal.target_1:
                lines.append(f"*T1:* ₹{signal.target_1:,.2f}")
            if signal.target_2:
                lines.append(f"*T2:* ₹{signal.target_2:,.2f}")
        else:
            lines.append(f"📈 {signal.pct_from_high:.1f}% from 52W High (₹{signal.week52_high:,.2f})")
            if signal.trailing_sl:
                lines.append(f"*Trailing SL:* ₹{signal.trailing_sl:,.2f}")

        if signal.rsi_14 is not None:
            lines.append(f"RSI(14): {signal.rsi_14:.1f}")
        lines.append(f"💡 _{signal.thesis}_")

        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Senders
    # ------------------------------------------------------------------
    async def send_message(self, text: str) -> bool:
        """Send a Markdown-formatted message via the Telegram Bot API."""
        if not self.token or not self.chat_id:
            logger.error("Telegram not configured — skipping send")
            return False
        try:
            bot = telegram.Bot(token=self.token)
            # Split into chunks if needed
            chunks = _split_message(text, TELEGRAM_MSG_LIMIT)
            for chunk in chunks:
                await bot.send_message(
                    chat_id=self.chat_id,
                    text=chunk,
                    parse_mode="Markdown",
                )
            logger.info("Telegram message sent (%d chunk(s))", len(chunks))
            return True
        except Exception:
            logger.exception("Failed to send Telegram message")
            return False

    async def send_scan_results(
        self,
        breadth: MarketBreadth,
        buy_signals: list[StockSignal],
        exit_signals: list[StockSignal],
    ) -> bool:
        """Format and send full scan results."""
        text = self.format_opening_scan(breadth, buy_signals, exit_signals)
        return await self.send_message(text)

    # ------------------------------------------------------------------
    # Sync wrappers
    # ------------------------------------------------------------------
    def send_message_sync(self, text: str) -> bool:
        """Synchronous wrapper around :meth:`send_message`."""
        return asyncio.run(self.send_message(text))

    def send_scan_results_sync(
        self,
        breadth: MarketBreadth,
        buy_signals: list[StockSignal],
        exit_signals: list[StockSignal],
    ) -> bool:
        """Synchronous wrapper around :meth:`send_scan_results`."""
        return asyncio.run(self.send_scan_results(breadth, buy_signals, exit_signals))


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def _split_message(text: str, limit: int) -> list[str]:
    """Split *text* into chunks of at most *limit* characters, breaking at newlines."""
    if len(text) <= limit:
        return [text]

    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for line in text.split("\n"):
        line_len = len(line) + 1  # +1 for the newline
        if current_len + line_len > limit and current:
            chunks.append("\n".join(current))
            current = []
            current_len = 0
        current.append(line)
        current_len += line_len

    if current:
        chunks.append("\n".join(current))

    return chunks
