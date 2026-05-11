## 1. Global State

- [x] 1.1 Add `let tacticalStdMean = 0;` and `let tacticalStdDev = 1;` to module-level global variables in `app.js`.

## 2. Fix PIP Hover Label Isolation (Main Chart)

- [x] 2.1 In `refreshPipAnalysis`, after assigning `mainPipMarkers = markers`, reset `mainHoverState.time = null` if accessible, or expose a `resetMainHoverState()` helper called at that point.
- [x] 2.2 Confirm `subscribeCrosshairMove` in `renderTradingViewChart` always maps the full `mainPipMarkers` array and sets `text: ""` for all non-hovered markers — verify no early-exit path skips this step.

## 3. Fix Tactical stdY Injection

- [x] 3.1 In `renderTacticalChart`, before calling `findPIPs`, compute `logVals`, `mean`, `std` from the candle array and store to `tacticalStdMean` / `tacticalStdDev`.
- [x] 3.2 After `findPIPs(candles)` returns `allPips`, map over them and set `p.stdY = (Math.log10(p.close) - tacticalStdMean) / tacticalStdDev` for each PIP point.
- [x] 3.3 In `refreshPipAnalysis`, after computing `pips` for the visible window, recompute and update `tacticalStdMean` / `tacticalStdDev` from `visibleData` before calling `renderAmplitudeTargets`.

## 4. Fix Tactical pattern detection (Visible window)

- [x] 4.1 In `renderTacticalChart`, replace `generatePIPSignal(candles)` with `generatePIPSignal(candles.slice(-60))` for the initial pattern detection.
- [x] 4.2 Similarly replace `findPIPs(candles)` used for `renderPatternGeometry` / `renderPatternLabels` with `findPIPs(candles.slice(-60))` so geometry is based on the same window.
- [x] 4.3 Recompute `stdY` on the sliced pips using the same standardization params computed from `candles.slice(-60)`.

## 5. Fix Amplitude Target Labels to Show Stock Price

- [x] 5.1 In `renderAmplitudeTargets`, add a `toPrice` helper: `sigma => Math.pow(10, sigma * tacticalStdDev + tacticalStdMean)`.
- [x] 5.2 Change `createPriceLine` `title` to `▲ 1x: $${toPrice(up1x).toFixed(2)}` (etc.) instead of `▲ 1x Target`.
- [x] 5.3 Update the HTML overlay grid to display `toPrice(target)` values formatted as `$xxx.xx` instead of `xxx.xxσ`.
