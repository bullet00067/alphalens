# Tasks: K-Line Pattern Recognition

## Phase 1: Core Engine Development
- [x] Implement `calculateSlope` and `isParallel` helpers in `strategyEngine.js`.
- [x] Implement `identifyPatterns` core loop.
- [x] Add detection logic for Triangle patterns (Ascending/Descending).
- [x] Add detection logic for Double Top/Bottom patterns.

## Phase 2: Integration & Signal Logic
- [x] Integrate pattern results into `generatePIPSignal`.
- [x] Adjust `confidence` score based on pattern quality.
- [x] Calculate target prices based on pattern height.

## Phase 3: Visualization & UI
- [x] Update `app.js` to render pattern boundary lines on the chart.
- [x] Implement the **Tactical PIP View** grid below the main chart.
- [x] Synchronize time scales between Main Chart and Tactical View.
- [x] Implement pattern labels/tooltips near the formation and on the Tactical View.
- [x] Ensure lines clear/update correctly during zoom/ticker switch.

## Phase 4: Optimization & Polish
- [x] Implement caching for pattern results within a session.
- [x] Add "Breakout" alerts when price closes outside pattern boundaries.
