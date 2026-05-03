# [DESIGN] Mobile Consistency: Hidden Sidebar

## Architectural Shift
We are moving from an "Adaptive Sidebar" (Slim in landscape) to a "Consolidated Mobile Sidebar" (Hidden in all mobile states).

1. **The Mobile Breakpoint**:
   - Instead of separate rules for portrait and landscape height, we will group everything under `max-width: 992px` (covering all mobile/tablet orientations).
   - In this range, the sidebar is ALWAYS `position: fixed`.

2. **Transition Logic**:
   - `left: -280px` (Default)
   - `left: 0` (When `.sidebar.active` is toggled)
   - `.main-content` will have `margin-left: 0` in all mobile states to fill the screen.

3. **Z-Index Management**:
   - Sidebar must be above the `.top-bar` and content (Z-index 100+).
   - Overlay must be present to prevent interaction with the background when the menu is open.

4. **Visual Polish**:
   - Since the sidebar is now a full drawer again, we can restore the font size and labels, making it readable and familiar.
