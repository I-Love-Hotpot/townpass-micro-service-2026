import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Exercise the shipped adapters and raw policies without a bundler or a model download.
const modules = new Map();
function compile(name) {
  if (modules.has(name)) return modules.get(name);
  let code = ts.transpileModule(readFileSync(new URL(`../src/services/${name}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
  }).outputText;
  code = code.replace(/from (['"])([^'"]+)\1/g, (statement, _, path) => {
    if (path.startsWith('./')) return `from ${JSON.stringify(compile(path.slice(2)))}`;
    if (path.startsWith('@/assets/') && path.endsWith('?raw')) {
      const text = readFileSync(new URL('../src/' + path.slice(2, -4), import.meta.url), 'utf8');
      const url = 'data:text/javascript;base64,' + Buffer.from(`export default ${JSON.stringify(text)}`).toString('base64');
      return `from ${JSON.stringify(url)}`;
    }
    throw new Error(`Unexpected runtime import: ${path}`);
  });
  const url = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
  modules.set(name, url);
  return url;
}
const { recognizeDocument, summarizeDocument, analyzeSixQuestions } = await import(compile('offline'));
const { mergePageText } = await import(compile('govclearImages'));
const signal = () => new AbortController().signal;
const page = name => ({ id: name, name, file: new Blob([name]), preview: '', size: name.length, ownedPreview: false, text: '', status: 'pending', error: '' });
const answers = { who: '申請人', what: '辦理申請', when: '115年11月30日前', where: null, why: null, how: '300元，65歲免收' };

function host(response) {
  const calls = [];
  const listeners = new Set();
  globalThis.FileReader = class {
    readAsDataURL(blob) {
      blob.text().then(text => { this.result = 'data:image/png;base64,' + Buffer.from(text).toString('base64'); this.onload(); });
    }
  };
  globalThis.window = { govclearNative: {
    addEventListener(_, callback) { listeners.add(callback); },
    removeEventListener(_, callback) { listeners.delete(callback); },
    postMessage(raw) {
      const request = JSON.parse(raw).data;
      calls.push(request);
      if (request.action === 'cancel') return;
      const result = request.action === 'check' ? 'ready' : response(request);
      if (result === undefined) return;
      queueMicrotask(() => {
        for (const callback of listeners) callback({ data: JSON.stringify({ name: 'govclear', data: {
          id: request.id, ok: !(result instanceof Error), result, error: result.message
        } }) });
      });
    }
  } };
  return { calls, listeners };
}

test('OCR retry preserves corrected pages and sends the same full source to summary and sixQuestions', async () => {
  let fail = true;
  const mock = host(request => {
    if (request.action === 'generate') return JSON.stringify({checks:{groundedness:'supported', coverage:'supported', safety:'supported', readability:'supported'}, findings:[]});
    if (request.action === 'transcribe') {
      const name = Buffer.from(request.payload.image, 'base64').toString();
      return fail && name === 'second' ? new Error('看不清楚') : `${name}原文200元`;
    }
    return request.action === 'sixQuestions' ? JSON.stringify(answers) : '先看重點\n費用300元';
  });
  const pages = [page('first'), page('second')];
  assert.equal(await recognizeDocument(pages, signal(), () => {}), 1);
  pages[0].text = '人工修正300元';
  fail = false;
  assert.equal(await recognizeDocument(pages, signal(), () => {}), 0);
  assert.equal(mock.calls.filter(call => call.action === 'transcribe').length, 3);
  assert.equal(pages[0].text, '人工修正300元');
  const source = mergePageText(pages.reverse());
  const summary = await summarizeDocument(source, '文件', 'zh-TW', signal());
  assert.match(summary.facts.join(''), /300元/);
  assert.deepEqual(await analyzeSixQuestions(source, 'zh-TW', signal()), answers);
  const summaryCall = mock.calls.find(call => call.action === 'summarize');
  const sixCall = mock.calls.find(call => call.action === 'sixQuestions');
  assert.equal(summaryCall.payload.text, source);
  assert.equal(sixCall.payload.text, source);
  assert.ok(summaryCall.payload.mobilePolicy.length > 100);
  assert.ok(sixCall.payload.policy.includes('how'));
  assert.equal(mock.listeners.size, 0);
});

test('sixQuestions rejects incomplete output; cancelling pending analysis cleans up the bridge', async () => {
  const mock = host(() => '{"who":"申請人"}');
  await assert.rejects(analyzeSixQuestions('合成原文', 'zh-TW', signal()), /回應不完整/);
  assert.equal(mock.listeners.size, 0);
  const pending = host(() => undefined);
  const controller = new AbortController();
  const task = analyzeSixQuestions('合成原文', 'zh-TW', controller.signal);
  await new Promise(setImmediate);
  controller.abort();
  await assert.rejects(task, /已停止處理/);
  assert.equal(pending.listeners.size, 0);
  assert.equal(pending.calls.at(-1).action, 'cancel');
});


 test('image OCR runs without model readiness or input AI guard requests', async () => {
  const mock = host(request => {
    assert.equal(request.action, 'transcribe');
    return '辨識出的原文';
  });
  const pages = [page('photo')];
  assert.equal(await recognizeDocument(pages, signal(), () => {}), 0);
  assert.equal(pages[0].text, '辨識出的原文');
  assert.deepEqual(mock.calls.filter(c => c.action !== 'cancel').map(c => c.action), ['transcribe']);
});
