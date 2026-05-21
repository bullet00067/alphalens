const puppeteer = require('puppeteer');

(async () => {
    console.log("=== STARTING REAL TW STOCK DEBUGGING ===");
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Catch all browser logs
    page.on('console', msg => {
        console.log(`[BROWSER LOG (${msg.type().toUpperCase()})]`, msg.text());
    });

    page.on('pageerror', err => {
        console.error('[BROWSER EXCEPTION]', err.stack || err.toString());
    });

    page.on('requestfailed', request => {
        console.error('[REQUEST FAILED]', request.url(), request.failure().errorText);
    });

    // Mock FinMind Rate Limit / Failure in simulation
    await page.setRequestInterception(true);
    page.on('request', request => {
        const url = request.url();
        if (url.includes('/finmind')) {
            console.log('[API BLOCKED (Simulating 402)]', url);
            request.respond({
                status: 402,
                contentType: 'application/json',
                body: JSON.stringify({ msg: "Requests reach the upper limit", status: 402 })
            });
        } else {
            if (url.includes('/twse') || url.includes('/yahoo')) {
                console.log('[API REQUEST]', url);
            }
            request.continue();
        }
    });

    page.on('response', async response => {
        const url = response.url();
        const status = response.status();
        if (url.includes('/finmind') || url.includes('/twse') || url.includes('/yahoo')) {
            console.log(`[API RESPONSE ${status}]`, url);
            try {
                const text = await response.text();
                console.log(`[API RESPONSE BODY (first 200 chars)]`, text.substring(0, 200));
            } catch (e) {
                console.log(`[API RESPONSE BODY ERROR]`, e.message);
            }
        } else if (status >= 400) {
            console.error(`[HTTP ERROR ${status}]`, url);
        }
    });

    // Go to local server
    await page.goto('http://localhost:3000');
    await new Promise(r => setTimeout(r, 2000));

    console.log("\nSearching for '8299.TWO'...");
    await page.type('#stock-search', '8299.TWO');
    await page.keyboard.press('Enter');
    
    // Wait for 5 seconds to let requests finish and render
    await new Promise(r => setTimeout(r, 5000));

    // Get the text contents of the detail page
    const details = await page.evaluate(() => {
        const detailName = document.getElementById('detail-name')?.textContent;
        const detailPrice = document.getElementById('detail-price')?.textContent;
        const detailChange = document.getElementById('detail-change')?.textContent;
        const summary = document.getElementById('ai-quick-summary')?.innerHTML;
        return { detailName, detailPrice, detailChange, summary };
    });

    console.log("\n=== RENDERED DETAILS ===");
    console.log("Detail Name:", details.detailName);
    console.log("Detail Price:", details.detailPrice);
    console.log("Detail Change:", details.detailChange);
    console.log("AI Summary:", details.summary);
    console.log("========================\n");

    await browser.close();
})();
