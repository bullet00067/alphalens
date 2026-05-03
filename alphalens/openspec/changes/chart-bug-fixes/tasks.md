# Tasks: Chart Bug Fixes

## 1. Fix TW Stock Volume Mapping
- [x] 1.1 打開 `app.js`，尋找 `fetchTWCandles` 函式。
- [x] 1.2 在 mapping `volume` 的地方，將 `d.trading_volume || 0` 修正為 `d.Trading_Volume || d.trading_volume || 0`。

## 2. Extend findPIPs Output
- [x] 2.1 於 `app.js` 的 `findPIPs` 函式中，在 `const data = candles.map(...)` 區塊補上 `volume: c.volume`。
- [x] 2.2 在 `findPIPs` 回傳陣列的 `map` 區塊中，補上 `volume: data[idx].volume` 屬性。

## 3. Implement formatCompactNumber Helper
- [x] 3.1 於 `app.js` 加入輔助函式 `formatCompactNumber(num)`。若數字 `>= 1e6` 回傳 `.toFixed(1) + 'M'`，若 `>= 1e3` 回傳 `.toFixed(1) + 'K'`，否則直接回傳該數字。

## 4. Update PIP Markers Text Format
- [x] 4.1 在 `app.js` 的 `renderTradingViewChart` 中，修改 `pipSeries.setMarkers()` 的邏輯。
- [x] 4.2 將 Unix timestamp (`p.time`) 轉換為 `YYYY/MM/DD` 格式的日期字串。
- [x] 4.3 將 marker 的 `text` 屬性更新為新的排版：`${dateStr} | P: $${p.value.toFixed(2)} | V: ${formatCompactNumber(p.volume)}`。
