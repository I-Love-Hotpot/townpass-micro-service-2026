import { SIX_QUESTIONS, type SixQuestionAnswers } from './govclearSixQuestions';

export function createResult(summary: string, answers: SixQuestionAnswers, inputMode: 'text' | 'image', sourceText: string) {
  return {
    schemaVersion: 1,
    resultId: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    inputMode,
    summary,
    sourceText,
    sixQuestions: Object.fromEntries(SIX_QUESTIONS.map(({ key }) => [key, answers[key]]))
  };
}
export type ResultExport = ReturnType<typeof createResult>;
export async function sendResult(endpoint: string, payload: ResultExport, signal: AbortSignal) {
  const url = new URL(endpoint);
  if (url.username || url.password || !['http:', 'https:'].includes(url.protocol)) throw new Error('後端網址設定無效');
  const response = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), signal, credentials: 'omit', redirect: 'error', cache: 'no-store'
  });
  if (!response.ok) throw new Error(`後端儲存失敗（HTTP ${response.status}），請重試`);
  const receipt = await response.json();
  if (receipt.resultId !== payload.resultId || receipt.status !== 'stored') throw new Error('後端未確認儲存，請重試');
}
