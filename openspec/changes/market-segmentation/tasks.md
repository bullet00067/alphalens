## 1. Dual Currency Formatting

- [x] 1.1 修改 `app.js` 中的 `formatCurrency(value)` 為 `formatCurrency(value, ticker)`
- [x] 1.2 在 `formatCurrency` 內部判斷 `isTaiwanStock(ticker)`，若是則返回整數 `NT$`，否則返回小數點兩位 `$`
- [x] 1.3 更新 `renderPortfolio()` 表格中的每一列呼叫，傳入對應的 `ticker`
- [x] 1.4 在 Portfolio Summary 中，分別計算 `US Total Equity` 與 `TW Total Equity` 並獨立顯示

## 2. Taiwan Stock Name Resolution

- [x] 2.1 在 `app.js` 建立一個全域 Cache Map (例如 `const twStockNames = {}`) 與非同步的 `getTaiwanStockName(ticker)` 函數
- [x] 2.2 實作 `getTaiwanStockName(ticker)`：透過 FinMind (或其他開放 API) 查詢名稱，成功後寫入 Cache 並回傳
- [x] 2.3 修改 `renderPortfolio` 與 `populateDashboard`，在渲染台股代號時非同步補上名稱 (例如 `2330 台積電`)

## 3. Market Tabs UI

- [x] 3.1 在 `index.html` 的 Watchlist 標題區塊與 Portfolio 標題區塊下方新增 Tab 按鈕 (All / US / TW)
- [x] 3.2 在 `app.js` 綁定 Tab 按鈕點擊事件，更新全域變數 `currentMarketTab` (預設為 'ALL') 並重新呼叫 `populateDashboard()` 與 `renderPortfolio()`
- [x] 3.3 修改 `renderPortfolio` 的迴圈邏輯：依照 `currentMarketTab` 與 `isTaiwanStock` 來過濾要渲染的 `currentPortfolio` 項目
- [x] 3.4 修改 `populateDashboard` 的迴圈邏輯：依照同樣規則過濾要渲染的 `currentWatchlist` 項目
