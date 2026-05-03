# Design: Update Recent News Dashboard

## API Integration
- **Endpoint**: `https://finnhub.io/api/v1/news?category=general`
- **Method**: GET
- **Auth**: 需要在 `FINNHUB_API_KEY` 中帶入 Token。
- **Parameters**: 雖然 API 預設回傳很多條，我們在前端處理時僅取前 10 條。

## Logic Implementation
1. **新聞獲取函式**：在 `app.js` 中新增一個 `fetchMarketNews()` 函式，專門負責從 Finnhub 抓取一般金融新聞。
2. **時間格式化**：Finnhub 回傳的新聞時間為 UNIX Timestamp (秒)。需要一個輔助函式將其轉換為「x 小時前」或「x 分鐘前」的格式，以提升閱讀體驗。
3. **資料渲染**：修改 `populateDashboard` 中的新聞部分。
   - 呼叫 `fetchMarketNews()`。
   - 遍歷回傳的資料陣列，取出 `headline` (標題)、`source` (來源) 與 `datetime` (時間)。
   - 生成 HTML 字串並更新到 `#news-list` 元素。

## Error Handling & Fallback
- **無 API Key**：若 `.env` 中未設定 `VITE_FINNHUB_API_KEY`，應顯示提示訊息引導使用者設定。
- **請求失敗**：若網路錯誤或 API 次數限制，則保留目前的 Mock 資料或顯示錯誤訊息，避免區塊空白。
