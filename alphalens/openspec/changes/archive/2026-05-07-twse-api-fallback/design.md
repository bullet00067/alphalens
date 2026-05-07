# Design: TWSE API Fallback Mechanism

## Architecture
The fallback mechanism will operate at the data fetching layer.

### 1. Vite Proxy Configuration
Add a new proxy entry for TWSE:
```javascript
'/twse': {
  target: 'https://www.twse.com.tw',
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/twse/, '')
}
```

### 2. Data Fetching Logic (app.js)
- **New Function**: `fetchTwseFallbackCandles(ticker)`
  - URL: `/twse/exchangeReport/STOCK_DAY?response=json&date=${today}&stockNo=${ticker}`
  - Mapping: Map TWSE's array format `[Date, Volume, Amount, Open, High, Low, Close, Spread, Count]` to `{time, open, high, low, close, volume}`.
  - Time conversion: Convert `113/05/07` (Minguo calendar) to `2024-05-07`.

### 3. Orchestration
Update `fetchTwseCandles`:
```javascript
try {
  // Try FinMind
} catch (err) {
  if (isQuotaError(err)) {
    return await fetchTwseFallbackCandles(ticker);
  }
  throw err;
}
```

## UI/UX
- Show a subtle indicator or toast when fallback is active (optional, but good for transparency).
- Ensure the chart title reflects that data is from a fallback source if possible.
