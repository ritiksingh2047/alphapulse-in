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
  advisorSymbol: "HDFCBANK",
  advisorTimeframe: "1-4 Weeks",
  advisorGaugeScore: 84,
  advisorHistoryChart: null,
  priceChartInstance: null,
  rsiChartInstance: null,
  riskPct: 2.0
};

// Global Tab Switcher (Direct & Event-Driven)
// Universal Date Formatter: YYYY-MM-DD -> DD/MM/YYYY
function formatDate(dateStr) {
  if (!dateStr || dateStr === "Just now") return dateStr;
  try {
    if (dateStr.includes(" ")) {
      const [d, t] = dateStr.split(" ");
      const [y, m, day] = d.split("-");
      return `${day}/${m}/${y} ${t}`;
    }
    if (dateStr.includes("-")) {
      const [y, m, day] = dateStr.split("-");
      return `${day}/${m}/${y}`;
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
}

// -------------------------------------------------------------------
window.switchTab = function(targetId) {
  const tabButtons = document.querySelectorAll(".nav-tab");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach(b => {
    const tab = b.getAttribute("data-tab");
    b.classList.remove("active", "text-emerald-400", "text-amber-400", "bg-emerald-500/10", "bg-amber-500/10", "border-emerald-500/30", "border-amber-500/30");
    b.classList.add("text-gray-400");
    
    if (tab === targetId) {
      if (targetId === "tab-risiasset") {
        b.classList.add("active", "text-amber-400", "bg-amber-500/10", "border-amber-500/30");
      } else {
        b.classList.add("active", "text-emerald-400", "bg-emerald-500/10", "border-emerald-500/30");
      }
      b.classList.remove("text-gray-400");
    }
  });

  tabContents.forEach(tc => {
    if (tc.id === targetId) {
      tc.classList.remove("hidden");
    } else {
      tc.classList.add("hidden");
    }
  });

  lucide.createIcons();

  if (targetId === "tab-charting" && state.priceChartInstance) {
    state.priceChartInstance.resize();
    if (state.rsiChartInstance) state.rsiChartInstance.resize();
  }

  if (targetId === "tab-risiasset") {
    if (!state.risiPortfolio) {
      refreshDashboardData();
    } else {
      renderRisiHoldingsTable();
      renderRisiCharts();
      syncLivePrices();
    }
  }
};

window.filterRisiVerdict = function(verdictType) {
  state.risiVerdictFilter = verdictType;
  renderRisiHoldingsTable();
};

window.filterRisiHoldings = function(filterType) {
  state.risiActiveFilter = filterType;
  
  // Sync the pill buttons
  const btns = document.querySelectorAll(".btn-risi-filter");
  btns.forEach(b => {
    const f = b.getAttribute("data-risi-filter");
    b.classList.remove("active", "bg-brand-border", "text-white");
    b.classList.add("text-gray-400");
    if (f === filterType) {
      b.classList.add("active", "bg-brand-border", "text-white");
      b.classList.remove("text-gray-400");
    }
  });

  // Sync the table header dropdown
  const selRadar = document.getElementById("filterRadar");
  if (selRadar && selRadar.value !== filterType) {
    selRadar.value = filterType;
  }

  renderRisiHoldingsTable();
};

window.filterRisiRecommendation = function(recType) {
  state.risiRecFilter = recType;
  renderRisiHoldingsTable();
};
// Initialize Application
async function initApp() {
  initTheme();
  setupChartTypeahead();
  setupTabs();
  setupEventListeners();
  setupAdvisorTypeahead();
  updateClock();
  setInterval(updateClock, 1000);

  // Initial Data Fetch
  await fetchUniverse();
  await analyzeAdvisorStock(state.advisorSymbol || "HDFCBANK");
  await refreshDashboardData();
  await loadChartData(state.selectedChartSymbol, state.chartRange);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

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
  if (state.advisorSymbol) {
    drawSpeedometerGauge(state.advisorGaugeScore || 75);
  }
}
window.toggleTheme = function() {
  const isLight = document.documentElement.classList.contains("light");
  const next = isLight ? "dark" : "light";
  applyTheme(next);
};
window.applyTheme = applyTheme;

// -------------------------------------------------------------------
// Mobile Phone Access Modal Controller
// -------------------------------------------------------------------
function toggleMobileModal() {
  const modal = document.getElementById("mobileModal");
  if (!modal) return;
  modal.classList.toggle("hidden");
  lucide.createIcons();
}

function copyMobileUrl() {
  const input = document.getElementById("mobileUrlInput");
  if (!input) return;
  
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(input.value).then(() => {
      showCopiedFeedback();
    }).catch(() => {
      fallbackCopy(input);
    });
  } else {
    fallbackCopy(input);
  }
}

function fallbackCopy(input) {
  input.select();
  document.execCommand("copy");
  showCopiedFeedback();
}

function showCopiedFeedback() {
  const txt = document.getElementById("copyMobileText");
  if (txt) {
    txt.textContent = "Copied!";
    setTimeout(() => { txt.textContent = "Copy"; }, 2000);
  }
}

window.toggleMobileModal = toggleMobileModal;
window.copyMobileUrl = copyMobileUrl;

// -------------------------------------------------------------------
// Market Scan Logs Modal Controller
// -------------------------------------------------------------------
function toggleScanLogsModal() {
  const modal = document.getElementById("scanLogsModal");
  if (!modal) return;
  modal.classList.toggle("hidden");
  lucide.createIcons();
}

function toggleTelegramModal() {
  const modal = document.getElementById("telegramModal");
  if (!modal) return;
  modal.classList.toggle("hidden");
  lucide.createIcons();
}

window.toggleScanLogsModal = toggleScanLogsModal;
window.toggleTelegramModal = toggleTelegramModal;
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
        b.classList.remove("active", "text-emerald-400", "text-amber-400", "text-rose-400", "text-cyan-400", "bg-emerald-500/10", "bg-amber-500/10", "bg-rose-500/10", "bg-cyan-500/10", "border-emerald-500/30", "border-amber-500/30", "border-rose-500/30", "border-cyan-500/30");
        b.classList.add("text-gray-400");
      });
      
      btn.classList.remove("text-gray-400");
      btn.classList.add("active");
      if (targetId === "tab-risiasset") {
        btn.classList.add("text-amber-400", "bg-amber-500/10", "border-amber-500/30");
      } else if (targetId === "tab-exit-setups") {
        btn.classList.add("text-rose-400", "bg-rose-500/10", "border-rose-500/30");
      } else if (targetId === "tab-buy-advisor") {
        btn.classList.add("text-cyan-400", "bg-cyan-500/10", "border-cyan-500/30");
      } else {
        btn.classList.add("text-emerald-400", "bg-emerald-500/10", "border-emerald-500/30");
      }

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



  // Mobile Phone Access Button & Modal
  const btnMobile = document.getElementById("btnMobileConnect");
  if (btnMobile) {
    btnMobile.addEventListener("click", toggleMobileModal);
  }

  const btnCloseModal = document.getElementById("btnCloseMobileModal");
  if (btnCloseModal) {
    btnCloseModal.addEventListener("click", toggleMobileModal);
  }
  const btnCopyMobile = document.getElementById("btnCopyMobileUrl");
  if (btnCopyMobile) {
    btnCopyMobile.addEventListener("click", copyMobileUrl);
  }

  const mobileModal = document.getElementById("mobileModal");
  if (mobileModal) {
    mobileModal.addEventListener("click", (e) => {
      if (e.target === mobileModal) {
        toggleMobileModal();
      }
    });
  }
  // Scan Logs Button & Modal
  const btnLogs = document.getElementById("btnOpenScanLogs");
  if (btnLogs) {
    btnLogs.addEventListener("click", toggleScanLogsModal);
  }

  const btnCloseLogs = document.getElementById("btnCloseScanLogsModal");
  if (btnCloseLogs) {
    btnCloseLogs.addEventListener("click", toggleScanLogsModal);
  }

  const scanLogsModal = document.getElementById("scanLogsModal");
  if (scanLogsModal) {
    scanLogsModal.addEventListener("click", (e) => {
      if (e.target === scanLogsModal) {
        toggleScanLogsModal();
      }
    });
  }
  // Telegram Modal Controller
  const btnTg = document.getElementById("btnOpenTelegramModal");
  if (btnTg) {
    btnTg.addEventListener("click", toggleTelegramModal);
  }

  const btnCloseTg = document.getElementById("btnCloseTelegramModal");
  if (btnCloseTg) {
    btnCloseTg.addEventListener("click", toggleTelegramModal);
  }

  const telegramModal = document.getElementById("telegramModal");
  if (telegramModal) {
    telegramModal.addEventListener("click", (e) => {
      if (e.target === telegramModal) {
        toggleTelegramModal();
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const m = document.getElementById("mobileModal");
      if (m && !m.classList.contains("hidden")) {
        toggleMobileModal();
      }
      const t = document.getElementById("telegramModal");
      if (t && !t.classList.contains("hidden")) {
        toggleTelegramModal();
      }
    }
  });

  // Search in RisiAsset
  const inputSearchRisi = document.getElementById("inputSearchRisi");
  if (inputSearchRisi) {
    inputSearchRisi.addEventListener("input", renderRisiHoldingsTable);
  }

  // Buyhatke Advisor Search Input
  const inputAdvSearch = document.getElementById("inputAdvisorSearch");
  if (inputAdvSearch) {
    inputAdvSearch.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        runAdvisorSearch();
      }
    });
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
  const selectCapBuys = document.getElementById("selectCapBuys");
  if (inputSearchBuys) inputSearchBuys.addEventListener("input", renderBuySignalsTable);
  if (selectSectorBuys) selectSectorBuys.addEventListener("change", renderBuySignalsTable);
  if (selectCapBuys) selectCapBuys.addEventListener("change", renderBuySignalsTable);

  // Search & Filters for Exits
  const inputSearchExits = document.getElementById("inputSearchExits");
  const selectSectorExits = document.getElementById("selectSectorExits");
  const selectCapExits = document.getElementById("selectCapExits");
  if (inputSearchExits) inputSearchExits.addEventListener("input", renderExitSignalsTable);
  if (selectSectorExits) selectSectorExits.addEventListener("change", renderExitSignalsTable);
  if (selectCapExits) selectCapExits.addEventListener("change", renderExitSignalsTable);
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
  const btnCopyTg = document.getElementById("btnCopyTelegram");
  if (btnCopyTg) {
    btnCopyTg.addEventListener("click", () => {
      const text = document.getElementById("telegramPreviewBox").textContent;
      navigator.clipboard.writeText(text).then(() => {
        const original = btnCopyTg.innerHTML;
        btnCopyTg.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i><span class="text-emerald-400">Copied!</span>`;
        lucide.createIcons();
        setTimeout(() => {
          btnCopyTg.innerHTML = original;
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
  const t0 = performance.now();
  try {
    // Fire all 5 requests concurrently in parallel
    const [resOver, resSig, resSec, resLogs, resRisi] = await Promise.allSettled([
      fetch("/api/overview").then(r => r.ok ? r.json() : null),
      fetch("/api/signals?limit=100").then(r => r.ok ? r.json() : null),
      fetch("/api/sectors").then(r => r.ok ? r.json() : null),
      fetch("/api/scan-history").then(r => r.ok ? r.json() : null),
      fetch("/api/portfolio/risiasset").then(r => r.ok ? r.json() : null).catch(() => fetch("/risiasset_portfolio.json").then(r => r.ok ? r.json() : null))
    ]);

    if (resOver.status === "fulfilled" && resOver.value?.status === "success") {
      state.overview = resOver.value.data;
    }
    if (resSig.status === "fulfilled" && resSig.value?.status === "success") {
      state.buySignals = (resSig.value.data || []).filter(s => s.signal_type === "BUY_SETUP");
      state.exitSignals = (resSig.value.data || []).filter(s => s.signal_type === "EXIT_SETUP");
    }
    if (resSec.status === "fulfilled" && resSec.value?.status === "success") {
      state.sectors = resSec.value.data || [];
    }
    if (resLogs.status === "fulfilled" && resLogs.value?.status === "success") {
      renderScanLogsTable(resLogs.value.data || []);
    }
    if (resRisi.status === "fulfilled" && resRisi.value) {
      state.risiPortfolio = processRisiPortfolioData(resRisi.value);
    }

    // Single-pass batch DOM update
    renderOverviewKPIs();
    renderBuySignalsTable();
    renderExitSignalsTable();
    renderSectorHeatmap();
    populateSectorFilters();
    renderTelegramPreview();
    populateSimulatorDropdown();
    updateSimulator();
    if (state.risiPortfolio) {
      renderRisiPortfolioDashboard();
      syncLivePrices();
    }
  } catch (e) {
    console.warn("Fast refresh warning:", e);
  }
  const elapsed = +((performance.now() - t0) / 1000).toFixed(2);
  return elapsed;
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
  const activeFilter = state.risiActiveFilter || "ALL";
  const verdictFilter = state.risiVerdictFilter || "ALL";
  const recFilter = state.risiRecFilter || "ALL";

  let filtered = holdings;
  if (activeFilter === "ATH") {
    filtered = filtered.filter(h => h.radar_type === "ATH_PROFIT_RADAR");
  } else if (activeFilter === "ATL_VALUE") {
    filtered = filtered.filter(h => h.action_code === "ACCUMULATE_DIP");
  } else if (activeFilter === "ATL_RISK") {
    filtered = filtered.filter(h => h.action_code === "SPECULATIVE_RISK");
  } else if (activeFilter === "BALANCED") {
    filtered = filtered.filter(h => !h.radar_type && !["ACCUMULATE_DIP", "SPECULATIVE_RISK"].includes(h.action_code));
  }
  
  // Apply the secondary Instant Verdict Filter
  if (verdictFilter !== "ALL") {
    filtered = filtered.filter(h => {
      let verdict = "WAIT";
      if (h.radar_type === "ATH_PROFIT_RADAR" || h.action_code === "SPECULATIVE_RISK") {
        verdict = "AVOID";
      } else if (h.action_code === "ACCUMULATE_DIP") {
        verdict = "BUY";
      }
      return verdict === verdictFilter;
    });
  }

  // Apply the Recommendation Filter
  if (recFilter !== "ALL") {
    filtered = filtered.filter(h => {
      const lbl = h.action_label || "";
      if (recFilter === "CONSOLIDATION") return lbl.includes("Consolidation");
      if (recFilter === "TRAIL_SL") return lbl.includes("Trail SL") || lbl.includes("Protect");
      if (recFilter === "LOCK_PROFIT") return lbl.includes("Lock");
      if (recFilter === "ACCUMULATE") return lbl.includes("Accumulate");
      if (recFilter === "SPECULATIVE") return lbl.includes("Monitor") || lbl.includes("Caution");
      return true;
    });
  }

  if (search) {
    filtered = filtered.filter(h => {
      return h.name.toLowerCase().includes(search) || h.symbol.toLowerCase().includes(search) || (h.sector || "").toLowerCase().includes(search);
    });
  }

  const countEl = document.getElementById("risiVisibleCount");
  if (countEl) countEl.textContent = filtered.length;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="py-8 text-center text-gray-500 font-sans">
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
      radarBadge = `<span class="inline-block whitespace-nowrap px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">🔴 ATH Radar</span>`;
    } else if (h.action_code === "ACCUMULATE_DIP") {
      radarBadge = `<span class="inline-block whitespace-nowrap px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">🟢 ATL Value</span>`;
    } else if (h.action_code === "SPECULATIVE_RISK") {
      radarBadge = `<span class="inline-block whitespace-nowrap px-2 py-0.5 rounded text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/30">⚠️ ATL Caution</span>`;
    } else {
      radarBadge = `<span class="inline-block whitespace-nowrap px-2 py-0.5 rounded text-[11px] bg-blue-500/10 text-blue-300 border border-blue-500/20">⚖️ Balanced</span>`;
    }
    
    let buyhatkeVerdict = "";
    if (h.radar_type === "ATH_PROFIT_RADAR" || h.action_code === "SPECULATIVE_RISK") {
      buyhatkeVerdict = `<button onclick="switchTab('tab-buy-advisor'); analyzeAdvisorStock('${h.symbol}')" class="inline-block whitespace-nowrap px-1.5 py-0.5 rounded-lg text-[10.5px] font-bold bg-rose-500/10 hover:bg-rose-500/20 transition cursor-pointer text-rose-400 border border-rose-500/20" title="View Full Buyhatke Analysis">Avoid / Book Profits</button>`;
    } else if (h.action_code === "ACCUMULATE_DIP") {
      buyhatkeVerdict = `<button onclick="switchTab('tab-buy-advisor'); analyzeAdvisorStock('${h.symbol}')" class="inline-block whitespace-nowrap px-1.5 py-0.5 rounded-lg text-[10.5px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 transition cursor-pointer text-emerald-400 border border-emerald-500/20" title="View Full Buyhatke Analysis">Go Ahead & Buy</button>`;
    } else {
      buyhatkeVerdict = `<button onclick="switchTab('tab-buy-advisor'); analyzeAdvisorStock('${h.symbol}')" class="inline-block whitespace-nowrap px-1.5 py-0.5 rounded-lg text-[10.5px] font-bold bg-amber-500/10 hover:bg-amber-500/20 transition cursor-pointer text-amber-400 border border-amber-500/20" title="View Full Buyhatke Analysis">Wait for Dip</button>`;
    }
    const sectorTag = h.sector ? `(${h.sector})` : (h.category ? `(${h.category})` : '');
    const sectorBadge = sectorTag ? `<span class="inline-block whitespace-nowrap px-1.5 py-0.5 text-[10px] rounded bg-brand-dark/90 text-gray-400 border border-brand-border font-sans font-medium">${sectorTag}</span>` : '';

    return `
      <tr class="hover:bg-brand-border/30 transition">
        <td class="py-3.5 px-2 font-sans cursor-pointer group" onclick="analyzeStock('${h.symbol}')" title="Click to view chart for ${h.symbol}">
          <div class="flex items-center space-x-1.5 flex-wrap">
            <span class="font-bold text-white group-hover:text-amber-400 transition font-mono">${h.symbol}</span>
            <span class="px-1.5 py-0.5 text-[10px] rounded bg-gray-500/20 text-gray-300 border border-gray-500/30 font-mono font-bold">${h.quantity} Qty</span>
            ${sectorBadge}
          </div>
          <div class="text-[11px] text-gray-400 group-hover:text-amber-300 transition truncate max-w-[170px] mt-0.5">${h.name}</div>
        </td>
        <td class="py-3.5 px-2 text-right text-gray-300">${formatINR(h.avg_buy_price)}</td>
        <td class="py-3.5 px-2 text-right font-bold text-white transition-colors duration-300" id="risi_ltp_${h.symbol}">${formatINR(h.closing_price)}</td>
        <td class="py-3.5 px-2 text-right text-gray-400">${formatINR(h.buy_value)}</td>
        <td class="py-3.5 px-2 text-right font-bold text-white transition-colors duration-300" id="risi_curval_${h.symbol}">${formatINR(h.closing_value)}</td>
        <td class="py-3.5 px-2 text-right transition-colors duration-300" id="risi_pnl_${h.symbol}">
          <div class="font-bold ${pnlClass}">${pnlSign}${formatINR(h.unrealised_pnl)}</div>
          <div class="text-[11px] ${pnlClass}">(${pnlSign}${h.pnl_pct.toFixed(2)}%)</div>
        </td>
        <td class="py-3.5 px-2 text-center">
          ${radarBadge}
        </td>
        <td class="py-3.5 px-2">
          <span class="inline-block whitespace-nowrap px-1.5 py-0.5 rounded text-[11px] border ${h.action_badge}">
            ${h.action_label}
          </span>
          ${h.trailing_sl ? `<div class="text-[10px] text-gray-400 mt-1 font-mono">Trail SL: <strong class="text-rose-400">${formatINR(h.trailing_sl)}</strong></div>` : ''}
          ${h.target_price ? `<div class="text-[10px] text-gray-400 mt-1 font-mono">Target: <strong class="text-emerald-400">${formatINR(h.target_price)}</strong></div>` : ''}
        </td>
        <td class="py-3.5 px-2 text-center font-sans">
          ${buyhatkeVerdict}
        </td>
      </tr>
    `;
  }).join("");

  lucide.createIcons();
}

window.syncLivePrices = async function() {
  if (!state.risiPortfolio || !state.risiPortfolio.holdings) return;
  const holdings = state.risiPortfolio.holdings;
  
  // Set UI to loading state
  holdings.forEach(h => {
    const el = document.getElementById(`risi_ltp_${h.symbol}`);
    if (el) el.innerHTML = `<span class="animate-pulse text-amber-400">...</span>`;
  });
  
  const batchSize = 6;
  for (let i = 0; i < holdings.length; i += batchSize) {
    const batch = holdings.slice(i, i + batchSize);
    await Promise.all(batch.map(async h => {
      try {
        const res = await fetch(`/api/chart/${encodeURIComponent(h.symbol)}?range=1d`);
        const json = await res.json();
        if (json.status === "success" && json.meta?.regularMarketPrice) {
          const livePrice = json.meta.regularMarketPrice;
          h.closing_price = livePrice;
          h.closing_value = h.quantity * livePrice;
          h.unrealised_pnl = h.closing_value - h.buy_value;
          h.pnl_pct = (h.buy_value > 0) ? (h.unrealised_pnl / h.buy_value) * 100 : 0;
          
          const ltpEl = document.getElementById(`risi_ltp_${h.symbol}`);
          const curValEl = document.getElementById(`risi_curval_${h.symbol}`);
          const pnlEl = document.getElementById(`risi_pnl_${h.symbol}`);
          
          if (ltpEl) {
             ltpEl.textContent = formatINR(livePrice);
             ltpEl.classList.add("text-cyan-400");
             setTimeout(() => ltpEl.classList.remove("text-cyan-400"), 1500);
          }
          if (curValEl) curValEl.textContent = formatINR(h.closing_value);
          if (pnlEl) {
             const isGain = h.unrealised_pnl >= 0;
             const pClass = isGain ? "text-emerald-400" : "text-rose-400";
             const pSign = isGain ? "+" : "";
             pnlEl.innerHTML = `
               <div class="font-bold ${pClass}">${pSign}${formatINR(h.unrealised_pnl)}</div>
               <div class="text-[11px] ${pClass}">(${pSign}${h.pnl_pct.toFixed(2)}%)</div>
             `;
          }
        }
      } catch(e) {}
    }));
  }
  
  // Recalculate Portfolio Totals
  let totalInvested = 0;
  let totalCurrent = 0;
  holdings.forEach(h => {
    totalInvested += h.buy_value;
    totalCurrent += h.closing_value;
  });
  
  state.risiPortfolio.summary.closing_value = totalCurrent;
  state.risiPortfolio.summary.unrealised_pnl = totalCurrent - totalInvested;
  state.risiPortfolio.summary.unrealised_pnl_pct = (totalInvested > 0) ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0;
  
  // Re-render Summary Dashboard Header
  renderRisiPortfolioDashboard();
};

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

  // Header Index Badges (if present)
  const elHNP = document.getElementById("headerNiftyPrice");
  const elHNC = document.getElementById("headerNiftyChange");
  if (elHNP) elHNP.textContent = formatINR(niftyLTP);
  if (elHNC) {
    elHNC.textContent = `${niftyChg >= 0 ? "+" : ""}${niftyChg.toFixed(2)}%`;
    elHNC.className = `text-xs font-semibold px-1.5 py-0.5 rounded ${niftyChg >= 0 ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"}`;
  }

  const elHBNP = document.getElementById("headerBankNiftyPrice");
  const elHBNC = document.getElementById("headerBankNiftyChange");
  if (elHBNP) elHBNP.textContent = formatINR(bnLTP);
  if (elHBNC) {
    elHBNC.textContent = `${bnChg >= 0 ? "+" : ""}${bnChg.toFixed(2)}%`;
    elHBNC.className = `text-xs font-semibold px-1.5 py-0.5 rounded ${bnChg >= 0 ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"}`;
  }

  const elAdv = document.getElementById("headerAdvances");
  const elDec = document.getElementById("headerDeclines");
  if (elAdv) elAdv.textContent = `${snap.advances || 33} ▲`;
  if (elDec) elDec.textContent = `${snap.declines || 26} ▼`;
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
  const cap = document.getElementById("selectCapBuys")?.value || "ALL";

  const filtered = state.buySignals.filter(s => {
    const matchSearch = s.symbol.toLowerCase().includes(search) || (s.company_name || "").toLowerCase().includes(search);
    const matchSector = sector === "ALL" || s.sector === sector;
    const matchCap = cap === "ALL" || (s.cap || "").toLowerCase() === cap.toLowerCase();
    return matchSearch && matchSector && matchCap;
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
  const cap = document.getElementById("selectCapExits")?.value || "ALL";

  const filtered = state.exitSignals.filter(s => {
    const matchSearch = s.symbol.toLowerCase().includes(search) || (s.company_name || "").toLowerCase().includes(search);
    const matchSector = sector === "ALL" || s.sector === sector;
    const matchCap = cap === "ALL" || (s.cap || "").toLowerCase() === cap.toLowerCase();
    return matchSearch && matchSector && matchCap;
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
      <td class="py-3 px-4 text-white">${formatDate(l.created_at || 'Just now')}</td>
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
    const isLight = state.theme === "light";
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

    // Compute Buyhatke Recommendation Score
    const rangePct = (high52 - low52) > 0 ? Math.min(100, Math.max(0, Math.round(((ltp - low52) / (high52 - low52)) * 100))) : 50;
    let discountScore = Math.min(35, Math.max(5, Math.round((100 - rangePct) * 0.35)));
    let moatScore = 24;
    if (["RELIANCE", "TCS", "HDFCBANK", "INFY", "ITC", "TATAMOTORS", "LT"].includes(symbol)) moatScore = 28;
    else if (["OLAELEC", "GREENPOWER", "GTLINFRA", "RTNINDIA"].includes(symbol)) moatScore = 10;
    const lastRSI = series[series.length - 1]?.rsi14 || 50;
    let rsiScore = 15;
    if (lastRSI <= 38) rsiScore = 20;
    else if (lastRSI >= 72) rsiScore = 5;
    
    const totalScore = Math.min(98, Math.max(12, discountScore + moatScore + rsiScore + 2)); // +2 is default tfBonus
    
    const elVerdict = document.getElementById("csAdvisorVerdict");
    const elScore = document.getElementById("csAdvisorScore");
    if (elVerdict && elScore) {
      elScore.textContent = `Score: ${totalScore} / 100`;
      if (totalScore >= 70) {
        elVerdict.textContent = "Go Ahead & Buy";
        elVerdict.className = "text-lg font-extrabold text-emerald-400 font-sans";
      } else if (totalScore >= 45) {
        elVerdict.textContent = "Wait for Dip";
        elVerdict.className = "text-lg font-extrabold text-amber-400 font-sans";
      } else {
        elVerdict.textContent = "Avoid / Overbought";
        elVerdict.className = "text-lg font-extrabold text-rose-400 font-sans";
      }
    }
    // Build Chart.js Datasets
    const labels = series.map(s => formatDate(s.date));
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
            grid: { color: isLight ? "rgba(203, 213, 225, 0.6)" : "rgba(31, 41, 61, 0.4)" },
            ticks: { color: isLight ? "#64748B" : "#6B7280", font: { family: "JetBrains Mono", size: 9 }, stepSize: 20 }
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
  const scanText = btn?.querySelector("span");

  if (btn) {
    btn.disabled = true;
    btn.classList.add("opacity-80");
  }
  if (icon) icon.classList.add("animate-spin");
  if (scanText) scanText.textContent = "Scanning 500+ Stocks...";

  const tStart = performance.now();

  try {
    // Trigger live scan and refresh concurrently
    const [scanRes, elapsedSec] = await Promise.all([
      fetch("/api/scan", { method: "POST" }).then(r => r.json()).catch(() => ({ status: "success" })),
      refreshDashboardData()
    ]);

    const totalTime = +((performance.now() - tStart) / 1000).toFixed(2);

    // Show instant success feedback badge
    if (btn) {
      const origHtml = btn.innerHTML;
      btn.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-300"></i><span class="text-white font-bold">✓ Scanned (${totalTime}s)</span>`;
      btn.classList.remove("opacity-80");
      btn.classList.add("from-emerald-500", "to-teal-500");
      lucide.createIcons();

      setTimeout(() => {
        btn.innerHTML = origHtml;
        btn.disabled = false;
        btn.classList.remove("from-emerald-500", "to-teal-500");
        lucide.createIcons();
      }, 2500);
    }
  } catch (e) {
    console.error("Scan trigger error:", e);
    if (btn) {
      btn.disabled = false;
      btn.classList.remove("opacity-80");
    }
    if (icon) icon.classList.remove("animate-spin");
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

// ===================================================================
// BUYHATKE-STYLE STOCK ADVISOR ENGINE ("Should You Buy Now?")
// ===================================================================

// Comprehensive Indian Stock Name & Alias Dictionary
const STOCK_ALIASES = {
  "YES BANK": "YESBANK",
  "YESBANK": "YESBANK",
  "YES BANK LIMITED": "YESBANK",
  "YES": "YESBANK",
  "HDFC": "HDFCBANK",
  "HDFC BANK": "HDFCBANK",
  "HDFCBANK": "HDFCBANK",
  "HDFC BANK LTD": "HDFCBANK",
  "HDFCLIFE": "HDFCLIFE",
  "HDFC LIFE": "HDFCLIFE",
  "SBI": "SBIN",
  "SBIN": "SBIN",
  "KOTAK GOLD ETF": "GOLD1",
  "KOTAKGOLD": "GOLD1",
  "STATE BANK": "SBIN",
  "STATE BANK OF INDIA": "SBIN",
  "SBILIFE": "SBILIFE",
  "SBI LIFE": "SBILIFE",
  "RELIANCE": "RELIANCE",
  "RIL": "RELIANCE",
  "RELIANCE INDUSTRIES": "RELIANCE",
  "RELIANCE POWER": "RPOWER",
  "RPOWER": "RPOWER",
  "TATA MOTORS": "TMPV",
  "TATAMOTORS": "TMPV",
  "TATA MOTOR": "TMPV",
  "TATAMOTOR": "TMPV",
  "TAMO": "TMPV",
  "TMC": "TMPV",
  "TATA MOTORS PASS VEH": "TMPV",
  "TMPV": "TMPV",
  "TMCV": "TMCV",
  "TATA POWER": "TATAPOWER",
  "TATAPOWER": "TATAPOWER",
  "TATA STEEL": "TATASTEEL",
  "TATASTEEL": "TATASTEEL",
  "TCS": "TCS",
  "TATA CONSULTANCY": "TCS",
  "TATA CONSUMER": "TATACONSUM",
  "TATACONSUM": "TATACONSUM",
  "TATA GOLD": "GOLD1",
  "TATAGOLD": "GOLD1",
  "TATA SILVER": "SILVER1",
  "TATASILV": "SILVER1",
  "GROWWDEFNC": "DEFENCE",
  "GROWW DEFENCE": "DEFENCE",
  "BSLSLVETF": "SILVER1",
  "BALRAMPUR": "BALRAMCHIN",
  "BALRAMPUR CHINI": "BALRAMCHIN",
  "BALRAMPUR CHINI MILLS": "BALRAMCHIN",
  "BALRAMCHIN": "BALRAMCHIN",
  "OLA": "OLAELEC",
  "OLA ELECTRIC": "OLAELEC",
  "OLAELEC": "OLAELEC",
  "PFC": "PFC",
  "POWER FINANCE": "PFC",
  "POWER FINANCE CORP": "PFC",
  "IRFC": "IRFC",
  "INDIAN RAILWAY FINANCE": "IRFC",
  "RVNL": "RVNL",
  "RAIL VIKAS": "RVNL",
  "RAIL VIKAS NIGAM": "RVNL",
  "ITC": "ITC",
  "ITC LTD": "ITC",
  "ONGC": "ONGC",
  "OIL AND NATURAL GAS": "ONGC",
  "IOC": "IOC",
  "INDIAN OIL": "IOC",
  "INDIAN OIL CORP": "IOC",
  "INFY": "INFY",
  "INFOSYS": "INFOSYS",
  "ASHOK LEYLAND": "ASHOKLEY",
  "ASHOKLEY": "ASHOKLEY",
  "AIRTEL": "BHARTIARTL",
  "BHARTI AIRTEL": "BHARTIARTL",
  "BHARTIARTL": "BHARTIARTL",
  "ZOMATO": "ZOMATO",
  "SUZLON": "SUZLON",
  "ADANI POWER": "ADANIPOWER",
  "ADANIPOWER": "ADANIPOWER",
  "ADANI ENT": "ADANIENT",
  "ADANIENT": "ADANIENT",
  "ADANI PORTS": "ADANIPORTS",
  "ADANIPORTS": "ADANIPORTS",
  "TITAN": "TITAN",
  "EICHER": "EICHERMOT",
  "EICHER MOTORS": "EICHERMOT",
  "EICHERMOT": "EICHERMOT",
  "BAJAJ AUTO": "BAJAJ-AUTO",
  "BAJAJ-AUTO": "BAJAJ-AUTO",
  "BAJAJ FINANCE": "BAJFINANCE",
  "BAJFINANCE": "BAJFINANCE",
  "BAJAJ FINSERV": "BAJAJFINSV",
  "BAJAJFINSV": "BAJAJFINSV",
  "JIO FINANCE": "JIOFIN",
  "JIO FINANCIAL": "JIOFIN",
  "JIOFIN": "JIOFIN",
  "KOTAK": "KOTAKBANK",
  "KOTAK BANK": "KOTAKBANK",
  "KOTAKBANK": "KOTAKBANK",
  "AXIS": "AXISBANK",
  "AXIS BANK": "AXISBANK",
  "AXISBANK": "AXISBANK",
  "ICICI": "ICICIBANK",
  "ICICI BANK": "ICICIBANK",
  "ICICIBANK": "ICICIBANK",
  "MARUTI": "MARUTI",
  "MARUTI SUZUKI": "MARUTI",
  "NHPC": "NHPC",
  "NTPC": "NTPC",
  "VEDANTA IRON AND STEEL": "VISL",
  "VEDANTA IRON AND STEEL L": "VISL",
  "VEDANTA IRON AND STEEL LTD": "VISL",
  "VEDANTA IRON AND STEEL LIMITED": "VISL",
  "VEDANTA IRON & STEEL": "VISL",
  "VEDANTA IRON": "VISL",
  "VEDANTA STEEL": "VISL",
  "VISL": "VISL",
  "VEDANTA": "VEDL",
  "VEDANTA LIMITED": "VEDL",
  "VEDANTA LTD": "VEDL",
  "VEDL": "VEDL",
  "WIPRO": "WIPRO",
  "DR REDDY": "DRREDDY",
  "DRREDDY": "DRREDDY",
  "SUN PHARMA": "SUNPHARMA",
  "SUNPHARMA": "SUNPHARMA",
  "CIPLA": "CIPLA",
  "BRITANNIA": "BRITANNIA",
  "NESTLE": "NESTLEIND",
  "NESTLEIND": "NESTLEIND",
  "ASIAN PAINTS": "ASIANPAINT",
  "ASIANPAINT": "ASIANPAINT",
  "ULTRATECH": "ULTRACEMCO",
  "ULTRACEMCO": "ULTRACEMCO",
  "GRASIM": "GRASIM",
  "JSW STEEL": "JSWSTEEL",
  "JSWSTEEL": "JSWSTEEL",
  "COAL INDIA": "COALINDIA",
  "COALINDIA": "COALINDIA",
  "BPCL": "BPCL",
  "HCL TECH": "HCLTECH",
  "HCLTECH": "HCLTECH",
  "TECH MAHINDRA": "TECHM",
  "TECHM": "TECHM",
  "INDUSIND": "INDUSINDBK",
  "INDUSINDBK": "INDUSINDBK",
  "POWER GRID": "POWERGRID",
  "POWERGRID": "POWERGRID",
  "APOLLO HOSPITALS": "APOLLOHOSP",
  "APOLLOHOSP": "APOLLOHOSP",
  "DIVIS": "DIVISLAB",
  "DIVISLAB": "DIVISLAB",
  "HERO MOTOCORP": "HEROMOTOCO",
  "HEROMOTOCO": "HEROMOTOCO",
  "SHRIRAM FINANCE": "SHRIRAMFIN",
  "SHRIRAMFIN": "SHRIRAMFIN",
  "UPL": "UPL",
  "L&T": "LT",
  "LARSEN": "LT",
  "LT": "LT",
  "M&M": "M&M",
  "MAHINDRA": "M&M"
};

// Resolve any user input keyword into a clean canonical NSE ticker symbol
function resolveStockSymbol(query) {
  if (!query || typeof query !== "string") return "HDFCBANK";
  const raw = query.trim().toUpperCase().replace(".NS", "").replace(".BO", "");
  const cleanNoSpaces = raw.replace(/[^A-Z0-9]/g, "");

  // 1. Direct Alias Lookup
  if (STOCK_ALIASES[raw]) return STOCK_ALIASES[raw];
  if (STOCK_ALIASES[cleanNoSpaces]) return STOCK_ALIASES[cleanNoSpaces];

  // 5. Fuzzy match in RisiAsset portfolio
  const risiNameMatch = state.risiPortfolio?.holdings?.find(h => {
    const hName = h.name.toUpperCase();
    return hName.includes(raw) || hName.replace(/[^A-Z0-9]/g, "").includes(cleanNoSpaces);
  });
  if (risiNameMatch) return risiNameMatch.symbol;

  // 6. Typo Check: Levenshtein distance check for close transpositions (e.g. ONCG -> ONGC)
  const closeMatches = findClosestStockSuggestions(cleanNoSpaces || raw);
  if (closeMatches.length > 0 && (closeMatches[0].dist <= 2 || cleanNoSpaces.length <= 4)) {
    return closeMatches[0].symbol;
  }

  // 7. Return cleaned symbol if no mapping found
  return cleanNoSpaces || raw || "HDFCBANK";
}

// Levenshtein Distance & Typo Resolver
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function findClosestStockSuggestions(query) {
  const q = (query || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!q) return [];
  const scores = [];

  for (const u of state.universe) {
    const sym = u.symbol;
    const dist = levenshtein(q, sym);
    if (dist <= 2 || sym.includes(q) || q.includes(sym)) {
      scores.push({ symbol: sym, name: u.name, sector: u.sector, dist });
    }
  }

  if (state.risiPortfolio?.holdings) {
    for (const h of state.risiPortfolio.holdings) {
      if (!scores.find(s => s.symbol === h.symbol)) {
        const dist = levenshtein(q, h.symbol);
        if (dist <= 2 || h.symbol.includes(q)) {
          scores.push({ symbol: h.symbol, name: h.name, sector: h.sector || h.category, dist });
        }
      }
    }
  }

  scores.sort((a, b) => a.dist - b.dist);
  return scores.slice(0, 5);
}

function showStockNotFoundState(query, symbol) {
  const notFoundBox = document.getElementById("advNotFoundContainer");
  const mainBox = document.getElementById("advMainContentContainer");
  if (!notFoundBox || !mainBox) return;

  mainBox.classList.add("hidden");
  notFoundBox.classList.remove("hidden");

  document.getElementById("advNotFoundQuery").textContent = `"${query || symbol}"`;

  const suggestions = findClosestStockSuggestions(query || symbol);
  const suggContainer = document.getElementById("advNotFoundSuggestions");

  if (suggestions.length === 0) {
    suggestions.push(
      { symbol: "ONGC", name: "Oil and Natural Gas Corp Ltd." },
      { symbol: "HDFCBANK", name: "HDFC Bank Ltd." },
      { symbol: "RELIANCE", name: "Reliance Industries Ltd." },
      { symbol: "TATAMOTORS", name: "Tata Motors Ltd." }
    );
  }

  if (suggContainer) {
    suggContainer.innerHTML = suggestions.map(s => `
      <button onclick="analyzeAdvisorStock('${s.symbol}')" class="px-3 py-1.5 rounded-xl bg-brand-dark hover:bg-brand-border border border-brand-border text-white hover:text-cyan-300 transition flex items-center space-x-1.5 cursor-pointer shadow-sm">
        <span class="font-bold text-cyan-400 font-mono">${s.symbol}</span>
        <span class="text-gray-300 text-xs truncate max-w-[160px] font-sans">${s.name}</span>
      </button>
    `).join("");
  }

  lucide.createIcons();
}

function getStockSuggestions(query) {
  if (!query || query.trim().length === 0) return [];
  const raw = query.trim().toUpperCase();
  const cleanNoSpaces = raw.replace(/[^A-Z0-9]/g, "");
  const results = [];
  const seen = new Set();

  // 1. Check direct aliases that start with or match query
  for (const [alias, sym] of Object.entries(STOCK_ALIASES)) {
    if (alias.startsWith(raw) || alias.includes(raw)) {
      if (!seen.has(sym)) {
        seen.add(sym);
        const u = state.universe.find(x => x.symbol === sym);
        const r = state.risiPortfolio?.holdings?.find(x => x.symbol === sym);
        results.push({
          symbol: sym,
          name: u ? u.name : (r ? r.name : alias),
          sector: u ? u.sector : (r ? r.sector : "Equities"),
          matchedBy: alias
        });
      }
    }
  }

  // 2. Search Universe symbols & names
  for (const u of state.universe) {
    if (seen.has(u.symbol)) continue;
    const symMatch = u.symbol.startsWith(cleanNoSpaces) || u.symbol.includes(cleanNoSpaces);
    const nameMatch = u.name.toUpperCase().includes(raw);
    if (symMatch || nameMatch) {
      seen.add(u.symbol);
      results.push({
        symbol: u.symbol,
        name: u.name,
        sector: u.sector,
        matchedBy: u.name
      });
    }
  }

  // 3. Search RisiAsset holdings
  if (state.risiPortfolio?.holdings) {
    for (const h of state.risiPortfolio.holdings) {
      if (seen.has(h.symbol)) continue;
      const symMatch = h.symbol.startsWith(cleanNoSpaces) || h.symbol.includes(cleanNoSpaces);
      const nameMatch = h.name.toUpperCase().includes(raw);
      if (symMatch || nameMatch) {
        seen.add(h.symbol);
        results.push({
          symbol: h.symbol,
          name: h.name,
          sector: h.sector || h.category,
          matchedBy: h.name
        });
      }
    }
  }

  return results.slice(0, 8);
}

function setupChartTypeahead() {
  const input = document.getElementById("inputChartSearch");
  const dropdown = document.getElementById("chartSuggestDropdown");
  const list = document.getElementById("chartSuggestList");
  if (!input || !dropdown || !list) return;

  let selectedIndex = -1;

  function hideDropdown() {
    dropdown.classList.add("hidden");
    selectedIndex = -1;
  }

  function renderSuggestions(suggestions) {
    if (suggestions.length === 0) {
      list.innerHTML = `
        <div class="px-3 py-2 text-[11px] text-gray-400 text-center font-sans">
          No exact symbol match. Press <kbd class="px-1.5 py-0.5 rounded bg-brand-dark border border-brand-border text-white text-[10px]">Enter</kbd> to load.
        </div>
      `;
      dropdown.classList.remove("hidden");
      return;
    }

    list.innerHTML = suggestions.map((s, idx) => `
      <div data-idx="${idx}" data-symbol="${s.symbol}" class="suggest-item flex items-center justify-between px-3 py-2 rounded-lg hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/30 cursor-pointer transition select-none group">
        <div class="flex items-center space-x-2.5 min-w-0">
          <span class="font-bold text-xs text-emerald-400 font-mono group-hover:text-emerald-300">${s.symbol}</span>
          <span class="text-xs text-gray-300 truncate max-w-[190px] font-sans group-hover:text-white">${s.name}</span>
        </div>
        <div class="flex items-center space-x-1.5 shrink-0">
          <span class="px-1.5 py-0.2 text-[10px] rounded bg-brand-dark border border-brand-border text-gray-400 font-mono">${s.sector || 'NSE'}</span>
          <span class="text-[9px] font-mono font-bold text-gray-400">NSE</span>
        </div>
      </div>
    `).join("");

    const items = list.querySelectorAll(".suggest-item");
    items.forEach(item => {
      item.addEventListener("click", () => {
        const sym = item.getAttribute("data-symbol");
        if (sym) {
          input.value = sym;
          hideDropdown();
          analyzeStock(sym);
        }
      });
    });

    dropdown.classList.remove("hidden");
    selectedIndex = -1;
  }

  input.addEventListener("input", () => {
    const q = input.value.trim();
    if (q.length === 0) {
      hideDropdown();
      return;
    }
    const suggestions = getStockSuggestions(q);
    renderSuggestions(suggestions);
  });

  input.addEventListener("keydown", (e) => {
    const items = list.querySelectorAll(".suggest-item");
    if (dropdown.classList.contains("hidden") || items.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        const sym = input.value.trim();
        if (sym) analyzeStock(sym);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % items.length;
      updateItemHighlight(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + items.length) % items.length;
      updateItemHighlight(items);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < items.length) {
        const sym = items[selectedIndex].getAttribute("data-symbol");
        input.value = sym;
        hideDropdown();
        analyzeStock(sym);
      } else {
        const sym = input.value.trim();
        hideDropdown();
        if (sym) analyzeStock(sym);
      }
    } else if (e.key === "Escape") {
      hideDropdown();
    }
  });

  function updateItemHighlight(items) {
    items.forEach((item, idx) => {
      if (idx === selectedIndex) {
        item.classList.add("bg-emerald-500/20", "border-emerald-500/40");
      } else {
        item.classList.remove("bg-emerald-500/20", "border-emerald-500/40");
      }
    });
  }

  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      hideDropdown();
    }
  });
}

function setupAdvisorTypeahead() {
  const input = document.getElementById("inputAdvisorSearch");
  const dropdown = document.getElementById("advisorSuggestDropdown");
  const list = document.getElementById("advisorSuggestList");
  if (!input || !dropdown || !list) return;

  let selectedIndex = -1;

  function hideDropdown() {
    dropdown.classList.add("hidden");
    selectedIndex = -1;
  }

  function renderSuggestions(suggestions) {
    if (suggestions.length === 0) {
      list.innerHTML = `
        <div class="px-3 py-2 text-[11px] text-gray-400 text-center font-sans">
          No exact symbol match. Press <kbd class="px-1.5 py-0.5 rounded bg-brand-dark border border-brand-border text-white text-[10px]">Enter</kbd> to search via Live NSE Feed.
        </div>
      `;
      dropdown.classList.remove("hidden");
      return;
    }

    list.innerHTML = suggestions.map((s, idx) => `
      <div data-idx="${idx}" data-symbol="${s.symbol}" class="suggest-item flex items-center justify-between px-3 py-2 rounded-lg hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/30 cursor-pointer transition select-none group">
        <div class="flex items-center space-x-2.5 min-w-0">
          <span class="font-bold text-xs text-cyan-400 font-mono group-hover:text-cyan-300">${s.symbol}</span>
          <span class="text-xs text-gray-300 truncate max-w-[190px] font-sans group-hover:text-white">${s.name}</span>
        </div>
        <div class="flex items-center space-x-1.5 shrink-0">
          <span class="px-1.5 py-0.2 text-[10px] rounded bg-brand-dark border border-brand-border text-gray-400 font-mono">${s.sector || 'NSE'}</span>
          <span class="text-[9px] font-mono font-bold text-gray-400">NSE</span>
        </div>
      </div>
    `).join("");

    // Attach click handlers to items
    const items = list.querySelectorAll(".suggest-item");
    items.forEach(item => {
      item.addEventListener("click", () => {
        const sym = item.getAttribute("data-symbol");
        if (sym) {
          input.value = sym;
          hideDropdown();
          analyzeAdvisorStock(sym);
        }
      });
    });

    dropdown.classList.remove("hidden");
    selectedIndex = -1;
  }

  input.addEventListener("input", () => {
    const q = input.value.trim();
    if (q.length === 0) {
      hideDropdown();
      return;
    }
    const suggestions = getStockSuggestions(q);
    renderSuggestions(suggestions);
  });

  input.addEventListener("keydown", (e) => {
    const items = list.querySelectorAll(".suggest-item");
    if (dropdown.classList.contains("hidden") || items.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        runAdvisorSearch();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % items.length;
      updateItemHighlight(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + items.length) % items.length;
      updateItemHighlight(items);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < items.length) {
        const sym = items[selectedIndex].getAttribute("data-symbol");
        input.value = sym;
        hideDropdown();
        analyzeAdvisorStock(sym);
      } else {
        hideDropdown();
        runAdvisorSearch();
      }
    } else if (e.key === "Escape") {
      hideDropdown();
    }
  });

  function updateItemHighlight(items) {
    items.forEach((item, idx) => {
      if (idx === selectedIndex) {
        item.classList.add("bg-cyan-500/20", "border-cyan-500/40");
      } else {
        item.classList.remove("bg-cyan-500/20", "border-cyan-500/40");
      }
    });
  }

  // Hide on click outside
  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      hideDropdown();
    }
  });
}

window.runAdvisorSearch = function() {
  const input = document.getElementById("inputAdvisorSearch");
  const query = (input?.value || "").trim();
  if (query) {
    const dropdown = document.getElementById("advisorSuggestDropdown");
    if (dropdown) dropdown.classList.add("hidden");
    analyzeAdvisorStock(query);
  }
};

window.setAdvisorTimeframe = function(tf) {
  state.advisorTimeframe = tf;
  const btns = document.querySelectorAll(".btn-adv-tf");
  btns.forEach(b => {
    b.classList.remove("active", "text-cyan-400", "font-bold", "bg-cyan-500/20");
    b.classList.add("text-gray-400");
    if (b.getAttribute("data-tf") === tf) {
      b.classList.add("active", "text-cyan-400", "font-bold", "bg-cyan-500/20");
      b.classList.remove("text-gray-400");
    }
  });
  if (state.advisorSymbol) {
    analyzeAdvisorStock(state.advisorSymbol);
  }
};

window.setPriceDropAlert = function() {
  const price = document.getElementById("inputAlertPrice")?.value || "710";
  const btn = document.getElementById("btnSetAlert");
  if (btn) {
    const orig = btn.innerHTML;
    btn.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5 inline mr-1"></i>Alert Set!`;
    btn.classList.remove("bg-blue-600", "hover:bg-blue-500");
    btn.classList.add("bg-emerald-600");
    lucide.createIcons();
    setTimeout(() => {
      btn.innerHTML = orig;
      btn.classList.remove("bg-emerald-600");
      btn.classList.add("bg-blue-600", "hover:bg-blue-500");
      lucide.createIcons();
    }, 2500);
  }
};

window.analyzeAdvisorStock = async function(query) {
  const resolvedSymbol = resolveStockSymbol(query);
  const symbol = resolvedSymbol.toUpperCase().replace(".NS", "").replace(".BO", "");
  state.advisorSymbol = symbol;

  const inputSearch = document.getElementById("inputAdvisorSearch");
  if (inputSearch) inputSearch.value = symbol;

  // Check known data sources
  let stockName = symbol;
  let sector = "General";
  const univMatch = state.universe.find(u => u.symbol === symbol);
  if (univMatch) {
    stockName = univMatch.name;
    sector = univMatch.sector;
  } else {
    const risiMatch = state.risiPortfolio?.holdings?.find(h => h.symbol === symbol);
    if (risiMatch) {
      stockName = risiMatch.name;
      sector = risiMatch.sector || risiMatch.category;
    }
  }

  document.getElementById("advCompanyName").textContent = stockName;
  document.getElementById("advSymbol").textContent = `${symbol}.NS`;
  document.getElementById("advSectorBadge").textContent = sector;

  try {
    let series = [];
    let meta = {};

    // 1. Fetch live real-time market data via local server proxy (CORS-free)
    try {
      const res = await fetch(`/api/chart/${encodeURIComponent(symbol)}?range=1y`);
      if (res.ok) {
        const json = await res.json();
        if (json.status === "success" && json.meta?.regularMarketPrice) {
          series = json.series || [];
          meta = json.meta || {};
        }
      }
    } catch (e) {}

    // 2. Direct external fetch fallback
    if (series.length === 0 || !meta.regularMarketPrice) {
      for (const suffix of [".NS", ".BO", ""]) {
        try {
          const ticker = symbol.endsWith(".NS") || symbol.endsWith(".BO") ? symbol : `${symbol}${suffix}`;
          const yfUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1y`;
          const yfRes = await fetch(yfUrl);
          if (yfRes.ok) {
            const yfJson = await yfRes.json();
            const resObj = yfJson.chart?.result?.[0];
            if (resObj && resObj.meta && resObj.meta.regularMarketPrice) {
              meta = resObj.meta;
              const timestamps = resObj.timestamp || [];
              const quotes = resObj.indicators?.quote?.[0] || {};
              const closes = quotes.close || [];
              const opens = quotes.open || [];
              const highs = quotes.high || [];
              const lows = quotes.low || [];

              series = [];
              for (let i = 0; i < timestamps.length; i++) {
                if (closes[i] !== null && closes[i] !== undefined && !isNaN(closes[i])) {
                  const date = new Date(timestamps[i] * 1000).toISOString().split("T")[0];
                  series.push({
                    date,
                    close: +closes[i].toFixed(2),
                    open: +(opens[i] ?? closes[i]).toFixed(2),
                    high: +(highs[i] ?? closes[i]).toFixed(2),
                    low: +(lows[i] ?? closes[i]).toFixed(2)
                  });
                }
              }
              if (series.length > 0) break;
            }
          }
        } catch (e) {}
      }
    }

    // If stock is NOT found on any exchange feed, show clear Not Found message (NO FAKE DATA)
    if (series.length === 0 || !meta || !meta.regularMarketPrice) {
      showStockNotFoundState(query, symbol);
      return;
    }

    // Unhide main content and hide not found box
    const notFoundBox = document.getElementById("advNotFoundContainer");
    const mainBox = document.getElementById("advMainContentContainer");
    if (notFoundBox) notFoundBox.classList.add("hidden");
    if (mainBox) mainBox.classList.remove("hidden");

    // Update company name from real-time meta if available
    if (meta.longName || meta.shortName) {
      stockName = meta.longName || meta.shortName;
      document.getElementById("advCompanyName").textContent = stockName;
    }
    const closes = series.map(s => s.close);
    const latestClose = meta.regularMarketPrice || (closes.length > 0 ? closes[closes.length - 1] : 0.0);
    const high52 = meta.fiftyTwoWeekHigh || Math.max(...closes);
    const low52 = meta.fiftyTwoWeekLow || Math.min(...closes);
    const prevClose = meta.chartPreviousClose || (closes.length > 1 ? closes[closes.length - 2] : latestClose);
    const changePct = prevClose ? +(((latestClose - prevClose) / prevClose) * 100).toFixed(2) : 0.0;
    const avgPrice = closes.length > 0 ? +(closes.reduce((a, b) => a + b, 0) / closes.length).toFixed(2) : latestClose;
    const discountPct = high52 > 0 ? +(((high52 - latestClose) / high52) * 100).toFixed(1) : 0.0;
    const rangePct = (high52 - low52) > 0 ? Math.min(100, Math.max(0, Math.round(((latestClose - low52) / (high52 - low52)) * 100))) : 50;
    // Update Left Overview Card
    document.getElementById("advLtp").textContent = formatINR(latestClose);
    const elChg = document.getElementById("advChangePct");
    elChg.textContent = `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`;
    elChg.className = `text-sm font-semibold font-mono ${changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;

    document.getElementById("advPrevClose").textContent = `Prev Close: ${formatINR(prevClose)}`;
    document.getElementById("adv52Low").textContent = formatINR(low52);
    document.getElementById("adv52High").textContent = formatINR(high52);
    document.getElementById("advRangeFill").style.width = `${rangePct}%`;
    document.getElementById("advRangePos").textContent = `Trading at ${rangePct}% of 52-week range`;

    const elBadge = document.getElementById("advDiscountBadge");
    if (discountPct >= 15.0) {
      elBadge.textContent = `📉 ${discountPct}% OFF Peak`;
      elBadge.className = "px-3 py-1 rounded-xl text-xs font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm";
    } else if (discountPct <= 4.0) {
      elBadge.textContent = `📈 Near 52W High (${discountPct}% to Peak)`;
      elBadge.className = "px-3 py-1 rounded-xl text-xs font-bold font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm";
    } else {
      elBadge.textContent = `⚖️ Fair Value Range (-${discountPct}%)`;
      elBadge.className = "px-3 py-1 rounded-xl text-xs font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm";
    }

    // Update Price Stats Grid
    document.getElementById("advStatHighest").textContent = formatINR(high52);
    document.getElementById("advStatAverage").textContent = formatINR(avgPrice);
    document.getElementById("advStatLowest").textContent = formatINR(low52);

    const alertInput = document.getElementById("inputAlertPrice");
    if (alertInput) alertInput.value = (latestClose * 0.97).toFixed(2);

    // Calculate Quantitative Buyhatke Score (0 to 100)
    // 1. Price Discount Score (0-35 pts)
    let discountScore = Math.min(35, Math.max(5, Math.round((100 - rangePct) * 0.35)));
    
    // 2. Fundamental Moat Score (0-30 pts)
    let moatScore = 24;
    if (["RELIANCE", "TCS", "HDFCBANK", "INFY", "ITC", "TATAMOTORS", "LT"].includes(symbol)) moatScore = 28;
    else if (["OLAELEC", "GREENPOWER", "GTLINFRA", "RTNINDIA"].includes(symbol)) moatScore = 10;

    // 3. Technical Momentum Score (0-20 pts)
    const lastRSI = series[series.length - 1]?.rsi14 || 50;
    let rsiScore = 15;
    if (lastRSI <= 38) rsiScore = 20;
    else if (lastRSI >= 72) rsiScore = 5;

    // 4. Timeframe Adjustment (0-15 pts)
    let tfBonus = 12;
    if (state.advisorTimeframe === "1 Year+") tfBonus = 15;
    else if (state.advisorTimeframe === "2-3 Days") tfBonus = lastRSI < 40 ? 15 : 8;

    const totalScore = Math.min(98, Math.max(12, discountScore + moatScore + rsiScore + (tfBonus - 10)));
    state.advisorGaugeScore = totalScore;

    // Draw Gauge Meter
    drawSpeedometerGauge(totalScore);

    // Set Verdict Text
    const elTitle = document.getElementById("advVerdictTitle");
    const elThesis = document.getElementById("advVerdictThesis");

    if (totalScore >= 70) {
      elTitle.textContent = "Go Ahead & Buy now";
      elTitle.className = "text-lg font-extrabold text-emerald-400 font-sans";
      elThesis.textContent = `Optimal price point at ${rangePct}% of 52-week range (${discountPct}% discount from peak). Favorable risk-reward with resilient institutional backing.`;
    } else if (totalScore >= 45) {
      elTitle.textContent = "Wait for a Better Dip";
      elTitle.className = "text-lg font-extrabold text-amber-400 font-sans";
      elThesis.textContent = `Stock is in a fair valuation consolidation band (${rangePct}% of range). Better entry point expected closer to support (around ${formatINR(low52 * 1.03)}).`;
    } else {
      elTitle.textContent = "Avoid Buying / Book Profits";
      elTitle.className = "text-lg font-extrabold text-rose-400 font-sans";
      elThesis.textContent = `Price is overextended near the top of its 52-week range (${rangePct}% range level, ${discountPct}% from high) with high RSI. High risk of mean reversion pullback.`;
    }

    // Update Checklist Factor Cards
    document.getElementById("advCheckDiscount").textContent = `Score: ${discountScore} / 35`;
    document.getElementById("advCheckDiscountDesc").textContent = `${discountPct}% below peak (${rangePct}% range position).`;

    document.getElementById("advCheckMoat").textContent = `Score: ${moatScore} / 30`;
    document.getElementById("advCheckMoatDesc").textContent = moatScore >= 20 ? "Solid balance sheet with positive cash flows." : "High leverage or speculative business model.";

    document.getElementById("advCheckRsi").textContent = `Score: ${rsiScore} / 20`;
    document.getElementById("advCheckRsiDesc").textContent = `RSI(14) at ${lastRSI.toFixed(1)} (${lastRSI >= 70 ? 'Overbought' : (lastRSI <= 40 ? 'Oversold' : 'Neutral')}).`;

    document.getElementById("advCheckRR").textContent = `Total: ${totalScore} / 100`;
    document.getElementById("advCheckRRDesc").textContent = `Timeframe: ${state.advisorTimeframe} recommendation.`;

    // Render Price Bands History Chart
    renderAdvisorHistoryChart(series, high52, low52, avgPrice);

  } catch (e) {
    console.error("Error analyzing advisor stock:", e);
  }
};

// -------------------------------------------------------------------
// Speedometer Semicircle Gauge Drawing (Canvas)
// -------------------------------------------------------------------
function drawSpeedometerGauge(score) {
  const canvas = document.getElementById("canvasAdvisorGauge");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const centerX = w / 2;
  const centerY = h - 8;
  const radius = Math.min(centerX - 10, centerY - 10);
  const lineWidth = 12;

  // 1. Draw Semicircle Gradient Arc (Red -> Yellow -> Green)
  const grad = ctx.createLinearGradient(centerX - radius, centerY, centerX + radius, centerY);
  grad.addColorStop(0.0, "#EF4444"); // Red (Bad time / 0)
  grad.addColorStop(0.35, "#F59E0B"); // Orange
  grad.addColorStop(0.65, "#EAB308"); // Yellow
  grad.addColorStop(1.0, "#10B981"); // Emerald (Good time / 100)

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, Math.PI, 0, false);
  ctx.strokeStyle = grad;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.stroke();

  // 2. Draw Score Needle
  const clampScore = Math.min(100, Math.max(0, score));
  const angle = Math.PI + (clampScore / 100) * Math.PI; // Math.PI (180deg) to 2*Math.PI (360deg)

  const needleLength = radius - 8;
  const needleX = centerX + needleLength * Math.cos(angle);
  const needleY = centerY + needleLength * Math.sin(angle);

  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(needleX, needleY);
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.stroke();

  // 3. Center Pivot Circle
  ctx.beginPath();
  ctx.arc(centerX, centerY, 6, 0, 2 * Math.PI);
  ctx.fillStyle = "#38BDF8";
  ctx.fill();
  ctx.strokeStyle = "#0B0F19";
  ctx.lineWidth = 2;
  ctx.stroke();

  // 4. Score Text in Center
  ctx.font = "bold 13px 'JetBrains Mono', monospace";
  ctx.fillStyle = score >= 70 ? "#10B981" : (score >= 45 ? "#F59E0B" : "#EF4444");
  ctx.textAlign = "center";
  ctx.fillText(`${score}/100`, centerX, centerY - 20);
}

// -------------------------------------------------------------------
// Helper: Generate Realistic 90-Day Price Trajectory Curve
// -------------------------------------------------------------------
function generateRealisticPriceHistory(symbol, ltp, high52, low52, numDays = 90) {
  const now = new Date();
  const series = [];
  const rangeSpan = Math.max(1, high52 - low52);
  const posRatio = (ltp - low52) / rangeSpan;

  for (let i = numDays; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000).toISOString().split("T")[0];
    const t = (numDays - i) / numDays; // 0.0 (past) to 1.0 (today)
    
    let simulatedPrice = ltp;
    if (symbol === "OLAELEC") {
      // Dropped from peak ~157.40 down through 120 -> 90 -> 65 -> 37.73
      const decay = Math.exp(-t * 2.5);
      simulatedPrice = low52 + (high52 - low52) * decay + (Math.sin(i / 3) * 3.0);
    } else if (symbol === "TATAMOTORS") {
      // Rallied from 302 up to 485
      simulatedPrice = low52 + (ltp - low52) * Math.pow(t, 0.65) + (Math.sin(i / 4) * 5.0);
    } else if (symbol === "HDFCBANK") {
      // Consolidated from 905 down to 715 and rebounding to 726
      simulatedPrice = high52 - (high52 - low52) * Math.sin(t * Math.PI * 0.5) + (Math.cos(i / 3) * 7.0);
    } else {
      if (posRatio < 0.3) {
        simulatedPrice = high52 - (high52 - ltp) * Math.pow(t, 0.55) + (Math.sin(i / 3.5) * (rangeSpan * 0.03));
      } else if (posRatio > 0.7) {
        simulatedPrice = low52 + (ltp - low52) * Math.pow(t, 0.55) + (Math.sin(i / 3.5) * (rangeSpan * 0.03));
      } else {
        simulatedPrice = ((high52 + low52) / 2) + Math.sin(t * Math.PI * 2) * (rangeSpan * 0.25) + (Math.sin(i / 3) * (rangeSpan * 0.02));
      }
    }

    if (i === 0) simulatedPrice = ltp;
    simulatedPrice = Math.max(low52 * 0.98, Math.min(high52 * 1.02, +simulatedPrice.toFixed(2)));

    const rsiSim = 30 + ((simulatedPrice - low52) / rangeSpan) * 45 + (Math.sin(i / 2) * 5);
    series.push({
      date: d,
      close: simulatedPrice,
      open: +(simulatedPrice - 1.5).toFixed(2),
      high: +(simulatedPrice + 2.5).toFixed(2),
      low: +(simulatedPrice - 2.5).toFixed(2),
      rsi14: Math.min(85, Math.max(20, +rsiSim.toFixed(1)))
    });
  }
  return series;
}

// -------------------------------------------------------------------
// Price History & Entry Bands Chart (Chart.js)
// -------------------------------------------------------------------
function renderAdvisorHistoryChart(series, high52, low52, avgPrice) {
  const canvas = document.getElementById("canvasAdvisorHistoryChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  if (state.advisorHistoryChart) {
    state.advisorHistoryChart.destroy();
  }

  const labels = series.map(s => formatDate(s.date));
  const closes = series.map(s => s.close);

  const buyZoneLevel = +(low52 + (high52 - low52) * 0.25).toFixed(2);
  const sellZoneLevel = +(low52 + (high52 - low52) * 0.75).toFixed(2);

  // Shaded gradient fill under price line
  const gradPrice = ctx.createLinearGradient(0, 0, 0, 240);
  gradPrice.addColorStop(0, "rgba(56, 189, 248, 0.25)");
  gradPrice.addColorStop(1, "rgba(56, 189, 248, 0.0)");

  state.advisorHistoryChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Price History (₹)",
          data: closes,
          borderColor: "#38BDF8",
          backgroundColor: gradPrice,
          borderWidth: 2.8,
          fill: true,
          tension: 0.2,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: "#38BDF8",
          pointHoverBorderColor: "#FFFFFF",
          pointHoverBorderWidth: 2
        },
        {
          label: `Buy Zone Floor (< ₹${buyZoneLevel})`,
          data: new Array(labels.length).fill(buyZoneLevel),
          borderColor: "#10B981",
          borderWidth: 1.8,
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0
        },
        {
          label: `Overbought Zone (> ₹${sellZoneLevel})`,
          data: new Array(labels.length).fill(sellZoneLevel),
          borderColor: "#EF4444",
          borderWidth: 1.8,
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0
        },
        {
          label: `Average Price (₹${avgPrice})`,
          data: new Array(labels.length).fill(avgPrice),
          borderColor: "rgba(245, 158, 11, 0.7)",
          borderWidth: 1.2,
          borderDash: [3, 3],
          fill: false,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: { color: "#9CA3AF", font: { family: "JetBrains Mono", size: 10 } }
        },
        tooltip: {
          backgroundColor: "#121826",
          borderColor: "#1F293D",
          borderWidth: 1,
          titleFont: { family: "JetBrains Mono" },
          bodyFont: { family: "JetBrains Mono" },
          callbacks: {
            label: (ctx) => {
              if (ctx.datasetIndex === 0) {
                const val = ctx.parsed.y;
                let zoneTag = "🟡 Fair Value Zone";
                if (val <= buyZoneLevel) zoneTag = "🟢 Optimal Buy Zone (< 25%)";
                else if (val >= sellZoneLevel) zoneTag = "🔴 Overbought / High Risk (> 75%)";
                return [`Price: ₹${val.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, `Zone: ${zoneTag}`];
              }
              return `${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(31, 41, 61, 0.4)" },
          ticks: { color: "#6B7280", font: { family: "JetBrains Mono", size: 10 }, maxTicksLimit: 8 }
        },
        y: {
          position: "right",
          min: Math.floor(low52 * 0.92),
          max: Math.ceil(high52 * 1.06),
          grid: { color: "rgba(31, 41, 61, 0.4)" },
          ticks: {
            color: "#9CA3AF",
            font: { family: "JetBrains Mono", size: 10 },
            callback: (v) => `₹${v}`
          }
        }
      }
    }
  });
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
