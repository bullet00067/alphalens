# OpenSpec: Stock Dashboard Enhancement

## Project Overview
A professional, interactive stock investment dashboard supporting Taiwan and US markets, secure API key management, and advanced technical indicators.

---

## Feature: K-Line Timeframe Switcher (Current Implementation)

### 1. Goal
Allow users to switch between 15m, 60m, Day, Week, Month, and Year timeframes on the technical chart.

### 2. Technical Specifications

#### Data Sources & Strategy
- **US Stocks (Twelve Data API)**:
  - Intervals: `15min`, `1h`, `1day`, `1week`, `1month`.
  - Yearly: Aggregated from Monthly data.
- **Taiwan Stocks (FinMind API)**:
  - Intervals: Only `1day` supported by API.
  - Higher timeframes (Week, Month, Year): Aggregated from daily OHLC data in frontend.
  - Lower timeframes (15m, 60m): Not supported in free tier (Display Toast).

#### State Management
- `currentTimeframe`: Stores the active scale (default: `1day`).
- `currentTicker`: Stores the current active stock to allow switching scales without re-searching.

#### UI Components
- **Timeframe Selector Bar**: A row of buttons above the indicator bar.
- **Visual Feedback**: Active state styling for the selected timeframe.

### 3. Change History (K-Line Switcher)
| Version | Description | Status |
|---------|-------------|--------|
| 1.0     | Initial Spec Creation | In Progress |

---

## Global Technical Indicators Spec
- SMA (5, 20, 60, 120)
- EMA (12, 26)
- Bollinger Bands (20, 2)
- Volume Histogram (Overlay)
- RSI (14) (Sub-chart)
