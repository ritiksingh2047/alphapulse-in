"""AlphaPulse-IN CLI entry point.

Usage::

    python -m alphapulse scan            # full scan
    python -m alphapulse scan --low-only # 52W low only
    python -m alphapulse scan --high-only
    python -m alphapulse dashboard       # launch Streamlit
    python -m alphapulse schedule        # APScheduler loop
"""

from __future__ import annotations

import argparse
import logging
import signal
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

logger = logging.getLogger("alphapulse")


def _setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )


# ------------------------------------------------------------------
# Subcommands
# ------------------------------------------------------------------

def _cmd_scan(args: argparse.Namespace) -> None:
    from alphapulse.config import Config
    from alphapulse.scanner import AlphaPulseScanner
    from alphapulse.telegram_bot import TelegramNotifier

    scanner = AlphaPulseScanner()

    if args.low_only:
        signals = scanner.scan_52w_lows()
        logger.info("Scan complete — %d BUY setups", len(signals))
    elif args.high_only:
        signals = scanner.scan_52w_highs()
        logger.info("Scan complete — %d EXIT setups", len(signals))
    else:
        results = scanner.run_full_scan()
        breadth = results["breadth"]
        buy = results["buy_setups"]
        exits = results["exit_setups"]

        # Send via Telegram if configured
        cfg = Config()
        if cfg.TELEGRAM_BOT_TOKEN and cfg.TELEGRAM_CHAT_ID:
            notifier = TelegramNotifier()
            notifier.send_scan_results_sync(breadth, buy, exits)
        else:
            logger.info("Telegram not configured — skipping notification")


def _cmd_dashboard(_args: argparse.Namespace) -> None:
    dashboard_path = Path(__file__).resolve().parent / "dashboard.py"
    if not dashboard_path.exists():
        logger.error("Dashboard module not found at %s", dashboard_path)
        sys.exit(1)
    logger.info("Launching Streamlit dashboard …")
    subprocess.run(
        [sys.executable, "-m", "streamlit", "run", str(dashboard_path)],
        check=True,
    )


def _cmd_schedule(_args: argparse.Namespace) -> None:
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger

    from alphapulse.config import Config
    from alphapulse.scanner import AlphaPulseScanner
    from alphapulse.telegram_bot import TelegramNotifier

    cfg = Config()
    scanner = AlphaPulseScanner()
    notifier = TelegramNotifier()

    def _run_and_notify() -> None:
        now_ist = datetime.now()
        hour = now_ist.hour
        # Market hours: 09:15–15:30 IST  (we allow 09–16 for margin)
        if hour < 9 or hour >= 16:
            logger.debug("Outside market hours (%02d:%02d) — skipping", hour, now_ist.minute)
            return
        logger.info("Scheduled scan triggered at %s", now_ist.strftime("%H:%M:%S"))
        try:
            results = scanner.run_full_scan()
            notifier.send_scan_results_sync(
                results["breadth"],
                results["buy_setups"],
                results["exit_setups"],
            )
        except Exception:
            logger.exception("Scheduled scan failed")

    scheduler = BackgroundScheduler(timezone="Asia/Kolkata")

    # Opening scan at 09:15 IST, Mon–Fri
    scheduler.add_job(
        _run_and_notify,
        CronTrigger(
            hour=9,
            minute=15,
            day_of_week="mon-fri",
            timezone="Asia/Kolkata",
        ),
        id="opening_scan",
        name="Opening scan at 09:15 IST",
    )

    # Periodic intra-day scans
    interval_min = cfg.SCAN_INTERVAL_MINUTES
    scheduler.add_job(
        _run_and_notify,
        CronTrigger(
            hour="9-15",
            minute=f"*/{interval_min}",
            day_of_week="mon-fri",
            timezone="Asia/Kolkata",
        ),
        id="periodic_scan",
        name=f"Periodic scan every {interval_min} min during market hours",
    )

    scheduler.start()
    logger.info(
        "Scheduler started — opening scan 09:15 IST, periodic every %d min (Mon–Fri)",
        interval_min,
    )

    # Keep main thread alive; graceful shutdown on SIGINT / SIGTERM
    shutdown = False

    def _handle_signal(signum: int, _frame: object) -> None:
        nonlocal shutdown
        logger.info("Received signal %d — shutting down scheduler", signum)
        shutdown = True

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    try:
        while not shutdown:
            time.sleep(1)
    finally:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")


# ------------------------------------------------------------------
# Argument parser
# ------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="alphapulse",
        description="AlphaPulse-IN — Indian Equities Quant & Fundamental Intelligence Engine",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # scan
    scan_parser = subparsers.add_parser("scan", help="Run market scan")
    scan_group = scan_parser.add_mutually_exclusive_group()
    scan_group.add_argument(
        "--low-only", action="store_true", help="Only run 52W low scan"
    )
    scan_group.add_argument(
        "--high-only", action="store_true", help="Only run 52W high scan"
    )

    # dashboard
    subparsers.add_parser("dashboard", help="Launch Streamlit dashboard")

    # schedule
    subparsers.add_parser("schedule", help="Start scheduled scanning (APScheduler)")

    return parser


def main(argv: list[str] | None = None) -> None:
    _setup_logging()
    parser = build_parser()
    args = parser.parse_args(argv)

    commands = {
        "scan": _cmd_scan,
        "dashboard": _cmd_dashboard,
        "schedule": _cmd_schedule,
    }
    commands[args.command](args)


if __name__ == "__main__":
    main()
