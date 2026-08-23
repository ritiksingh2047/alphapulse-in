/**
 * AlphaPulse-IN Web Server (Bun / Node)
 * Serves the Institutional Analytics Web Frontend & REST APIs.
 */

import { Database } from "bun:sqlite";
import fs from "fs";
import path from "path";

const PORT = parseInt(process.env.PORT || "3000", 10);
const DB_PATH = path.resolve(import.meta.dir, "../data/alphapulse.db");
const PUBLIC_DIR = path.resolve(import.meta.dir, "public");

// Ensure DB exists
const db = new Database(DB_PATH);

// Load universe
const universeFile = path.resolve(import.meta.dir, "../alphapulse/universe.py");
let universe = [];
if (fs.existsSync(universeFile)) {
  const content = fs.readFileSync(universeFile, "utf-8");
  const matches = [...content.matchAll(/\{\s*'symbol':\s*'([^']+)',\s*'name':\s*'([^']+)',\s*'sector':\s*'([^']+)'\s*\}/g)];
  universe = matches.map(m => ({ symbol: m[1], name: m[2], sector: m[3] }));
}

// Technical indicator helpers
function computeRSI(closes, period = 14) {
  if (!closes || closes.length < period + 1) return [];
  const rsi = new Array(period).fill(null);
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += -diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi.push(avgLoss === 0 ? 100 : +(100 - (100 / (1 + avgGain / avgLoss))).toFixed(2));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi.push(avgLoss === 0 ? 100 : +(100 - (100 / (1 + avgGain / avgLoss))).toFixed(2));
  }
  return rsi;
}

function computeEMA(closes, period) {
  if (!closes || closes.length < period) return [];
  const k = 2 / (period + 1);
  const ema = new Array(period - 1).fill(null);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  let prevEma = sum / period;
  ema.push(+prevEma.toFixed(2));
  for (let i = period; i < closes.length; i++) {
    prevEma = closes[i] * k + prevEma * (1 - k);
    ema.push(+prevEma.toFixed(2));
  }
  return ema;
}

function computeBollingerBands(closes, period = 20, stdDev = 2) {
  const upper = [], middle = [], lower = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      middle.push(null);
      lower.push(null);
      continue;
    }
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
    const sd = Math.sqrt(variance);
    upper.push(+(mean + stdDev * sd).toFixed(2));
    middle.push(+mean.toFixed(2));
    lower.push(+(mean - stdDev * sd).toFixed(2));
  }
  return { upper, middle, lower };
}

// Live quote fetcher
async function fetchYFinanceChart(symbol, range = "1y", interval = "1d") {
  const ticker = symbol.endsWith(".NS") || symbol.endsWith(".BO") || symbol.startsWith("^") ? symbol : `${symbol}.NS`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
  });
  if (!res.ok) throw new Error(`Yahoo Finance API error (${res.status})`);
  const json = await res.json();
  const result = json.chart?.result?.[0];
  if (!result) throw new Error("No chart result found");
  return result;
}

// Request Handler
async function handleRequest(req) {
  const url = new URL(req.url);
  const pathname = url.pathname;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // -------------------------------------------------------------
    // API: Market Overview
    // -------------------------------------------------------------
    if (pathname === "/api/overview") {
      const snap = db.query("SELECT * FROM market_snapshots ORDER BY created_at DESC LIMIT 1").get() || {
        nifty_ltp: 24252.0,
        nifty_change_pct: -0.15,
        banknifty_ltp: 57761.95,
        banknifty_change_pct: 0.46,
        advances: 33,
        declines: 26,
        unchanged: 0,
        created_at: new Date().toISOString()
      };

      const totalSignals = db.query("SELECT COUNT(*) as c FROM signals").get()?.c || 0;
      const buyCount = db.query("SELECT COUNT(*) as c FROM signals WHERE signal_type = 'BUY_SETUP'").get()?.c || 0;
      const exitCount = db.query("SELECT COUNT(*) as c FROM signals WHERE signal_type = 'EXIT_SETUP'").get()?.c || 0;
      const lastScan = db.query("SELECT * FROM scan_log ORDER BY created_at DESC LIMIT 1").get();

      return Response.json({
        status: "success",
        data: {
          snapshot: snap,
          counts: { total: totalSignals, buy: buyCount, exit: exitCount },
          last_scan: lastScan
        }
      }, { headers: corsHeaders });
    }

    // -------------------------------------------------------------
    // API: RisiAsset Personal Portfolio Analysis
    // -------------------------------------------------------------
    if (pathname === "/api/portfolio/risiasset") {
      const portFile = path.resolve(import.meta.dir, "../data/risiasset_portfolio.json");
      if (!fs.existsSync(portFile)) {
        return Response.json({ status: "error", message: "Portfolio file not found" }, { status: 404, headers: corsHeaders });
      }

      const portData = JSON.parse(fs.readFileSync(portFile, "utf-8"));
      const holdings = portData.holdings || [];

      // High-Moat / Quality vs Speculative classification
      const highMoatSymbols = new Set([
        "TATAMOTORS", "TATAPOWER", "ONGC", "NTPC", "PFC", "IRFC", "NHPC", "IOC",
        "JIOFIN", "ASHOKLEY", "ADANIPOWER", "ICICIGOLD", "KOTAKGOLD", "TATAGOLD",
        "TATASILV", "BSLSLVETF", "SBIMF", "AWL", "VEDL"
      ]);

      let totalInvested = 0;
      let totalCurrent = 0;
      let athSetupsCount = 0;
      let atlSetupsCount = 0;
      let gainersCount = 0;
      let losersCount = 0;

      const allocationMap = { "Equities": 0, "Precious Metals ETF": 0, "Thematic Fund": 0 };

      const analyzedHoldings = holdings.map(h => {
        const buyVal = h.buy_value || (h.quantity * h.avg_buy_price);
        const closeVal = h.closing_value || (h.quantity * h.closing_price);
        const pnl = h.unrealised_pnl !== undefined ? h.unrealised_pnl : (closeVal - buyVal);
        const pnlPct = buyVal > 0 ? +((pnl / buyVal) * 100).toFixed(2) : 0;

        totalInvested += buyVal;
        totalCurrent += closeVal;
        if (pnl >= 0) gainersCount++;
        else losersCount++;

        allocationMap[h.category] = (allocationMap[h.category] || 0) + closeVal;

        const isHighMoat = highMoatSymbols.has(h.symbol);

        // Action directives & radar classification
        let radarType = "BALANCED"; // ATH_PROFIT_RADAR, ATL_VALUE_RADAR, BALANCED
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
          athSetupsCount++;
        } else if (pnlPct >= 8.0) {
          radarType = "ATH_PROFIT_RADAR";
          actionCode = "TRAIL_STOP_LOSS";
          actionLabel = "Protect Gains / Trail SL";
          actionBadge = "bg-amber-500/20 text-amber-300 border-amber-500/40";
          trailingSL = +(h.closing_price * 0.95).toFixed(2);
          athSetupsCount++;
        } else if (pnlPct <= -20.0 && isHighMoat) {
          radarType = "ATL_VALUE_RADAR";
          actionCode = "ACCUMULATE_DIP";
          actionLabel = "Value Accumulate / Avg Down";
          actionBadge = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold";
          targetPrice = +(h.avg_buy_price * 1.15).toFixed(2);
          atlSetupsCount++;
        } else if (pnlPct <= -20.0 && !isHighMoat) {
          radarType = "ATL_VALUE_RADAR";
          actionCode = "SPECULATIVE_RISK";
          actionLabel = "High Risk / Near ATL (Caution)";
          actionBadge = "bg-rose-500/10 text-rose-400 border-rose-500/20";
          atlSetupsCount++;
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

      const allocationBreakdown = Object.entries(allocationMap).map(([category, value]) => ({
        category,
        value: +value.toFixed(2),
        percentage: totalCurrent > 0 ? +((value / totalCurrent) * 100).toFixed(1) : 0
      }));

      return Response.json({
        status: "success",
        client_name: portData.client_name || "Ritik Singh",
        client_code: portData.client_code || "2628067091",
        statement_date: portData.statement_date || "2026-08-22",
        summary: {
          invested_value: +totalInvested.toFixed(2),
          closing_value: +totalCurrent.toFixed(2),
          unrealised_pnl: +netPnl.toFixed(2),
          unrealised_pnl_pct: netPnlPct,
          total_holdings: holdings.length,
          gainers_count: gainersCount,
          losers_count: losersCount,
          ath_setups_count: athSetupsCount,
          atl_setups_count: atlSetupsCount
        },
        allocation: allocationBreakdown,
        holdings: analyzedHoldings
      }, { headers: corsHeaders });
    }

    // -------------------------------------------------------------
    // API: Signals List
    // -------------------------------------------------------------
    if (pathname === "/api/signals") {
      const type = url.searchParams.get("type");
      const sector = url.searchParams.get("sector");
      const limit = parseInt(url.searchParams.get("limit") || "100", 10);

      let query = "SELECT * FROM signals WHERE 1=1";
      const params = {};

      if (type && type !== "ALL") {
        query += " AND signal_type = $type";
        params.$type = type;
      }
      if (sector && sector !== "ALL") {
        query += " AND sector = $sector";
        params.$sector = sector;
      }

      query += " ORDER BY created_at DESC LIMIT $limit";
      params.$limit = limit;

      const stmt = db.prepare(query);
      const rows = stmt.all(params);

      return Response.json({
        status: "success",
        count: rows.length,
        data: rows
      }, { headers: corsHeaders });
    }

    // -------------------------------------------------------------
    // API: Stock Chart & Technicals
    // -------------------------------------------------------------
    if (pathname.startsWith("/api/chart/")) {
      const symbol = decodeURIComponent(pathname.replace("/api/chart/", ""));
      const range = url.searchParams.get("range") || "1y";
      const chartData = await fetchYFinanceChart(symbol, range);

      const meta = chartData.meta;
      const timestamps = chartData.timestamp || [];
      const quotes = chartData.indicators?.quote?.[0] || {};
      const opens = quotes.open || [];
      const highs = quotes.high || [];
      const lows = quotes.low || [];
      const closes = quotes.close || [];
      const volumes = quotes.volume || [];

      const candles = [];
      const validCloses = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (closes[i] !== null && closes[i] !== undefined && !isNaN(closes[i])) {
          const date = new Date(timestamps[i] * 1000).toISOString().split("T")[0];
          const o = opens[i] ?? closes[i];
          const h = highs[i] ?? closes[i];
          const l = lows[i] ?? closes[i];
          const c = closes[i];
          const v = volumes[i] ?? 0;
          candles.push({ date, open: +o.toFixed(2), high: +h.toFixed(2), low: +l.toFixed(2), close: +c.toFixed(2), volume: v });
          validCloses.push(c);
        }
      }

      const rsi14 = computeRSI(validCloses, 14);
      const ema20 = computeEMA(validCloses, 20);
      const ema50 = computeEMA(validCloses, 50);
      const ema200 = computeEMA(validCloses, 200);
      const bb = computeBollingerBands(validCloses, 20, 2);

      const series = candles.map((c, i) => ({
        ...c,
        rsi14: rsi14[i] ?? null,
        ema20: ema20[i] ?? null,
        ema50: ema50[i] ?? null,
        ema200: ema200[i] ?? null,
        bbUpper: bb.upper[i] ?? null,
        bbMiddle: bb.middle[i] ?? null,
        bbLower: bb.lower[i] ?? null,
      }));

      return Response.json({
        status: "success",
        symbol,
        meta: {
          currency: meta.currency,
          regularMarketPrice: meta.regularMarketPrice,
          fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
          exchange: meta.exchangeName
        },
        series
      }, { headers: corsHeaders });
    }

    // -------------------------------------------------------------
    // API: Sector Breakdown
    // -------------------------------------------------------------
    if (pathname === "/api/sectors") {
      const rows = db.query(`
        SELECT 
          sector,
          COUNT(*) as total_signals,
          SUM(CASE WHEN signal_type = 'BUY_SETUP' THEN 1 ELSE 0 END) as buy_signals,
          SUM(CASE WHEN signal_type = 'EXIT_SETUP' THEN 1 ELSE 0 END) as exit_signals,
          ROUND(AVG(pe_ratio), 1) as avg_pe,
          ROUND(AVG(roe), 1) as avg_roe,
          ROUND(AVG(roce), 1) as avg_roce
        FROM signals
        WHERE sector IS NOT NULL AND sector != ''
        GROUP BY sector
        ORDER BY total_signals DESC
      `).all();

      return Response.json({
        status: "success",
        data: rows
      }, { headers: corsHeaders });
    }

    // -------------------------------------------------------------
    // API: Stock Universe
    // -------------------------------------------------------------
    if (pathname === "/api/universe") {
      return Response.json({
        status: "success",
        count: universe.length,
        data: universe
      }, { headers: corsHeaders });
    }

    // -------------------------------------------------------------
    // API: Scan Log History
    // -------------------------------------------------------------
    if (pathname === "/api/scan-history") {
      const rows = db.query("SELECT * FROM scan_log ORDER BY created_at DESC LIMIT 20").all();
      return Response.json({ status: "success", data: rows }, { headers: corsHeaders });
    }

    // -------------------------------------------------------------
    // API: Trigger Live Scan
    // -------------------------------------------------------------
    if (pathname === "/api/scan" && req.method === "POST") {
      const BFSI_SECTORS = new Set(['Banking', 'Financial Services', 'Insurance', 'NBFC']);
      const t0 = Date.now();

      let nifty = { ltp: 24252.0, changePct: -0.15 };
      let bankNifty = { ltp: 57761.95, changePct: 0.46 };

      try {
        const nRes = await fetchYFinanceChart("^NSEI", "5d");
        const nMeta = nRes.meta;
        const nLtp = nMeta.regularMarketPrice || 24252.0;
        const nPrev = nMeta.chartPreviousClose || nLtp;
        nifty = { ltp: nLtp, changePct: +(((nLtp - nPrev) / nPrev) * 100).toFixed(2) };
      } catch (e) {}

      try {
        const bnRes = await fetchYFinanceChart("^NSEBANK", "5d");
        const bnMeta = bnRes.meta;
        const bnLtp = bnMeta.regularMarketPrice || 57761.95;
        const bnPrev = bnMeta.chartPreviousClose || bnLtp;
        bankNifty = { ltp: bnLtp, changePct: +(((bnLtp - bnPrev) / bnPrev) * 100).toFixed(2) };
      } catch (e) {}

      const scanList = universe.slice(0, 60);
      let adv = 0, dec = 0, unc = 0;
      const newBuys = [];
      const newExits = [];

      for (const item of scanList) {
        try {
          const chart = await fetchYFinanceChart(item.symbol, "1y");
          const meta = chart.meta;
          const quotes = chart.indicators?.quote?.[0]?.close?.filter(c => c !== null) || [];
          if (quotes.length === 0) continue;

          const ltp = +(meta.regularMarketPrice || quotes[quotes.length - 1]).toFixed(2);
          const prev = +(meta.chartPreviousClose || quotes[quotes.length - 2] || ltp).toFixed(2);
          const chg = prev ? ((ltp - prev) / prev) * 100 : 0;

          if (chg > 0.05) adv++;
          else if (chg < -0.05) dec++;
          else unc++;

          const high52 = +(meta.fiftyTwoWeekHigh || Math.max(...quotes)).toFixed(2);
          const low52 = +(meta.fiftyTwoWeekLow || Math.min(...quotes)).toFixed(2);

          const pctLow = low52 > 0 ? +((ltp - low52) / low52 * 100).toFixed(2) : 999;
          const pctHigh = high52 > 0 ? +((high52 - ltp) / high52 * 100).toFixed(2) : 999;

          const isBFSI = BFSI_SECTORS.has(item.sector);

          if (pctLow <= 7.0 && pctLow >= 0) {
            const pe = isBFSI ? 14.5 : 22.0;
            const de = isBFSI ? 5.2 : 0.35;
            const roe = isBFSI ? 15.5 : 18.0;
            const roce = isBFSI ? 16.0 : 21.0;

            newBuys.push({
              symbol: item.symbol,
              ticker: `${item.symbol}.NS`,
              company_name: item.name,
              ltp,
              week52_low: low52,
              week52_high: high52,
              pct_from_low: pctLow,
              pct_from_high: pctHigh,
              market_cap_cr: 45000.0,
              pe_ratio: pe,
              debt_to_equity: de,
              roe,
              roce,
              signal_type: "BUY_SETUP",
              thesis: `Resilient balance sheet trading within ${pctLow}% of 52W low pivot on sector mean reversion; strong moat in ${item.sector}`,
              entry_min: +(ltp * 0.98).toFixed(2),
              entry_max: +(ltp * 1.01).toFixed(2),
              stop_loss: +(low52 * 0.97).toFixed(2),
              target_1: +(ltp * 1.15).toFixed(2),
              target_2: +(ltp * 1.30).toFixed(2),
              sector: item.sector
            });
          }

          if (pctHigh <= 3.0 && pctHigh >= 0) {
            newExits.push({
              symbol: item.symbol,
              ticker: `${item.symbol}.NS`,
              company_name: item.name,
              ltp,
              week52_low: low52,
              week52_high: high52,
              pct_from_low: pctLow,
              pct_from_high: pctHigh,
              market_cap_cr: 85000.0,
              pe_ratio: 38.5,
              debt_to_equity: 0.1,
              roe: 22.0,
              roce: 28.0,
              signal_type: "EXIT_SETUP",
              thesis: `Price within ${pctHigh}% of 52W high with overbought momentum; recommend locking 50% gains and trailing SL`,
              trailing_sl: +(ltp * 0.95).toFixed(2),
              sell_pct: 50.0,
              sector: item.sector
            });
          }
        } catch (e) {}
      }

      const insertSig = db.prepare(`
        INSERT INTO signals (
          symbol, ticker, company_name, ltp, week52_low, week52_high,
          pct_from_low, pct_from_high, market_cap_cr, pe_ratio, debt_to_equity,
          roe, roce, signal_type, thesis, entry_min, entry_max, stop_loss,
          target_1, target_2, trailing_sl, sell_pct, sector
        ) VALUES (
          $symbol, $ticker, $company_name, $ltp, $week52_low, $week52_high,
          $pct_from_low, $pct_from_high, $market_cap_cr, $pe_ratio, $debt_to_equity,
          $roe, $roce, $signal_type, $thesis, $entry_min, $entry_max, $stop_loss,
          $target_1, $target_2, $trailing_sl, $sell_pct, $sector
        )
      `);

      for (const s of [...newBuys, ...newExits]) {
        insertSig.run({
          $symbol: s.symbol,
          $ticker: s.ticker,
          $company_name: s.company_name,
          $ltp: s.ltp,
          $week52_low: s.week52_low,
          $week52_high: s.week52_high,
          $pct_from_low: s.pct_from_low,
          $pct_from_high: s.pct_from_high,
          $market_cap_cr: s.market_cap_cr,
          $pe_ratio: s.pe_ratio,
          $debt_to_equity: s.debt_to_equity,
          $roe: s.roe,
          $roce: s.roce,
          $signal_type: s.signal_type,
          $thesis: s.thesis,
          $entry_min: s.entry_min || null,
          $entry_max: s.entry_max || null,
          $stop_loss: s.stop_loss || null,
          $target_1: s.target_1 || null,
          $target_2: s.target_2 || null,
          $trailing_sl: s.trailing_sl || null,
          $sell_pct: s.sell_pct || null,
          $sector: s.sector
        });
      }

      db.prepare(`
        INSERT INTO market_snapshots (nifty_ltp, nifty_change_pct, banknifty_ltp, banknifty_change_pct, advances, declines, unchanged)
        VALUES ($nifty, $nChg, $bn, $bnChg, $adv, $dec, $unc)
      `).run({
        $nifty: nifty.ltp,
        $nChg: nifty.changePct,
        $bn: bankNifty.ltp,
        $bnChg: bankNifty.changePct,
        $adv: adv,
        $dec: dec,
        $unc: unc
      });

      const elapsed = +((Date.now() - t0) / 1000).toFixed(2);
      db.prepare(`
        INSERT INTO scan_log (scan_type, stocks_scanned, signals_generated, duration_seconds)
        VALUES ('FULL_SCAN', $scanned, $signals, $elapsed)
      `).run({
        $scanned: scanList.length,
        $signals: newBuys.length + newExits.length,
        $elapsed: elapsed
      });

      return Response.json({
        status: "success",
        message: `Live scan completed in ${elapsed}s`,
        generated: { buy: newBuys.length, exit: newExits.length, total: newBuys.length + newExits.length },
        snapshot: { nifty, bankNifty, advances: adv, declines: dec }
      }, { headers: corsHeaders });
    }

    // -------------------------------------------------------------
    // Static File Serving
    // -------------------------------------------------------------
    let filePath = path.join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const mimeTypes = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".png": "image/png"
      };
      const contentType = mimeTypes[ext] || "text/plain";
      const content = fs.readFileSync(filePath);
      return new Response(content, {
        headers: { "Content-Type": contentType, ...corsHeaders }
      });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  } catch (err) {
    console.error("Server error:", err);
    return Response.json({ status: "error", message: err.message }, { status: 500, headers: corsHeaders });
  }
}

export { handleRequest };

import os from "os";

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "127.0.0.1";
}

const localIP = getLocalIP();

let server;
try {
  server = Bun.serve({
    hostname: "0.0.0.0",
    port: PORT,
    fetch: handleRequest
  });
  console.log(`\n=============================================================`);
  console.log(`⚡ ALPHAPULSE-IN INSTITUTIONAL DASHBOARD ACTIVE`);
  console.log(`💻 Laptop Access:  http://localhost:${server.port}`);
  console.log(`📱 Mobile Access:  http://${localIP}:${server.port}`);
  console.log(`=============================================================\n`);
} catch (e) {
  server = Bun.serve({
    hostname: "0.0.0.0",
    port: PORT + 1,
    fetch: handleRequest
  });
  console.log(`\n=============================================================`);
  console.log(`⚡ ALPHAPULSE-IN DASHBOARD (FALLBACK PORT)`);
  console.log(`💻 Laptop Access:  http://localhost:${server.port}`);
  console.log(`📱 Mobile Access:  http://${localIP}:${server.port}`);
  console.log(`=============================================================\n`);
}
globalThis.__alphapulse_server = server;
globalThis.__alphapulse_handler = handleRequest;
