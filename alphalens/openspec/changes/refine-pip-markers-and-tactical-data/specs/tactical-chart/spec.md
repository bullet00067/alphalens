## ADDED Requirements

### Requirement: PIP Hover Clearance
The system SHALL hide the PIP text label when the chart crosshair moves away from the PIP point.

#### Scenario: Hovering and leaving a PIP
- **WHEN** the user hovers over a PIP point on the main or tactical chart
- **THEN** the label text (e.g., `P: $... | V: ...` or `Val: ...`) is displayed for that specific PIP.
- **WHEN** the user moves the crosshair to a data point without a PIP
- **THEN** all PIP labels SHALL hide their text, returning to standard marker display.

### Requirement: Standardized Tactical Data Rendering
The tactical chart's PIP line SHALL connect PIP values derived from standardized stock prices, rather than raw price or volume.

#### Scenario: Tactical line visualization
- **WHEN** the tactical chart is rendered
- **THEN** the yellow `pipLineSeries` renders points mapped to the `stdY` (standardized Y value) representing the Z-Score of the logarithmic stock price.

### Requirement: Pattern Projections and Probability Overlay
The tactical chart SHALL visually indicate the currently recognized pattern, its directional probabilities, and 1x/2x amplitude projections.

#### Scenario: Tactical chart renders a recognized pattern
- **WHEN** the strategy engine identifies a pattern from the PIPs
- **THEN** the tactical chart overlay displays the pattern name and the calculated bullish/bearish probability.
- **THEN** the chart plots horizontal price lines or markers indicating the 1x and 2x upside and downside targets based on the pattern's amplitude.
