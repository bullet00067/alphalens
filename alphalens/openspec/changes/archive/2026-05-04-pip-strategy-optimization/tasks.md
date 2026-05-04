# Tasks: PIP Strategy Optimization

## Phase 1: Algorithm Tuning
- [x] Implement `calculateStdDev` in `strategyEngine.js`.
- [x] Update `analyzeTrend` to use peak variance + standard deviation for `CONSOLIDATION` detection.
- [x] Verify with the synthetic sine-wave dataset to ensure `CONSOLIDATION` status is correctly reported.

## Phase 2: UI Enhancements
- [x] Add `observation-list-section` to `index.html` (Portfolio/Dashboard).
- [x] Implement `renderObservationList` in `app.js` to show tickers and latest signals.
- [x] Add "Remove" quick-action to the observation list items.

## Phase 3: AI Assistant Integration
- [x] Create a utility function `getGlobalSignalContext` to gather all active signals.
- [x] Inject this context into the AI Assistant's summary generation logic.

## Phase 4: Final Verification
- [x] Run `npm run build`.
- [x] Capture final screenshots of the improved Dashboard UI.
