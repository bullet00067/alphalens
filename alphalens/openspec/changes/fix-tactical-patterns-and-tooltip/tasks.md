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
- [x] 修復 TACTICAL 圖表可見性 (解決 `display: none` 渲染問題)
- [x] 實作標準化 PIP 運算邏輯 (解決 MXL 等高波動股票的量尺偏誤)
- [x] 在 TACTICAL 圖表上渲染幾何型態輔助線 (三角形、矩形)
- [x] 實作 Tooltip 清除邏輯 (修復懸停標籤殘留問題)
- [x] 優化初始化流程 (增加 `safeInit` 防禦性邏輯，防止 DOM 缺失導致崩潰)
- [x] 同步本地與線上 (Render) 環境代碼
