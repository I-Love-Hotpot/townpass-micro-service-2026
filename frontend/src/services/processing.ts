import type { Summary } from '../interfaces/document.ts';

export const progressStages = [
  [8, 180],
  [23, 330],
  [39, 240],
  [64, 450],
  [79, 210],
  [94, 380]
] as const;

export function delay(ms: number, signal: AbortSignal) {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', cancel);
      resolve();
    }, ms);
    function cancel() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    signal.addEventListener('abort', cancel, { once: true });
  });
}

// Wait for both durable storage and the minimum visible animation.
export async function processWithProgress<T>(
  prepare: () => Promise<T>,
  save: (value: T) => Promise<void>,
  report: (progress: number) => void,
  signal: AbortSignal,
  pause = delay
) {
  signal.throwIfAborted();
  report(0);
  const result = Promise.resolve().then(() => {
    signal.throwIfAborted();
    return prepare();
  });
  // Interrupt the animation on failure, but let every step play on success.
  const failure = result.then(() => new Promise<never>(() => {}));
  const animate = async () => {
    for (const [value, ms] of progressStages) {
      await Promise.race([pause(ms, signal), failure]);
      signal.throwIfAborted();
      report(value);
    }
  };
  const [prepared] = await Promise.all([result, animate()]);
  signal.throwIfAborted();
  await save(prepared);
  signal.throwIfAborted();
  report(100);
  return prepared;
}

export async function contentHash(blob: Blob): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function findFixture<T extends { hash: string }>(
  catalog: readonly T[],
  hash: string | null
) {
  return hash ? catalog.find((entry) => entry.hash === hash) : undefined;
}

export function explainAgain(summary: Summary | undefined): Summary {
  if (!summary) throw new Error('No matching summary');
  return summary;
}
