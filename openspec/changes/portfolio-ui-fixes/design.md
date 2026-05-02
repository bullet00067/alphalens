## Context

Portfolio 頁面的現有持倉表格隨著功能增加，逐漸變得擁擠，且缺少直觀的數量顯示。此外，新增持倉的表單只支援 "Insert"，當使用者嘗試更改已存在持倉的數量或成本時，會導致資料重複。

## Goals / Non-Goals

**Goals:**
- 在 `renderPortfolio` 表格中增加 `Qty` 欄位。
- 在 `addToPortfolioFromForm` 與底層資料庫操作中實作 "Upsert" (Update or Insert) 邏輯。
- 優化 HTML/CSS 的排版，讓空間更寬裕。

**Non-Goals:**
- 不實作複雜的交易紀錄 (Transaction History) 系統。也就是說，當使用者更新成本與數量時，舊紀錄就是直接被覆蓋，不會計算加權平均成本，這交由使用者自行輸入最終算好的平均成本與總量。

## Decisions

### 1. Quantity Column Injection
- **決策**：在 `index.html` 的 `<thead>` 加上 `<th style="padding: 12px;">Qty</th>`。在 `app.js` 的 `renderPortfolio` 中對應插入 `<td>${item.qty}</td>`。

### 2. Upsert Logic in addToPortfolioFromForm
- **決策**：
  在使用者點擊 "Add to Portfolio" 後，先尋找 `currentPortfolio` 中是否已有同名 `ticker`：
  ```javascript
  const existingIndex = currentPortfolio.findIndex(p => p.ticker === ticker);
  ```
  如果 `existingIndex !== -1`：
  - **Firebase 模式 (`currentUser` true)**：
    修改原有的 `addCloudPortfolio` 函數或新增 `updateCloudPortfolio`，直接對該 `docId` 執行 `updateDoc()` 覆寫 cost 與 qty。
  - **Local 模式 (`currentUser` false)**：
    直接更新 `currentPortfolio[existingIndex].cost = cost`，然後 `localStorage.setItem`。

### 3. UI Text Updates
- **決策**：將表單標題 "Add New Holding" 改為 "Add / Update Holding"，按鈕文案也一併調整，降低使用者的認知負擔。

## Risks / Trade-offs

- **[Risk] Firebase updateDoc requires ID** → 如果我們要在新增函數裡執行 Update，必須知道該文件的 `docId`。
- **Mitigation**：目前的 `currentPortfolio` 物件中已經存有 `docId` (在 `fetchCloudPortfolio` 時綁定的)。所以我們可以直接拿 `currentPortfolio[existingIndex].docId` 去做 Firebase 的 Update 請求。
