# [PROPOSAL] Systematic Responsive UX Overhaul & CDP Verification

## Goal
Implement a rigid 1024px mobile UI standard and optimize landscape layout for iPhone 14 using CDP for binary verification (Portrait/Landscape).

## User Review Required
> [!IMPORTANT]
> The sidebar will be strictly hidden behind a hamburger menu for all viewports below 1024px.
> In landscape mode, Market Indices cards will be forced into a 3-column horizontal row to maximize screen real estate.

## Proposed Changes
### 1. Unified 1024px Enforcement (styles.css)
- Consolidate all mobile rules under `@media (max-width: 1024px)`.
- Ensure `.sidebar` is `position: fixed` and `left: -280px` by default.
- Ensure `.menu-toggle` (hamburger) is visible.

### 2. Landscape Layout Optimization (styles.css)
- Add `@media (max-width: 1024px) and (orientation: landscape)` specific overrides.
- **Indices Grid**: Force `grid-template-columns: repeat(3, 1fr)` for Market Indices.
- **Compact Spacing**: Reduce vertical margins for `.welcome-banner` and `.section-title` in landscape.

### 3. CDP Verification Phase (Browser Subagent)
- **Stage 1 (Pre-Verification)**: Capture screenshots of the current Portrait and Landscape states.
- **Stage 2 (Implementation)**: Apply code changes.
- **Stage 3 (Post-Verification)**: Capture screenshots of the new Portrait and Landscape states.
- **Success Criteria**: Sidebar is hidden in both modes; Indices are 3-column in landscape.

## Verification Plan
### Automated (Browser Subagent)
- iPhone 14 emulation (390x844 and 844x390).
- Visual check for "Perfect Consistency".
