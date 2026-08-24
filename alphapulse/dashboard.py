"""AlphaPulse-IN Streamlit Dashboard — Indian Equities Intelligence."""

import sqlite3
import time
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

# ---------------------------------------------------------------------------
# Resolve the database path relative to project root so that the dashboard
# works regardless of where `streamlit run` is invoked from.
# ---------------------------------------------------------------------------
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_DB_PATH = _PROJECT_ROOT / "data" / "alphapulse.db"


# ---------------------------------------------------------------------------
# Low-level DB helpers (self-contained so dashboard works standalone even
# before other modules finish writing).
# ---------------------------------------------------------------------------

def _get_connection() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_tables(conn: sqlite3.Connection) -> None:
    """Create tables if they don't already exist (idempotent)."""
    conn.executescript(
        """
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
        );

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
        );

        CREATE TABLE IF NOT EXISTS scan_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scan_type TEXT,
            stocks_scanned INTEGER,
            signals_generated INTEGER,
            duration_seconds REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
    )


# ---------------------------------------------------------------------------
# Cached query helpers
# ---------------------------------------------------------------------------

@st.cache_data(ttl=300)
def fetch_signals(
    signal_type: str | None = None,
    sectors: list[str] | None = None,
    since: str | None = None,
) -> pd.DataFrame:
    """Return filtered signals from the database."""
    conn = _get_connection()
    _ensure_tables(conn)

    query = "SELECT * FROM signals WHERE 1=1"
    params: list = []

    if signal_type and signal_type != "All":
        mapping = {"Buy Setups": "BUY_SETUP", "Exit Setups": "EXIT_SETUP"}
        query += " AND signal_type = ?"
        params.append(mapping.get(signal_type, signal_type))

    if sectors:
        placeholders = ",".join("?" for _ in sectors)
        query += f" AND sector IN ({placeholders})"
        params.extend(sectors)

    if since:
        query += " AND DATE(created_at) >= ?"
        params.append(since)

    query += " ORDER BY created_at DESC"
    df = pd.read_sql_query(query, conn, params=params)
    conn.close()
    return df


@st.cache_data(ttl=300)
def fetch_latest_market_snapshot() -> pd.DataFrame:
    conn = _get_connection()
    _ensure_tables(conn)
    df = pd.read_sql_query(
        "SELECT * FROM market_snapshots ORDER BY created_at DESC LIMIT 1",
        conn,
    )
    conn.close()
    return df


@st.cache_data(ttl=300)
def fetch_scan_history(limit: int = 50) -> pd.DataFrame:
    conn = _get_connection()
    _ensure_tables(conn)
    df = pd.read_sql_query(
        "SELECT * FROM scan_log ORDER BY created_at DESC LIMIT ?",
        conn,
        params=[limit],
    )
    conn.close()
    return df


@st.cache_data(ttl=300)
def fetch_all_sectors() -> list[str]:
    conn = _get_connection()
    _ensure_tables(conn)
    cur = conn.execute(
        "SELECT DISTINCT sector FROM signals WHERE sector IS NOT NULL AND sector != '' ORDER BY sector"
    )
    sectors = [row[0] for row in cur.fetchall()]
    conn.close()
    return sectors


@st.cache_data(ttl=300)
def fetch_last_scan_time() -> str | None:
    conn = _get_connection()
    _ensure_tables(conn)
    cur = conn.execute("SELECT MAX(created_at) FROM scan_log")
    row = cur.fetchone()
    conn.close()
    if row and row[0]:
        return str(row[0])
    return None


# ---------------------------------------------------------------------------
# Scanner helper (lazy import — scanner may not exist yet during dev)
# ---------------------------------------------------------------------------

def _run_scan() -> str:
    """Execute a full scan via AlphaPulseScanner. Returns status message."""
    try:
        from alphapulse.scanner import AlphaPulseScanner  # noqa: WPS433

        scanner = AlphaPulseScanner()
        scanner.run_full_scan()
        # Bust the cache so new data shows immediately
        st.cache_data.clear()
        return "✅ Scan completed successfully!"
    except ImportError:
        return "⚠️ Scanner module not available yet."
    except Exception as exc:  # noqa: BLE001
        return f"❌ Scan failed: {exc}"


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------

def _color_pe(val: float | None) -> str:
    if val is None:
        return ""
    if val < 15:
        return "background-color: #1b5e20; color: white"
    if val < 25:
        return "background-color: #f9a825; color: black"
    return "background-color: #b71c1c; color: white"


def _color_roe(val: float | None) -> str:
    if val is None:
        return ""
    if val > 15:
        return "background-color: #1b5e20; color: white"
    if val > 10:
        return "background-color: #f9a825; color: black"
    return ""


def _color_de(val: float | None) -> str:
    if val is None:
        return ""
    if val < 0.5:
        return "background-color: #1b5e20; color: white"
    if val < 1.0:
        return "background-color: #f9a825; color: black"
    return "background-color: #b71c1c; color: white"


# ---------------------------------------------------------------------------
# PAGE CONFIG
# ---------------------------------------------------------------------------

st.set_page_config(
    page_title="AlphaPulse-IN",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ---------------------------------------------------------------------------
# HEADER
# ---------------------------------------------------------------------------

st.markdown(
    "<h1 style='text-align:center;'>⚡ AlphaPulse-IN | Indian Equities Intelligence</h1>",
    unsafe_allow_html=True,
)

last_scan = fetch_last_scan_time()
if last_scan:
    st.markdown(
        f"<p style='text-align:center; color:#aaa;'>Last scan: {last_scan}</p>",
        unsafe_allow_html=True,
    )
else:
    st.markdown(
        "<p style='text-align:center; color:#aaa;'>No scans recorded yet. Click <b>Run Scan Now</b> in the sidebar.</p>",
        unsafe_allow_html=True,
    )

st.divider()

# ---------------------------------------------------------------------------
# SIDEBAR
# ---------------------------------------------------------------------------

with st.sidebar:
    st.header("🎛️ Controls")

    if st.button("🔄 Run Scan Now", use_container_width=True, type="primary"):
        with st.spinner("Scanning universe — this may take a few minutes…"):
            msg = _run_scan()
        st.toast(msg)
        time.sleep(1)
        st.rerun()

    st.divider()
    st.subheader("Filters")

    filter_date = st.date_input(
        "📅 Signals since",
        value=datetime.now().date() - timedelta(days=7),
    )

    signal_type_filter = st.selectbox(
        "📊 Signal Type",
        options=["All", "Buy Setups", "Exit Setups"],
    )

    all_sectors = fetch_all_sectors()
    sector_filter = st.multiselect(
        "🏭 Sector",
        options=all_sectors,
        default=[],
        placeholder="All sectors",
    )

    st.divider()
    st.caption("Tip: Refresh the page to pull latest data.")

# ---------------------------------------------------------------------------
# Fetch data using sidebar filters
# ---------------------------------------------------------------------------

signals_df = fetch_signals(
    signal_type=signal_type_filter,
    sectors=sector_filter if sector_filter else None,
    since=str(filter_date),
)

buy_df = signals_df[signals_df["signal_type"] == "BUY_SETUP"] if not signals_df.empty else pd.DataFrame()
exit_df = signals_df[signals_df["signal_type"] == "EXIT_SETUP"] if not signals_df.empty else pd.DataFrame()

# ---------------------------------------------------------------------------
# TABS
# ---------------------------------------------------------------------------

tab_overview, tab_buy, tab_exit, tab_risi, tab_advisor, tab_history, tab_analytics = st.tabs(
    ["📈 Market Overview", "🟢 Buy Setups", "🔴 Exit Setups", "💼 RisiAsset Portfolio", "🤖 Should You Buy?", "📋 Scan History", "📊 Analytics"]
)

# ============================= TAB 1: MARKET OVERVIEW =====================

with tab_overview:
    mkt = fetch_latest_market_snapshot()

    if mkt.empty:
        st.info("No market snapshot available yet. Run a scan to populate market data.")
    else:
        row = mkt.iloc[0]

        col1, col2 = st.columns(2)
        with col1:
            st.metric(
                label="Nifty 50",
                value=f"₹{row['nifty_ltp']:,.2f}",
                delta=f"{row['nifty_change_pct']:+.2f}%",
            )
        with col2:
            st.metric(
                label="Bank Nifty",
                value=f"₹{row['banknifty_ltp']:,.2f}",
                delta=f"{row['banknifty_change_pct']:+.2f}%",
            )

        st.divider()
        st.subheader("Market Breadth")

        advances = int(row["advances"])
        declines = int(row["declines"])
        unchanged = int(row["unchanged"])
        total = advances + declines + unchanged

        fig_breadth = go.Figure()
        fig_breadth.add_trace(go.Bar(
            y=["Market"],
            x=[advances],
            name=f"Advances ({advances})",
            orientation="h",
            marker_color="#00C853",
            text=[advances],
            textposition="inside",
        ))
        fig_breadth.add_trace(go.Bar(
            y=["Market"],
            x=[unchanged],
            name=f"Unchanged ({unchanged})",
            orientation="h",
            marker_color="#FFD600",
            text=[unchanged],
            textposition="inside",
        ))
        fig_breadth.add_trace(go.Bar(
            y=["Market"],
            x=[declines],
            name=f"Declines ({declines})",
            orientation="h",
            marker_color="#FF1744",
            text=[declines],
            textposition="inside",
        ))
        fig_breadth.update_layout(
            barmode="stack",
            height=120,
            margin=dict(l=0, r=0, t=10, b=10),
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="center", x=0.5),
            xaxis=dict(showticklabels=False),
            yaxis=dict(showticklabels=False),
            plot_bgcolor="rgba(0,0,0,0)",
            paper_bgcolor="rgba(0,0,0,0)",
        )
        st.plotly_chart(fig_breadth, use_container_width=True)

        st.caption(f"Total stocks: {total} | Updated: {row['created_at']}")

    st.divider()

    # Quick signal summary
    st.subheader("Signal Summary")
    col_a, col_b, col_c = st.columns(3)
    col_a.metric("Total Signals", len(signals_df))
    col_b.metric("Buy Setups", len(buy_df))
    col_c.metric("Exit Setups", len(exit_df))

# ============================= TAB 2: BUY SETUPS =========================

with tab_buy:
    st.subheader("🟢 Buy Setups — Near 52-Week Lows")

    if buy_df.empty:
        st.info("No buy setups found for the selected filters. Adjust date range or run a fresh scan.")
    else:
        display_cols = [
            "symbol", "company_name", "ltp", "week52_low", "pct_from_low",
            "pe_ratio", "debt_to_equity", "roe", "roce",
            "signal_type", "entry_min", "entry_max", "stop_loss", "target_1", "target_2",
        ]
        existing_cols = [c for c in display_cols if c in buy_df.columns]
        view = buy_df[existing_cols].copy()

        rename_map = {
            "symbol": "Symbol",
            "company_name": "Company",
            "ltp": "LTP",
            "week52_low": "52W Low",
            "pct_from_low": "% From Low",
            "pe_ratio": "P/E",
            "debt_to_equity": "D/E",
            "roe": "ROE%",
            "roce": "ROCE%",
            "signal_type": "Signal",
            "entry_min": "Entry Min",
            "entry_max": "Entry Max",
            "stop_loss": "SL",
            "target_1": "T1",
            "target_2": "T2",
        }
        view = view.rename(columns={k: v for k, v in rename_map.items() if k in view.columns})

        # Format numeric columns
        fmt_cols = {
            "LTP": "₹{:.2f}", "52W Low": "₹{:.2f}", "% From Low": "{:.1f}%",
            "P/E": "{:.1f}", "D/E": "{:.2f}", "ROE%": "{:.1f}%", "ROCE%": "{:.1f}%",
            "Entry Min": "₹{:.2f}", "Entry Max": "₹{:.2f}",
            "SL": "₹{:.2f}", "T1": "₹{:.2f}", "T2": "₹{:.2f}",
        }

        styler = view.style
        for col, fmt in fmt_cols.items():
            if col in view.columns:
                styler = styler.format({col: lambda v, f=fmt: f.format(v) if pd.notna(v) else "—"})

        st.dataframe(styler, use_container_width=True, hide_index=True, height=500)

        # Expandable thesis rows
        with st.expander("📝 View Detailed Thesis for Each Signal"):
            for _, r in buy_df.iterrows():
                thesis_text = r.get("thesis", "")
                if thesis_text:
                    st.markdown(f"**{r['symbol']}** — {r.get('company_name', '')}")
                    st.caption(thesis_text)
                    st.divider()

        # Download CSV
        csv = buy_df.to_csv(index=False)
        st.download_button(
            "⬇️ Download Buy Setups CSV",
            data=csv,
            file_name=f"buy_setups_{datetime.now().strftime('%Y%m%d')}.csv",
            mime="text/csv",
        )

# ============================= TAB 3: EXIT SETUPS ========================

with tab_exit:
    st.subheader("🔴 Exit Setups — Near 52-Week Highs")

    if exit_df.empty:
        st.info("No exit setups found for the selected filters. Adjust date range or run a fresh scan.")
    else:
        display_cols = [
            "symbol", "company_name", "ltp", "week52_high", "pct_from_high",
            "rsi_14", "pe_ratio", "signal_type", "trailing_sl", "sell_pct",
        ]
        existing_cols = [c for c in display_cols if c in exit_df.columns]
        view = exit_df[existing_cols].copy()

        rename_map = {
            "symbol": "Symbol",
            "company_name": "Company",
            "ltp": "LTP",
            "week52_high": "52W High",
            "pct_from_high": "% From High",
            "rsi_14": "RSI",
            "pe_ratio": "P/E",
            "signal_type": "Signal",
            "trailing_sl": "Trailing SL",
            "sell_pct": "Sell %",
        }
        view = view.rename(columns={k: v for k, v in rename_map.items() if k in view.columns})

        fmt_cols = {
            "LTP": "₹{:.2f}", "52W High": "₹{:.2f}", "% From High": "{:.1f}%",
            "RSI": "{:.1f}", "P/E": "{:.1f}",
            "Trailing SL": "₹{:.2f}", "Sell %": "{:.0f}%",
        }

        styler = view.style
        for col, fmt in fmt_cols.items():
            if col in view.columns:
                styler = styler.format({col: lambda v, f=fmt: f.format(v) if pd.notna(v) else "—"})

        # Highlight rows where RSI > 70 (urgency)
        def _highlight_urgency(row: pd.Series) -> list[str]:
            rsi = row.get("RSI")
            if pd.notna(rsi) and rsi > 70:
                return ["background-color: #b71c1c; color: white"] * len(row)
            return [""] * len(row)

        styler = styler.apply(_highlight_urgency, axis=1)

        st.dataframe(styler, use_container_width=True, hide_index=True, height=500)

        # Expandable thesis rows
        with st.expander("📝 View Detailed Thesis for Each Signal"):
            for _, r in exit_df.iterrows():
                thesis_text = r.get("thesis", "")
                if thesis_text:
                    st.markdown(f"**{r['symbol']}** — {r.get('company_name', '')}")
                    st.caption(thesis_text)
                    st.divider()

        csv = exit_df.to_csv(index=False)
        st.download_button(
            "⬇️ Download Exit Setups CSV",
            data=csv,
            file_name=f"exit_setups_{datetime.now().strftime('%Y%m%d')}.csv",
            mime="text/csv",
        )


# ============================= TAB: RISIASSET ============================

with tab_risi:
    st.subheader("💼 RisiAsset Portfolio Dashboard")
    import json
    portfolio_file = _PROJECT_ROOT / "data" / "risiasset_portfolio.json"
    if portfolio_file.exists():
        with open(portfolio_file, "r") as f:
            pdata = json.load(f)
        
        st.markdown(f"**Client:** {pdata.get('client_name', 'Unknown')} | **Code:** {pdata.get('client_code', '')} | **Date:** {pdata.get('statement_date', '')}")
        
        s = pdata.get("summary", {})
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Total Investment", f"₹{s.get('invested_value', 0):,.2f}")
        c2.metric("Current Value", f"₹{s.get('closing_value', 0):,.2f}")
        pnl = s.get('unrealised_pnl', 0)
        pct = s.get('unrealised_pnl_pct', 0)
        c3.metric("Total P&L", f"₹{pnl:,.2f}", f"{pct}%")
        c4.metric("Holdings", s.get('total_holdings', 0))
        
        holdings = pdata.get("holdings", [])
        if holdings:
            hdf = pd.DataFrame(holdings)
            # Rename columns for display
            hdf = hdf.rename(columns={
                "symbol": "Symbol",
                "quantity": "Qty",
                "buy_avg": "Buy Avg",
                "ltp": "LTP",
                "invested": "Invested (₹)",
                "current_value": "Current Value (₹)",
                "pnl": "P&L (₹)",
                "pnl_pct": "P&L %",
                "day_pnl": "Day P&L (₹)",
                "day_pnl_pct": "Day %"
            })
            st.dataframe(
                hdf[["Symbol", "Qty", "Buy Avg", "LTP", "Invested (₹)", "Current Value (₹)", "P&L (₹)", "P&L %", "Day %"]],
                use_container_width=True,
                hide_index=True
            )
    else:
        st.info("No RisiAsset portfolio data found.")

# ============================= TAB: ADVISOR ==============================

with tab_advisor:
    st.subheader("🤖 AlphaPulse Buy Advisor")
    st.markdown("Enter an NSE ticker symbol to get an instant institutional buy/hold/sell rating.")
    
    advisor_ticker = st.text_input("NSE Ticker (e.g., BALRAMCHIN, RELIANCE, TCS)", "").upper()
    if st.button("Analyze Stock"):
        if not advisor_ticker:
            st.warning("Please enter a ticker symbol.")
        else:
            with st.spinner(f"Analyzing {advisor_ticker}.NS..."):
                import yfinance as yf
                ticker_str = advisor_ticker if advisor_ticker.endswith(".NS") else f"{advisor_ticker}.NS"
                tkr = yf.Ticker(ticker_str)
                info = tkr.info
                
                if "currentPrice" not in info:
                    st.error(f"Could not fetch data for {ticker_str}. Please check the symbol.")
                else:
                    ltp = info.get("currentPrice", 0)
                    low_52 = info.get("fiftyTwoWeekLow", 1)
                    high_52 = info.get("fiftyTwoWeekHigh", 1)
                    pe = info.get("trailingPE", 0)
                    roe = info.get("returnOnEquity", 0) * 100
                    de = info.get("debtToEquity", 0)
                    
                    # Calculate Score (0-100)
                    score = 50
                    
                    # Distance from 52w low (closer is better)
                    pct_from_low = ((ltp - low_52) / low_52) * 100
                    if pct_from_low <= 15: score += 20
                    elif pct_from_low <= 30: score += 10
                    elif pct_from_low >= 80: score -= 20
                    
                    # Valuation
                    if 5 < pe < 25: score += 15
                    elif pe > 50: score -= 15
                    
                    # Fundamentals
                    if roe > 15: score += 10
                    if de < 50: score += 5  # yfinance D/E is often in % (e.g. 15 = 0.15)
                    
                    score = max(0, min(100, score))
                    
                    if score >= 75:
                        verdict = "STRONG BUY"
                        v_color = "green"
                    elif score >= 60:
                        verdict = "ACCUMULATE"
                        v_color = "lightgreen"
                    elif score >= 40:
                        verdict = "HOLD"
                        v_color = "orange"
                    else:
                        verdict = "AVOID / SELL"
                        v_color = "red"
                        
                    sc1, sc2 = st.columns([1, 2])
                    with sc1:
                        st.metric("LTP", f"₹{ltp:,.2f}")
                        st.metric("52W Range", f"₹{low_52} - ₹{high_52}")
                        st.markdown(f"### Verdict: :{v_color}[{verdict}]")
                        
                    with sc2:
                        import plotly.graph_objects as go
                        fig = go.Figure(go.Indicator(
                            mode="gauge+number",
                            value=score,
                            title={'text': "AlphaPulse Rating"},
                            gauge={
                                'axis': {'range': [0, 100]},
                                'bar': {'color': "darkblue"},
                                'steps': [
                                    {'range': [0, 40], 'color': "lightcoral"},
                                    {'range': [40, 60], 'color': "lemonchiffon"},
                                    {'range': [60, 100], 'color': "lightgreen"}
                                ]
                            }
                        ))
                        fig.update_layout(height=250, margin=dict(l=20, r=20, t=30, b=20))
                        st.plotly_chart(fig, use_container_width=True)
                    

with tab_history:
    st.subheader("📋 Recent Scan History")

    scans_df = fetch_scan_history()

    if scans_df.empty:
        st.info("No scans recorded yet. Use the sidebar button to run your first scan.")
    else:
        display = scans_df.rename(columns={
            "scan_type": "Type",
            "stocks_scanned": "Stocks Scanned",
            "signals_generated": "Signals Found",
            "duration_seconds": "Duration (s)",
            "created_at": "Time",
        })
        show_cols = ["Time", "Type", "Stocks Scanned", "Signals Found", "Duration (s)"]
        show_cols = [c for c in show_cols if c in display.columns]
        st.dataframe(display[show_cols], use_container_width=True, hide_index=True)

        st.divider()
        st.subheader("Signals Generated Over Time")

        chart_df = scans_df[["created_at", "signals_generated"]].copy()
        chart_df["created_at"] = pd.to_datetime(chart_df["created_at"], errors="coerce")
        chart_df = chart_df.dropna(subset=["created_at"]).sort_values("created_at")

        if not chart_df.empty:
            fig_line = px.line(
                chart_df,
                x="created_at",
                y="signals_generated",
                markers=True,
                labels={"created_at": "Scan Time", "signals_generated": "Signals"},
                title="Signals Generated Per Scan",
            )
            fig_line.update_layout(
                plot_bgcolor="rgba(0,0,0,0)",
                paper_bgcolor="rgba(0,0,0,0)",
                font_color="#FAFAFA",
                height=350,
            )
            st.plotly_chart(fig_line, use_container_width=True)

# ============================= TAB 5: ANALYTICS ==========================

with tab_analytics:
    st.subheader("📊 Signal Analytics")

    if buy_df.empty and exit_df.empty:
        st.info("No signal data available for analytics. Run a scan first.")
    else:
        col_left, col_right = st.columns(2)

        # ---- Sector distribution pie (buy signals) ----
        with col_left:
            st.markdown("#### Sector Distribution — Buy Signals")
            if not buy_df.empty and "sector" in buy_df.columns:
                sector_counts = buy_df["sector"].value_counts().reset_index()
                sector_counts.columns = ["Sector", "Count"]
                sector_counts = sector_counts[sector_counts["Sector"] != ""]

                if not sector_counts.empty:
                    fig_pie = px.pie(
                        sector_counts,
                        names="Sector",
                        values="Count",
                        color_discrete_sequence=px.colors.qualitative.Set3,
                        hole=0.35,
                    )
                    fig_pie.update_layout(
                        plot_bgcolor="rgba(0,0,0,0)",
                        paper_bgcolor="rgba(0,0,0,0)",
                        font_color="#FAFAFA",
                        height=400,
                    )
                    st.plotly_chart(fig_pie, use_container_width=True)
                else:
                    st.caption("No sector data available for buy signals.")
            else:
                st.caption("No buy signals to chart.")

        # ---- ROE vs P/E scatter ----
        with col_right:
            st.markdown("#### ROE vs P/E — Buy Signals")
            if not buy_df.empty and "roe" in buy_df.columns and "pe_ratio" in buy_df.columns:
                scatter_df = buy_df.dropna(subset=["roe", "pe_ratio"])
                if not scatter_df.empty:
                    fig_scatter = px.scatter(
                        scatter_df,
                        x="pe_ratio",
                        y="roe",
                        text="symbol",
                        color="sector" if "sector" in scatter_df.columns else None,
                        labels={"pe_ratio": "P/E Ratio", "roe": "ROE (%)"},
                        hover_data=["company_name", "ltp"],
                    )
                    fig_scatter.update_traces(textposition="top center", marker_size=10)
                    fig_scatter.update_layout(
                        plot_bgcolor="rgba(0,0,0,0)",
                        paper_bgcolor="rgba(0,0,0,0)",
                        font_color="#FAFAFA",
                        height=400,
                    )
                    st.plotly_chart(fig_scatter, use_container_width=True)
                else:
                    st.caption("Insufficient ROE/P/E data for scatter plot.")
            else:
                st.caption("No buy signals with ROE/P/E data.")

        st.divider()

        # ---- Histogram: % from 52W Low ----
        st.markdown("#### Distribution of % From 52-Week Low")
        if not buy_df.empty and "pct_from_low" in buy_df.columns:
            hist_df = buy_df.dropna(subset=["pct_from_low"])
            if not hist_df.empty:
                fig_hist = px.histogram(
                    hist_df,
                    x="pct_from_low",
                    nbins=20,
                    labels={"pct_from_low": "% From 52W Low"},
                    color_discrete_sequence=["#00C853"],
                )
                fig_hist.update_layout(
                    plot_bgcolor="rgba(0,0,0,0)",
                    paper_bgcolor="rgba(0,0,0,0)",
                    font_color="#FAFAFA",
                    yaxis_title="Count",
                    height=350,
                )
                st.plotly_chart(fig_hist, use_container_width=True)
            else:
                st.caption("No data for histogram.")
        else:
            st.caption("No buy signals with proximity data.")

# ---------------------------------------------------------------------------
# FOOTER
# ---------------------------------------------------------------------------

st.divider()
st.markdown(
    """
    <div style='text-align:center; padding: 1rem 0;'>
        <p style='color:#FF9800; font-weight:600;'>
            ⚠️ Risk Advisory: Maintain 2-3% max risk per trade. Not financial advice.
        </p>
        <p style='color:#888; font-size:0.85rem;'>
            Data sourced from Yahoo Finance. Built with AlphaPulse-IN.
        </p>
    </div>
    """,
    unsafe_allow_html=True,
)
