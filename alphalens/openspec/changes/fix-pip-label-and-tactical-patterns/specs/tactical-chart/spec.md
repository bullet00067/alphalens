## ADDED Requirements

### Requirement: PIP hover label isolation
The system SHALL display label text ONLY on the PIP marker currently under the crosshair. All other PIP markers SHALL show empty text at all times, including while another marker is hovered.

#### Scenario: Hover one marker, others hide
- **WHEN** the crosshair moves onto a PIP marker at time T
- **THEN** that marker shows `P: $xxx.xx | V: xx.xM` and every other marker in `mainPipMarkers` has `text: ""`

#### Scenario: Hover clears on refresh
- **WHEN** `refreshPipAnalysis` rebuilds `mainPipMarkers`
- **THEN** `mainHoverState.time` is reset so the next crosshair event re-applies label text correctly

### Requirement: Tactical stdY computed inline
The tactical `pipLineSeries` SHALL plot PIP values using Z-Score standardization computed from the candle set passed to `renderTacticalChart`.

#### Scenario: PIP line has valid data
- **WHEN** `renderTacticalChart` is called with a candle array
- **THEN** each PIP point has `stdY = (log10(close) - mean) / std` where `mean` and `std` come from that candle set
- **THEN** `pipLineSeries.setData` receives objects with numeric `value` (not `undefined`)

#### Scenario: Standardization params stored
- **WHEN** `renderTacticalChart` computes `mean` and `std`
- **THEN** they are stored in module-level `tacticalStdMean` and `tacticalStdDev`
- **THEN** `refreshPipAnalysis` updates these when it recalculates the tactical panel

### Requirement: Tactical pattern detection uses visible window
The initial pattern detection in `renderTacticalChart` SHALL operate on the last 60 candles (matching `refreshPipAnalysis` visible-window behavior).

#### Scenario: Pattern found on initial render
- **WHEN** `renderTacticalChart` initializes
- **THEN** `generatePIPSignal` is called with `candles.slice(-60)` not the full history
- **THEN** if peaks/troughs form a recognizable shape, the pattern label overlay appears

### Requirement: Amplitude target labels show stock price
The 1x/2x amplitude projection line labels on the TACTICAL chart SHALL show the equivalent stock price, not σ units.

#### Scenario: Target labels display price
- **WHEN** a pattern is detected and `renderAmplitudeTargets` is called
- **THEN** `createPriceLine` `title` text shows `▲ 1x: $xxx.xx` (stock price)
- **THEN** the HTML overlay grid also shows stock price values
- **THEN** the line's `price` argument (position on Z-Score axis) remains in σ units
