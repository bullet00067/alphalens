const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  let loopCount = 0;
  page.on('console', msg => {
    if (msg.text().includes('[ACL] Verifying')) {
      loopCount++;
      if (loopCount < 3) {
        console.log('ACL TRACE:');
        console.log(msg.text());
        msg.args().forEach(arg => console.log(arg));
      }
    }
  });
  
  // Expose a function to get stack traces if we could, but let's just use console.trace in app.js
  await page.evaluateOnNewDocument(() => {
    const origLog = console.log;
    console.log = function(...args) {
      if(args[0] && typeof args[0] === 'string' && args[0].includes('[ACL] Verifying')) {
        console.trace("ACL TRACE");
      }
      origLog.apply(console, args);
    }
  });

  await page.goto('http://localhost:5174');
  
  // Set up local storage to trigger the bug
  await page.evaluate(() => {
    localStorage.setItem('myWatchlist', JSON.stringify(['2330']));
    localStorage.setItem('myPortfolio', JSON.stringify([{ticker: '2330', cost: 100, qty: 1000}]));
  });
  
  await page.reload();
  
  await new Promise(r => setTimeout(r, 5000));
  
  console.log(`Total ACL logs in 5 seconds: ${loopCount}`);
  await browser.close();
})();
