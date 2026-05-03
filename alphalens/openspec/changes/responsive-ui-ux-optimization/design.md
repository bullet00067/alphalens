# [DESIGN] Responsive UI/UX Optimization

## Overview
The optimization focuses on transforming the static, desktop-oriented layout into a fluid, multi-device dashboard.

## Technical Strategy
### 1. Breakpoints
- **Mobile**: `< 768px`
- **Tablet**: `768px - 1024px`
- **Desktop**: `> 1024px`

### 2. Layout Changes
- **Mobile Header**: Add a `burger-menu` button to the `top-bar` (visible only on mobile).
- **Sidebar**:
    - Mobile: `position: fixed`, `left: -250px`, transitions to `left: 0` when active. Overlay needed.
    - Tablet: `width: 70px`, icons only, labels hidden.
    - Desktop: `width: 250px`, as is.
- **Top Bar**:
    - Mobile: Stack items or reduce padding. `search-container` width `100%`.
- **Main Content**: Adjust padding from `40px` to `20px` (mobile) and `30px` (tablet).

### 3. CSS Refinement
- Convert fixed `px` widths to `rem` or `%` where applicable.
- Use `clamp()` for fluid typography (e.g., `font-size: clamp(1rem, 2.5vw, 1.25rem)`).
- Update `.indices-grid` to use `repeat(auto-fill, minmax(160px, 1fr))`.
- Update `.dashboard-grid` to `grid-template-columns: 1fr` on mobile.

### 4. Interaction Logic
- New `toggleSidebar()` function in `app.js` to manage the mobile menu state.
- Event listeners for the burger menu and background overlay.

## User Interface Changes
### [NEW] Mobile Navigation
- Icon: `fa-bars`
- Behavior: Slides out from the left.

### [MODIFY] Charts
- Height will be set to `50vh` or `400px` on mobile to ensure the page remains scrollable.
