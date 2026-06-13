const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log("Starting full flow diagnostics...");
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE] [${msg.type()}] ${msg.text()}`);
    });

    page.on('pageerror', err => {
      console.error('[BROWSER PAGE ERROR]', err);
    });

    console.log("Navigating to landing page http://localhost:8081 ...");
    await page.goto('http://localhost:8081', { waitUntil: 'networkidle2' });

    // Click "Play VS AI"
    console.log("Waiting for 'Play VS AI' button...");
    await page.waitForSelector('button', { timeout: 10000 });
    const buttons = await page.$$('button');
    let aiButton;
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Play VS AI')) {
        aiButton = btn;
        break;
      }
    }
    if (!aiButton) throw new Error("Could not find 'Play VS AI' button");
    await aiButton.click();

    // Wait for Lobby
    console.log("Waiting for Lobby page to load...");
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log(`Lobby loaded: ${page.url()}`);

    // Wait for CSK to appear in the text (meaning lobby is loaded)
    console.log("Waiting for franchise data to load...");
    await page.waitForFunction(() => document.body.textContent.includes('CSK'), { timeout: 10000 });
    console.log("Franchise data loaded.");

    // Click CSK
    console.log("Clicking CSK team card...");
    const teamButtons = await page.$$('button');
    let cskButton;
    for (const btn of teamButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('CSK')) {
        cskButton = btn;
        break;
      }
    }
    if (!cskButton) throw new Error("Could not find CSK team button");
    await cskButton.click();
    await new Promise(r => setTimeout(r, 800));

    // Close the Modal
    console.log("Closing the team insights modal...");
    await page.waitForSelector('button[aria-label="Close team details"]', { timeout: 5000 });
    await page.click('button[aria-label="Close team details"]');
    await new Promise(r => setTimeout(r, 800));

    // Input manager name
    console.log("Entering manager name...");
    await page.type('input[placeholder="Enter your name"]', 'Test Manager');
    await new Promise(r => setTimeout(r, 800));

    // Click Confirm Team
    console.log("Clicking 'Confirm Team'...");
    const confirmButtons = await page.$$('button');
    let confirmBtn;
    for (const btn of confirmButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Confirm Team')) {
        confirmBtn = btn;
        break;
      }
    }
    if (!confirmBtn) throw new Error("Could not find 'Confirm Team' button");
    await confirmBtn.click();
    await new Promise(r => setTimeout(r, 1200));

    // Click Retention Round
    console.log("Waiting for 'Retention Round' button...");
    await page.waitForFunction(() => document.body.textContent.includes('Retention Round'), { timeout: 10000 });
    const retentionButtons = await page.$$('button');
    let retentionBtn;
    for (const btn of retentionButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Retention Round')) {
        retentionBtn = btn;
        break;
      }
    }
    if (!retentionBtn) throw new Error("Could not find 'Retention Round' button");
    await retentionBtn.click();

    // Wait for Retention Page
    console.log("Waiting for Retention page...");
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log(`Retention page loaded: ${page.url()}`);
    await page.screenshot({ path: 'retention_loaded.png' });
    console.log("Saved retention_loaded.png");

    // Wait for FINALIZE RETENTIONS text
    await page.waitForFunction(() => document.body.textContent.includes('FINALIZE RETENTIONS'), { timeout: 10000 });

    // Click FINALIZE RETENTIONS
    console.log("Finalizing retentions...");
    const finalizeButtons = await page.$$('button');
    let finalizeBtn;
    for (const btn of finalizeButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('FINALIZE RETENTIONS')) {
        finalizeBtn = btn;
        break;
      }
    }
    if (!finalizeBtn) throw new Error("Could not find 'FINALIZE RETENTIONS' button");
    await finalizeBtn.click();

    // Wait for Retention Review page
    console.log("Waiting for Retention Review page...");
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log(`Retention Review loaded: ${page.url()}`);
    await page.screenshot({ path: 'retention_review_loaded.png' });
    console.log("Saved retention_review_loaded.png");

    // Wait for Start Auction text
    await page.waitForFunction(() => document.body.textContent.includes('Start Auction'), { timeout: 10000 });

    // Click Start Auction
    console.log("Starting the Auction...");
    const startButtons = await page.$$('button');
    let startBtn;
    for (const btn of startButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Start Auction')) {
        startBtn = btn;
        break;
      }
    }
    if (!startBtn) throw new Error("Could not find 'Start Auction' button");
    await startBtn.click();

    // Wait for Auction Page
    console.log("Waiting for Auction page to load...");
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log(`Auction page loaded: ${page.url()}`);
    
    // Wait for initial countdown/intro to finish or render
    await new Promise(r => setTimeout(r, 6000));
    await page.screenshot({ path: 'auction_initial_load.png' });
    console.log("Saved auction_initial_load.png");

    // Grab body html of auction page for review
    const auctionHTML = await page.evaluate(() => document.body.innerHTML);
    fs.writeFileSync('auction_body.html', auctionHTML);
    console.log("Saved auction_body.html");

  } catch (error) {
    console.error("Test execution failed:", error);
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log("Diagnostics finished.");
  }
})();
