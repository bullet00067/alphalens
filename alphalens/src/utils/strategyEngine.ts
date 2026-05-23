/**
 * StrategyEngine.ts
 * Implementation of PIP Algorithm & Technical Analysis System in TypeScript
 */

export interface Candle {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PipPoint {
  index: number;
  time: string | number;
  value: number;
  volume: number;
  high: number;
  low: number;
  stdY: number;
  type: string; // 'point' | 'high' | 'low'
  pipOrder: number;
}

export interface TrendResult {
  status: 'BULLISH' | 'BEARISH' | 'CONSOLIDATION' | 'NEUTRAL';
  confidence: number;
  peaks: PipPoint[];
  troughs: PipPoint[];
  dispersion?: number;
}

export interface Pattern {
  type: string;
  name: string;
  color: string;
  points: PipPoint[];
  similarity: number;
  neckline?: number;
  upperSlope?: number;
  lowerSlope?: number;
  probability: { bullish: number; bearish: number };
  status?: 'FORMING' | 'CONFIRMED';
  volumeConfirmed?: boolean;
}

export interface PipSignal {
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  text: string;
  color: string;
  patterns: Pattern[];
  probability: { bullish: number; bearish: number };
}

const PIP_MAX_ITERATIONS = 150;

export const STRATEGY_CONFIG = {
  TRIANGLE_TOLERANCE: 0.0005,      // 0.05% per bar
  RECTANGLE_TOLERANCE: 0.0005,     // 0.05% per bar
  DOUBLE_PATTERN_TOLERANCE: 0.015, // 1.5% price difference
  HS_PATTERN_TOLERANCE: 0.02,      // 2% price difference
  TRIPLE_PATTERN_TOLERANCE: 0.015  // 1.5% price difference
};

// Memoization cache for PIP calculations
const pipCache = new Map<string, PipPoint[]>();
const patternCache = new Map<string, Pattern[]>();

/**
 * Calculate Standard Deviation of an array
 */
export function calculateStdDev(data: number[]): number {
  if (data.length === 0) return 0;
  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  return Math.sqrt(variance);
}

/**
 * Standardize data to Z-scores
 */
export function standardizeData(data: number[]): { mean: number; std: number } {
  if (data.length === 0) return { mean: 0, std: 1 };
  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const std = calculateStdDev(data) || 1;
  return { mean, std };
}

/**
 * Calculate Average True Range (ATR)
 */
export function calculateATR(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const atr = trs.slice(-period).reduce((a, b) => a + b, 0) / period;
  return atr;
}

/**
 * Calculate vertical distance between a point and a line segment
 */
export function calcVerticalDistance(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  candX: number,
  candY: number
): number {
  if (endX === startX) return 0;
  const vd = (((candX - startX) / (endX - startX)) * (endY - startY) + startY) - candY;
  return Math.abs(vd);
}

/**
 * Calculate slope between two points
 */
export function calculateSlope(p1: { index: number; value: number }, p2: { index: number; value: number }): number {
  if (p2.index === p1.index) return 0;
  return (p2.value - p1.value) / (p2.index - p1.index);
}

/**
 * Check if two slopes are approximately parallel within a threshold
 */
export function isParallel(slope1: number, slope2: number, threshold = 0.05): boolean {
  return Math.abs(slope1 - slope2) < threshold;
}

/**
 * Optimize K (number of PIPs) using variance reduction method
 */
function pipNumByMse(pipVdSumArray: number[]): number {
  if (pipVdSumArray.length < 3) return pipVdSumArray.length;
  const pipVdMvRange: number[] = [];
  for (let i = 0; i < pipVdSumArray.length - 1; i++) {
    pipVdMvRange.push(Math.abs(pipVdSumArray[i] - pipVdSumArray[i + 1]));
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
export function findPIPs(candles: Candle[], useCache = true): PipPoint[] {
  if (!candles || candles.length < 5) return [];

  const cacheKey = `${candles[0].time}-${candles[candles.length - 1].time}-${candles.length}-${candles[0].close.toFixed(2)}-${candles[candles.length - 1].close.toFixed(2)}`;
  if (useCache && pipCache.has(cacheKey)) {
    return pipCache.get(cacheKey)!;
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

  const pipIndexByOrder = [0, N - 1];
  const pipVdSum: number[] = [];
  const pipVds = [0, 0];

  const MAX_PIPS = Math.min(N, PIP_MAX_ITERATIONS);
  let pipNum = 2;

  while (pipNum < MAX_PIPS) {
    let maxVd = -1;
    let pipCandidate = -1;
    let vdSum = 0;
    const currentPips = [...pipIndexByOrder].sort((a, b) => a - b);

    for (let i = 0; i < currentPips.length - 1; i++) {
      const startIdx = currentPips[i];
      const endIdx = currentPips[i + 1];
      const pStart = data[startIdx];
      const pEnd = data[endIdx];

      for (let j = startIdx + 1; j < endIdx; j++) {
        const pCand = data[j];
        const vd = calcVerticalDistance(pStart.index, pStart.stdY, pEnd.index, pEnd.stdY, pCand.index, pCand.stdY);
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

  const result: PipPoint[] = sortedIndices.map(idx => {
    const p = data[idx];
    let type = 'point';
    if (idx > 0 && idx < N - 1) {
      if (data[idx].value > data[idx - 1].value && data[idx].value > data[idx + 1].value) type = 'high';
      else if (data[idx].value < data[idx - 1].value && data[idx].value < data[idx + 1].value) type = 'low';
    }
    return {
      ...p,
      type,
      pipOrder: bestPipIndices.indexOf(idx)
    };
  });

  if (useCache) pipCache.set(cacheKey, result);
  return result;
}

/**
 * TrendModule: Identify Bullish/Consolidation status
 */
export function analyzeTrend(pips: PipPoint[], candles: Candle[] = []): TrendResult {
  if (pips.length < 5) return { status: 'NEUTRAL', confidence: 0.5, peaks: [], troughs: [] };

  const peaks: PipPoint[] = [];
  const troughs: PipPoint[] = [];

  for (let i = 1; i < pips.length - 1; i++) {
    if (pips[i].value > pips[i - 1].value && pips[i].value > pips[i + 1].value) peaks.push(pips[i]);
    if (pips[i].value < pips[i - 1].value && pips[i].value < pips[i + 1].value) troughs.push(pips[i]);
  }

  const currentPrice = pips[pips.length - 1].value;
  const atr = candles.length > 20 ? calculateATR(candles) : currentPrice * 0.02;

  // 1. Consolidation Detection
  if (peaks.length >= 2) {
    const lastPeaks = peaks.slice(-3).map(p => p.value);
    const peakStd = calculateStdDev(lastPeaks);
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
    const isHL = troughs[tLen - 1].value > troughs[tLen - 2].value;
    const isHH = peaks[pLen - 1].value > peaks[pLen - 2].value;

    if (isHL && isHH) {
      return { status: 'BULLISH', confidence: 0.9, peaks, troughs };
    }
  }

  // 3. Bearish Structure Detection
  if (troughs.length >= 2 && peaks.length >= 2) {
    const tLen = troughs.length;
    const pLen = peaks.length;
    const isLL = troughs[tLen - 1].value < troughs[tLen - 2].value;
    const isLH = peaks[pLen - 1].value < peaks[pLen - 2].value;

    if (isLL && isLH) {
      return { status: 'BEARISH', confidence: 0.9, peaks, troughs };
    }
  }

  return { status: 'NEUTRAL', confidence: 0.5, peaks, troughs };
}

/**
 * StrategyModule: Entry A (Breakout) and Entry B (Pullback)
 */
export function evaluateEntry(candles: Candle[], pips: PipPoint[], trend: TrendResult) {
  if (candles.length < 2) return null;
  const current = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  if (trend.status === 'CONSOLIDATION' && trend.peaks.length > 0) {
    const neckline = trend.peaks[trend.peaks.length - 1].value;
    const volumeTarget = prev.volume * 1.3;
    const isRedK = current.close > current.open;

    if (current.close > neckline && current.volume > volumeTarget && isRedK) {
      return { type: 'ENTRY_A', price: current.close, reason: '盤整突破' };
    }
  }

  if (trend.status === 'BULLISH' && trend.troughs.length > 0) {
    const lastTrough = trend.troughs[trend.troughs.length - 1].value;
    const isRedK = current.close > current.open;
    if (current.low > lastTrough && isRedK && current.close > prev.close) {
      return { type: 'ENTRY_B', price: current.close, reason: '回後買上漲' };
    }
  }

  return null;
}

/**
 * DefenseModule: Exit signals (Stop Loss, Trailing Stop, Exhaustion)
 */
export function evaluateExit(candles: Candle[], pips: PipPoint[], position: { stopLoss: number }) {
  if (!position || candles.length < 2) return null;
  const current = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  if (current.close < position.stopLoss) {
    return { type: 'EXIT_STOP', price: current.close, reason: '觸發停損' };
  }

  const ma5 = calculateMA(candles, 5);
  if (current.close < ma5 && prev.close >= ma5) {
    return { type: 'EXIT_TRAILING', price: current.close, reason: '跌破5MA' };
  }

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
export function calculateMA(candles: Candle[], period: number): number {
  if (candles.length < period) return 0;
  const slice = candles.slice(-period);
  return slice.reduce((sum, c) => sum + c.close, 0) / period;
}

/**
 * PatternRecognitionModule: Identify geometric patterns from PIPs
 */
export function identifyPatterns(pips: PipPoint[], candles: Candle[] | null = null, useCache = true): Pattern[] {
  if (pips.length < 5) return [];

  const cacheKey = pips.map(p => `${p.time}-${p.value.toFixed(4)}`).join('|');
  if (useCache && patternCache.has(cacheKey)) {
    return patternCache.get(cacheKey)!;
  }

  const peaks: PipPoint[] = [];
  const troughs: PipPoint[] = [];
  for (let i = 1; i < pips.length - 1; i++) {
    if (pips[i].value > pips[i - 1].value && pips[i].value > pips[i + 1].value) peaks.push(pips[i]);
    if (pips[i].value < pips[i - 1].value && pips[i].value < pips[i + 1].value) troughs.push(pips[i]);
  }

  const patterns: Pattern[] = [];

  const triangleWedge = checkTriangleAndWedge(peaks, troughs);
  if (triangleWedge) patterns.push(triangleWedge);

  const rectFlag = checkRectangleAndFlag(peaks, troughs);
  if (rectFlag) patterns.push(rectFlag);

  const doublePattern = checkDoublePatternWithScore(peaks, troughs);
  if (doublePattern) patterns.push(doublePattern);

  const hs = checkHeadAndShoulders(peaks, troughs);
  if (hs) patterns.push(hs);

  patterns.sort((a, b) => b.similarity - a.similarity);

  if (candles && candles.length > 0) {
    const currentClose = candles[candles.length - 1].close;
    patterns.forEach(p => {
      determinePatternStatus(p, currentClose);
      checkVolumeConfirmation(p, candles);
    });
  }

  if (useCache) {
    patternCache.set(cacheKey, patterns);
  }
  return patterns;
}

function determinePatternStatus(pattern: Pattern, currentClose: number) {
  if (!pattern) return;
  pattern.status = 'FORMING';

  if (pattern.type === 'DOUBLE_BOTTOM' || pattern.type === 'HEAD_AND_SHOULDERS') {
    if (pattern.neckline && currentClose > pattern.neckline) pattern.status = 'CONFIRMED';
  } else if (pattern.type === 'DOUBLE_TOP') {
    if (pattern.neckline && currentClose < pattern.neckline) pattern.status = 'CONFIRMED';
  } else if (['DESCENDING_TRIANGLE', 'FALLING_WEDGE'].includes(pattern.type)) {
    if (pattern.points.length >= 2 && currentClose > pattern.points[0].value) pattern.status = 'CONFIRMED';
  } else if (['ASCENDING_TRIANGLE', 'RISING_WEDGE'].includes(pattern.type)) {
    if (pattern.points.length >= 4 && currentClose < pattern.points[2].value) pattern.status = 'CONFIRMED';
  } else if (['RECTANGLE', 'FLAG', 'SYMMETRIC_TRIANGLE'].includes(pattern.type)) {
    if (pattern.points.length >= 4) {
      if (currentClose > pattern.points[0].value || currentClose < pattern.points[2].value) {
        pattern.status = 'CONFIRMED';
      }
    }
  }
}

function checkVolumeConfirmation(pattern: Pattern, candles: Candle[]) {
  if (!pattern || !candles || candles.length < 10) return;
  pattern.volumeConfirmed = false;

  if (!pattern.points || pattern.points.length < 2) return;

  const sortedPoints = [...pattern.points].sort((a, b) => Number(a.time) - Number(b.time));
  const firstPoint = sortedPoints[0];
  const lastPoint = sortedPoints[sortedPoints.length - 1];

  const startIndex = candles.findIndex(c => c.time === firstPoint.time);
  const endIndex = candles.findIndex(c => c.time === lastPoint.time);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) return;

  let totalVol = 0;
  for (let i = startIndex; i <= endIndex; i++) {
    totalVol += (candles[i].volume || 0);
  }
  const avgVol = totalVol / (endIndex - startIndex + 1);

  let recentVol = 0;
  let count = 0;
  for (let i = Math.max(0, candles.length - 3); i < candles.length; i++) {
    recentVol += (candles[i].volume || 0);
    count++;
  }
  const avgRecentVol = recentVol / (count || 1);

  if (avgRecentVol > avgVol * 1.2) {
    pattern.volumeConfirmed = true;
  }
}

function checkTriangleAndWedge(peaks: PipPoint[], troughs: PipPoint[]): Pattern | null {
  if (peaks.length < 2 || troughs.length < 2) return null;

  const p1 = peaks[peaks.length - 2];
  const p2 = peaks[peaks.length - 1];
  const t1 = troughs[troughs.length - 2];
  const t2 = troughs[troughs.length - 1];

  const sUpper = calculateSlope(p1, p2);
  const sLower = calculateSlope(t1, t2);

  const normUpper = sUpper / p1.value;
  const normLower = sLower / t1.value;
  const tol = 0.002;

  if (normUpper < -tol && normLower > tol) {
    const sim = Math.min(100, Math.round((Math.abs(normUpper) + Math.abs(normLower)) / 0.02 * 100));
    return {
      type: 'SYMMETRICAL_TRIANGLE',
      name: '對稱三角',
      color: '#eab308',
      points: [p1, p2, t1, t2],
      similarity: Math.max(70, sim),
      upperSlope: sUpper,
      lowerSlope: sLower,
      probability: { bullish: 50, bearish: 50 }
    };
  }

  if (normUpper < -tol && normLower < -tol && normUpper < normLower) {
    return {
      type: 'FALLING_WEDGE',
      name: '下降楔形',
      color: '#22c55e',
      points: [p1, p2, t1, t2],
      similarity: 85,
      upperSlope: sUpper,
      lowerSlope: sLower,
      probability: { bullish: 75, bearish: 25 }
    };
  }

  if (normUpper > tol && normLower > tol && normLower > normUpper) {
    return {
      type: 'RISING_WEDGE',
      name: '上升楔形',
      color: '#ef4444',
      points: [p1, p2, t1, t2],
      similarity: 85,
      upperSlope: sUpper,
      lowerSlope: sLower,
      probability: { bullish: 25, bearish: 75 }
    };
  }

  return null;
}

function checkRectangleAndFlag(peaks: PipPoint[], troughs: PipPoint[]): Pattern | null {
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

  const parallelScore = 1 - Math.abs(normUpper - normLower) / 0.01;

  if (parallelScore > 0.7) {
    if (Math.abs(normUpper) < tol && Math.abs(normLower) < tol) {
      return {
        type: 'RECTANGLE',
        name: '矩形區間',
        color: '#3b82f6',
        points: [p1, p2, t1, t2],
        similarity: Math.round(parallelScore * 100),
        probability: { bullish: 50, bearish: 50 }
      };
    }
    return {
      type: 'FLAG',
      name: '旗形整理',
      color: '#a855f7',
      points: [p1, p2, t1, t2],
      similarity: Math.round(parallelScore * 100),
      probability: { bullish: 60, bearish: 40 }
    };
  }

  return null;
}

function checkDoublePatternWithScore(peaks: PipPoint[], troughs: PipPoint[]): Pattern | null {
  const tol = 0.05;

  if (troughs.length >= 2) {
    const t1 = troughs[troughs.length - 2];
    const t2 = troughs[troughs.length - 1];
    const diff = Math.abs(t1.value - t2.value) / ((t1.value + t2.value) / 2);

    if (diff < tol) {
      const similarity = Math.round((1 - (diff / tol)) * 100);
      const relevantPeaks = peaks.filter(p => p.index > t1.index && p.index < t2.index);
      const midPeak = relevantPeaks.length > 0 ? relevantPeaks.reduce((prev, curr) => (prev.value > curr.value) ? prev : curr) : null;

      if (midPeak) {
        return {
          type: 'DOUBLE_BOTTOM',
          name: 'W底 (雙重底)',
          color: '#22c55e',
          points: [t1, midPeak, t2],
          similarity,
          neckline: midPeak.value,
          probability: { bullish: 80, bearish: 20 }
        };
      }
    }
  }

  if (peaks.length >= 2) {
    const p1 = peaks[peaks.length - 2];
    const p2 = peaks[peaks.length - 1];
    const diff = Math.abs(p1.value - p2.value) / ((p1.value + p2.value) / 2);

    if (diff < tol) {
      const similarity = Math.round((1 - (diff / tol)) * 100);
      const relevantTroughs = troughs.filter(t => t.index > p1.index && t.index < p2.index);
      const midTrough = relevantTroughs.length > 0 ? relevantTroughs.reduce((prev, curr) => (prev.value < curr.value) ? prev : curr) : null;

      if (midTrough) {
        return {
          type: 'DOUBLE_TOP',
          name: 'M頭 (雙重頂)',
          color: '#ef4444',
          points: [p1, midTrough, p2],
          similarity,
          neckline: midTrough.value,
          probability: { bullish: 20, bearish: 80 }
        };
      }
    }
  }

  return null;
}

function checkHeadAndShoulders(peaks: PipPoint[], troughs: PipPoint[]): Pattern | null {
  if (peaks.length >= 3) {
    const p1 = peaks[peaks.length - 3];
    const p2 = peaks[peaks.length - 2];
    const p3 = peaks[peaks.length - 1];
    if (p2.value > p1.value && p2.value > p3.value) {
      const shoulderDiff = Math.abs(p1.value - p3.value) / ((p1.value + p3.value) / 2);
      if (shoulderDiff < 0.05) {
        const neck1 = troughs.filter(t => t.index > p1.index && t.index < p2.index).slice(-1)[0];
        const neck2 = troughs.filter(t => t.index > p2.index && t.index < p3.index)[0];
        if (neck1 && neck2) {
          return {
            type: 'HEAD_AND_SHOULDERS',
            name: '頭肩頂',
            color: '#ef4444',
            points: [p1, neck1, p2, neck2, p3],
            similarity: Math.round((1 - shoulderDiff / 0.05) * 100),
            probability: { bullish: 20, bearish: 80 }
          };
        }
      }
    }
  }
  return null;
}

/**
 * Calculate Bullish/Bearish Probability based on multiple indicators
 */
export function calculateProbability(
  signal: { signal: string; patterns?: Pattern[] },
  trend: TrendResult,
  candles: Candle[]
): { bullish: number; bearish: number } {
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

    if (p.volumeConfirmed) {
      if (score > 50) score += 10;
      else score -= 10;
    }
    if (p.status === 'CONFIRMED') {
      if (score > 50) score += 10;
      else score -= 10;
    }
  }

  const bullish = Math.min(98, Math.max(2, Math.round(score)));
  return { bullish, bearish: 100 - bullish };
}

/**
 * Main Signal Generator
 */
export function generatePIPSignal(candles: Candle[], providedPips: PipPoint[] | null = null): PipSignal {
  if (!candles || candles.length < 20) {
    return {
      signal: 'NEUTRAL',
      text: '🟡 資料不足',
      color: '#94a3b8',
      patterns: [],
      probability: { bullish: 50, bearish: 50 }
    };
  }

  const pips = providedPips || findPIPs(candles);
  const trend = analyzeTrend(pips, candles);
  const patterns = identifyPatterns(pips, candles);

  const finalSignal: PipSignal = {
    signal: 'NEUTRAL',
    text: '⚪️ 趨勢不明',
    color: '#94a3b8',
    patterns,
    probability: { bullish: 50, bearish: 50 }
  };

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
