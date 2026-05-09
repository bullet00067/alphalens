# Design: Sync Tactical Time Scale

Technical implementation for time-scale alignment using a ghost series and range synchronization.

## Implementation Details

### 1. The Ghost Series (X-Axis Anchor)
To make `logicalRange` synchronization work, both charts must share the same index-to-time mapping.
- **Series Type**: `LineSeries` with `visible: false`.
- **Data**: All timestamps from `candles` with a dummy value (e.g., `close` price to ensure Y-axis bounds aren't distorted, though it's hidden).
- **Update**: This series must be updated whenever `loadChartData` is called.

### 2. Synchronization Logic
- **Initialization**: 
  ```javascript
  const mainRange = currentStockChart.timeScale().getVisibleLogicalRange();
  if (mainRange) pipChartInstance.timeScale().setVisibleLogicalRange(mainRange);
  ```
- **Bidirectional Sync**:
  ```javascript
  currentStockChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      pipChartInstance.timeScale().setVisibleLogicalRange(range);
  });
  pipChartInstance.timeScale().subscribeVisibleLogicalRangeChange(range => {
      currentStockChart.timeScale().setVisibleLogicalRange(range);
  });
  ```

### 3. State Management
- Add `let pipGhostSeries = null;` to the global variable section in `app.js`.
- Clean up this series in `togglePipTactical`.

## Verification Plan
- **Alignment Check**: Scroll the main chart and verify the TACTICAL chart moves in perfect unison.
- **Range Check**: Zoom in/out and verify both charts show the same number of days/hours.
- **Crosshair Check**: Verify the crosshair highlights the same date/time on both charts.
