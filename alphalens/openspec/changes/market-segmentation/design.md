## Context

隨著專案從單純的實驗性工具演變為能管理台美雙市場的投資儀表板，我們面臨到資料混雜與貨幣顯示不精確的問題。我們需要將介面劃分為明確的市場分類 (US / TW / All)，並且讓各市場的數據格式符合當地的閱讀習慣。

## Goals / Non-Goals

**Goals:**
- 在 Watchlist 與 Portfolio 加入 Market Filter Tabs (All / US / TW)。
- 建立台股中文名稱對照表或呼叫 API 獲取名稱。
- 根據 `isTaiwanStock()` 決定貨幣格式為 `USD` (含小數點) 或 `TWD` (無小數點)。

**Non-Goals:**
- 不實作即時匯率換算機制。在 "All" 頁籤中，我們將分別顯示 US Total 與 TW Total，避免 1 USD + 1 TWD = 2 的荒謬數字。
- 不改變 Firebase / localStorage 中的儲存資料結構。

## Decisions

### 1. 股票名稱查詢 (Stock Name Resolution)
- **決策**：台股代號名稱不需要頻繁呼叫 API。我們可以使用公開的靜態 JSON 對照表，或是透過 FinMind 的 `TaiwanStockInfo` API 取得名稱並快取在 `sessionStorage` 甚至變數中。
- **選擇**：為了保持輕量，我們可以直接從 FinMind 獲取 `TaiwanStockInfo` 並存入 `Map` 結構中緩存，以供畫面上即時查詢 `2330` -> `2330 台積電`。

### 2. 貨幣格式切換 (Dual Currency Formatting)
- **決策**：將原有的 `formatCurrency(value)` 擴充為 `formatCurrency(value, ticker)`。
- **邏輯**：內部呼叫 `isTaiwanStock(ticker)`，如果是 true，使用 `Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 })`；否則使用 `USD` 格式。

### 3. Market Tabs UI
- **決策**：在 HTML 的 `watchlist` 與 `portfolio` 區塊上方加上按鈕列 (`[ All | US | TW ]`)。
- **狀態**：在 `app.js` 新增全域狀態 `currentMarketTab = 'ALL'`。在 `renderPortfolio()` 與 `populateDashboard()` 時，針對該狀態進行 `filter()` 陣列篩選。

## Risks / Trade-offs

- **[Risk] 台股名稱 API 延遲** → 若依賴 FinMind 每次查詢，畫面渲染會變慢。
- **Mitigation**: 必須實作名稱的 Cache 機制 (Name Map)，僅在 Map 找不到時才發出請求，或是一次性拉取常用台股名稱列表。
