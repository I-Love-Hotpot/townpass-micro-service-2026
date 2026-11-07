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
