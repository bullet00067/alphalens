# Proposal: Strategy Label Alignment & Portfolio State Fix

## Goal
Resolve UI inconsistencies in the AI Strategy engine, fix index data mapping for S&P 500, and restore the "Add Holding" functionality for non-logged-in users.

## Objectives
1. **Strategy Label Alignment**: Update `generatePIPSignal` to recognize and display the `BEARISH` status correctly in Chinese.
2. **Index Data Mapping**: Ensure S&P 500 (`^GSPC`) correctly fetches historical data from Twelve Data by using compatible symbol mapping.
3. **Local Portfolio Sync**: Fix the local storage branch of `addToPortfolioFromForm` to refresh the UI after adding a new asset.

## Proposed Changes
- **app.js**:
  - Add `renderPortfolio()` and `fetchPortfolioQuotes()` calls to the local storage branch of `addToPortfolioFromForm`.
  - Add a symbol mapping helper for Twelve Data to handle indices like `^GSPC`.
- **strategyEngine.js**:
  - Update `generatePIPSignal` to handle `BEARISH` trend status with a proper Chinese label.
