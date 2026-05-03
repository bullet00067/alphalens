## 1. Portfolio Table UI Updates

- [x] 1.1 修改 `index.html` 中的 `<thead>`，在 `Avg Cost` 旁新增一個 `<th style="padding: 12px;">Qty</th>`
- [x] 1.2 修改 `app.js` 的 `renderPortfolio`，在生成的 `<tr>` 字串中對應加入 `<td>${item.qty}</td>`
- [x] 1.3 調整 `index.html` 中的 Portfolio 區塊標題與按鈕文案，將 "Add New Holding" 改為 "Add / Update Holding"
- [x] 1.4 在 `styles.css` 稍微優化表格或欄位的間距，確保畫面寬鬆易讀

## 2. Add or Update (Upsert) Logic Implementation

- [x] 2.1 在 `app.js` 的 `addToPortfolioFromForm` 中，加入檢查機制：`const existingIndex = currentPortfolio.findIndex(p => p.ticker === ticker);`
- [x] 2.2 在 `addToPortfolioFromForm` 判斷 `currentUser` 是否存在：
    - 若 `currentUser` 存在且 `existingIndex !== -1`：呼叫新的 `updateCloudPortfolio(currentPortfolio[existingIndex].docId, cost, qty)` 函數 (需實作該函數)，否則維持原本的 `addCloudPortfolio`。
    - 若 `currentUser` 不存在且 `existingIndex !== -1`：直接更新 `currentPortfolio[existingIndex].cost = cost` 與 `.qty = qty`，並存入 `localStorage`，否則維持原本的 `push`。
- [x] 2.3 實作 `updateCloudPortfolio(docId, cost, qty)`，使用 Firebase 的 `updateDoc` 來更新特定的持倉文件，並更新成功後重新 `fetchCloudPortfolio()` 與 `fetchPortfolioQuotes()`
- [x] 2.4 確保表單送出後，Toast 提示訊息能正確顯示 "Updated {ticker}" 或 "Added {ticker}"

