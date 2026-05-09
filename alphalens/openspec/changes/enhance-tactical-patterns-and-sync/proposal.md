# Proposal: Enhance Tactical Patterns and Sync

This change ensures that the tactical analysis and visual representation are perfectly synchronized with the main chart's visible window, while introducing more advanced pattern recognition.

## Problem Statement
- **PIP Dissonance**: The yellow PIP line on the tactical chart doesn't match the main chart because it's calculated on different datasets (full history vs. visible window).
- **Static Analysis**: The "Pattern" and "Signal" info in the tactical panel doesn't update as the user zooms or scrolls, leading to stale information.
- **Limited Patterns**: Users expect more complex pattern recognition like Head and Shoulders or Triple Tops.

## Proposed Changes

### 1. Strategy Engine Upgrades (`strategyEngine.js`)
- Add detection for **Head and Shoulders** (Top and Bottom).
- Add detection for **Triple Top/Bottom**.
- Improve the sensitivity of `findPIPs` for shorter windows.

### 2. Application Logic Refactoring (`app.js`)
- Implement a unified `refreshPipAnalysis` function.
- Subscribe the TACTICAL chart to the same `VisibleLogicalRangeChange` event as the main chart.
- Ensure that zooming in on the main chart causes the tactical PIP line to gain detail and re-evaluate patterns for that specific window.

## Goals
- Identical yellow PIP lines on both Main and Tactical charts.
- Dynamic "Pattern: X" updates during scroll/zoom.
- Support for Head and Shoulders patterns.
