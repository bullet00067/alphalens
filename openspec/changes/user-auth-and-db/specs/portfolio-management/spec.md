## MODIFIED Requirements

### Requirement: Portfolio Data Storage
**原行為**: 系統將持倉資料存儲在 `localStorage` 的 `myPortfolio` 鍵值中。
**新行為**: 系統 SHALL 透過 `cloud-database-sync` 將資料持久化至使用者的雲端資料夾，而不再依賴單一設備的 `localStorage`。本地 `currentPortfolio` 僅作為前端狀態緩存。

#### Scenario: User adds a stock to portfolio
- **WHEN** 登入的使用者在 Portfolio 頁面輸入 "AAPL", 150.0, 10 並點擊 "Add"
- **THEN** 系統 SHALL 將該資料傳送至雲端資料庫保存，並在本地清單中同步顯示

## REMOVED Requirements

### Requirement: Anonymous Portfolio Tracking
**Reason**: 為了確保資料安全與多帳號隔離，必須登入才能追蹤個人庫存。
**Migration**: 未登入的使用者會看到引導登入的提示畫面。原有的 `localStorage` 資料可提供一次性遷移匯入選項（選擇性實作）。
