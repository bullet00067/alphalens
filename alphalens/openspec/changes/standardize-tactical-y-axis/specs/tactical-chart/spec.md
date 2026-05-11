## ADDED Requirements

### Requirement: Standardized Vertical Axis
The TACTICAL chart SHALL display standardized units (Z-score) on its vertical price scale to accurately represent the normalized data distribution.

#### Scenario: Displaying Standardized Values
- **WHEN** the tactical chart is rendered
- **THEN** the Y-axis labels SHALL show numeric values (e.g., -2.0, 0, 2.0) without currency symbols.

### Requirement: Standardized Tooltip Labels
The TACTICAL chart tooltips SHALL use standardized value labels instead of price labels to maintain context with the normalized data.

#### Scenario: Hovering over a PIP point in Tactical Chart
- **WHEN** the user hovers over a marker in the TACTICAL chart
- **THEN** the tooltip text SHALL be formatted as `Value: <normalized_value>` instead of `P: $<price>`.

### Requirement: Geometric Pattern Visualization
The TACTICAL chart SHALL display geometric trend lines (resistance and support) that visually define the identified pattern.

#### Scenario: Visualizing a Triangle Pattern
- **WHEN** a triangle pattern is identified
- **THEN** the TACTICAL chart SHALL draw two converging trend lines based on the local peaks and troughs in standardized units.

### Requirement: Probability Indicator Display
The TACTICAL chart UI SHALL prominently display the Bullish and Bearish probability percentages for the identified pattern.

#### Scenario: Displaying Success Probabilities
- **WHEN** a pattern is identified
- **THEN** the pattern label SHALL include the name of the pattern and its Bullish vs Bearish probability (e.g., "Triangle: Bullish 65% / Bearish 35%").

### Requirement: Synchronization with Price Context
The TACTICAL chart SHALL maintain its horizontal time-axis synchronization with the main price chart even while using a different vertical scale.

#### Scenario: Zooming/Panning charts
- **WHEN** the user zooms or pans either the main chart or the tactical chart
- **THEN** both charts SHALL update their visible time range in sync.
