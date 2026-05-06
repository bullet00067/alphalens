# Design: Strategy Logic Optimization & RSI Bug Fix

## Strategy Logic Refinement

### 1. Context Truncation
In `app.js` -> `calculateAISignals`, instead of passing the full `candles` array to `findPIPs`, we will pass `candles.slice(-200)`. This ensures that the trend analysis and troughs are relevant to the current price level.

### 2. Adaptive Baseline
Current formula:
`const entryPrice = portfolioItem ? portfolioItem.cost : lastPrice;`
`stopLoss = lastTrough > 0 ? Math.min(lastTrough, entryPrice - (1.5 * atr)) : entryPrice - (2 * atr);`

New Proposed Formula:
- Base the tactical stop loss on `lastPrice` rather than `cost` if `lastPrice` is significantly higher.
- `tacticalBase = Math.max(lastPrice, entryPrice)` (or just use `lastPrice` for tactical signals).
- `stopLoss = Math.max(lastTrough, lastPrice - (2 * atr))`.
- This ensures the Stop Loss "trails" up as the stock appreciates.

## RSI Bug Fix

### 1. Instance Management
In `toggleRSI(active)`:
- If `active` is true:
  - Check if `rsiChart` exists. If so, `rsiChart.remove()`.
  - Set `rsiContainer.innerHTML = ''`.
  - Initialize new `rsiChart`.

## UI Feedback
- Ensure the AI Signal Card values update immediately when ticker data is reloaded.
