# [PROPOSAL] Enforce Unified Mobile Breakpoint (1024px) for Consistent UI

## Goal
Enforce a consistent mobile experience across all mobile orientations (including landscape) by raising the mobile breakpoint from 768px to 1024px.

## User Review Required
> [!IMPORTANT]
> The sidebar will now be hidden by default on all devices narrower than 1024px (this includes all phones in landscape mode). You will always use the hamburger menu to navigate on these devices.

## Proposed Changes
### 1. Breakpoint Alignment (styles.css)
- Find all instances of `@media (max-width: 768px)` and update them to `@media (max-width: 1024px)`.
- This ensures that landscape phones (844px - 932px) are correctly identified as mobile devices.
- Consolidate redundant mobile queries into a single, clean block.

### 2. Sidebar Hardening
- Ensure `.sidebar` is `position: fixed` and `left: -280px` for all viewports under 1024px.
- Ensure `.main-content` has `margin-left: 0` for these viewports.

## Verification Plan (QA Agent)
- Test on 844x390 (Landscape iPhone).
- **Checklist**:
    1. Sidebar is HIDDEN on load.
    2. Hamburger menu is VISIBLE.
    3. Clicking hamburger shows sidebar drawer.
    4. UX is identical to portrait mode.
