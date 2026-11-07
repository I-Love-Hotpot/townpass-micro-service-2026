import type { FileKind, OriginalFile } from '@/interfaces/document';
export async function preparePages(files: OriginalFile[], kind: FileKind, signal: AbortSignal) {
  if (kind === 'pdf') {
    const { renderPdf } = await import('./renderPdf');
    return renderPdf(files[0].blob, signal);
  }
  for (const { blob } of files) {
    signal.throwIfAborted();
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  signal.throwIfAborted();
  return files.map(({ blob }) => blob);
}
