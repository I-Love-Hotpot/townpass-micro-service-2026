import type { Locale, Summary } from '@/interfaces/document';

export function answerQuestion(question: string, summary: Summary | undefined, locale: Locale) {
  if (summary) {
    if (/下一步|怎麼做|如何辦|langkah|apa yang harus/i.test(question)) return summary.action;
    const pattern = /期限|截止|幾時|什麼時候|何時|kapan|tenggat|batas/i.test(question)
      ? /期限|截止|時程|最遲|前[完送函]|tenggat|batas|sebelum|paling lambat/i
      : /資料|附件|文件|準備|dokumen|siap|lampiran/i.test(question)
        ? /準備|檢附|附件|siapkan|lampiran/i
        : /對象|資格|誰|siapa|syarat/i.test(question)
          ? /對象|資格|受文|untuk|penerima|syarat/i
          : null;
    if (pattern) {
      const facts = summary.facts.filter((fact) => pattern.test(fact));
      if (facts.length) return facts.join('\n');
    }
  }
  return locale === 'id'
    ? 'Pertanyaan ini belum tercakup dalam contoh jawaban. Silakan periksa dokumen asli.'
    : '目前的範例回覆未涵蓋這個問題，請查看原始文件。';
}
