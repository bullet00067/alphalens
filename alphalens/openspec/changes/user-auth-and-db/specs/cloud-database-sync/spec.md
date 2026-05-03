## ADDED Requirements

### Requirement: Cloud Data Sync for Portfolio
系統 SHALL 在使用者新增或刪除庫存時，將變更同步寫入雲端資料庫（如 Firebase Firestore）。資料必須存放於該使用者的專屬節點下（例如 `users/{uid}/portfolio`）。

#### Scenario: Add holding to cloud
- **WHEN** 登入的使用者透過表單新增持倉
- **THEN** 系統 SHALL 將資料寫入雲端資料庫，成功後再更新 UI 狀態

#### Scenario: Fetch user portfolio on login
- **WHEN** 使用者成功登入
- **THEN** 系統 SHALL 從雲端資料庫讀取該使用者的庫存清單，並載入至 `currentPortfolio`

### Requirement: Cross-device Synchronization
系統 SHALL 確保同一個使用者在不同裝置登入時，能看到相同的庫存資料。

#### Scenario: Data consistency across sessions
- **WHEN** 使用者在裝置 A 新增庫存，隨後在裝置 B 登入
- **THEN** 裝置 B 的 Portfolio 頁面 SHALL 顯示包含在裝置 A 所新增的完整庫存
