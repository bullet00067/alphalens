## Why

從使用者的操作體驗出發（Test-Driven UX），當前系統的模組之間缺乏連動性，導致使用者需要重複操作（例如買了股票後，還得手動加入觀察清單才能看 K 線圖）。此外，顯示介面上的細節（如貨幣符號不統一、K 線圖預設縮放比例過大或過小）會降低整體的專業感與易讀性。為了解決這些問題，我們將進行一系列的 UX 優化。

## What Changes

- **Portfolio 與 Watchlist 自動同步**：當使用者在 Portfolio 新增持倉時，系統將自動檢查並將該股票加入 Watchlist。
- **統一貨幣顯示 (Currency Normalization)**：Portfolio 表格中的金錢數值將統一使用美金 (USD) 作為計價單位顯示（若是台股，在未來架構可擴充匯率換算，但當前統一在符號與格式上規範為 `$` 標示）。
- **K 線圖預設縮放優化**：當使用者點擊任何股票載入 K 線圖時，圖表將自動計算並預設顯示「最近 60 根 K 棒（約一季的交易日）」，提供最佳的初始視覺範圍，同時保留滑鼠滾輪自由縮放的功能。

## Capabilities

### New Capabilities
- `chart-ux-controls`: 負責處理 Lightweight Charts 的預設可視範圍（Visible Logical Range）與縮放體驗。

### Modified Capabilities
- `portfolio-management`: 新增「當新增持倉時，觸發更新 Watchlist」的連動需求。
- `data-formatting` (若無此 spec 則新增): 規範全站金融數值的顯示格式與貨幣符號。

## Impact

- **app.js**: 需要修改 `addToPortfolioFromForm` 與 Lightweight Charts 的 `timeScale().setVisibleLogicalRange()` 邏輯。
- **UI 表格**: 所有涉及金錢的欄位將套用統一的 `Intl.NumberFormat` 或標準化字串格式。
