# Design: Enhanced Tactical PIP Chart Visualization

This document outlines the technical implementation for synchronizing the PIP chart with the main K-line chart and adding visual pattern overlays.

## Component Architecture

### 1. Synchronization Service
- **Logic**: Use `subscribeVisibleLogicalRangeChange` on `currentStockChart`.
- **Implementation**: When the range changes on the main chart, update `pipChartInstance.timeScale().setVisibleLogicalRange(range)`.
- **Bidirectional**: Also implement the reverse (scrolling PIP chart scrolls main chart) if `timeScale` is enabled for the PIP chart.

### 2. Pattern Overlay Layer
- **New Series Types**:
  - `patternOverlaySeries`: A `LineSeries` (or multiple) used to draw the legs of identified patterns.
  - `structureLabelSeries`: A `LineSeries` with `crosshairMarkerVisible: false` used to place markers (HH, HL, etc.).
- **Drawing Logic**:
  - `drawTriangle(p1, p2, t1, t2)`: Creates two line segments connecting the peaks and troughs.
  - `drawDoublePattern(points)`: Creates a multi-segment line showing the M or W shape.
- **Styling**:
  - Bullish patterns: `#22c55e` (Green) with 0.4 opacity.
  - Bearish patterns: `#ef4444` (Red) with 0.4 opacity.

### 3. Integrated Overlay Mode
- **Feature**: Toggle the simplified PIP line directly onto the main chart.
- **Implementation**: 
  - Add `mainPipSeries` to `currentStockChart`.
  - When enabled, calculate PIPs and set data to this series.
  - Use a distinct color (e.g., bright yellow `#facc15`) to contrast with candles.

## UI/UX Changes

### Chart Layout
- **Time Scale**: Re-enable a minimal time scale for the PIP chart to provide spatial reference.
- **Crosshair Sync**: Ensure the crosshair moves on both charts simultaneously.

### Toolbar Additions
- **"PIP Overlay" Button**: A new toggle in the chart toolbar to show/hide the PIP line on the main chart.
- **Legend Integration**: Update the chart legend to show pattern names and structure status.

## Data Flow

1.  `app.js` fetches candle data.
2.  `strategyEngine.js` processes candles into `PIPs` and identifies `Patterns`.
3.  `app.js` updates:
    - Main Chart (Candles, Indicators).
    - PIP Chart (Simplified Line).
    - **NEW**: Pattern Overlay Series (Geometric shapes).
    - **NEW**: Structure Markers (HH/HL labels).
