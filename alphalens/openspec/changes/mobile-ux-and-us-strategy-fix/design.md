# Design: Mobile UX & Strategy Fix

## UI/UX Refinement
- **Mobile Portfolio**: The current table uses `.portfolio-table` but CSS looks for `.table-container`. We will unify these classes and ensure `overflow-x: hidden` on the parent view to prevent truncation.
- **Index Interaction**:
  - S&P 500 card -> `loadStockDetail('^GSPC')`
  - NASDAQ card -> `loadStockDetail('^IXIC')`
  - TWSE card -> `loadStockDetail('^TWII')` (or 0000.TW)
- **Responsive Layout**: Adjust the `indices-grid` to use smaller gap and padding in landscape/mobile to fit more content.

## Strategy Logic Debugging
- **US Stocks "Neutral" Issue**: 
  - Verification: Check if `findPIPs` returns enough points for US stocks.
  - Fix: If US stock prices have higher variance, the `adaptiveThreshold` in `analyzeTrend` might need scaling factor adjustment.
  - Data Check: Ensure historical data from Twelve Data has enough depth (at least 60-120 days).
