# Tasks: Refine Tactical Patterns and Sync

- [ ] **Phase 1: Tooltip & Sync Fix**
    - [ ] Update `app.js` hover logic to use `createSeriesMarkers` for consistent label rendering.
    - [ ] Audit `renderTradingViewChart` and `renderTacticalChart` to ensure `rightPriceScale.minimumWidth` is identical.
    - [ ] Refine the `subscribeVisibleLogicalRangeChange` handler to prevent feedback loops while ensuring sync.

- [ ] **Phase 2: Pattern Engine Enhancement**
    - [ ] Update `strategyEngine.js`: `identifyPatterns` to include `probability` objects.
    - [ ] Refine `renderPatternGeometry` in `app.js` to draw dashed lines for pattern boundaries in the standardized coordinate space.
    - [ ] Update `renderPatternLabels` to show probability percentages in the TACTICAL UI.

- [ ] **Phase 3: Verification & Deployment**
    - [ ] Run Localhost: Search for multiple tickers, check hover on markers, and verify chart alignment during drag/zoom.
    - [ ] Push to GitHub: Resolve any build errors.
    - [ ] Verify on Render: Confirm performance and UI accuracy on mobile and desktop.
