const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log("Starting diagnostics...");
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Set a large viewport
    await page.setViewport({ width: 1440, height: 900 });

    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE] [${msg.type()}] ${msg.text()}`);
    });

    page.on('pageerror', err => {
      console.error('[BROWSER PAGE ERROR]', err);
    });

    console.log("Navigating to http://localhost:8082 ...");
    await page.goto('http://localhost:8082', { waitUntil: 'networkidle2' });
    
    // Save state
    const earlyBody = await page.evaluate(() => document.body.innerHTML);
    fs.writeFileSync('lobby_body.html', earlyBody);
    await page.screenshot({ path: 'lobby_loaded.png' });
    console.log("Saved early state to lobby_body.html and lobby_loaded.png");

    // Wait for the Play VS AI button to be visible
    console.log("Waiting for 'Play VS AI' button...");
    await page.waitForSelector('button', { timeout: 10000 });
    
    // Find the button and click it
    const buttons = await page.$$('button');
    let aiButton;
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Play VS AI')) {
        aiButton = btn;
        break;
      }
    }

    if (!aiButton) {
      throw new Error("Could not find 'Play VS AI' button");
    }

    console.log("Found button. Clicking 'Play VS AI'...");
    await aiButton.click();

    // Now we should be in the Lobby.
    console.log("Waiting for Lobby page to load...");
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log(`Lobby loaded at URL: ${page.url()}`);

    // Wait a bit
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'lobby_loaded.png' });
    console.log("Saved lobby_loaded.png");

    // In Lobby, look for Start Auction button or Select Team then Start
    // Let's inspect buttons in Lobby
    const lobbyButtons = await page.$$('button');
    let startAuctionBtn;
    for (const btn of lobbyButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Start Auction') || text.includes('Select') || text.includes('Continue')) {
        console.log(`Lobby button found: ${text}`);
      }
    }

    // Usually we might need to select a team first. Let's select the first team if any select dropdown/button is available.
    // Or check if there's a button to select team or join.
    // Let's just screenshot and print the HTML to understand what is on the Lobby page.
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    fs.writeFileSync('lobby_body.html', bodyHTML);
    console.log("Saved lobby_body.html");

  } catch (error) {
    console.error("Diagnostics failed:", error);
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log("Diagnostics finished.");
  }
})();
