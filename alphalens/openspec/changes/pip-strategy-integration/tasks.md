# Tasks: PIP Strategy Integration

## Phase 1: Core Signal Logic
- [x] Initialize `strategyEngine.js` and decouple logic from `app.js`.
- [x] Implement `StandardizeData` and `TrendModule` for Bullish/Consolidation identification.
- [x] Add `SignalConfidence` scoring based on PIP vertical distances.
- [x] Implement `EntryModule` for "Consolidation Breakout" and "Buy After Pullback".
- [x] Implement `DefenseModule` for Stop Loss and Trailing Stop (5MA).
- [x] Implement Anti-Corruption Layer (ACL) for external data validation.
- [x] Update `app.js` to store 60-day history for all active tickers to support these modules.
- [x] Optimize `findPIPs` for real-time tactical layer (Memoization).

## Phase 2: Workflow & Automation
- [x] Create `PreCloseScanner`: Logic to activate between 13:00-13:25.
- [x] Implement `YahooVerify` utility for price validation.
- [x] Create "Observation List" storage in Firestore.

## Phase 3: UI Implementation
- [x] Update Portfolio Table with detailed "Signal" badges.
- [x] Implement "Pre-close Action List" widget on Dashboard.
- [x] Add visual PIP support/resistance lines to the Chart Detail view.
- [x] Integrate signals into the AI Assistant's market analysis output.

## Phase 4: Testing & Polish
- [x] Verify Yahoo Finance verification logic with real-time data.
- [x] Test stop-loss and trailing-stop triggers in a simulated environment.
- [x] Refine the "Exhaustion" signal detection (Volume + Long Upper Shadow).
