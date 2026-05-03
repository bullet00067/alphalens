# [PROPOSAL] Portfolio Mobile UI Redesign (Table-to-Card)

## Goal
Redesign the "My Portfolio" view for mobile devices to eliminate the "cramped" feeling of the current table layout. The goal is to provide a clean, high-density, yet readable interface that highlights P/L and Price using a Card-based design on small screens.

## User Review Required
> [!IMPORTANT]
> The implementation will involve a conditional rendering logic in CSS: the standard `<table>` will be hidden on mobile, and a new container with `display: flex` (cards) will be shown instead.

## Proposed Changes
- **Layout Transformation**: 
    - **Desktop**: Keep the efficient table view.
    - **Mobile (< 768px)**: Transform each portfolio row into a full-width **Holding Card**.
- **Card Content Hierarchy**:
    - **Header**: Ticker Symbol + Current Price (Big).
    - **Primary Stat**: Total P/L (Amount & Percentage) in a prominent colored area.
    - **Sub-stats**: Qty and Avg Cost moved to a secondary, smaller text row.
    - **Actions**: "Delete" button moved to the top-right corner of the card or an swipe-action (simulated).
- **Summary Section**: Stack the Total Equity and Total P/L cards vertically on mobile with better icon-based visualization.
- **Sticky Add Button**: Move the "Add New Holding" form to a collapsible section or a simple modal trigger to save screen real estate.

## Verification Plan
### Automated Tests
- Browser subagent to verify the transition from Table to Card when resizing.
### Manual Verification
- Test readability on iPhone SE (smallest width) and ensure no horizontal scrolling is required.
