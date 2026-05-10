# Design: TACTICAL Chart Fixes and Pattern Visualization

## 1. Tactical Chart Visibility Fix
- **Issue**: TACTICAL chart disappears after certain interactions.
- **Root Cause Analysis**:
    - Check if `pipContainer` (ID: `pipChart`) is hidden by CSS or if its height/width becomes 0.
    - Verify `renderTacticalChart` is called whenever data is updated and `isPipTacticalEnabled` is true.
    - Ensure `pipContainer.innerHTML = ""` or `pipChartInstance.remove()` doesn't accidentally prevent re-initialization.
- **Proposed Fix**: 
    - Explicitly set `pipContainer.style.display = 'block'` in `togglePipTactical`.
    - Add error handling and logging in `renderTacticalChart` to capture why initialization might fail.

## 2. Geometric Pattern Visualization
- **Auxiliary Lines**:
    - Update `renderPatternGeometry` to support all triangle variants (Ascending, Descending, Symmetrical) and Rectangles.
    - Use two `LineSeries` (upper/lower) to draw trendlines and support/resistance levels.
    - Lines should extend to the current candle index to show "projections."
- **Labeling**:
    - Refine `renderPatternLabels` to add "RESISTANCE," "SUPPORT," and "BREAKOUT" text markers at appropriate PIP nodes.
    - Ensure labels use high-contrast colors matching the pattern type.

## 3. Tooltip Persistence Overhaul
- **Issue**: PIP value labels remain on chart after mouse exit.
- **Proposed Fix**:
    - Optimize the `subscribeCrosshairMove` handler.
    - Implement a "Cleanup" function that is called both on `!param.time` AND when `hoveredMarker` is null.
    - Use a more efficient way to clear text (avoiding deep clone if possible, or using a cached "base" marker set).
    - Add a global mouseout event listener to the chart container as a fallback to force cleanup.

## 4. Market Structure Labels (HH/HL/LH/LL)
- Fix the logic error in `renderStructureLabels` where `curr` and `prev` are undefined.
- Ensure markers are updated only when market structure changes to avoid flickering.
