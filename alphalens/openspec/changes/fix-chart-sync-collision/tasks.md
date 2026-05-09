# Tasks: Fix Chart Sync Collision

- [ ] Implement `areRangesEqual` helper in `app.js`.
- [ ] Update `renderTradingViewChart` to use `chart.remove()` and remove global variable resets.
- [ ] Refactor `togglePipTactical` to initialize the tactical chart *before* triggering main chart updates.
- [ ] Add range guards to all `subscribeVisibleLogicalRangeChange` listeners.
- [ ] Verify that enabling both PIP Overlay and TACTICAL no longer causes the K-line to disappear.
- [ ] Test rapid scrolling to ensure the feedback loop guard is working.
