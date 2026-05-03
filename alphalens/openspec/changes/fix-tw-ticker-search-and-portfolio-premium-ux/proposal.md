# [PROPOSAL] TW Ticker Detection Fix & Portfolio Premium UX

## Goal
1. Fix the bug where Taiwan stock names (Chinese characters) are misidentified as US stocks.
2. Elevate the Portfolio mobile UI from "functional" to "premium" by optimizing information density and visual hierarchy.

## User Review Required
> [!IMPORTANT]
> The stock search logic will now attempt to match Taiwan stock names. The Portfolio cards will be completely restyled to a modern "Quick Glance" layout.

## Proposed Changes
### 1. Logic Fixes (app.js)
- **Enhanced Ticker Detection**: Update `isTaiwanStock` to detect Chinese characters or provide a mapping lookup for popular TW stocks.
- **Robust Math**: Fix `NaN` displays by adding null-checks and default values to portfolio calculations.
- **Auto-Correction**: If a user enters a TW name, automatically resolve it to its 4-digit ticker before saving to Firestore.

### 2. UI/UX Refinement (styles.css)
- **Compact Portfolio Cards**:
    - Use a 2-column grid inside cards for secondary metrics.
    - Status pills for P/L (Green/Red backgrounds with white text).
    - Modern Iconography for "Avg Cost", "Qty", and "Signal".
- **Dynamic Headers**: Improve the spacing and typography of the "My Portfolio" title and summary cards on mobile.
- **Empty States**: Professional looking "Empty Portfolio" placeholder.

## Verification Plan
### Automated Tests
- Test adding "群聯" and verify it resolves to "8299".
- Verify P/L calculations don't produce `NaN` even with missing quotes.
### Manual Verification
- Visual inspection on mobile device (iPhone/Android) for the new card density.
