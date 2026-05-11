## Requirements

### Requirement: Accurate Validation Label
The system SHALL NOT display "Sync Error" for price verification failures.
- If Yahoo Finance is unreachable, the label SHALL display `Verify Error` or `Unverified`.
- The icon for verification failure SHALL be `exclamation-circle` or similar.

### Requirement: Real Chart Sync Status
The system SHOULD display a `Sync Error` ONLY when the main chart and tactical chart time-scales are NOT aligned.

#### Scenario: Verify failure vs Sync failure
- **GIVEN** a search for a ticker
- **WHEN** Yahoo Finance returns 404 or 429
- **THEN** the badge shows `Verify Error` in orange/gray.
- **WHEN** the user manually scrolls the tactical chart and breaks the sync
- **THEN** the badge shows `Sync Error` in red.
