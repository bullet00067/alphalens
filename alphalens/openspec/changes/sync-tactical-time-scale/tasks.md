# Tasks: Sync Tactical Time Scale

Steps to implement perfect time synchronization between charts.

## Phase 1: Preparation
- [ ] **State Variables**
  - [ ] Add `pipGhostSeries` to the top of `app.js`.

## Phase 2: Implementation
- [ ] **Ghost Series Setup**
  - [ ] Initialize `pipGhostSeries` in `renderTradingViewChart` when `isPipTacticalEnabled` is true.
  - [ ] Populate `pipGhostSeries` with the full `candles` dataset timestamps.
- [ ] **Synchronization Update**
  - [ ] Add immediate range application after tactical chart creation.
  - [ ] Verify existing bidirectional listeners are active.

## Phase 3: Verification
- [ ] **Functional Test**
  - [ ] Verify main chart and tactical chart time scales are identical.
  - [ ] Verify cross-ticker consistency.
