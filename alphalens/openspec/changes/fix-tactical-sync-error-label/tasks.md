## 1. Label Updates

- [x] 1.1 In `app.js`, locate the ternary operator that defines `const text = ... 'Sync Error'`.
- [x] 1.2 Change `'Sync Error'` to `'Verify Error'` or `'Unverified'`.
- [x] 1.3 Update the color for `'ERROR'` status from `#ef4444` to `#94a3b8` (Slate-400) or similar to make it less alarming.

## 2. Real Sync Implementation (Optional Enhancement)

- [x] 2.1 Add a check in `refreshPipAnalysis` to compare `currentStockChart.timeScale().getVisibleLogicalRange()` with `pipChartInstance.timeScale().getVisibleLogicalRange()`.
- [x] 2.2 If a mismatch is found, override the status badge text to `SYNC ERROR` in bright red (`#ef4444`).

## 3. Sidebar UI Sync

- [x] 3.1 Update the `validationContainer.innerHTML` template to use the new naming.
