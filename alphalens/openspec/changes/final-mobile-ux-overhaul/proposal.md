# [PROPOSAL] Final Mobile UX Overhaul & Layout Fix

## Goal
Address the three critical mobile UX issues:
1. Fix horizontal overflow that causes "shifting boundaries" and cut-off text.
2. Redesign the Portfolio card layout to eliminate inner scrollbars and improve info focus.
3. Ensure absolute stability of the mobile viewport.

## User Review Required
> [!IMPORTANT]
> This change involves significant restructuring of the CSS layout for mobile. Some elements might be rearranged to ensure they fit within 375px without horizontal scrolling.

## Proposed Changes
### 1. Global Viewport Stability (styles.css)
- Add `overflow-x: hidden` to `body` and `.app-container`.
- Identify and fix specific elements (like large paddings or fixed width containers) that exceed 100vw.
- Ensure the sidebar doesn't push the content in a way that breaks the layout.

### 2. Portfolio Card Reconstruction (styles.css)
- **Eliminate Inner Scroll**: Set `overflow: visible` or `overflow: hidden` (no scroll) on `tr` and `td`.
- **Vertical Stacking**: Instead of a 2-column grid that might be too tight, use a clear vertical or "labeled value" layout that fits perfectly.
- **Header Removal**: Re-verify and ensure the "ghost header" is 100% gone.

### 3. Data Labels (app.js)
- Ensure all numbers have their corresponding labels rendered via `data-label`.

## Verification Plan
### QA Agent Acceptance Criteria
1. **No Horizontal Scroll**: Swipe left/right on mobile should NOT move the page content.
2. **No Inner Scrollbars**: Portfolio cards must display all information without internal scrolling.
3. **No Cut-off Text**: All stock names and prices must be fully visible.
