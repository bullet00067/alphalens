# Tasks: Enhanced Tactical PIP Chart Visualization

Implementation plan for synchronizing charts and adding geometric pattern overlays.

## Phase 1: Chart Synchronization & UI Prep
- [x] **Sync Logic**
  - [x] Implement bidirectional time scale synchronization between `currentStockChart` and `pipChartInstance`.
  - [x] Ensure crosshair synchronization across both chart instances.
- [x] **UI Controls**
  - [x] Add "PIP Overlay" toggle button to the chart toolbar in `index.html`.
  - [ ] Update `styles.css` for new toolbar buttons and legend styles.

## Phase 2: Pattern Visualization
- [x] **Core Overlay Logic**
  - [x] Create `patternOverlaySeries` in `app.js` initialization.
  - [x] Implement `renderPatternGeometry` helper function to draw Triangle and M/W legs.
- [x] **Structure Labeling**
  - [x] Implement `renderStructureLabels` to identify and mark HH, HL, LL, LH on the PIP chart.
  - [ ] Add tooltip support for hovering over PIP points.

## Phase 3: Main Chart Integration
- [x] **PIP Overlay on Main**
  - [x] Add `mainPipSeries` to the main K-line chart.
  - [x] Implement toggle logic to show/hide this series.
  - [x] Ensure the overlay line stays updated when timeframe or stock changes.

## Phase 4: Polish & Testing
- [x] **Refinement**
  - [x] Update `styles.css` for new toolbar buttons and legend styles.
  - [x] Fine-tune line weights and opacities for better visibility on dark backgrounds.
- [x] **Verification**
  - [x] Test synchronization across multiple timeframes.
  - [x] Verify pattern overlays are accurate to AI signals.
  - [x] Test with stocks showing clear patterns (e.g., TSLA for volatility, 2330.TW for trends).
  - [x] Verify synchronization accuracy during aggressive zooming/scrolling.
