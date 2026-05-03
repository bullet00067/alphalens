## 1. 資料層 (Data Management)

- [ ] 1.1 在 `app.js` 初始化 `currentPortfolio` 從 `localStorage` 讀取數據
- [ ] 1.2 實作 `addToPortfolio(ticker, cost, qty)` 函數並處理持久化
- [ ] 1.3 實作 `removeFromPortfolio(index)` 函數

## 2. 計算引擎 (AI Signal Engine)

- [ ] 2.1 實作 `calcATR(candles, period)` 函數：計算 14 日平均真實波幅
- [ ] 2.2 實作 `calculateAISignals(ticker, candles, portfolioItem)` 函數
- [ ] 2.3 邏輯整合：根據成本計算停損 (2*ATR)、停利 (3*Risk) 及加碼點位

## 3. UI 介面 (User Interface)

- [ ] 3.1 在 `index.html` 的 `portfolio-view` 新增持倉列表表格
- [ ] 3.2 在 `portfolio-view` 新增手動輸入持倉的表單 (Ticker, Cost, Qty)
- [ ] 3.3 在 `stock-detail-view` 的 `ai-quick-summary` 下方新增「AI 交易點位」卡片
- [ ] 3.4 實作導覽切換：確保點擊左側 Portfolio 連結能正確顯示持倉清單

## 4. 整合與驗證 (Integration & Testing)

- [ ] 4.1 確保切換股票時，AI 訊號能根據當前最新價格與 ATR 重新計算
- [ ] 4.2 驗證台股與美股的 ATR 計算是否一致
- [ ] 4.3 最終 UI 修飾：使用顏色 (紅色停損/綠色停利) 強化關鍵點位視覺效果
