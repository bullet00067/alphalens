import fs from 'fs';
import path from 'path';
import { 
    findPIPs, 
    analyzeTrend, 
    evaluateEntry, 
    evaluateExit, 
    evaluateEnhancedEntry, 
    evaluateEnhancedExit, 
    evaluateMarketRegime, 
    aggregateToWeeklyCandles, 
    calculateATR, 
    calculateMA, 
    generatePIPSignal 
} from '../strategyEngine.js';

const scratchDir = path.join(process.cwd(), 'scratch');

async function fetchYahooData(ticker) {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=2y`;
    const res = await fetch(url);
    const json = await res.json();
    
    if (!json.chart || !json.chart.result || json.chart.result.length === 0) {
        throw new Error(`Failed to fetch data for ${ticker}`);
    }
    
    const result = json.chart.result[0];
    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    
    const candles = [];
    for (let i = 0; i < timestamps.length; i++) {
        if (quotes.open[i] != null && quotes.close[i] != null && quotes.high[i] != null && quotes.low[i] != null) {
            const dateStr = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
            candles.push({
                time: dateStr,
                timestamp: timestamps[i],
                open: Number(quotes.open[i].toFixed(2)),
                high: Number(quotes.high[i].toFixed(2)),
                low: Number(quotes.low[i].toFixed(2)),
                close: Number(quotes.close[i].toFixed(2)),
                volume: quotes.volume[i] || 0
            });
        }
    }
    return candles;
}

// Transaction cost: 0.1425% * 0.6 buy, 0.1425% * 0.6 + 0.3% tax sell => ~0.471%
const TRANSACTION_FEE_PCT = 0.471;

function runStrategy({
    ticker,
    name,
    stockCandles,
    marketCandles,
    startDate,
    endDate,
    isEvolved = false
}) {
    const startIndex = stockCandles.findIndex(c => c.time >= startDate);
    const endIndex = stockCandles.findIndex(c => c.time > endDate);
    const stopIndex = endIndex === -1 ? stockCandles.length - 1 : endIndex - 1;

    let position = null;
    const trades = [];
    let cooldownDays = 0;
    let consecutiveLosses = 0;

    for (let i = startIndex; i <= stopIndex; i++) {
        const currentDate = stockCandles[i].time;
        const currentCandle = stockCandles[i];
        
        if (cooldownDays > 0) cooldownDays--;

        const windowCandles = stockCandles.slice(Math.max(0, i - 60), i + 1);
        const pips = findPIPs(windowCandles, false);
        const trend = analyzeTrend(pips, windowCandles);
        const signal = generatePIPSignal(windowCandles, pips);
        const atr = calculateATR(windowCandles, 14) || (currentCandle.close * 0.03);

        // Prepare market regime and weekly candles if evolved
        let marketRegime = 'BULLISH';
        let weeklyCandles = [];
        if (isEvolved) {
            const mktIdx = marketCandles.findIndex(c => c.time === currentDate);
            if (mktIdx !== -1) {
                const mktWindow = marketCandles.slice(Math.max(0, mktIdx - 60), mktIdx + 1);
                marketRegime = evaluateMarketRegime(mktWindow).regime;
            }
            weeklyCandles = aggregateToWeeklyCandles(windowCandles);
        }

        // 1. Position Management / Exit Check
        if (position) {
            let exitTriggered = false;
            let exitPrice = currentCandle.close;
            let exitReason = '';

            if (isEvolved) {
                // Check TP2 first
                if (currentCandle.high >= position.tp2) {
                    exitTriggered = true;
                    exitPrice = position.tp2;
                    exitReason = `達到目標停利點 TP2 ($${position.tp2})`;
                } else {
                    const exitEval = evaluateEnhancedExit(windowCandles, pips, position);
                    if (exitEval) {
                        exitTriggered = true;
                        exitPrice = exitEval.price;
                        exitReason = exitEval.reason;
                    }
                }
            } else {
                // Baseline Exit
                if (currentCandle.low <= position.stopLoss) {
                    exitTriggered = true;
                    exitPrice = position.stopLoss;
                    exitReason = `觸發硬停損 ($${position.stopLoss})`;
                } else if (currentCandle.high >= position.tp2) {
                    exitTriggered = true;
                    exitPrice = position.tp2;
                    exitReason = `達到第二停利點 TP2 ($${position.tp2})`;
                } else {
                    const exitEval = evaluateExit(windowCandles, pips, position);
                    if (exitEval) {
                        exitTriggered = true;
                        exitPrice = currentCandle.close;
                        exitReason = `${exitEval.reason} (${exitEval.type})`;
                    }
                }
            }

            if (exitTriggered) {
                const grossPnl = exitPrice - position.entryPrice;
                const grossPct = (grossPnl / position.entryPrice) * 100;
                const netPct = grossPct - TRANSACTION_FEE_PCT;

                trades.push({
                    entryDate: position.entryDate,
                    entryPrice: position.entryPrice,
                    exitDate: currentDate,
                    exitPrice,
                    grossPct: Number(grossPct.toFixed(2)),
                    netPct: Number(netPct.toFixed(2)),
                    reason: exitReason,
                    entryReason: position.entryReason
                });

                if (grossPct < 0) {
                    consecutiveLosses++;
                    if (isEvolved && consecutiveLosses >= 2) {
                        cooldownDays = 3; // 3-day cooldown after 2 losses
                        consecutiveLosses = 0;
                    }
                } else {
                    consecutiveLosses = 0;
                }

                position = null;
            }
        } 
        // 2. Entry Check
        else {
            let entryTriggered = false;
            let entryReason = '';

            if (isEvolved) {
                const enhancedEntry = evaluateEnhancedEntry(windowCandles, pips, trend, {
                    marketRegime,
                    weeklyCandles,
                    cooldownRemaining: cooldownDays
                });

                // Bottom reversal patterns (Falling Wedge, Double Bottom) are allowed even if market is cautious/bearish if probability >= 80%
                const isBottomReversal = signal.patterns && signal.patterns.length > 0 && 
                    ['FALLING_WEDGE', 'DOUBLE_BOTTOM'].includes(signal.patterns[0].type);

                if (enhancedEntry) {
                    entryTriggered = true;
                    entryReason = enhancedEntry.reason;
                } else if (signal.signal === 'BUY' && signal.probability.bullish >= 80 && isBottomReversal && cooldownDays === 0) {
                    entryTriggered = true;
                    entryReason = `底部強反轉型態 [${signal.text}] (多頭勝率: ${signal.probability.bullish}%)`;
                } else if (signal.signal === 'BUY' && signal.probability.bullish >= 75 && marketRegime !== 'BEARISH' && cooldownDays === 0) {
                    entryTriggered = true;
                    entryReason = `高確信度AI型態 [${signal.text}] (多頭勝率: ${signal.probability.bullish}%)`;
                }
            } else {
                // Baseline Entry
                const entryEval = evaluateEntry(windowCandles, pips, trend);
                if (entryEval) {
                    entryTriggered = true;
                    entryReason = `${entryEval.reason} (${entryEval.type})`;
                } else if (signal.signal === 'BUY' && signal.probability.bullish >= 65) {
                    entryTriggered = true;
                    entryReason = `AI型態 [${signal.text}] (多頭勝率: ${signal.probability.bullish}%)`;
                }
            }

            if (entryTriggered) {
                const entryPrice = currentCandle.close;
                const stopLoss = Number((entryPrice - 2 * atr).toFixed(2));
                const tp1 = Number((entryPrice + 2 * atr).toFixed(2));
                const tp2 = Number((entryPrice + 3.5 * atr).toFixed(2));

                position = {
                    entryDate: currentDate,
                    entryPrice,
                    stopLoss,
                    tp1,
                    tp2,
                    entryReason,
                    highestHigh: entryPrice,
                    lockState: 'NORMAL'
                };
            }
        }
    }

    // Unclosed trade at end
    if (position) {
        const lastCandle = stockCandles[stopIndex];
        const grossPnl = lastCandle.close - position.entryPrice;
        const grossPct = (grossPnl / position.entryPrice) * 100;
        const netPct = grossPct - (TRANSACTION_FEE_PCT / 2); // only buy fee incurred yet
        trades.push({
            entryDate: position.entryDate,
            entryPrice: position.entryPrice,
            exitDate: `${lastCandle.time} (期末未平倉)`,
            exitPrice: lastCandle.close,
            grossPct: Number(grossPct.toFixed(2)),
            netPct: Number(netPct.toFixed(2)),
            reason: '期末持倉點收',
            entryReason: position.entryReason
        });
    }

    const wins = trades.filter(t => t.netPct > 0);
    const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
    const grossReturn = trades.reduce((sum, t) => sum + t.grossPct, 0);
    const netReturn = trades.reduce((sum, t) => sum + t.netPct, 0);
    const grossProfit = trades.filter(t => t.grossPct > 0).reduce((sum, t) => sum + t.grossPct, 0);
    const grossLoss = Math.abs(trades.filter(t => t.grossPct < 0).reduce((sum, t) => sum + t.grossPct, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit;

    return {
        name,
        ticker,
        version: isEvolved ? 'v2.0 (進化版)' : 'v1.0 (基準版)',
        totalTrades: trades.length,
        winRate: Number(winRate.toFixed(1)),
        grossReturn: Number(grossReturn.toFixed(2)),
        netReturn: Number(netReturn.toFixed(2)),
        profitFactor: Number(profitFactor.toFixed(2)),
        trades
    };
}

async function main() {
    console.log("📥 下載股票與加權指數歷史數據...");
    const [phisonCandles, marketechCandles, twiiCandles] = await Promise.all([
        fetchYahooData('8299.TWO'),
        fetchYahooData('6196.TW'),
        fetchYahooData('^TWII')
    ]);

    const start = '2026-04-01';
    const end = '2026-08-31';

    // 1. Phison Comparison
    const phisonBaseline = runStrategy({
        ticker: '8299.TWO',
        name: '群聯',
        stockCandles: phisonCandles,
        marketCandles: twiiCandles,
        startDate: start,
        endDate: end,
        isEvolved: false
    });

    const phisonEvolved = runStrategy({
        ticker: '8299.TWO',
        name: '群聯',
        stockCandles: phisonCandles,
        marketCandles: twiiCandles,
        startDate: start,
        endDate: end,
        isEvolved: true
    });

    // 2. Marketech Comparison
    const marketechBaseline = runStrategy({
        ticker: '6196.TW',
        name: '帆宣',
        stockCandles: marketechCandles,
        marketCandles: twiiCandles,
        startDate: start,
        endDate: end,
        isEvolved: false
    });

    const marketechEvolved = runStrategy({
        ticker: '6196.TW',
        name: '帆宣',
        stockCandles: marketechCandles,
        marketCandles: twiiCandles,
        startDate: start,
        endDate: end,
        isEvolved: true
    });

    const results = {
        period: `${start} ~ ${end}`,
        phison: {
            baseline: phisonBaseline,
            evolved: phisonEvolved
        },
        marketech: {
            baseline: marketechBaseline,
            evolved: marketechEvolved
        }
    };

    fs.writeFileSync(path.join(scratchDir, 'comparison_results.json'), JSON.stringify(results, null, 2));

    console.log("\n==========================================================================");
    console.log("📈【群聯 (8299) 基準版 v1.0 vs 進化版 v2.0 對比】");
    console.log("--------------------------------------------------------------------------");
    console.table([
        { 版本: phisonBaseline.version, 交易次數: phisonBaseline.totalTrades, 勝率: `${phisonBaseline.winRate}%`, 毛報酬率: `${phisonBaseline.grossReturn}%`, 淨報酬率: `${phisonBaseline.netReturn}%`, 獲利因子: phisonBaseline.profitFactor },
        { 版本: phisonEvolved.version, 交易次數: phisonEvolved.totalTrades, 勝率: `${phisonEvolved.winRate}%`, 毛報酬率: `${phisonEvolved.grossReturn}%`, 淨報酬率: `${phisonEvolved.netReturn}%`, 獲利因子: phisonEvolved.profitFactor }
    ]);

    console.log("\n==========================================================================");
    console.log("📈【帆宣 (6196) 基準版 v1.0 vs 進化版 v2.0 對比】");
    console.log("--------------------------------------------------------------------------");
    console.table([
        { 版本: marketechBaseline.version, 交易次數: marketechBaseline.totalTrades, 勝率: `${marketechBaseline.winRate}%`, 毛報酬率: `${marketechBaseline.grossReturn}%`, 淨報酬率: `${marketechBaseline.netReturn}%`, 獲利因子: marketechBaseline.profitFactor },
        { 版本: marketechEvolved.version, 交易次數: marketechEvolved.totalTrades, 勝率: `${marketechEvolved.winRate}%`, 毛報酬率: `${marketechEvolved.grossReturn}%`, 淨報酬率: `${marketechEvolved.netReturn}%`, 獲利因子: marketechEvolved.profitFactor }
    ]);
    console.log("==========================================================================");
}

main().catch(console.error);
