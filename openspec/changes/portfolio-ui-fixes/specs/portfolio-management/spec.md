## MODIFIED Requirements

### Requirement: Add or Update Portfolio Holding
**原行為**: 系統 SHALL 允許使用者透過輸入 Ticker, Cost, Quantity 來新增一筆持倉。每次送出皆視為新增一筆獨立的紀錄。
**新行為**: 系統 SHALL 允許使用者透過輸入 Ticker, Cost, Quantity 來新增或更新持倉。在寫入資料前，系統 MUST 檢查當下使用者的 Portfolio 中是否已存在相同 Ticker 的紀錄。
- 若不存在，則視為「新增 (Insert)」，建立新的一筆紀錄。
- 若已存在，則視為「更新 (Update)」，將舊有的 Cost 與 Quantity 直接覆寫為使用者輸入的新數值。
- UI 上的按鈕文案應能反映此行為 (例如 "Add / Update Holding")。

#### Scenario: User adds a completely new holding
- **WHEN** 使用者輸入 "TSLA", 成本 200, 數量 10，且目前 Portfolio 無 TSLA
- **THEN** 系統 SHALL 在 Portfolio 中新增一筆 TSLA 紀錄

#### Scenario: User updates an existing holding
- **WHEN** 使用者輸入 "AAPL", 成本 150, 數量 20，且目前 Portfolio 已經有一筆 AAPL 紀錄 (舊成本 180, 數量 5)
- **THEN** 系統 SHALL 覆寫該筆 AAPL 的紀錄，使其成本變為 150，數量變為 20，而不產生第二筆 AAPL 紀錄
