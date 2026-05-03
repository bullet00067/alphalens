# [PROPOSAL] Mobile Consistency: Hidden Sidebar in Landscape Mode

## Goal
Switch the landscape layout from a "Slim Sidebar" to a "Hidden Sidebar" (Hamburger Menu) to provide a consistent mobile experience and maximize horizontal screen space.

## User Review Required
> [!IMPORTANT]
> The sidebar will now be hidden by default in BOTH portrait and landscape modes on mobile. You will use the hamburger menu at the top left to navigate. This provides 100% of the screen width for your stock charts and news.

## Proposed Changes
### 1. Landscape Sidebar Logic (styles.css)
- **Remove Slim Sidebar**: Delete the `@media (max-height: 500px)` rules that forced a 70px rail.
- **Unified Mobile Sidebar**: Apply the `position: fixed; left: -280px;` logic to all mobile viewports, including landscape.
- **Enable Hamburger**: Ensure `.menu-toggle` is visible in landscape mode.
- **Main Content Width**: Ensure `.main-content` takes 100% width regardless of orientation when the sidebar is retracted.

### 2. Navigation Consistency (index.html/app.js)
- Ensure the sidebar overlay (`.sidebar-overlay`) correctly covers the screen when the menu is opened in landscape.
- No changes needed to `app.js` as the existing `toggleSidebar` logic is orientation-agnostic.

## Verification Plan (QA Agent)
- Test on 844x390 (iPhone landscape).
- **Checklist**:
    1. Sidebar is NOT visible on page load.
    2. Hamburger icon is visible and clickable.
    3. Clicking hamburger slides out a FULL-WIDTH sidebar with labels.
    4. Clicking overlay or nav item hides the sidebar.
