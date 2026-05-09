# Walkthrough: Sync Tactical Time Scale

I have synchronized the TACTICAL chart's time axis with the main K-line chart using the "Ghost Series" technique and initialized the range correctly.

## Changes Made

### 1. Ghost Series Implementation
Added a transparent `pipGhostSeries` to the tactical chart in `app.js`. This series contains all timestamps from the original stock data.
- **Why**: `lightweight-charts` uses indices for synchronization. Since PIP data is sparse (only significant points), its indices didn't match the main chart. The Ghost Series forces the tactical chart to have the exact same number of "slots" as the main chart.

### 2. Initial Range Sync
Added a `setTimeout` block during tactical chart initialization to explicitly set its `visibleLogicalRange` to match the main chart.
- **Why**: When the tactical panel is first toggled on, it might default to showing its entire history. This ensures it immediately snaps to the same view as the K-line chart.

### 3. Bidirectional Synchronization
Refined the event listeners to ensure that zooming or scrolling on either chart updates the other instantly.

## Verification Results

- **1:1 Alignment**: Verified that the tactical chart's X-axis indices now map 1:1 to the main chart's candle indices.
- **Dynamic Sync**: Dragging the main chart now scrolls the tactical chart in perfect unison.
- **Initial State**: Opening the tactical panel now immediately shows the same time period as the main chart.
