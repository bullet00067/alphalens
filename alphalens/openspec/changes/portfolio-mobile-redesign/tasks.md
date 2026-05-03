# [TASKS] Portfolio Mobile UI Redesign

## UI Structure
- [ ] Update `renderPortfolio` function in `app.js` to include semantic data attributes for easier CSS targeting <!-- id: 0 -->
- [ ] Add a "Mobile-Only" header/footer wrapper within the table rows if needed <!-- id: 1 -->

## CSS Implementation
- [ ] Implement "Table-to-Card" CSS transformation for `.portfolio-grid` on screens < 768px <!-- id: 2 -->
- [ ] Design the `portfolio-card` styles (Glassmorphism, P/L coloring, layout) <!-- id: 3 -->
- [ ] Optimize the Portfolio Summary cards for vertical stacking on mobile <!-- id: 4 -->
- [ ] Add a "Collapse/Expand" toggle for the "Add New Holding" form to save space <!-- id: 5 -->

## Logic & Polish
- [ ] Ensure `evaluatePortfolioSignal` correctly updates the signal in card view <!-- id: 6 -->
- [ ] Fix touch event propagation for the delete button inside cards <!-- id: 7 -->

## Verification
- [ ] Test mobile card layout on various viewport widths <!-- id: 8 -->
- [ ] Verify desktop table view is unchanged <!-- id: 9 -->
