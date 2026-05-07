# Proposal: TWSE API Fallback Mechanism

## Goal
Implement a robust fallback mechanism for Taiwan stock data fetching. When the primary data source (FinMind) returns quota-related errors (HTTP 402/429), the system should automatically switch to the TWSE (Taiwan Stock Exchange) Official API to ensure users can still see daily price data.

## Why
Currently, free users of FinMind frequently hit quota limits, leading to "Fetch Data Error" on the dashboard. Providing a fallback to a free, non-key-based source like the TWSE official website improves the reliability of the AlphaLens platform for Taiwan users.

## Scope
- Update `vite.config.js` to include a proxy for `www.twse.com.tw`.
- Implement `fetchTwseFallbackCandles` in `app.js`.
- Update error handling in `loadChartData` and `fetchTwseCandles` to trigger fallback.
- Ensure regression test for US stocks passes.
