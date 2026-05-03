## ADDED Requirements

### Requirement: Taiwan Stock Chinese Name Display
系統 SHALL 在顯示台股代號時，若能取得對應的中文名稱，則必須將中文名稱附加於代號旁顯示 (例如 `2330 台積電`)。

#### Scenario: Displaying a Taiwan stock in Portfolio
- **WHEN** 系統渲染 Portfolio 表格，且該項目被判定為台股 (`isTaiwanStock`)
- **THEN** 系統 SHALL 在 Ticker 欄位顯示 `代號 名稱` 的格式 (如 `2330 台積電`)，若無法取得名稱則僅顯示代號
