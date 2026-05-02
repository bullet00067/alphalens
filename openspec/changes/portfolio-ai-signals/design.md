## Context

目前專案已具備多數據源 K 線與基本指標，但缺乏個人化數據。本設計旨在將使用者的「持倉成本」與「市場數據」結合，產生專屬的 AI 交易訊號。

## Goals / Non-Goals

**Goals:**
- 提供庫存增刪改查功能。
- 在詳細頁面顯示 AI 點位建議。
- 實作 ATR (Average True Range) 指標計算。
- 視覺化顯示價格與點位的相對位置。

**Non-Goals:**
- 不涉及真實下單交易。
- 不實作多帳號同步（僅限本機 `localStorage`）。
- 不包含除了進場、停損、停利、加碼以外的複雜策略。

## Decisions

### 1. Data Storage: localStorage
- **決策**：使用 `localStorage.setItem('myPortfolio', JSON.stringify(data))`。
- **理由**：專案目前為前端專案且無需登入，`localStorage` 足以處理數十筆持倉數據，且讀取快速。
- **替代方案**：IndexedDB（過於複雜，目前數據量不需用到）。

### 2. ATR Calculation Engine
- **決策**：在 `app.js` 實作一個 `calcATR(candles, period=14)` 函數。
- **理由**：ATR 是計算點位最科學的工具。True Range = `max(high-low, abs(high-prev_close), abs(low-prev_close))`。
- **細節**：需要至少 15 根 K 線數據來計算 14 日 ATR。

### 3. UI Integration: Separate Portfolio View
- **決策**：在左側導覽列新增一個 "Portfolio" 項目，切換至專屬表格頁面。
- **理由**：與 Dashboard (Watchlist) 區隔，避免介面過於擁擠。

### 4. Trade Signal Logic
- **Stop Loss**: `AvgCost - (2 * ATR)`。
- **Take Profit**: `AvgCost + (3 * (AvgCost - StopLoss))`。
- **Scale-in**: 當 `Price > AvgCost + (0.5 * ATR)` 且 `RSI < 70` 時顯示加碼建議。

## Risks / Trade-offs

- **[Risk] Data Loss** → 清除瀏覽器快取會導致庫存遺失。**Mitigation**: 提供一個簡單的 JSON 匯出功能（未來考量）。
- **[Risk] API Limits** → 計算多支庫存的 ATR 需要大量數據。**Mitigation**: 僅在點擊進入詳細頁時計算該股的 AI 指標，而非在總表中一次性計算。
