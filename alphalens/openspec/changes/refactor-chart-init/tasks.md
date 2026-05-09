# Tasks: Refactor Chart Initialization

- [ ] Extract tactical chart logic into `renderTacticalChart(candles)`.
- [ ] Extract AI signal logic into `updateAISignals(ticker, candles)`.
- [ ] Update `loadChartData` to use these new functions.
- [ ] Refactor `togglePipTactical` to call `renderTacticalChart` directly instead of `loadStockDetail`.
- [ ] Verify that toggling TACTICAL no longer causes the main chart to flicker or disappear.
- [ ] Verify that multi-chart synchronization still works correctly.
