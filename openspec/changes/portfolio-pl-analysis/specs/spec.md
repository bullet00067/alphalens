## ADDED Requirements

### Requirement: Real-time P/L Calculation
系統 SHALL 定期（或在頁面載入時）為庫存清單中的每支股票獲取最新報價，並計算未實現損益。公式：`(現價 - 成本) * 數量`。

#### Scenario: Displaying P/L in portfolio table
- **WHEN** 使用者開啟 Portfolio 頁面且 API 請求成功
- **THEN** 系統 SHALL 顯示每支股票的損益金額，正值顯示為紅色（台股習慣）/ 綠色（美股習慣），並標示報酬率

### Requirement: Multi-Level Take-Profit Targets
系統 SHALL 計算兩個階段的停利點與對應損益。
- **TP1 (1:2 R/R)**: `成本 + (2 * 風險)`，建議減碼 50%。預計獲利：`(TP1 - 成本) * 數量`。
- **TP2 (1:3 R/R)**: `成本 + (3 * 風險)`，建議全數出清。預計獲利：`(TP2 - 成本) * 數量`。

#### Scenario: Displaying partial profit targets
- **WHEN** 計算 AI 訊號時
- **THEN** 系統 SHALL 同時顯示 TP1 與 TP2 的價位及其預估獲利金額

### Requirement: Trailing Protection (Break-even)
當股價觸及 TP1 後，系統 SHALL 建議將保護性停損移動至「進場成本」。

#### Scenario: Break-even recommendation
- **WHEN** 當前價格大於等於 TP1
- **THEN** 系統 SHALL 在 AI 建議中顯示「已達第一目標，建議將停損上移至成本 $Cost 以確保獲利」

### Requirement: Portfolio Total Summary
系統 SHALL 在庫存頁面頂部顯示整個投資組合的總市值、總投入成本及總損益百分比。

#### Scenario: Viewing overall portfolio health
- **WHEN** 庫存清單載入完成
- **THEN** 系統 SHALL 彙總所有持倉數據並顯示一個「總覽資訊列」
