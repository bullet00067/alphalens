## ADDED Requirements

### Requirement: Portfolio to Watchlist Synchronization
系統 SHALL 在使用者透過表單成功新增一筆持倉至 Portfolio 時，自動檢查該股票是否存在於 Watchlist 中。若不存在，系統 SHALL 將該股票一併加入 Watchlist。

#### Scenario: Adding a new stock to portfolio syncs to watchlist
- **WHEN** 使用者在 Portfolio 頁面新增 "MSFT", 成本 300, 數量 10
- **THEN** 系統 SHALL 將 "MSFT" 存入 Portfolio
- **AND** 系統 SHALL 將 "MSFT" 加入 Watchlist (若尚未存在) 並儲存至雲端/本地
