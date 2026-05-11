## 1. API Standardization

- [x] 1.1 In `app.js`, remove `createSeriesMarkers` from the `lightweight-charts` import on line 1.
- [x] 1.2 Global find and replace `createSeriesMarkers(series, markers)` with `series.setMarkers(markers)`.
- [x] 1.3 Fix the `clearAllLabels` helper function inside `renderTradingViewChart` to use `series.setMarkers(markers.map(m => ({ ...m, text: "" })))`.

## 2. Verification

- [x] 2.1 Verify hover behavior on the main chart (only 1 label at a time).
- [x] 2.2 Verify hover behavior on the tactical chart (only 1 label at a time).
- [x] 2.3 Ensure no console errors about `createSeriesMarkers` being undefined.
