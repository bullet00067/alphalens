# Design: Refactor Chart Initialization

## New Function: `renderTacticalChart(candles)`

```javascript
function renderTacticalChart(candles) {
    if (!isPipTacticalEnabled || !candles || candles.length === 0) {
        if (pipChartInstance) {
            pipChartInstance.remove();
            pipChartInstance = null;
        }
        return;
    }

    // 1. Initialize Container/Chart if needed
    // 2. Setup Series (PIP, Pattern, Structure, Ghost)
    // 3. Set Data
    // 4. Setup Bidirectional Sync with currentStockChart
    // 5. Update Pattern Labels and Probability UI
}
```

## Updated `togglePipTactical()`

```javascript
function togglePipTactical() {
    isPipTacticalEnabled = !isPipTacticalEnabled;
    const btn = document.querySelector('[data-type="pip-tactical"]');
    const container = document.getElementById('pipChart');
    
    if (isPipTacticalEnabled) {
        btn.classList.add('active');
        container.style.display = 'block';
        renderTacticalChart(currentChartData);
    } else {
        btn.classList.remove('active');
        container.style.display = 'none';
        if (pipChartInstance) {
            pipChartInstance.remove();
            pipChartInstance = null;
        }
    }
}
```

## Updated `loadChartData()`

```javascript
async function loadChartData(ticker, tf) {
    // ... fetch ...
    renderTradingViewChart(candles);
    renderTacticalChart(candles);
    updateAISignals(ticker, candles);
}
```
