## ADDED Requirements

### Requirement: Default Chart Visible Range
系統 SHALL 在載入 K 線圖 (Candlestick Chart) 或是切換時間週期 (Timeframe) 時，自動計算並設定 X 軸的可視範圍，使畫面上預設顯示剛好 60 根 K 棒。此規則 SHALL 適用於所有時間週期（例如 15分K、60分K、日線、週線等），以確保視覺上始終保持最佳的縮放比例。

#### Scenario: User opens chart for a stock or switches timeframe
- **WHEN** 使用者點擊 Watchlist 或 Portfolio 中的股票載入圖表，或切換任何時間週期（如 15min, 1day）
- **THEN** 系統繪製完資料後，圖表 SHALL 自動縮放至最新的 60 筆資料區間
- **AND** 使用者仍可透過滑鼠滾輪向左或向右自由縮放歷史資料
