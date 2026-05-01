## Context

目前 `renderPortfolio` 僅顯示靜態成本。為了實現損益分析，我們需要整合即時行情與持倉數據，並支援更靈活的停利策略。

## Goals / Non-Goals

**Goals:**
- 即時更新庫存清單的盈虧。
- 在詳細頁顯示分批停利點 (TP1/TP2) 的預計損益。
- 實作「保本提醒」：當價格 > TP1 時，提示將停損移至成本。

**Non-Goals:**
- 不考慮貨幣匯率轉換。
- 本階段不實作歷史損益曲線。

## Decisions

### 1. Batch Quote Fetching
- **決策**：在 `renderPortfolio` 中使用 `Promise.all` 並行呼叫行情 API。
- **理由**：獲取庫存中所有股票的「現價」以計算當前損益。

### 2. Multi-Target AI Signals
- **TP1 (1:2 Risk/Reward)**：計算預計獲利金額，建議減碼 50%。
- **TP2 (1:3 Risk/Reward)**：最終目標，建議全數出清。
- **Break-even Protection**：邏輯判斷 `if (CurrentPrice >= TP1) { recommend('Move SL to Entry') }`。

### 3. UI: Portfolio Analysis Dashboard
- 在表格上方新增總覽卡片。
- 在詳細頁 AI 訊號卡片中新增「預計獲利/損失」的金額標籤。

## Risks / Trade-offs

- **[Risk] API Rate Limits** → 庫存過多可能導致 429。**Mitigation**: 限制 Portfolio 頁面每 30 秒才允許刷新一次數據。
