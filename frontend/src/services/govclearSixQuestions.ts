export const SIX_QUESTIONS = [
  { key: 'who', title: '何人', hint: '涉及誰、適用對象' },
  { key: 'what', title: '何事', hint: '發生什麼、要處理什麼' },
  { key: 'when', title: '何時', hint: '日期、時間與期限' },
  { key: 'where', title: '何地', hint: '事件或辦理地點' },
  { key: 'why', title: '為何', hint: '原文明說的原因' },
  { key: 'how', title: '如何', hint: '方式、金額與條件' }
] as const;
export type SixQuestionKey = (typeof SIX_QUESTIONS)[number]['key'];
export type SixQuestionAnswers = Record<SixQuestionKey, string | null>;

/** Reject partial/malformed responses instead of presenting missing output as missing facts. */
export function parseSixQuestions(raw: string): SixQuestionAnswers {
  try {
    const text = raw.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, '$1');
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      // Accept prose around one object, never repair a truncated JSON document.
      if (text.startsWith('{') || text.startsWith('[')) throw new Error();
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start < 0 || end < start) throw new Error();
      value = JSON.parse(text.slice(start, end + 1));
    }
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
    const fields = value as Record<string, unknown>;
    const result = {} as SixQuestionAnswers;
    for (const { key, title } of SIX_QUESTIONS) {
      const present = [key, title].filter((name) =>
        Object.prototype.hasOwnProperty.call(fields, name)
      );
      if (present.length !== 1) throw new Error();
      const item = fields[present[0]];
      if (item === null) {
        result[key] = null;
        continue;
      }
      if (typeof item === 'string' && item.trim()) {
        result[key] = item.trim();
        continue;
      }
      if (
        Array.isArray(item) &&
        item.length &&
        item.every((entry) => typeof entry === 'string' && entry.trim())
      ) {
        result[key] = item.map((entry) => `• ${entry.trim()}`).join('\n');
        continue;
      }
      throw new Error();
    }
    return result;
  } catch {
    throw new Error('六何整理回應不完整，請重試；原有摘要已保留。');
  }
}
