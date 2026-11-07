import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { buildOfflineBundle } from '../build/offline.mjs';

test('complete release installs atomically; offline routes ignore language queries; failed updates preserve old release', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'govclear-offline-'));
  try {
    mkdirSync(join(directory, 'assets'));
    writeFileSync(join(directory, 'index.html'), 'release one');
    for (const name of ['app.js', 'pdf.worker.js', 'font.bcmap', 'decoder.wasm'])
      writeFileSync(join(directory, 'assets', name), name);
    const first = buildOfflineBundle(directory);
    assert.equal(first.entries.length, 5);
    assert.equal(buildOfflineBundle(directory).version, first.version);
    const stores = new Map();
    let fail = false;
    const caches = {
      async open(name) {
        if (!stores.has(name)) stores.set(name, new Map());
        const entries = stores.get(name);
        return {
          async addAll(requests) {
            for (const request of requests) {
              assert.match(request.integrity, /^sha256-/);
              if (fail && request.url.endsWith('.wasm')) throw Error('network disconnected');
              entries.set(new URL(request.url).pathname, new Response(request.url));
            }
          },
          async match(path) { return entries.get(path); }
        };
      },
      async keys() { return [...stores.keys()]; },
      async delete(name) { return stores.delete(name); }
    };
    function worker() {
      const events = {};
      const context = {
        self: { location: { origin: 'https://example.test' }, clients: { async claim() {} }, addEventListener(name, fn) { events[name] = fn; } },
        caches, URL,
        Request: class extends Request { constructor(url, options) { super(new URL(url, 'https://example.test'), options); } },
        fetch() { throw Error('offline'); }
      };
      vm.runInNewContext(readFileSync(join(directory, 'sw.js'), 'utf8'), context);
      return async (name, request, extra = {}) => {
        let result;
        events[name]({ ...extra, request, waitUntil(promise) { result = promise; }, respondWith(promise) { result = promise; } });
        return result;
      };
    }
    const active = worker();
    await active('install');
    await active('activate');
    let reportedVersion;
    await active('message', undefined, { data: 'GET_VERSION', ports: [{ postMessage(value) { reportedVersion = value; } }] });
    assert.equal(reportedVersion, first.version);
    const cached = await active('fetch', { method: 'GET', mode: 'navigate', url: 'https://example.test/?embedded=1&lang=en' });
    assert.match(await cached.text(), /index.html/);
    for (const name of first.entries.filter(name => name !== 'index.html')) {
      assert.ok(await active('fetch', { method: 'GET', url: 'https://example.test/' + name }));
    }
    assert.equal(await active('fetch', { method: 'POST', url: 'https://example.test/api' }), undefined);
    writeFileSync(join(directory, 'index.html'), 'release two');
    assert.notEqual(buildOfflineBundle(directory).version, first.version);
    fail = true;
    await assert.rejects(worker()('install'), /disconnected/);
    assert.deepEqual([...stores.keys()], ['govclear-shell-' + first.version]);
    fail = false;
    const updated = worker();
    await updated('install');
    await updated('activate');
    assert.equal(stores.size, 1);
    assert.ok(!stores.has('govclear-shell-' + first.version));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
