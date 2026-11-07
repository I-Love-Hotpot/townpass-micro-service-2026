import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openRecords } from '../src/services/records.ts';
import {
  contentHash,
  explainAgain,
  findFixture,
  processWithProgress,
  progressStages
} from '../src/services/processing.ts';

function document(id) {
  return {
    id,
    hash: null,
    kind: 'pdf',
    createdAt: 100,
    originals: [{ name: 'document.pdf', blob: new Blob(['original']) }],
    pages: [new Blob(['page'])],
    source: '通知原文與期限',
    processingSeconds: 13.7,
    sixQuestionsSeconds: 7.1,
    sixQuestions: { who: '申請人', what: '辦理申請', when: '11月30日前', where: null, why: null, how: '檢附資料' },
    summary: { title: '原始摘要', facts: ['文件重點'], action: '查看原文' },
    locale: 'zh-TW',
    destinations: [],
    chat: [{ question: '下一步？', answer: '查看原文', locale: 'zh-TW' }]
  };
}

test('progress uses unequal intervals and waits for storage before reporting 100%', async () => {
  const values = [];
  const intervals = [];
  let completeSave;
  const saving = new Promise((resolve) => {
    completeSave = resolve;
  });
  const result = processWithProgress(
    async () => 'saved',
    () => saving,
    (value) => values.push(value),
    new AbortController().signal,
    async (ms) => {
      intervals.push(ms);
    }
  );
  await new Promise(setImmediate);
  assert.deepEqual(values, [0, ...progressStages.map(([value]) => value)]);
  assert.ok(new Set(intervals).size > 1);
  assert.ok(new Set(values.slice(1).map((value, i) => value - values[i])).size > 1);
  completeSave('saved');
  assert.equal(await result, 'saved');
  assert.equal(values.at(-1), 100);
});

test('cancelling work rejects and does not publish 100%', async () => {
  const controller = new AbortController();
  const values = [];
  let saved = false;
  const task = processWithProgress(
    async () => 'prepared',
    async () => {
      saved = true;
    },
    (value) => values.push(value),
    controller.signal
  );
  await new Promise(setImmediate);
  controller.abort();
  await assert.rejects(task, { name: 'AbortError' });
  assert.deepEqual(values, [0]);
  assert.equal(saved, false);
});

test('matches identical bytes across filenames but rejects different content under the same name', async () => {
  const original = new File(['a'], 'notice.pdf');
  const catalog = [{ hash: await contentHash(original), id: 'fixture' }];
  const renamed = new File(['a'], 'renamed.pdf');
  const substituted = new File(['b'], 'notice.pdf');
  assert.equal(findFixture(catalog, await contentHash(renamed))?.id, 'fixture');
  assert.equal(findFixture(catalog, await contentHash(substituted)), undefined);
});

test('IndexedDB preserves source, pages, summary and chat across opens, and does not re-seed deleted examples', async () => {
  const first = openRecords('reopen-test');
  const sample = document('sample');
  const other = { ...document('other'), status: 'completed' };
  await Promise.all([
    first.seed([sample, other]),
    openRecords('reopen-test').seed([sample, other])
  ]);
  await first.put(document('upload'));
  const reopened = openRecords('reopen-test');
  assert.equal(await reopened.seeded(), true);
  assert.equal((await reopened.list()).length, 3);
  const saved = await reopened.get('upload');
  assert.equal(await saved.originals[0].blob.text(), 'original');
  assert.equal(await saved.pages[0].text(), 'page');
  assert.equal(saved.source, sample.source);
  assert.equal(saved.processingSeconds, 13.7);
  assert.equal(saved.sixQuestionsSeconds, 7.1);
  assert.deepEqual(saved.sixQuestions, sample.sixQuestions);
  assert.deepEqual(saved.summary, sample.summary);
  assert.deepEqual(saved.chat, sample.chat);
  await reopened.delete('sample');
  await first.seed([sample, other]);
  assert.equal(await first.get('sample'), undefined);
  assert.deepEqual(
    (await first.list()).map(({ id }) => id),
    ['other', 'upload']
  );
  assert.equal((await first.get('other')).status, 'completed');
});

test('cancelled writes leave neither a card nor an original', async () => {
  const db = openRecords('abort-test');
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(db.put(document('aborted'), controller.signal), { name: 'AbortError' });
  assert.equal(await db.get('aborted'), undefined);
  assert.deepEqual(await db.list(), []);
});

test('manual import restores missing examples and preserves existing records across retries', async () => {
  const db = openRecords('manual-import-test');
  const sample = document('sample');
  await db.seed([sample]);
  await db.put(document('upload'));
  await db.update('sample', (record) => ({
    ...record,
    summary: { ...record.summary, title: '已更新的摘要' }
  }));
  assert.equal(await db.seed([sample, document('other')], true), 1);
  assert.equal((await db.get('sample')).summary.title, '已更新的摘要');
  assert.ok(await db.get('upload'));
  await db.delete('other');
  assert.equal(await db.seed([sample, document('other')], true), 1);
  assert.equal(await db.seed([sample, document('other')], true), 0);
  assert.equal((await db.list()).length, 3);
});

test('clear removes documents, cards and settings across connections and permits a manual re-import', async () => {
  const db = openRecords('clear-test');
  await db.seed([document('sample')]);
  await db.put(document('upload'));
  await db.clear();
  const reopened = openRecords('clear-test');
  assert.deepEqual(await reopened.list(), []);
  assert.equal(await reopened.get('sample'), undefined);
  assert.equal(await reopened.get('upload'), undefined);
  assert.equal(await reopened.seeded(), false);
  assert.equal(await reopened.seed([document('sample')], true), 1);
  assert.equal((await db.list()).length, 1);
});

test('failed re-explanation leaves the existing summary, locale and card intact', async () => {
  const db = openRecords('explain-test');
  const old = document('sample');
  await db.put(old);
  await assert.rejects(
    db.update('sample', (record) => ({ ...record, summary: explainAgain(undefined), locale: 'id' }))
  );
  assert.deepEqual((await db.get('sample')).summary, old.summary);
  assert.deepEqual((await db.get('sample')).sixQuestions, old.sixQuestions);
  assert.equal((await db.get('sample')).locale, 'zh-TW');
  assert.deepEqual((await db.list())[0].summary, old.summary);

  const summary = { title: 'Ringkasan', facts: [], action: 'Baca dokumen' };
  await db.update('sample', (record) => ({
    ...record,
    summary: explainAgain(summary),
    locale: 'id'
  }));
  assert.equal((await db.list()).length, 1);
  assert.deepEqual((await db.list())[0].summary, summary);
  assert.deepEqual((await db.get('sample')).chat, old.chat);
});
