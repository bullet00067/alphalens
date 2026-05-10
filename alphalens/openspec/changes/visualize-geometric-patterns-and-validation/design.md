# Design: Visualize Geometric Patterns and Data Validation

## 1. Yahoo Finance ACL (Anti-Corruption Layer)
### Logic
- **Module**: `app.js` -> `verifyWithYahoo(ticker, localPrice)`
- **Mechanism**: 
  - Call a Yahoo Finance proxy (e.g., `query2.finance.yahoo.com` via our CORS proxy).
  - Extract the `regularMarketPrice`.
  - Compare with `localPrice`.
  - If `Math.abs(local - yahoo) / yahoo > 0.005` (0.5%), flag a `DATA_LAG_WARNING`.
- **UI Integration**:
  - Show a "Verified" badge (green) or "Warning" badge (amber) in the Tactical panel.

## 2. Geometric Rendering Layer
### Charting Strategy (Lightweight Charts)
- **Trendlines**: Use `LineSeries` with `lastPriceLineVisible: false` and `priceLineVisible: false`.
- **Patterns**:
  - **Triangle/Rectangle**: Render two `LineSeries` for the upper and lower boundaries. The lines should connect the PIP indices and extend to the current bar.
  - **M/W (Double Top/Bottom)**: Highlight the "neckline" using a horizontal `PriceLine` or a specific `LineSeries` segment.
- **Node Labeling**:
  - Use `createSeriesMarkers` on the main Candlestick series.
  - Label types: `HH`, `HL`, `LH`, `LL`, `H`, `L`.

## 3. PIP Data Flow
- `generatePIPSignal` will be updated to return not just the signal, but the specific `points` and `slope` data needed for drawing.
- `app.js` will catch this extended data and update the drawing layers.

## 4. UI: Tactical Panel Updates
- **Field**: `Detected Pattern` (e.g., "Ascending Triangle").
- **Verification Status**: `[✔ Verified]` or `[⚠ Lag Detected]`.
- **Logic**: Target price calculation will change from purely ATR-based to "Breakout + Pattern Height" when a pattern is active.
