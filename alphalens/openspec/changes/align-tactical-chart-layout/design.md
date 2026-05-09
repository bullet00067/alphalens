# Design: Align Tactical Chart Layout

Technical plan for ensuring vertical alignment between the main chart and the tactical chart by standardizing the right price scale width.

## Implementation Details

### 1. Price Scale Optimization
The primary mechanism for alignment in Lightweight Charts is ensuring that the price scales on the right have the same width.
- **Minimum Width**: We will set `minimumWidth: 80` for the right price scale of both `currentStockChart` and `pipChartInstance`.
- **Reasoning**: 80px is sufficient to accommodate prices from 2 digits (e.g., $26.08) up to 5 digits (e.g., $15000.00) without the scale jumping or resizing dynamically.

### 2. Code Changes

#### app.js - Main Chart Initialization
Update `createChart` for the main chart to include `minimumWidth` in `rightPriceScale`.
```javascript
currentStockChart = createChart(chartContainer, {
    // ...
    rightPriceScale: { 
        borderColor: 'rgba(255,255,255,0.1)',
        minimumWidth: 80, // New property
    },
    // ...
});
```

#### app.js - Tactical Chart Initialization
Update `createChart` for the PIP chart in the tactical panel.
```javascript
pipChartInstance = createChart(pipContainer, {
    // ...
    rightPriceScale: { 
        borderVisible: false,
        minimumWidth: 80, // New property
    },
    // ...
});
```

### 3. CSS Audit
- Verify that `#stockChart` and `#pipChart` containers do not have conflicting padding or border-box settings that would offset the charts horizontally.

## Verification Plan
- **Visual Check**: Open any stock (TSLA, 2330.TW) and verify that the vertical grid lines of the main chart align perfectly with the tactical chart below it.
- **Resize Test**: Resize the window and ensure alignment is maintained.
- **Crosshair Test**: Move the crosshair and verify that the vertical line remains a single continuous line across both charts.
