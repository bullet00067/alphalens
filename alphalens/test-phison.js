const puppeteer = require('puppeteer');

(async () => {
    console.log("=== STARTING DUAL-SCENARIO STOP LOSS & REAL-TIME PNL VERIFICATION ===");
    
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Listen for browser console logs
    page.on('console', msg => {
        console.log('[BROWSER CONSOLE]', msg.text());
    });

    // 1. Go to page
    await page.goto('http://localhost:5173/');
    
    // Wait until window.updateAISignals is loaded
    await page.waitForFunction(() => typeof window.updateAISignals === 'function', { timeout: 10000 });

    // 2. Inject Mock Portfolio and run calculations for Scenario B (Phison Trailing Profit-Lock)
    console.log("\n--- TEST CASE 1: Phison Trailing Profit-Lock Scenario ---");
    const scenarioBResult = await page.evaluate(() => {
        // Set mock portfolio in local storage
        const mockPortfolio = [{ ticker: '8299.TWO', cost: 2185, qty: 1000 }];
        localStorage.setItem('myPortfolio', JSON.stringify(mockPortfolio));
        
        // Reload currentPortfolio from local storage
        window.currentPortfolio = mockPortfolio;

        // Mock calculateAISignals to return exactly the Phison scenario
        window.calculateAISignals = function(ticker, candles) {
            const entryPrice = 2185;
            const currentPrice = 2335;
            const stopLoss = 2468;
            const tp1 = 2512;
            const tp2 = 2731;
            const qty = 1000;
            
            const realtimePnl = qty * (currentPrice - entryPrice); // 150,000
            const realtimePnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100; // 6.86%
            const expectedPnl = qty * (stopLoss - entryPrice); // 283,000
            const expectedPnlPercent = ((stopLoss - entryPrice) / entryPrice) * 100; // 12.95%

            const slImpact = qty * (stopLoss - entryPrice);
            const tp1Impact = qty * (tp1 - entryPrice);
            const tp2Impact = qty * (tp2 - entryPrice);

            return {
                atr: "50.00",
                stopLoss: stopLoss.toFixed(2),
                tp1: tp1.toFixed(2),
                tp2: tp2.toFixed(2),
                slImpact: slImpact.toFixed(0),
                tp1Impact: tp1Impact.toFixed(0),
                tp2Impact: tp2Impact.toFixed(0),
                inPortfolio: true,
                entryPrice: entryPrice.toFixed(2),
                currentPrice: currentPrice,
                trend: { status: 'UPTREND' },
                signal: { signal: 'BUY', color: '#10b981', text: 'BUY', details: { reason: 'Bullish breakout' } },
                rrRatio1: '1:2.5',
                rrRatio2: '1:3.5',
                entrySignal: null,
                exitSignal: null,
                qty: qty,
                realtimePnl: realtimePnl.toFixed(0),
                realtimePnlPercent: realtimePnlPercent.toFixed(2),
                expectedPnl: expectedPnl.toFixed(0),
                expectedPnlPercent: expectedPnlPercent.toFixed(2),
                recentHigh: 2800,
                trailingPct: "4.5",
                trailingStop: 2468,
                isTrailingInProfit: true,
                trailingLockedPnl: (qty * (2468 - 2185)).toFixed(0)
            };
        };

        // Render detail view layout
        switchView('stock-detail-view');
        
        // Call updateAISignals to render Phison cards & alert banner
        updateAISignals('8299.TWO', [{ close: 2335 }]);

        // Extract UI elements for validation
        const alertBanner = document.querySelector('.alert-banner');
        const alertText = alertBanner ? alertBanner.textContent : 'NOT FOUND';
        const alertClass = alertBanner ? alertBanner.className : 'NOT FOUND';
        
        const strategyCard = document.getElementById('ai-signal-card');
        const cardHtml = strategyCard ? strategyCard.innerHTML : 'NOT FOUND';
        const isVisible = strategyCard && strategyCard.style.display !== 'none';

        return {
            isVisible,
            alertText,
            alertClass,
            cardHtml
        };
    });

    console.log("AI Strategy Card Visible:", scenarioBResult.isVisible);
    console.log("Alert Banner Class:", scenarioBResult.alertClass);
    console.log("Alert Banner Text:", scenarioBResult.alertText.replace(/\s+/g, ' ').trim());
    
    // Check if the profit lock alert displays correctly
    if (scenarioBResult.alertClass.includes('profit-lock') && scenarioBResult.alertText.includes('移動鎖利已觸發')) {
        console.log("✅ Scenario B (Trailing Profit-Lock) Banner verified successfully!");
    } else {
        console.error("❌ Scenario B (Trailing Profit-Lock) Banner check FAILED.");
    }

    // Check if real-time P/L and expected stop P/L display correctly
    if (scenarioBResult.cardHtml.includes('+NT$150,000') || scenarioBResult.cardHtml.includes('+NT$ 150,000') || scenarioBResult.cardHtml.includes('150,000')) {
        console.log("✅ Scenario B Real-Time P/L displays correctly (+NT$ 150,000)!");
    } else {
        console.error("❌ Scenario B Real-Time P/L check FAILED.");
    }
    
    if (scenarioBResult.cardHtml.includes('+NT$283,000') || scenarioBResult.cardHtml.includes('+NT$ 283,000') || scenarioBResult.cardHtml.includes('283,000')) {
        console.log("✅ Scenario B Expected Stop P/L displays correctly (+NT$ 283,000)!");
    } else {
        console.error("❌ Scenario B Expected Stop P/L check FAILED.");
    }


    // 3. Run Scenario A (Discipline Stop Loss: price dropped below stop-loss which is below cost)
    console.log("\n--- TEST CASE 2: Discipline Stop-Loss Scenario ---");
    const scenarioAResult = await page.evaluate(() => {
        // Mock calculateAISignals to return Discipline Stop Loss
        window.calculateAISignals = function(ticker, candles) {
            const entryPrice = 2185;
            const currentPrice = 1900;
            const stopLoss = 2000; // Stop Loss below cost
            const tp1 = 2512;
            const tp2 = 2731;
            const qty = 1000;
            
            const realtimePnl = qty * (currentPrice - entryPrice); // -285,000
            const realtimePnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100; // -13.04%
            const expectedPnl = qty * (stopLoss - entryPrice); // -185,000
            const expectedPnlPercent = ((stopLoss - entryPrice) / entryPrice) * 100; // -8.47%

            const slImpact = qty * (stopLoss - entryPrice);
            const tp1Impact = qty * (tp1 - entryPrice);
            const tp2Impact = qty * (tp2 - entryPrice);

            return {
                atr: "50.00",
                stopLoss: stopLoss.toFixed(2),
                tp1: tp1.toFixed(2),
                tp2: tp2.toFixed(2),
                slImpact: slImpact.toFixed(0),
                tp1Impact: tp1Impact.toFixed(0),
                tp2Impact: tp2Impact.toFixed(0),
                inPortfolio: true,
                entryPrice: entryPrice.toFixed(2),
                currentPrice: currentPrice,
                trend: { status: 'DOWNTREND' },
                signal: { signal: 'SELL', color: '#ef4444', text: 'SELL', details: { reason: 'Stop loss breached' } },
                rrRatio1: '1:2.5',
                rrRatio2: '1:3.5',
                entrySignal: null,
                exitSignal: null,
                qty: qty,
                realtimePnl: realtimePnl.toFixed(0),
                realtimePnlPercent: realtimePnlPercent.toFixed(2),
                expectedPnl: expectedPnl.toFixed(0),
                expectedPnlPercent: expectedPnlPercent.toFixed(2),
                recentHigh: 2185,
                trailingPct: "4.5",
                trailingStop: 2000,
                isTrailingInProfit: false,
                trailingLockedPnl: (qty * (2000 - 2185)).toFixed(0)
            };
        };

        // Render detail view layout
        switchView('stock-detail-view');
        
        // Call updateAISignals to render Phison cards & alert banner
        updateAISignals('8299.TWO', [{ close: 1900 }]);

        const alertBanner = document.querySelector('.alert-banner');
        const alertText = alertBanner ? alertBanner.textContent : 'NOT FOUND';
        const alertClass = alertBanner ? alertBanner.className : 'NOT FOUND';

        return {
            alertText,
            alertClass
        };
    });

    console.log("Alert Banner Class:", scenarioAResult.alertClass);
    console.log("Alert Banner Text:", scenarioAResult.alertText.replace(/\s+/g, ' ').trim());

    if (scenarioAResult.alertClass.includes('discipline-sl') && scenarioAResult.alertText.includes('紀律停損已觸發')) {
        console.log("✅ Scenario A (Discipline Stop Loss) Banner verified successfully!");
    } else {
        console.error("❌ Scenario A (Discipline Stop Loss) Banner check FAILED.");
    }

    console.log("\n=== ALL MOCK VERIFICATIONS COMPLETED ===");
    await browser.close();
})();
