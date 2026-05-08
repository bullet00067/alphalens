# Proposal: Mobile UI and Tactical Enhancements

## Goal
Improve the mobile user experience and enhance the "Tactical" (PIP) analysis feature by fixing layout crowding, enabling Taiwan stock pattern recognition, and adding a probability-based price movement prediction.

## Why
- **Mobile UI**: The current chart controls overlap on smaller screens, making it impossible to read or interact with SMA/Tactical settings.
- **TW Stock Parity**: Taiwan stock users should have access to the same pattern recognition features as US stock users.
- **Actionable Insights**: Providing a percentage probability (e.g., 65% Bullish) gives users a clearer signal for decision-making compared to just displaying a pattern name.

## Scope
1. **CSS Refinement**: Use flexbox wrapping or a scrollable control bar for chart settings on mobile (< 768px).
2. **TW Pattern Recognition**: Update the pattern detection logic to process Taiwan stock candle data correctly.
3. **Probability Algorithm**: Implement a weighted calculation based on SMA crossovers, RSI levels, and recognized patterns to output a Bull/Bear probability.
