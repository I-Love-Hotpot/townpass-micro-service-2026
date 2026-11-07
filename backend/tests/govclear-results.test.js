import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import routes from '../src/routes/govclear-results.routes.js';
const payload = { schemaVersion: 1, resultId: 'a8c506f9-408a-4c8a-8a53-a1d29a86b741', generatedAt: '2026-11-08T00:00:00Z', inputMode: 'text', summary: '測試摘要', sixQuestions: {who: null, what: '測試', when: null, where: null, why: null, how: null} };
test('stores, retries idempotently, rejects conflicting or incomplete results', async () => {
 const app = Fastify({ajv:{customOptions:{coerceTypes:false,removeAdditional:false}}}); const saved = new Map(); const bodies = new Map();
 app.decorate('db', {async execute(sql, args) {
   if(sql.startsWith('SELECT')) return [[{payload_sha256: saved.get(args[0])}]];
   if(saved.has(args[0])) throw Object.assign(new Error(), {code:'ER_DUP_ENTRY'});
   bodies.set(args[0], JSON.parse(args[1]));
   saved.set(args[0], args[2]); return [];
 }});
 await app.register(routes);
 try {
  const post = body => app.inject({method:'POST',url:'/api/govclear/results',payload:body});
  assert.equal((await post(payload)).statusCode,201);
  assert.equal((await post(payload)).json().duplicate,true);
  const withSource = {...payload,resultId:'b8c506f9-408a-4c8a-8a53-a1d29a86b741',sourceText:'第一頁原文\n第二頁：中文與「引號」'};
  assert.equal((await post(withSource)).statusCode,201);
  assert.equal(bodies.get(withSource.resultId).sourceText,withSource.sourceText);
  assert.equal((await post(withSource)).json().duplicate,true);
  assert.equal((await post({...withSource,sourceText:'不同原文'})).statusCode,409);
  for(const sourceText of ['', '   ', 123, '文'.repeat(6001)]) {
   assert.equal((await post({...withSource,sourceText})).statusCode,400);
  }
  assert.equal((await post({...payload,summary:'不同內容'})).statusCode,409);
  assert.equal((await post({...payload,source:'不應上傳'})).statusCode,400);
  assert.equal((await post({...payload,sixQuestions:{who:null}})).statusCode,400);
  assert.equal((await app.inject('/api/govclear/results')).statusCode,404);
 } finally {await app.close();}
});
