const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\malay\\.gemini\\antigravity\\brain\\dae50f85-8b57-4eb9-a7ba-8d3cf8a4e207';

(async () => {
  console.log("Starting verification run...");
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

    console.log("Navigating to http://localhost:8081 ...");
    await page.goto('http://localhost:8081', { waitUntil: 'networkidle2' });

    console.log("Enabling mock Firebase flag in local storage and reloading...");
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('useMockFirebase', 'true');
    });
    await page.reload({ waitUntil: 'networkidle2' });

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
    await new Promise(r => setTimeout(r, 1000));
    
    // Wait for CSK to appear in the text (meaning lobby is loaded)
    console.log("Waiting for franchise data to load...");
    await page.waitForFunction(() => document.body.textContent.includes('CSK'), { timeout: 10000 });

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
    await cskButton.click();
    await new Promise(r => setTimeout(r, 600));

    // Close the Modal
    console.log("Closing the team insights modal...");
    await page.waitForSelector('button[aria-label="Close team details"]', { timeout: 5000 });
    await page.click('button[aria-label="Close team details"]');
    await new Promise(r => setTimeout(r, 600));

    // Input manager name
    console.log("Entering manager name...");
    await page.type('input[placeholder="Enter your name"]', 'Test Manager');
    await new Promise(r => setTimeout(r, 600));

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
    await confirmBtn.click();
    await new Promise(r => setTimeout(r, 1000));

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
    await retentionBtn.click();

    // Wait for Retention Page
    console.log("Waiting for Retention page...");
    await new Promise(r => setTimeout(r, 1000));
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
    await finalizeBtn.click();

    // Wait for Retention Review page
    console.log("Waiting for Retention Review page...");
    await new Promise(r => setTimeout(r, 1000));
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
    await startBtn.click();

    // Wait for Auction Page
    console.log("Waiting for Auction page to load...");
    await new Promise(r => setTimeout(r, 1000));
    
    // Wait for the active player intro to load
    console.log("Waiting for active player info to render...");
    await page.waitForFunction(() => {
      return document.querySelector('h2.text-2xl') !== null;
    }, { timeout: 30000 });

    // Wait 2 more seconds to let transitions settle
    await new Promise(r => setTimeout(r, 2000));

    // Capture SCREEN 1: Initial Page Load with Standings and Player card
    console.log("Capturing screen 1: initial_load_verified.png ...");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'initial_load_verified.png') });
    console.log("Screen 1 saved.");

    // Click PLACE BID and next several times to build a sold list
    console.log("Bidding and progressing players to build sold list...");
    for (let i = 0; i < 15; i++) {
      try {
        // Find PLACE BID button
        const bidButtons = await page.$$('button');
        let bidBtn;
        for (const btn of bidButtons) {
          const text = await page.evaluate(el => el.textContent, btn);
          if (text.includes('PLACE BID')) {
            bidBtn = btn;
            break;
          }
        }
        if (bidBtn) {
          await bidBtn.click();
          await new Promise(r => setTimeout(r, 200));
        }

        // Advance player
        await page.waitForSelector('button[title="Skip / Next Player"]', { timeout: 1000 });
        await page.click('button[title="Skip / Next Player"]');
        await new Promise(r => setTimeout(r, 400));
      } catch (err) {
        console.log("Progress error: ", err.message);
      }
    }

    // Go to SOLD tab
    console.log("Clicking 'Sold' tab...");
    const directoryButtons = await page.$$('button');
    let soldTabBtn;
    for (const btn of directoryButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Sold (')) {
        soldTabBtn = btn;
        break;
      }
    }
    if (soldTabBtn) {
      await soldTabBtn.click();
      await new Promise(r => setTimeout(r, 500));
    }

    // Scroll the sold list
    console.log("Scrolling sold list...");
    await page.evaluate(() => {
      // Find the scrollable list container (with class scrollbar-thin)
      const list = document.querySelector('.scrollbar-thin');
      if (list) {
        list.scrollTop = 200;
      }
    });
    await new Promise(r => setTimeout(r, 500));

    // Capture SCREEN 2: Sold List Scrolling
    console.log("Capturing screen 2: sold_scrolled.png ...");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'sold_scrolled.png') });
    console.log("Screen 2 saved.");

    // Wait for any active Sold Modal to close
    console.log("Waiting for Sold Modal to close...");
    await new Promise(r => setTimeout(r, 4500));

    // Check if we are already on the summary page
    const isAlreadyOnSummary = await page.evaluate(() => {
      return window.location.pathname.includes('summary') || 
             document.body.textContent.includes('Final Auction Summary') ||
             document.body.textContent.includes('Leaderboard');
    });

    if (!isAlreadyOnSummary) {
      // Click End Game
      console.log("Clicking 'End Game' button in the Header...");
      try {
        await page.waitForSelector('button[title="End Game"]', { timeout: 5000 });
        await page.click('button[title="End Game"]');
      } catch (e) {
        console.log("Could not click 'End Game' button (maybe already navigated):", e.message);
      }
      
      // Capture SCREEN 3: accelerated_decision.png (representing end game action) ...
      console.log("Capturing screen 3: accelerated_decision.png (representing end game action) ...");
      await new Promise(r => setTimeout(r, 500));
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'accelerated_decision.png') });
      console.log("Screen 3 saved.");

      // Wait for Summary page to load (navigation)
      console.log("Waiting for Summary page to load after End Game...");
      await page.waitForFunction(() => {
        return window.location.pathname.includes('summary') || 
               document.body.textContent.includes('Final Auction Summary') ||
               document.body.textContent.includes('Leaderboard');
      }, { timeout: 25000 });
      await new Promise(r => setTimeout(r, 3500));
    } else {
      console.log("Already on the Summary page. Skipping 'End Game' click.");
      
      // Capture SCREEN 3: accelerated_decision.png
      console.log("Capturing screen 3: accelerated_decision.png ...");
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'accelerated_decision.png') });
      console.log("Screen 3 saved.");
      
      await new Promise(r => setTimeout(r, 1000));
    }

    // Capture SCREEN 4: Summary Page
    console.log("Capturing screen 4: summary_page.png ...");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'summary_page.png') });
    console.log("Screen 4 saved.");

  } catch (error) {
    console.error("Verification run failed:", error);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore close errors
      }
    }
    console.log("Verification run completed.");
  }
})();
