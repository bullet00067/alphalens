const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    await page.goto('http://localhost:5173/');
    await new Promise(r => setTimeout(r, 2000));
    
    const portfolioLi = await page.$('li[data-target="portfolio-view"]');
    if (portfolioLi) {
        await portfolioLi.click();
    } else {
        console.log("PORTFOLIO TAB NOT FOUND");
    }
    await new Promise(r => setTimeout(r, 1000));
    
    const rows = await page.$$('tr');
    for (let row of rows) {
        const text = await page.evaluate(el => el.textContent, row);
        if (text.includes('AAPL')) {
            await row.click();
            console.log("CLICKED AAPL ROW");
            break;
        }
    }
    await new Promise(r => setTimeout(r, 4000));
    
    await browser.close();
})();
