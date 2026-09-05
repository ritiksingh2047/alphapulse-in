import pandas as pd
import requests
import io
import os
import ast
import re

url = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv"
headers = {"User-Agent": "Mozilla/5.0"}
res = requests.get(url, headers=headers)
df = pd.read_csv(io.StringIO(res.text))

df = df[df[' SERIES'].str.strip() == 'EQ']

with open('alphapulse/universe.py', 'r', encoding='utf-8') as f:
    old_content = f.read()

match_universe = re.search(r'NSE_UNIVERSE:\s*list\[dict\]\s*=\s*(\[.*?\])', old_content, re.DOTALL)
if match_universe:
    existing_universe = ast.literal_eval(match_universe.group(1))
else:
    existing_universe = []

match_nifty = re.search(r'NIFTY_50_SYMBOLS:\s*list\[str\]\s*=\s*(\[.*?\])', old_content, re.DOTALL)
nifty_50_text = match_nifty.group(1) if match_nifty else "[]"

existing_symbols = {item['symbol']: item for item in existing_universe}

new_universe = []
for index, row in df.iterrows():
    sym = row['SYMBOL'].strip()
    name = row['NAME OF COMPANY'].strip()
    
    if sym in existing_symbols:
        new_universe.append(existing_symbols[sym])
    else:
        new_universe.append({
            "symbol": sym,
            "name": name,
            "sector": "General"
        })

new_symbols_set = set([s['symbol'] for s in new_universe])
for sym, data in existing_symbols.items():
    if sym not in new_symbols_set:
        new_universe.append(data)

new_universe = sorted(new_universe, key=lambda x: x['symbol'])

print(f"Successfully fetched and merged. Total stocks: {len(new_universe)}")

new_py = '"""Comprehensive NSE 2000+ Universe covering all listed equities on the National Stock Exchange."""\n\n'
new_py += 'NSE_UNIVERSE: list[dict] = [\n'
for item in new_universe:
    name_escaped = item['name'].replace("'", "\\'")
    new_py += f'    {{"symbol": "{item["symbol"]}", "name": "{name_escaped}", "sector": "{item["sector"]}"}},\n'
new_py += ']\n\n'

new_py += f'NIFTY_50_SYMBOLS: list[str] = {nifty_50_text}\n\n'
new_py += 'def get_all_tickers() -> list[str]:\n'
new_py += '    return [s["symbol"] + ".NS" for s in NSE_UNIVERSE]\n\n'
new_py += 'def get_by_sector(sector: str) -> list[dict]:\n'
new_py += '    return [s for s in NSE_UNIVERSE if s["sector"] == sector]\n'

with open('alphapulse/universe.py', 'w', encoding='utf-8') as f:
    f.write(new_py)
