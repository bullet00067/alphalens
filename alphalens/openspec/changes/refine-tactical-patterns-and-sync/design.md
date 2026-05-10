# Design: Refine Tactical Patterns and Sync

## 1. Tooltip Stabilization
### Issue
Manual `series.setMarkers` calls might bypass or conflict with the `createSeriesMarkers` helper used elsewhere.

### Solution
Replace all `series.setMarkers` or manual marker manipulations in `app.js` with `createSeriesMarkers(series, markers)`.

## 2. TimeScale Synchronization
### Issue
Charts are misaligned due to varying price scale widths and different data densities.

### Solution
- **Fixed Width**: Enforce `minimumWidth: 100` on `rightPriceScale` for both `currentStockChart` and `pipChartInstance`.
- **Ghost Data**: Ensure `pipGhostSeries` in the tactical chart contains exactly the same timestamp array as the main chart to align the logical index.
- **Bi-directional Sync**: Use `subscribeVisibleLogicalRangeChange` on both charts to ensure a master-slave or peer-peer sync.

## 3. Pattern Geometry & Probability
### Data Enhancement (`strategyEngine.js`)
- **`identifyPatterns(pips)`**: 
    - Add a `probability` property to each detected pattern.
    - Logic:
        - **Ascending Triangle**: Bullish 70%, Bearish 30%.
        - **Descending Triangle**: Bearish 70%, Bullish 30%.
        - **Rectangle**: Bullish 50%, Bearish 50% (neutral until breakout).
        - **Double Top**: Bearish 80%.
        - **Double Bottom**: Bullish 80%.

### Visual Enhancement (`app.js`)
- **`renderPatternGeometry`**:
    - Update to handle the standardized `stdY` coordinate space correctly.
    - Draw dashed lines for the upper and lower boundaries of the pattern.
- **Probability UI**:
    - Add a small probability indicator in the TACTICAL chart header or sidebar.
    - Example: "Prob: Bullish 65% / Bearish 35%".

## 4. UI Layout
- Ensure the `pip-pattern-label` element is clearly visible and styled with appropriate colors based on the pattern's bullish/bearish bias.
