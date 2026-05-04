# Tasks: Mobile UX & Strategy Fix

## Phase 1: Mobile UI & Navigation
- [x] **Fix CSS Selectors**: Change `.table-container` to `.table-responsive` in `styles.css` to trigger card-mode.
- [x] **Mobile Overflows**: Add `overflow-x: hidden` to `.view` and `.main-content` for mobile to prevent truncation.
- [ ] **Interactive Indices**: 
  - [x] Add `onclick` to index cards in `populateDashboard`.
  - [x] Map "S&P 500" to `^GSPC`, "NASDAQ" to `^IXIC`, "TWSE" to `^TWII`.
  - [x] Ensure `fetchUSCandles` and `fetchTwseCandles` handle index symbols correctly.

## Phase 2: Strategy Engine Hardening
- [x] **Implement Bearish State**: Add LH/LL detection to `analyzeTrend` in `strategyEngine.js`.
- [ ] **Threshold Tuning**:
  - [x] Adjust `adaptiveThreshold` to handle high-priced US stocks more gracefully.
  - [x] Ensure `findPIPs` consistently returns enough points (min 5-7) for standard trends.
- [ ] **PIP Visualization**: Verify markers for Bearish trends (Red arrows for Lower Highs).

## Phase 3: Verification & Test
- [ ] **Mobile Simulation**: Verify Portfolio card layout on 375px and 768px.
- [ ] **Index Drill-down**: Click each index card and verify the chart loads.
- [ ] **US Trend Check**: Search for NVDA/AAPL and verify status is not "Neutral" if trending.
- [ ] **AI Assistant Check**: Ask AI about the S&P 500 trend and verify tactical awareness.
