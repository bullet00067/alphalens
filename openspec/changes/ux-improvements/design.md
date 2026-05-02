## Context

基於 Test-Driven UX 觀點，我們發現系統中的幾個操作體驗斷點：新增庫存後未能自動加入觀察清單、K 線圖縮放比例不一致、以及表格中貨幣顯示格式雜亂。

## Goals / Non-Goals

**Goals:**
- 在 `app.js` 處理 Portfolio 新增操作時，自動呼叫 Watchlist 新增邏輯。
- 統一 `renderPortfolio` 的金錢格式化。
- 透過 Lightweight Charts 的 API 設定預設顯示 60 根 K 棒。

**Non-Goals:**
- 不實作即時匯率換算機制（台股與美股的數字就直接當成各自的本位幣，僅加上 `$` 與千分位）。
- 不改變 Watchlist 或 Portfolio 的底層資料結構。

## Decisions

### 1. K-Line Chart Default Scale (60 Bars)
- **決策**：在 `updateChart()` 中，當 `candlestickSeries.setData()` 繪製完畢後，使用 `currentStockChart.timeScale().setVisibleLogicalRange({ from: data.length - 60, to: data.length - 1 })`。
- **理由**：Lightweight Charts 預設會 `fitContent()` 把所有歷史資料塞滿螢幕。使用 `setVisibleLogicalRange` 可以精準控制畫面最初始顯示的 K 棒數量，且保留使用者後續滾輪縮放的自由度。

### 2. Portfolio-to-Watchlist Sync
- **決策**：在 `addToPortfolioFromForm()` 函數成功呼叫 `addCloudPortfolio()` 後，檢查 `currentWatchlist.includes(ticker)`，若無，則呼叫 `currentWatchlist.push(ticker)` 並觸發 `saveWatchlist()`。
- **理由**：利用現有的狀態變數與儲存函數，直接在應用層級綁定這兩個行為，最為輕量且直觀。

### 3. Currency Formatting
- **決策**：實作一個全域的 `formatCurrency(val)` 輔助函數，封裝 `new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)`。
- **理由**：統一使用原生的 `Intl.NumberFormat` 可自動處理逗號、小數點兩位以及錢字號，未來若要擴充支援不同幣別也更容易。

## Risks / Trade-offs
- **[Risk] Chart Data Length** → 若某檔股票剛上市，歷史資料不足 60 筆，設定 logical range 可能報錯。
- **Mitigation**：設定前先檢查 `data.length`，若小於 60，則直接 `fitContent()` 或設為 `from: 0`。
