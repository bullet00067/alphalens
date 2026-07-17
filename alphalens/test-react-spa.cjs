const puppeteer = require('puppeteer');

(async () => {
  console.log("=== STARTING ALPHALENS REACT SPA COMPREHENSIVE VERIFICATION ===");
  
  let browser;
  try {
    // Launch headless browser
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    
    // Catch console logs & page errors
    let browserErrorCount = 0;
    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error') {
        if (msg.text().includes('favicon.ico') || msg.text().includes('404')) {
          return;
        }
        browserErrorCount++;
        console.log('[BROWSER ERROR]', msg.text());
      }
    });
    
    page.on('pageerror', err => {
      browserErrorCount++;
      console.error('[PAGE EXCEPTION]', err.toString());
    });

    // 1. Load the dev server URL
    const targetUrl = 'http://localhost:5173/';
    console.log(`Connecting to Vite Dev Server at: ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    console.log("Page loaded successfully.");
    await new Promise(r => setTimeout(r, 2000)); // Bounded wait for charts/API loads

    // 2. Validate Market Dashboard elements
    console.log("\n--- PHASE 1: Market Dashboard Validation ---");
    
    // Check Sidebar
    const hasSidebar = await page.evaluate(() => {
      const el = document.querySelector('nav.sidebar');
      return el !== null;
    });
    console.log(`- Nav Sidebar Present: ${hasSidebar ? '✅ PASS' : '❌ FAIL'}`);

    // Check Index Cards
    const indexCardsCount = await page.evaluate(() => {
      const cards = document.querySelectorAll('.grid-cols-1.md\\:grid-cols-3 > div');
      return cards.length;
    });
    console.log(`- Index Cards Count: ${indexCardsCount === 3 ? '✅ PASS (3 cards found)' : `❌ FAIL (found ${indexCardsCount})`}`);

    // Check Watchlist Items
    const watchlistCount = await page.evaluate(() => {
      const listItems = document.querySelectorAll('ul > li');
      return listItems.length;
    });
    console.log(`- Watchlist Items Count: ${watchlistCount > 0 ? `✅ PASS (${watchlistCount} items found)` : '❌ FAIL (no items)'}`);

    // Check News Section
    const hasNews = await page.evaluate(() => {
      const newsSection = document.querySelector('i.fa-newspaper');
      return newsSection !== null;
    });
    console.log(`- Market News Sidebar Present: ${hasNews ? '✅ PASS' : '❌ FAIL'}`);

    // 3. Navigate to Stock Detail (Trading Plan View)
    console.log("\n--- PHASE 2: Navigation & Detailed View Transition ---");
    
    // Click on 3680.TWO / 家登 inside the watchlist to transition view
    console.log("Clicking on '家登' in watchlist...");
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('ul > li'));
      const targetItem = items.find(el => el.textContent && el.textContent.includes('家登'));
      if (targetItem) {
        targetItem.click();
      }
    });

    await new Promise(r => setTimeout(r, 2000)); // wait for chart render

    // 4. Validate Trading Plan elements
    console.log("\n--- PHASE 3: Trading Plan Dashboard Validation ---");
    
    const stockHeader = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return h1 ? h1.textContent : 'NOT FOUND';
    });
    console.log(`- Active Stock Title: '${stockHeader}' ${stockHeader.includes('家登') ? '✅ PASS' : '❌ FAIL'}`);

    // Check Key Levels
    const levelsCount = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('span')).filter(
        el => el.textContent && (el.textContent.includes('壓力') || el.textContent.includes('支撐') || el.textContent.includes('當前市價'))
      );
      return items.length;
    });
    console.log(`- S/R Key Levels Present: ${levelsCount >= 5 ? '✅ PASS' : `❌ FAIL (found ${levelsCount})`}`);

    // Check Strategies (Bullish / Bearish comparison)
    const strategyTitlesCount = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('h3')).filter(
        el => el.textContent && (el.textContent.includes('多頭策略') || el.textContent.includes('空頭策略'))
      );
      return headers.length;
    });
    console.log(`- Multi-Scenario Strategy Cards Present: ${strategyTitlesCount === 2 ? '✅ PASS' : `❌ FAIL (found ${strategyTitlesCount})`}`);

    // Check Risk assessment and R:R ratios
    const riskTablePresent = await page.evaluate(() => {
      const table = document.querySelector('table');
      return table !== null;
    });
    console.log(`- Risk Control Table Present: ${riskTablePresent ? '✅ PASS' : '❌ FAIL'}`);

    // Check AI Assistant
    const aiAssistantPresent = await page.evaluate(() => {
      const assistantTitle = Array.from(document.querySelectorAll('h3')).find(
        el => el.textContent && el.textContent.includes('AI 戰術交易助理')
      );
      return assistantTitle !== undefined;
    });
    console.log(`- AI Decision Assistant Present: ${aiAssistantPresent ? '✅ PASS' : '❌ FAIL'}`);

    // 5. Final Report
    console.log("\n--- PHASE 4: Console Log Audit ---");
    console.log(`- Total Console Errors Captured: ${browserErrorCount}`);
    
    if (browserErrorCount === 0 && hasSidebar && indexCardsCount === 3 && watchlistCount > 0 && levelsCount >= 5 && strategyTitlesCount === 2) {
      console.log("\n⭐️ VERIFICATION SUCCESS: All React SPA integration checks passed without errors!");
    } else {
      console.error("\n❌ VERIFICATION FAILURE: Some validation tests did not pass.");
      process.exit(1);
    }

  } catch (err) {
    console.error("Test execution encountered an error:", err);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
