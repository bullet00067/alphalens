## ADDED Requirements

### Requirement: User Registration and Login
系統 SHALL 允許使用者透過第三方提供者 (Google Sign-In) 建立帳號並快速登入。

#### Scenario: Successful Login
- **WHEN** 使用者點擊「Google 登入」按鈕並完成授權
- **THEN** 系統 SHALL 驗證身分，並在導覽列顯示使用者的帳號/頭像，同時獲取該使用者的雲端庫存資料

#### Scenario: Unauthenticated Access to Portfolio
- **WHEN** 未登入的使用者嘗試存取 Portfolio 頁面
- **THEN** 系統 SHALL 顯示提示訊息「請先登入以管理您的投資組合」，並隱藏新增/刪除功能

### Requirement: User Logout
系統 SHALL 提供登出功能，清除本地的使用者憑證與已載入的機密資料（如庫存）。

#### Scenario: User logs out
- **WHEN** 使用者點擊登出按鈕
- **THEN** 系統 SHALL 清除當前使用者的 session，清空 `currentPortfolio` 與畫面，並將 UI 恢復為未登入狀態
