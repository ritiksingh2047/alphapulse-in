$Url = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv"
$UniversePath = "web/public/universe.json"

Write-Host "Fetching official NSE master list..."

# Fetch CSV
$CsvData = Invoke-RestMethod -Uri $Url -Headers @{"User-Agent"="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

# Read existing JSON to preserve sectors and Nifty 50 info
$ExistingData = @()
if (Test-Path $UniversePath) {
    $ExistingData = Get-Content $UniversePath -Raw | ConvertFrom-Json
}

$ExistingMap = @{}
foreach ($item in $ExistingData) {
    $ExistingMap[$item.symbol] = $item
}

$NewUniverse = New-Object System.Collections.Generic.List[object]
$Lines = $CsvData -split "`n"

for ($i = 1; $i -lt $Lines.Count; $i++) {
    $line = $Lines[$i].Trim()
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    
    # Split handling quoted commas roughly (NSE CSV usually just splits fine, but we take first 3)
    $cols = $line -split ","
    if ($cols.Count -lt 3) { continue }
    
    $symbol = $cols[0].Trim()
    $name = $cols[1].Trim('"').Trim()
    $series = $cols[2].Trim()
    
    if ($series -eq "EQ" -or $series -eq "BE" -or $series -eq "SM") {
        if ($ExistingMap.ContainsKey($symbol)) {
            $NewUniverse.Add($ExistingMap[$symbol])
            $ExistingMap.Remove($symbol)
        } else {
            $obj = @{
                symbol = $symbol
                name = $name
                sector = "Equities"
            }
            $NewUniverse.Add($obj)
        }
    }
}

# Add remaining from existing (ETFs, Indices)
foreach ($key in $ExistingMap.Keys) {
    $NewUniverse.Add($ExistingMap[$key])
}

# Sort by symbol
$Sorted = $NewUniverse | Sort-Object symbol

# Save
$Sorted | ConvertTo-Json -Depth 5 -Compress | Set-Content -Encoding UTF8 $UniversePath
Write-Host "Successfully generated universe.json with $($Sorted.Count) stocks!"
