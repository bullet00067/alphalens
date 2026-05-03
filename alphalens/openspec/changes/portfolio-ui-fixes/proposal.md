## Why

在使用 Portfolio 頁面時，發現了一些影響操作體驗的問題：現有持倉列表 (Current Holdings) 的排版稍嫌擁擠，且缺少直接顯示「持有數量」的欄位；此外，當使用者想要修改既有持倉的成本或數量時，目前的「新增持倉」表單會重複新增一筆相同的股票資料，無法達成更新 (Update) 的效果。

## What Changes

- **Portfolio 表格排版優化**：調整 Current Holdings 的 CSS 排版與間距，改善擁擠的視覺感受。
- **新增持有數量欄位**：在 Current Holdings 表格中，於「Ticker」或「Avg Cost」旁新增「Quantity (數量)」欄位。
- **Add to Portfolio 行為變更**：將「Add New Holding」的邏輯改為「Add / Update Holding」。當送出表單時，若發現該 Ticker 已經存在於當下使用者的 Portfolio 中，則改為覆蓋更新其成本與數量，而非新增一筆全新的資料。

## Capabilities

### New Capabilities
- `portfolio-ui`: 處理 Portfolio 表格的欄位擴充與排版優化。

### Modified Capabilities
- `portfolio-management`: 修改「新增持倉」的行為規範，加入「若存在則更新 (Upsert)」的邏輯。

## Impact

- **UI 結構**：`index.html` 中的 Portfolio Table 需要增加一個 `<th>` 與 `<td>`。
- **資料流 (app.js)**：
  - `renderPortfolio` 需要多渲染一個數量欄位。
  - `addToPortfolioFromForm` 需要在寫入資料庫/本地端前，先透過 `currentPortfolio.findIndex` 檢查是否存在相同的 ticker。若存在，則改用 `updateCloudPortfolio`（針對 Firebase）或直接更新 Array（針對 local storage）。
