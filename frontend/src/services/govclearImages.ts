export const MAX_IMAGES = 5;
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
export const MAX_TEXT_CHARACTERS = 6000;

export type ImagePage = {
  id: string;
  name: string;
  preview: string;
  size: number;
  file?: Blob;
  ownedPreview: boolean;
  text: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  error: string;
};

type SelectedFile = { name: string; type: string; size: number };

/** Validate the complete addition before mutating the current document. */
export function validateSelection(
  existing: readonly { size: number }[],
  files: readonly SelectedFile[]
) {
  if (existing.length + files.length > MAX_IMAGES)
    throw new Error(`最多可加入 ${MAX_IMAGES} 張圖片，請先移除部分圖片。`);
  for (const file of files) {
    if (!['image/png', 'image/jpeg'].includes(file.type))
      throw new Error(`${file.name}：請選擇 PNG 或 JPEG 圖片。`);
    if (file.size === 0) throw new Error(`${file.name}：圖片是空白檔案。`);
    if (file.size > MAX_IMAGE_BYTES) throw new Error(`${file.name}：單張圖片上限為 20 MB。`);
  }
  const total = [...existing, ...files].reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_TOTAL_BYTES) throw new Error('圖片合計上限為 50 MB，請先縮小或移除部分圖片。');
}

export function pageReady(page: Pick<ImagePage, 'text' | 'status'>) {
  const text = page.text.trim();
  return page.status === 'done' && text.length > 0 && text !== '[無法辨識]';
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
      if (!text || text === '[無法辨識]') throw new Error('沒有可辨識文字，請更換圖片或手動填入。');
      if (Array.from(text).length > MAX_TEXT_CHARACTERS)
        throw new Error('單張辨識文字超過 6,000 字，請分區拍攝。');
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
