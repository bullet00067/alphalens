# Design: Strategy Label & Portfolio Fix

## Logic Updates
### 1. Strategy Engine (strategyEngine.js)
- **Status Mapping**: Add `BEARISH` case to `generatePIPSignal`.
  - Label: `🔴 空頭勢頭` (Bearish Momentum)
  - Color: `#ef4444`

### 2. Portfolio Management (app.js)
- **State Refresh**: In `addToPortfolioFromForm`, the local branch needs to trigger the same refresh logic as the cloud branch.
- **Symbol Translation**: In `fetchUSCandles`, translate Yahoo-style index symbols to Twelve Data format:
  - `^GSPC` -> `SPX`
  - `^IXIC` -> `IXIC`
  - `^NDX` -> `NDX`

## UI/UX Improvements
- Ensure the toast notification correctly reflects whether the asset was added locally or to the cloud.
