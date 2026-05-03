# [PROPOSAL] Landscape Sidebar Perfection & Text Ghosting Elimination

## Goal
Completely resolve the UI issues in landscape mode where text labels overlap with icons in the sidebar and ensure the layout is professional and compact.

## User Review Required
> [!IMPORTANT]
> I will be using a "font-size: 0" technique on the sidebar list items in landscape mode to ensure 100% text removal, leaving only the icons perfectly centered.

## Proposed Changes
### 1. Hardened Landscape CSS (styles.css)
- **Zero-Font Technique**: Set `.sidebar .nav-links li` to `font-size: 0` in landscape mode to kill any ghost text nodes. Reset `font-size` on icons.
- **Button Circularization**: Force the login/logout buttons to be perfect circles in landscape by overriding `width`, `height`, and `border-radius`.
- **Icon Centering**: Ensure `display: flex` and `justify-content: center` are applied with `!important` to all sidebar elements.
- **Table Height Fix**: Adjust the portfolio table rows to be more compact when the vertical space is limited.

### 2. Frontend Polish (app.js)
- Ensure the `switchView` logic doesn't conflict with the slim sidebar's reduced click targets.

## Verification Plan (QA Agent)
- Test on 844x390 (iPhone landscape) and 932x430 (iPhone Pro Max landscape).
- **Checklist**:
    1. Sidebar width = exactly 70px.
    2. Zero visible text in sidebar.
    3. Icons perfectly centered vertically and horizontally.
    4. Sign In button is a blue circle with Google icon.
