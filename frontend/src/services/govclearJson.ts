export const hashText = async (text: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

export function objectJson(raw: string): Record<string, unknown> {
  const value: unknown = JSON.parse(raw.trim().replace(/^```json\s*([\s\S]*?)\s*```$/, '$1'));
  if (!value || Array.isArray(value) || typeof value !== 'object')
    throw new Error('模型 JSON 無法解析。');
  return value as Record<string, unknown>;
}
