# Tasks: PIP Strategy Optimization

## Phase 1: Algorithm Tuning
- [ ] Implement `calculateStdDev` in `strategyEngine.js`.
- [ ] Update `analyzeTrend` to use peak variance + standard deviation for `CONSOLIDATION` detection.
- [ ] Verify with the synthetic sine-wave dataset to ensure `CONSOLIDATION` status is correctly reported.

## Phase 2: UI Enhancements
- [ ] Add `observation-list-section` to `index.html` (Portfolio/Dashboard).
- [ ] Implement `renderObservationList` in `app.js` to show tickers and latest signals.
- [ ] Add "Remove" quick-action to the observation list items.

## Phase 3: AI Assistant Integration
- [ ] Create a utility function `getGlobalSignalContext` to gather all active signals.
- [ ] Inject this context into the AI Assistant's summary generation logic.

## Phase 4: Final Verification
- [ ] Run `npm run build`.
- [ ] Capture final screenshots of the improved Dashboard UI.
