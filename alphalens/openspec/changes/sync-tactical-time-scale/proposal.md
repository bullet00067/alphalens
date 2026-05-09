# Proposal: Sync Tactical Time Scale

Synchronize the TACTICAL chart's time axis with the main K-line chart to ensure they always show the same period, allowing for direct technical comparison.

## Problem Statement

Currently, the TACTICAL chart often displays a different time range or scale than the main chart.
- **Sparse Data**: Because the PIP series only has significant turning points, the chart's index-based logical range doesn't map 1:1 to the main chart's candle indices.
- **Visual Disconnect**: Users cannot see the alignment between a specific price candle and its structural representation in the tactical panel.

## Proposed Solution

1.  **Ghost Series Technique**:
    - Introduce a hidden (transparent) series in the TACTICAL chart that contains every single timestamp from the main chart's candle data.
    - This forces the TACTICAL chart to have the same number of X-axis "ticks" as the main chart, ensuring that index `i` on both charts refers to the same point in time.
2.  **Forced Initial Sync**:
    - Immediately after creating the TACTICAL chart, capture the current visible range of the main chart and apply it to the new chart instance.
3.  **Robust Event Listeners**:
    - Ensure bidirectional synchronization for scrolling and zooming.

## Goals
- Achieve 1:1 time-axis alignment between Main and Tactical charts.
- Maintain synchronization during all interactive actions (zoom, pan).
