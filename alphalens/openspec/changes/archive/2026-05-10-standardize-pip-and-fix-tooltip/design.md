# Technical Design: Standardize PIP and Fix Tooltip

## Component: Frontend UI (app.js)

### Tooltip Persistence Fix
- **Logic**: The `crosshair` event listener currently updates a custom HTML element for PIP values. We need to explicitly clear/hide this element when the `param.point` is undefined or when the crosshair is not hovering over a series point.
- **Implementation**:
    - Update the `updatePipTooltip` logic (or equivalent in the crosshair handler).
    - If `param.point` is null or the distance to the nearest PIP point is too large, set `display: none` on the tooltip element.

## Component: Strategy Engine (strategyEngine.js)

### PIP Data Standardization (Log Scale)
- **Goal**: Make PIP detection scale-invariant.
- **Approach**:
    1. Inside `findPIPs`, create a temporary array of prices where each value `y` is transformed to `log10(y)`.
    2. Run the existing PIP distance calculation on this logarithmic array.
    3. The indices of the selected PIPs will remain the same.
    4. Return the original prices at those indices for rendering.
- **Rationale**: 
    - A move from 10 to 11 (10%) and 100 to 110 (10%) will result in the same "distance" in log space: `log10(11) - log10(10) ≈ 0.041` vs `log10(110) - log10(100) ≈ 0.041`.
    - This treats percentage moves equally regardless of absolute price level.

## Verification Plan
- **Manual Test**: 
    - Verify tooltip disappears on cursor exit.
    - Compare PIP markers on MXL (high growth) before and after log transformation to ensure historical low-price points are correctly identified as significant.
