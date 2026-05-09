# Walkthrough: Enhance Tactical Patterns and Sync

## 1. Unified PIP & Pattern Synchronization
The most significant change is the introduction of `refreshPipAnalysis` in `app.js`. This function ensures that both the main chart overlay and the tactical chart below are derived from the *exact same visible dataset*.

- **Dynamic Updates**: As you scroll or zoom the main chart, the tactical chart's yellow PIP line updates in real-time to match the level of detail seen on the main chart.
- **Pattern Awareness**: Patterns like "Ascending Triangle" are now re-evaluated every time the view changes, ensuring the "PATTERN: X" label in the tactical panel reflects what is currently on screen.

## 2. Advanced Pattern Recognition
We have added more sophisticated market structure detection to `strategyEngine.js`:
- **Head and Shoulders (Top/Bottom)**: Identifies the classic 3-peak reversal structure.
- **Triple Top/Bottom**: Detects structures where price tests the same level three times.
- **Improved Visualization**: These new patterns are now correctly rendered with connecting lines in the tactical chart.

## 3. UI Improvements
- **Confidence Bars**: The "BULL/BEAR" probability bars now update dynamically alongside the patterns.
- **Structure Labels**: "HH", "LL", "HL", "LH" labels are refreshed as you navigate the chart to provide constant technical context.

## Verification
- [x] Zoom into a specific trend: Yellow PIP lines match exactly.
- [x] Scroll to a Head and Shoulders structure: Pattern label appears.
- [x] Ticker change: Both charts reset and sync correctly.
