# Tasks: PIP Algorithm Refinement

## 1. Algorithm Reconstruction (Math & Logic)
- [x] 1.1 實作資料標準化邏輯：計算股價平均值與標準差，產生 `standardized_y` 陣列。
- [x] 1.2 實作 `calcVerticalDistance(p1, p2, p3)` 函式，專注於計算給定標準化座標間的距離。
- [x] 1.3 實作 `pip_num_by_mse(PIP_VD_SUM, limit)` 函式，計算相鄰距離差值並與 MRAVG (平均數) 比較，回傳 `best_pip_num`。

## 2. Refactor `findPIPs` Function
- [x] 2.1 重構 `app.js` 中的 `findPIPs`：
  - 移除寫死的 `numPIPs = 7`，改為無上限動態計算（依據可見 K 線數量）。
  - 使用 `while` 迴圈依序找出每個階段讓 `vd` 總和最大的點，記錄到 `PIP_VD_SUM` 與 `PIP_INDEX_BY_ORDER`。
  - 迴圈結束後，呼叫 `pip_num_by_mse` 取得最佳數量 `K`。
  - 截取 `PIP_INDEX_BY_ORDER` 的前 `K` 個元素，按時間排序後回傳原本的價格資料。

## 3. UI & Visible Range Integration
- [x] 3.1 掛載 `currentStockChart.timeScale().subscribeVisibleLogicalRangeChange()` 事件。
- [x] 3.2 於事件觸發時，取得當下畫面可見的 K 線 (Visible Candles) 並動態觸發 PIP 重新計算與繪製，實現多解析度視角。
- [x] 3.3 確保動態數量下的 `generatePIPSignal` 依舊穩定準確。

## 4. Portfolio UI & Branding Refinement
- [x] 4.1 更新首頁與 Navbar 標題，將原本的產品名稱（如 AI Stock Trading）全面替換為 **AlphaLens**。
- [x] 4.2 優化 `Current Holdings` 表格的排版 (Padding, Spacing, 字體大小與顏色對比)，解決擁擠感。
- [x] 4.3 針對 Ticker, Price, Cost, Qty, P/L, Signal 等欄位進行寬度與對齊調整，提升視覺舒適度。
