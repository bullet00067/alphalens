# Tasks: Align Tactical Chart Layout

Implementation plan for aligning the right side of the tactical chart with the main chart.

## Phase 1: Implementation
- [x] **Main Chart Configuration**
  - [x] Update `currentStockChart` initialization in `app.js` to set `minimumWidth: 80` for `rightPriceScale`.
- [x] **Tactical Chart Configuration**
  - [x] Update `pipChartInstance` initialization in `app.js` to set `minimumWidth: 80` for `rightPriceScale`.
- [x] **RSI Chart Configuration**
  - [x] Update `rsiChart` initialization in `app.js` to set `minimumWidth: 80` for `rightPriceScale`.

## Phase 2: Verification
- [ ] **Visual Alignment Check**
  - [ ] Load the dashboard and toggle TACTICAL mode.
  - [ ] Verify the right price scale boundary is perfectly aligned vertically.
  - [ ] Verify the grid lines are continuous across both charts.
- [ ] **Cross-Ticker Validation**
  - [ ] Test with a low-priced stock (e.g., TSLA ~$20) and a high-priced stock (e.g., NVR ~$8000) to ensure the 80px width handles both correctly.
