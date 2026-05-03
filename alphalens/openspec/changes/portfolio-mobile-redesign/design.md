# [DESIGN] Portfolio Mobile UI Redesign

## UI Specification
### 1. The "Mobile Card" Structure
Each item in the portfolio will be rendered within a `div.portfolio-card` instead of a `tr` on mobile.

```html
<div class="portfolio-card">
  <div class="card-header">
    <span class="ticker">AAPL</span>
    <span class="price">$189.12</span>
  </div>
  <div class="card-body">
    <div class="pl-indicator positive">+$1,200 (4.5%)</div>
    <div class="signal-badge">🟢 BUY</div>
  </div>
  <div class="card-footer">
    <span>Qty: 10</span>
    <span>Avg: $175.00</span>
  </div>
  <button class="card-delete"><i class="fa-solid fa-xmark"></i></button>
</div>
```

### 2. CSS Media Query Strategy
- Use `@media (max-width: 768px)` to hide the `thead` and change `tbody` and `tr` to `display: block` or `display: grid`.
- Alternatively, render a separate hidden container for cards and toggle visibility. (Preferred for performance: using CSS to restyle existing table elements into cards).

### 3. CSS Classes
- `.table-container`: On mobile, remove background and padding to let cards float.
- `.portfolio-card`: 
    - `background: var(--bg-secondary)` with glassmorphism.
    - `margin-bottom: 12px`.
    - `border-radius: 12px`.
    - `padding: 16px`.

### 4. JavaScript Updates
- Update `renderPortfolio()` in `app.js` to ensure the HTML structure is flexible enough to be styled as either a row or a card.
- Ensure click-to-load-detail still works on the entire card area.

## Technical Considerations
- **Dynamic Signals**: Ensure the `evaluatePortfolioSignal` can target the card's signal badge.
- **Empty States**: Centralize the "No holdings" message to look good in both views.
