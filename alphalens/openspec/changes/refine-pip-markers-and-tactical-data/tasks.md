## 1. PIP Marker Hover Refinement

- [x] 1.1 In `app.js`, separate the global marker arrays for the main chart and tactical chart (e.g. `mainPipMarkers` and `tacticalPipMarkers`) to prevent cross-contamination of states.
- [x] 1.2 Update the `subscribeCrosshairMove` listener for the main chart to clear `text` for all `mainPipMarkers` when the cursor moves off a PIP point.
- [x] 1.3 Update the `subscribeCrosshairMove` listener for the tactical chart to clear `text` for all `tacticalPipMarkers` when the cursor moves off a PIP point.
- [x] 1.4 Refactor `clearAllLabels` to use `createSeriesMarkers` correctly instead of mixing with `series.setMarkers`.

## 2. Tactical Data Rendering

- [x] 2.1 Verify and update the data assignment for `pipLineSeries` in `renderTacticalChart` to map to `p.stdY` exclusively.
- [x] 2.2 Ensure the tactical PIP extraction uses standardized prices accurately (if not already handled by `stdY`).

## 3. Pattern Projections and UI Updates

- [x] 3.1 Calculate the amplitude of the currently recognized pattern in the tactical chart context (max - min PIP value in the pattern).
- [x] 3.2 Add 1x and 2x upward projections (e.g., max + amplitude, max + 2 * amplitude) and downward projections (min - amplitude, min - 2 * amplitude) as horizontal `PriceLine` elements on the tactical chart.
- [x] 3.3 Ensure the tactical chart HTML overlay correctly labels the pattern type and its directional probabilities as requested.
