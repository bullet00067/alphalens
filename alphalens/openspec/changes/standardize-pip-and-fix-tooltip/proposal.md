# Change Proposal: Standardize PIP and Fix Tooltip

## Overview
This change addresses a UI bug where the PIP overlay tooltip persists after the cursor leaves the chart, and an algorithmic enhancement to normalize price data (using Log Transformation) before running the PIP detection.

## Problem Description
1. **Tooltip Bug**: When the PIP overlay is active, hovering over a PIP point shows a `P: V:` tooltip. However, when moving the cursor away, the value remains displayed, whereas it should only be visible on hover.
2. **Scaling Sensitivity**: In high-volatility or high-price stocks (e.g., MXL), the PIP algorithm's absolute price scaling causes it to ignore significant percentage moves at lower price levels in favor of minor absolute moves at higher price levels.

## Proposed Solution
1. **Tooltip UI**: Modify the tooltip visibility logic in the chart's crosshair movement handler to ensure the label is hidden when not specifically targeting a PIP point.
2. **PIP Standardization**: Implement a Log-base-10 transformation on the price data within the PIP algorithm. This ensures that "importance" is measured by relative percentage change rather than absolute dollar value, making it effective across all price scales.

## Impact
- **UI/UX**: Cleaner chart interaction without ghost tooltips.
- **Accuracy**: Improved pattern recognition for high-growth stocks, reducing false negatives in trend detection.
