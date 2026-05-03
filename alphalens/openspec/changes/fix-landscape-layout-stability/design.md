# [DESIGN] Landscape Layout Stability

## The "Slim Sidebar" Pattern
When the height is constrained (Landscape), vertical real estate is precious.
1. **Sidebar Transformation**:
   - `width: 250px` -> `width: 70px`
   - `padding: 24px 0` -> `padding: 12px 0`
   - `span` (text labels) -> `display: none`
   - `li` -> `justify-content: center`
   - `logo` -> `justify-content: center` (hide text)

2. **Main Content Adjustment**:
   - The `.main-content` should naturally fill the remaining space.
   - We need to ensure that the `margin-left` or flex behavior of the main content adapts to the 70px sidebar.

3. **Top Bar Compression**:
   - `padding: 20px` -> `padding: 10px 20px`
   - Search bar should maintain functionality but might need a smaller height or font size to fit.

## Mobile (Portrait) vs Landscape vs Desktop
| Viewport | Sidebar Width | Label Status | Navigation Type |
| :--- | :--- | :--- | :--- |
| Mobile Portrait (<768px) | 0px (Hidden) | Visible (Expanded) | Hamburger |
| Mobile Landscape (H < 500px) | 70px | Hidden (Icons only) | Slim Rail |
| Desktop (>1024px) | 250px | Visible | Permanent Sidebar |
