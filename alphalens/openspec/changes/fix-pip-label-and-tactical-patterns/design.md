## Context

The AlphaLens TACTICAL chart was recently refactored to use Z-Score standardization for its Y-axis. Three regressions were introduced:
1. PIP hover labels on the main chart bleed across all markers.
2. The tactical `pipLineSeries` has no valid data because `p.stdY` is never computed.
3. Pattern detection uses the full history window making patterns impossible to detect.

## Goals / Non-Goals

**Goals:**
- Isolate marker hover state so only the pointed-at PIP shows its label.
- Compute `stdY` inline in `renderTacticalChart` for each PIP and store standardization params globally.
- Use only the recent visible window (last 60 candles) for initial tactical pattern detection.
- Convert σ targets back to stock prices in `renderAmplitudeTargets` labels using stored `{ mean, std }`.

**Non-Goals:**
- Changing the TACTICAL chart Y-axis away from Z-Score.
- Modifying `findPIPs` or `strategyEngine.js` (keep changes in `app.js` only).
- Changing `refreshPipAnalysis` visible-window logic (already correct).

## Decisions

### Fix 1 — Hover Label Isolation
**Problem**: `mainPipMarkers` may carry stale `text` from a previous hover when `refreshPipAnalysis` runs. The `createSeriesMarkers` call inside `subscribeCrosshairMove` properly clears others, but if `mainPipMarkers` itself is re-assigned by `refreshPipAnalysis` while a hover is active, the new array has `text: ""` for all but re-renders without triggering the hover path.

**Fix**: In `subscribeCrosshairMove`, always map the CURRENT `mainPipMarkers` and set text — not relying on the stored array having correct state. Also reset `mainHoverState.time = null` whenever `refreshPipAnalysis` rebuilds `mainPipMarkers` so the next crosshair event always re-applies hover text.

### Fix 2 — stdY Injection
Compute standardization stats from the candle set passed to `renderTacticalChart`:
```js
const logVals = candles.map(c => Math.log10(c.close));
const mean = logVals.reduce((a,b) => a+b, 0) / logVals.length;
const std = Math.sqrt(logVals.reduce((a,b) => a + (b-mean)**2, 0) / logVals.length) || 1;
```
Then for each PIP: `p.stdY = (Math.log10(p.close) - mean) / std`.
Store `mean` and `std` in module-level `tacticalStdMean` / `tacticalStdDev`.

### Fix 3 — Visible-Window Pattern Detection
Replace `generatePIPSignal(candles)` in `renderTacticalChart` with `generatePIPSignal(candles.slice(-60))` (or the last visible logical range) to match `refreshPipAnalysis` behavior.

### Fix 4 — Price Labels on Amplitude Targets
In `renderAmplitudeTargets`, convert each σ target to price:
```js
const toPrice = sigma => Math.pow(10, sigma * tacticalStdDev + tacticalStdMean);
```
Use this price in `title` of `createPriceLine` and in the HTML overlay grid cells. Keep the σ value as the `price` argument so the line sits at the correct position on the Z-Score axis.

## Risks / Trade-offs

- **Risk**: `tacticalStdMean / tacticalStdDev` are stale after the user scrolls (refreshPipAnalysis uses visibleData, not full candles). 
  - Mitigation: `refreshPipAnalysis` should also update `tacticalStdMean / tacticalStdDev` when it recalculates the tactical panel. The conversion will then always use the most recent standardization window.
