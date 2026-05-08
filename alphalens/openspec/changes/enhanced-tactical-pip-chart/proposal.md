# Proposal: Enhanced Tactical PIP Chart Visualization

Improve the TACTICAL panel's simplified PIP (Perceptually Important Points) line chart by synchronizing it with the main K-line chart and adding geometric pattern overlays to help users better understand market structures.

## Problem Statement

The current TACTICAL mode provides a simplified line chart based on PIP algorithm, but it has several limitations:
- **Limited Context**: The PIP chart is displayed in a separate container below the main chart, making it difficult for users to visually correlate PIP turning points with specific candles.
- **Abstract Patterns**: While the system identifies patterns (Triangles, Double Tops), they are only presented as text labels. Users cannot see the "shape" of the pattern drawn on the chart.
- **Sync Issues**: While some synchronization exists, the visual presentation (missing time scale on PIP chart) makes it feel disconnected from the main price action.

## Proposed Solution

1.  **Time Scale Synchronization & Visibility**: 
    - Enable the time scale on the PIP chart but keep it minimal.
    - Improve the synchronization logic to ensure crosshair and visible range are perfectly aligned between the main chart and the PIP chart.
2.  **Geometric Pattern Overlays**:
    - Draw identified patterns (Triangles, M/W shapes) directly on the PIP line chart using SVG or Canvas overlays (via Lightweight Charts API).
    - Use color-coded lines and shaded regions to highlight the "active" pattern area.
3.  **Pattern Key Point Labeling**:
    - Label Higher Highs (HH), Higher Lows (HL), Lower Highs (LH), and Lower Lows (LL) on the PIP chart to educate users on the current trend structure.
4.  **Overlay Mode (Toggle)**:
    - Add a feature to overlay the simplified PIP line directly on the main K-line chart to allow for "Price vs Structure" comparison in the same view.

## Goals
- Provide a clearer visual explanation of AI-detected patterns.
- Ensure 1:1 time-axis synchronization between charts.
- Improve the aesthetic and professional feel of the TACTICAL panel.

## Non-Goals
- Changing the underlying PIP algorithm (focus is on visualization).
- Adding new technical indicators unrelated to PIP/Price Action.
