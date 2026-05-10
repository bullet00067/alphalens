# Proposal: Fix Tactical Chart Visibility and Tooltip Persistence

## Goal
Restore the TACTICAL chart's core functionality by ensuring its visibility, adding geometric pattern visualization (auxiliary lines), and resolving the persistent tooltip bug that leaves labels on the chart after mouse exit.

## Why
- **Tactical Chart Visibility**: The TACTICAL chart is a key feature for visualizing Perceptually Important Points (PIP) and detected patterns. Its disappearance hinders decision-making.
- **Geometric Evidence**: PRD requirements state that detected patterns (e.g., Triangles, Rectangles) must be supported by visual auxiliary lines and clear text labels to build user trust.
- **UX Stability**: The Tooltip persistence bug (labels staying on chart) creates visual clutter and a "broken" feel to the interface, which was previously attempted but remains unresolved in practice.

## Scope
1. **Chart Restoration**: Debug and fix the initialization/visibility logic for the `pipChart` container.
2. **Geometric Overlays**: Implement auxiliary line drawing for common patterns (Ascending Triangle, Rectangle, etc.) on the TACTICAL chart.
3. **Pattern Labeling**: Add on-chart text labels to identify the specific pattern being visualized.
4. **Tooltip Persistence Fix**: Overhaul the `subscribeCrosshairMove` logic to ensure all markers and tooltips are cleared when the cursor leaves the series or the chart area.
