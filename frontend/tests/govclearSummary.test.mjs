import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const code = readFileSync(new URL('../src/services/govclearSummary.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { parseSummary, summaryStats } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));

test('renders concise plain-language sections without empty confirmation cards', () => {
  assert.deepEqual(parseSummary('**先看重點**\n12月10日前交資料。\n\n**別漏掉**\n- 已交完的人不用重交。\n\n**需要確認**\n未提及'), [
    { title: '先看重點', text: '12月10日前交資料。' },
    { title: '別漏掉', text: '• 已交完的人不用重交。' }
  ]);
});
test('keeps actual uncertainties and supports older response headings', () => {
  assert.deepEqual(parseSummary('**需要確認**\n截止日期看不清楚。'), [{ title: '需要確認', text: '截止日期看不清楚。' }]);
  assert.equal(parseSummary('**文件主旨**\n報名通知\n**重要事項**\n費用200元。').length, 2);
  assert.equal(parseSummary('只限居民，每戶一人。')[0].text, '只限居民，每戶一人。');
});
test('reports visible character counts without claiming reduction for a longer answer', () => {
  assert.deepEqual(summaryStats('一二三四五六七八九十', '**先看重點**\n一二'), { original: 10, summary: 6, reduction: 40 });
  assert.equal(summaryStats('短文', '**先看重點**\n這是比原文還長的摘要。').reduction, 0);
});
