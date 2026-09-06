import { describe, it, expect } from 'vitest';

import {
  getMarketFriction,
  getTacticalDefenseAndAdvice,
  calculateDirectionalProgress,
  validateSupportResistance,
  validateRiskReward
} from '../src/utils/tradingValidators';

describe('AlphaLens Trading Domain Invariants & Logic Protection Suite', () => {
  it('1. Market Friction: US stocks must have 0% tax, 0% broker fee and "$" currency', () => {
    const usFriction = getMarketFriction('QQQ');
    expect(usFriction.currencySymbol).toBe('$');
    expect(usFriction.isTaiwan).toBe(false);
    expect(usFriction.sellTaxRate).toBe(0);
    expect(usFriction.buyFeeRate).toBe(0);

    const twFriction = getMarketFriction('2330.TW');
    expect(twFriction.currencySymbol).toBe('NT$');
    expect(twFriction.isTaiwan).toBe(true);
    expect(twFriction.sellTaxRate).toBe(0.003);
  });

  it('2. QQQ Deep-Profit Case: Ratchet principle prevents retreating stop loss to cost*1.01', () => {
    // Reproducing user scenario:
    // Ticker: QQQ, Cost: 623, Price: 718, Support/SL: 706.5
    const advisory = getTacticalDefenseAndAdvice({
      ticker: 'QQQ',
      direction: 'LONG',
      currentPrice: 718.0,
      cost: 623.0,
      shares: 44,
      target1: 750.0,
      target2: 800.0,
      strategyStopLoss: 706.5,
      trailingStopPrice: 700.0,
      viewMode: 'NET',
      pnlNet: 4180,
      pnlGross: 4180,
      pnlPct: 15.25,
      tp1PartialGain: 2794
    });

    // Recommended defense MUST maintain the structural lock at >= 706.5
    expect(advisory.recommendedDefensePrice).toBeGreaterThanOrEqual(706.5);

    // Must NOT retreat defense to 630.2
    expect(advisory.action).not.toContain('630.2');
    expect(advisory.recommendedDefensePrice).not.toBe(623.0);
    expect(advisory.recommendedDefensePrice).not.toBe(630.2);

    // Must recognize it as a structure lock
    expect(advisory.title + advisory.action).toContain('鎖利');
    expect(advisory.action).toContain('$');
  });

  it('3. Normal Profit Expansion: Ratchets UP to breakeven when initial stop was below cost', () => {
    // Taiwan stock bought at 1000, initial stop 950, now price is 1060 (> cost * 1.05)
    const advisory = getTacticalDefenseAndAdvice({
      ticker: '2330.TW',
      direction: 'LONG',
      currentPrice: 1060.0,
      cost: 1000.0,
      shares: 1000,
      target1: 1100.0,
      target2: 1200.0,
      strategyStopLoss: 950.0,
      trailingStopPrice: 960.0,
      viewMode: 'NET',
      pnlNet: 55000,
      pnlGross: 60000,
      pnlPct: 6.0,
      tp1PartialGain: 50000
    });

    // Should ratchet up to cost * 1.01 (1010)
    expect(advisory.recommendedDefensePrice).toBe(1010.0);
    expect(advisory.action).toContain('推進至保本線 NT$1010.0');
  });

  it('4. SHORT Direction: Ratchet downward, progress bar moves forward with profit', () => {
    // Shorted at 100, price dropped to 80 (profit), stop is 90 (below cost -> locking profit)
    const advisory = getTacticalDefenseAndAdvice({
      ticker: 'NVDA',
      direction: 'SHORT',
      currentPrice: 80.0,
      cost: 100.0,
      shares: 50,
      target1: 75.0,
      target2: 60.0,
      strategyStopLoss: 90.0,
      trailingStopPrice: 88.0,
      viewMode: 'NET',
      pnlNet: 1000,
      pnlGross: 1000,
      pnlPct: 20.0,
      tp1PartialGain: 625
    });

    // Short defense should be <= 90 (never raised to 100 or 99)
    expect(advisory.recommendedDefensePrice).toBeLessThanOrEqual(90);
    expect(advisory.title + advisory.action).toContain('鎖利');

    // Directional progress: When price drops towards target2 (60), progress must be high (> 50%)
    const progress = calculateDirectionalProgress('SHORT', 80.0, 100.0, 90.0, 60.0);
    expect(progress).toBeGreaterThanOrEqual(50);
  });

  it('5. Support & Resistance Spatial Invariants: S2 < S1 < Current Price < R1 < R2', () => {
    const currentPrice = 718.0;

    // Test case with messy/inverted raw inputs
    const levels = validateSupportResistance(
      currentPrice,
      720.0, // raw S1 higher than price (invalid)
      715.0, // raw S2
      710.0, // raw R1 lower than price (invalid)
      712.0  // raw R2
    );

    expect(levels.s2).toBeLessThan(levels.s1);
    expect(levels.s1).toBeLessThan(currentPrice);
    expect(currentPrice).toBeLessThan(levels.r1);
    expect(levels.r1).toBeLessThan(levels.r2);
  });

  it('6. Risk-Reward Sanity: Inverted stop loss must NOT return "極高比率"', () => {
    // Long trade with entry 100, stopLoss 105 (inverted! risk <= 0)
    const result = validateRiskReward(100, 105, 120, true);
    expect(result.isValid).toBe(false);
    expect(result.label).toBe('無效風險 (停損倒置)');

    // Normal valid trade
    const validResult = validateRiskReward(100, 90, 120, true);
    expect(validResult.isValid).toBe(true);
    expect(validResult.label).toBe('2.0 : 1');
  });
});
