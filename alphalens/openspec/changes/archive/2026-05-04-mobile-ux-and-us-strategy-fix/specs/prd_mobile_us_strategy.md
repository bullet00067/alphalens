# PRD: AlphaLens Mobile UX & AI Strategy Refinement

## 1. Overview
This PRD outlines the requirements for resolving critical mobile UX issues and optimizing the AI Strategy engine for US stocks.

## 2. Targeted Issues
### 2.1 Mobile UI Truncation
- **Context**: The Portfolio table is truncated on mobile devices instead of transforming into a card-based layout.
- **Root Cause**: CSS selector mismatch (`.table-container` in CSS vs `.table-responsive` in HTML) prevents the responsive transformation from triggering.
- **Requirement**: Unify the class names and ensure the card-based layout is fully functional on mobile viewports (<1024px).

### 2.2 Interactive Market Indices
- **Context**: Market index cards on the dashboard are static.
- **Requirement**:
  - Add click handlers to indices (S&P 500, NASDAQ, TWSE).
  - Map indices to valid tickers: `^GSPC`, `^IXIC`, `^TWII`.
  - Ensure `loadStockDetail` handles these tickers and renders charts.

### 2.3 US Strategy "Neutral" Output
- **Context**: US stocks frequently show "Neutral" trend even during clear trends.
- **Requirements**:
  - Add **Bearish Trend Detection** (Lower Highs + Lower Lows) to `strategyEngine.js`.
  - Review and adjust `adaptiveThreshold` for consolidation to account for US stock price ranges.
  - Increase the robustness of `findPIPs` to ensure at least 5-7 points are identified for standard 60-day views.

## 3. Technical Constraints
- No changes to the core PIP algorithm logic, only threshold tuning and state addition.
- Mobile viewports to support: 375px (iPhone SE), 390px (iPhone 13), 768px (iPad), 1024px (iPad Pro/Small Laptop).

## 4. Acceptance Criteria
- Portfolio view transforms to cards on devices < 1024px.
- Clicking "S&P 500" opens the detail view with a K-line chart.
- US stocks with clear trends (e.g. NVDA, AAPL) show "Bullish" or "Bearish" instead of "Neutral".
