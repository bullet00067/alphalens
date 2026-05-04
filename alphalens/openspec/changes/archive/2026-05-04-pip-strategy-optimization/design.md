# Technical Design: PIP Strategy Optimization

## 1. Algorithmic Optimization (Consolidation Detection)
To address the "Bullish Over-detection" in horizontal ranges, we will introduce a volatility-based check.

### Proposed Logic:
In `strategyEngine.js`, update `analyzeTrend` to include:
- **Peak Dispersion**: Calculate the Standard Deviation of the price levels of the last 4 PIP peaks.
- **Dispersion Threshold**: If `stdDev / currentPrice < 0.005` (0.5% variance), classify the structure as `CONSOLIDATION` regardless of whether peaks are slightly ascending.
- **Confidence Adjustment**: Increase confidence if the range is tight (Low stdDev) and decreasing volume is observed (typical of consolidation).

## 2. UI Enhancement (Observation List)
A dedicated container on the Dashboard to track monitored assets.

### Proposed Structure:
- **Location**: Adjacent to "Current Holdings" or as a secondary tab in the Portfolio view.
- **Component**: `ObservationTable`.
- **Columns**: Ticker, Current Price, PIP Trend, Latest Signal (AI Badge), Actions (View Detail / Remove).
- **Data Source**: Firestore `users/${uid}/observations` collection.

## 3. Global AI Integration
Injecting tactical context into the general assistant.

### Implementation Pattern:
- **Context Provider**: A new function `getTacticalContext()` that iterates through Portfolio and Observation stocks.
- **Prompt Injection**: Update `generateAISummary` to include a section: `Tactical Alerts: [List of high-confidence signals from the PIP engine]`.
- **UX**: The AI Assistant should proactively mention these alerts when summarizing market conditions.

## 4. Performance & Scalability
- **Batch Processing**: The pre-close scanner will batch verification requests to the ACL to avoid rate-limiting.
- **State Management**: Use a centralized `tacticalState` object to prevent redundant PIP calculations across different UI components.
