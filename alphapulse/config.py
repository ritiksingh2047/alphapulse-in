import os


class Config:
    # Telegram
    TELEGRAM_BOT_TOKEN = os.getenv('ALPHAPULSE_TG_TOKEN', '')
    TELEGRAM_CHAT_ID = os.getenv('ALPHAPULSE_TG_CHAT_ID', '')

    # Database
    DB_PATH = os.getenv('ALPHAPULSE_DB_PATH', 'data/alphapulse.db')

    # Scan Parameters
    LOW_THRESHOLD_PCT = 7.0      # % from 52-week low
    HIGH_THRESHOLD_PCT = 3.0     # % from 52-week high
    MIN_MARKET_CAP_CR = 1000.0   # Min market cap in crores

    # Fundamental Filters
    MAX_DEBT_TO_EQUITY = 1.0
    MIN_ROE = 12.0
    MIN_ROCE = 15.0

    # Technical Filters
    RSI_OVERBOUGHT = 75.0

    # BFSI sectors exempt from D/E check
    BFSI_SECTORS = ['Banking', 'Financial Services', 'Insurance', 'NBFC']

    # Schedule
    SCAN_INTERVAL_MINUTES = int(os.getenv('ALPHAPULSE_SCAN_INTERVAL', '30'))
    MARKET_OPEN_HOUR = 9
    MARKET_OPEN_MINUTE = 15
    MARKET_CLOSE_HOUR = 15
    MARKET_CLOSE_MINUTE = 30

    # Dashboard
    DASHBOARD_PORT = int(os.getenv('ALPHAPULSE_DASH_PORT', '8501'))
