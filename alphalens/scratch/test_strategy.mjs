import { findPIPs, analyzeTrend, generatePIPSignal } from '../strategyEngine.js';

// Mock Bullish Series
const bullishSeries = [
    { time: '2023-01-01', close: 100, volume: 1000 },
    { time: '2023-01-02', close: 105, volume: 1100 },
    { time: '2023-01-03', close: 102, volume: 900 },
    { time: '2023-01-04', close: 110, volume: 1200 },
    { time: '2023-01-05', close: 108, volume: 1000 },
    { time: '2023-01-06', close: 115, volume: 1300 },
    { time: '2023-01-07', close: 112, volume: 1100 },
    { time: '2023-01-08', close: 120, volume: 1500 },
];

// Mock Consolidation Series (More points)
const consolidationSeries = Array.from({ length: 30 }, (_, i) => ({
    time: `2023-01-${i+1}`,
    close: 100 + Math.sin(i) * 2, // Oscillating around 100
    volume: 1000 + Math.random() * 200,
    open: 100,
    high: 103,
    low: 97
}));

console.log("--- Testing Bullish Series ---");
const bullishPips = findPIPs(bullishSeries, false);
const bullishTrend = analyzeTrend(bullishPips);
console.log("Trend Status:", bullishTrend.status);
console.log("Confidence:", bullishTrend.confidence);

console.log("\n--- Testing Consolidation Series ---");
const consPips = findPIPs(consolidationSeries, false);
const consTrend = analyzeTrend(consPips);
console.log("Trend Status:", consTrend.status);
console.log("Confidence:", consTrend.confidence);

const signal = generatePIPSignal(consolidationSeries);
console.log("Signal:", signal.text);
