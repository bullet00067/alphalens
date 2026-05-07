# Design: K-Line Pattern Recognition System

## 1. Mathematical Modeling

We will use the existing PIP (Perceptually Important Points) as the primary data source. Patterns will be identified by analyzing the last 5-7 PIP points.

### Slope Analysis
- For any two points $(x_1, y_1)$ and $(x_2, y_2)$: $m = (y_2 - y_1) / (x_2 - x_1)$.
- **Ascending Triangle**: 
  - Resistance slope $\approx 0$ (Tolerance $\pm 1\%$).
  - Support slope $> 0$.
- **Double Bottom (W-Bottom)**:
  - Two troughs $L_1, L_2$ where $|L_1 - L_2| / L_{avg} < 1.5\%$.
  - A peak $H_1$ between them (the neckline).

## 2. Implementation Architecture

### strategyEngine.js
- `identifyPatterns(pips)`: Main entry point. Returns an array of detected pattern objects.
- `checkTriangle(peaks, troughs)`: Logic for triangle detection.
- `checkDoublePattern(peaks, troughs)`: Logic for M/W patterns.

### app.js
- `renderTradingViewChart`: 
  - Update to subscribe to pattern results.
  - Draw `TrendLine` objects for identified resistance/support.
  - Add `PriceLine` or `Tooltip` for target price projections.
- **Tactical View Implementation**:
  - Add a secondary `createChart` instance for the PIP-only view.
  - Synchronize its `timeScale` with the main chart.
  - Use a `LineSeries` to draw the PIP sequence as a continuous tactical line.
  - Overlay text labels (e.g. "Descending Triangle") on this chart.

## 3. Visualization Strategy
- Use `lightweight-charts` `createPriceLine` for static levels.
- For diagonal lines (Triangle boundaries), we will use the `series.setMarkers` or consider a `LineSeries` overlay if diagonal lines are strictly required (Note: `lightweight-charts` native diagonal lines are limited, we may need to use a separate series for segments).

## 4. Performance
- Recalculate only when `visibleLogicalRange` changes significantly.
- Memoize the slope calculations per PIP sequence.
