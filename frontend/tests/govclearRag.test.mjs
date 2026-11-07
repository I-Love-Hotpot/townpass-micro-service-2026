import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const modules = new Map();
function compile(name) {
  if (modules.has(name)) return modules.get(name);
  let code = ts.transpileModule(readFileSync(new URL(`../src/services/${name}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
  }).outputText;
  code = code.replace(/from (['"])(\.\/[^'"]+)\1/g, (_, q, path) => `from ${JSON.stringify(compile(path.slice(2)))}`);
  const url = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
  modules.set(name, url);
  return url;
}
const { analyzeSource, answerWithEvidence, validEvidence } = await import(compile('govclearRag'));
const source = '申請租金補貼，單身青年請核對資格。';
const evidence = {unit_id:'law:1:v1', law_id:'law', title:'租金補貼', unit_label:'第一條', text:'成年未達40歲單身者。', version_id:'v1', raw_hash:'a'.repeat(64), source_url:'https://pip.moi.gov.tw/Publicize/Info/B1020', effective_from:null,effective_to:null};
const retrieval = {datasetVersion:'CityBridgeFlutterEngine_v0_1_0', datasetHash:'a0f787503597e109b07ffb17544368b509b7c95fffed1e9c7d14268ac40d46a6', retrievedAt:'2026-11-08T00:00:00Z', evidence:[evidence]};
const draft = { summary:'請核對租金補貼資格。', sixQuestions:{who:'單身青年',what:'申請租金補貼',when:null,where:null,why:null,how:'核對資格'} };
function host(override = () => undefined) {
  const calls = [];
  return { calls, async request(action, payload) {
    calls.push({action,payload});
    const custom = override(action,payload,calls);
    if (custom !== undefined) return typeof custom === 'string' ? custom : JSON.stringify(custom);
    if (action === 'retrieve') return JSON.stringify(retrieval);
    const prompt = payload.prompt;
    assert.equal(prompt.startsWith('獨立複核'), false);
    if (prompt.includes('"w":')) return JSON.stringify({s:draft.summary,w:draft.sixQuestions,q:[{t:'資格？',k:'單身青年'},{t:'年齡？',k:'租金補貼'},{t:'條件？',k:'租金補貼'}]});
    if (prompt.includes('"a":')) return JSON.stringify({a:[['回答甲',[0]],['回答乙',[0]],['回答丙',[0]]]});
    if (prompt.includes('"questions"')) return JSON.stringify({questions:[
      {text:'資格如何確認？',quote:'單身青年',terms:['單身青年']},
      {text:'有哪些年齡限制？',quote:'租金補貼',terms:['租金補貼']},
      {text:'如何核對條件？',quote:'核對資格',terms:['租金補貼']}
    ]});
    return JSON.stringify({text:'此版本說明成年未達40歲單身者；個案及歷史版本仍待核對。',citations:[evidence.unit_id]});
  }};
}
test('summary, questions and answers are generated without any guard calls', async () => {
 const bridge=host(); const result=await analyzeSource(bridge,source,'文件','zh-TW');
 assert.equal(result.publication,'generated'); assert.equal(result.questions.length,3);
 assert.equal(bridge.calls.filter(c=>c.action==='generate').length,2);
 assert.equal(result.guards,undefined); assert.match(result.summary.action,/AI 生成/);
});
test('empty OCR source is sent directly to generation', async () => {
 const bridge=host(); const result=await analyzeSource(bridge,'','文件','zh-TW');
 assert.equal(result.summary.facts[0],draft.summary); assert.equal(result.publication,'generated');
});
test('no evidence does not withhold an answer generated from the source', async () => {
 const bridge=host(action=>action==='retrieve'?{...retrieval,evidence:[]}:undefined);
 const answer=await answerWithEvidence(bridge,source,'資格？','',[],'zh-TW','user','user');
 assert.equal(answer.status,'generated'); assert.match(answer.answer,/成年/);
});
test('unparseable question response preserves the generated summary', async () => {
 const bridge=host((action,payload)=>payload?.prompt?.includes('"a":')?'invalid JSON':undefined);
 const result=await analyzeSource(bridge,source,'文件','zh-TW');
 assert.equal(result.publication,'partial');assert.equal(result.summary.facts[0],draft.summary);
});

test('batch reuses complete evidence and maps numeric citations to stored source IDs', async()=>{
 const bridge=host();const result=await analyzeSource(bridge,source,'文件','zh-TW');
 const batch=bridge.calls.filter(c=>c.action==='generate')[1].payload.prompt;
 const data=JSON.parse(batch.split('資料：')[1]);assert.equal(data.e.length,1);assert.equal(data.e[0].text,evidence.text);
 assert.equal(result.questions[2].citations[0],evidence.unit_id);
});

test('summary and six fields are delivered before retrieval or answer generation completes', async () => {
 const snapshots=[];
 const bridge=host((action,payload)=>{
   if(action==='retrieve') { assert.equal(snapshots[0].publication,'pending'); assert.equal(snapshots[0].summary.facts[0],draft.summary); }
   if(payload?.prompt?.includes('"a":')) { assert.equal(snapshots.at(-1).questions.length,3); assert.ok(snapshots.at(-1).questions.every(q=>q.status==='pending')); }
 });
 const result=await analyzeSource(bridge,source,'文件','zh-TW',value=>snapshots.push(value));
 assert.equal(snapshots.at(-1).publication,'generated');
 assert.equal(snapshots.at(-1).questions[0].answer,result.questions[0].answer);
 assert.equal(snapshots[0].questions.length,0);
});

test('a missing batch answer keeps other answers and the early summary', async () => {
 const bridge=host((action,payload)=>payload?.prompt?.includes('"a":')?{a:[['第一題',[0]],null,['第三題',[]]]}:undefined);
 const result=await analyzeSource(bridge,source,'文件','zh-TW');
 assert.equal(result.publication,'partial');
 assert.deepEqual(result.questions.map(q=>q.status),['generated','error','generated']);
 assert.equal(result.summary.facts[0],draft.summary);
});
