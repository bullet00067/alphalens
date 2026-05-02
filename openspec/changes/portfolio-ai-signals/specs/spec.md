## ADDED Requirements

### Requirement: Portfolio Data Storage
系統 SHALL 提供一種機制讓使用者持久化儲存其持倉資訊。持倉資訊必須包含：股票代號 (Ticker)、平均持有成本 (Avg Cost)、以及持有數量 (Quantity)。

#### Scenario: User adds a stock to portfolio
- **WHEN** 使用者在 Portfolio 頁面輸入 "AAPL", 150.0, 10 並點擊 "Add"
- **THEN** 系統 SHALL 將該資料儲存至 `localStorage` 並在清單中顯示

### Requirement: Portfolio Display
系統 SHALL 在 Portfolio 頁面顯示所有已儲存的持倉，並計算其當前市值 (Current Value) 與 未實現損益 (Unrealized P/L)。

#### Scenario: Viewing portfolio status
- **WHEN** 使用者開啟 Portfolio 頁面
- **THEN** 系統 SHALL 根據最新股價與平均成本，顯示每支股票的盈虧百分比與總價值

### Requirement: ATR-Based Stop-Loss Calculation
系統 SHALL 自動計算並顯示基於 ATR (Average True Range) 的建議停損點。公式為：`持有成本 - (2 * ATR)`。

#### Scenario: Stop-loss display for a holding
- **WHEN** 使用者查看某支庫存股的詳細資訊
- **THEN** 系統 SHALL 計算該股票過去 14 日的 ATR，並顯示建議停損價位

### Requirement: Take-Profit Target Calculation
系統 SHALL 根據 1:3 的風險報酬比計算建議停利點。公式為：`持有成本 + (3 * (持有成本 - 停損點))`。

#### Scenario: Take-profit display for a holding
- **WHEN** 停損點已計算完成
- **THEN** 系統 SHALL 顯示相對應的 1:3 停利目標價

### Requirement: AI Scale-in (Pyramiding) Signal
系統 SHALL 識別並顯示加碼訊號。當股價突破前波高點或股價上漲超過 `0.5 * ATR` 且趨勢向上時，給出加碼建議。

#### Scenario: Scaling-in signal notification
- **WHEN** 股價從成本價上漲超過 0.5 倍 ATR 且成交量放大
- **THEN** 系統 SHALL 在該股票的 AI 建議欄位顯示「建議小額加碼」
