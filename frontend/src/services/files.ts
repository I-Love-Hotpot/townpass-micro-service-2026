import type { FileKind, OriginalFile } from '@/interfaces/document';

const MiB = 1024 * 1024;

export function validateFiles(files: File[], kind: FileKind) {
  if (kind === 'pdf') {
    if (
      files.length !== 1 ||
      !/\.pdf$/i.test(files[0].name) ||
      !files[0].size ||
      files[0].size > 25 * MiB
    ) {
      throw new RangeError('Invalid PDF selection');
    }
  } else if (
    !files.length ||
    files.length > 20 ||
    files.some(
      (file) => !/\.(jpe?g|png|webp)$/i.test(file.name) || !file.size || file.size > 10 * MiB
    ) ||
    files.reduce((total, file) => total + file.size, 0) > 50 * MiB
  ) {
    throw new RangeError('Invalid photo selection');
  }
}

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
