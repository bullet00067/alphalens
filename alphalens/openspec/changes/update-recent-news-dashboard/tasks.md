# Tasks: Update Recent News Dashboard

## 1. Implement News Fetching Logic
- [x] 1.1 在 `app.js` 中新增 `fetchMarketNews()` 函式。
- [x] 1.2 使用 `fetch` 呼叫 Finnhub 的 `/news?category=general` 終端。
- [x] 1.3 加入錯誤處理邏輯，確保在 API Key 遺失或請求失敗時不會崩潰。

## 2. Implement Relative Time Formatter
- [x] 2.1 新增 `getRelativeTime(timestamp)` 輔助函式。
- [x] 2.2 邏輯應包含「x 分鐘前」與「x 小時前」的判斷，若超過 24 小時則顯示日期。

## 3. Update Dashboard Population
- [x] 3.1 修改 `app.js` 中的 `populateDashboard()` 函式。
- [x] 3.2 將原本手寫的 `mockNews` 陣列替換為呼叫 `fetchMarketNews()` 的結果。
- [x] 3.3 僅選取前 10 則新聞進行渲染。
- [x] 3.4 更新 DOM 渲染邏輯，確保使用正確的屬性名（如 `headline`, `source`, `datetime`）。

## 4. Verification
- [x] 4.1 重新整理頁面，確認 Dashboard 的 Recent News 區塊載入最新的 10 則新聞。
- [x] 4.2 檢查時間格式化是否正確顯示（如 "1 hour ago"）。
- [x] 4.3 點擊新聞（如果需要跳轉）或確認其排列順序。
