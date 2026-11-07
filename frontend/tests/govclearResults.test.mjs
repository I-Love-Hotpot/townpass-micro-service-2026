import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function compile(file) {
 return ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
}
const uri = text => 'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
const code = compile('../src/services/govclearResults.ts').replace("'./govclearSixQuestions'", JSON.stringify(uri(compile('../src/services/govclearSixQuestions.ts'))));
const { createResult, sendResult } = await import(uri(code));
test('exports only results and verifies backend acknowledgment; retry preserves ID', async () => {
 const answers = {who:null,what:'測試',when:null,where:null,why:null,how:null,source:'不可上傳'};
 const payload = createResult('摘要',answers,'image', '第一頁原文\n\n第二頁：中文與「引號」');
 assert.equal(JSON.stringify(payload).includes('不可上傳'),false);
 assert.equal(payload.sixQuestions.why,null);
 assert.equal(payload.sourceText,'第一頁原文\n\n第二頁：中文與「引號」');
 const originalFetch = globalThis.fetch; const bodies = [];
 try {
  globalThis.fetch = async (_, options) => { bodies.push(options.body); return {ok:true,json:async()=>({resultId:payload.resultId,status:'stored'})}; };
  await sendResult('http://localhost:3001/api/govclear/results',payload,new AbortController().signal);
  await sendResult('http://localhost:3001/api/govclear/results',payload,new AbortController().signal);
  assert.equal(bodies[0],bodies[1]);
  globalThis.fetch = async () => ({ok:true,json:async()=>({resultId:'wrong',status:'stored'})});
  await assert.rejects(sendResult('http://localhost:3001',payload,new AbortController().signal),/未確認/);
  globalThis.fetch = async () => ({ok:false,status:503});
  await assert.rejects(sendResult('http://localhost:3001',payload,new AbortController().signal),/503/);
 } finally {globalThis.fetch=originalFetch;}
});
