import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function compile(name, dependencies = {}) {
  let code = ts.transpileModule(readFileSync(new URL(`../src/services/${name}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
  }).outputText;
  for (const [name, url] of Object.entries(dependencies)) code = code.replace(`'./${name}'`, JSON.stringify(url));
  return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
}
const { withInference, transcribePages, summarizeSource, validateSource } = await import(compile('govclearDocument', {
  govclearGuard: compile('govclearGuard'), govclearBridge: compile('govclearBridge'), govclearSummary: compile('govclearSummary')
}));
const policies = { policy: 'full', mobilePolicy: 'mobile', reviewPolicy: 'review' };

function host(reply) {
  const calls = [];
  const bridge = {
    async connect() { calls.push('connect'); },
    async request(action, payload) { calls.push({ action, payload }); return action === 'generate' ? JSON.stringify({checks:{groundedness:'supported', coverage:'supported', safety:'supported', readability:'supported'}, findings:[]}) : reply(action, payload); },
    cancel() { calls.push('cancel'); },
    dispose() { calls.push('dispose'); }
  };
  return { bridge, calls };
}

test('processes photos or PDF pages in order, retains full source, then calls release summary contract', async () => {
  const { bridge, calls } = host((action, payload) => action === 'transcribe' ? payload.image : '先看重點\n申請期限 11/30\n別漏掉\n費用 600 元');
  const signal = new AbortController().signal;
  const result = await withInference(signal, async b => {
    const source = await transcribePages(b, [new Blob(['page1']), new Blob(['page2'])], signal, b => b.text());
    return { source, summary: await summarizeSource(b, source, '文件', 'zh-TW', policies) };
  }, bridge);
  assert.equal(result.source, '【第 1 頁】\npage1\n\n【第 2 頁】\npage2');
  assert.equal(calls[3].payload.text, result.source);
  assert.ok(calls[3].payload.mobilePolicy.startsWith('mobile'));
  assert.equal(calls[3].payload.reviewPolicy.startsWith('review'), true);
  assert.equal(result.summary.title, '文件');
  assert.deepEqual(result.summary.facts, ['先看重點\n申請期限 11/30', '別漏掉\n費用 600 元']);
  assert.equal(calls.at(-1), 'dispose');
});

test('rejects empty OCR, total source overflow and empty model replies without synthesizing sample answers', async () => {
  const signal = new AbortController().signal;
  assert.throws(() => validateSource('  '));
  assert.equal(validateSource('字'.repeat(6001)).length, 6001);
  const empty = host(() => '');
  await assert.rejects(transcribePages(empty.bridge, [new Blob()], signal, async () => ''), /沒有可辨識/);
  await assert.rejects(summarizeSource(empty.bridge, '原文', '文件', 'zh-TW', policies), /未回傳摘要/);
  const headings = host(() => '先看重點');
  await assert.rejects(summarizeSource(headings.bridge, '原文', '文件', 'zh-TW', policies), /未回傳有效摘要/);
  const long = host(() => '字'.repeat(3100));
  assert.ok((await transcribePages(long.bridge, [new Blob(), new Blob()], signal, async () => '')).length > 6000);
  assert.equal(long.calls.filter(c => c.action === 'transcribe').length, 2);
});

test('failure releases the bridge; cancellation discards a late response and stops subsequent pages', async () => {
  const broken = host(() => { throw new Error('OCR failed'); });
  const signal = new AbortController().signal;
  await assert.rejects(withInference(signal, b => b.request('transcribe'), broken.bridge), /OCR failed/);
  assert.equal(broken.calls.at(-1), 'dispose');
  const controller = new AbortController();
  const late = host(() => { controller.abort(); return 'late'; });
  await assert.rejects(withInference(controller.signal, b => transcribePages(b, [new Blob(), new Blob()], controller.signal, async () => ''), late.bridge), { name: 'AbortError' });
  assert.ok(late.calls.includes('cancel'));
  assert.equal(late.calls.filter(c => c.action === 'transcribe').length, 1);
  assert.equal(late.calls.at(-1), 'dispose');
});

test('Indonesian output is requested explicitly in both mobile and simulator policies', async () => {
  const { bridge, calls } = host(() => 'Batas waktu 30 November.');
  await summarizeSource(bridge, '原文', 'Surat', 'id', policies);
  assert.match(calls[0].payload.policy, /印尼文/);
  assert.match(calls[0].payload.mobilePolicy, /印尼文/);
});
