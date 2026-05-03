## Why

隨著使用者同時投資美股與台股，目前的 Portfolio 與 Watchlist 將所有市場的標的混在一起顯示，不僅幣別混淆（台股使用美金符號顯示會造成認知錯誤），且台股代號僅有數字，缺乏公司名稱輔助辨識。為了提升資產管理的直覺性與精確度，我們需要將台美股進行市場分層 (Market Segmentation)。

## What Changes

- **台股名稱擴充**：當系統判斷為台股（全數字）時，將抓取並在代號旁附加上中文名稱（例如：`2330 台積電`）。
- **多幣別顯示 (Multi-Currency)**：廢除全站強制使用 `USD` 的設定，改為「美股使用美金 (`USD`, `$`)，台股使用台幣 (`TWD`, `NT$`)」。
- **市場分頁 (Tabbed Views)**：在 Dashboard 的 Watchlist 與 Portfolio 頁面中，加入「台股 / 美股 / 全部」的頁籤 (Tabs)，讓使用者能分類檢視投資組合。

## Capabilities

### New Capabilities
- `market-tabs`: 實作 UI 頁籤邏輯，用於過濾與切換台股/美股的資料列表。
- `stock-metadata`: 實作台股名稱的查詢與快取機制。

### Modified Capabilities
- `data-formatting`: 取消強制美金格式，改為依據 `isTaiwanStock` 的判斷結果動態切換 `USD` 或 `TWD` 格式。

## Impact

- **UI 結構**：Watchlist 與 Portfolio 區塊上方將新增 Tab 導覽列。
- **資料流**：渲染 Portfolio 與 Watchlist 時，需要先依照 Tab 的過濾條件篩選陣列。
- **外部依賴**：需要尋找一個靜態的台股代號與名稱對照表 (JSON) 或透過 FinMind API 動態獲取台股名稱。
