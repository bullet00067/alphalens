/**
 * StrategyEngine.js
 * Implementation of PIP Algorithm & Technical Analysis System
 */

const PIP_MAX_ITERATIONS = 150;

// Memoization cache for PIP calculations
const pipCache = new Map();

/**
 * Calculate Standard Deviation of an array
 */
export function calculateStdDev(data) {
    if (data.length === 0) return 0;
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    return Math.sqrt(variance);
}

/**
 * Standardize data to Z-scores
 */
export function standardizeData(data) {
    if (data.length === 0) return { mean: 0, std: 1 };
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const std = calculateStdDev(data) || 1;
    return { mean, std };
}

/**
 * Calculate Average True Range (ATR)
 */
export function calculateATR(candles, period = 14) {
    if (candles.length < period + 1) return 0;
    const trs = [];
    for (let i = 1; i < candles.length; i++) {
        const h = candles[i].high;
        const l = candles[i].low;
        const pc = candles[i-1].close;
        trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    }
    const atr = trs.slice(-period).reduce((a, b) => a + b, 0) / period;
    return atr;
}

/**
 * Calculate vertical distance between a point and a line segment
 */
export function calcVerticalDistance(startX, startY, endX, endY, candX, candY) {
    if (endX === startX) return 0;
    const vd = (((candX - startX) / (endX - startX)) * (endY - startY) + startY) - candY;
    return Math.abs(vd);
}

/**
 * Optimize K (number of PIPs) using variance reduction method
 */
function pipNumByMse(pipVdSumArray) {
    if (pipVdSumArray.length < 3) return pipVdSumArray.length;
    const pipVdMvRange = [];
    for (let i = 0; i < pipVdSumArray.length - 1; i++) {
        pipVdMvRange.push(Math.abs(pipVdSumArray[i] - pipVdSumArray[i+1]));
    }
    const mravg = pipVdMvRange.reduce((acc, val) => acc + val, 0) / pipVdMvRange.length;
    let bestPipNum = pipVdSumArray.length;
    for (let k = 0; k < pipVdMvRange.length; k++) {
        if (pipVdMvRange[k] > mravg) {
            bestPipNum = k + 4;
        }
    }
    return bestPipNum;
}

/**
 * Find Perceptually Important Points (PIPs) with Memoization
 */
export function findPIPs(candles, useCache = true) {
    if (!candles || candles.length < 5) return candles || [];
    
    // Simple cache key based on first/last time and length
    const cacheKey = `${candles[0].time}-${candles[candles.length-1].time}-${candles.length}`;
    if (useCache && pipCache.has(cacheKey)) {
        return pipCache.get(cacheKey);
    }

    const N = candles.length;
    const yValues = candles.map(c => c.close);
    const stats = standardizeData(yValues);
    
    const data = candles.map((c, i) => ({
        index: i,
        time: c.time,
        value: c.close,
        volume: c.volume,
        high: c.high,
        low: c.low,
        stdY: (c.close - stats.mean) / stats.std
    }));
    
    let pipIndexByOrder = [0, N - 1];
    let pipVdSum = [];
    let pipVds = [0, 0]; // VD for each PIP
    
    const MAX_PIPS = Math.min(N, PIP_MAX_ITERATIONS); 
    let pipNum = 2;

    while (pipNum < MAX_PIPS) {
        let maxVd = -1;
        let pipCandidate = -1;
        let vdSum = 0;
        let currentPips = [...pipIndexByOrder].sort((a, b) => a - b);
        
        for (let i = 0; i < currentPips.length - 1; i++) {
            let startIdx = currentPips[i];
            let endIdx = currentPips[i+1];
            let pStart = data[startIdx];
            let pEnd = data[endIdx];
            
            for (let j = startIdx + 1; j < endIdx; j++) {
                let pCand = data[j];
                let vd = calcVerticalDistance(pStart.index, pStart.stdY, pEnd.index, pEnd.stdY, pCand.index, pCand.stdY);
                vdSum += vd;
                if (vd > maxVd) {
                    maxVd = vd;
                    pipCandidate = j;
                }
            }
        }
        
        if (pipCandidate === -1) break;
        pipVdSum.push(vdSum);
        pipIndexByOrder.push(pipCandidate);
        pipVds.push(maxVd);
        pipNum++;
    }
    
    const bestK = pipNumByMse(pipVdSum);
    const finalK = Math.min(Math.max(bestK, 3), pipIndexByOrder.length);
    const bestPipIndices = pipIndexByOrder.slice(0, finalK);
    const resultPips = bestPipIndices.map((idx, i) => ({
        ...data[idx],
        vd: pipVds[i]
    })).sort((a, b) => a.index - b.index);

    if (useCache) pipCache.set(cacheKey, resultPips);
    return resultPips;
}

/**
 * TrendModule: Identify Bullish/Consolidation status
 * Optimized with Volatility-Adaptive thresholds
 */
export function analyzeTrend(pips, candles = []) {
    if (pips.length < 5) return { status: 'NEUTRAL', confidence: 0 };

    const peaks = [];
    const troughs = [];
    
    for (let i = 1; i < pips.length - 1; i++) {
        if (pips[i].value > pips[i-1].value && pips[i].value > pips[i+1].value) peaks.push(pips[i]);
        if (pips[i].value < pips[i-1].value && pips[i].value < pips[i+1].value) troughs.push(pips[i]);
    }

    const currentPrice = pips[pips.length - 1].value;
    const atr = candles.length > 20 ? calculateATR(candles) : currentPrice * 0.02;
    
    // 1. Consolidation Detection (High Precision)
    // Rule: Dispersion of last 3 peaks is within adaptive threshold
    if (peaks.length >= 2) {
        const lastPeaks = peaks.slice(-3).map(p => p.value);
        const peakStd = calculateStdDev(lastPeaks);
        
        // Adaptive Threshold: Min of 0.5% or half of daily volatility (ATR)
        const adaptiveThreshold = Math.min(0.005, (atr / currentPrice) * 0.5);
        const dispersion = peakStd / currentPrice;

        if (dispersion < adaptiveThreshold) {
            return { status: 'CONSOLIDATION', confidence: 0.85, peaks, troughs, dispersion };
        }
    }

    // 2. Bullish Structure Detection
    if (troughs.length >= 2 && peaks.length >= 2) {
        const tLen = troughs.length;
        const pLen = peaks.length;
        
        // HH (Higher High) and HL (Higher Low)
        const isHL = troughs[tLen-1].value > troughs[tLen-2].value;
        const isHH = peaks[pLen-1].value > peaks[pLen-2].value;

        if (isHL && isHH) {
            const avgVd = pips.reduce((sum, p) => sum + (p.vd || 0), 0) / pips.length;
            return { status: 'BULLISH', confidence: Math.min(avgVd, 1.0), peaks, troughs };
        }
    }

    return { status: 'NEUTRAL', confidence: 0.5, peaks, troughs };
}

/**
 * StrategyModule: Entry A (Breakout) and Entry B (Pullback)
 */
export function evaluateEntry(candles, pips, trend) {
    if (candles.length < 2) return null;
    const current = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    
    // Entry A: Consolidation Breakout
    if (trend.status === 'CONSOLIDATION' && trend.peaks.length > 0) {
        const neckline = trend.peaks[trend.peaks.length - 1].value;
        const volumeTarget = prev.volume * 1.3;
        const isRedK = current.close > current.open;
        
        if (current.close > neckline && current.volume > volumeTarget && isRedK) {
            return { type: 'ENTRY_A', price: current.close, reason: '盤整突破' };
        }
    }

    // Entry B: Buy After Pullback
    if (trend.status === 'BULLISH' && trend.troughs.length > 0) {
        const lastTrough = trend.troughs[trend.troughs.length - 1].value;
        const isRedK = current.close > current.open;
        // Logic: Pullback didn't break last trough, now showing strength (red K)
        if (current.low > lastTrough && isRedK && current.close > prev.close) {
            return { type: 'ENTRY_B', price: current.close, reason: '回後買上漲' };
        }
    }

    return null;
}

/**
 * DefenseModule: Exit signals (Stop Loss, Trailing Stop, Exhaustion)
 */
export function evaluateExit(candles, pips, position) {
    if (!position || candles.length < 2) return null;
    const current = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    
    // 1. Initial Stop Loss
    if (current.close < position.stopLoss) {
        return { type: 'EXIT_STOP', price: current.close, reason: '觸發停損' };
    }

    // 2. Trailing Stop (5MA)
    const ma5 = calculateMA(candles, 5);
    if (current.close < ma5 && prev.close >= ma5) {
        return { type: 'EXIT_TRAILING', price: current.close, reason: '跌破5MA' };
    }

    // 3. Exhaustion Defense (High Volume Black K or Long Upper Shadow)
    const upperShadow = current.high - Math.max(current.open, current.close);
    const body = Math.abs(current.open - current.close);
    if (current.volume > prev.volume * 2 && (current.close < current.open || upperShadow > body * 2)) {
        return { type: 'EXIT_EXHAUSTION', price: current.close, reason: '高點爆量/長上影線' };
    }

    return null;
}

function calculateMA(candles, period) {
    if (candles.length < period) return 0;
    const slice = candles.slice(-period);
    return slice.reduce((sum, c) => sum + c.close, 0) / period;
}

/**
 * Main Signal Generator
 */
export function generatePIPSignal(candles) {
    if (!candles || candles.length < 20) {
        return { signal: 'NEUTRAL', text: '🟡 資料不足', color: 'var(--text-secondary)' };
    }

    const pips = findPIPs(candles);
    const trend = analyzeTrend(pips, candles);
    const entry = evaluateEntry(candles, pips, trend);
    
    if (entry) {
        return { 
            signal: 'BUY', 
            text: `🟢 ${entry.reason}`, 
            color: '#22c55e', 
            details: entry,
            confidence: trend.confidence 
        };
    }

    // Default trend-based status
    if (trend.status === 'BULLISH') return { signal: 'HOLD', text: '🔵 多頭持股', color: '#3b82f6', confidence: trend.confidence };
    if (trend.status === 'CONSOLIDATION') return { signal: 'NEUTRAL', text: '🟡 區間盤整', color: '#eab308', confidence: trend.confidence };
    
    return { signal: 'NEUTRAL', text: '⚪️ 趨勢不明', color: 'var(--text-secondary)', confidence: 0 };
}
