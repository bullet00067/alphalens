import fs from 'fs';
import path from 'path';
import { 
    findPIPs, 
    analyzeTrend, 
    evaluateEntry, 
    evaluateExit, 
    generatePIPSignal, 
    calculateATR, 
    calculateMA 
} from '../strategyEngine.js';

// Fetch stock candles from Yahoo Finance API
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

// Run backtest for a given stock between startDate and endDate
function runBacktest(ticker, name, candles, startDate, endDate) {
    console.log(`\n======================================================`);
    console.log(`🚀 開始回測: ${name} (${ticker}) [${startDate} ~ ${endDate}]`);
    console.log(`======================================================`);
    
    const startIndex = candles.findIndex(c => c.time >= startDate);
    const endIndex = candles.findIndex(c => c.time > endDate);
    const stopIndex = endIndex === -1 ? candles.length - 1 : endIndex - 1;
    
    if (startIndex === -1 || startIndex < 20) {
        console.error(`Insufficient historical data before ${startDate}`);
        return null;
    }

    let position = null; // { entryDate, entryPrice, stopLoss, tp1, tp2, qty, entryReason }
    const trades = [];
    
    // Day by day simulation
    for (let i = startIndex; i <= stopIndex; i++) {
        const currentDate = candles[i].time;
        const currentCandle = candles[i];
        
        // Window of candles up to today for strategy evaluation (last 60 bars)
        const windowCandles = candles.slice(Math.max(0, i - 60), i + 1);
        const pips = findPIPs(windowCandles, false);
        const trend = analyzeTrend(pips, windowCandles);
        const signal = generatePIPSignal(windowCandles, pips);
        
        const atr = calculateATR(windowCandles, 14) || (currentCandle.close * 0.03);

        // 1. If currently in position -> Check Exit conditions
        if (position) {
            const exitEval = evaluateExit(windowCandles, pips, position);
            
            let exitTriggered = false;
            let exitPrice = currentCandle.close;
            let exitReason = '';

            // Check hard Stop Loss (Hit during the day low)
            if (currentCandle.low <= position.stopLoss) {
                exitTriggered = true;
                exitPrice = position.stopLoss;
                exitReason = `觸發硬停損 (Stop Loss @ $${position.stopLoss})`;
            } 
            // Check TP2
            else if (currentCandle.high >= position.tp2) {
                exitTriggered = true;
                exitPrice = position.tp2;
                exitReason = `達到第二停利點 TP2 ($${position.tp2})`;
            }
            else if (exitEval) {
                exitTriggered = true;
                exitPrice = currentCandle.close;
                exitReason = `${exitEval.reason} (${exitEval.type})`;
            }

            if (exitTriggered) {
                const pnl = exitPrice - position.entryPrice;
                const pnlPct = (pnl / position.entryPrice) * 100;
                trades.push({
                    ticker,
                    entryDate: position.entryDate,
                    entryPrice: position.entryPrice,
                    exitDate: currentDate,
                    exitPrice: exitPrice,
                    pnl: pnl.toFixed(2),
                    pnlPct: pnlPct.toFixed(2) + '%',
                    entryReason: position.entryReason,
                    exitReason: exitReason,
                    holdingDays: Math.round((new Date(currentDate) - new Date(position.entryDate)) / (86400 * 1000))
                });

                console.log(`🔴 [SELL] ${currentDate} | 平倉價: $${exitPrice} | 報酬率: ${pnlPct.toFixed(2)}% | 原因: ${exitReason}`);
                position = null;
            }
        } 
        // 2. If no position -> Check Entry conditions
        else {
            const entryEval = evaluateEntry(windowCandles, pips, trend);
            
            let entryTriggered = false;
            let entryReason = '';

            const bullishScore = (signal && signal.probability) ? signal.probability.bullish : 50;
            if (entryEval) {
                entryTriggered = true;
                entryReason = `${entryEval.reason} (${entryEval.type})`;
            } else if (signal.signal === 'BUY' && bullishScore >= 65) {
                entryTriggered = true;
                entryReason = `AI多頭型態訊號 [${signal.text}] (多頭勝率 ${bullishScore}%)`;
            }

            if (entryTriggered) {
                const entryPrice = currentCandle.close;
                const stopLoss = Number((entryPrice - 2 * atr).toFixed(2));
                const tp1 = Number((entryPrice + 2 * atr).toFixed(2));
                const tp2 = Number((entryPrice + 3.5 * atr).toFixed(2));

                position = {
                    entryDate: currentDate,
                    entryPrice: entryPrice,
                    stopLoss: stopLoss,
                    tp1: tp1,
                    tp2: tp2,
                    entryReason: entryReason
                };

                console.log(`🟢 [BUY]  ${currentDate} | 進場價: $${entryPrice} | 停損設: $${stopLoss} | 理由: ${entryReason}`);
            }
        }
    }

    // If still holding at end of backtest period, mark as open position
    if (position) {
        const lastCandle = candles[stopIndex];
        const pnl = lastCandle.close - position.entryPrice;
        const pnlPct = (pnl / position.entryPrice) * 100;
        trades.push({
            ticker,
            entryDate: position.entryDate,
            entryPrice: position.entryPrice,
            exitDate: `${lastCandle.time} (期末持倉)`,
            exitPrice: lastCandle.close,
            pnl: pnl.toFixed(2),
            pnlPct: pnlPct.toFixed(2) + '%',
            entryReason: position.entryReason,
            exitReason: '期末持倉點收',
            holdingDays: Math.round((new Date(lastCandle.time) - new Date(position.entryDate)) / (86400 * 1000))
        });
        console.log(`🟡 [HOLD] ${lastCandle.time} | 期末現價: $${lastCandle.close} | 浮動報酬: ${pnlPct.toFixed(2)}%`);
    }

    // Calculate Summary Stats
    const winTrades = trades.filter(t => parseFloat(t.pnlPct) > 0);
    const winRate = trades.length > 0 ? (winTrades.length / trades.length) * 100 : 0;
    const totalReturn = trades.reduce((acc, t) => acc + parseFloat(t.pnlPct), 0);

    console.log(`\n📊 【${name} 回測統計總結】`);
    console.log(`- 總交易次數: ${trades.length} 次`);
    console.log(`- 勝率: ${winRate.toFixed(1)}% (${winTrades.length}勝 / ${trades.length - winTrades.length}敗)`);
    console.log(`- 累積算術報酬率: ${totalReturn.toFixed(2)}%`);
    
    return { name, ticker, trades, winRate, totalReturn };
}

async function main() {
    try {
        const phisonCandles = await fetchYahooData('8299.TWO');
        const marketechCandles = await fetchYahooData('6196.TW');
        
        const resPhison = runBacktest('8299.TWO', '群聯', phisonCandles, '2026-04-01', '2026-08-31');
        const resMarketech = runBacktest('6196.TW', '帆宣', marketechCandles, '2026-04-01', '2026-08-31');
        
        const scratchDir = path.join(process.cwd(), 'scratch');
        if (!fs.existsSync(scratchDir)) {
            fs.mkdirSync(scratchDir, { recursive: true });
        }

        const summary = {
            phison: resPhison,
            marketech: resMarketech,
            timestamp: new Date().toISOString()
        };

        fs.writeFileSync(path.join(scratchDir, 'backtest_results.json'), JSON.stringify(summary, null, 2));
        console.log("\n✅ 回測結果已寫入 scratch/backtest_results.json");
    } catch (e) {
        console.error("Backtest execution failed:", e);
    }
}

main();
