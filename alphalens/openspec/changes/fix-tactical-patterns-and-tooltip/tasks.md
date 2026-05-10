# Tasks: Fix Tactical Chart and Tooltip Persistence

## 1. Tactical Chart Visibility [DONE]
- [x] Debug `togglePipTactical` and `renderTacticalChart` to ensure the chart is rendered correctly when enabled.
- [x] Verify `pipContainer` dimensions and CSS visibility.
- [x] Fix any "ghost" removal of the chart instance during stock switching.

## 2. Geometric Pattern Rendering [DONE]
- [x] Fix `curr`/`prev` undefined errors in `renderStructureLabels`.
- [x] Update `renderPatternGeometry` to draw precise Trendlines and Support/Resistance lines for Triangles and Rectangles.
- [x] Enhance `renderPatternLabels` with clear text markers for HH, HL, LL, LH, Resistance, and Support.

## 3. Tooltip UX Fix [DONE]
- [x] Refactor `subscribeCrosshairMove` in `app.js` to ensure reliable clearing of marker text.
- [x] Implement a fallback `mouseleave` listener on the chart container.
- [x] Verify that disabling "PIP Overlay" correctly clears all markers.

## 4. Verification [DONE]
- [x] Test with ticker MXL (high volatility) to verify pattern lines.
- [x] Verify tooltip disappearance on both main and tactical charts.
- [x] Confirm layout stability on mobile (Portrait/Landscape).
