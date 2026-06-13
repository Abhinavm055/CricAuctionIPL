const puppeteer = require('puppeteer-core');
const path = require('path');

(async () => {
  console.log("Launching headless browser...");
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    page.on('console', msg => {
      console.log(`[CONSOLE] [${msg.type()}] ${msg.text()}`);
    });

    page.on('pageerror', err => {
      console.error('[PAGE ERROR]', err);
    });

    console.log("Navigating to local site http://localhost:8081 ...");
    await page.goto('http://localhost:8081', { waitUntil: 'networkidle2' });
    
    console.log("Waiting 3 seconds on landing page...");
    await new Promise(r => setTimeout(r, 3000));

  } catch (error) {
    console.error("Test execution failed:", error);
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log("Browser closed.");
  }
})();
