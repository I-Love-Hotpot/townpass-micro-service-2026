export const hashText = async (text: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

export function objectJson(raw: string): Record<string, unknown> {
  const text = raw.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1');
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    // Accept prose around one complete object, never repair truncated JSON.
    if (text.startsWith('{') || text.startsWith('[')) throw new Error('模型 JSON 無法解析。');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end < start) throw new Error('模型 JSON 無法解析。');
    value = JSON.parse(text.slice(start, end + 1));
  }
  if (!value || Array.isArray(value) || typeof value !== 'object')
    throw new Error('模型 JSON 無法解析。');
  return value as Record<string, unknown>;
}
