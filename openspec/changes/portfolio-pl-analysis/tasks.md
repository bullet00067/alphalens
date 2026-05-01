## 1. 資料與邏輯層 (Data & Logic)

- [ ] 1.1 在 `app.js` 實作 `fetchPortfolioQuotes()`：異步獲取所有持倉的最新報價
- [ ] 1.2 更新 `renderPortfolio()`：整合報價數據並計算個股損益與報酬率
- [ ] 1.3 擴充 `calculateAISignals()`：新增 TP1, TP2 與 Break-even (保本) 判斷邏輯

## 2. 庫存分頁 UI (Portfolio View UI)

- [ ] 2.1 在 `index.html` 的 `portfolio-view` 新增「組合總覽卡片」 (Total Equity, P/L)
- [ ] 2.2 更新 `portfolio-table-body`：增加「現價」、「市值」、「損益」欄位
- [ ] 2.3 為損益欄位加入顏色渲染邏輯（紅/綠顯示）

## 3. 詳細頁面 UI (Detail View UI)

- [ ] 3.1 更新 `ai-signal-card` 模板：同時顯示 TP1 (50%) 與 TP2 (100%) 價位及預計獲利金額
- [ ] 3.2 實作「移動保本」提示：當股價 > TP1 時，AI 訊號卡片高亮顯示「建議將停損移至成本位」

## 4. 驗證與測試 (Verification)

- [ ] 4.1 驗證當持倉觸發 TP1 後，保本提醒是否正確顯示
- [ ] 4.2 檢查 API 請求頻率，確保不會因為過多持倉導致 429 錯誤
- [ ] 4.3 最終 UI 佈局調整，確保在各裝置顯示正常
