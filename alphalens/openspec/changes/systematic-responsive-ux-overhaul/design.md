# [DESIGN] Systematic Responsive Overhaul

## 1. The 1024px "Mobile Gutter"
We are establishing 1024px as the "Mobile Boundary".
- **Below 1024px**: The application operates as a single-column drawer-based app.
- **Above 1024px**: The application operates as a two-column desktop-style app.

## 2. Landscape-Specific Rules
In landscape mode (height < width and width < 1024px):
- **Market Indices**:
  ```css
  .indices-grid {
      grid-template-columns: repeat(3, 1fr) !important;
      gap: 12px;
  }
  ```
- **Top Bar**:
  Reduce height to `50px` to save vertical space.

## 3. CDP Verification Pipeline
Using the `browser_subagent`, we will:
1. `setViewport(390, 844)` -> `screenshot('portrait_pre.png')`
2. `setViewport(844, 390)` -> `screenshot('landscape_pre.png')`
3. [Apply Edits]
4. Repeat 1 & 2 -> `screenshot('portrait_post.png')`, `screenshot('landscape_post.png')`
