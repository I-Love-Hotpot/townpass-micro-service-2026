import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/services/context.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { readAppContext } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

test('Native owns the microservice header; the web only enables an explicit preview', () => {
  assert.equal(readAppContext(new URL('https://townpass.fearnot.tw/')).showHeader, false);
  assert.equal(readAppContext(new URL('http://127.0.0.1:5173/govclear#/documents/123')).showHeader, false);
  assert.equal(readAppContext(new URL('http://127.0.0.1:5173/govclear')).embedded, true);
  assert.equal(readAppContext(new URL('https://example.test/?embedded=1')).showHeader, false);
  assert.equal(readAppContext(new URL('https://example.test/?header=0')).showHeader, false);
  assert.equal(readAppContext(new URL('https://example.test/?embedded=1&header=1')).showHeader, true);
  assert.equal(readAppContext(new URL('https://example.test/#/?lang=id&header=0')).locale, 'id');
});
