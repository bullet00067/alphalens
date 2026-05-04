# Proposal: PIP Strategy Optimization & UX Enhancement

## Goal
Optimize the core PIP algorithm for higher precision in range-bound markets and improve the user experience by providing visibility into the "Observation List".

## Objectives
1. **Algorithmic Precision**: Refine `analyzeTrend` to better distinguish between `BULLISH` and `CONSOLIDATION` states using standard deviation of peaks.
2. **Observation Visibility**: Implement a dedicated UI list for observed stocks on the Dashboard.
3. **Contextual AI**: Ensure the global AI Assistant is aware of active tactical signals.

## Proposed Changes
- **strategyEngine.js**: Add `stdDev` calculation to trend analysis.
- **index.html**: Add `observation-list-container` in the Portfolio view.
- **app.js**: Implement `renderObservationList` and update AI Assistant prompt injection.
