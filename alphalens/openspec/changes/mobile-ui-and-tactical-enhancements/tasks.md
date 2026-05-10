# Tasks: Mobile UI and Tactical Enhancements

- [x] **Mobile UI (Responsive Grid)**
  - [x] Implement responsive grid layout for `.chart-toolbar` in `styles.css`.
  - [x] Group buttons with subtle styling to maintain visual hierarchy when wrapped.
  - [x] Increase touch target size for buttons on mobile.
  - [x] Verify no horizontal scrolling exists on small screens.

- [x] **Taiwan Stock Patterns**
  - [x] Debug `findPIPs` for Taiwan stocks.
  - [x] Verify pattern rendering in the Tactical panel for 2330.TW.

- [x] **Probability Model**
  - [x] Implement `calculateProbability` in `strategyEngine.js`.
  - [x] Display probability percentage in the Tactical panel.
  - [x] Add visual feedback (color/bar) for probability.

- [x] **Verification**
  - [x] Regression test US/TW stocks.
  - [x] Mobile UX validation (no horizontal scrolling).

- [x] **Production Deployment (Render)**
  - [x] Identify CORS issues on static site deployment.
  - [x] Implement `fetchWithProxy` using `corsproxy.io` for production data fetching.
  - [x] Parallelize data requests using `Promise.all` to reduce latency.
  - [x] Implement in-memory caching for API responses.
  - [x] Fix production unresponsiveness due to top-level Firebase initialization crash.
  - [x] Implement resilient error handling for missing environment variables (VITE_*).
  - [x] Prioritize global event listener initialization to prevent UI locking on startup errors.
  - [x] Fix local Vite proxy configuration for development parity.
