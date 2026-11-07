import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function buildOfflineBundle(directory) {
  function files(path = '') {
    return readdirSync(join(directory, path), { withFileTypes: true }).flatMap(entry => {
      const name = path ? `${path}/${entry.name}` : entry.name;
      return entry.isDirectory() ? files(name) : name === 'sw.js' ? [] : [name];
    });
  }
  const entries = files().sort();
  const hash = createHash('sha256');
  hash.update(readFileSync(new URL(import.meta.url)));
  for (const name of entries) hash.update(name).update(readFileSync(join(directory, name)));
  const version = hash.digest('hex').slice(0, 20);
  const integrity = Object.fromEntries(entries.map(name => ['/' + name, 'sha256-' + createHash('sha256').update(readFileSync(join(directory, name))).digest('base64')]));
  writeFileSync(join(directory, 'sw.js'), `
const VERSION = '${version}';
const CACHE = 'govclear-shell-' + VERSION;
const FILES = ${JSON.stringify(entries.map(name => '/' + name))};
const INTEGRITY = ${JSON.stringify(integrity)};
self.addEventListener('message', event => {
  if (event.data === 'GET_VERSION') event.ports[0]?.postMessage(VERSION);
});
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      // Installation only succeeds when the entire release is stored.
      await cache.addAll(FILES.map(url => new Request(url, { cache: 'reload', integrity: INTEGRITY[url] })));
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('govclear-shell-') && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const path = event.request.mode === 'navigate' && url.pathname === '/' ? '/index.html' : url.pathname;
  if (!FILES.includes(path)) return;
  event.respondWith((async () => {
    const cached = await (await caches.open(CACHE)).match(path);
    return cached || fetch(event.request);
  })());
});
`);
  return { version, entries };
}
