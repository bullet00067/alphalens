# Design: Portfolio Layout Refinement

## System Architecture Updates
本次為純 UI/UX 結構調整，不涉及底層資料邏輯的修改。我們將針對 `index.html` 中的 DOM 結構與 CSS 樣式進行重構。

## Key Technical Decisions
1. **解除網格綁定 (Grid Decoupling)**:
   - 移除包覆「Add New Holding」與「Current Holdings」的 `<div class="stock-detail-grid">` 標籤，或將其類別改為垂直堆疊的 Flexbox (e.g., `display: flex; flex-direction: column; gap: 24px;`)。
   - 因為 `stock-detail-grid` 在 CSS 中被定義為 `grid-template-columns: 2fr 1fr;`，這是為了 Dashboard 設計的，不適合用在 Portfolio。
2. **表單寬度最佳化 (Form Optimization)**:
   - 表單從原本被限制在 `2fr` 的寬度變為 `100%`。為了避免欄位在大螢幕上被拉得太長，我們會限制表單內部的最大寬度，或利用 `grid` 維持欄位的精緻感。
3. **強制水平滾動 (Horizontal Scroll Enforcement)**:
   - 在 Current Holdings 表格的 `<table style="...">` 中，加入 `white-space: nowrap;`。
   - 這會強制表格儲存格內的文字不換行。當表格總寬度超過父容器 `.glass-panel` 的寬度時，父容器的 `overflow-x: auto;` 屬性就會自然觸發水平捲軸 (Scrollbar)。

## UI Layout Flow
1. **Top**: `<h1>My Portfolio</h1>` 及切換頁籤。
2. **Middle**: `portfolio-summary` 總覽卡片。
3. **Bottom-Left/Right (OLD)** -> **Bottom-Top (NEW)**: `Add New Holding` 表單。
4. **Bottom-Bottom (NEW)**: `Current Holdings` 資料表（支援左右滑動）。
