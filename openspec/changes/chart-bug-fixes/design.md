# Design: Chart Bug Fixes

## Data Source Alignment (TW Volume)
在 `app.js` 的 `fetchTWCandles` 函式中，台股資料由 FinMind 提供。其回傳的 JSON 結構中，成交量欄位命名為 `Trading_Volume` (大寫 T 與 V)，而非目前程式碼中預期的 `trading_volume`。
我們只需將 mapping 邏輯改為 `volume: d.Trading_Volume || d.trading_volume || 0` 即可修復此問題。

## PIP Data Structure Extension
為了在 Marker 上顯示成交量，`findPIPs` 函式回傳的陣列結構必須包含 `volume` 屬性。
目前 `data` 的 mapping 已經包含 `c.close`、`c.time`，我們需要補上 `volume: c.volume`，並在最後 `return` 時把 `volume` 一起拋出。

## Number & Date Formatting
在 `renderTradingViewChart` 繪製 Markers 時，我們需要：
1. **日期解析**：將 Lightweight Charts 格式的 UNIX Timestamp (`p.time`) 轉換為實體日期字串。可以使用 `new Date(p.time * 1000)` 取出 YYYY-MM-DD。
2. **數字縮寫**：實作一個簡單的輔助函式 `formatCompactNumber(num)`，若大於一百萬則後綴 `M`，大於一千則後綴 `K`。
3. **字串組合**：將上述資訊組合成易讀格式：`${YYYY-MM-DD} | P: $${Price} | V: ${Volume}`，取代原本簡陋的格式。
