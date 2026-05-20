const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  let errorCount = 0;
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errorCount++;
      console.log('BROWSER ERROR:', msg.text());
    }
  });
  
  page.on('pageerror', err => {
    errorCount++;
    console.log('PAGE EXCEPTION:', err.toString());
  });

  page.on('requestfailed', request => {
    errorCount++;
    console.log('REQUEST FAILED:', request.url(), request.failure().errorText);
  });

  page.on('response', response => {
    const status = response.status();
    if (status >= 400) {
      errorCount++;
      console.log(`HTTP ERROR ${status}:`, response.url());
    }
  });
  
  await page.goto('http://localhost:5173');
  await new Promise(r => setTimeout(r, 5000));
  
  console.log(`Total errors in 5 seconds: ${errorCount}`);
  await browser.close();
})();
