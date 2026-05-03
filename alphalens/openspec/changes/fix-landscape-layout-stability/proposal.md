# [PROPOSAL] Landscape Layout Stability & Sidebar Optimization

## Goal
Fix UI issues when the mobile device is rotated to landscape orientation:
1. Prevent the wide sidebar from consuming too much horizontal space.
2. Resolve overlapping/crowded elements in the navigation and top bar.
3. Improve content visibility in low-height environments.

## User Review Required
> [!IMPORTANT]
> In landscape mode on mobile, the sidebar will be automatically minimized to a "slim" version (icons only) to maximize content area. The user can still see labels by hovering or expanding, but the default will be narrow.

## Proposed Changes
### 1. Landscape Media Queries (styles.css)
- Implement `@media (orientation: landscape) and (max-height: 500px)` rules.
- **Slim Sidebar**: Reduce `.sidebar` width to 70px.
- **Hide Text Labels**: Set `.sidebar .nav-links li span` and `.sidebar .logo span` to `display: none` in this mode.
- **Top Bar Padding**: Reduce vertical padding to save space.

### 2. Viewport & Scrolling
- Ensure `.main-content` correctly calculates its height with the adjusted top bar.
- Fix any `100vh` issues that don't account for mobile browser address bars (using `svh` if compatible or careful percentage heights).

## Verification Plan
### QA Audit
- Use browser tool to rotate the viewport to 844x390 (iPhone landscape).
- Verify the sidebar is slim and the news list/portfolio cards are clearly visible.
- Ensure clicking nav items still works correctly.
