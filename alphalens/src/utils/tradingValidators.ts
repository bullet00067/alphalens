/**
 * tradingValidators.ts
 * 
 * Comprehensive Trading Domain Invariants and Defense Logic Validator
 * Enforces:
 * 1. Ratchet Principle (棘輪原則): Defense lines (Stop Loss / Trailing Stop) can ONLY move favorably.
 * 2. Market-Aware Friction & Currency: Isolates Taiwan stocks (NT$, 0.3% tax, 0.0855% fee) from US/Global stocks ($, 0% tax, 0% fee).
 * 3. Spatial Hierarchy: Strict inequality S2 < S1 < Current Price < R1 < R2.
 * 4. Directional Progress: Correct progress bar math for both LONG and SHORT.
 * 5. Risk-Reward Sanity: Prevents invalid/inverted risk setups from claiming high R/R ratios.
 */

import { isTaiwanStock } from './api';

export interface MarketFriction {
  currencySymbol: string;
  currencyName: string;
  buyFeeRate: number;
  sellFeeRate: number;
  sellTaxRate: number;
  isTaiwan: boolean;
}

/**
 * Returns accurate market friction parameters based on ticker
 */
export function getMarketFriction(ticker: string): MarketFriction {
  const isTW = isTaiwanStock(ticker);
  if (isTW) {
    return {
      currencySymbol: 'NT$',
      currencyName: '新台幣',
      buyFeeRate: 0.001425 * 0.6,  // 0.0855% (券商電子下單6折)
      sellFeeRate: 0.001425 * 0.6, // 0.0855%
      sellTaxRate: 0.003,          // 0.3% (台股賣出證券交易稅)
      isTaiwan: true
    };
  }

  // US & Global markets (QQQ, AAPL, NVDA, TSLA, SPY, etc.)
  return {
    currencySymbol: '$',
    currencyName: '美元',
    buyFeeRate: 0,                // 美股免手續費主流券商標準
    sellFeeRate: 0,               // 0 (SEC微量規費在一般試算中忽略或為0)
    sellTaxRate: 0,               // 美股無台灣 0.3% 證券交易稅
    isTaiwan: false
  };
}

export interface TacticalAdvisory {
  title: string;
  action: string;
  color: string;
  bg: string;
  recommendedDefensePrice: number;
}

export interface TacticalInputs {
  ticker: string;
  direction: 'LONG' | 'SHORT';
  currentPrice: number;
  cost: number;
  shares: number;
  target1: number;
  target2: number;
  strategyStopLoss: number;
  trailingStopPrice: number;
  viewMode: 'NET' | 'GROSS';
  pnlNet: number;
  pnlGross: number;
  pnlPct: number;
  tp1PartialGain: number;
}

/**
 * Enforces the Ratchet Principle (棘輪原則) for tactical advice
 * A stop loss/trailing defense line can NEVER be retreated (lowered for LONG, raised for SHORT)
 */
export function getTacticalDefenseAndAdvice(inputs: TacticalInputs): TacticalAdvisory {
  const {
    ticker,
    direction,
    currentPrice,
    cost,
    shares,
    target1,
    strategyStopLoss,
    trailingStopPrice,
    viewMode,
    pnlNet,
    pnlGross,
    pnlPct,
    tp1PartialGain
  } = inputs;

  const friction = getMarketFriction(ticker);
  const sym = friction.currencySymbol;

  if (cost <= 0 || shares <= 0) {
    return {
      title: '請輸入持股與成本',
      action: '輸入您的實際庫存股數與成本價，系統將自動啟動動態風控與利潤階梯試算。',
      color: 'text-slate-400',
      bg: 'bg-slate-800/40 border-slate-700',
      recommendedDefensePrice: strategyStopLoss
    };
  }

  if (direction === 'LONG') {
    // Breakeven threshold (cost + 1% to cover friction and lock minimal gain)
    const breakEvenPrice = cost * 1.01;
    
    // Ratchet Defense Line: The highest valid defense point among structural stop, breakeven, and trailing stop
    // If structural stop or trailing stop is ALREADY above cost, that stop represents secured profit!
    const effectiveStructuralStop = Math.max(strategyStopLoss, trailingStopPrice > 0 ? trailingStopPrice : 0);
    const activeDefense = Math.max(effectiveStructuralStop, breakEvenPrice);

    // Case 1: Reached or exceeded Target 1
    if (currentPrice >= target1) {
      // Ratchet: Defense must be at least effectiveStructuralStop and at least cost
      const newDefense = Math.max(effectiveStructuralStop, breakEvenPrice);
      return {
        title: '已突破目標一！啟動波段鎖利',
        action: `現價已達目標一 ${sym}${target1.toFixed(1)}！強烈建議分批獲利出清 50% 鎖住 ${sym}${tp1PartialGain.toLocaleString()}，剩餘部位防守線設於 ${sym}${newDefense.toFixed(1)}，鎖定不敗勝局！`,
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/30',
        recommendedDefensePrice: newDefense
      };
    }

    // Case 2: Deep profit (Cost is far below current price, e.g. currentPrice > cost * 1.05)
    if (currentPrice > cost * 1.05) {
      // Critical Ratchet Check: Is structural stop ALREADY higher than breakeven (cost * 1.01)?
      if (effectiveStructuralStop > breakEvenPrice) {
        // Deep profit where structural support has already moved way above cost! (e.g. QQQ cost 623, support 706.5)
        const lockedGainPct = (((effectiveStructuralStop - cost) / cost) * 100).toFixed(1);
        return {
          title: '波段深厚獲利：鎖利防守中',
          action: `目前浮盈 +${pnlPct}%，技術結構防守線 ${sym}${effectiveStructuralStop.toFixed(1)} 已遠高於買入成本 ${sym}${cost.toFixed(1)}。此線已轉化為堅固的「結構鎖利線」（跌破仍可鎖住 +${lockedGainPct}% 利潤），嚴禁向下調降防守！`,
          color: 'text-indigo-400',
          bg: 'bg-indigo-500/10 border-indigo-500/30',
          recommendedDefensePrice: effectiveStructuralStop
        };
      } else {
        // Normal profit expansion where initial stop is still below cost -> Ratchet UP to breakeven!
        return {
          title: '獲利擴大中：推進保本線',
          action: `目前浮盈 +${pnlPct}%，利潤空間已拉開。建議將防守線由 ${sym}${effectiveStructuralStop.toFixed(1)} 逐步推進至保本線 ${sym}${breakEvenPrice.toFixed(1)}，確保這筆交易立於不敗之地！`,
          color: 'text-indigo-400',
          bg: 'bg-indigo-500/10 border-indigo-500/30',
          recommendedDefensePrice: breakEvenPrice
        };
      }
    }

    // Case 3: Breached Stop Loss
    if (currentPrice < strategyStopLoss) {
      return {
        title: '觸發破線停損警報！',
        action: `現價跌破關鍵防守線 ${sym}${strategyStopLoss.toFixed(1)}，虧損已達 ${pnlPct}%！切勿盲目凹單，請依交易計畫嚴格執行防守平倉。`,
        color: 'text-rose-400',
        bg: 'bg-rose-500/10 border-rose-500/30',
        recommendedDefensePrice: strategyStopLoss
      };
    }

    // Case 4: Pullback / Under Cost
    if (currentPrice < cost) {
      const gapToSL = ((currentPrice - strategyStopLoss) / currentPrice) * 100;
      return {
        title: '拉回防守觀察期',
        action: `目前回檔浮虧 ${pnlPct}%，距離停損防守線尚有 ${gapToSL.toFixed(1)}% 緩衝空間。嚴格以 ${sym}${strategyStopLoss.toFixed(1)} 為底線，未跌破前可耐心觀察。`,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/30',
        recommendedDefensePrice: strategyStopLoss
      };
    }

    // Case 5: Cost consolidation
    return {
      title: '多頭成本區整固',
      action: `股價在買進成本附近震盪。若帶量突破 ${sym}${(cost * 1.03).toFixed(1)} 可放手持股，目標看第一階段停利點 ${sym}${target1.toFixed(1)}。`,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/30',
      recommendedDefensePrice: strategyStopLoss
    };
  }

  // SHORT Direction
  // In SHORT: lower price is profit, higher price is loss.
  const shortBreakEvenPrice = cost * 0.99;
  const effectiveShortStop = Math.min(strategyStopLoss, trailingStopPrice > 0 ? trailingStopPrice : Infinity);

  if (currentPrice <= target1) {
    // Reached Cover Target 1
    const newDefense = Math.min(effectiveShortStop, shortBreakEvenPrice);
    return {
      title: '已達回補目標一！建議分批回補',
      action: `空單已達第一目標價 ${sym}${target1.toFixed(1)}！建議回補 50% 股數鎖定 ${sym}${tp1PartialGain.toLocaleString()} 獲利，剩餘空單防守點下壓至 ${sym}${newDefense.toFixed(1)} 鎖定利潤。`,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/30',
      recommendedDefensePrice: newDefense
    };
  }

  if (currentPrice < cost * 0.95) {
    // Deep short profit
    if (effectiveShortStop < shortBreakEvenPrice) {
      const lockedGainPct = (((cost - effectiveShortStop) / cost) * 100).toFixed(1);
      return {
        title: '空單深厚獲利：壓低鎖利防守',
        action: `空單目前浮盈 +${pnlPct}%，技術壓力防守線 ${sym}${effectiveShortStop.toFixed(1)} 已低於放空成本 ${sym}${cost.toFixed(1)}。此線已轉化為「結構鎖利線」（反彈觸碰仍可獲利 +${lockedGainPct}%），切勿向上調高防守！`,
        color: 'text-indigo-400',
        bg: 'bg-indigo-500/10 border-indigo-500/30',
        recommendedDefensePrice: effectiveShortStop
      };
    } else {
      return {
        title: '空單獲利中：推進保本線',
        action: `空單浮盈 +${pnlPct}%，利潤空間拉開。建議將空單防守線由 ${sym}${effectiveShortStop.toFixed(1)} 下壓至保本線 ${sym}${shortBreakEvenPrice.toFixed(1)}，確保立於不敗之地！`,
        color: 'text-indigo-400',
        bg: 'bg-indigo-500/10 border-indigo-500/30',
        recommendedDefensePrice: shortBreakEvenPrice
      };
    }
  }

  if (currentPrice > strategyStopLoss) {
    return {
      title: '空單觸發停損警戒！',
      action: `股價反彈突破空單停損線 ${sym}${strategyStopLoss.toFixed(1)}，空單虧損已達 ${pnlPct}%！請立即執行融券回補停損以防軋空。`,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/30',
      recommendedDefensePrice: strategyStopLoss
    };
  }

  return {
    title: '空頭趨勢推進中',
    action: `空單浮盈中 (+${pnlPct}%)，目標看波段回補點 ${sym}${target1.toFixed(1)}，防守點看 ${sym}${strategyStopLoss.toFixed(1)}。`,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10 border-indigo-500/30',
    recommendedDefensePrice: strategyStopLoss
  };
}

/**
 * Calculates progress bar percentage correctly for both LONG and SHORT
 */
export function calculateDirectionalProgress(
  direction: 'LONG' | 'SHORT',
  currentPrice: number,
  cost: number,
  stopLoss: number,
  target2: number
): number {
  if (cost <= 0 || currentPrice <= 0) return 50;

  if (direction === 'LONG') {
    const minVal = Math.min(stopLoss, currentPrice, cost);
    const maxVal = Math.max(target2, currentPrice, cost);
    if (maxVal === minVal) return 50;
    const pct = ((currentPrice - minVal) / (maxVal - minVal)) * 100;
    return Math.min(100, Math.max(0, pct));
  } else {
    // For SHORT: Highest price (stopLoss) is 0% progress (loss), lowest price (target2) is 100% progress (max profit)
    const worstPrice = Math.max(stopLoss, currentPrice, cost);
    const bestPrice = Math.min(target2, currentPrice, cost);
    if (worstPrice === bestPrice) return 50;
    const pct = ((worstPrice - currentPrice) / (worstPrice - bestPrice)) * 100;
    return Math.min(100, Math.max(0, pct));
  }
}

/**
 * Validates and strictly enforces spatial hierarchy:
 * S2 < S1 < currentPrice < R1 < R2
 */
export function validateSupportResistance(
  currentPrice: number,
  rawS1: number,
  rawS2: number,
  rawR1: number,
  rawR2: number
): { s1: number; s2: number; r1: number; r2: number } {
  // Ensure R1 is strictly above currentPrice (at least 1% above)
  let r1 = rawR1 > currentPrice * 1.005 ? rawR1 : currentPrice * 1.03;
  // Ensure R2 is strictly above R1
  let r2 = rawR2 > r1 ? rawR2 : r1 * 1.05;

  // Ensure S1 is strictly below currentPrice (at least 1% below)
  let s1 = rawS1 < currentPrice * 0.995 ? rawS1 : currentPrice * 0.97;
  // Ensure S2 is strictly below S1
  let s2 = rawS2 < s1 ? rawS2 : s1 * 0.95;

  return {
    s1: Number(s1.toFixed(2)),
    s2: Number(s2.toFixed(2)),
    r1: Number(r1.toFixed(2)),
    r2: Number(r2.toFixed(2))
  };
}

/**
 * Validates risk-reward ratio, preventing inverted or zero risk from generating fake high ratios
 */
export function validateRiskReward(
  entry: number,
  stopLoss: number,
  target1: number,
  isBullish: boolean
): { rr: number; label: string; isValid: boolean } {
  if (entry <= 0 || stopLoss <= 0 || target1 <= 0) {
    return { rr: 0, label: 'N/A', isValid: false };
  }

  let risk = 0;
  let reward = 0;

  if (isBullish) {
    risk = entry - stopLoss;
    reward = target1 - entry;
  } else {
    risk = stopLoss - entry;
    reward = entry - target1;
  }

  // If risk <= 0, stopLoss is inverted (e.g. stop loss higher than entry in long position)
  if (risk <= 0) {
    return { rr: 0, label: '無效風險 (停損倒置)', isValid: false };
  }

  if (reward <= 0) {
    return { rr: 0, label: '無獲利空間 (目標小於進場)', isValid: false };
  }

  const ratio = reward / risk;
  return {
    rr: Number(ratio.toFixed(2)),
    label: `${ratio.toFixed(1)} : 1`,
    isValid: true
  };
}
