## 1. Firebase Setup

- [x] 1.1 在 Firebase Console 建立專案並啟用 Authentication (Google) 與 Firestore
- [x] 1.2 在 `index.html` 引入 Firebase SDK (透過 CDN) 或透過 npm 安裝
- [x] 1.3 在 `app.js` 或獨立的 `firebase-config.js` 初始化 Firebase 應用程式

## 2. User Authentication UI & Logic

- [x] 2.1 在 `index.html` 導覽列新增「Google 登入」按鈕與使用者狀態顯示區
- [x] 2.2 在 `app.js` 實作 Firebase `signInWithPopup` (Google) 與登出邏輯
- [x] 2.3 實作 `onAuthStateChanged` 監聽器，管理全域的登入狀態

## 3. Cloud Database Integration (Firestore)

- [x] 3.1 實作 `fetchCloudPortfolio(uid)`：從 Firestore 讀取使用者專屬的庫存資料
- [x] 3.2 實作 `addCloudPortfolio(uid, ticker, cost, qty)`：將新持倉寫入 Firestore
- [x] 3.3 實作 `removeCloudPortfolio(uid, docId)`：從 Firestore 刪除指定持倉
- [x] 3.4 修改現有的 `addToPortfolioFromForm` 與 `removeFromPortfolio`，將資料流導向雲端而非 `localStorage`

## 4. UI 整合與保護

- [x] 4.1 在未登入狀態下，於 Portfolio 頁面顯示「請先登入」的提示，並隱藏新增/刪除表單
- [x] 4.2 確保登入/登出時，`currentPortfolio` 能正確重新載入並觸發 `renderPortfolio`
- [x] 4.3 驗證不同帳號登入時，資料確實被隔離
