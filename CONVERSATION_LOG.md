# 📜 AlphaPulse-IN & RisiAsset Portfolio — Conversation & Project Log

---

## 1. Git & GitHub Account Configuration

Git is configured for this project repository with your personal GitHub identity:

* **GitHub Profile:** [https://github.com/ritiksingh2047](https://github.com/ritiksingh2047)
* **User Name:** `ritiksingh2047`
* **Email Address:** `singhritik7464@gmail.com`
* **Config Scope:** Local (`.git/config`)
### Remote Repository Connection:
To push this local repository directly to your GitHub profile, create a new repository on GitHub (e.g., `alphapulse-in`) and run:
```bash
git remote add origin https://github.com/ritiksingh2047/alphapulse-in.git
git branch -M main
git push -u origin main --tags
```
*(Note: When prompted for password, provide your GitHub Personal Access Token (PAT) with `repo` permissions).*
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

### 🚀 Milestone 6: GitHub Cloud Synchronization & Account Linking
* **User Directive:** Link personal GitHub account (`ritiksingh2047`) and publish all version history and release tags.
* **Actions Executed:**
  * Configured author identity: `ritiksingh2047 <singhritik7464@gmail.com>`.
  * Rewrote all commits and release tags with proper author metadata.
  * Configured remote origin: `https://github.com/ritiksingh2047/alphapulse-in.git`.
  * Pushed `main` branch and release tags (`v1`, `v1.0`) to GitHub.
  * Verified remote synchronization via `git ls-remote origin`.

---

### 🌓 Milestone 7: Dark / Light Mode Theme Toggle
* **User Directive:** Add a dark/light mode toggle button in the top navigation header for customer navigation.
* **Implementation:**
  * Added high-contrast Institutional Light Theme CSS palette (slate `#F8FAFC` background, pure white `#FFFFFF` cards, `#E2E8F0` borders, slate typography, and vibrant signal badges).
  * Added persistent theme state controller via `localStorage.getItem("alphapulse-theme")`.
  * Added header theme switcher button (`#btnThemeToggle`) with animated Lucide Moon/Sun icons.
  * Adapted Chart.js technical indicators and allocation doughnut/performance charts to re-render with dynamic grid and tooltip palettes upon theme toggling.

---

### 🔒 Milestone 8: Personal Portfolio Privacy & Zero-Scroll Layout
* **User Directive:** Remove private portfolio metrics (`₹1.57L`, `-4.80%`) from the public top header and eliminate horizontal scrolling across mobile and desktop.
* **Implementation:**
  * Removed the personal balance and return pill from the public global navigation header.
  * Confined all personal holdings, balances, and allocations exclusively to the dedicated `💼 RisiAsset Portfolio` tab.
  * Added `overflow-x-hidden` and responsive mobile header layouts so page width precisely matches viewport width (`scrollWidth === clientWidth`, 0px horizontal overflow).

---

### 📱 Milestone 9: Phone Access Modal Global Fix
* **User Report:** Phone Access button in top header was not responding on click.
* **Root Cause & Resolution:**
  1. The modal container was previously nested inside a specific tab `<section>`, causing it to inherit `.hidden` whenever other navigation tabs were active. Relocated `#mobileModal` to the root `<body>` level so it is universally accessible from any tab.
  2. Resolved a duplicate event trigger between inline `onclick` attributes and `addEventListener`.
  3. Fixed a variable scoping collision in `app.js` and added backdrop-click and ESC key dismiss handlers.

---

### 📐 Milestone 10: Breadth Removal & Header Precision Alignment
* **User Directive:** Remove the technical Market Breadth indicator from the top header and align the header layout perfectly with interface height and width.
* **Implementation:**
  * Removed the Breadth pill from the top navigation bar to simplify the interface.
  * Perfectly balanced the header across three visual anchors: Brand Logo on the left, Nifty 50 and Bank Nifty live index badges in the center, and action controls (Scan, Phone Access, Theme Toggle, Live Clock) on the right.
  * Adjusted responsive breakpoints and padding so that `scrollWidth === clientWidth` (0px overflow, zero horizontal scrolling) across Mobile (390px), Tablet (768px), and Desktop (1280px).

---

### 🏛️ Milestone 11: 3-Row Clean Hierarchy Restructuring
* **User Directive:** Restructure top layout into 3 clean, dedicated rows:
  * **Row 1 (Header):** Brand Name/Logo on left, Action Controls (*Run Market Scan*, *Phone Access*, *Dark/Light Theme Toggle*, *Market Clock*) on right.
  * **Row 2 (Market Overview):** 4 Benchmark & Signal KPI Cards (*Nifty 50 Index*, *Bank Nifty Index*, *Market Breadth*, *Active Radar Setups*).
  * **Row 3 (Navigation Bar):** Main Navigation Tabs Bar (*RisiAsset Portfolio*, *Value Accumulation*, *Profit Booking*, *Charting Studio*, *Sector Heatmap*, *Risk Sizing*, *Telegram*, *Scan Logs*).
  * **Below Row 3:** Active Tab Content Sections.
* **Implementation:**
  * Cleaned up the header by removing cramped ticker pills.
  * Ordered `<main>` with Row 2 KPI Cards followed immediately by Row 3 Navigation Tabs.
  * Verified layout rendering and tab transitions via browser automation.

---

### ⚡ Milestone 12: Data Pipeline Re-hydration & Interactivity Fix
* **User Report:** Data rows were missing and tab buttons were not responding after the 3-row layout restructuring.
* **Root Cause & Resolution:**
  1. When header index badges were relocated, initial `renderOverviewKPIs()` threw a `TypeError` on missing header elements, halting subsequent fetch pipelines. Added safe null guards.
  2. Resolved `DOMContentLoaded` timing race condition by checking `document.readyState === "loading"` before attaching or executing `initApp()`.
  3. Updated signal count synchronization so Row 2 cards display `60 Buys | 40 Exits` and badges reflect real counts (`60 Value Accumulation`, `40 Profit Booking`, `30 RisiAsset Holdings`).

---

### 🗑️ Milestone 13: Removal of Sector Heatmap
* **User Directive:** Remove the Sector Heatmap tab and its section from the dashboard navigation to streamline the interface.
* **Implementation:**
  * Removed the `Sector Heatmap` navigation button from the Row 3 tab bar.
  * Removed `<section id="tab-sectors">` from `index.html`.
  * Verified that all remaining 7 tabs (`RisiAsset Portfolio`, `Value Accumulation`, `Profit Booking`, `Charting Studio`, `Risk & Position Sizing`, `Telegram Console`, `Scan Logs`) render and navigate cleanly.

---

### 🔄 Milestone 14: Unified Scan & Telemetry Header Controller
* **User Directive:** Merge Scan Logs with the Run Market Scan button at the top header and remove the redundant tab from the navigation bar.
* **Implementation:**
  * Created an emerald split-button group in Row 1: **`[ 🔄 Run Market Scan | 📜 Logs ]`**.
  * Converted the scan telemetry table into a dedicated modal (`#scanLogsModal`) accessible from the header.
  * Removed the `Scan Logs` tab from the Row 3 navigation bar, leaving the 6 primary modules uncluttered.
  * Verified modal display, execution log population (8 logs), and dismiss actions (Close button, backdrop click, Escape key).

---

### 💬 Milestone 15: Unified Mobile & Telegram Broadcast Header Hub
* **User Directive:** Merge the Telegram Console with the Phone Access button in the top navigation bar.
* **Implementation:**
  * Created an indigo split-button group in Row 1: **`[ 📱 Phone | 💬 Telegram ]`**.
  * Converted the Telegram broadcast alert preview and markdown copy console into a dedicated modal (`#telegramModal`) accessible from the header.
  * Removed the `Telegram Console` tab from the Row 3 navigation bar, leaving the 5 focused primary analytical engines.
  * Verified modal opening, formatted chat bubble rendering, markdown copy feedback, and modal dismiss handling.

---

### 📈 Milestone 16: Simplified "Charting" Tab & Technical Studio Fix
* **User Directive:** Shorten the tab name to a concise single-word label and diagnose why charts were not rendering.
* **Root Cause & Resolution:**
  1. Renamed the navigation tab to **`📈 Charting`** to keep the tab strip clean and punchy.
  2. Fixed an unhandled `ReferenceError: isLight is not defined` inside `loadChartData()` that was blocking Chart.js initialization on stock selection.
  3. Verified interactive multi-indicator price chart (251 historical days, 20/50/200 EMAs) and RSI(14) oscillator chart rendering across all universe stocks.

---

### 🎯 Milestone 17: Concise 1-2 Word Navigation & End-to-End Button Validation
* **User Directive:** Shorten all 5 navigation tabs to 1-2 word labels so all tabs fit on a single row without horizontal scrolling, and validate the functionality of every button.
* **Updated 5-Module Navigation Strip:**
  1. **`💼 RisiAsset (30)`**
  2. **`🟢 52W Lows (60)`**
  3. **`🔴 52W Highs (40)`**
  4. **`📈 Charting`**
  5. **`🧮 Risk Sizing`**
* **Automated Button & Layout Validation Report:**
  * `navSingleRowFit: true` (Total tab strip width fits on a single line with 0px horizontal scroll).
  * `tabSwitchResults: 5/5 PASSED` (All 5 tabs switch views cleanly).
  * `headerModals: 3/3 PASSED` (`Phone`, `Telegram`, and `Scan Logs` modals open and dismiss properly).
  * `themeToggle: PASSED` (Dark / Light modes switch and persist).
  * `risiFilters: PASSED` (ATH / ATL radar filters sort holdings accurately).
  * `chartingEngine: PASSED` (251-day technical charts render EMAs and RSI oscillators).

---

### 🎨 Milestone 18: Full-Width Equal Grid Navigation & Custom Light Palette (#d8eff2)
* **User Directive:** Ensure all 5 navigation buttons in Row 3 stretch equally across the full container width with no empty trailing space, and update the light theme interface background to hex code `#d8eff2`.
* **Implementation:**
  * Replaced the flex wrapper with `grid grid-cols-2 sm:grid-cols-5 gap-1.5 sm:gap-2 w-full`, allocating an exact 20% equal width to each button with 0px leftover space.
  * Applied hex code `#d8eff2` to the Light Mode body background with harmonious `#cbe7ec` dark container accents and pure white cards with `#c0dfe6` borders.
  * Verified in browser: `buttonWidths: [234px, 234px, 234px, 234px, 234px]` and `lightBgColor: "rgb(216, 239, 242)"`.

---

### 🏷️ Milestone 19: Official Version 1.1 (v1.1) Release & Git Tagging
* **User Directive:** Save the current enhanced build as **v1.1** and update the dashboard brand badge to **`v1.1`**.
* **Version 1.1 Enhancements Consolidated:**
  1. Clean 3-Row Layout Hierarchy (Row 1 Header $\rightarrow$ Row 2 Market Cards $\rightarrow$ Row 3 Navigation Tabs).
  2. Full-Width Equal Grid Navigation (all 5 buttons span 20% width with 0px margin gap).
  3. Single/Two-Word Concise Tab Labels (`RisiAsset`, `52W Lows`, `52W Highs`, `Charting`, `Risk Sizing`).
  4. Custom `#d8eff2` Soft Ice-Cyan Light Theme Palette.
  5. Unified Mobile & Broadcast Hubs (Header Split-Buttons for `[ Scan | Logs ]` and `[ Phone | Telegram ]`).
  6. Technical Multi-Indicator Charting Engine Fix.
* **Git Tag:** **`v1.1`** and **`v1.1.0`**.
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
