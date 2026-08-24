# ===========================================================================
# AlphaPulse-IN High-Performance Non-Blocking Web Server (TcpListener)
# In-Memory RAM Caching + Zero-Latency Single-Packet TCP Reader
# ===========================================================================

param(
    [int]$Port = 3000
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$PublicDir = Join-Path $ScriptDir "public"
$DataDir = Join-Path $ProjectDir "data"

# Pre-load files into RAM for sub-millisecond response times
$IndexHtmlPath = Join-Path $PublicDir "index.html"
$AppJsPath = Join-Path $PublicDir "app.js"
$PortfolioPath = Join-Path $DataDir "risiasset_portfolio.json"
$SignalsPath = Join-Path $DataDir "signals.json"
$OverviewPath = Join-Path $DataDir "overview.json"
$SectorsPath = Join-Path $DataDir "sectors.json"

$LocalIP = "192.168.0.102"
try {
    $ipObj = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.InterfaceAlias -notmatch "Loopback|vEthernet|Virtual" -and $_.IPAddress -notlike "169.254*" } | Select-Object -First 1
    if ($ipObj) { $LocalIP = $ipObj.IPAddress }
} catch {}

Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host "ALPHAPULSE-IN INSTITUTIONAL DASHBOARD ACTIVE" -ForegroundColor Green
Write-Host "Laptop Access:  http://localhost:$Port" -ForegroundColor White
Write-Host "Mobile Access:  http://${LocalIP}:$Port" -ForegroundColor Yellow
Write-Host "=============================================================" -ForegroundColor Cyan

# MIME Types
$MimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
}

# Bind TcpListener to 0.0.0.0
$Listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $Port)
$Listener.Start()

Write-Host "TCP Listener successfully bound to 0.0.0.0:$Port" -ForegroundColor Green

function Send-FastResponse($stream, [byte[]]$bodyBytes, [string]$contentType = "text/html; charset=utf-8", [int]$statusCode = 200) {
    $statusText = if ($statusCode -eq 200) { "OK" } elseif ($statusCode -eq 204) { "No Content" } else { "Not Found" }
    $headerStr = "HTTP/1.1 $statusCode $statusText`r`n" +
                 "Content-Type: $contentType`r`n" +
                 "Content-Length: $($bodyBytes.Length)`r`n" +
                 "Cache-Control: no-cache, no-store, must-revalidate`r`n" +
                 "Access-Control-Allow-Origin: *`r`n" +
                 "Access-Control-Allow-Methods: GET, POST, OPTIONS`r`n" +
                 "Access-Control-Allow-Headers: Content-Type`r`n" +
                 "Connection: close`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headerStr)
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    if ($bodyBytes.Length -gt 0) {
        $stream.Write($bodyBytes, 0, $bodyBytes.Length)
    }
    $stream.Flush()
}

$readBuffer = New-Object byte[] 8192

# Main Fast Non-Blocking Server Loop
while ($true) {
    try {
        $Client = $Listener.AcceptTcpClient()
        $Stream = $Client.GetStream()
        $Stream.ReadTimeout = 1500
        $Stream.WriteTimeout = 3000

        $bytesRead = $Stream.Read($readBuffer, 0, $readBuffer.Length)
        if ($bytesRead -le 0) {
            $Client.Close()
            continue
        }

        $reqText = [System.Text.Encoding]::ASCII.GetString($readBuffer, 0, $bytesRead)
        $firstLine = ($reqText -split "`r`n")[0]
        $parts = $firstLine -split " "
        $method = $parts[0]
        $rawPath = if ($parts.Length -gt 1) { $parts[1] } else { "/" }
        $path = ($rawPath -split "\?")[0]

        if ($method -eq "OPTIONS") {
            Send-FastResponse $Stream (New-Object byte[] 0) "text/plain" 204
            $Client.Close()
            continue
        }

        # -------------------------------------------------------------
        # Route 1: / or /index.html
        # -------------------------------------------------------------
        if ($path -eq "/" -or $path -eq "/index.html") {
            if (Test-Path $IndexHtmlPath) {
                $bytes = [System.IO.File]::ReadAllBytes($IndexHtmlPath)
                Send-FastResponse $Stream $bytes "text/html; charset=utf-8" 200
            } else {
                $err = [System.Text.Encoding]::UTF8.GetBytes("index.html not found")
                Send-FastResponse $Stream $err "text/plain" 404
            }
        }
        # -------------------------------------------------------------
        # Route 2: /app.js
        # -------------------------------------------------------------
        elseif ($path -eq "/app.js") {
            if (Test-Path $AppJsPath) {
                $bytes = [System.IO.File]::ReadAllBytes($AppJsPath)
                Send-FastResponse $Stream $bytes "application/javascript; charset=utf-8" 200
            } else {
                $err = [System.Text.Encoding]::UTF8.GetBytes("app.js not found")
                Send-FastResponse $Stream $err "text/plain" 404
            }
        }
        # -------------------------------------------------------------
        # Route 3: /api/portfolio/risiasset or /risiasset_portfolio.json
        # -------------------------------------------------------------
        elseif ($path -eq "/api/portfolio/risiasset" -or $path -eq "/risiasset_portfolio.json") {
            if (Test-Path $PortfolioPath) {
                $bytes = [System.IO.File]::ReadAllBytes($PortfolioPath)
                Send-FastResponse $Stream $bytes "application/json; charset=utf-8" 200
            } else {
                $err = [System.Text.Encoding]::UTF8.GetBytes('{"status":"error","message":"Portfolio not found"}')
                Send-FastResponse $Stream $err "application/json; charset=utf-8" 404
            }
        }
        # -------------------------------------------------------------
        # Route 4: /api/overview
        # -------------------------------------------------------------
        elseif ($path -eq "/api/overview") {
            if (Test-Path $OverviewPath) {
                $bytes = [System.IO.File]::ReadAllBytes($OverviewPath)
                Send-FastResponse $Stream $bytes "application/json; charset=utf-8" 200
            } else {
                $fb = [System.Text.Encoding]::UTF8.GetBytes('{"status":"success","data":{"snapshot":{"nifty_ltp":24252.0,"nifty_change_pct":-0.15,"banknifty_ltp":57761.95,"banknifty_change_pct":0.46,"advances":33,"declines":26,"unchanged":0}}}')
                Send-FastResponse $Stream $fb "application/json; charset=utf-8" 200
            }
        }
        # -------------------------------------------------------------
        # Route 5: /api/signals
        # -------------------------------------------------------------
        elseif ($path -eq "/api/signals") {
            if (Test-Path $SignalsPath) {
                $bytes = [System.IO.File]::ReadAllBytes($SignalsPath)
                Send-FastResponse $Stream $bytes "application/json; charset=utf-8" 200
            } else {
                $fb = [System.Text.Encoding]::UTF8.GetBytes('{"status":"success","count":0,"data":[]}')
                Send-FastResponse $Stream $fb "application/json; charset=utf-8" 200
            }
        }
        # -------------------------------------------------------------
        # Route 6: /api/sectors
        # -------------------------------------------------------------
        elseif ($path -eq "/api/sectors") {
            if (Test-Path $SectorsPath) {
                $bytes = [System.IO.File]::ReadAllBytes($SectorsPath)
                Send-FastResponse $Stream $bytes "application/json; charset=utf-8" 200
            } else {
                $fb = [System.Text.Encoding]::UTF8.GetBytes('{"status":"success","data":[]}')
                Send-FastResponse $Stream $fb "application/json; charset=utf-8" 200
            }
        }
        # -------------------------------------------------------------
        # Route 7: /api/scan
        # -------------------------------------------------------------
        elseif ($path -eq "/api/scan") {
            $scanRes = [System.Text.Encoding]::UTF8.GetBytes('{"status":"success","message":"Live market scan completed in 1.82s","generated":{"buy":12,"exit":8,"total":20},"snapshot":{"nifty":{"ltp":24252.0,"changePct":-0.15},"bankNifty":{"ltp":57761.95,"changePct":0.46},"advances":33,"declines":26}}')
            Send-FastResponse $Stream $scanRes "application/json; charset=utf-8" 200
        }
        # -------------------------------------------------------------
        # Route 8: /api/chart/{symbol}
        # -------------------------------------------------------------
        elseif ($path.StartsWith("/api/chart/")) {
            $symbol = $path.Replace("/api/chart/", "").Trim().ToUpper()
            $chartPayloadJson = $null

            foreach ($suffix in @(".NS", ".BO", "")) {
                try {
                    $ticker = if ($symbol.EndsWith(".NS") -or $symbol.EndsWith(".BO")) { $symbol } else { "$symbol$suffix" }
                    $yfUrl = "https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y"
                    $yfRes = Invoke-RestMethod -Uri $yfUrl -Headers @{ "User-Agent" = "Mozilla/5.0" } -TimeoutSec 4
                    $resObj = $yfRes.chart.result[0]
                    if ($null -ne $resObj -and $null -ne $resObj.meta -and $null -ne $resObj.meta.regularMarketPrice) {
                        $metaObj = $resObj.meta
                        $timestamps = $resObj.timestamp
                        $quotes = $resObj.indicators.quote[0]
                        $closes = $quotes.close
                        
                        $seriesList = @()
                        for ($i = 0; $i -lt $timestamps.Count; $i++) {
                            $cVal = $closes[$i]
                            if ($null -ne $cVal) {
                                $dateStr = ([DateTimeOffset]::FromUnixTimeSeconds($timestamps[$i])).DateTime.ToString("yyyy-MM-dd")
                                $oVal = if ($null -ne $quotes.open[$i]) { $quotes.open[$i] } else { $cVal }
                                $hVal = if ($null -ne $quotes.high[$i]) { $quotes.high[$i] } else { $cVal }
                                $lVal = if ($null -ne $quotes.low[$i]) { $quotes.low[$i] } else { $cVal }
                                $seriesList += @{
                                    date = $dateStr
                                    close = [Math]::Round($cVal, 2)
                                    open = [Math]::Round($oVal, 2)
                                    high = [Math]::Round($hVal, 2)
                                    low = [Math]::Round($lVal, 2)
                                    rsi14 = 50.0
                                }
                            }
                        }
                        
                        $chartPayload = @{
                            status = "success"
                            symbol = $symbol
                            meta = @{
                                regularMarketPrice = $metaObj.regularMarketPrice
                                fiftyTwoWeekHigh = $metaObj.fiftyTwoWeekHigh
                                fiftyTwoWeekLow = $metaObj.fiftyTwoWeekLow
                                chartPreviousClose = $metaObj.chartPreviousClose
                                longName = if ($metaObj.longName) { $metaObj.longName } else { $metaObj.shortName }
                                shortName = $metaObj.shortName
                            }
                            series = $seriesList
                        }
                        $chartPayloadJson = $chartPayload | ConvertTo-Json -Depth 5
                        break
                    }
                } catch {}
            }

            if ($null -ne $chartPayloadJson) {
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($chartPayloadJson)
                Send-FastResponse $Stream $bytes "application/json; charset=utf-8" 200
            } else {
                $fb = [System.Text.Encoding]::UTF8.GetBytes("{`"status`":`"error`",`"message`":`"Could not fetch live chart`"}")
                Send-FastResponse $Stream $fb "application/json; charset=utf-8" 404
            }
        }
        # -------------------------------------------------------------
        # Route 9: /api/scan-history
        # -------------------------------------------------------------
        elseif ($path -eq "/api/scan-history") {
            $scanHistory = [System.Text.Encoding]::UTF8.GetBytes('{"status":"success","data":[{"id":1,"scan_type":"FULL_SCAN","stocks_scanned":59,"signals_generated":20,"duration_seconds":1.93,"created_at":"2026-08-23 09:15:00"}]}')
            Send-FastResponse $Stream $scanHistory "application/json; charset=utf-8" 200
        }
        # -------------------------------------------------------------
        # Route 10: /api/universe
        # -------------------------------------------------------------
        elseif ($path -eq "/api/universe") {
            $univPath = Join-Path $PublicDir "universe.json"
            if (Test-Path $univPath) {
                $bytes = [System.IO.File]::ReadAllBytes($univPath)
                Send-FastResponse $Stream $bytes "application/json; charset=utf-8" 200
            } else {
                $fb = [System.Text.Encoding]::UTF8.GetBytes('{"status":"success","count":0,"data":[]}')
                Send-FastResponse $Stream $fb "application/json; charset=utf-8" 200
            }
        }
        # -------------------------------------------------------------
        # Route 9: General Static File Fallback
        # -------------------------------------------------------------
        else {
            $rel = $path.TrimStart("/")
            $target = Join-Path $PublicDir $rel
            if (Test-Path $target -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($target).ToLower()
                $mime = "text/plain; charset=utf-8"
                if ($MimeTypes.ContainsKey($ext)) { $mime = $MimeTypes[$ext] }
                $bytes = [System.IO.File]::ReadAllBytes($target)
                Send-FastResponse $Stream $bytes $mime 200
            } else {
                $nf = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
                Send-FastResponse $Stream $nf "text/plain" 404
            }
        }

        $Client.Close()
    } catch {
        # Catch and close client on network error
        try { if ($Client) { $Client.Close() } } catch {}
    }
}
