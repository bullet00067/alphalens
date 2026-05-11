## Why

Currently, PIP markers on the main chart remain visible and clutter the UI even when the cursor is moved away from the PIP point. They need to automatically hide when not actively hovered. Additionally, the tactical chart's yellow line is plotting standard values directly, but it should represent PIP values calculated *after* the stock price has been standardized, making the tactical insights more accurate and aligned with the standardized coordinate space.

## What Changes

- Hide PIP label text (P: | V:) on the main and tactical charts when the cursor is not explicitly hovering over the PIP marker.
- Ensure the PIP extraction logic for the tactical chart calculates PIP points based on the standardized price data.
- Update the tactical chart's yellow line series to render these standardized PIPs properly.
- **Pattern Projections**: Add visual markers/lines on the TACTICAL chart to display the recognized pattern name, bullish/bearish probabilities, and project 1x and 2x upside/downside targets based on the pattern's amplitude.

## Capabilities

### Modified Capabilities
- `tactical-chart`: Changing the data source for the tactical PIP line chart, fixing marker hover visibility, and introducing visual pattern target projections (1x/2x amplitude).

## Impact

- `app.js`: Marker hover logic and tactical chart data assignment.
- `strategyEngine.js`: Potential adjustments to `findPIPs` to ensure standardization occurs before PIP calculation.
