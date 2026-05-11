## Context

The PIP (Perceptually Important Points) markers on the charts currently do not clear their label text properly when the crosshair moves off them, creating visual clutter. Furthermore, the user expects the tactical chart's yellow line to display PIPs derived from standardized stock data, rather than raw price values.

## Goals / Non-Goals

**Goals:**
- Implement a robust hover clearance mechanism for PIP markers in both `renderTradingViewChart` and `renderTacticalChart`.
- Ensure that the tactical PIP line calculation uses standardized values instead of stock prices, matching the standardized coordinate system.
- Add visual reference lines (horizontal PriceLines or series) to the TACTICAL chart for pattern projection targets (1x and 2x amplitude).

**Non-Goals:**
- Refactoring the entire `strategyEngine.js` beyond what is needed for the tactical chart data formatting.
- Altering the appearance of PIP markers outside of the hover logic.

## Decisions

- **Marker Clearance Logic**: In the `subscribeCrosshairMove` listener of the lightweight charts, we will ensure that `mainPipMarkers` and `tacticalPipMarkers` explicitly set the `text` attribute to `""` for all markers when the cursor is off a PIP point.
- **Tactical Data Source**: In `renderTacticalChart`, `findPIPs(candles)` generates points. We will map these points strictly to their standardized representations (`p.stdY`) for the `pipLineSeries`. We will ensure the PIP extraction in `findPIPs` operates on standardized data directly if it doesn't already, so the patterns and the line reflect the standardized shape exactly.
- **Target Projections**: We will calculate the amplitude of the latest recognized pattern. Using this amplitude, we will add horizontal target lines (1x and 2x up/down) to the tactical chart using `createPriceLine` on the `pipLineSeries` or a dedicated series. We will also update the tactical chart's HTML legend overlay to display the pattern name and bullish/bearish probability.

## Risks / Trade-offs

- **Risk: Chart Performance**: Setting markers on every mouse move can cause slight performance overhead.
  - Mitigation: Only update markers if the hover state actually changes (e.g., storing the last hovered timestamp and checking if it differs).
