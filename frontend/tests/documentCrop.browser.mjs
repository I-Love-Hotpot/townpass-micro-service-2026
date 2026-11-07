// Run against the local Vite server; Playwright is an external test tool, never a runtime dependency.
import assert from 'node:assert/strict';
const engines = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engineName = process.env.CROP_TEST_BROWSER || 'chromium';
const browser = await engines[engineName].launch({
  ...(engineName === 'chromium'
    ? { executablePath: process.env.CHROMIUM_PATH || '/opt/homebrew/bin/chromium' }
    : {}),
  headless: true
});
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.cropCalls = [];
    const listeners = new Set();
    window.govclearNative = {
      addEventListener: (_, cb) => listeners.add(cb),
      removeEventListener: (_, cb) => listeners.delete(cb),
      postMessage(raw) {
        const request = JSON.parse(raw).data;
        window.cropCalls.push(request);
        if (request.action === 'cancel') return;
        const result =
          request.action === 'transcribe'
            ? '合成通知：測試金額200元。'
            : request.action === 'summarize'
              ? '先看重點\n合成測試通知\n別漏掉\n金額200元。'
              : request.action === 'sixQuestions'
                ? JSON.stringify({
                    who: null,
                    what: '合成通知',
                    when: null,
                    where: null,
                    why: null,
                    how: null
                  })
                : 'ok';
        setTimeout(
          () =>
            listeners.forEach((cb) =>
              cb({
                data: JSON.stringify({
                  name: 'govclear',
                  data: { id: request.id, ok: true, result }
                })
              })
            ),
          10
        );
      }
    };
  });
  await page.goto(process.env.CROP_TEST_URL || 'http://127.0.0.1:5178/');
  const fixture = await page.evaluate(async () => {
    const crop = await import('/src/services/documentCrop.ts');
    window.crop = crop;
    const p = [
      { x: 0.2, y: 0.12 },
      { x: 0.85, y: 0.2 },
      { x: 0.93, y: 0.88 },
      { x: 0.08, y: 0.94 }
    ];
    window.fixturePoints = p;
    const source = crop.canvas(900, 1000),
      ctx = crop.context(source);
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, 900, 1000);
    ctx.beginPath();
    p.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p.x * 899, p.y * 999));
    ctx.closePath();
    ctx.fillStyle = '#eee';
    ctx.fill();
    // Color-coded marks near every corner and a content grid establish that warp retains the whole document.
    const m = crop.homography(p),
      colors = ['#ff0000', '#00ff00', '#0000ff', '#ff00ff'];
    for (let i = 0; i < 4; i++) {
      const q = crop.project(m, i === 1 || i === 2 ? 0.94 : 0.06, i >= 2 ? 0.94 : 0.06);
      ctx.fillStyle = colors[i];
      ctx.fillRect(q.x * 899 - 9, q.y * 999 - 9, 18, 18);
    }
    ctx.fillStyle = '#111';
    ctx.font = '22px sans-serif';
    for (let y = 300; y < 750; y += 45) ctx.fillText('SYNTHETIC DOCUMENT 200', 210, y);
    window.fixtureCanvas = source;
    return source.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[data-kind="photos"]').setInputFiles({
    name: 'synthetic.png',
    mimeType: 'image/png',
    buffer: Buffer.from(fixture, 'base64')
  });
  await page.getByText('已找到候選範圍', { exact: false }).waitFor();
  if (process.env.CROP_SCREENSHOT)
    await page.screenshot({ path: process.env.CROP_SCREENSHOT, fullPage: true });
  assert.equal(
    await page.evaluate(() => window.cropCalls.filter((c) => c.action === 'transcribe').length),
    0
  );
  const handle = page.locator('.crop-handle').first();
  const before = await handle.getAttribute('style');
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + 22, box.y + 22);
  await page.mouse.down();
  await page.mouse.move(box.x + 28, box.y + 28, { steps: 3 });
  await page.locator('.crop-loupe').waitFor();
  assert.notEqual(await handle.getAttribute('style'), before);
  // Loupe corner sample uses original image pixels, and its crosshair is centered.
  const loupe = await page.locator('.crop-loupe').evaluate((c) => {
    const d = c.getContext('2d').getImageData(56, 56, 1, 1).data;
    return [...d];
  });
  assert.ok(loupe[0] < 180, JSON.stringify(loupe));
  const sampled = await page
    .locator('.crop-loupe')
    .evaluate((c) => [...c.getContext('2d').getImageData(80, 80, 1, 1).data]);
  assert.deepEqual(sampled, [255, 0, 0, 255]);
  await page.mouse.up();
  assert.equal(await page.locator('.crop-loupe').count(), 0);
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  const saved = await handle.getAttribute('style');
  await page.getByRole('button', { name: '確認裁切', exact: true }).click();
  await page.getByRole('heading', { name: '確認校正結果' }).waitFor();
  assert.equal(
    await page.evaluate(() => window.cropCalls.filter((c) => c.action === 'transcribe').length),
    0
  );
  await page.getByRole('button', { name: '比較原圖', exact: true }).click();
  await page.getByRole('button', { name: '顯示校正圖片', exact: true }).click();
  await page.getByRole('button', { name: '返回調整', exact: true }).click();
  assert.equal(await handle.getAttribute('style'), saved);
  await page.setViewportSize({ width: 844, height: 390 });
  assert.equal(await handle.getAttribute('style'), saved);
  await page.getByRole('button', { name: '取消，保留圖片', exact: true }).click();
  await page.getByRole('button', { name: /調整並確認文件範圍/ }).click();
  assert.equal(await handle.getAttribute('style'), saved);
  await page.getByRole('button', { name: '確認裁切', exact: true }).click();
  await page.getByRole('heading', { name: '確認校正結果' }).waitFor();
  const preview = await page
    .locator('.crop-image')
    .evaluate((c) => c.toDataURL('image/jpeg', 0.94).split(',')[1]);
  await page.evaluate(() => {
    window.savedToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (cb) {
      cb(null);
    };
  });
  await page.getByRole('button', { name: '確認圖片，準備 OCR', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '暫存失敗' }).waitFor();
  await page.evaluate(() => {
    HTMLCanvasElement.prototype.toBlob = window.savedToBlob;
  });
  await page.getByRole('button', { name: '確認圖片，準備 OCR', exact: true }).click();
  await page.evaluate(async () => {
    const { records } = await import('/src/services/records.ts');
    const put = records.put;
    records.put = async (...args) => {
      try {
        return await put(...args);
      } catch (error) {
        window.recordError = String(error);
        throw error;
      }
    };
  });
  // The single primary processing action is the final FileAction in the page review.
  await page.locator('section[aria-labelledby="ocr-review-heading"] button').last().click();
  await page.waitForFunction(() => window.cropCalls.some((c) => c.action === 'transcribe'));
  const ocr = await page.evaluate(
    () => window.cropCalls.find((c) => c.action === 'transcribe').payload.image
  );
  assert.notEqual(ocr, fixture);
  assert.equal(ocr, preview);
  assert.ok(preview.length > 1000);
  // Verify exact OCR payload is the confirmed JPEG, not just any different bytes.
  const dimensions = await page.evaluate(async (base64) => {
    const i = new Image();
    i.src = 'data:image/jpeg;base64,' + base64;
    await i.decode();
    return [i.naturalWidth, i.naturalHeight];
  }, ocr);
  assert.ok(dimensions[0] < 900 && dimensions[1] < 1000);
  await page.waitForFunction(() => location.hash.includes('/documents/') || window.recordError);
  const storageError = await page.evaluate(() => window.recordError);
  if (storageError) {
    assert.equal(engineName, 'webkit');
    assert.equal(process.env.CROP_TEST_ALLOW_BLOB_STORAGE_FAILURE, '1', storageError);
    const baselineError = await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const r = indexedDB.open('crop-blob-baseline', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('blobs');
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      return await new Promise((resolve) => {
        const tx = db.transaction('blobs', 'readwrite');
        tx.objectStore('blobs').put(new Blob(['test']), 'test');
        tx.oncomplete = () => resolve('');
        tx.onabort = () => resolve(String(tx.error));
      });
    });
    assert.equal(baselineError, storageError);
    console.log(
      'LIMITATION: WebKit IndexedDB cannot store even a standalone Blob in this environment; persistence did not pass. ' +
        storageError
    );
  } else {
    const stored = await page.evaluate(async () => {
      const { records } = await import('/src/services/records.ts');
      const id = location.hash.split('/')[2];
      const r = await records.get(id);
      return { original: r.originals[0].blob.size, processed: r.pages[0].size };
    });
    assert.equal(stored.original, Buffer.from(fixture, 'base64').length);
    assert.notEqual(stored.original, stored.processed);
  }
  const engine = await page.evaluate(async () => {
    const crop = window.crop,
      source = window.fixtureCanvas,
      p = window.fixturePoints;
    const output = await crop.warp(source, p, new AbortController().signal),
      ctx = crop.context(output);
    const colors = [];
    for (const [x, y] of [
      [0.06, 0.06],
      [0.94, 0.06],
      [0.94, 0.94],
      [0.06, 0.94]
    ])
      colors.push([
        ...ctx.getImageData(
          Math.round(x * (output.width - 1)),
          Math.round(y * (output.height - 1)),
          1,
          1
        ).data
      ]);
    const cancelled = new AbortController();
    cancelled.abort();
    let aborted = false;
    try {
      await crop.warp(source, p, cancelled.signal);
    } catch {
      aborted = true;
    }
    let invalid = false;
    try {
      await crop.warp(source, [p[0], p[2], p[1], p[3]], new AbortController().signal);
    } catch {
      invalid = true;
    }
    // Minimal TIFF EXIF APP1 segment: raw JPEG stays 120x80, orientation tags exercise browser decoding.
    const raw = crop.canvas(120, 80);
    const rawContext = crop.context(raw);
    for (const [color, x, y] of [
      ['#ff0000', 0, 0],
      ['#00ff00', 60, 0],
      ['#ff00ff', 60, 40],
      ['#0000ff', 0, 40]
    ]) {
      rawContext.fillStyle = color;
      rawContext.fillRect(x, y, 60, 40);
    }
    const jpg = new Uint8Array(await (await crop.encodeCanvas(raw)).arrayBuffer());
    const sizes = [],
      exifColors = [];
    for (const orientation of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const app = new Uint8Array([
        255,
        225,
        0,
        34,
        69,
        120,
        105,
        102,
        0,
        0,
        73,
        73,
        42,
        0,
        8,
        0,
        0,
        0,
        1,
        0,
        18,
        1,
        3,
        0,
        1,
        0,
        0,
        0,
        orientation,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]);
      const decoded = await crop.loadOriginal(
        new Blob([jpg.slice(0, 2), app, jpg.slice(2)], { type: 'image/jpeg' }),
        new AbortController().signal
      );
      sizes.push([decoded.width, decoded.height]);
      exifColors.push([
        ...crop
          .context(decoded)
          .getImageData(Math.round(decoded.width / 4), Math.round(decoded.height / 4), 1, 1).data
      ]);
      decoded.width = decoded.height = 1;
    }
    const high = crop.canvas(4000, 3000);
    crop.context(high).fillRect(0, 0, 4000, 3000);
    const bounded = await crop.warp(high, crop.fullCorners(), new AbortController().signal);
    const highSize = [bounded.width, bounded.height];
    high.width = high.height = bounded.width = bounded.height = 1;
    const activeAbort = new AbortController();
    const pending = crop.warp(source, p, activeAbort.signal);
    setTimeout(() => activeAbort.abort(), 0);
    let interrupted = false;
    try {
      await pending;
    } catch {
      interrupted = true;
    }
    const oversized = new Uint8Array(24),
      header = new DataView(oversized.buffer);
    header.setUint32(0, 0x89504e47);
    header.setUint32(4, 0x0d0a1a0a);
    header.setUint32(16, 8000);
    header.setUint32(20, 6000);
    let rejectedLarge = false;
    try {
      await crop.loadOriginal(new Blob([oversized]), new AbortController().signal);
    } catch (error) {
      rejectedLarge = error.message.includes('1,600');
    }
    return { colors, aborted, invalid, sizes, exifColors, highSize, interrupted, rejectedLarge };
  });
  assert.deepEqual(engine.colors, [
    [255, 0, 0, 255],
    [0, 255, 0, 255],
    [0, 0, 255, 255],
    [255, 0, 255, 255]
  ]);
  assert.ok(engine.aborted && engine.invalid && engine.interrupted && engine.rejectedLarge);
  assert.deepEqual(engine.sizes, [
    [120, 80],
    [120, 80],
    [120, 80],
    [120, 80],
    [80, 120],
    [80, 120],
    [80, 120],
    [80, 120]
  ]);
  const red = [255, 0, 0, 255],
    green = [0, 255, 0, 255],
    blue = [0, 0, 255, 255],
    magenta = [255, 0, 255, 255];
  const expectedColors = [red, green, magenta, blue, red, blue, magenta, green];
  engine.exifColors.forEach((color, i) =>
    color.forEach((v, k) => assert.ok(Math.abs(v - expectedColors[i][k]) < 8))
  );
  assert.deepEqual(engine.highSize, [3200, 2400]);
  await page.goto(process.env.CROP_TEST_URL || 'http://127.0.0.1:5178/');
  const blank = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 500;
    c.height = 600;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#eee';
    ctx.fillRect(0, 0, 500, 600);
    return c.toDataURL().split(',')[1];
  });
  await page.locator('input[data-kind="camera"]').setInputFiles({
    name: 'blank.png',
    mimeType: 'image/png',
    buffer: Buffer.from(blank, 'base64')
  });
  await page.getByText('無法可靠偵測文件', { exact: false }).waitFor();
  await page.getByRole('button', { name: '使用整張原圖', exact: true }).click();
  assert.equal(
    await page.evaluate(() => window.cropCalls.filter((c) => c.action === 'transcribe').length),
    0
  );
  const originalPreview = await page.locator('li img').getAttribute('src');
  const originalBytes = await page.evaluate(async (url) => {
    const b = await (await fetch(url)).blob();
    return b.size;
  }, originalPreview);
  assert.equal(originalBytes, Buffer.from(blank, 'base64').length);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: drag/loupe, keyboard, portrait/landscape + DPR3, preview/back/reopen, real warp content markers, EXIF 1–8, 12MP cap, cancellation, and confirmed JPEG → Native OCR'
  );
  console.log(
    storageError
      ? 'Persistence: NOT PASSED (environment Blob baseline also failed)'
      : 'Persistence: PASS (original and corrected blobs stored independently)'
  );
} finally {
  await browser.close();
}
