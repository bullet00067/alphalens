## ADDED Requirements

### Requirement: Portfolio Quantity Column
系統 SHALL 在 Portfolio 的 Current Holdings 表格中，明確提供一個獨立的欄位顯示持有數量 (Quantity)，以避免使用者無法直接看出自己擁有的股數。

#### Scenario: Viewing current holdings
- **WHEN** 使用者進入 Portfolio 頁面並檢視持倉列表
- **THEN** 表格中 SHALL 包含一個 "Qty" 或 "數量" 的獨立欄位，並顯示該持倉的數量

### Requirement: Portfolio Layout Optimization
系統 SHALL 調整 Portfolio 表格的欄位間距、字體大小或排版方式，使得在新增了「數量」與「市場標籤」等資訊後，畫面仍保持不擁擠且具備良好的易讀性。

#### Scenario: Table responsiveness and spacing
- **WHEN** Portfolio 表格載入多筆資料時
- **THEN** 各欄位之間的間距 SHALL 足夠寬鬆，且超出螢幕寬度時 SHALL 支援水平滾動 (overflow-x: auto)
