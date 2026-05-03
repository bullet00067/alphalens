# [DESIGN] Landscape Sidebar Perfection

## The "Zero-Ghost" Architecture
To prevent the issues seen in the screenshot, we will implement the following:

1. **Sidebar Rail (70px)**:
   - All `li` items will have `text-align: center`.
   - The text labels (`span`) will be `display: none !important`.
   - To catch any other text, `font-size: 0` will be applied to the `li`.
   - The icon `i` will have `font-size: 20px !important`.

2. **Circular Auth Actions**:
   - Instead of a pill or square, the auth buttons in landscape will become:
     - `width: 44px`
     - `height: 44px`
     - `border-radius: 50%`
     - `padding: 0`
   - This saves vertical and horizontal space.

3. **Content Buffer**:
   - Increase the `margin-left` of `.main-content` slightly to ensure there is a clear "gutter" between the slim sidebar and the content card.

4. **Table Transformation**:
   - Even if the screen is wide, if the height is < 500px, the table rows should be "compact cards" or have reduced vertical padding to show more holdings at once.
