# Design: PIP Strategy Integration

## System Components

### 1. Data Model
- **ObservationList**: Tickers identified during "Post-close Screening" with `triggerPrice`, `targetVolume`, and `strategyType`.
- **SignalState**: Current state of a ticker (e.g., `BULLISH_TREND`, `CONSOLIDATING`, `SIGNAL_PENDING`).

### 2. Signal Engine Logic
```javascript
// Pseudo-code for Trend Detection
function analyzeTrend(data60) {
  const pips = findPIPs(data60, 6); // Extract 4-6 key points
  const peaks = getPeaks(pips);
  const troughs = getTroughs(pips);
  
  if (troughs[1] > troughs[0] && peaks[1] > peaks[0]) {
    return 'BULLISH';
  }
  
  // Consolidation Check: Peak variance < 2% and price inside PIP range
  const peakVariance = calculateVariance(peaks);
  if (peakVariance < 0.02) {
    return 'CONSOLIDATING';
  }
}
```

### 3. Pre-close Engine
- Activated via `setInterval` checking local time.
- During 13:00 - 13:25:
  1. Fetch real-time `Ticks` or `60m` data.
  2. Verify if `price > triggerPrice` and `estVolume > targetVolume`.
  3. Call `verifyWithYahoo(ticker, price)`.
  4. If verified, fire notification and update UI.

### 4. Yahoo Finance Verification
- Implementation: Use a simple proxy or a specific endpoint if available. For AlphaLens, we might use a fallback crawler logic or an open API that mirrors Yahoo Finance data.

## UI Components
- **SignalBadge**: A colorful badge (Entry/Add/Reduce/Exit) in the Portfolio table.
- **ActionBanner**: A high-priority notification banner appearing in the Dashboard between 13:00-13:25.
- **PIPAnnotation**: Drawing horizontal lines on the `lightweight-charts` for Necklines and PIP-trough support.

## Security & Reliability
- **Real-time Constraint**: Mandatory 13:00-13:25 window ensures decisions are made before market close.
- **Stop Loss Buffer**: Initial Stop Loss is set at `Min(EntryCandle.Low, PrevPIPTrough)`. For high-volatility stocks, apply a 0.5 * ATR(14) buffer below this price.
- **Validation**: Signals are marked "Unverified" if Yahoo Finance check fails.
