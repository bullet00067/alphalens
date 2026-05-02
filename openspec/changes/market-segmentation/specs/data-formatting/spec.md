## MODIFIED Requirements

### Requirement: Uniform Currency Formatting
**原行為**: 系統在 Portfolio 與總覽卡片的金錢數值上，統一使用單一貨幣符號 (`$`) 與千分位逗號格式 (例如 `$1,234.56`)。
**新行為**: 系統 SHALL 依據股票市場動態切換貨幣符號與顯示位數：
- 美股 (US): 顯示為 `$1,234.56` (USD, 保留小數點後兩位)
- 台股 (TW): 顯示為 `NT$1,234` (TWD, 整數顯示，台股通常不顯示小數點後的零頭)
- 總覽卡片 (Total Equity / P/L): 由於會將台幣與美金相加會造成數值錯誤，當選擇「All」頁籤時，應提示使用者「請切換至單一市場以計算正確市值」，或者分別顯示「US Total」與「TW Total」。本階段選擇**分別顯示各市場小計**或**僅在切換至單一市場 Tab 時顯示總計**。

#### Scenario: Displaying Taiwan stock portfolio values
- **WHEN** 系統渲染台股 (如 `2330`) 的 Portfolio 項目時
- **THEN** 金額 SHALL 以 `NT$X,XXX` 格式顯示
