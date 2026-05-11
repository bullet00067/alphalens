## Why

Three bugs remain in the AlphaLens TACTICAL dashboard:

1. **PIP hover label bleed**: When hovering over one PIP marker on the main chart, ALL other PIP marker labels remain visible simultaneously, creating a cluttered UI. Only the hovered marker should show its label.

2. **TACTICAL pattern detection fails**: The tactical chart never identifies any pattern (Triangle, Rectangle, Double Top/Bottom etc.). Root cause: `renderTacticalChart` passes the *entire* candle history to `generatePIPSignal`, so `identifyPatterns` checks peaks/troughs spanning hundreds of candles — no recognizable pattern can form at that scale. Additionally, `findPIPs` returns candle objects spread with `...data[idx]`, which have no `stdY` field, so `pipLineSeries.setData(allPips.map(p => ({ time: p.time, value: p.stdY })))` silently produces `undefined` values and the line renders incorrectly.

3. **Amplitude target labels in σ units**: The 1x/2x upside/downside projection lines on the TACTICAL chart show Z-Score values (e.g. `1.5σ`). The user wants the label text to display the equivalent **stock price** (e.g. `▲1x: $350.00`) while keeping the line position in σ space, because stock price is what traders act on.

## What Changes

- **Fix hover bleed**: Ensure the `subscribeCrosshairMove` handler always resets ALL marker texts to `""` before setting the hovered one's text — and that `mainPipMarkers` state is always consistent with what was last rendered.
- **Fix stdY calculation**: Compute `stdY` for every PIP point inside `renderTacticalChart` (using the same log-normalization already applied to the ghost series) before passing to `pipLineSeries`. Store `{ mean, std }` in module-level variables so they can be reused for price ↔ σ conversion.
- **Fix TACTICAL pattern detection**: Use the *visible* candle window (last ~60 candles, matching what `refreshPipAnalysis` uses) for initial `generatePIPSignal` call inside `renderTacticalChart` so pattern detection operates on a meaningful local range.
- **Amplitude labels in price**: In `renderAmplitudeTargets`, convert each σ target back to price (`10^(σ × std + mean)`) and show the price in the `title` and HTML overlay labels.

## Capabilities

### Modified Capabilities
- `tactical-chart`: Fixing `stdY` injection, visible-window pattern detection, hover label isolation, and amplitude label price conversion.

## Impact

- `app.js`: `renderTacticalChart`, `renderAmplitudeTargets`, `refreshPipAnalysis`, `subscribeCrosshairMove` (main chart).
- New module-level variables: `tacticalStdMean`, `tacticalStdDev` to persist standardization parameters.
