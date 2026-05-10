const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  let errorCount = 0;
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errorCount++;
      if (errorCount < 10) console.log('BROWSER ERROR:', msg.text());
    }
  });
  
  await page.goto('http://localhost:5173');
  await new Promise(r => setTimeout(r, 5000));
  
  console.log(`Total errors in 5 seconds: ${errorCount}`);
  await browser.close();
})();
