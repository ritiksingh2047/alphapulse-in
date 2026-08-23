# 📜 AlphaPulse-IN & RisiAsset Portfolio — Conversation & Project Log

---

## 1. Git Account Configuration

Currently, Git is configured locally for this project repository with the following identity:

* **User Name:** `Ritik Singh`
* **Email Address:** `singh@alphapulse.local`
* **Config Scope:** Local (`.git/config`)
* **Global Config:** No global `.gitconfig` was set on this workstation (`C:\Users\singh\.gitconfig`).

### To Change / Connect Your Personal GitHub Account:
If you would like your commits linked to your personal GitHub account (e.g., for pushing to GitHub), run:
```bash
git config user.name "Your Name"
git config user.email "your-github-email@example.com"
```
Or set it globally for all projects on your laptop:
```bash
git config --global user.name "Your Name"
git config --global user.email "your-github-email@example.com"
```

---

## 2. Chronological Conversation & Milestone History

### 🎯 Milestone 1: Initial System Architecture & Foundation
* **User Directive:** Build **AlphaPulse-IN**, an Institutional Indian Equities Quant & Fundamental Intelligence Engine for NSE/BSE stocks.
* **Core Requirements:**
  1. **Opening Bell Scan (09:15 AM IST):** Live tracking of Nifty 50, Bank Nifty, and market breadth.
  2. **52-Week Low Pipeline (Value-on-Dip):** Filter stocks within 0% to 7% of 52-week low with strong fundamental moats (D/E < 1.0, ROE > 12%, ROCE > 15%, stable FCF, M-Cap > ₹1,000 Cr).
  3. **52-Week High Pipeline (Exhaustion & Exit):** Identify overextended stocks within 0% to 3% of 52-week high with technical divergence (RSI ≥ 75, volume fade, valuation peaks).
  4. **Multi-Channel Delivery:** Telegram Markdown alerts and structured JSON payloads for web visualization.
* **Delivered Components:**
  * `alphapulse/universe.py`: 60 institutional NSE/BSE equities universe.
  * `alphapulse/fetcher.py`: Real-time and historical OHLCV data fetcher.
  * `alphapulse/fundamental.py`: Fundamental valuation and balance sheet metrics extractor.
  * `alphapulse/technical.py`: Multi-timeframe technical indicator calculations (RSI, MACD, EMAs, Bollinger Bands).
  * `alphapulse/scanner.py`: Quant scan pipelines for 52W lows and 52W highs.
  * `alphapulse/telegram_bot.py`: Formatted Telegram alert dispatch engine.
  * `alphapulse/database.py`: SQLite persistence layer (`data/alphapulse.db`).

---

### 💼 Milestone 2: RisiAsset Personal Portfolio Integration
* **User Directive:** Ingest and analyze real personal portfolio holdings from Excel statement (`Stocks_Holdings_Statement_2628067091_22-08-2026.xlsx`).
* **Portfolio Profile:**
  * **Investor:** Ritik Singh (`UCC: 2628067091`)
  * **Total Invested Capital:** ₹1,65,007.49
  * **Current Portfolio Value:** ₹1,57,090.89
  * **Net Unrealised P&L:** -₹7,916.60 (-4.80%)
  * **Holdings:** 30 Assets (66.2% Equities, 31.2% Precious Metals ETFs, 2.6% Thematic Funds)
* **Intelligence Layer Implemented:**
  * 🔴 **Near ATH / Profit Radar (6 Holdings):** `TATAMOTORS` (+56%), `GROWWDEFNC` (+50.9%), `TATASILV` (+44.3%), `ASHOKLEY` (+18.6%), `KOTAKGOLD` (+17.3%), `JIOFIN` (+10.9%).
  * 🟢 **Near ATL / Value Accumulate (4 Holdings):** `PFC` (-19.1%), `IRFC` (-27.2%), `RVNL` (-31.7%), `AWL` (-36.5%).
  * ⚠️ **High-Risk Speculative Drawdowns (4 Holdings):** `OLAELEC` (-67%), `RTNINDIA` (-58.3%), `TMPV` (-52.5%), `GREENPOWER` (-51.2%) (Averaging down strictly discouraged).

---

### 🌐 Milestone 3: Local Network & Mobile Device Access
* **User Directive:** Host the dashboard on the local network to enable seamless access from both laptop and smartphone anywhere on the same Wi-Fi.
* **Implementation:**
  * Configured `web/server.js` to bind to `0.0.0.0:3000`.
  * Auto-detected host IPv4 address (`192.168.0.104`).
  * Generated and embedded QR code modal in the frontend header for instant phone camera scanning.
  * URLs:
    * 💻 **Laptop:** `http://localhost:3000`
    * 📱 **Mobile:** `http://192.168.0.104:3000`

---

### 🎨 Milestone 4: UI/UX Table Column Merging (`Equity (Sector)`)
* **User Directive:** Merge the separate "Equity Symbol" and "Sector" columns into a single unified column (e.g. `Equity HDFC(Banking)`) to clean up horizontal clutter.
* **Implementation:**
  * Removed standalone `Sector` and `Category` `<th>`/`<td>` columns across:
    * `tableBuySignals` (Institutional 52W Low Accumulation Pipeline)
    * `tableExitSignals` (52W High Exhaustion Radar)
    * `tableRisiHoldings` (RisiAsset Personal Portfolio)
  * Displayed sector tags inline next to the ticker symbol:
    ```
    HDFCBANK .NS (Banking)
    HDFC Bank Ltd.
    ```
  * Adjusted table column counts (`colspan`) to preserve clean responsive styling.

---

### 🏷️ Milestone 5: Version 1 (V1) Git Release Tagging
* **User Directive:** Save and snapshot the current system as **Version 1 (V1)** with easy rollback capability.
* **Git Actions Executed:**
  * Initialized Git repository in `C:\Users\singh\Documents\project`.
  * Added `.gitignore` to protect cache/environments while tracking core databases, statements, and frontend assets.
  * Committed 27 files (`Commit SHA: d8d244c`).
  * Tagged releases: **`v1`** and **`v1.0`**.

---

## 3. Quick Runbook & Operations

### Starting the Web Dashboard:
```bash
# In persistent runtime:
bun web/server.js
# Or Streamlit standalone:
streamlit run alphapulse/dashboard.py
```

### Running Scans:
* Click **"Run Market Scan"** in the top navigation bar at `http://localhost:3000`.
* Or trigger API directly: `POST http://localhost:3000/api/scan/trigger`.

### Git Rollback Reference:
* **Switch to V1:** `git checkout v1`
* **Discard uncommitted changes:** `git restore .`
* **Create new branch from V1:** `git checkout -b feature-v2 v1`
