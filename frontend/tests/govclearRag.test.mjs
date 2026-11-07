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
    if (prompt.includes('"a":')) return JSON.stringify({a:[{q:'未滿40歲但已婚，能申請這份租金補貼嗎？',t:'回答甲',c:[0]},{q:'申請租金補貼時租約尚未補齊，可以後補嗎？',t:'回答乙',c:[0]},{q:'錯過這份租金補貼的申請期限還能申請嗎？',t:'回答丙',c:[0]}]});
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
   if(payload?.prompt?.includes('"a":')) { assert.equal(snapshots.at(-1).questions.length,0); }
 });
 const result=await analyzeSource(bridge,source,'文件','zh-TW',value=>snapshots.push(value));
 assert.equal(snapshots.at(-1).publication,'generated');
 assert.equal(snapshots.at(-1).questions[0].answer,result.questions[0].answer);
 assert.equal(snapshots[0].questions.length,0);
});

test('a missing batch answer keeps other answers and the early summary', async () => {
 const bridge=host((action,payload)=>payload?.prompt?.includes('"a":')?{a:[{q:'第一題',t:'回答甲',c:[0]},null,{q:'第三題',t:'回答丙',c:[]}]}:undefined);
 const result=await analyzeSource(bridge,source,'文件','zh-TW');
 assert.equal(result.publication,'partial');
 assert.deepEqual(result.questions.map(q=>q.status),['generated','generated']);
 assert.equal(result.summary.facts[0],draft.summary);
});

test('early summary generation excludes questions and retrieval reuses the extracted subject and material facts', async()=>{
 const bridge=host();const result=await analyzeSource(bridge,source,'文件','zh-TW');
 const calls=bridge.calls.filter(c=>c.action==='generate');
 assert.equal(calls[0].payload.prompt.includes('"q":'),false);
 assert.equal(bridge.calls.filter(c=>c.action==='retrieve').length,1);
 assert.deepEqual(JSON.parse(bridge.calls.find(c=>c.action==='retrieve').payload.terms),[draft.sixQuestions.what,draft.sixQuestions.how]);
 assert.match(calls[1].payload.prompt,/原文材料或期限的具體困難/);
 assert.match(result.questions[0].text,/未滿40歲但已婚/);
});

test('both automatic answers and follow-up answers use plain language with separate references', async()=>{
 const {answerStyle}=await import(compile('govclearRag'));
 const automatic=host();await analyzeSource(automatic,source,'文件','zh-TW');
 const automaticPrompt=automatic.calls.filter(c=>c.action==='generate')[1].payload.prompt;
 assert.ok(automaticPrompt.startsWith(answerStyle));
 assert.match(automaticPrompt,/法條只當參考/);
 assert.match(automaticPrompt,/來源另放引用欄位/);
 const text='如果還沒備齊租約，可以先確認是否能補件；目前資料沒有寫清楚你的適用條件。';
 const followup=host((action,payload)=>action==='generate'?{text,citations:[evidence.unit_id]}:undefined);
 const result=await answerWithEvidence(followup,source,'租約沒備齊怎麼辦？','',['租約'],'zh-TW','user','user');
 assert.ok(followup.calls.find(c=>c.action==='generate').payload.prompt.startsWith(answerStyle));
 assert.equal(result.answer,text);
 assert.deepEqual(result.citations,[evidence.unit_id]);
 assert.equal(result.evidence[0].text,evidence.text);
});

test('an age/driver concern is shown early without blocking OCR text or generation', async () => {
  const text = '罰單記載：14 歲駕駛超速。';
  const note = {
    quote: '14歲駕駛超速',
    text: '請確認14是否為年齡、本人是否為駕駛人，或OCR將日期車號誤讀；這並不代表不可能發生。'
  };
  const bridge = host((action, payload) =>
    payload?.prompt?.includes('"w":')
      ? { s: '罰單記載駕駛超速，年齡及身分仍需確認。', w: draft.sixQuestions, d: [note] }
      : undefined
  );
  const snapshots = [];
  const result = await analyzeSource(bridge, text, '罰單', 'zh-TW', (value) =>
    snapshots.push(value)
  );
  const plan = bridge.calls.find((c) => c.action === 'generate').payload.prompt;
  assert.match(plan, /先分清人物角色與數字用途/);
  assert.match(plan, /14歲乘客、45歲父親駕駛並無矛盾/);
  assert.deepEqual(snapshots[0].logicNotes, [note]);
  assert.equal(snapshots[0].publication, 'pending');
  assert.equal(result.publication, 'generated');
  assert.equal(bridge.calls.filter((c) => c.action === 'generate').length, 2);
  const prompts = bridge.calls
    .filter((c) => c.action === 'generate')
    .map((c) => JSON.parse(c.payload.prompt.split('資料：')[1]));
  assert.equal(prompts[0].source, text);
  assert.deepEqual(prompts[1].logicNotes, [note]);
});

test('ordinary documents and unsupported model concerns never become false warnings', async () => {
  const regular = await analyzeSource(host(), source, '文件', 'zh-TW');
  assert.deepEqual(regular.logicNotes, []);
  const bridge = host((action, payload) =>
    payload?.prompt?.includes('"w":')
      ? {
          s: draft.summary,
          w: draft.sixQuestions,
          d: [
            { quote: '原文不存在的14歲駕駛', text: '憑空疑點' },
            { quote: '', text: '沒有引句' },
            { quote: source, text: null }
          ]
        }
      : undefined
  );
  const result = await analyzeSource(bridge, source, '文件', 'zh-TW');
  assert.deepEqual(result.logicNotes, []);
  assert.equal(result.publication, 'generated');
});

test('follow-up answers receive unresolved context concerns as data', async () => {
  const notes = [{ quote: '14歲駕駛', text: '先確認年齡與駕駛身分，不可斷言不可能。' }];
  const bridge = host();
  await answerWithEvidence(
    bridge,
    '14歲駕駛超速',
    '這張罰單適用於我嗎？',
    '',
    [],
    'zh-TW',
    'user',
    'user',
    notes
  );
  const prompt = bridge.calls.find((c) => c.action === 'generate').payload.prompt;
  assert.match(prompt, /先釐清事實並用條件式說明/);
  assert.deepEqual(JSON.parse(prompt.split('資料：')[1]).logicNotes, notes);
});

test('summary field aliases and generic fenced JSON do not abort document processing', async () => {
  const bridge = host((action, payload) => payload?.prompt?.includes('"w":')
    ? '```\n' + JSON.stringify({ summary: draft.summary, sixQuestions: draft.sixQuestions }) + '\n```'
    : undefined);
  const result = await analyzeSource(bridge, source, '文件', 'zh-TW');
  assert.equal(result.summary.facts[0], draft.summary);
  assert.deepEqual(result.sixQuestions, draft.sixQuestions);
  assert.equal(result.publication, 'generated');
});

test('missing or malformed six fields preserve the summary and continue answers without inventing missing facts', async () => {
  for (const w of [undefined, null, [], { who: '申請人' }]) {
    const bridge = host((action, payload) => payload?.prompt?.includes('"w":')
      ? { s: draft.summary, w } : undefined);
    const result = await analyzeSource(bridge, source, '文件', 'zh-TW');
    assert.deepEqual(result.summary.facts, [draft.summary]);
    assert.equal(result.sixQuestions, undefined);
    assert.equal(result.publication, 'partial');
    assert.equal(result.questions.length, 3);
    assert.equal(bridge.calls.filter(c => c.action === 'generate').length, 2);
  }
});

test('missing summary or broken JSON preserves source processing and marks the result partial', async () => {
  for (const reply of [{ d: [] }, { s: '', w: draft.sixQuestions }, '{"d":[', '']) {
    const bridge = host((action, payload) => payload?.prompt?.includes('"w":') ? reply : undefined);
    const result = await analyzeSource(bridge, source, '文件', 'zh-TW');
    assert.deepEqual(result.summary.facts, []);
    assert.match(result.summary.action, /摘要暫未完成/);
    assert.equal(result.publication, 'partial');
    assert.equal(result.questions.length, 3);
    const batch = bridge.calls.filter(c => c.action === 'generate')[1].payload.prompt;
    assert.equal(JSON.parse(batch.split('資料：')[1]).source, source);
  }
});

test('native generation failures still propagate instead of being saved as successful output', async () => {
  const bridge = { async request() { throw new Error('模型尚未就緒'); } };
  await assert.rejects(analyzeSource(bridge, source, '文件', 'zh-TW'), /模型尚未就緒/);
});

test('JSON envelopes accept prose and case-insensitive fences but never repair broken data', async () => {
  const { objectJson } = await import(compile('govclearJson'));
  for (const raw of ['```JSON\n{"text":"回答"}\n```', '整理如下：\n{"text":"回答"}']) {
    assert.deepEqual(objectJson(raw), { text: '回答' });
  }
  for (const raw of ['[]', 'null', '{"text":"未完成', '{"text":"回答"} garbage', '[{"text":"回答"}]']) {
    assert.throws(() => objectJson(raw));
  }
});

test('suggested questions accept field aliases and top-level arrays', async () => {
  const rows = [{ question: '若租約尚未備齊，可以補件嗎？', answer: '請先確認是否接受補件。', citations: [0] }];
  for (const response of [{ questions: rows }, { answers: rows }, rows]) {
    const bridge = host((action, payload) => payload?.prompt?.includes('"a":') ? response : undefined);
    const result = await analyzeSource(bridge, source, '文件', 'zh-TW');
    assert.equal(result.questions[0]?.text, rows[0].question);
    assert.equal(result.questions[0]?.answer, rows[0].answer);
    assert.deepEqual(result.questions[0]?.citations, [evidence.unit_id]);
  }
});

test('a generated question without its answer remains visible with an explicit incomplete state', async () => {
  const bridge = host((action, payload) => payload?.prompt?.includes('"a":')
    ? { a: [{ q: '若缺租約可以補件嗎？' }, { q: ' ', t: '空問題不顯示' }] } : undefined);
  const result = await analyzeSource(bridge, source, '文件', 'zh-TW');
  assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0].text, '若缺租約可以補件嗎？');
  assert.equal(result.questions[0].status, 'error');
  assert.match(result.questions[0].answer, /尚未/);
  assert.match(result.questionError, /未完成/);
  assert.equal(result.publication, 'partial');
});

test('suggestion failures have an explicit reason instead of silently becoming an empty section', async () => {
  for (const response of ['invalid JSON', { a: null }]) {
    const bridge = host((action, payload) => payload?.prompt?.includes('"a":') ? response : undefined);
    const result = await analyzeSource(bridge, source, '文件', 'zh-TW');
    assert.equal(result.questions.length, 0);
    assert.ok(result.questionError);
    assert.equal(result.summary.facts[0], draft.summary);
  }
});

test('truncated question batches preserve only complete rows, including escaped quotes and brackets', async () => {
  const row = { q: '若資料中含有「{}[]」字樣怎麼辦？', t: '請保留原文與"引號"，不要自行改寫。', c: [0] };
  for (const prefix of ['{"a":[', '[', '{"questions":[', '```json\n{"a":[']) {
    const raw = prefix + JSON.stringify(row) + ',{"q":"第二題","t":"未完成';
    const bridge = host((action, payload) => payload?.prompt?.includes('"a":') ? raw : undefined);
    const result = await analyzeSource(bridge, source, '文件', 'zh-TW');
    assert.equal(result.questions.length, 1);
    assert.equal(result.questions[0].text, row.q);
    assert.equal(result.questions[0].answer, row.t);
    assert.deepEqual(result.questions[0].citations, [evidence.unit_id]);
    assert.ok(result.questionError);
    assert.equal(result.publication, 'partial');
  }
});

test('answer generation runtime errors remain visible while preserving the early summary', async () => {
  const bridge = host((action, payload) => {
    if (payload?.prompt?.includes('"a":')) throw new Error('模型生成被中止');
  });
  const result = await analyzeSource(bridge, source, '文件', 'zh-TW');
  assert.equal(result.summary.facts[0], draft.summary);
  assert.equal(result.questionError, '模型生成被中止');
  assert.equal(result.publication, 'partial');
});

test('zero, one or two useful questions are complete results and the list never exceeds three', async () => {
  for (const count of [0, 1, 2, 3, 4]) {
    const a = Array.from({ length: count }, (_, i) => ({ q: `若缺少文件${i}該如何處理？`, t: '請確認補件方式。' }));
    const bridge = host((action, payload) => payload?.prompt?.includes('"a":') ? { a } : undefined);
    const result = await analyzeSource(bridge, source, '文件', 'zh-TW');
    assert.equal(result.questions.length, Math.min(count, 3));
    assert.equal(result.publication, 'generated');
    assert.equal(result.questionError, undefined);
    assert.equal(bridge.calls.filter(c => c.action === 'generate').length, 2);
    assert.match(bridge.calls.filter(c => c.action === 'generate')[1].payload.prompt, /有1題或2題就足夠時不要湊滿/);
  }
});
