# Proposal: Fix Chart Disappearance and Feedback Loops

This change resolves the critical bug where the main K-line chart disappears when both TACTICAL and PIP Overlay are active. It also prevents potential infinite feedback loops in chart synchronization.

## Problem Statement
- **Initialization Race Condition**: `renderTradingViewChart` was being called before the TACTICAL chart instance was fully initialized, leading to errors in the dynamic analysis loop.
- **Global Variable Reset**: The main chart renderer was resetting global variables used by the tactical chart (`patternUpperSeries`, etc.), causing reference errors.
- **Feedback Loops**: Synchronizing `visibleLogicalRange` bi-directionally without a guard can cause infinite update cycles, freezing the UI.
- **Memory Leaks**: The main chart container was cleared via `innerHTML` without properly calling `chart.remove()`, leading to zombie chart instances.

## Proposed Changes

### 1. Robust State Management
- Group chart-specific variables into logical units.
- Ensure `refreshPipAnalysis` safely checks for the existence of all required series before attempting to set data or markers.

### 2. Synchronization Guards
- Implement a comparison check in the `subscribeVisibleLogicalRangeChange` listeners. Only update the "other" chart if the new range is significantly different from its current range.

### 3. Proper Cleanup
- Use `if (currentStockChart) currentStockChart.remove();` instead of `container.innerHTML = '';` to ensure all WebGL contexts and listeners are properly disposed of.

### 4. Logic Re-ordering
- In `togglePipTactical`, ensure the tactical chart instance is created *before* calling any functions that might trigger a synchronization event.

## Goals
- Stable dashboard even with all overlays enabled.
- Smooth synchronization without UI lag or crashes.
- Proper cleanup of chart instances.
