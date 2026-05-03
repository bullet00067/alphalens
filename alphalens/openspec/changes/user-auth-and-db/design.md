## Context

目前應用程式為純前端架構 (Vite + Vanilla JS)，所有使用者狀態（如庫存 Portfolio）皆仰賴 `localStorage`。這限制了多裝置同步與多帳號共用的情境。為解決此問題，我們需要引入雲端資料庫並將資料與特定使用者帳號關聯。

## Goals / Non-Goals

**Goals:**
- 實作使用者註冊、登入、登出功能。
- 將 `currentPortfolio` 資料的儲存位置從 `localStorage` 轉移至雲端資料庫。
- 根據登入的使用者身分 (UID) 動態加載不同的庫存資料。

**Non-Goals:**
- 不自建後端伺服器 (Node.js/Python 等)，避免增加基礎設施維護成本。
- 不實作複雜的社群功能或資料共享（資料為個人私有）。

## Decisions

### 1. Backend Provider: Firebase
- **決策**：使用 Firebase Auth 處理登入，使用 Firebase Firestore 處理資料庫儲存。
- **理由**：
  1. 我們的專案是前端架構，Firebase SDK 非常適合無伺服器 (Serverless) 應用。
  2. 免費額度充足，且整合容易。
  3. 支援 Email/Password 與 Google 第三方登入。
- **替代方案**：Supabase (也很優秀，但 Firebase 在純前端整合上文件更成熟且初始化更簡單)。

### 2. Data Model
- **Firestore Collection 結構**：
  `users (collection)` -> `{uid} (document)` -> `portfolio (collection)` -> `{ticker} (document: cost, qty, date)`
- **理由**：將每支股票獨立為一個文件，方便未來的單筆更新與刪除，同時確保權限（Security Rules）可嚴格限制使用者只能存取自己 `uid` 下的資料。

### 3. State Management
- **決策**：在 `app.js` 中實作一個 `onAuthStateChanged` 的監聽器。
- **行為**：
  - 未登入：`currentPortfolio` 設為空，顯示「請登入」畫面。
  - 已登入：發起請求讀取 Firestore 資料並填充 `currentPortfolio`，然後呼叫 `fetchPortfolioQuotes()`。

## Risks / Trade-offs

- **[Risk] Firebase Initialization** → 需要在前端暴露 Firebase Config。**Mitigation**: 這在 Firebase 是正常的（因安全依賴 Security Rules 而非隱藏 key），但仍建議將 Config 寫在 `.env` 中統一管理。
- **[Risk] Local Storage Migration** → 現有使用者的資料可能會在切換後消失。**Mitigation**: 本次實作不包含自動遷移邏輯，現有資料將被視為「訪客資料」並被覆蓋，需在發布前提醒使用者。
