# Tasks: Enhance Tactical Patterns and Sync

## Phase 1: Strategy Engine (New Patterns)
- [ ] Add `checkHeadAndShoulders` to `strategyEngine.js`.
- [ ] Add `checkTriplePattern` to `strategyEngine.js`.
- [ ] Update `identifyPatterns` to include these new checks.
- [ ] Refactor `generatePIPSignal` to accept pre-calculated `pips`.

## Phase 2: App Core (Dynamic Sync)
- [ ] Implement `refreshPipAnalysis(visibleData)` in `app.js`.
- [ ] Update the `VisibleLogicalRangeChange` listener to call `refreshPipAnalysis`.
- [ ] Ensure the Tactical Chart instance is cleared/updated correctly when the ticker changes.

## Phase 3: UI & Verification
- [ ] Verify that pattern labels change as you zoom in on a structure.
- [ ] Verify yellow lines match perfectly between Main and Tactical.
- [ ] Test the "Head and Shoulders" detection with historical data.
