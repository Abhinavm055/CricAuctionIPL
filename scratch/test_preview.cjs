const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const path = require('path');

async function testProductionBuild() {
  console.log("Starting vite preview server on port 8085...");
  const previewProcess = spawn('npx.cmd', ['vite', 'preview', '--port', '8085', '--strictPort'], {
    cwd: path.resolve(__dirname, '..'),
    shell: true,
  });

  previewProcess.stdout.on('data', (data) => {
    console.log(`[Vite Preview] ${data.toString().trim()}`);
  });

  previewProcess.stderr.on('data', (data) => {
    console.error(`[Vite Preview Error] ${data.toString().trim()}`);
  });

  await new Promise(r => setTimeout(r, 4000));

  let browser;
  const errors = [];
  try {
    browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error' || text.includes('Failed to fetch dynamically imported module') || text.includes('text/html')) {
        console.error(`[PAGE ERROR LOG] ${text}`);
        errors.push(text);
      }
    });

    page.on('pageerror', err => {
      console.error('[UNCAUGHT PAGE ERROR]', err.message);
      errors.push(err.message);
    });

    console.log("Testing Route 1: Landing Page (/) ...");
    await page.goto('http://localhost:8085/', { waitUntil: 'networkidle2' });

    console.log("Setting mock Firebase...");
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('useMockFirebase', 'true');
    });

    console.log("Testing Route 2: Lobby Page (/lobby/TESTGAME) ...");
    await page.goto('http://localhost:8085/lobby/TESTGAME', { waitUntil: 'networkidle2' });

    console.log("Testing Route 3: Retention Page (/retention/TESTGAME) ...");
    await page.goto('http://localhost:8085/retention/TESTGAME', { waitUntil: 'networkidle2' });

    console.log("Testing Route 4: Retention Review Page (/retention-review/TESTGAME) ...");
    await page.goto('http://localhost:8085/retention-review/TESTGAME', { waitUntil: 'networkidle2' });

    console.log("Testing Route 5: Auction Page (/auction/TESTGAME) ...");
    await page.goto('http://localhost:8085/auction/TESTGAME', { waitUntil: 'networkidle2' });

    console.log("Testing Route 6: Summary Page (/summary/TESTGAME) ...");
    await page.goto('http://localhost:8085/summary/TESTGAME', { waitUntil: 'networkidle2' });

    console.log("Testing Route 7: Leaderboard Page (/leaderboard) ...");
    await page.goto('http://localhost:8085/leaderboard', { waitUntil: 'networkidle2' });

    console.log("Testing Route 8: Tournament Page (/tournament) ...");
    await page.goto('http://localhost:8085/tournament', { waitUntil: 'networkidle2' });

    if (errors.length === 0) {
      console.log("\nSUCCESS: All routes loaded dynamically without any MIME type or module import errors!");
    } else {
      console.error(`\nFAILED: Found ${errors.length} error(s):`, errors);
    }
  } catch (err) {
    console.error("Test execution failed:", err);
  } finally {
    if (browser) await browser.close();
    previewProcess.kill();
    process.exit(errors.length > 0 ? 1 : 0);
  }
}

testProductionBuild();
