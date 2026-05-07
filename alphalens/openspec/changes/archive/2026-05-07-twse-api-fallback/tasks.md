# Tasks: TWSE API Fallback Mechanism

- [x] Update `vite.config.js` to add `/twse` proxy.
- [x] Implement `fetchTwseFallbackCandles` in `app.js`.
- [x] Implement Minguo date conversion utility (e.g., `convertMinguoToAD`).
- [x] Refactor `fetchTwseCandles` to include try-catch fallback logic.
- [x] Update `getQuickQuote` to include TWSE fallback for real-time prices.
- [x] Verify fallback works by simulating a 402 error or using a ticker that hits the quota.
- [x] Regression test US stocks (AAPL, TSLA).
