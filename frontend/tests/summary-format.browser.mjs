// Local Native double; this verifies recovery and storage, not model quality.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const baseUrl = process.env.SUMMARY_TEST_URL || 'http://127.0.0.1:5178/';
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const listeners = new Set();
    window.testCalls = [];
    window.govclearNative = {
      addEventListener: (_, cb) => listeners.add(cb),
      removeEventListener: (_, cb) => listeners.delete(cb),
      postMessage(raw) {
        const request = JSON.parse(raw).data;
        window.testCalls.push(request.action);
        if (request.action === 'cancel') return;
        const result = request.action === 'generate' ? '{"d":[]}' : '{}';
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
  await page.goto(baseUrl);
  await page.evaluate(async () => {
    const { records } = await import('/src/services/records.ts');
    await records.put({
      id: 'format-test',
      hash: null,
      kind: 'photos',
      createdAt: Date.now(),
      originals: [],
      pages: [],
      source: '合成通知，期限11月30日。',
      summary: { title: '合成通知', facts: ['原有可用摘要'], action: '請核對原文' },
      sixQuestions: {
        who: '申請人',
        what: '補件',
        when: '11月30日',
        where: null,
        why: null,
        how: null
      },
      locale: 'zh-TW',
      destinations: [],
      chat: [{ question: '原有提問', answer: '原有回答', locale: 'zh-TW' }]
    });
  });
  await page.goto(baseUrl + '#/documents/format-test');
  await page.getByRole('button', { name: '重新解釋', exact: true }).click();
  await page.getByText('部分內容未生成；原文與可用結果已保留，可繼續提問或重新解釋。').waitFor();
  const read = () =>
    page.evaluate(async () =>
      (await import('/src/services/records.ts')).records.get('format-test')
    );
  const kept = await read();
  assert.deepEqual(kept.summary.facts, ['原有可用摘要']);
  assert.equal(kept.sixQuestions.when, '11月30日');
  assert.equal(kept.analysis.publication, 'partial');
  assert.equal(kept.chat[0].answer, '原有回答');
  await page
    .locator('details')
    .filter({ has: page.locator('#document-source') })
    .locator('summary')
    .click();
  await page.locator('textarea').fill('校正後的合成通知，日期未提供。');
  await page.getByRole('button', { name: '確認文字，重新產生摘要', exact: true }).click();
  await page
    .getByText('摘要暫未完成；原文已保留，仍可繼續提問或重新解釋。', { exact: true })
    .waitFor();
  await page.locator('#document-source:not(:disabled)').waitFor({ state: 'attached' });
  const changed = await read();
  assert.equal(changed.source, '校正後的合成通知，日期未提供。');
  assert.deepEqual(changed.summary.facts, []);
  assert.equal(changed.sixQuestions, undefined);
  assert.deepEqual(changed.chat, []);
  await page.reload();
  await page.getByRole('button', { name: '重新解釋', exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.testCalls), []);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: same-source results preserved, corrected source does not reuse stale facts, partial records do not auto-retry'
  );
} finally {
  await browser.close();
}
