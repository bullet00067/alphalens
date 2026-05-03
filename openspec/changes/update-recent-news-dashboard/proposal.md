# Proposal: Update Recent News Dashboard

## What is the goal?
將 Dashboard 頁面中的「Recent News」區塊從目前的靜態 Mock 資料，改為從 Finnhub API 即時獲取最新的 10 則全球金融新聞。

## Why are we doing this?
- **即時資訊**：靜態的 Mock 資料無法提供實際的市場動態。
- **提升專業感**：顯示最新的 10 則新聞能讓儀表板更具實用價值，幫助投資者快速掌握全球市場情緒。
- **數據一致性**：目前專案已整合 Finnhub API 用於股票報價，利用同一個 API 來源獲取新聞可簡化架構。

## Success Metrics
- Dashboard 載入時，能夠看到 10 則即時的新聞標題。
- 每則新聞包含：標題、來源以及發佈時間。
- 在 API Key 遺失或請求失敗時，有適當的錯誤處理或降級顯示。
