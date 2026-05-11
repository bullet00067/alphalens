## Why

Users are reporting that PIP labels are stacking on the chart, with multiple labels visible simultaneously, creating significant visual clutter. This persists even after moving the cursor away. 

Root Cause Analysis:
The current implementation uses a `createSeriesMarkers(series, markers)` function imported from `lightweight-charts`. In standard `lightweight-charts` v5, this function is NOT a standard export and its behavior might be additive (appending markers) rather than declarative (setting the state). The official way to manage markers is `series.setMarkers(markers)`, which guarantees that the provided list replaces all previous markers for that series.

## What Changes

1. **Standardize Marker API**: Replace all occurrences of `createSeriesMarkers(series, markers)` with `series.setMarkers(markers)`.
2. **Clean up Imports**: Remove `createSeriesMarkers` from the `lightweight-charts` import list in `app.js`.
3. **Robust State Management**: Ensure that whenever `setMarkers` is called (during hover or chart refresh), we pass the absolute current state of markers to prevent any "leaked" text labels.
4. **Synchronize Main and Tactical**: Apply the same fix to both the main candlestick series and the tactical PIP line series.

## Impact

- `app.js`: Refactor all marker setting logic to use the standard API.
