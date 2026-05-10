# Tasks: Visualize Geometric Patterns and Data Validation

- [x] **Infrastructure: Yahoo Finance Validation**
  - [x] Implement `verifyWithYahoo` utility in `app.js`.
  - [x] Add `DATA_VALIDATION_STATUS` to the app state.
  - [x] Show validation status in the Tactical UI.

- [x] **Strategy Engine Enhancement**
  - [x] Update `identifyPatterns` to include boundary line coordinates (slope/intercept).
  - [x] Update `calculateProbability` to give higher weight to confirmed pattern breakouts.
  - [x] Implement pattern-based target price calculation.

- [x] **UI: Geometric Drawing**
  - [x] Initialize `patternUpperSeries` and `patternLowerSeries` in `app.js`.
  - [x] Implement `renderPatternGeometry(pattern)` to draw trendlines.
  - [x] Implement `renderStructureLabels(pips)` to add HH/HL/LH/LL markers.
  - [x] Update `updateTacticalPanel` to display the "Detected Pattern" field.

- [x] **Integration & Cleanup**
  - [x] Trigger validation before every tactical refresh.
  - [x] Ensure lines clear correctly when switching stocks or timeframes.
  - [x] Verification test: Compare rendered lines against manual chart analysis for 2330.TW.
