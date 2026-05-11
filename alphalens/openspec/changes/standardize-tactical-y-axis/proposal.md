## Why

Standardizing data (e.g., using Z-scores) before performing PIP filtering shifts the data from its original price scale to a normalized scale. Maintaining the original price units on the TACTICAL chart's vertical axis creates a misleading visualization and analytical errors, as the displayed values no longer correspond to actual stock prices.

## What Changes

- **Y-Axis Unit Standardization**: Change the TACTICAL chart's vertical axis to display standardized units (e.g., Standard Deviations or Z-Score) instead of currency values.
- **Pattern Visualization (Geometric Guidelines)**: Draw clear helper lines (resistance/support) directly on the TACTICAL chart based on identified geometric patterns.
- **Probability Display**: Show explicit Bullish and Bearish probability percentages prominently within the tactical chart UI.
- **Tooltip Refinement**: Update crosshair tooltips on the tactical chart to show standardized values with appropriate precision.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `tactical-chart`: Update the vertical scaling and labeling requirements to support standardized units instead of absolute price.

## Impact

- **app.js**: Modify `renderTacticalChart` logic for scale formatting and marker text.
- **strategyEngine.js**: Ensure the standardized values used for PIP calculation are passed correctly to the rendering layer.
