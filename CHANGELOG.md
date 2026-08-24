# 📜 AlphaPulse-IN Release Notes & Version History

All notable changes, architectural updates, and feature additions across releases of the **AlphaPulse-IN** Institutional Equities Intelligence Engine are documented in this file.

---

## [v1.03] - 2026-08-24

### 🚀 Key Features & Enhancements

#### 1. Streamlit Community Cloud Deployment & Feature Parity
* **Cloud-Ready Prep:** Updated `requirements.txt` with all missing dependencies, removed hardcoded localhost ports from `.streamlit/config.toml`, and integrated `st.secrets` fallback in `config.py` for cloud environment variables.
* **Python Dashboard Feature Parity:** Ported the **RisiAsset Portfolio** and **Should You Buy?** tabs into the native Python `alphapulse/dashboard.py` script so the live Streamlit Cloud app matches the local HTML features.
* **Cloud Anti-Ban Engine:** Integrated a custom HTTP `requests.Session` with a Windows Chrome `User-Agent` to bypass Yahoo Finance (`yfinance`) IP rate-limiting blocks (`YFRateLimitError`) on shared cloud servers.

#### 2. Local Dashboard UI Streamlining & Data Density
* **Clickable Stock Symbols:** Removed the standalone `CHART` button column; made the stock symbols native clickable links that instantly open the technical chart.
* **Quantity Badge Merge:** Removed the standalone `Qty` column and merged the holding quantity into a sleek grey pill badge (e.g., `[ 30 Qty ]`) directly beside the stock symbol to save horizontal space.
* **Instant Verdict Portfolio Column:** Added a new column to the RisiAsset table mapping quantitative radar signals into an instant Buyhatke equivalent verdict (`Go Ahead & Buy`, `Wait for Dip`, `Avoid`).
* **Interactive Verdicts:** Made the Instant Verdict badges clickable buttons that instantly teleport the user to the "Should You Buy?" tab for a deep algorithmic breakdown of that specific stock.
* **Chart Sidebar Integration:** Embedded a "Quick Advisor Rating" box directly into the right-hand Institutional Metrics sidebar on the Charting tab.
* **Zero-Scroll Padding Optimization:** Shortened column headers and reduced inner padding (`px-4` $\rightarrow$ `px-2`) to ensure all 9 data columns fit perfectly on standard screens without horizontal scrolling.

#### 3. Bug Fixes & Rendering Repairs
* **Blank Screen Fix:** Restored a missing `</style>` closing tag in `index.html` that was causing Chrome to render a completely blank white screen.
* **Theme Toggle Unfreeze:** Removed duplicate event listeners in `app.js` that were firing simultaneously (switching Light $\rightarrow$ Dark $\rightarrow$ Light in $<1\text{ms}$), making the button appear frozen.
* **Light Mode Contrast:** Fixed dark-mode hardcoded gradients in the RisiAsset executive banners, Telegram Console modal, and Scan Logs modal so they render beautifully with readable slate text in Light Mode.
* **Pandas KeyError Resolution:** Fixed mismatched JSON keys (`unrealised_pnl`, `closing_price`) in the Streamlit Python dashboard to prevent app crashes when loading the portfolio.

---

## [v1.02] - 2026-08-24

### 🚀 Key Features & Enhancements

#### 1. RisiAsset Personal Portfolio Intelligence Suite
* **30-Asset Portfolio Ingestion:** Integrated statement ingestion (`RisiAsset/Stocks_Holdings_Statement_2628067091_22-08-2026.xlsx`) for investor Ritik Singh (`UCC: 2628067091`).
* **All-Time High (ATH) Profit Radar (6 Holdings):** Identifies holdings trading near all-time highs (*Tata Motors +56%, Tata Silver +44%, Groww Defence +51%, Ashok Leyland +18.6%, Kotak Gold +17.3%, Jio Fin +10.9%*) with automated trailing stop-loss calculations ($0.95 \times \text{LTP}$).
* **All-Time Low (ATL) Value Accumulation Radar (3 Holdings):** Filters high-moat institutional leaders on cyclical discount (*PFC, IRFC, RVNL, AWL*) with upside targets ($+15\%$).
* **ATL Speculative Risk Warning (5 Holdings):** Protects capital by highlighting speculative/distressed dips (*Ola Electric -67%, Orient Green -51%, RattanIndia -58%, GTL Infra*) where averaging down is strictly discouraged.
* **Visual Asset Allocation Matrix:** Interactive Doughnut chart displaying asset distribution across Equities ($66.2\%$), Precious Metals Gold/Silver ETFs ($31.2\%$), and Thematic Funds ($2.6\%$).

#### 2. Buyhatke-Style "Should You Buy Now?" Stock Advisor
* **Interactive Single-Stock Search:** Instant typeahead lookups for any of the 2,000+ listed NSE/BSE equities.
* **Speedometer Gauge Meter:** 0–100 dynamic visual meter delivering clear institutional verdicts (*"Go Ahead & Buy now"*, *"Wait for a Better Dip"*, *"Avoid / Book Profits"*).
* **Price Stats Grid:** Displays Highest Price ($52\text{W Peak}$), Average Price (Historical Mean), Lowest Price ($52\text{W Support}$), and discount % below peak.
* **Valuation Entry Bands:** Historical price chart with shaded **Optimal Buy Zone** ($< 25\%$), **Fair Value Zone** ($25\% - 75\%$), and **Overbought Zone** ($> 75\%$).
* **Price Drop Alert Box:** Interactive target alert setter to notify when a stock reaches the desired entry pivot.
* **Multi-Factor Checklist:** Scoring breakdown across Price Discount ($35\text{ pts}$), Fundamental Moat ($30\text{ pts}$), Technical RSI ($20\text{ pts}$), and Risk/Reward ($15\text{ pts}$).

#### 3. Intelligent Auto-Suggest & Fuzzy Ticker Resolution
* **Fuzzy Normalizer & Alias Engine:** Automatically resolves spaces, brand variations, and partial names (e.g. `"YES BANK"` $\rightarrow$ `YESBANK`, `"HDFC"` $\rightarrow$ `HDFCBANK`, `"BALRAMPUR"` $\rightarrow$ `BALRAMCHIN`, `"TATA MOTORS"` $\rightarrow$ `TATAMOTORS`, `"SBI"` $\rightarrow$ `SBIN`).
* **Entity Disambiguation:** Differentiates between related companies (e.g. `Vedanta Iron And Steel` $\rightarrow$ `VISL.NS` at ₹37.34 vs `Vedanta Ltd` $\rightarrow$ `VEDL.NS` at ₹274.25).
* **Typo Auto-Correction:** Levenshtein-distance matcher corrects common typos (e.g. `ONCG` $\rightarrow$ `ONGC`).
* **Zero Dummy Data Guarantee:** Removed all placeholder/dummy fallback numbers ($₹500.00$). Delivers 100% verified real-time live market exchange data, or displays a transparent "Stock Not Found" card with helpful suggestions.

#### 4. UI Cleanliness & Multi-Device Access
* **Header Simplification:** Cleaned top navigation header while preserving the dedicated `💼 RisiAsset (30)` primary tab.
* **Local Network & Wi-Fi Access:** High-performance background listener bound to `0.0.0.0:3000` with instant QR code modal for mobile access (`http://192.168.0.102:3000`).

---

## [v1.1] - 2026-08-23

### 🎨 UI & UX Refinements
* **Single-Row Navigation Tabs:** Shortened tab labels for single-row display on mobile and desktop viewports.
* **Light / Dark Theme Engine:** Added institutional light mode theme with instant toggle switch.
* **Modal Dialogs:** Telegram Opening Bell Broadcast and Scan Execution Telemetry modals.
* **TradingView-Inspired Chart Studio:** Interactive candlestick/line chart with 20/50/200 EMA ribbons and RSI(14) oscillator.

---

## [v1.0.1] - 2026-08-23

### 🌐 Web Frontend & Server
* **High-Performance Web Server (`web/server.ps1` & `web/server.js`):** Built-in REST APIs for market breadth, signals, sector breakdowns, and historical chart series.
* **Mobile Wi-Fi Access:** Multi-interface binding on `0.0.0.0:3000` for phone access.
* **Position Sizing & Risk Simulator:** Dynamic calculator enforcing 2.0% - 3.0% maximum portfolio risk per trade.

---

## [v1.0.0] - 2026-08-23

### ⚡ Initial Institutional Release
* **Core Market Data Fetcher (`alphapulse/fetcher.py`):** Real-time quote and fundamental data extraction via `yfinance` (.NS/.BO).
* **Value-on-Dip Pipeline (52W Lows):** Distance to 52W Low $\le 7.0\%$, $\text{D/E} < 1.0$ (BFSI exempt), $\text{ROE} > 12\%$, $\text{ROCE} > 15\%$, $\text{FCF} > 0$, $\text{Market Cap} > ₹1,000\text{ Cr}$.
* **Exhaustion & Exit Pipeline (52W Highs):** Distance to 52W High $\le 3.0\%$, $\text{RSI} \ge 75$, $\text{P/E} > 40\text{x}$, trailing stop-loss at $0.95 \times \text{LTP}$.
* **Telegram Bot Notifier (`alphapulse/telegram_bot.py`):** Automated 09:15 AM IST Opening Bell Scan markdown broadcaster.
* **FastMCP Tool Ecosystem (`alphapulse/mcp_server.py`):** Model Context Protocol tools for LLM and LangChain integration.
* **Persistence Layer (`alphapulse/database.py`):** SQLite database storage for signals, market snapshots, and execution logs.
