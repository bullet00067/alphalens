## Context

The AlphaLens TACTICAL chart provides a normalized view of stock price movements using PIP (Perceptual Identification Point) logic. Currently, while the data is standardized (Z-score), the Y-axis and tooltips still display currency-style labels, which is inaccurate for normalized data ranges (typically -3.0 to +3.0).

## Goals / Non-Goals

**Goals:**
- Update the TACTICAL chart's vertical scale to correctly represent standardized units.
- Refactor the crosshair tooltip logic in `app.js` to distinguish between the main chart (price) and tactical chart (standardized value).
- Improve visual clarity for technical analysis by labeling the units as "Std Dev" or "Normalized".

**Non-Goals:**
- Changing the underlying PIP calculation algorithm.
- Modifying the main chart's Y-axis (which should remain as price).

## Decisions

- **Custom Price Formatter**: We will use the `priceFormat` options in `lightweight-charts` to set `type: 'custom'` or simply use a generic decimal format for the tactical chart. This avoids the "$" prefix.
- **Pattern Geometry Drawing**: We will use the `patternOverlaySeries` to draw trend lines (upper and lower bounds) that define the current geometric pattern (e.g., channels, triangles). These lines must use the same standardized Y-scale as the PIP data.
- **Probability Indicator UI**: We will enhance the `patternLabel` HTML to include progress bars or color-coded indicators for Bullish vs Bearish probability.
- **Tooltip Localization**: In the `subscribeCrosshairMove` listener for `pipChartInstance`, we will modify the label string template.

## Risks / Trade-offs

- **[Risk] Confusion with Main Chart** → **[Mitigation]** Clearly distinguish the charts with different background colors or explicit legend labels in the UI.
- **[Trade-off] Loss of Absolute Price Context** → **[Mitigation]** The main chart remains visible above the tactical chart, providing the absolute price reference.
