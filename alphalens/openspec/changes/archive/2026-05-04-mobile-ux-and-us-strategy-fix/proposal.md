# Proposal: Mobile UX Fix & US Strategy Optimization

## Goal
Improve the mobile experience by fixing layout truncation, enhance the home page with interactive market indices, and resolve the "Neutral" trend issue for US stocks in the AI Strategy engine.

## Objectives
1. **Mobile UI Consistency**: Fix the responsive table-to-card transformation to ensure the Portfolio view is fully visible on mobile devices.
2. **Interactive Market Indices**: Enable detailed stock views (K-line charts) for S&P 500, NASDAQ, and TWSE indices.
3. **Strategy Engine Debugging**: Investigate and fix the trend detection logic for US stocks to provide accurate BULLISH/BEARISH/CONSOLIDATION signals.

## Proposed Changes
- **index.html**: Fix class names in the portfolio section to match CSS media queries.
- **styles.css**: Update responsive breakpoints and card-mode styles for better mobile visibility.
- **app.js**: 
  - Add click handlers to Market Indices cards.
  - Map indices names to valid tickers (e.g., ^GSPC, ^IXIC).
  - Debug candle data length and PIP calculation for US stocks.
- **strategyEngine.js**: Adjust trend detection sensitivity if necessary for different price scales.
