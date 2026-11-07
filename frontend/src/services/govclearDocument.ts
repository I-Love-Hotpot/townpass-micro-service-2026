import type { Locale, Summary } from '../interfaces/document.ts';
import { GovClearBridge } from './govclearBridge';
import { parseSummary } from './govclearSummary';

type Policies = { policy: string; mobilePolicy: string; reviewPolicy: string };

export function validateSource(text: string) {
  if (!text.trim() || text.trim() === '[無法辨識]') throw new Error('沒有可辨識文字，請重新選檔。');
  if (Array.from(text).length > 6000)
    throw new Error('合併文字超過 6,000 字，請減少頁數或分批處理；原文不會被截斷。');
  return text;
}

export async function withInference<T>(
  signal: AbortSignal,
  operation: (bridge: GovClearBridge) => Promise<T>,
  bridge = new GovClearBridge()
) {
  signal.throwIfAborted();
  const cancel = () => bridge.cancel();
  signal.addEventListener('abort', cancel, { once: true });
  try {
    await bridge.connect(signal);
    signal.throwIfAborted();
    const result = await operation(bridge);
    signal.throwIfAborted();
    return result;
  } finally {
    signal.removeEventListener('abort', cancel);
    bridge.dispose();
  }
}

export async function summarizeSource(
  bridge: GovClearBridge,
  text: string,
  title: string,
  locale: Locale,
  policies: Policies
): Promise<Summary> {
  validateSource(text);
  const language = locale === 'id' ? '\n請用印尼文回答。\n' : '\n請用繁體中文回答。\n';
  const raw = await bridge.request('summarize', {
    text,
    policy: policies.policy + language,
    mobilePolicy: policies.mobilePolicy + language,
    reviewPolicy: policies.reviewPolicy + language
  });
  if (!raw.trim()) throw new Error('模型未回傳摘要，請重試。');
  const sections = parseSummary(raw);
  if (!sections.length) throw new Error('模型未回傳有效摘要，請重試。');
  return {
    title,
    facts: sections.map(({ title, text }) => `${title}\n${text}`),
    action:
      locale === 'id' ? 'Periksa kembali dokumen asli.' : '請核對下方原始文件的期限、金額與條件。'
  };
}

export async function transcribePages(
  bridge: GovClearBridge,
  pages: Blob[],
  signal: AbortSignal,
  encode: (blob: Blob) => Promise<string>
) {
  const texts: string[] = [];
  for (const [index, page] of pages.entries()) {
    signal.throwIfAborted();
    const image = await encode(page);
    signal.throwIfAborted();
    const text = validateSource(await bridge.request('transcribe', { image }));
    signal.throwIfAborted();
    texts.push(`【第 ${index + 1} 頁】\n${text}`);
    validateSource(texts.join('\n\n'));
  }
  return validateSource(texts.join('\n\n'));
}
