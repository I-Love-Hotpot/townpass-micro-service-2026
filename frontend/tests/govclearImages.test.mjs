import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/services/govclearImages.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { validateSelection, recognizePages, mergePageText, pageReady } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const page = name => ({ id: name, name, preview: '', size: 100, ownedPreview: false, text: '', status: 'pending', error: '' });
const file = (size = 100, type = 'image/png') => ({ name: 'page.png', type, size });

test('validates the entire selection before changing existing pages', () => {
  const existing = [page('original')];
  assert.doesNotThrow(() => validateSelection(existing, [file(), file()]));
  for (const files of [Array.from({ length: 5 }, () => file()), [file(0)], [file(21 * 1024 * 1024)], [file(100, 'application/pdf')]]) {
    assert.throws(() => validateSelection(existing, files));
    assert.equal(existing.length, 1);
    assert.equal(existing[0].name, 'original');
  }
  assert.throws(() => validateSelection([], Array.from({ length: 3 }, () => file(18 * 1024 * 1024))), /50 MB/);
});

test('continues after one image fails and retries only unfinished pages', async () => {
  const pages = [page('first'), page('second'), page('third')];
  const called = [];
  const failures = await recognizePages(pages, async p => {
    called.push(p.id);
    if (p.id === 'second') throw new Error('看不清楚');
    return p.id + '原文';
  }, () => true, () => {});
  assert.equal(failures, 1);
  assert.deepEqual(called, ['first', 'second', 'third']);
  assert.equal(pages[1].status, 'error');
  pages[0].text = '人工修正第一頁';
  called.length = 0;
  await recognizePages(pages, async p => { called.push(p.id); return '第二頁原文'; }, () => true, () => {});
  assert.deepEqual(called, ['second']);
  assert.equal(pages[0].text, '人工修正第一頁');
  assert.ok(pages.every(pageReady));
});

test('cancel keeps completed results and ignores late output from an older operation', async () => {
  const pages = [page('first'), page('second'), page('third')];
  let active = true;
  await recognizePages(pages, async p => {
    if (p.id === 'second') {
      active = false;
      // Simulate a newer retry completing before the old callback returns.
      p.text = '較新且已人工修正的結果'; p.status = 'done';
    }
    return '舊結果';
  }, () => active, () => {});
  assert.equal(pages[0].text, '舊結果');
  assert.equal(pages[1].text, '較新且已人工修正的結果');
  assert.equal(pages[1].status, 'done');
  assert.equal(pages[2].status, 'pending');
});

test('merged evidence follows current order and includes each corrected page once', () => {
  const pages = [{ text: '第一頁修正金額300元' }, { text: '第二頁期限115年11月30日' }];
  assert.equal(mergePageText(pages), '【第 1 張】\n第一頁修正金額300元\n\n【第 2 張】\n第二頁期限115年11月30日');
  assert.equal(mergePageText([...pages].reverse()), '【第 1 張】\n第二頁期限115年11月30日\n\n【第 2 張】\n第一頁修正金額300元');
});
