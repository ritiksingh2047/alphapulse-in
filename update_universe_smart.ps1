$PyPath = "alphapulse/universe.py"
$Url = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv"
$UniversePath = "web/public/universe.json"

$ExistingMap = @{}

# 1. Parse universe.py for existing data
$PyContent = Get-Content $PyPath -Raw
$Matches = [regex]::Matches($PyContent, "\{'symbol':\s*'([^']*)',\s*'name':\s*'([^']*)',\s*'sector':\s*'([^']*)'(?:,\s*'cap':\s*'([^']*)')?\}")

foreach ($m in $Matches) {
    $symbol = $m.Groups[1].Value
    $name = $m.Groups[2].Value
    $sector = $m.Groups[3].Value
    
    $obj = @{
        symbol = $symbol
        name = $name
        sector = $sector
    }
    $ExistingMap[$symbol] = $obj
}

Write-Host "Extracted $($ExistingMap.Count) stocks with sectors from universe.py"

# 2. Fetch CSV
$CsvData = Invoke-RestMethod -Uri $Url -Headers @{"User-Agent"="Mozilla/5.0"}
$Lines = $CsvData -split "`n"

$NewUniverse = New-Object System.Collections.Generic.List[object]

for ($i = 1; $i -lt $Lines.Count; $i++) {
    $line = $Lines[$i].Trim()
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    
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

# Add remaining from python file
foreach ($key in $ExistingMap.Keys) {
    $NewUniverse.Add($ExistingMap[$key])
}

$Sorted = $NewUniverse | Sort-Object symbol

$Sorted | ConvertTo-Json -Depth 5 -Compress | Set-Content -Encoding UTF8 $UniversePath
Write-Host "Successfully generated universe.json with $($Sorted.Count) total stocks!"
