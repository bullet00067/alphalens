## Why

目前專案的「個人庫存 (Portfolio)」與「觀察清單 (Watchlist)」資料都是儲存在本機瀏覽器的 `localStorage` 中。這導致了兩個重大限制：第一，使用者無法在不同裝置間同步資料；第二，不同的使用者若使用同一台電腦，會看到相同的庫存資訊。為了解決這個問題，我們需要引入使用者身分驗證與雲端資料庫。

## What Changes

- **使用者註冊與登入系統**：新增登入介面，允許使用者建立專屬帳號（信箱/密碼或 Google 登入）。
- **BREAKING: 資料儲存遷移**：從本地 `localStorage` 全面遷移至雲端資料庫（如 Firebase Firestore 或 Supabase）。
- **多帳號資料隔離**：每個使用者的 Portfolio 與 Watchlist 將與其 UID (User ID) 綁定，確保資料隱私與獨立性。

## Capabilities

### New Capabilities
- `user-authentication`: 處理登入、註冊、登出、以及驗證狀態的守衛 (Auth Guard)。
- `cloud-database-sync`: 負責將本機對庫存與觀察清單的增刪改查，同步至雲端資料庫。

### Modified Capabilities
- `portfolio-management`: 修改讀寫邏輯，從 `localStorage` 改為透過 `cloud-database-sync` 存取雲端資料。

## Impact

- **UI 變更**：需要新增「登入/註冊」視窗或獨立頁面，並在導覽列新增使用者頭像與登出按鈕。
- **架構依賴**：需導入第三方 BaaS (Backend as a Service) SDK，例如 Firebase 或是 Supabase。
- **資料延遲**：CRUD 操作將從同步的本機操作變為非同步的網路請求，需加入 Loading 狀態提示。
