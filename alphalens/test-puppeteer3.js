const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  let loopCount = 0;
  page.on('console', msg => {
    if (msg.text().includes('[ACL] Verifying') || msg.text().includes('TypeError') || msg.text().includes('ReferenceError')) {
      console.log('BROWSER LOG:', msg.text());
      loopCount++;
    }
  });

  await page.goto('http://localhost:5174');
  
  // Search 2330
  await page.type('#stock-search', '2330');
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 2000));
  
  // Click Weekly
  await page.evaluate(() => {
    document.querySelector('[data-tf="1week"]').click();
  });
  await new Promise(r => setTimeout(r, 2000));
  
  console.log("RELOADING PAGE...");
  await page.reload();
  
  await new Promise(r => setTimeout(r, 5000));
  
  console.log(`Total error/ACL logs after reload: ${loopCount}`);
  await browser.close();
})();
