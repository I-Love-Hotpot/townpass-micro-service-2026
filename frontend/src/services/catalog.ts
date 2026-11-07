import type { DocumentAnalysis } from './govclearRag';
import type { DocumentRecord, FileKind, Locale, OriginalFile } from '@/interfaces/document';
import { preparePages } from './files';
import { defaultDestinations, fixtures } from './fixtures';
import { contentHash, findFixture } from './processing';
import { records } from './records';
import { analyzeDocument } from './offline';

let catalogPromise: ReturnType<typeof loadCatalog> | undefined;

async function loadCatalog() {
  if (!import.meta.env.DEV) return [];
  const controller = new AbortController();
  const url = (file: string) =>
    `${import.meta.env.BASE_URL}local-samples/${encodeURIComponent(file)}`;
  async function load(fixture: (typeof fixtures)[number], response: Response) {
    if (!response.ok) throw new Error('Cannot load fixture');
    const blob = await response.blob();
    if ((await contentHash(blob)) !== fixture.hash) throw new Error('Fixture content changed');
    return { fixture, blob };
  }
  try {
    const first = await fetch(url(fixtures[0].file), { signal: controller.signal });
    if (first.status === 404) return [];
    return await Promise.all([
      load(fixtures[0], first),
      ...fixtures
        .slice(1)
        .map(async (fixture) =>
          load(fixture, await fetch(url(fixture.file), { signal: controller.signal }))
        )
    ]);
  } catch (error) {
    controller.abort();
    throw error;
  }
}

function catalog() {
  catalogPromise ??= loadCatalog().catch((error) => {
    catalogPromise = undefined;
    throw error;
  });
  return catalogPromise;
}

export async function importExampleRecords(locale: Locale) {
  const entries = await catalog();
  if (!entries.length) throw new Error('Example files are unavailable');
  const signal = new AbortController().signal;
  const documents: DocumentRecord[] = [];
  for (const { fixture, blob } of entries) {
    const originals = [{ name: fixture.file, blob }];
    documents.push({
      id: fixture.id,
      fixtureId: fixture.id,
      kind: fixture.kind,
      hash: fixture.hash,
      createdAt: Date.parse(`${fixture.date}T12:00:00+08:00`),
      originals,
      pages: await preparePages(originals, fixture.kind, signal),
      summary: fixture.summaries[locale],
      locale,
      status: fixture.status,
      scenarioDate: fixture.scenarioDate,
      destinations: fixture.destinations,
      chat: []
    });
  }
  const count = await records.seed(documents, true);
  catalogPromise = undefined;
  return count;
}

export async function makeDocument(
  originals: OriginalFile[],
  kind: FileKind,
  locale: Locale,
  signal: AbortSignal,
  pages: Blob[],
  source: string,
  onProgress?: (analysis: DocumentAnalysis) => void
): Promise<DocumentRecord> {
  const hash = originals.length === 1 ? await contentHash(originals[0].blob) : null;
  const match = findFixture(fixtures, hash);
  signal.throwIfAborted();
  const title = originals[0].name.replace(/\.[^.]+$/, '');
  const analysis = await analyzeDocument(source, title, locale, signal, onProgress);
  return {
    id: crypto.randomUUID(),
    fixtureId: match?.id,
    hash,
    kind,
    createdAt: Date.now(),
    originals,
    pages,
    source,
    summary: analysis.summary,
    sixQuestions: analysis.sixQuestions,
    analysis,
    locale,
    destinations: match?.destinations ?? defaultDestinations,
    chat: []
  };
}
