# Proposal: PIP Strategy Integration for AlphaLens

## Goal
Integrate the high-conviction "PIP 演算法與實戰技術分析整合系統" (as defined in `pip-strategy.md`) into AlphaLens. This will evolve the platform from a simple dashboard into an automated decision-support system that provides precise entry, exit, and position sizing instructions based on perceptually important points and real-time market validation.

## Scope
- **Strategic Layer**: Implementation of trend identification using 60-day Daily K PIPs ($Trough_2 > Trough_1$ and $Peak_2 > Peak_1$). Requires minimum of 5 PIPs for valid trend analysis.
- **Tactical Layer**: Real-time monitoring of "Pre-close Action" (13:00 - 13:25). Includes **Signal Confidence Scoring** and **Memoized PIP calculations** for low-latency tick analysis.
- **Verification Layer**: Integration with Yahoo Finance via an **Anti-Corruption Layer (ACL)** for mandatory dual-verification.
- **UX/UI**: High-priority "Action Banners" with urgent semantic styling and accessibility-aware Signal Badges (Icons + Color).

## Architecture
- **Modularity**: Extract all trading logic from `app.js` into a dedicated `strategyEngine.js` module.
- **PIP Logic**: Implement `TrendModule`, `StrategyModule`, and `DefenseModule` as decoupled units within the engine.
- **Data Fetching**: Use an **Anti-Corruption Layer (ACL)** for Yahoo Finance to handle API failures gracefully.
- **Storage**: Leverage Firestore with a structured schema for Observation Lists (expiry, triggerType, validatedPrice).

## Proposed Changes
### [Component] Signal Engine (`strategyEngine.js`) [NEW]
- **TrendModule**: Identifies `Bullish` / `Consolidation` states (requires min 5 PIPs).
- **StrategyModule**: Implements breakout/pullback logic with volume confirmation.
- **DefenseModule**: Implements ATR-buffered Stop Loss and 5MA Trailing Stop.
- **ConfidenceEngine**: Assigns score based on PIP vertical distance.

### [Component] UI / UX
- **Dashboard**: "Pre-close Action List" widget with **Aria-Live** alerts.
- **Portfolio**: Accessibility-aware Signal Badges with icons and semantic colors.
- **Stock Detail**: PIP-based Neckline and Support annotations.

### [Component] Data & Validation
- **YahooVerify (ACL)**: Handles external data mapping and fail-safe logic.
- **Firestore Schema**: Structured Observation List with expiry and trigger history.

## Verification Plan
### Automated Tests
- Logic tests for `TrendModule` using mock OHLC data.
- Validation tests for `StrategyModule` triggers (Price + Volume + K-line color).
### Manual Verification
- Live observation during pre-close hours (13:00 - 13:25) to verify signal accuracy.
- Cross-checking UI signals against Yahoo Finance website.
