const puppeteer = require('puppeteer');

(async () => {
    console.log("=== RUNNING COMPLETE VERIFICATION SCRIPT ===");
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const errors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => {
        errors.push(err.toString());
    });

    await page.goto('http://localhost:5173/');
    await new Promise(r => setTimeout(r, 1500));

    // 1. Switch to Trading Plan Dashboard
    console.log("\n[TEST 1] Switching to 交易計畫儀表板...");
    const navButtons = await page.$$('nav button');
    for (const btn of navButtons) {
        const text = await page.evaluate(el => el.innerText, btn);
        if (text.includes('交易計畫儀表板')) {
            await btn.click();
            break;
        }
    }
    await new Promise(r => setTimeout(r, 1500));

    // Verify DashboardHeader rendered
    const initialHeader = await page.evaluate(() => {
        const h1 = document.querySelector('header h1');
        return h1 ? h1.innerText.replace(/\n+/g, ' ') : null;
    });
    console.log("Initial Dashboard Title:", initialHeader);

    // 2. Search '6196' in Trading Plan Dashboard
    console.log("\n[TEST 2] Typing '6196' into search input...");
    const searchInput = await page.$('header input[placeholder*="搜尋代號"]');
    if (searchInput) {
        await searchInput.click();
        await searchInput.type('6196');
        await new Promise(r => setTimeout(r, 500));

        // Check autocomplete suggestions
        const suggestions = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('header form button'));
            return btns.map(b => b.innerText.replace(/\n+/g, ' '));
        });
        console.log("Autocomplete suggestions visible:", suggestions);

        // Click the search button (magnifying glass)
        const searchBtn = await page.$('header form button[type="submit"]');
        if (searchBtn) {
            console.log("Clicking magnifying glass search button...");
            await searchBtn.click();
        } else {
            await page.keyboard.press('Enter');
        }

        await new Promise(r => setTimeout(r, 3500));
        const updatedHeader = await page.evaluate(() => {
            const h1 = document.querySelector('header h1');
            return h1 ? h1.innerText.replace(/\n+/g, ' ') : null;
        });
        console.log("Updated Dashboard Title after searching 6196:", updatedHeader);
    }

    // 3. Search '帆宣' (Chinese name)
    console.log("\n[TEST 3] Typing Chinese '帆宣' into search input...");
    if (searchInput) {
        await searchInput.click();
        await page.keyboard.down('Meta');
        await page.keyboard.press('KeyA');
        await page.keyboard.up('Meta');
        await page.keyboard.press('Backspace');

        await searchInput.type('帆宣');
        await new Promise(r => setTimeout(r, 500));
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 3000));

        const chineseSearchHeader = await page.evaluate(() => {
            const h1 = document.querySelector('header h1');
            return h1 ? h1.innerText.replace(/\n+/g, ' ') : null;
        });
        console.log("Dashboard Title after searching Chinese '帆宣':", chineseSearchHeader);
    }

    // 4. Test Watchlist in MarketDashboard
    console.log("\n[TEST 4] Testing 市場大盤 & 自選 Watchlist...");
    for (const btn of navButtons) {
        const text = await page.evaluate(el => el.innerText, btn);
        if (text.includes('市場大盤 & 自選')) {
            await btn.click();
            break;
        }
    }
    await new Promise(r => setTimeout(r, 1500));

    const addInput = await page.$('input[placeholder*="新增自選代號"]');
    if (addInput) {
        await addInput.click();
        await addInput.type('6196');
        await new Promise(r => setTimeout(r, 500));

        const addDropdown = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('form button'));
            return items.map(b => b.innerText.replace(/\n+/g, ' '));
        });
        console.log("Add Watchlist autocomplete options:", addDropdown);

        const addBtn = await page.$('form button[type="submit"]');
        if (addBtn) await addBtn.click();
        await new Promise(r => setTimeout(r, 3000));

        const watchlistData = await page.evaluate(() => {
            const lis = Array.from(document.querySelectorAll('ul li'));
            return lis.map(li => li.innerText.replace(/\n+/g, ' | ')).filter(t => t.includes('6196'));
        });
        console.log("Watchlist items with 6196:", watchlistData);
    }

    console.log("\n[ERRORS RECORDED]:", errors.length === 0 ? "NONE (ALL CLEAN!)" : errors);

    await browser.close();
    console.log("\n=== VERIFICATION FINISHED ===");
})();
