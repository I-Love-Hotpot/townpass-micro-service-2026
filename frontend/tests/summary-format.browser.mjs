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
        const result =
          request.action === 'generate'
            ? request.payload.prompt.includes('"a":') && window.questionReply
              ? window.questionReply
              : '{"d":[]}'
            : '{}';
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
    const { hashText } = await import('/src/services/govclearJson.ts');
    await records.put({
      id: 'format-test',
      hash: null,
      kind: 'photos',
      createdAt: Date.now(),
      originals: [],
      pages: [],
      source: '合成通知，期限11月30日。',
      analysis: {
        schemaVersion: 2,
        sourceHash: await hashText('合成通知，期限11月30日。'),
        summary: { title: '合成通知', facts: ['原有可用摘要'], action: '請核對原文' },
        questions: [
          {
            id: 'q1',
            text: '原有具體問題',
            answer: '原有問答',
            status: 'generated',
            evidence: [],
            citations: [],
            sourceQuote: '',
            origin: 'model_suggested'
          }
        ],
        publication: 'partial',
        elapsedMs: 1
      },
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
  await page.locator('#document-source:not(:disabled)').waitFor({ state: 'attached' });
  const kept = await read();
  assert.deepEqual(kept.summary.facts, ['原有可用摘要']);
  assert.equal(kept.sixQuestions.when, '11月30日');
  assert.equal(kept.analysis.publication, 'partial');
  assert.equal(kept.chat[0].answer, '原有回答');
  assert.equal(kept.analysis.questions[0].answer, '原有問答');
  assert.ok(kept.analysis.questionError);
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
  assert.equal(changed.analysis.questions.length, 0);
  await page.getByRole('button', { name: '重新解釋並產生問答', exact: true }).waitFor();
  await page.evaluate(() => {
    window.questionReply = JSON.stringify({
      questions: [
        { question: '若申請時缺租約能補交嗎？', answer: '先確認補件方式。' },
        { question: '若期限已過可以申請嗎？', answer: '先詢問受理單位。' }
      ]
    });
  });
  await page.getByRole('button', { name: '重新解釋並產生問答', exact: true }).click();
  await page.getByRole('heading', { name: '若申請時缺租約能補交嗎？', exact: true }).waitFor();
  await page.locator('#document-source:not(:disabled)').waitFor({ state: 'attached' });
  const recovered = await read();
  assert.equal(recovered.analysis.questions.length, 2);
  assert.equal(recovered.analysis.questionError, undefined);
  assert.equal(recovered.analysis.questions[1].answer, '先詢問受理單位。');
  await page.evaluate(() => {
    window.questionReply = '{"a":[]}';
  });
  await page.getByRole('button', { name: '重新解釋', exact: true }).click();
  await page.locator('#document-source:not(:disabled)').waitFor({ state: 'attached' });
  const noSuggestions = await read();
  assert.equal(noSuggestions.analysis.questions.length, 0);
  assert.equal(noSuggestions.analysis.questionError, undefined);
  await page.getByText('目前沒有適合的建議問題，你仍可自行提問。', { exact: true }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: '重新解釋', exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.testCalls), []);
  await page.evaluate(async () => {
    const { records } = await import('/src/services/records.ts');
    const record = await records.get('format-test');
    await records.put({
      ...record,
      id: 'legacy-format-test',
      analysis: undefined,
      sixQuestions: { who: null, what: '合成通知', when: null, where: null, why: null, how: null }
    });
  });
  await page.goto(baseUrl + '#/documents/legacy-format-test');
  await page.getByRole('heading', { name: '你可能想問', exact: true }).waitFor();
  await page.getByRole('button', { name: '重新解釋並產生問答', exact: true }).waitFor();
  await page.evaluate(async () => {
    const { records } = await import('/src/services/records.ts');
    const record = await records.get('format-test');
    const candidates = [1, 2].map((n) => ({
      unit_id: 'law:' + n,
      unit_label: '第' + n + '條',
      title: '合成法規',
      text: '條文' + n,
      version_id: 'v1',
      source_url: 'https://example.org/law'
    }));
    const question = (id, citations) => ({
      id,
      text: id,
      answer: '合成回答',
      status: 'generated',
      origin: 'model_suggested',
      sourceQuote: '',
      citations,
      evidence: candidates
    });
    await records.put({
      ...record,
      id: 'references-test',
      analysis: {
        ...record.analysis,
        questions: [question('引用第二條', ['law:2']), question('只依原文回答', [])]
      }
    });
  });
  await page.goto(baseUrl + '#/documents/references-test');
  const cited = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: '引用第二條', exact: true }) })
    .last();
  await cited.getByRole('heading', { name: '引用第二條', exact: true }).waitFor();
  assert.equal(await cited.locator('a').filter({ hasText: '第2條' }).count(), 1);
  assert.equal(await cited.locator('a').filter({ hasText: '第1條' }).count(), 0);
  const uncited = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: '只依原文回答', exact: true }) })
    .last();
  assert.equal(await uncited.locator('details').count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: same-source results preserved, corrected source does not reuse stale facts, partial records do not auto-retry, suggested questions recover and legacy records retain their section'
  );
} finally {
  await browser.close();
}
