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
const { analyzeGuarded, answerWithEvidence, validEvidence } = await import(compile('govclearRag'));
const { review } = await import(compile('govclearGuard'));
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
    if (prompt.startsWith('獨立複核')) {
      const criteria = JSON.parse(prompt.split('檢查：')[1].split('\n不可信資料：')[0]);
      return JSON.stringify({checks:Object.fromEntries(Object.keys(criteria).map(k=>[k,'supported'])),findings:[]});
    }
    if (prompt.includes('"sixQuestions"')) return JSON.stringify(draft);
    if (prompt.includes('"questions"')) return JSON.stringify({questions:[
      {text:'資格如何確認？',quote:'單身青年',terms:['單身青年']},
      {text:'有哪些年齡限制？',quote:'租金補貼',terms:['租金補貼']},
      {text:'如何核對條件？',quote:'核對資格',terms:['租金補貼']}
    ]});
    return JSON.stringify({text:'此版本說明成年未達40歲單身者；個案及歷史版本仍待核對。',citations:[evidence.unit_id]});
  }};
}
test('runs only model output checks G2/G3/G5, retains source/version/complete evidence and never trusts model validation', async () => {
  const bridge=host();
  const result=await analyzeGuarded(bridge,source,'文件','zh-TW');
  assert.equal(result.questions.length,3);
  assert.equal(result.publication,'model_reviewed');
  assert.equal(result.schemaVersion,2);
  assert.equal(result.sourceHash.length,64);
  assert.ok(result.guards.every(g => /^G[235](?:-|$)/.test(g.stage)));
  assert.ok(result.questions.every(q => q.guards.every(g => /^G5(?:-|$)/.test(g.stage))));
  assert.equal(result.questions[0].evidence[0].text,evidence.text);
  assert.equal(result.questions[0].historicalApplicability,'unverified');
  assert.equal(bridge.calls.filter(c=>c.action==='retrieve').length,3);
});
test('malformed, truncated, timed out and incomplete semantic reviews fail closed', async () => {
  for (const response of ['{"checks":', '{}', '{"checks":{"groundedness":"supported"},"findings":[]}']) {
    const report=await review({request:async()=>response},source,'G2',draft,{groundedness:'check',coverage:'check'});
    assert.equal(report.decision,'withhold');
  }
  const report=await review({request:async()=>{throw new Error('timeout')}},source,'G2',draft,{coverage:'check'});
  assert.equal(report.decision,'withhold');
  assert.match(report.findings[0],/timeout/);
});
test('withholds summary before retrieval when semantic coverage fails',async()=>{
  const bridge=host((action,payload)=>payload?.prompt?.includes('"coverage"') ? {checks:{groundedness:'supported',coverage:'uncertain',safety:'supported',readability:'supported'},findings:['遺漏免繳條件']} : undefined);
  await assert.rejects(analyzeGuarded(bridge,source,'文件','zh-TW'),/遺漏免繳/);
  assert.equal(bridge.calls.some(c=>c.action==='retrieve'),false);
});
test('unknown citations and untrusted origins cannot be published',async()=>{
  assert.equal(validEvidence({...evidence,source_url:'https://law.moj.gov.tw.evil.test/'}),false);
  assert.equal(validEvidence({...evidence,abolished:true}),false);
  const bridge=host((action,payload)=>payload?.prompt?.startsWith('以') ? {text:'捏造答案',citations:['unknown']} : undefined);
  const answer=await answerWithEvidence(bridge,source,'資格？','單身青年',['租金補貼'],'zh-TW','q1','model_suggested');
  assert.equal(answer.status,'needs_review');
  assert.equal(answer.answer.includes('捏造'),false);
  assert.deepEqual(answer.citations,[]);
});
test('missing evidence preserves other completed questions and records partial publication',async()=>{
  let count=0;
  const bridge=host(action=>action==='retrieve' && ++count===2 ? {...retrieval,evidence:[]} : undefined);
  const result=await analyzeGuarded(bridge,source,'文件','zh-TW');
  assert.equal(result.publication,'partial');
  assert.deepEqual(result.questions.map(q=>q.status),['model_reviewed','insufficient_evidence','model_reviewed']);
  assert.equal(result.questions[1].guards.some(g=>g.stage==='G5-q2'),false);
});
test('invented or ambiguous source quotes are rejected before retrieval',async()=>{
  const bridge=host((action,payload)=>payload?.prompt?.includes('"questions"') ? {questions:[
    {text:'甲？',quote:'不存在',terms:['租金']},
    {text:'乙？',quote:'不存在',terms:['租金']},
    {text:'丙？',quote:'不存在',terms:['租金']}
  ]}:undefined);
  const result=await analyzeGuarded(bridge,source,'文件','zh-TW');
  assert.equal(result.questions.length,0);
  assert.equal(result.publication,'partial');
  assert.equal(bridge.calls.some(c=>c.action==='retrieve'),false);
});

test('list numbers and numeric formatting reach semantic output review', async () => {
  const candidate = {...draft, summary:'1. 核對資格。2. 提出申請。'};
  const bridge = host((action,payload) => payload?.prompt?.startsWith('只依原文') ? candidate : undefined);
  const result = await analyzeGuarded(bridge, source, '文件', 'zh-TW');
  assert.equal(result.summary.facts[0], candidate.summary);
  assert.ok(bridge.calls.some(c => c.payload?.prompt?.startsWith('獨立複核') && c.payload.prompt.includes(candidate.summary)));
  assert.equal(result.guards.some(g => g.stage === 'G2-numbers'), false);
});

test('actual changed amounts are still withheld by semantic output review', async () => {
  const bridge = host((action,payload) => {
    if (payload?.prompt?.startsWith('只依原文')) return {...draft, summary:'費用999元'};
    if (payload?.prompt?.startsWith('獨立複核')) return {checks:{groundedness:'contradiction', coverage:'supported', safety:'supported', readability:'supported'},findings:['金額與原文不符']};
  });
  await assert.rejects(analyzeGuarded(bridge, source, '文件', 'zh-TW'), /金額與原文不符/);
  assert.equal(bridge.calls.some(c => c.action === 'retrieve'), false);
});

test('retrieval versions and dataset changes do not add pre-output gates', async () => {
  const bridge = host(action => action === 'retrieve' ? {...retrieval, datasetHash:'new', datasetVersion:'new', evidence:[evidence,{...evidence,unit_id:'law:1:v2',version_id:'v2'}]} : undefined);
  const answer = await answerWithEvidence(bridge, source, '資格？', '單身青年', ['租金補貼'], 'zh-TW', 'q1', 'model_suggested');
  assert.equal(answer.status, 'model_reviewed');
  assert.deepEqual(answer.guards.map(g => g.stage), ['G5-q1']);
});
 test('OCR text goes directly to generation without an input semantic gate', async () => {
  const bridge = host((action, payload) => {
    if (payload?.prompt?.includes('inputSafety')) throw new Error('G1 must not run');
  });
  const input = source + '[無法辨識]';
  const result = await analyzeGuarded(bridge, input, '文件', 'zh-TW');
  assert.match(bridge.calls[0].payload.prompt, /只依原文/);
  assert.ok(bridge.calls[0].payload.prompt.includes(input));
  assert.equal(result.guards.some(g => g.stage === 'G1'), false);
  assert.equal(result.guards.find(g => g.stage === 'G2').decision, 'allow');
});

test('retrieval is passed directly to answer generation without a pre-generation semantic guard', async () => {
  const bridge = host((action, payload) => {
    if (payload?.prompt?.includes('sufficiency')) throw new Error('retrieval guard must not run');
  });
  const answer = await answerWithEvidence(bridge, source, '資格？', '單身青年', ['租金補貼'], 'zh-TW', 'q1', 'model_suggested');
  assert.equal(answer.status, 'model_reviewed');
  assert.equal(bridge.calls[0].action, 'retrieve');
  assert.match(bridge.calls[1].payload.prompt, /^以/);
  assert.deepEqual(answer.guards.map(g => g.stage), ['G5-q1']);
});
