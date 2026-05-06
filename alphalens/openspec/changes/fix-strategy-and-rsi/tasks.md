# Tasks: Strategy & RSI Fixes

## Phase 1: Logic Fixes
- [x] Update `calculateAISignals` in `app.js` to truncate candle history (last 200).
- [x] Refactor Stop Loss/Target formulas to be adaptive to `currentPrice`.
- [x] Verify point calculations for high-value stocks (e.g., 2330.TW).

## Phase 2: UI Fixes
- [x] Fix `toggleRSI` in `app.js` to clear container and old instances.
- [x] Add check to `renderTradingViewChart` to ensure RSI is properly handled during timeframe switches.

## Phase 3: Verification
- [x] Manually test clicking RSI button multiple times.
- [x] Verify horizontal lines for 2330.TW appear at reasonable price levels (~2100-2400).
