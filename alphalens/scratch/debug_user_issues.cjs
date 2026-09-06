const puppeteer = require('puppeteer');

(async () => {
    console.log("=== STARTING USER BUG VERIFICATION ===");
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const logs = [];
    page.on('console', msg => {
        logs.push(`[${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', err => {
        logs.push(`[PAGE ERROR] ${err.toString()}`);
    });

    await page.goto('http://localhost:5173/');
    await new Promise(r => setTimeout(r, 2000));

    // ----------------------------------------------------
    // TEST ISSUE 2: 市場＆大盤 輸入 6196 新增自選
    // ----------------------------------------------------
    console.log("\n--- Testing Issue 2: MarketDashboard Add 6196 ---");
    // Ensure on MarketDashboard tab
    const addInput = await page.$('input[placeholder*="新增自選代號"]');
    if (addInput) {
        await addInput.click();
        await addInput.type('6196');
        // Click Add button
        const submitBtn = await page.$('form button[type="submit"]');
        if (submitBtn) await submitBtn.click();
        
        console.log("Submitted 6196 to watchlist, waiting 4s for fetch...");
        await new Promise(r => setTimeout(r, 4000));

        // Check watchlist items
        const watchlistItems = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('ul li'));
            return items.map(li => li.innerText.replace(/\n+/g, ' | '));
        });
        console.log("Watchlist items now:", watchlistItems);
    } else {
        console.log("Could not find addInput on dashboard");
    }

    // ----------------------------------------------------
    // TEST ISSUE 1: 交易計畫儀表板 輸入搜尋代號
    // ----------------------------------------------------
    console.log("\n--- Testing Issue 1: Trading Plan Dashboard Search Bar ---");
    // Switch to Trading Plan Dashboard
    const navButtons = await page.$$('nav button');
    for (const btn of navButtons) {
        const text = await page.evaluate(el => el.innerText, btn);
        if (text.includes('交易計畫儀表板')) {
            await btn.click();
            break;
        }
    }
    await new Promise(r => setTimeout(r, 1500));

    // Find the search input in DashboardHeader
    const searchInput = await page.$('header input[placeholder*="搜尋代號"]');
    if (searchInput) {
        console.log("Found DashboardHeader search input! Typing 6196 and pressing Enter...");
        await searchInput.click({ clickCount: 3 });
        await searchInput.type('6196');
        await page.keyboard.press('Enter');

        console.log("Pressed Enter, waiting 4s...");
        await new Promise(r => setTimeout(r, 4000));

        const headerTitle = await page.evaluate(() => {
            const h1 = document.querySelector('header h1');
            return h1 ? h1.innerText : 'NOT FOUND';
        });
        console.log("Dashboard Header Title after searching 6196:", headerTitle);
    } else {
        console.log("DashboardHeader search input NOT found!");
    }

    console.log("\n--- BROWSER CONSOLE LOGS ---");
    console.log(logs.slice(-25).join('\n'));

    await browser.close();
    console.log("\n=== COMPLETED BUG VERIFICATION ===");
})();
