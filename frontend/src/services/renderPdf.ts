import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

export async function renderPdf(file: Blob, signal: AbortSignal): Promise<Blob[]> {
  const data = new Uint8Array(await file.arrayBuffer());
  signal.throwIfAborted();
  if (!new TextDecoder().decode(data.slice(0, 1024)).includes('%PDF-'))
    throw new Error('Invalid PDF');
  const support = new URL(`${import.meta.env.BASE_URL}pdf-support/`, location.origin);
  const task = getDocument({
    data,
    stopAtErrors: true,
    cMapUrl: new URL('cmaps/', support).href,
    cMapPacked: true,
    standardFontDataUrl: new URL('standard_fonts/', support).href,
    wasmUrl: new URL('wasm/', support).href,
    iccUrl: new URL('iccs/', support).href
  });
  let destruction: Promise<void> | undefined;
  const cancel = () => {
    destruction ??= task.destroy();
    void destruction.catch(() => {});
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const pdf = await task.promise;
    if (pdf.numPages < 1 || pdf.numPages > 50) throw new RangeError('PDF page limit');
    const pages: Blob[] = [];
    for (let index = 1; index <= pdf.numPages; index++) {
      signal.throwIfAborted();
      const page = await pdf.getPage(index);
      const original = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: Math.min(2, 1500 / Math.max(original.width, original.height))
      });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      try {
        await page.render({ canvas, viewport }).promise;
        pages.push(
          await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (blob) => (blob ? resolve(blob) : reject(new Error('Canvas conversion failed'))),
              'image/jpeg',
              0.88
            );
          })
        );
      } finally {
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
      }
    }
    signal.throwIfAborted();
    return pages;
  } finally {
    signal.removeEventListener('abort', cancel);
    await (destruction ?? task.destroy());
  }
}
