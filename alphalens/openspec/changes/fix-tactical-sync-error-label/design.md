## Goals

- Eliminate the misleading "SYNC ERROR" label when the issue is merely a failed Yahoo Finance verification.
- Provide a clear distinction between "Data Verification" (price check) and "Chart Sync" (time alignment).

## Proposed Changes

### 1. Label Renaming
Modify the ternary operator in `renderTacticalChart` to show `Verify Error` or `Unverified` instead of `Sync Error`.

### 2. Time-Scale Synchronization Check
Add a logic block to `refreshPipAnalysis` that verifies the time range alignment:
```js
const mainRange = currentStockChart.timeScale().getVisibleLogicalRange();
const pipRange = pipChartInstance.timeScale().getVisibleLogicalRange();
const isSynced = areRangesEqual(mainRange, pipRange);
```
Display a separate indicator or update the status badge if `!isSynced`.

### 3. UI Styling
Change the color of `Verify Error` from bright red (`#ef4444`) to a more neutral gray or orange if it's a common API limitation, keeping red only for actual sync failures.
