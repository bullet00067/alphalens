# [DESIGN] TW Ticker Detection Fix & Portfolio Premium UX

## Technical Details

### 1. Ticker Detection Improvement
We will introduce a `resolveTicker(input)` function that:
- Checks if input contains Chinese characters using `/[ \u4e00-\u9fa5]/`.
- If Chinese, performs a lookup or warns the user to use numbers. (Ideally, we use the FinMind `TaiwanStockInfo` to find the ID).
- Updates `isTaiwanStock` to be more inclusive.

```javascript
function isTaiwanStock(ticker) {
    if (/[ \u4e00-\u9fa5]/.test(ticker)) return true; // Chinese names are TW
    return /^\d{4,6}$/.test(ticker) || ticker.endsWith('.TW') || ticker.endsWith('.TWO');
}
```

### 2. Portfolio Card "Premium" Layout
We will transition from a simple list to a "Grid Card" for mobile.

**New CSS Structure:**
- `.table-container tr` (Mobile):
    - `display: grid`
    - `grid-template-areas: "header header" "metrics pl" "footer footer"`
    - `padding: 16px`
- `.ticker-badge`: Larger, bold, with sub-text for the full name.
- `.pl-pill`: High-contrast badge (Green/Red) for the percentage.

### 3. Math Safety
Update `renderPortfolio` to:
```javascript
const pl = (currentPrice || 0) * (item.qty || 0) - (item.cost || 0) * (item.qty || 0);
const plPercent = (item.cost * item.qty) !== 0 ? (pl / (item.cost * item.qty)) * 100 : 0;
```

## UI Walkthrough
- User adds "群聯" -> System detects TW -> Fetches "8299" details -> Adds to Portfolio.
- On Mobile Portfolio: A clean card shows "8299 群聯" at the top, a Green/Red pill for % on the right, and small details at the bottom.
