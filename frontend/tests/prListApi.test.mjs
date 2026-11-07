import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchPreviewLinks } from '../src/composables/prListApi.ts';

test('reads the URL-only list from the same-origin API', async () => {
  const links = ['https://tp.dstw.dev', 'https://pr-123.tp.dstw.dev'];
  assert.deepEqual(
    await fetchPreviewLinks(async (url) => {
      assert.equal(url, '/api/pr-preview-links');
      return Response.json(links);
    }),
    links
  );
});

test('reports API and network errors', async () => {
  await assert.rejects(fetchPreviewLinks(async () => new Response('', { status: 502 })), /HTTP 502/);
  await assert.rejects(
    fetchPreviewLinks(async () => { throw new TypeError('network'); }),
    /無法連線/
  );
});

test('rejects invalid URLs and invalid response shapes', async () => {
  for (const value of [
    {},
    ['https://evil.example/'],
    ['https://pr-0.tp.dstw.dev'],
    ['https://pr-12.tp.dstw.dev.evil.example'],
    [{ url: 'https://tp.dstw.dev' }]
  ]) {
    await assert.rejects(fetchPreviewLinks(async () => Response.json(value)), /格式錯誤/);
  }
});
