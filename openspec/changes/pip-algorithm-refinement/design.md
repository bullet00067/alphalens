# Design: PIP Algorithm Refinement

## System Architecture Updates
目前 `findPIPs` 函式是寫死的 O(K*N) 演算法（K為給定數量）。
新的架構將改為兩階段：
1. **PIP Ordering (重要性排序)**：計算出陣列中所有點作為 PIP 的重要性順序，並記錄每個階段的 Vertical Distance (VD) 總和。
2. **MSE Optimization (動態截斷)**：計算相鄰階段 VD 總和的變異數 (MSE reduction)，並取得平均值 (MRAVG)。找出最後一個「變異數下降幅度大於平均值」的階段，作為最佳的 PIP 數量 (`best_pip_num`)。

## Key Technical Decisions
1. **效能優化與範圍界定 (Visible Range Optimization)**:
   - 原始 Notebook 將迭代跑完全部資料量 (`N`)。若 `N=2500` 會造成 O(N^3) 耗時卡頓。
   - **採納新提案**：我們將掛載 `lightweight-charts` 的 `timeScale().subscribeVisibleLogicalRangeChange()` 事件。
   - 當使用者縮放圖表（如 60 根 K 線放大到 120 根）時，我們**僅針對當下畫面中可見的 K 線 (Visible Candles)** 進行 PIP 運算與繪圖。
   - **優勢**：
     - **效能極佳**：畫面能顯示的 K 線通常不超過幾百根，這讓 O(N^3) 的演算法也能在極短的毫秒內瞬間算完，不再需要硬性設定 `MAX_PIPS`。
     - **動態解析度**：使用者拉遠（Zoom Out）時能看見「大波段的轉折」；拉近（Zoom In）時能看見「微觀的短線轉折」，符合直覺的看盤體驗。
2. **標準化 (Standardization)**:
   - 原始碼使用了 `StandardScaler` 將股價標準化。但在計算垂直距離時，如果 X 軸 (Index) 與 Y 軸 (Price) 的尺度落差極大，距離計算會被 X 軸主導。
   - 我們將在演算法內部實作簡易的 Min-Max Scaler 或 Z-score Scaler 針對 Y 軸進行縮放，以還原 Python Notebook 的距離權重比例。

## Data Flow
1. 傳入 `candles` 資料。
2. 提取 `close` price，計算 Mean 與 StdDev 進行標準化 (`standardized_y`)。
3. 執行迴圈尋找下一個 Maximum Vertical Distance 的點，記錄 `vd_sum` 到 `PIP_VD_SUM` 陣列，並將該點加入 `PIP_INDEX_BY_ORDER`。
4. 計算 `PIP_VD_MVRANGE` 陣列（差值）。
5. 算出平均數 `MRAVG`，並透過條件 `PIP_VD_MVRANGE[k] > MRAVG` 決定最佳數量。
6. 取前 `best_pip_num` 個點，按時間排序後回傳。
