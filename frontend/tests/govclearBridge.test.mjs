import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/services/govclearBridge.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { GovClearBridge } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));

function host(response) {
  const listeners = new Set();
  const requests = [];
  const object = {
    addEventListener(_, callback) { listeners.add(callback); },
    removeEventListener(_, callback) { listeners.delete(callback); },
    postMessage(message) {
      const request = JSON.parse(message).data;
      requests.push(request);
      if (request.action === 'cancel') return;
      const result = response(request);
      if (result === undefined) return;
      const envelope = { name: 'govclear', data: { id: request.id, ok: true, result } };
      queueMicrotask(() => {
        const data = 'base64:' + Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64');
        for (const callback of listeners) callback({ data });
      });
    },
  };
  globalThis.window = { govclearNative: object };
  return { listeners, requests };
}

test('encoded native replies preserve Chinese, quotes, newlines and backslashes', async () => {
  const original = '日期：115年11月30日\n「費用」300元\n"原文"\\保留';
  host(request => request.action === 'check' ? 'gemma4:e4b-it-q4_K_M' : original);
  const bridge = new GovClearBridge();
  await bridge.connect();
  assert.equal(await bridge.request('summarize', { text: original }), original);
  bridge.dispose();
});

test('cancel rejects pending inference and removes listener on disposal', async () => {
  const h = host(request => request.action === 'check' ? 'ready' : undefined);
  const bridge = new GovClearBridge();
  await bridge.connect();
  const pending = bridge.request('summarize', { text: '待處理' });
  bridge.cancel();
  await assert.rejects(pending, /已停止處理/);
  bridge.dispose();
  assert.equal(h.listeners.size, 0);
  assert.equal(h.requests.at(-1).action, 'cancel');
});

test('iOS restores a missing named listener and reuses it across operations', async () => {
  const h = host(() => 'ready');
  const object = window.govclearNative;
  let created = 0;
  delete window.govclearNative;
  window.FlutterInAppWebViewWebMessageListener = class {
    constructor(name) {
      assert.equal(name, 'govclearNative');
      created++;
      return object;
    }
  };
  window.webkit = { messageHandlers: { onWebMessageListenerPostMessageReceived: {} } };
  for (let n = 0; n < 2; n++) {
    const bridge = new GovClearBridge();
    assert.equal(await bridge.connect(), 'ready');
    assert.equal(await bridge.request('transcribe', { image: 'image' }), 'ready');
    bridge.dispose();
    assert.equal(h.listeners.size, 0);
  }
  assert.equal(created, 1);
});

test('waits past three seconds for delayed native injection', async (t) => {
  host(() => 'ready');
  const { govclearNative } = window;
  globalThis.window = {};
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const bridge = new GovClearBridge();
  const connected = bridge.connect();
  for (let n = 0; n < 40; n++) {
    t.mock.timers.tick(100);
    await Promise.resolve();
  }
  window.govclearNative = govclearNative;
  t.mock.timers.tick(100);
  assert.equal(await connected, 'ready');
  bridge.dispose();
});

test('ordinary browsers never construct a native listener and cancellation stops waiting', async (t) => {
  globalThis.window = {
    FlutterInAppWebViewWebMessageListener: class {
      constructor() { assert.fail('No native message handler'); }
    },
  };
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const bridge = new GovClearBridge();
  const controller = new AbortController();
  const connected = bridge.connect(controller.signal);
  controller.abort();
  t.mock.timers.tick(100);
  await assert.rejects(connected, { name: 'AbortError' });
  assert.equal(window.govclearNative, undefined);
  bridge.dispose();
});

test('missing bridges distinguish an app injection failure from an external browser', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const inApp of [false, true]) {
    globalThis.window = inApp ? { FlutterInAppWebViewWebMessageListener: class {} } : {};
    const bridge = new GovClearBridge();
    const rejected = assert.rejects(bridge.connect(), inApp ? /橋接尚未就緒/ : /TownPass/);
    for (let n = 0; n < 120; n++) {
      t.mock.timers.tick(100);
      await Promise.resolve();
    }
    await rejected;
    bridge.dispose();
  }
});
