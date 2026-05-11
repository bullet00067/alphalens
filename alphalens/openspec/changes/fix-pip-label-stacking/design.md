## Goals

- Eliminate PIP label stacking/leakage.
- Ensure only the hovered PIP marker shows a label.
- Align with the official `lightweight-charts` API.

## Proposed Changes

### 1. Refactor Marker Calls
Replace the following pattern:
```js
createSeriesMarkers(series, markers);
```
with:
```js
series.setMarkers(markers);
```

### 2. Update `app.js` Imports
Remove `createSeriesMarkers` from line 1.

### 3. Hover Logic Refinement
Verify `mainHoverState` resets and correctly triggers `setMarkers([])` or `setMarkers(markersWithEmptyText)` on mouseleave.

## Risks

- If `createSeriesMarkers` was doing something special (like custom SVG rendering not supported by `setMarkers`), those features might be lost. However, the screenshot shows standard labels, so `setMarkers` should be sufficient.
