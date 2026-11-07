// Run against a production preview; Playwright remains an external test tool.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/opt/homebrew/bin/chromium' });
try {
  const origin = process.env.OFFLINE_TEST_URL || 'http://127.0.0.1:3187';
  const context = await browser.newContext();
  let page = await context.newPage();
  await page.goto(origin + '/?embedded=1&lang=en#/');
  await page.getByText('The complete offline version is ready.', { exact: true }).waitFor({ timeout: 60000 });
  const count = await page.evaluate(async () => {
    const name = (await caches.keys()).find(key => key.startsWith('govclear-shell-'));
    return (await (await caches.open(name)).keys()).length;
  });
  assert.ok(count > 100, 'PDF support files must also be downloaded');
  await page.close();
  await context.setOffline(true);
  page = await context.newPage();
  await page.goto(origin + '/?embedded=1&lang=en#/history');
  await page.getByText('The complete offline version is ready.', { exact: true }).waitFor();
  assert.ok(await page.locator('#app').innerText());
  console.log(`PASS: ${count} files cached; a new tab opens offline with a different route/query`);
} finally {
  await browser.close();
}
