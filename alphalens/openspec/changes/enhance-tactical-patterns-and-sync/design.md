# Design: Enhance Tactical Patterns and Sync

## Advanced Pattern Detection

### Head and Shoulders (H&S)
- **Structure**: Peak 1 (Left Shoulder), Peak 2 (Head, Higher), Peak 3 (Right Shoulder, Lower than Head).
- **Neckline**: Connect the two troughs between the peaks.
- **Criteria**: Left and Right shoulders should be within a certain price tolerance of each other.

### Triple Top / Bottom
- **Structure**: Three peaks (or troughs) at approximately the same price level.
- **Criteria**: Tolerance of <1.5% between highest and lowest peak.

## Dynamic UI Sync

### `refreshPipAnalysis(candles)`
- This function will be the single source of truth for "Current Tactical State".
- It will be called inside the debounced `subscribeVisibleLogicalRangeChange` listener.
- **Actions**:
  - `const pips = findPIPs(candles);`
  - `const signal = generatePIPSignal(candles, pips);`
  - Update `pipSeries` (Main Overlay).
  - Update `pipLineSeries` (Tactical Chart).
  - Update `patternLabel.textContent`.
  - Update `probContainer` (BULL/BEAR bars).
  - Call `renderPatternGeometry(signal.patterns[0], pips, pipChartInstance)`.
  - Call `renderStructureLabels(pips, pipChartInstance)`.

## Implementation Path
1.  **Refactor `generatePIPSignal`**: Allow passing `pips` to avoid redundant calculations.
2.  **Global Update Loop**: Hook into the main chart's time scale change.
