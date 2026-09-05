const fs = require('fs');
const https = require('https');

const url = 'https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv';
const universePath = 'web/public/universe.json';

https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    // Parse existing universe to keep sectors
    let existingUniverse = [];
    try {
      existingUniverse = JSON.parse(fs.readFileSync(universePath, 'utf8'));
    } catch (e) {
      console.log('No existing universe.json found.');
    }
    
    const existingSymbols = new Map();
    existingUniverse.forEach(item => existingSymbols.set(item.symbol, item));

    const lines = data.split('\n');
    const newUniverse = [];
    
    // Skip header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      // SYMBOL,NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE
      // e.g. 20MICRONS,20 Microns Limited,EQ,06-OCT-2008,5,1,INE144J01027,5
      // Note: Commas can be inside quotes for company names.
      // A simple split by comma might break if company name has comma, but NSE EQUITY_L generally avoids commas in company names, or quotes them.
      // Let's use a basic CSV regex split.
      const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      if (cols.length < 3) continue;
      
      const symbol = cols[0].trim();
      const name = cols[1].replace(/^"|"$/g, '').trim();
      const series = cols[2].trim();
      
      if (series === 'EQ' || series === 'BE' || series === 'SM') {
        if (existingSymbols.has(symbol)) {
          newUniverse.push(existingSymbols.get(symbol));
        } else {
          newUniverse.push({
            symbol: symbol,
            name: name,
            sector: "Equities" // Default sector for new stocks
          });
        }
      }
    }
    
    // Add any existing that might have been skipped (indices, ETFs)
    const newSymbolsSet = new Set(newUniverse.map(s => s.symbol));
    existingUniverse.forEach(item => {
      if (!newSymbolsSet.has(item.symbol)) {
        newUniverse.push(item);
      }
    });
    
    // Sort alphabetically
    newUniverse.sort((a, b) => a.symbol.localeCompare(b.symbol));
    
    fs.writeFileSync(universePath, JSON.stringify(newUniverse, null, 2));
    console.log(`Successfully generated universe.json with ${newUniverse.length} stocks!`);
  });
}).on('error', err => {
  console.error('Error fetching NSE list:', err.message);
});
