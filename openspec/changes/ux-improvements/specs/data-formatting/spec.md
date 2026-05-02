## ADDED Requirements

### Requirement: Uniform Currency Formatting
系統 SHALL 在 Portfolio 與總覽卡片的金錢數值上，統一使用單一貨幣符號 (`$`) 與千分位逗號格式 (例如 `$1,234.56`)。即便包含台股 (TWD)，在畫面的符號標示上仍應統一為 `$` 以維持版面整潔，並確保小數點後兩位對齊。

#### Scenario: Displaying portfolio values
- **WHEN** 系統渲染 Portfolio 列表與總覽 (Total Equity / P/L) 時
- **THEN** 所有金額皆 SHALL 以 `$X,XXX.XX` 格式顯示
