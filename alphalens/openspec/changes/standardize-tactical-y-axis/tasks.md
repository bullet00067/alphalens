## 1. Tactical Chart Y-Axis Configuration

- [x] 1.1 Update `pipChartInstance` configuration in `renderTacticalChart` to remove currency formatting (set `priceFormat` to a generic numeric type).
- [x] 1.2 Configure `rightPriceScale` to show appropriate decimal precision for normalized values (e.g., 2 or 3 decimals).

## 2. Geometric Pattern and Probability Visualization

- [x] 2.1 Implement/Update `renderPatternGeometry` to draw trend lines on the tactical chart using standardized Y-values.
- [x] 2.2 Enhance `patternLabel` UI to display color-coded Bullish/Bearish percentages with icons.
- [x] 2.3 Ensure helper lines are cleared and redrawn whenever a new pattern is detected or data is updated.

## 3. Tooltip and Label Refinement

- [x] 3.1 Modify the `subscribeCrosshairMove` listener for `pipChartInstance` to replace the `P: $` label with `Value: ` in marker tooltips.
- [x] 3.2 Ensure the `standardize-stats` header or label is visible to inform the user about the unit change.

## 4. Verification and Sync Check

- [x] 4.1 Verify pixel-perfect alignment between main chart and tactical chart after axis reconfiguration.
- [x] 4.2 Test horizontal synchronization (zooming/panning) to ensure timescale consistency is maintained.
