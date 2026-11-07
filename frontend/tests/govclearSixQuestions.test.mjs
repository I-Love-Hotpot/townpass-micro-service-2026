import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/services/govclearSixQuestions.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022}}).outputText;
const { parseSixQuestions, SIX_QUESTIONS } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const facts = {who:'收到缺件通知的居民',what:'補交資料',when:'115年12月10日下午5時前',where:'社區辦公室',why:null,how:'親送或郵寄；已收到完成確認的人不用再交。'};
test('six cards preserve original dates, exceptions and explicitly absent reasons', () => {
  assert.equal(SIX_QUESTIONS.length, 6);
  assert.deepEqual(parseSixQuestions(JSON.stringify(facts)), facts);
  assert.deepEqual(parseSixQuestions('```json\n' + JSON.stringify(facts) + '\n```'), facts);
});
test('rejects missing fields, wrong types, truncated JSON and empty answers', () => {
  for (const raw of ['{}', 'null', '[]', JSON.stringify([facts]), '{"who":', JSON.stringify({...facts, how: []}), JSON.stringify({...facts, why: ''})]) {
    assert.throws(() => parseSixQuestions(raw), /回應不完整/);
  }
});

test('accepts valid lists, Chinese labels and harmless prose without inventing facts', () => {
  const values = {...facts, how: ['親送或郵寄', '收到確認的人不用再交']};
  assert.equal(parseSixQuestions('整理如下：\n' + JSON.stringify(values)).how, '• 親送或郵寄\n• 收到確認的人不用再交');
  const chinese = Object.fromEntries(SIX_QUESTIONS.map(({key,title}) => [title, facts[key]]));
  assert.deepEqual(parseSixQuestions(JSON.stringify(chinese)), facts);
});
test('never fills missing fields or silently chooses conflicting representations', () => {
  const missing = {...facts}; delete missing.why;
  for (const value of [missing, {...facts, 何人: '另一個對象'}, {...facts, how: ['有效內容', null]}, {...facts, how: {text:'不支援'}}]) {
    assert.throws(() => parseSixQuestions(JSON.stringify(value)), /回應不完整/);
  }
});
