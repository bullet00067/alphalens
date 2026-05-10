# Proposal: Refine Tactical Patterns and Sync

## Goal
Resolve UI regression issues where PIP labels fail to appear on hover, fix persistent chart time scale misalignment, and enhance the TACTICAL chart with auxiliary pattern lines and predictive probabilities (Bullish/Bearish).

## Context
The user identified three core issues after the previous standardization update:
1. **Interactive Tooltips**: Hovering over PIP markers on the main chart no longer displays the price/volume information.
2. **TimeScale Alignment**: The main chart and the lower tactical chart are offset, making multi-chart analysis difficult.
3. **Pattern Visualization**: The TACTICAL chart shows the PIP line but lacks the geometric context (trendlines) and the AI's probabilistic assessment of the pattern's direction.

## Proposed Solution
- **Tooltip Fix**: Standardize the use of `createSeriesMarkers` for all dynamic marker updates to ensure compatibility with the project's library wrapper.
- **Alignment Fix**: Sync charts using identical `rightPriceScale` width and enforce a strict `VisibleLogicalRange` lock between instances.
- **Pattern Enhancement**:
    - Draw dashed trendlines (Upper/Lower) directly on the TACTICAL chart for Triangles and Rectangles.
    - Calculate and display "Bullish" vs "Bearish" probabilities based on technical pattern rules (e.g., breakout direction bias).

## Verification Plan
1. **Localhost**:
    - Verify hover labels on AAPL/TSLA.
    - Drag the main chart and confirm the tactical chart moves in perfect sync.
    - Confirm patterns like "Ascending Triangle" show dashed auxiliary lines and probability percentages.
2. **Production (Render)**:
    - Push to GitHub and verify stability on the live deployment.
