# Proposal: Refactor Chart Initialization and Fix TACTICAL Toggle

This refactor decouples the chart rendering logic from the data fetching process. This resolves the bug where toggling TACTICAL causes the main chart to disappear due to redundant UI resets and data re-fetching.

## Problems
- **Redundant Data Fetching**: `togglePipTactical` calls `loadStockDetail`, which triggers a full API fetch and UI reset.
- **UI Flicker/Disappearance**: `loadStockDetail` resets the main chart container and info panels before data arrives.
- **Monolithic Function**: `loadChartData` contains too much logic (main chart setup, tactical chart setup, sync setup, AI signal generation).

## Proposed Changes

### 1. Extract `renderTacticalChart(candles)`
- Create a dedicated function to initialize and update the tactical panel.
- This function will be called by `loadChartData` (on first load) and `togglePipTactical` (on toggle).

### 2. Extract `updateAISignals(candles)`
- Move the AI signal card logic into its own function.

### 3. Update `togglePipTactical`
- Remove the call to `loadStockDetail(ticker)`.
- Directly call `renderTacticalChart(currentChartData)` if enabled.
- Ensure the main chart remains untouched or just synchronized.

### 4. Cleanup `loadChartData`
- It should now just call:
  - `renderTradingViewChart(candles)`
  - `renderTacticalChart(candles)` (if enabled)
  - `updateAISignals(candles)`
