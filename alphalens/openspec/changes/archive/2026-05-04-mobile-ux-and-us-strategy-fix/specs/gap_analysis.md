# Gap Analysis: Mobile UX & Strategy Fix

## 1. UI/UX Gaps
- **Breakpoint Logic**: The current CSS uses 1024px as a hard breakpoint, but the table transformation logic is tied to an incorrect class.
  - *Fix*: Map `.portfolio-table` or `.table-responsive` to the card-mode media query.
- **Dashboard Interactivity**: The indices section in `populateDashboard` uses static HTML generation.
  - *Fix*: Inject `onclick` handlers during HTML generation or use event delegation.

## 2. Logic/Engine Gaps
- **Incomplete State Machine**: The `analyzeTrend` function lacks a `BEARISH` state.
  - *Fix*: Implement LH/LL detection.
- **Data Depth**: US candles fetched from Twelve Data might default to a length that doesn't trigger enough PIPs for the "MSE" optimization.
  - *Fix*: Force a minimum PIP count (e.g. 7) if the data series is long enough.
- **Symbol Mapping**: Indices symbols (`^GSPC`, etc.) are not currently mapped in the home page cards.
  - *Fix*: Update the `INDICES` constant or mapping logic in `app.js`.

## 3. Implementation Path
1. **CSS/HTML Sync**: Immediate fix for mobile layout.
2. **Event Mapping**: Connect dashboard cards to detail views.
3. **Logic Expansion**: Update `strategyEngine.js` with Bearish state and tuned thresholds.
