export type ImagePage = {
  id: string;
  name: string;
  preview: string;
  size: number;
  file?: Blob;
  original?: Blob;
  cropConfirmed?: boolean;
  cropDraft?: { corners: import('./documentCrop').Corners; turns: number };
  ownedPreview: boolean;
  text: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  error: string;
};

export function pageReady(page: Pick<ImagePage, 'text' | 'status'>) {
  return page.status === 'done';
}

export function mergePageText(pages: readonly Pick<ImagePage, 'text'>[]) {
  return pages.map((page, index) => `【第 ${index + 1} 張】\n${page.text.trim()}`).join('\n\n');
}

/** Sequential inference limits memory and preserves corrections on completed pages. */
export async function recognizePages(
  pages: ImagePage[],
  recognize: (page: ImagePage, index: number) => Promise<string>,
  active: () => boolean,
  progress: (index: number) => void
) {
  let failures = 0;
  for (let index = 0; index < pages.length; index++) {
    if (!active()) break;
    const page = pages[index];
    if (pageReady(page)) continue;
    page.status = 'processing';
    page.error = '';
    progress(index);
    try {
      const text = (await recognize(page, index)).trim();
      // The caller owns cancellation state; never mutate a newer retry.
      if (!active()) break;
      page.text = text;
      page.status = 'done';
    } catch (error) {
      // The caller owns cancellation state; never mutate a newer retry.
      if (!active()) break;
      page.status = 'error';
      page.error = error instanceof Error ? error.message : '辨識失敗，請重試或手動填入。';
      failures++;
    }
  }
  return failures;
}
