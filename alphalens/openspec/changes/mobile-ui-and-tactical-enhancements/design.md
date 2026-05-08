# Design: Mobile UI and Tactical Enhancements (Revised)

## 1. Responsive Mobile UI (Grid-based)
### CSS Strategy
- **Target**: `.chart-toolbar` and `.control-group` within `#stock-detail-view`.
- **Logic**: 
  - On screens < 768px, `.chart-toolbar` will use `display: flex; flex-wrap: wrap; gap: 12px; justify-content: flex-start;`.
  - Each `.control-group` will be treated as a visual unit with a subtle background (`rgba(255, 255, 255, 0.05)`) and rounded corners to maintain grouping even when wrapped.
  - Buttons will maintain a minimum width and height (min-height: 36px) to remain touch-friendly.
  - The "Clear All" button will be positioned logically at the end of the group.
- **Why**: Avoids the "hidden" nature of horizontal scrolling, ensuring all tools are visible and accessible without swiping frustration.

## 2. Taiwan Stock Pattern Recognition
- Ensure `standardizeData` (Z-score) correctly handles the wider price ranges of Taiwan stocks.
- Verify candle field mapping in `strategyEngine.js` matches the fallback source.
- Adjust PIP sensitivity if necessary.

## 3. Probability Prediction Model
- **Logic**: Weighted sum of Pattern (40%), Trend (30%), RSI (15%), and MA Alignment (15%).
- **Display**: A dual-bar or percentage display in the Tactical panel: `Bullish 65% / Bearish 35%`.
