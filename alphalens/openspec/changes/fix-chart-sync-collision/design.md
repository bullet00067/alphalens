# Design: Fix Chart Sync Collision

## Synchronization Guard Logic

To prevent infinite loops, we implement a helper:
```javascript
function areRangesEqual(r1, r2) {
    if (!r1 || !r2) return false;
    return Math.abs(r1.from - r2.from) < 0.1 && Math.abs(r1.to - r2.to) < 0.1;
}
```
In the listeners:
```javascript
chartA.timeScale().subscribeVisibleLogicalRangeChange(range => {
    const currentB = chartB.timeScale().getVisibleLogicalRange();
    if (!areRangesEqual(range, currentB)) {
        chartB.timeScale().setVisibleLogicalRange(range);
    }
});
```

## Correcting `renderTradingViewChart`

- **Remove**: `patternUpperSeries = null;`, `patternLowerSeries = null;`
- **Add**: Proper `currentStockChart.remove()` check.
- **Guard**: `if (!candlestickSeries) return;` in any async marker update.

## Execution Order in `togglePipTactical`

1.  Set `isPipTacticalEnabled`.
2.  Setup the Tactical Chart container/instance.
3.  Assign `pipChartInstance` and all series.
4.  ONLY THEN call `renderTradingViewChart` or establish sync.
