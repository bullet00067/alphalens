# [DESIGN] Portfolio Header Ghosting & Label Restoration

## Technical Root Cause Analysis
1. **Ghost Header**: The CSS rule `.table-container tr` targeted ALL rows, including those in `thead`. Since `thead` was set to `display: none !important`, the browser might still be rendering the elements if the `display: grid` on `tr` is overriding it in some contexts, or more likely, the `thead` container itself was hidden but its children were styled as cards.
2. **Missing Labels**: The labels are powered by `td:before { content: attr(data-label) }`. In the screenshot, the `td` padding or flex layout might be obscuring these labels.

## Refined Design
### 1. Specific Targetting
We will target only `tbody tr` for the card layout to prevent the header from becoming a "card".
```css
.table-container tbody tr {
    display: grid !important;
    /* ... card styles ... */
}
.table-container thead {
    display: none !important;
}
```

### 2. Label Visibility
We will ensure `td:before` has a clear color and font size.
```css
.table-container td:before {
    content: attr(data-label);
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 500;
    margin-bottom: 2px;
}
```

### 3. Card Internal Grid
We will use a more robust grid:
- `Price` and `Avg Cost` on the same row.
- `Qty` on its own row or paired.
- `P/L` (The Pill) highlighted.
- `Signal` and `Action` (Delete) aligned at the bottom.

## UI Sketch (Mobile)
```
[ 2330 台積電 ]
----------------
Price: $2135   Avg Cost: $1804
Qty: 20
[ P/L Pill: +$6620 (18%) ]
Signal: 🔴 賣出 [Trash Icon]
```
