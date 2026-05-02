# Tasks: Portfolio Layout Refinement

## 1. HTML Layout Restructuring
- [x] 1.1 在 `index.html` 中，找到包覆 `Add New Holding` 表單與 `Current Holdings` 表格的 `<div class="stock-detail-grid">`。
- [x] 1.2 將該標籤的 class 改為內聯的 Flex 垂直排版（或定義新類別），例如 `<div style="display: flex; flex-direction: column; gap: 24px;">`，以解除原本 `2fr 1fr` 的網格綁定。

## 2. Table Scrollbar Optimization
- [x] 2.1 在 `index.html` 的 Current Holdings 表格 `<table style="...">` 樣式中，加入 `white-space: nowrap;`，確保內容不會被擠壓斷行。
- [x] 2.2 確認包覆 table 的 `.glass-panel` 依然保留 `overflow-x: auto;` 屬性，確保水平捲軸能正常觸發。

## 3. Chart Enhancements (PIP Markers & Volume)
- [x] 3.1 於 `app.js` 的動態 PIP 計算區塊中，使用 `pipSeries.setMarkers()` 為每個 PIP 點加上標記（包含圓點形狀、當天日期與價格資訊）。
- [x] 3.2 於 `renderTradingViewChart` 函式中，預設掛載並顯示 `volumeSeries`（成交量柱狀圖），根據收盤漲跌設定紅色與綠色，並放置於圖表下方 20% 的空間。

## 4. UI/UX Verification
- [x] 4.1 確保 `Add New Holding` 表單在大螢幕下不會過度拉伸。
- [x] 4.2 檢查在瀏覽器縮放時，表格最右側的欄位能透過底部出現的捲軸平滑滾動顯示。
