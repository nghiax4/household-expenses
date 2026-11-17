// Screenshots a page of the running dev server as an iPhone 15 in WebKit (Safari's engine).
// Usage: npm run screenshot -- <output.png> [path, default "/"]
import { devices, webkit } from '@playwright/test';

const [outputPath, pagePath = '/'] = process.argv.slice(2);
if (!outputPath) {
  console.error('Usage: npm run screenshot -- <output.png> [path]');
  process.exit(1);
}

const browser = await webkit.launch();
try {
  const page = await browser.newPage({ ...devices['iPhone 15'] });
  await page.goto(new URL(pagePath, 'http://localhost:5173').href);
  // React draws after the page "loads", so wait until the app has rendered something.
  await page.waitForFunction(() => (document.getElementById('root')?.childElementCount ?? 0) > 0);
  await page.screenshot({ path: outputPath, fullPage: true });
  console.log(`Saved ${outputPath} (${await page.evaluate(() => window.innerWidth)}px wide)`);
} finally {
  await browser.close();
}
