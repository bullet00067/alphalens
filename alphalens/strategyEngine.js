/**
 * StrategyEngine.js
 * Implementation of PIP Algorithm & Technical Analysis System
 */

const PIP_MAX_ITERATIONS = 150;

/**
 * Strategy Configuration Thresholds
 */
export const STRATEGY_CONFIG = {
    TRIANGLE_TOLERANCE: 0.0005,      // 0.05% per bar
    RECTANGLE_TOLERANCE: 0.0005,     // 0.05% per bar
    DOUBLE_PATTERN_TOLERANCE: 0.015, // 1.5% price difference
    HS_PATTERN_TOLERANCE: 0.02,      // 2% price difference
    TRIPLE_PATTERN_TOLERANCE: 0.015  // 1.5% price difference
};

// Memoization cache for PIP calculations
const pipCache = new Map();
const patternCache = new Map();

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
 * Calculate slope between two points
 */
export function calculateSlope(p1, p2) {
    if (p2.index === p1.index) return 0;
    return (p2.value - p1.value) / (p2.index - p1.index);
}

/**
 * Check if two slopes are approximately parallel within a threshold
 */
export function isParallel(slope1, slope2, threshold = 0.05) {
    return Math.abs(slope1 - slope2) < threshold;
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
    const logValues = candles.map(c => Math.log10(c.close));
    const stats = standardizeData(logValues);
    
    const data = candles.map((c, i) => ({
        index: i,
        time: c.time,
        value: c.close,
        volume: c.volume,
        high: c.high,
        low: c.low,
        stdY: (Math.log10(c.close) - stats.mean) / stats.std
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
    const finalK = Math.min(Math.max(bestK, 5), pipIndexByOrder.length);
    const bestPipIndices = pipIndexByOrder.slice(0, finalK);
    const sortedIndices = [...bestPipIndices].sort((a, b) => a - b);
    
    const result = sortedIndices.map(idx => {
        const p = data[idx];
        let type = 'point';
        // Tag as peak or trough relative to neighbors
        if (idx > 0 && idx < N - 1) {
            if (data[idx].value > data[idx-1].value && data[idx].value > data[idx+1].value) type = 'high';
            else if (data[idx].value < data[idx-1].value && data[idx].value < data[idx+1].value) type = 'low';
        }
        return {
            ...p,
            type: type,
            pipOrder: bestPipIndices.indexOf(idx)
        };
    });

    if (useCache) pipCache.set(cacheKey, result);
    return result;
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
        
        // Adaptive Threshold: Min of 1% or half of daily volatility (ATR)
        const adaptiveThreshold = Math.min(0.01, (atr / currentPrice) * 0.5);
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
            return { status: 'BULLISH', confidence: 0.9, peaks, troughs };
        }
    }

    // 3. Bearish Structure Detection (LH + LL)
    if (troughs.length >= 2 && peaks.length >= 2) {
        const tLen = troughs.length;
        const pLen = peaks.length;
        
        const isLL = troughs[tLen-1].value < troughs[tLen-2].value;
        const isLH = peaks[pLen-1].value < peaks[pLen-2].value;

        if (isLL && isLH) {
            return { status: 'BEARISH', confidence: 0.9, peaks, troughs };
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

/**
 * Calculate Moving Average
 */
export function calculateMA(candles, period) {
    if (candles.length < period) return 0;
    const slice = candles.slice(-period);
    return slice.reduce((sum, c) => sum + c.close, 0) / period;
}

/**
 * PatternRecognitionModule: Identify geometric patterns from PIPs
 * Now with similarity scoring (0-100%)
 */
export function identifyPatterns(pips, useCache = true) {
    if (pips.length < 5) return [];
    
    const cacheKey = pips.map(p => `${p.time}-${p.value.toFixed(4)}`).join('|');
    if (useCache && patternCache.has(cacheKey)) {
        return patternCache.get(cacheKey);
    }
    
    const peaks = [];
    const troughs = [];
    for (let i = 1; i < pips.length - 1; i++) {
        if (pips[i].value > pips[i-1].value && pips[i].value > pips[i+1].value) peaks.push(pips[i]);
        if (pips[i].value < pips[i-1].value && pips[i].value < pips[i+1].value) troughs.push(pips[i]);
    }

    let patterns = [];
    
    // 1. Check for Triangles & Wedges
    const triangleWedge = checkTriangleAndWedge(peaks, troughs);
    if (triangleWedge) patterns.push(triangleWedge);

    // 2. Check for Rectangle & Flags
    const rectFlag = checkRectangleAndFlag(peaks, troughs, pips);
    if (rectFlag) patterns.push(rectFlag);

    // 3. Check for Double Patterns (M/W) with Similarity
    const doublePattern = checkDoublePatternWithScore(peaks, troughs);
    if (doublePattern) patterns.push(doublePattern);

    // 4. Check for Head and Shoulders
    const hs = checkHeadAndShoulders(peaks, troughs);
    if (hs) patterns.push(hs);

    // Sort by similarity score descending
    patterns.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

    if (useCache) {
        patternCache.set(cacheKey, patterns);
    }
    return patterns;
}

/**
 * Enhanced Triangle & Wedge logic
 */
function checkTriangleAndWedge(peaks, troughs) {
    if (peaks.length < 2 || troughs.length < 2) return null;
    
    const p1 = peaks[peaks.length - 2];
    const p2 = peaks[peaks.length - 1];
    const t1 = troughs[troughs.length - 2];
    const t2 = troughs[troughs.length - 1];
    
    const sUpper = calculateSlope(p1, p2);
    const sLower = calculateSlope(t1, t2);
    
    const normUpper = sUpper / p1.value;
    const normLower = sLower / t1.value;
    const tol = 0.002; // Relaxed tolerance

    // 1. Symmetrical Triangle (Converging)
    if (normUpper < -tol && normLower > tol) {
        const sim = Math.min(100, Math.round((Math.abs(normUpper) + Math.abs(normLower)) / 0.02 * 100));
        return { 
            type: 'SYMMETRICAL_TRIANGLE', name: '對稱三角', color: '#eab308', 
            points: [p1, p2, t1, t2], similarity: Math.max(70, sim),
            upperSlope: sUpper, lowerSlope: sLower,
            probability: { bullish: 50, bearish: 50 }
        };
    }

    // 2. Falling Wedge (Both falling, but upper falls faster)
    if (normUpper < -tol && normLower < -tol && normUpper < normLower) {
        return { 
            type: 'FALLING_WEDGE', name: '下降楔形', color: '#22c55e', 
            points: [p1, p2, t1, t2], similarity: 85,
            upperSlope: sUpper, lowerSlope: sLower,
            probability: { bullish: 75, bearish: 25 }
        };
    }

    // 3. Rising Wedge (Both rising, but lower rises faster)
    if (normUpper > tol && normLower > tol && normLower > normUpper) {
        return { 
            type: 'RISING_WEDGE', name: '上升楔形', color: '#ef4444', 
            points: [p1, p2, t1, t2], similarity: 85,
            upperSlope: sUpper, lowerSlope: sLower,
            probability: { bullish: 25, bearish: 75 }
        };
    }

    return null;
}

/**
 * Enhanced Rectangle & Flag logic
 */
function checkRectangleAndFlag(peaks, troughs, pips) {
    if (peaks.length < 2 || troughs.length < 2) return null;
    
    const p1 = peaks[peaks.length - 2];
    const p2 = peaks[peaks.length - 1];
    const t1 = troughs[troughs.length - 2];
    const t2 = troughs[troughs.length - 1];
    
    const sUpper = calculateSlope(p1, p2);
    const sLower = calculateSlope(t1, t2);
    
    const normUpper = sUpper / p1.value;
    const normLower = sLower / t1.value;
    const tol = 0.001;

    // Parallel check
    const parallelScore = 1 - Math.abs(normUpper - normLower) / 0.01;

    if (parallelScore > 0.7) {
        // If slopes are near zero -> Rectangle
        if (Math.abs(normUpper) < tol && Math.abs(normLower) < tol) {
            return { 
                type: 'RECTANGLE', name: '矩形區間', color: '#3b82f6', 
                points: [p1, p2, t1, t2], similarity: Math.round(parallelScore * 100),
                probability: { bullish: 50, bearish: 50 }
            };
        }
        // If slopes are same direction -> Flag
        return { 
            type: 'FLAG', name: '旗形整理', color: '#a855f7', 
            points: [p1, p2, t1, t2], similarity: Math.round(parallelScore * 100),
            probability: { bullish: 60, bearish: 40 }
        };
    }
    
    return null;
}

/**
 * Double Top/Bottom with Similarity Score
 */
function checkDoublePatternWithScore(peaks, troughs) {
    // Double Bottom (W)
    if (troughs.length >= 2) {
        const t1 = troughs[troughs.length - 2];
        const t2 = troughs[troughs.length - 1];
        const diff = Math.abs(t1.value - t2.value) / ((t1.value + t2.value) / 2);
        
        // Even if diff is up to 5%, we consider it a W-Bottom with lower score
        if (diff < 0.05) {
            const similarity = Math.round((1 - (diff / 0.05)) * 100);
            const relevantPips = peaks.filter(p => p.index > t1.index && p.index < t2.index);
            const midPeak = relevantPips.length > 0 ? Math.max(...relevantPips.map(p => p.value)) : t1.value * 1.05;
            
            return { 
                type: 'DOUBLE_BOTTOM', name: 'W底 (雙重底)', color: '#22c55e', 
                points: [t1, t2], similarity, neckline: midPeak,
                probability: { bullish: 80, bearish: 20 }
            };
        }
    }
    
    // Double Top (M)
    if (peaks.length >= 2) {
        const p1 = peaks[peaks.length - 2];
        const p2 = peaks[peaks.length - 1];
        const diff = Math.abs(p1.value - p2.value) / ((p1.value + p2.value) / 2);
        
        if (diff < 0.05) {
            const similarity = Math.round((1 - (diff / 0.05)) * 100);
            const relevantTroughs = troughs.filter(t => t.index > p1.index && t.index < p2.index);
            const midTrough = relevantTroughs.length > 0 ? Math.min(...relevantTroughs.map(t => t.value)) : p1.value * 0.95;
            
            return { 
                type: 'DOUBLE_TOP', name: 'M頭 (雙重頂)', color: '#ef4444', 
                points: [p1, p2], similarity, neckline: midTrough,
                probability: { bullish: 20, bearish: 80 }
            };
        }
    }
    
    return null;
}

function checkHeadAndShoulders(peaks, troughs) {
    if (peaks.length >= 3) {
        const p1 = peaks[peaks.length - 3];
        const p2 = peaks[peaks.length - 2];
        const p3 = peaks[peaks.length - 1];
        if (p2.value > p1.value && p2.value > p3.value) {
            const shoulderDiff = Math.abs(p1.value - p3.value) / ((p1.value + p3.value) / 2);
            if (shoulderDiff < 0.05) {
                return { 
                    type: 'HEAD_AND_SHOULDERS', name: '頭肩頂', color: '#ef4444', 
                    points: [p1, p2, p3], similarity: Math.round((1 - shoulderDiff/0.05) * 100) 
                };
            }
        }
    }
    return null;
}

/**
 * Calculate Bullish/Bearish Probability based on multiple indicators
 */
export function calculateProbability(signal, trend, candles) {
    if (!candles || candles.length < 20) return { bullish: 50, bearish: 50 };
    let score = 50; 
    if (trend.status === 'BULLISH') score += 15;
    if (trend.status === 'BEARISH') score -= 15;
    if (signal.signal === 'BUY') score += 20;
    if (signal.signal === 'SELL') score -= 20;

    if (signal.patterns && signal.patterns.length > 0) {
        const p = signal.patterns[0];
        const weight = (p.similarity || 80) / 100;
        if (['ASCENDING_TRIANGLE', 'DOUBLE_BOTTOM', 'FLAG', 'FALLING_WEDGE'].includes(p.type)) score += (20 * weight);
        if (['DESCENDING_TRIANGLE', 'DOUBLE_TOP', 'RISING_WEDGE'].includes(p.type)) score -= (20 * weight);
    }

    const bullish = Math.min(98, Math.max(2, Math.round(score)));
    return { bullish, bearish: 100 - bullish };
}

/**
 * Main Signal Generator
 */
export function generatePIPSignal(candles, providedPips = null) {
    if (!candles || candles.length < 20) {
        return { signal: 'NEUTRAL', text: '🟡 資料不足', color: 'var(--text-secondary)', probability: { bullish: 50, bearish: 50 } };
    }

    const pips = providedPips || findPIPs(candles);
    const trend = analyzeTrend(pips, candles);
    const patterns = identifyPatterns(pips);
    
    let finalSignal = { signal: 'NEUTRAL', text: '⚪️ 趨勢不明', color: 'var(--text-secondary)', patterns };

    if (patterns.length > 0) {
        const p = patterns[0];
        finalSignal.text = `${p.name} (相似度 ${p.similarity}%)`;
        finalSignal.color = p.color;
        
        if (p.probability.bullish > 60) finalSignal.signal = 'BUY';
        if (p.probability.bearish > 60) finalSignal.signal = 'SELL';
    }

    finalSignal.probability = calculateProbability(finalSignal, trend, candles);
    return finalSignal;
}
