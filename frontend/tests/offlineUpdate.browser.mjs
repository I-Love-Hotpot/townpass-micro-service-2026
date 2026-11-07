// Production build required. Playwright is an external test dependency.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { buildOfflineBundle } from '../build/offline.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const directory = mkdtempSync(join(tmpdir(), 'govclear-updates-'));
cpSync(new URL('../dist/', import.meta.url), directory, { recursive: true });
let failDownload = false;
let assetRequests = 0;
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path.startsWith('/assets/')) assetRequests++;
  if (failDownload && path.endsWith('.wasm')) { response.writeHead(503).end(); return; }
  try {
    const bytes = readFileSync(join(directory, path === '/' ? 'index.html' : path.slice(1)));
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm' })[path === '/' ? '.html' : extname(path)] || 'application/octet-stream');
    response.setHeader('Cache-Control', 'no-store');
    response.end(bytes);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/opt/homebrew/bin/chromium' });
try {
  const context = await browser.newContext();
  // Exercise the actual five-minute callback without a five-minute test delay.
  await context.addInitScript(() => {
    const interval = window.setInterval;
    window.setInterval = (callback, delay, ...args) => interval(callback, delay === 300000 ? 1000 : delay, ...args);
  });
  let page = await context.newPage();
  await page.goto(origin + '/?lang=en#/');
  await page.getByText('The complete offline version is ready.', { exact: true }).waitFor();
  await page.getByText(/^Current version: [a-f0-9]{20}$/).waitFor();
  const original = await page.getByText(/^Current version:/).innerText();
  const initialRequests = assetRequests;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(1500);
  assert.equal(assetRequests, initialRequests, 'unchanged releases must not redownload assets');

  writeFileSync(join(directory, 'index.html'), readFileSync(join(directory, 'index.html'), 'utf8') + '\n<!-- release update -->');
  const next = buildOfflineBundle(directory).version;
  failDownload = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.getByText('Update incomplete. Keeping the current offline version; retrying when connected.', { exact: true }).waitFor({ timeout: 20000 });
  assert.equal(await page.getByText(/^Current version:/).innerText(), original);
  assert.equal(await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting)), false);

  failDownload = false;
  // No manual registration.update(): the interval must retry and discover the new version.
  await page.getByText('Offline update downloaded. Close and reopen this service to use it.', { exact: true }).waitFor({ timeout: 30000 });
  await page.getByText(`Downloaded version: ${next}`, { exact: true }).waitFor();
  assert.equal(await page.getByText(/^Current version:/).innerText(), original);
  await page.close();
  await context.setOffline(true);
  page = await context.newPage();
  await page.goto(origin + '/?lang=en#/history');
  await page.getByText(`Current version: ${next}`, { exact: true }).waitFor({ timeout: 15000 });
  assert.equal(await page.evaluate(async () => (await caches.keys()).filter(key => key.startsWith('govclear-shell-')).length), 1);
  console.log('PASS: stable version, no unchanged asset download, failed update retains old release, automatic retry and offline activation');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
  rmSync(directory, { recursive: true, force: true });
}
