## Why

目前 AlphaLens 具備基礎的趨勢分析（多頭/空頭/盤整）與 PIP 關鍵點位偵測，但缺乏對具體「價格型態」（如三角收斂、W底、M頭）的識別能力。價格型態是技術分析中預測突破與反轉的重要依據，實作自動化識別能大幅提升 AI 策略的精準度與視覺說服力。

## What Changes

- **建立型態識別引擎**：在 `strategyEngine.js` 中新增 `PatternRecognition` 模組，利用 PIP 高低點序列進行幾何特徵匹配。
- **實作基礎型態庫**：
  - 三角收斂系列（上升、下降、對稱三角）。
  - 雙重頂/底（M頭、W底）。
- **圖表視覺化增強**：
  - 自動繪製型態的「壓力線」與「支撐線」。
  - 在偵測到型態時，於圖表標註名稱並提供預期突破方向。
- **動態決策支援**：根據識別出的型態高度，自動計算 Target 價位。
- **新增「戰術 PIP 視圖」(Tactical PIP View)**：在主圖表下方或獨立區塊新增一個 Grid，專門顯示純粹的 PIP 線圖（去除 K 線噪音），並在該視圖中標註識別出的型態名稱。

## Capabilities

### New Capabilities
- `pattern-recognition-engine`: 負責幾何斜率計算與型態特徵匹配的核心邏輯。

### Modified Capabilities
- `ai-trading-signals`: 整合型態偵測結果，提升訊號的信心分數。
- `stock-dashboard`: 在 TradingView 圖表中動態渲染型態趨勢線，並實作獨立的 PIP 戰術圖表面板。

## Impact

- **使用者體驗**：使用者不僅能看到 PIP 點，還能看到構成的「三角形」或「M頭」，資訊更具象化。
- **效能**：由於型態識別需在縮放時即時運算，需優化 PIP 序列的處理效率。
