## ADDED Requirements

### Requirement: Tabbed Views for Market Segmentation
系統 SHALL 在 Portfolio 與 Watchlist 區塊提供「All (全部)」、「US (美股)」、「TW (台股)」三個頁籤 (Tabs)，供使用者切換檢視。

#### Scenario: User switches to Taiwan market tab
- **WHEN** 使用者點擊 Portfolio 上的「TW (台股)」頁籤
- **THEN** 系統 SHALL 僅顯示符合台股規則 (isTaiwanStock) 的持倉項目
- **AND** Total Equity 與 Total P/L 等統計數據 SHALL 僅計算當下頁籤顯示的項目
