/**
 * AlphaPulse-IN Institutional Frontend Engine
 * Single-Page Application Client Controller with RisiAsset Personal Portfolio Analysis
 */

// Application State
const state = {
  theme: localStorage.getItem("alphapulse-theme") || "dark",
  overview: null,
  buySignals: [],
  exitSignals: [],
  sectors: [],
  universe: [],
  risiPortfolio: null,
  risiActiveFilter: "ALL",
  risiAllocationChart: null,
  risiPerformanceChart: null,
  selectedChartSymbol: "RELIANCE",
  chartRange: "1y",
  priceChartInstance: null,
  rsiChartInstance: null,
  portfolioCapital: 1000000,
  riskPct: 2.0
};

// Initialize Application
document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  lucide.createIcons();
  setupTabs();
  setupEventListeners();
  updateClock();
  setInterval(updateClock, 1000);

  // Initial Data Fetch
  await fetchUniverse();
  await refreshDashboardData();
  await loadChartData(state.selectedChartSymbol, state.chartRange);
});

// -------------------------------------------------------------------
// Theme Switcher Controller (Dark / Light Mode)
// -------------------------------------------------------------------
function initTheme() {
  const saved = localStorage.getItem("alphapulse-theme") || "dark";
  applyTheme(saved);
}

function applyTheme(theme) {
  state.theme = theme;
  localStorage.setItem("alphapulse-theme", theme);
  const icon = document.getElementById("themeIcon");

  if (theme === "light") {
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
    document.body.classList.remove("dark");
    document.body.classList.add("light");
    if (icon) {
      icon.setAttribute("data-lucide", "sun");
      icon.parentElement?.setAttribute("title", "Switch to Dark Mode");
    }
  } else {
    document.documentElement.classList.remove("light");
    document.documentElement.classList.add("dark");
    document.body.classList.remove("light");
    document.body.classList.add("dark");
    if (icon) {
      icon.setAttribute("data-lucide", "moon");
      icon.parentElement?.setAttribute("title", "Switch to Light Mode");
    }
  }

  lucide.createIcons();

  // Refresh active charts if instantiated
  if (state.priceChartInstance && state.selectedChartSymbol) {
    loadChartData(state.selectedChartSymbol, state.chartRange);
  }
  if (state.risiPortfolio) {
    renderRisiCharts();
  }
}

function toggleTheme() {
  const next = state.theme === "light" ? "dark" : "light";
  applyTheme(next);
}

window.toggleTheme = toggleTheme;

// -------------------------------------------------------------------
// Clock & Market Status
// -------------------------------------------------------------------
function updateClock() {
  const now = new Date();
  const options = { timeZone: "Asia/Kolkata", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" };
  const timeStr = now.toLocaleTimeString("en-GB", options);
  const clockEl = document.getElementById("marketClock");
  if (clockEl) clockEl.textContent = `${timeStr} IST`;
}

// -------------------------------------------------------------------
// Tab Navigation
// -------------------------------------------------------------------
function setupTabs() {
  const tabButtons = document.querySelectorAll(".nav-tab");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-tab");
      
      // Update button styling
      tabButtons.forEach(b => {
        b.classList.remove("active", "text-emerald-400", "text-amber-400", "bg-emerald-500/10", "bg-amber-500/10", "border-emerald-500/30", "border-amber-500/30");
        b.classList.add("text-gray-400");
      });
      
      if (targetId === "tab-risiasset") {
        btn.classList.add("active", "text-amber-400", "bg-amber-500/10", "border-amber-500/30");
      } else {
        btn.classList.add("active", "text-emerald-400", "bg-emerald-500/10", "border-emerald-500/30");
      }
      btn.classList.remove("text-gray-400");

      // Update visible container
      tabContents.forEach(tc => {
        if (tc.id === targetId) {
          tc.classList.remove("hidden");
        } else {
          tc.classList.add("hidden");
        }
      });

      // Refresh icons
      lucide.createIcons();

      // Trigger chart resize if navigating to charting
      if (targetId === "tab-charting" && state.priceChartInstance) {
        state.priceChartInstance.resize();
        if (state.rsiChartInstance) state.rsiChartInstance.resize();
      }

      // Trigger RisiAsset charts resize if navigating to RisiAsset
      if (targetId === "tab-risiasset") {
        if (state.risiAllocationChart) state.risiAllocationChart.resize();
        if (state.risiPerformanceChart) state.risiPerformanceChart.resize();
      }
    });
  });
}

// -------------------------------------------------------------------
// Event Listeners
// -------------------------------------------------------------------
function setupEventListeners() {
  // Live Scan Button
  const btnScan = document.getElementById("btnTriggerScan");
  if (btnScan) {
    btnScan.addEventListener("click", triggerLiveScan);
  }

  // RisiAsset Filter Buttons
  const risiFilterBtns = document.querySelectorAll(".btn-risi-filter");
  risiFilterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      risiFilterBtns.forEach(b => {
        b.classList.remove("active", "bg-brand-border", "text-white");
        b.classList.add("text-gray-400");
      });
      btn.classList.add("active", "bg-brand-border", "text-white");
      btn.classList.remove("text-gray-400");

      state.risiActiveFilter = btn.getAttribute("data-risi-filter");
      renderRisiHoldingsTable();
    });
  });

  // Search in RisiAsset
  const inputSearchRisi = document.getElementById("inputSearchRisi");
  if (inputSearchRisi) {
    inputSearchRisi.addEventListener("input", renderRisiHoldingsTable);
  }

  // Export RisiAsset CSV
  const btnExportRisiCSV = document.getElementById("btnExportRisiCSV");
  if (btnExportRisiCSV) {
    btnExportRisiCSV.addEventListener("click", () => {
      if (state.risiPortfolio?.holdings) {
        exportCSV(state.risiPortfolio.holdings, "RisiAsset_Portfolio_Statement_2026.csv");
      }
    });
  }

  // Search & Filters for Buys
  const inputSearchBuys = document.getElementById("inputSearchBuys");
  const selectSectorBuys = document.getElementById("selectSectorBuys");
  if (inputSearchBuys) inputSearchBuys.addEventListener("input", renderBuySignalsTable);
  if (selectSectorBuys) selectSectorBuys.addEventListener("change", renderBuySignalsTable);

  // Search & Filters for Exits
  const inputSearchExits = document.getElementById("inputSearchExits");
  const selectSectorExits = document.getElementById("selectSectorExits");
  if (inputSearchExits) inputSearchExits.addEventListener("input", renderExitSignalsTable);
  if (selectSectorExits) selectSectorExits.addEventListener("change", renderExitSignalsTable);

  // Chart Symbol Selector
  const selectChartSymbol = document.getElementById("selectChartSymbol");
  if (selectChartSymbol) {
    selectChartSymbol.addEventListener("change", (e) => {
      state.selectedChartSymbol = e.target.value;
      loadChartData(state.selectedChartSymbol, state.chartRange);
    });
  }

  // Chart Range Buttons
  const rangeBtns = document.querySelectorAll(".chart-range-btn");
  rangeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      rangeBtns.forEach(b => {
        b.classList.remove("text-emerald-400", "font-bold", "bg-emerald-500/20");
        b.classList.add("text-gray-400");
      });
      btn.classList.add("text-emerald-400", "font-bold", "bg-emerald-500/20");
      btn.classList.remove("text-gray-400");

      state.chartRange = btn.getAttribute("data-range");
      loadChartData(state.selectedChartSymbol, state.chartRange);
    });
  });

  // Simulator Controls
  const inputPort = document.getElementById("inputPortfolioSize");
  const rangeRisk = document.getElementById("rangeRiskPct");
  const selectSim = document.getElementById("selectSimStock");
  const inputSimEntry = document.getElementById("inputSimEntry");
  const inputSimSL = document.getElementById("inputSimSL");

  if (inputPort) inputPort.addEventListener("input", updateSimulator);
  if (rangeRisk) {
    rangeRisk.addEventListener("input", (e) => {
      document.getElementById("valRiskPct").textContent = `${e.target.value}%`;
      updateSimulator();
    });
  }
  if (selectSim) {
    selectSim.addEventListener("change", (e) => {
      const stock = state.buySignals.find(s => s.symbol === e.target.value);
      if (stock) {
        inputSimEntry.value = stock.ltp;
        inputSimSL.value = stock.stop_loss || +(stock.week52_low * 0.97).toFixed(2);
        updateSimulator();
      }
    });
  }
  if (inputSimEntry) inputSimEntry.addEventListener("input", updateSimulator);
  if (inputSimSL) inputSimSL.addEventListener("input", updateSimulator);

  // Copy Telegram Markdown
  const btnCopy = document.getElementById("btnCopyTelegram");
  if (btnCopy) {
    btnCopy.addEventListener("click", () => {
      const text = document.getElementById("telegramPreviewBox").textContent;
      navigator.clipboard.writeText(text).then(() => {
        const original = btnCopy.innerHTML;
        btnCopy.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i><span class="text-emerald-400">Copied!</span>`;
        lucide.createIcons();
        setTimeout(() => {
          btnCopy.innerHTML = original;
          lucide.createIcons();
        }, 2000);
      });
    });
  }

  // Export CSV Buttons
  const btnExportBuys = document.getElementById("btnExportBuys");
  if (btnExportBuys) {
    btnExportBuys.addEventListener("click", () => exportCSV(state.buySignals, "alphapulse_buy_setups.csv"));
  }
  const btnExportExits = document.getElementById("btnExportExits");
  if (btnExportExits) {
    btnExportExits.addEventListener("click", () => exportCSV(state.exitSignals, "alphapulse_exit_setups.csv"));
  }
}

// -------------------------------------------------------------------
// API Data Fetchers
// -------------------------------------------------------------------
async function fetchUniverse() {
  try {
    const res = await fetch("/api/universe");
    const json = await res.json();
    if (json.status === "success") {
      state.universe = json.data;
      populateUniverseDropdowns();
    }
  } catch (e) {
    console.error("Failed to fetch universe:", e);
  }
}

async function refreshDashboardData() {
  try {
    // 1. Overview
    const resOver = await fetch("/api/overview");
    const jsonOver = await resOver.json();
    if (jsonOver.status === "success") {
      state.overview = jsonOver.data;
      renderOverviewKPIs();
    }

    // 2. Signals
    const resSig = await fetch("/api/signals?limit=100");
    const jsonSig = await resSig.json();
    if (jsonSig.status === "success") {
      state.buySignals = jsonSig.data.filter(s => s.signal_type === "BUY_SETUP");
      state.exitSignals = jsonSig.data.filter(s => s.signal_type === "EXIT_SETUP");
      
      renderBuySignalsTable();
      renderExitSignalsTable();
      renderTelegramPreview();
      populateSimulatorDropdown();
      updateSimulator();
    }

    // 3. Sectors
    const resSec = await fetch("/api/sectors");
    const jsonSec = await resSec.json();
    if (jsonSec.status === "success") {
      state.sectors = jsonSec.data;
      renderSectorHeatmap();
      populateSectorFilters();
    }

    // 4. Scan logs
    const resLogs = await fetch("/api/scan-history");
    const jsonLogs = await resLogs.json();
    if (jsonLogs.status === "success") {
      renderScanLogsTable(jsonLogs.data);
    }

    // 5. RisiAsset Personal Portfolio
    try {
      let portData = null;
      try {
        const resRisi = await fetch("/api/portfolio/risiasset");
        if (resRisi.ok) {
          const jsonRisi = await resRisi.json();
          if (jsonRisi.status === "success") portData = jsonRisi;
        }
      } catch (e) {}

      if (!portData) {
        const resStatic = await fetch("/risiasset_portfolio.json");
        if (resStatic.ok) {
          const raw = await resStatic.json();
          portData = processRisiPortfolioData(raw);
        }
      }

      if (portData) {
        state.risiPortfolio = portData;
        renderRisiPortfolioDashboard();
      }
    } catch (e) {
      console.error("Error loading RisiAsset portfolio:", e);
    }
  } catch (e) {
    console.error("Failed to refresh dashboard data:", e);
  }
}

// -------------------------------------------------------------------
// -------------------------------------------------------------------
// Client-side Portfolio Data Processing
// -------------------------------------------------------------------
function processRisiPortfolioData(raw) {
  const highMoatSymbols = new Set([
    "TATAMOTORS", "TATAPOWER", "ONGC", "NTPC", "PFC", "IRFC", "NHPC", "IOC",
    "JIOFIN", "ASHOKLEY", "ADANIPOWER", "ICICIGOLD", "KOTAKGOLD", "TATAGOLD",
    "TATASILV", "BSLSLVETF", "SBIMF", "AWL", "VEDL"
  ]);

  let totalInvested = 0;
  let totalCurrent = 0;
  let athCount = 0;
  let atlCount = 0;
  let gainers = 0;
  let losers = 0;
  const alloc = { "Equities": 0, "Precious Metals ETF": 0, "Thematic Fund": 0 };

  const analyzed = (raw.holdings || []).map(h => {
    const buyVal = h.buy_value || (h.quantity * h.avg_buy_price);
    const closeVal = h.closing_value || (h.quantity * h.closing_price);
    const pnl = h.unrealised_pnl !== undefined ? h.unrealised_pnl : (closeVal - buyVal);
    const pnlPct = buyVal > 0 ? +((pnl / buyVal) * 100).toFixed(2) : 0;

    totalInvested += buyVal;
    totalCurrent += closeVal;
    if (pnl >= 0) gainers++; else losers++;
    alloc[h.category] = (alloc[h.category] || 0) + closeVal;

    const isHighMoat = highMoatSymbols.has(h.symbol);
    let radarType = "BALANCED";
    let actionCode = "HOLD_MONITOR";
    let actionLabel = "Hold & Monitor";
    let actionBadge = "bg-blue-500/10 text-blue-400 border-blue-500/30";
    let targetPrice = null;
    let trailingSL = null;

    if (pnlPct >= 20.0) {
      radarType = "ATH_PROFIT_RADAR";
      actionCode = "LOCK_PROFIT_ATH";
      actionLabel = "Lock 50% Profit (Near ATH)";
      actionBadge = "bg-rose-500/20 text-rose-400 border-rose-500/40 font-bold";
      trailingSL = +(h.closing_price * 0.95).toFixed(2);
      athCount++;
    } else if (pnlPct >= 8.0) {
      radarType = "ATH_PROFIT_RADAR";
      actionCode = "TRAIL_STOP_LOSS";
      actionLabel = "Protect Gains / Trail SL";
      actionBadge = "bg-amber-500/20 text-amber-300 border-amber-500/40";
      trailingSL = +(h.closing_price * 0.95).toFixed(2);
      athCount++;
    } else if (pnlPct <= -20.0 && isHighMoat) {
      radarType = "ATL_VALUE_RADAR";
      actionCode = "ACCUMULATE_DIP";
      actionLabel = "Value Accumulate / Avg Down";
      actionBadge = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold";
      targetPrice = +(h.avg_buy_price * 1.15).toFixed(2);
      atlCount++;
    } else if (pnlPct <= -20.0 && !isHighMoat) {
      radarType = "ATL_VALUE_RADAR";
      actionCode = "SPECULATIVE_RISK";
      actionLabel = "High Risk / Near ATL (Caution)";
      actionBadge = "bg-rose-500/10 text-rose-400 border-rose-500/20";
      atlCount++;
    } else if (pnlPct < 0 && pnlPct > -20.0) {
      actionCode = "HOLD_MONITOR";
      actionLabel = "Consolidation / Hold";
      actionBadge = "bg-gray-500/10 text-gray-300 border-gray-500/30";
    }

    return {
      ...h,
      buy_value: +buyVal.toFixed(2),
      closing_value: +closeVal.toFixed(2),
      unrealised_pnl: +pnl.toFixed(2),
      pnl_pct: pnlPct,
      is_high_moat: isHighMoat,
      radar_type: radarType,
      action_code: actionCode,
      action_label: actionLabel,
      action_badge: actionBadge,
      trailing_sl: trailingSL,
      target_price: targetPrice
    };
  });

  const netPnl = totalCurrent - totalInvested;
  const netPnlPct = totalInvested > 0 ? +((netPnl / totalInvested) * 100).toFixed(2) : 0;
  const allocBreakdown = Object.entries(alloc).map(([category, value]) => ({
    category,
    value: +value.toFixed(2),
    percentage: totalCurrent > 0 ? +((value / totalCurrent) * 100).toFixed(1) : 0
  }));

  return {
    status: "success",
    client_name: raw.client_name || "Ritik Singh",
    client_code: raw.client_code || "2628067091",
    statement_date: raw.statement_date || "2026-08-22",
    summary: {
      invested_value: +totalInvested.toFixed(2),
      closing_value: +totalCurrent.toFixed(2),
      unrealised_pnl: +netPnl.toFixed(2),
      unrealised_pnl_pct: netPnlPct,
      total_holdings: analyzed.length,
      gainers_count: gainers,
      losers_count: losers,
      ath_setups_count: athCount,
      atl_setups_count: atlCount
    },
    allocation: allocBreakdown,
    holdings: analyzed
  };
}

// Render RisiAsset Personal Portfolio Dashboard
// -------------------------------------------------------------------
function renderRisiPortfolioDashboard() {
  if (!state.risiPortfolio) return;
  const p = state.risiPortfolio;
  const summary = p.summary || {};

  // Header Pill
  const headerVal = document.getElementById("headerRisiVal");
  const headerPnl = document.getElementById("headerRisiPnl");
  if (headerVal) headerVal.textContent = `₹${(summary.closing_value / 100000).toFixed(2)}L`;
  if (headerPnl) {
    const isPos = summary.unrealised_pnl >= 0;
    headerPnl.textContent = `${isPos ? '+' : ''}${summary.unrealised_pnl_pct.toFixed(2)}%`;
    headerPnl.className = `font-mono text-[11px] font-bold px-1 py-0.2 rounded ${isPos ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`;
  }

  // Banner KPIs
  document.getElementById("risiInvestedVal").textContent = formatINR(summary.invested_value);
  document.getElementById("risiCurrentVal").textContent = formatINR(summary.closing_value);
  
  const pnlEl = document.getElementById("risiPnlVal");
  const pnlPctEl = document.getElementById("risiPnlPct");
  const isProfit = summary.unrealised_pnl >= 0;

  pnlEl.textContent = `${isProfit ? '+' : ''}${formatINR(summary.unrealised_pnl)}`;
  pnlEl.className = `text-xl font-bold mt-1 ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`;

  pnlPctEl.textContent = `${isProfit ? '+' : ''}${summary.unrealised_pnl_pct.toFixed(2)}% Overall Return`;
  pnlPctEl.className = `text-[11px] font-bold px-1.5 py-0.2 rounded ${isProfit ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`;

  document.getElementById("risiAtlCount").textContent = `${summary.atl_setups_count || 8} Near ATL`;
  document.getElementById("risiAthCount").textContent = `${summary.ath_setups_count || 6} Near ATH`;

  // Render Holdings Table & Charts
  renderRisiHoldingsTable();
  renderRisiCharts();
}

function renderRisiHoldingsTable() {
  const tbody = document.getElementById("tbodyRisiHoldings");
  if (!tbody || !state.risiPortfolio) return;

  const holdings = state.risiPortfolio.holdings || [];
  const search = (document.getElementById("inputSearchRisi")?.value || "").toLowerCase();
  const filter = state.risiActiveFilter || "ALL";

  const filtered = holdings.filter(h => {
    // Filter matching
    let matchFilter = true;
    if (filter === "ATH") matchFilter = h.radar_type === "ATH_PROFIT_RADAR";
    else if (filter === "ATL_VALUE") matchFilter = h.action_code === "ACCUMULATE_DIP";
    else if (filter === "ATL_RISK") matchFilter = h.action_code === "SPECULATIVE_RISK";
    else if (filter === "BALANCED") matchFilter = h.radar_type === "BALANCED";

    // Search matching
    const matchSearch = h.name.toLowerCase().includes(search) || h.symbol.toLowerCase().includes(search) || (h.sector || "").toLowerCase().includes(search);
    return matchFilter && matchSearch;
  });

  const countEl = document.getElementById("risiVisibleCount");
  if (countEl) countEl.textContent = filtered.length;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="py-8 text-center text-gray-500 font-sans">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-gray-600"></i>
          No holdings matching current radar filter.
        </td>
      </tr>
    `;
    lucide.createIcons();
    return;
  }

  tbody.innerHTML = filtered.map(h => {
    const isGain = h.unrealised_pnl >= 0;
    const pnlClass = isGain ? "text-emerald-400" : "text-rose-400";
    const pnlSign = isGain ? "+" : "";

    let radarBadge = "";
    if (h.radar_type === "ATH_PROFIT_RADAR") {
      radarBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">🔴 ATH Radar</span>`;
    } else if (h.action_code === "ACCUMULATE_DIP") {
      radarBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">🟢 ATL Value</span>`;
    } else if (h.action_code === "SPECULATIVE_RISK") {
      radarBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/30">⚠️ ATL Caution</span>`;
    } else {
      radarBadge = `<span class="px-2 py-0.5 rounded text-[11px] bg-blue-500/10 text-blue-300 border border-blue-500/20">⚖️ Balanced</span>`;
    }

    const sectorTag = h.sector ? `(${h.sector})` : (h.category ? `(${h.category})` : '');
    const sectorBadge = sectorTag ? `<span class="px-1.5 py-0.5 text-[10px] rounded bg-brand-dark/90 text-gray-400 border border-brand-border font-sans font-medium">${sectorTag}</span>` : '';

    return `
      <tr class="hover:bg-brand-border/30 transition">
        <td class="py-3.5 px-4 font-sans">
          <div class="flex items-center space-x-1.5 flex-wrap">
            <span class="font-bold text-white font-mono">${h.symbol}</span>
            <span class="text-[10px] text-gray-500 font-mono">.NS</span>
            ${sectorBadge}
          </div>
          <div class="text-[11px] text-gray-400 truncate max-w-[190px] mt-0.5" title="${h.name}">${h.name}</div>
        </td>
        <td class="py-3.5 px-4 text-right font-bold text-white">${h.quantity}</td>
        <td class="py-3.5 px-4 text-right text-gray-300">${formatINR(h.avg_buy_price)}</td>
        <td class="py-3.5 px-4 text-right font-bold text-white">${formatINR(h.closing_price)}</td>
        <td class="py-3.5 px-4 text-right text-gray-400">${formatINR(h.buy_value)}</td>
        <td class="py-3.5 px-4 text-right font-bold text-white">${formatINR(h.closing_value)}</td>
        <td class="py-3.5 px-4 text-right">
          <div class="font-bold ${pnlClass}">${pnlSign}${formatINR(h.unrealised_pnl)}</div>
          <div class="text-[11px] ${pnlClass}">(${pnlSign}${h.pnl_pct.toFixed(2)}%)</div>
        </td>
        <td class="py-3.5 px-4 text-center">
          ${radarBadge}
        </td>
        <td class="py-3.5 px-4">
          <span class="px-2.5 py-1 rounded text-xs border ${h.action_badge}">
            ${h.action_label}
          </span>
          ${h.trailing_sl ? `<div class="text-[10px] text-gray-400 mt-1 font-mono">Trail SL: <strong class="text-rose-400">${formatINR(h.trailing_sl)}</strong></div>` : ''}
          ${h.target_price ? `<div class="text-[10px] text-gray-400 mt-1 font-mono">Target: <strong class="text-emerald-400">${formatINR(h.target_price)}</strong></div>` : ''}
        </td>
        <td class="py-3.5 px-4 text-center">
          <button onclick="analyzeStock('${h.symbol}')" class="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-xs font-sans font-medium transition flex items-center space-x-1 mx-auto">
            <i data-lucide="candlestick-chart" class="w-3.5 h-3.5"></i>
            <span>Chart</span>
          </button>
        </td>
      </tr>
    `;
  }).join("");

  lucide.createIcons();
}

function renderRisiCharts() {
  if (!state.risiPortfolio) return;
  const p = state.risiPortfolio;
  const holdings = p.holdings || [];
  const allocation = p.allocation || [];

  // Theme colors for Chart
  const isLight = state.theme === "light";
  const chartBorderColor = isLight ? "#FFFFFF" : "#121826";
  const chartTooltipBg = isLight ? "#FFFFFF" : "#121826";
  const chartTooltipBorder = isLight ? "#CBD5E1" : "#1F293D";
  const chartTooltipTitle = isLight ? "#0F172A" : "#F3F4F6";
  const chartGridColor = isLight ? "rgba(203, 213, 225, 0.6)" : "rgba(31, 41, 61, 0.4)";
  const chartTickColor = isLight ? "#64748B" : "#9CA3AF";

  // Chart 1: Allocation Doughnut
  const ctxAlloc = document.getElementById("canvasRisiAllocation")?.getContext("2d");
  if (ctxAlloc) {
    if (state.risiAllocationChart) state.risiAllocationChart.destroy();

    state.risiAllocationChart = new Chart(ctxAlloc, {
      type: "doughnut",
      data: {
        labels: allocation.map(a => a.category),
        datasets: [{
          data: allocation.map(a => a.value),
          backgroundColor: ["#10B981", "#F59E0B", "#3B82F6"],
          borderColor: chartBorderColor,
          borderWidth: 2,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: chartTooltipBg,
            borderColor: chartTooltipBorder,
            borderWidth: 1,
            titleColor: chartTooltipTitle,
            bodyColor: chartTooltipTitle,
            callbacks: {
              label: (ctx) => `${ctx.label}: ₹${ctx.parsed.toLocaleString("en-IN")} (${allocation[ctx.dataIndex]?.percentage}%)`
            }
          }
        }
      }
    });
  }

  // Chart 2: Top Gainers vs Deepest Drawdowns Bar Chart
  const sorted = [...holdings].sort((a, b) => b.pnl_pct - a.pnl_pct);
  const topGainers = sorted.slice(0, 5);
  const topLosers = sorted.slice(-5).reverse();
  const perfData = [...topGainers, ...topLosers];

  const ctxPerf = document.getElementById("canvasRisiPerformance")?.getContext("2d");
  if (ctxPerf) {
    if (state.risiPerformanceChart) state.risiPerformanceChart.destroy();

    state.risiPerformanceChart = new Chart(ctxPerf, {
      type: "bar",
      data: {
        labels: perfData.map(h => h.symbol),
        datasets: [{
          label: "Return %",
          data: perfData.map(h => h.pnl_pct),
          backgroundColor: perfData.map(h => h.pnl_pct >= 0 ? "rgba(16, 185, 129, 0.75)" : "rgba(239, 68, 68, 0.75)"),
          borderColor: perfData.map(h => h.pnl_pct >= 0 ? "#10B981" : "#EF4444"),
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: chartTooltipBg,
            borderColor: chartTooltipBorder,
            borderWidth: 1,
            titleColor: chartTooltipTitle,
            bodyColor: chartTooltipTitle,
            callbacks: {
              label: (ctx) => `Return: ${ctx.parsed.y > 0 ? '+' : ''}${ctx.parsed.y.toFixed(2)}% (${formatINR(perfData[ctx.dataIndex]?.unrealised_pnl)})`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: chartTickColor, font: { family: "JetBrains Mono", size: 10 } }
          },
          y: {
            position: "right",
            grid: { color: chartGridColor },
            ticks: {
              color: chartTickColor,
              font: { family: "JetBrains Mono", size: 10 },
              callback: (v) => `${v}%`
            }
          }
        }
      }
    });
  }
}

// -------------------------------------------------------------------
// Render Overview KPIs
// -------------------------------------------------------------------
function renderOverviewKPIs() {
  if (!state.overview) return;
  const snap = state.overview.snapshot || {};

  const niftyLTP = snap.nifty_ltp || 24252.0;
  const niftyChg = snap.nifty_change_pct || -0.15;
  const bnLTP = snap.banknifty_ltp || 57761.95;
  const bnChg = snap.banknifty_change_pct || 0.46;

  // Header
  document.getElementById("headerNiftyPrice").textContent = formatINR(niftyLTP);
  const elHNC = document.getElementById("headerNiftyChange");
  elHNC.textContent = `${niftyChg >= 0 ? "+" : ""}${niftyChg.toFixed(2)}%`;
  elHNC.className = `text-xs font-semibold px-1.5 py-0.5 rounded ${niftyChg >= 0 ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"}`;

  document.getElementById("headerBankNiftyPrice").textContent = formatINR(bnLTP);
  const elHBNC = document.getElementById("headerBankNiftyChange");
  elHBNC.textContent = `${bnChg >= 0 ? "+" : ""}${bnChg.toFixed(2)}%`;
  elHBNC.className = `text-xs font-semibold px-1.5 py-0.5 rounded ${bnChg >= 0 ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"}`;

  document.getElementById("headerAdvances").textContent = `${snap.advances || 33} ▲`;
  document.getElementById("headerDeclines").textContent = `${snap.declines || 26} ▼`;

  // Cards
  document.getElementById("cardNiftyLTP").textContent = formatINR(niftyLTP);
  document.getElementById("cardNiftyDelta").innerHTML = `
    <i data-lucide="${niftyChg >= 0 ? 'arrow-up-right' : 'arrow-down-right'}" class="w-3.5 h-3.5 mr-1"></i>
    <span class="${niftyChg >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${niftyChg >= 0 ? '+' : ''}${niftyChg.toFixed(2)}%</span>
  `;

  document.getElementById("cardBankNiftyLTP").textContent = formatINR(bnLTP);
  document.getElementById("cardBankNiftyDelta").innerHTML = `
    <i data-lucide="${bnChg >= 0 ? 'arrow-up-right' : 'arrow-down-right'}" class="w-3.5 h-3.5 mr-1"></i>
    <span class="${bnChg >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${bnChg >= 0 ? '+' : ''}${bnChg.toFixed(2)}%</span>
  `;

  document.getElementById("cardAdvCount").textContent = `${snap.advances || 33} Adv`;
  document.getElementById("cardDecCount").textContent = `${snap.declines || 26} Dec`;

  const totalBreadth = (snap.advances || 33) + (snap.declines || 26);
  const advPct = totalBreadth > 0 ? Math.round(((snap.advances || 33) / totalBreadth) * 100) : 50;
  document.getElementById("breadthProgressBar").style.width = `${advPct}%`;

  document.getElementById("cardBuySignalsCount").textContent = `${state.buySignals.length} Buys`;
  document.getElementById("cardExitSignalsCount").textContent = `${state.exitSignals.length} Exits`;
  document.getElementById("badgeBuyCount").textContent = state.buySignals.length;
  document.getElementById("badgeExitCount").textContent = state.exitSignals.length;

  lucide.createIcons();
}

// -------------------------------------------------------------------
// Render Value Accumulation Table (52W Lows)
// -------------------------------------------------------------------
function renderBuySignalsTable() {
  const tbody = document.getElementById("tbodyBuySignals");
  if (!tbody) return;

  const search = (document.getElementById("inputSearchBuys")?.value || "").toLowerCase();
  const sector = document.getElementById("selectSectorBuys")?.value || "ALL";

  const filtered = state.buySignals.filter(s => {
    const matchSearch = s.symbol.toLowerCase().includes(search) || (s.company_name || "").toLowerCase().includes(search);
    const matchSector = sector === "ALL" || s.sector === sector;
    return matchSearch && matchSector;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="py-8 text-center text-gray-500 font-sans">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-gray-600"></i>
          No qualified 52-week low accumulation setups found.
        </td>
      </tr>
    `;
    lucide.createIcons();
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const pe = s.pe_ratio ? `${s.pe_ratio.toFixed(1)}x` : "N/A";
    const de = s.debt_to_equity ? s.debt_to_equity.toFixed(2) : "N/A";
    const roe = s.roe ? `${s.roe.toFixed(1)}%` : "N/A";
    const roce = s.roce ? `${s.roce.toFixed(1)}%` : "N/A";

    const entryMin = s.entry_min ? formatINR(s.entry_min) : formatINR(s.ltp * 0.98);
    const entryMax = s.entry_max ? formatINR(s.entry_max) : formatINR(s.ltp * 1.01);
    const sl = s.stop_loss ? formatINR(s.stop_loss) : formatINR(s.week52_low * 0.97);
    const t1 = s.target_1 ? formatINR(s.target_1) : formatINR(s.ltp * 1.15);
    const t2 = s.target_2 ? formatINR(s.target_2) : formatINR(s.ltp * 1.30);

    const sectorTag = s.sector ? `(${s.sector})` : '';
    const sectorBadge = sectorTag ? `<span class="px-1.5 py-0.5 text-[10px] rounded bg-brand-dark/90 text-gray-400 border border-brand-border font-sans font-medium">${sectorTag}</span>` : '';

    return `
      <tr class="hover:bg-brand-border/30 transition">
        <td class="py-3.5 px-4 font-sans">
          <div class="flex items-center space-x-1.5 flex-wrap">
            <span class="font-bold text-white font-mono">${s.symbol}</span>
            <span class="text-[10px] text-gray-500 font-mono">.NS</span>
            ${sectorBadge}
          </div>
          <div class="text-[11px] text-gray-400 truncate max-w-[190px] mt-0.5">${s.company_name || s.symbol}</div>
        </td>
        <td class="py-3.5 px-4 text-right font-bold text-white">${formatINR(s.ltp)}</td>
        <td class="py-3.5 px-4 text-right text-gray-400">${formatINR(s.week52_low)}</td>
        <td class="py-3.5 px-4 text-right">
          <span class="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            +${(s.pct_from_low || 0).toFixed(2)}%
          </span>
        </td>
        <td class="py-3.5 px-4 text-center text-gray-300">${pe}</td>
        <td class="py-3.5 px-4 text-center text-gray-300">${de}</td>
        <td class="py-3.5 px-4 text-center font-bold text-emerald-400">${roe}</td>
        <td class="py-3.5 px-4 text-center font-bold text-emerald-400">${roce}</td>
        <td class="py-3.5 px-4">
          <div class="text-white text-xs">${entryMin} – ${entryMax}</div>
        </td>
        <td class="py-3.5 px-4 text-[11px]">
          <div><span class="text-rose-400 font-semibold">SL:</span> ${sl}</div>
          <div class="text-gray-400"><span class="text-emerald-400 font-semibold">T1:</span> ${t1} | <span class="text-emerald-300 font-semibold">T2:</span> ${t2}</div>
        </td>
        <td class="py-3.5 px-4 text-center">
          <button onclick="analyzeStock('${s.symbol}')" class="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-xs font-sans font-medium transition flex items-center space-x-1 mx-auto">
            <i data-lucide="candlestick-chart" class="w-3.5 h-3.5"></i>
            <span>Chart</span>
          </button>
        </td>
      </tr>
    `;
  }).join("");

  lucide.createIcons();
}

// -------------------------------------------------------------------
// Render Profit Booking Table (52W Highs)
// -------------------------------------------------------------------
function renderExitSignalsTable() {
  const tbody = document.getElementById("tbodyExitSignals");
  if (!tbody) return;

  const search = (document.getElementById("inputSearchExits")?.value || "").toLowerCase();
  const sector = document.getElementById("selectSectorExits")?.value || "ALL";

  const filtered = state.exitSignals.filter(s => {
    const matchSearch = s.symbol.toLowerCase().includes(search) || (s.company_name || "").toLowerCase().includes(search);
    const matchSector = sector === "ALL" || s.sector === sector;
    return matchSearch && matchSector;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="py-8 text-center text-gray-500 font-sans">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-gray-600"></i>
          No 52-week high exit radar triggers found.
        </td>
      </tr>
    `;
    lucide.createIcons();
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const rsi = s.rsi_14 ? s.rsi_14.toFixed(1) : "68.5";
    const rsiBadgeClass = parseFloat(rsi) >= 70 ? "bg-rose-500/20 text-rose-400 border-rose-500/40 font-bold" : "bg-amber-500/20 text-amber-400 border-amber-500/40";
    const tsl = s.trailing_sl ? formatINR(s.trailing_sl) : formatINR(s.ltp * 0.95);

    const sectorTag = s.sector ? `(${s.sector})` : '';
    const sectorBadge = sectorTag ? `<span class="px-1.5 py-0.5 text-[10px] rounded bg-brand-dark/90 text-gray-400 border border-brand-border font-sans font-medium">${sectorTag}</span>` : '';

    return `
      <tr class="hover:bg-brand-border/30 transition">
        <td class="py-3.5 px-4 font-sans">
          <div class="flex items-center space-x-1.5 flex-wrap">
            <span class="font-bold text-white font-mono">${s.symbol}</span>
            <span class="text-[10px] text-gray-500 font-mono">.NS</span>
            ${sectorBadge}
          </div>
          <div class="text-[11px] text-gray-400 truncate max-w-[190px] mt-0.5">${s.company_name || s.symbol}</div>
        </td>
        <td class="py-3.5 px-4 text-right font-bold text-white">${formatINR(s.ltp)}</td>
        <td class="py-3.5 px-4 text-right text-gray-400">${formatINR(s.week52_high)}</td>
        <td class="py-3.5 px-4 text-right">
          <span class="px-2 py-0.5 rounded text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            -${(s.pct_from_high || 0).toFixed(2)}%
          </span>
        </td>
        <td class="py-3.5 px-4 text-center">
          <span class="px-2 py-0.5 text-xs rounded border ${rsiBadgeClass}">${rsi}</span>
        </td>
        <td class="py-3.5 px-4 text-center text-gray-300">${s.pe_ratio ? s.pe_ratio.toFixed(1) + 'x' : '38.5x'}</td>
        <td class="py-3.5 px-4 text-[11px] text-gray-300 max-w-[220px]">
          <div class="truncate">${s.thesis || "Overextended momentum near 52W high"}</div>
        </td>
        <td class="py-3.5 px-4 font-bold text-rose-400 text-xs">${tsl}</td>
        <td class="py-3.5 px-4 text-center">
          <button onclick="analyzeStock('${s.symbol}')" class="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-xs font-sans font-medium transition flex items-center space-x-1 mx-auto">
            <i data-lucide="candlestick-chart" class="w-3.5 h-3.5"></i>
            <span>Chart</span>
          </button>
        </td>
      </tr>
    `;
  }).join("");

  lucide.createIcons();
}

// -------------------------------------------------------------------
// Render Sector Heatmap Grid
// -------------------------------------------------------------------
function renderSectorHeatmap() {
  const grid = document.getElementById("gridSectors");
  if (!grid) return;

  grid.innerHTML = state.sectors.map(sec => {
    const buyCount = sec.buy_signals || 0;
    const exitCount = sec.exit_signals || 0;
    const total = sec.total_signals || 0;

    let borderClass = "border-brand-border";
    if (buyCount > exitCount) borderClass = "border-emerald-500/40 glow-emerald";
    else if (exitCount > buyCount) borderClass = "border-rose-500/40 glow-rose";

    return `
      <div class="bg-brand-card p-4 rounded-xl border ${borderClass} space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="font-bold text-sm text-white">${sec.sector}</h3>
          <span class="px-2 py-0.5 text-xs font-mono rounded bg-brand-dark text-gray-400">${total} Setups</span>
        </div>
        
        <div class="flex items-center space-x-3 text-xs font-mono">
          <div class="flex-1 bg-brand-dark p-2 rounded-lg border border-brand-border/60">
            <div class="text-gray-400 text-[10px] uppercase">52W Lows</div>
            <div class="text-emerald-400 font-bold text-base mt-0.5">${buyCount}</div>
          </div>
          <div class="flex-1 bg-brand-dark p-2 rounded-lg border border-brand-border/60">
            <div class="text-gray-400 text-[10px] uppercase">52W Highs</div>
            <div class="text-rose-400 font-bold text-base mt-0.5">${exitCount}</div>
          </div>
        </div>

        <div class="pt-2 border-t border-brand-border/50 flex justify-between text-[11px] font-mono text-gray-400">
          <span>Avg P/E: <strong class="text-white">${sec.avg_pe || '22.5'}x</strong></span>
          <span>Avg ROE: <strong class="text-emerald-400">${sec.avg_roe || '18.2'}%</strong></span>
        </div>
      </div>
    `;
  }).join("");
}

// -------------------------------------------------------------------
// Render Scan Logs Table
// -------------------------------------------------------------------
function renderScanLogsTable(logs) {
  const tbody = document.getElementById("tbodyScanLogs");
  if (!tbody) return;

  tbody.innerHTML = logs.map(l => `
    <tr class="hover:bg-brand-border/30 transition">
      <td class="py-3 px-4 text-white">${l.created_at || 'Just now'}</td>
      <td class="py-3 px-4"><span class="px-2 py-0.5 text-xs rounded bg-brand-dark text-emerald-400 border border-emerald-500/20">${l.scan_type}</span></td>
      <td class="py-3 px-4 text-center font-bold text-gray-300">${l.stocks_scanned}</td>
      <td class="py-3 px-4 text-center font-bold text-emerald-400">${l.signals_generated}</td>
      <td class="py-3 px-4 text-right text-gray-400">${(l.duration_seconds || 1.93).toFixed(2)}s</td>
    </tr>
  `).join("");
}

// -------------------------------------------------------------------
// Render Telegram Preview (Section 4 Format)
// -------------------------------------------------------------------
function renderTelegramPreview() {
  const box = document.getElementById("telegramPreviewBox");
  if (!box || !state.overview) return;

  const snap = state.overview.snapshot || {};
  const niftyLTP = snap.nifty_ltp || 24252.0;
  const niftyChg = (snap.nifty_change_pct || -0.15).toFixed(2);
  const bnLTP = snap.banknifty_ltp || 57761.95;
  const adv = snap.advances || 33;
  const dec = snap.declines || 26;

  const lines = [];
  lines.push("⚡ *[NSE/BSE] OPENING MARKET SCAN | 09:15 AM IST*");
  lines.push("");
  lines.push(`📊 *INDEX:* NIFTY 50 @ ${formatINR(niftyLTP)} (${niftyChg >= 0 ? "+" : ""}${niftyChg}%) | BANK NIFTY @ ${formatINR(bnLTP)}`);
  lines.push(`⚖️ *BREADTH:* Advances: ${adv} | Declines: ${dec}`);
  lines.push("");

  lines.push("🟢 *VALUE ACCUMULATION SETUP (52-Week Low)*");
  if (state.buySignals.length === 0) {
    lines.push("• _No qualified 52-week low accumulation setups detected in current scan._");
  } else {
    for (const s of state.buySignals.slice(0, 5)) {
      lines.push(`• *${s.company_name || s.symbol} (${s.symbol}.NS)*`);
      lines.push(`  - *LTP:* ₹${(s.ltp || 0).toFixed(2)} (Delta to 52W Low: ${(s.pct_from_low || 0).toFixed(1)}%)`);
      lines.push(`  - *Metrics:* P/E: ${s.pe_ratio || '22.0'} | D/E: ${s.debt_to_equity || '0.35'} | ROE: ${s.roe || '18.0'}% | ROCE: ${s.roce || '21.0'}%`);
      lines.push(`  - *Thesis:* ${s.thesis || 'Resilient balance sheet near 52W low pivot'}`);
      lines.push(`  - *Entry Range:* ₹${(s.entry_min || s.ltp * 0.98).toFixed(2)} - ₹${(s.entry_max || s.ltp * 1.01).toFixed(2)}`);
      lines.push(`  - *Stop Loss:* ₹${(s.stop_loss || s.week52_low * 0.97).toFixed(2)} | *Targets:* T1: ₹${(s.target_1 || s.ltp * 1.15).toFixed(2)} | T2: ₹${(s.target_2 || s.ltp * 1.30).toFixed(2)}`);
      lines.push("");
    }
  }

  lines.push("🔴 *PROFIT BOOKING RADAR (52-Week High)*");
  if (state.exitSignals.length === 0) {
    lines.push("• _No overextended 52-week high exit triggers detected in current scan._");
  } else {
    for (const s of state.exitSignals.slice(0, 4)) {
      lines.push(`• *${s.company_name || s.symbol} (${s.symbol}.NS)*`);
      lines.push(`  - *LTP:* ₹${(s.ltp || 0).toFixed(2)} | *52W High:* ₹${(s.week52_high || 0).toFixed(2)}`);
      lines.push(`  - *Signal:* RSI Divergence (${s.rsi_14 || '74.2'}) / Valuation Stretch`);
      lines.push(`  - *Action:* Lock ${s.sell_pct || 50}% profits | Revise Trailing SL to ₹${(s.trailing_sl || s.ltp * 0.95).toFixed(2)}.`);
      lines.push("");
    }
  }

  lines.push("⚠️ *Risk Advisory:* Maintain 2-3% max risk per trade. Not financial advice.");
  box.textContent = lines.join("\n");
}

// -------------------------------------------------------------------
// Charting Studio with Chart.js
// -------------------------------------------------------------------
async function loadChartData(symbol, range = "1y") {
  try {
    const res = await fetch(`/api/chart/${encodeURIComponent(symbol)}?range=${range}`);
    const json = await res.json();
    if (json.status !== "success" || !json.series) return;

    const series = json.series;
    const meta = json.meta || {};

    // Update stock header in Chart tab
    const stockObj = state.universe.find(u => u.symbol === symbol);
    document.getElementById("chartStockName").textContent = stockObj ? stockObj.name : symbol;

    // Check if stock is in user's personal RisiAsset portfolio
    const userHolding = state.risiPortfolio?.holdings?.find(h => h.symbol === symbol);

    // Sidebar metrics
    const latest = series[series.length - 1] || {};
    const ltp = latest.close || meta.regularMarketPrice || 0;
    const low52 = meta.fiftyTwoWeekLow || Math.min(...series.map(s => s.low));
    const high52 = meta.fiftyTwoWeekHigh || Math.max(...series.map(s => s.high));

    document.getElementById("csLtp").textContent = formatINR(ltp);
    document.getElementById("cs52Range").textContent = `${formatINR(low52)} - ${formatINR(high52)}`;
    document.getElementById("csBuyMin").textContent = formatINR(ltp * 0.98);
    document.getElementById("csSL").textContent = formatINR(low52 * 0.97);
    document.getElementById("csT1").textContent = formatINR(ltp * 1.15);
    document.getElementById("csT2").textContent = formatINR(ltp * 1.30);

    // Build Chart.js Datasets
    const labels = series.map(s => s.date);
    const closePrices = series.map(s => s.close);
    const ema20 = series.map(s => s.ema20);
    const ema50 = series.map(s => s.ema50);
    const ema200 = series.map(s => s.ema200);
    const rsi14 = series.map(s => s.rsi14);

    const priceDatasets = [
      {
        label: "Close Price",
        data: closePrices,
        borderColor: "#10B981",
        backgroundColor: "rgba(16, 185, 129, 0.08)",
        borderWidth: 2,
        fill: true,
        tension: 0.1,
        pointRadius: 0
      },
      {
        label: "20 EMA",
        data: ema20,
        borderColor: "#60A5FA",
        borderWidth: 1.2,
        fill: false,
        pointRadius: 0
      },
      {
        label: "50 EMA",
        data: ema50,
        borderColor: "#F59E0B",
        borderWidth: 1.2,
        fill: false,
        pointRadius: 0
      },
      {
        label: "200 EMA",
        data: ema200,
        borderColor: "#EF4444",
        borderWidth: 1.5,
        fill: false,
        pointRadius: 0
      }
    ];

    // If user owns this stock, add their Average Buy Price line!
    if (userHolding) {
      priceDatasets.push({
        label: `My Buy Avg Price (₹${userHolding.avg_buy_price})`,
        data: new Array(labels.length).fill(userHolding.avg_buy_price),
        borderColor: "#F59E0B",
        borderWidth: 1.8,
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0
      });
    }

    // Render Price Chart
    const ctxPrice = document.getElementById("canvasPriceChart").getContext("2d");
    if (state.priceChartInstance) state.priceChartInstance.destroy();

    state.priceChartInstance = new Chart(ctxPrice, {
      type: "line",
      data: {
        labels,
        datasets: priceDatasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: userHolding ? true : false, labels: { color: "#9CA3AF", font: { family: "JetBrains Mono", size: 10 } } },
          tooltip: {
            backgroundColor: isLight ? "#FFFFFF" : "#121826",
            borderColor: isLight ? "#CBD5E1" : "#1F293D",
            borderWidth: 1,
            titleColor: isLight ? "#0F172A" : "#F3F4F6",
            bodyColor: isLight ? "#0F172A" : "#F3F4F6",
            titleFont: { family: "JetBrains Mono" },
            bodyFont: { family: "JetBrains Mono" },
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: isLight ? "rgba(203, 213, 225, 0.6)" : "rgba(31, 41, 61, 0.4)" },
            ticks: { color: isLight ? "#64748B" : "#6B7280", font: { family: "JetBrains Mono", size: 10 }, maxTicksLimit: 8 }
          },
          y: {
            position: "right",
            grid: { color: isLight ? "rgba(203, 213, 225, 0.6)" : "rgba(31, 41, 61, 0.4)" },
            ticks: {
              color: isLight ? "#64748B" : "#9CA3AF",
              font: { family: "JetBrains Mono", size: 10 },
              callback: (val) => `₹${val}`
            }
          }
        }
      }
    });

    // Render RSI(14) Chart
    const ctxRsi = document.getElementById("canvasRsiChart").getContext("2d");
    if (state.rsiChartInstance) state.rsiChartInstance.destroy();

    state.rsiChartInstance = new Chart(ctxRsi, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "RSI(14)",
            data: rsi14,
            borderColor: "#A855F7",
            backgroundColor: "rgba(168, 85, 247, 0.06)",
            borderWidth: 1.5,
            fill: true,
            pointRadius: 0,
            tension: 0.1
          },
          {
            label: "Overbought (70)",
            data: new Array(labels.length).fill(70),
            borderColor: "rgba(239, 68, 68, 0.5)",
            borderWidth: 1,
            borderDash: [4, 4],
            fill: false,
            pointRadius: 0
          },
          {
            label: "Oversold (30)",
            data: new Array(labels.length).fill(30),
            borderColor: "rgba(16, 185, 129, 0.5)",
            borderWidth: 1,
            borderDash: [4, 4],
            fill: false,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false },
          y: {
            position: "right",
            min: 10,
            max: 90,
            grid: { color: "rgba(31, 41, 61, 0.4)" },
            ticks: { color: "#6B7280", font: { family: "JetBrains Mono", size: 9 }, stepSize: 20 }
          }
        }
      }
    });

  } catch (e) {
    console.error("Error rendering charts:", e);
  }
}

// Global hook to jump from table to Chart tab
window.analyzeStock = function(symbol) {
  state.selectedChartSymbol = symbol;
  const select = document.getElementById("selectChartSymbol");
  if (select) select.value = symbol;

  // Switch to chart tab
  const chartTabBtn = document.querySelector('[data-tab="tab-charting"]');
  if (chartTabBtn) chartTabBtn.click();

  loadChartData(symbol, state.chartRange);
};

// -------------------------------------------------------------------
// Position Sizing & Risk Simulator Calculator
// -------------------------------------------------------------------
function updateSimulator() {
  const portCapital = parseFloat(document.getElementById("inputPortfolioSize")?.value || "1000000");
  const riskPct = parseFloat(document.getElementById("rangeRiskPct")?.value || "2.0");
  const entryPrice = parseFloat(document.getElementById("inputSimEntry")?.value || "1316.0");
  const slPrice = parseFloat(document.getElementById("inputSimSL")?.value || "1212.31");

  if (entryPrice <= 0 || slPrice <= 0 || slPrice >= entryPrice) return;

  const maxRiskRupees = portCapital * (riskPct / 100);
  const riskPerShare = entryPrice - slPrice;
  const shareQty = Math.floor(maxRiskRupees / riskPerShare);
  const capitalAllocation = shareQty * entryPrice;
  const capPct = ((capitalAllocation / portCapital) * 100).toFixed(1);

  const t1Price = +(entryPrice * 1.15).toFixed(2);
  const t2Price = +(entryPrice * 1.30).toFixed(2);

  const rewardPerShareT1 = t1Price - entryPrice;
  const rrRatio = (rewardPerShareT1 / riskPerShare).toFixed(1);

  const pnlSL = -(shareQty * riskPerShare);
  const pnlT1 = shareQty * (t1Price - entryPrice);
  const pnlT2 = shareQty * (t2Price - entryPrice);

  // Update UI Elements
  document.getElementById("simMaxRiskRupees").textContent = formatINR(maxRiskRupees);
  document.getElementById("simShareQuantity").textContent = `${shareQty.toLocaleString("en-IN")} Shares`;
  document.getElementById("simCapitalAllocation").textContent = `${formatINR(capitalAllocation)} Capital (${capPct}%)`;
  document.getElementById("simRRRatio").textContent = `1 : ${rrRatio}`;

  document.getElementById("scenSLPrice").textContent = formatINR(slPrice);
  document.getElementById("scenSLPnl").textContent = `-₹${Math.abs(pnlSL).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  document.getElementById("scenT1Price").textContent = formatINR(t1Price);
  document.getElementById("scenT1Pnl").textContent = `+₹${pnlT1.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  document.getElementById("scenT2Price").textContent = formatINR(t2Price);
  document.getElementById("scenT2Pnl").textContent = `+₹${pnlT2.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

// -------------------------------------------------------------------
// Trigger Live Market Scan
// -------------------------------------------------------------------
async function triggerLiveScan() {
  const btn = document.getElementById("btnTriggerScan");
  const icon = document.getElementById("scanIcon");

  btn.disabled = true;
  btn.classList.add("opacity-75");
  icon.classList.add("animate-spin");

  try {
    const res = await fetch("/api/scan", { method: "POST" });
    const json = await res.json();
    if (json.status === "success") {
      await refreshDashboardData();
    }
  } catch (e) {
    console.error("Scan trigger failed:", e);
  } finally {
    btn.disabled = false;
    btn.classList.remove("opacity-75");
    icon.classList.remove("animate-spin");
  }
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
function populateUniverseDropdowns() {
  const selChart = document.getElementById("selectChartSymbol");
  if (selChart) {
    selChart.innerHTML = state.universe.map(u => `
      <option value="${u.symbol}" ${u.symbol === state.selectedChartSymbol ? 'selected' : ''}>
        ${u.symbol} (${u.sector})
      </option>
    `).join("");
  }
}

function populateSimulatorDropdown() {
  const selSim = document.getElementById("selectSimStock");
  if (selSim && state.buySignals.length > 0) {
    selSim.innerHTML = state.buySignals.map((s, i) => `
      <option value="${s.symbol}" ${i === 0 ? 'selected' : ''}>
        ${s.symbol} - ${s.company_name || s.symbol} (LTP: ₹${s.ltp})
      </option>
    `).join("");

    // Set first item inputs
    const first = state.buySignals[0];
    document.getElementById("inputSimEntry").value = first.ltp;
    document.getElementById("inputSimSL").value = first.stop_loss || +(first.week52_low * 0.97).toFixed(2);
  }
}

function populateSectorFilters() {
  const sectors = [...new Set(state.universe.map(u => u.sector))].sort();
  const selBuys = document.getElementById("selectSectorBuys");
  const selExits = document.getElementById("selectSectorExits");

  const opts = `<option value="ALL">All Sectors</option>` + sectors.map(s => `<option value="${s}">${s}</option>`).join("");
  if (selBuys) selBuys.innerHTML = opts;
  if (selExits) selExits.innerHTML = opts;
}

function formatINR(val) {
  if (val === null || val === undefined || isNaN(val)) return "₹0.00";
  return `₹${Number(val).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function exportCSV(data, filename) {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(obj => headers.map(h => `"${obj[h] ?? ''}"`).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
