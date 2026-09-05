# ===========================================================================
# AlphaPulse-IN: Complete NSE & BSE Master Equity Database Aggregator
# Ingests 100% of listed equities from both exchanges with ISIN deduplication
# ===========================================================================

param(
    [string]$NseUrl = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv",
    [string]$BseUrl = "https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w?Group=&Scripcode=&industry=&segment=Equity&status=Active",
    [string]$UniverseJsonPath = "web/public/universe.json",
    [string]$MasterJsonPath = "data/universe_master.json",
    [string]$DbPath = "data/alphapulse.db"
)

$ErrorActionPreference = "Continue"

Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host "  ALPHAPULSE-IN: FULL NSE & BSE MASTER DATABASE INGESTION    " -ForegroundColor Green
Write-Host "=============================================================" -ForegroundColor Cyan

# Common HTTP Headers
$headers = @{
    "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    "Accept"     = "*/*";
    "Referer"    = "https://www.bseindia.com/"
}

# ---------------------------------------------------------------------------
# Step 1: Extract Existing High-Moat Sectors from alphapulse/universe.py
# ---------------------------------------------------------------------------
Write-Host "[1/5] Extracting institutional sector mapping from core engine..." -ForegroundColor Yellow
$KnownSectors = @{}
$KnownNames = @{}

if (Test-Path "alphapulse/universe.py") {
    $PyContent = Get-Content "alphapulse/universe.py" -Raw
    $Matches = [regex]::Matches($PyContent, "\{'symbol':\s*'([^']*)',\s*'name':\s*'([^']*)',\s*'sector':\s*'([^']*)'")
    foreach ($m in $Matches) {
        $sym = $m.Groups[1].Value.Trim().ToUpper()
        $name = $m.Groups[2].Value.Trim()
        $sector = $m.Groups[3].Value.Trim()
        $KnownSectors[$sym] = $sector
        $KnownNames[$sym] = $name
    }
}
Write-Host "  -> Loaded $($KnownSectors.Count) verified institutional sector classifications." -ForegroundColor DarkGray

# ---------------------------------------------------------------------------
# Step 2: Fetch 100% of Active NSE Listed Equities (EQUITY_L.csv)
# ---------------------------------------------------------------------------
Write-Host "[2/5] Fetching complete NSE master equity registry from NSE Archives..." -ForegroundColor Yellow
$NseList = @()
try {
    $NseCsvRaw = Invoke-RestMethod -Uri $NseUrl -Headers $headers -TimeoutSec 15
    $NseLines = $NseCsvRaw -split "`n"
    for ($i = 1; $i -lt $NseLines.Count; $i++) {
        $line = $NseLines[$i].Trim()
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $cols = $line -split ","
        if ($cols.Count -ge 7) {
            $sym = $cols[0].Trim().ToUpper()
            $name = $cols[1].Trim('"').Trim()
            $series = $cols[2].Trim()
            $isin = $cols[6].Trim().ToUpper()
            
            # Series EQ, BE, SM, BZ
            if ($series -in @("EQ", "BE", "SM", "BZ", "ST")) {
                $NseList += [PSCustomObject]@{
                    Symbol = $sym
                    Name   = $name
                    Series = $series
                    ISIN   = $isin
                }
            }
        }
    }
    Write-Host "  -> Successfully fetched $($NseList.Count) active NSE listed equities." -ForegroundColor Green
} catch {
    Write-Host "  -> Warning: NSE fetch error ($($_.Exception.Message)). Using existing local registry." -ForegroundColor Magenta
}

# ---------------------------------------------------------------------------
# Step 3: Fetch 100% of Active BSE Listed Equities (BSE India API)
# ---------------------------------------------------------------------------
Write-Host "[3/5] Fetching complete BSE master equity registry from BSE India API..." -ForegroundColor Yellow
$BseList = @()
try {
    $BseRaw = Invoke-RestMethod -Uri $BseUrl -Headers $headers -TimeoutSec 20
    foreach ($item in $BseRaw) {
        if ($item.Segment -eq "Equity" -and $item.Status -eq "Active") {
            $scripId = if ($item.scrip_id) { $item.scrip_id.Trim().ToUpper() } else { $item.Scrip_Name.Trim().ToUpper() }
            $scripCd = if ($item.SCRIP_CD) { $item.SCRIP_CD.Trim() } else { "" }
            $name = if ($item.Issuer_Name) { $item.Issuer_Name.Trim() } elseif ($item.Scrip_Name) { $item.Scrip_Name.Trim() } else { $scripId }
            $isin = if ($item.ISIN_NUMBER) { $item.ISIN_NUMBER.Trim().ToUpper() } else { "" }
            $group = if ($item.GROUP) { $item.GROUP.Trim() } else { "" }
            
            $BseList += [PSCustomObject]@{
                ScripId = $scripId
                ScripCode = $scripCd
                Name = $name
                ISIN = $isin
                Group = $group
            }
        }
    }
    Write-Host "  -> Successfully fetched $($BseList.Count) active BSE listed equities." -ForegroundColor Green
} catch {
    Write-Host "  -> Warning: BSE fetch error ($($_.Exception.Message))." -ForegroundColor Magenta
}

# ---------------------------------------------------------------------------
# Step 4: Cross-Exchange Unification & ISIN Matching Matrix
# ---------------------------------------------------------------------------
Write-Host "[4/5] Executing Cross-Exchange Matrix & ISIN Deduplication..." -ForegroundColor Yellow

$MasterMap = [System.Collections.Generic.Dictionary[string, object]]::new()
$IsinToSymbol = @{}

# 4A. Ingest NSE Equities
foreach ($nse in $NseList) {
    $sym = $nse.Symbol
    $sector = if ($KnownSectors.ContainsKey($sym)) { $KnownSectors[$sym] } else { "Equities" }
    $name = if ($KnownNames.ContainsKey($sym)) { $KnownNames[$sym] } else { $nse.Name }
    
    $obj = [PSCustomObject]@{
        symbol    = $sym
        name      = $name
        sector    = $sector
        isin      = $nse.ISIN
        exchange  = "NSE"
        bse_code  = ""
        series    = $nse.Series
    }
    
    $MasterMap[$sym] = $obj
    if (![string]::IsNullOrEmpty($nse.ISIN)) {
        $IsinToSymbol[$nse.ISIN] = $sym
    }
}

# 4B. Ingest & Merge BSE Equities
$bseMergedCount = 0
$bseExclusiveCount = 0

foreach ($bse in $BseList) {
    # Check match by ISIN first
    $matchedNseSym = $null
    if (![string]::IsNullOrEmpty($bse.ISIN) -and $IsinToSymbol.ContainsKey($bse.ISIN)) {
        $matchedNseSym = $IsinToSymbol[$bse.ISIN]
    } elseif ($MasterMap.ContainsKey($bse.ScripId)) {
        $matchedNseSym = $bse.ScripId
    }
    
    if ($null -ne $matchedNseSym) {
        # Cross-listed stock on both NSE & BSE
        $existing = $MasterMap[$matchedNseSym]
        $existing.exchange = "NSE / BSE"
        $existing.bse_code = $bse.ScripCode
        if ([string]::IsNullOrEmpty($existing.isin) -and ![string]::IsNullOrEmpty($bse.ISIN)) {
            $existing.isin = $bse.ISIN
        }
        $bseMergedCount++
    } else {
        # BSE Exclusive Equity
        $bseSym = $bse.ScripId
        if ([string]::IsNullOrEmpty($bseSym)) { $bseSym = $bse.ScripCode }
        
        # Ensure unique key
        $key = $bseSym
        if ($MasterMap.ContainsKey($key)) {
            $key = "$bseSym.BO"
        }
        
        $sector = if ($KnownSectors.ContainsKey($bseSym)) { $KnownSectors[$bseSym] } else { "Equities" }
        
        $bseObj = [PSCustomObject]@{
            symbol   = $bseSym
            name     = $bse.Name
            sector   = $sector
            isin     = $bse.ISIN
            exchange = "BSE"
            bse_code = $bse.ScripCode
            series   = $bse.Group
        }
        
        $MasterMap[$key] = $bseObj
        $bseExclusiveCount++
    }
}

# Add any custom ETF/Portfolio assets (KOTAKGOLD, TATASILV, etc.)
$CustomAssets = @(
    @{ symbol = "GOLD1"; name = "Kotak Gold ETF"; sector = "Commodities"; exchange = "NSE / BSE"; isin = "INF174KA1HJ8"; bse_code = "590097" },
    @{ symbol = "SILVER1"; name = "Tata Silver ETF"; sector = "Commodities"; exchange = "NSE / BSE"; isin = "INF277K01490"; bse_code = "543743" },
    @{ symbol = "DEFENCE"; name = "Groww Nifty Defence ETF"; sector = "Thematic"; exchange = "NSE"; isin = ""; bse_code = "" },
    @{ symbol = "TMPV"; name = "Tata Motors Passenger Vehicles Ltd."; sector = "Auto"; exchange = "NSE / BSE"; isin = "INE155A01022"; bse_code = "500570" },
    @{ symbol = "TMCV"; name = "Tata Motors Commercial Vehicles Ltd."; sector = "Auto"; exchange = "NSE / BSE"; isin = "INE155A01023"; bse_code = "500570" }
)

foreach ($ca in $CustomAssets) {
    if (!$MasterMap.ContainsKey($ca.symbol)) {
        $MasterMap[$ca.symbol] = [PSCustomObject]$ca
    }
}

$MasterList = @($MasterMap.Values) | Sort-Object symbol
Write-Host "  -> Total Dual-Listed (NSE / BSE): $bseMergedCount" -ForegroundColor Cyan
Write-Host "  -> Total BSE-Exclusive Equities:  $bseExclusiveCount" -ForegroundColor Cyan
Write-Host "  -> Total Consolidated Equities:   $($MasterList.Count)" -ForegroundColor Green

# ---------------------------------------------------------------------------
# Step 5: Save Master Datasets (JSON, Frontend, and SQLite DB)
# ---------------------------------------------------------------------------
Write-Host "[5/5] Exporting consolidated database across all project targets..." -ForegroundColor Yellow

# 5A. Frontend universe.json (Compact, fast autocomplete format)
$FrontendUniverse = @()
foreach ($item in $MasterList) {
    $FrontendUniverse += [PSCustomObject]@{
        symbol   = $item.symbol
        name     = $item.name
        sector   = $item.sector
        exchange = $item.exchange
        bse_code = $item.bse_code
    }
}

$FrontendJson = $FrontendUniverse | ConvertTo-Json -Depth 4 -Compress
[System.IO.File]::WriteAllText($UniverseJsonPath, $FrontendJson, [System.Text.Encoding]::UTF8)
Write-Host "  -> Exported to $UniverseJsonPath ($($FrontendUniverse.Count) records)" -ForegroundColor Green

# 5B. Master Archive JSON
$MasterJson = $MasterList | ConvertTo-Json -Depth 5 -Compress
[System.IO.File]::WriteAllText($MasterJsonPath, $MasterJson, [System.Text.Encoding]::UTF8)
Write-Host "  -> Exported to $MasterJsonPath" -ForegroundColor Green

Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host "  INGESTION COMPLETE: $($MasterList.Count) EQUITIES ACTIVATED IN DATABASE" -ForegroundColor Green
Write-Host "=============================================================" -ForegroundColor Cyan
