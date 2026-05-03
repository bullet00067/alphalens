# [DESIGN] Enforced Mobile Consistency

## The 1024px Standard
Standard mobile breakpoints (768px) often fail for modern smartphones in landscape. 1024px is a safer threshold that covers most mobile and small tablet use cases.

1. **Sidebar State Management**:
   - `[0px to 1024px]`: Hidden Sidebar (Drawer). `margin-left: 0` on content.
   - `[> 1024px]`: Permanent Sidebar. `margin-left: 250px` (or whatever the sidebar width is).

2. **Cleaning up Interstitial Rules**:
   - We will remove any rules targeting specific heights or orientations that create the "Slim Sidebar" (rail) effect, as it was deemed less intuitive than a full drawer.

3. **Z-Index and Overlay**:
   - Sidebar Z-index: 2000
   - Overlay Z-index: 1500
   - Top Bar Z-index: 1000
   - This prevents the "clicking issues" mentioned by the QA Agent earlier.
