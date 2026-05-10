# Proposal: Visualize Geometric Patterns and Data Validation

## Goal
Align the AlphaLens dashboard with the updated PRD requirements by implementing visual geometric pattern rendering (trendlines, support/resistance), labeling key PIP nodes (HH, HL, etc.), and adding a mandatory real-time price validation layer using Yahoo Finance to ensure decision accuracy.

## Why
- **Visual Evidence**: Users need to see the geometric basis of a buy/sell signal to trust the algorithm.
- **Data Integrity**: Lagged data in free APIs can lead to "ghost breakouts." A dual-verification with Yahoo Finance acts as a "safety fuse" for real-world trading decisions.
- **Pattern Clarity**: Labeling points like Higher Lows (HL) and Lower Highs (LH) helps users understand market structure.

## Scope
1. **Geometric Rendering**: Draw trendlines and boundaries for detected patterns (Triangles, Rectangles, M/W) directly on the chart.
2. **Structural Labeling**: Add text markers to PIP points (HH, HL, LH, LL) to visualize trend progression.
3. **Yahoo Finance ACL**: Implement an Anti-Corruption Layer (ACL) that verifies the latest price before rendering tactical signals.
4. **UI Enhancement**: Add a "Detected Pattern" field to the Tactical panel and update the Forecast Confidence logic to be pattern-aware.
