# Tasks: Strategy Label & Portfolio Fix

## Phase 1: Logic & State Fixes
- [ ] **Fix Local Portfolio Refresh**: Add UI refresh calls to `addToPortfolioFromForm` local branch.
- [ ] **Bearish Label Implementation**: Add `BEARISH` status handling to `generatePIPSignal` in `strategyEngine.js`.
- [ ] **Twelve Data Index Mapping**: Implement symbol translation for indices in `fetchUSCandles`.

## Phase 2: Verification
- [ ] **Verify BEARISH label**: Load a downtrending stock (e.g. recent AAPL or a known weak stock) and check the label.
- [ ] **Verify Index Data**: Click S&P 500 and verify the chart loads with candles.
- [ ] **Verify Add Holding**: Add a stock while logged out and verify it appears in the table immediately.
