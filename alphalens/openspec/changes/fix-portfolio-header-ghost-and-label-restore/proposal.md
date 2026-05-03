# [PROPOSAL] Portfolio Header Ghosting & Label Restoration

## Goal
Fix the UI regressions identified in the mobile view of the Portfolio page:
1. Remove the "ghost" header block appearing at the top of the holdings list.
2. Restore missing data labels (Price, Avg Cost, Qty) within the mobile cards.
3. Align the Signal and Delete actions properly.

## User Review Required
> [!IMPORTANT]
> This is a pure UI/CSS fix. No business logic is changed. The card layout will be slightly adjusted to accommodate labels while maintaining high density.

## Proposed Changes
### 1. CSS Fixes (styles.css)
- **Header Removal**: Explicitly target `thead` and any associated header styles within the portfolio grid on mobile to ensure zero visibility.
- **Label Injection**: Use CSS pseudo-elements (`:before`) properly to display the labels defined in `data-label` from `app.js`.
- **Card Layout Refinement**:
    - Ensure labels are visible and styled (smaller, secondary color).
    - Fix the alignment of the Action cell (trash icon) and Signal cell.
    - Add horizontal lines between cards if needed for better separation.

### 2. Semantic Polish (app.js)
- Verify `data-label` values in `renderPortfolio` match the intended display text.

## Verification Plan
### Automated Tests
- Browser subagent to capture a screenshot of the Portfolio with at least one holding, specifically checking for the absence of the ghost header and presence of labels.
### Manual Verification
- Verify on iPhone simulator that "Price" and "Avg Cost" are clearly labeled beside their values.
