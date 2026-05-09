# Proposal: Align Tactical Chart Layout

Align the right price scale of the TACTICAL chart with the main K-line chart to ensure vertical grid alignment, making it easier for users to correlate structural points with price action.

## Problem Statement

Currently, the TACTICAL chart and the main K-line chart have different widths for their right price scales. This causes a horizontal offset between the actual plotting areas (the grid) of the two charts, even when the time scales are synchronized. 
- **Visual Disconnect**: Users have trouble tracing a vertical line from a PIP point down to the corresponding candle because the charts are shifted.
- **Inconsistent Margins**: The right edge of the grid area doesn't line up, creating a jagged visual appearance.

## Proposed Solution

1.  **Set Minimum Price Scale Width**:
    - Configure both `currentStockChart` and `pipChartInstance` to have a fixed `minimumWidth` for the right price scale.
    - This ensures that even if price values have different digit counts (e.g., $26.08 vs $240.00), the scale takes up the same horizontal space.
2.  **Verify Margin Alignment**:
    - Ensure that the chart containers have identical padding and margin settings in CSS.

## Goals
- Achieve perfect vertical alignment between the main chart grid and the tactical chart grid.
- Improve the usability of the dual-chart view for precise technical analysis.

## Non-Goals
- Changing the content or scaling of the charts.
- Modifying the crosshair synchronization logic (which is already implemented).
