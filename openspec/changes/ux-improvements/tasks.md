## 1. Currency Formatting

- [x] 1.1 在 `app.js` 新增 `formatCurrency(value)` 輔助函數
- [x] 1.2 更新 `renderPortfolio`，將所有用到金錢的顯示（單價、成本、損益、總市值）改為呼叫 `formatCurrency`

## 2. Portfolio-to-Watchlist Sync

- [x] 2.1 修改 `addToPortfolioFromForm` 函數：在新增持倉成功後，檢查 `currentWatchlist` 是否已包含該 `ticker`
- [x] 2.2 若不包含，則將其加入 `currentWatchlist` 並呼叫 `saveWatchlist()` 確保同步至雲端/本地

## 3. Chart Scale Optimization

- [x] 3.1 修改 `updateChart()` 函數：在設定完資料 (`candlestickSeries.setData`) 後，檢查資料總長度
- [x] 3.2 若長度大於 60，使用 `timeScale().setVisibleLogicalRange({ from: length - 60, to: length - 1 })` 設定預設視角
- [x] 3.3 若長度小於等於 60，則維持預設的 `timeScale().fitContent()`
