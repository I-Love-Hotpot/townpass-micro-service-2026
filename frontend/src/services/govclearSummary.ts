const HEADINGS = new Set([
  '先看重點',
  '別漏掉',
  '需要確認',
  // Accept earlier model replies during upgrades.
  '文件主旨',
  '重要事項',
  '行動與期限',
  '原文要求的行動與期限',
  '條件與例外',
  '待確認事項'
]);

export function parseSummary(value: string) {
  const sections: { title: string; text: string }[] = [];
  let title = '先看重點';
  let lines: string[] = [];
  function flush() {
    const text = lines.join('\n').trim();
    if (!text) return;
    if (
      ['需要確認', '待確認事項'].includes(title) &&
      /^(?:未提及|無|沒有|無需確認)[。.!]?$/.test(text)
    )
      return;
    sections.push({ title, text });
  }
  for (const line of value.split('\n')) {
    const plain = line
      .trim()
      .replace(/^#{1,6}\s*/, '')
      .replace(/\*\*/g, '');
    const heading = plain.replace(/[：:]$/, '');
    if (HEADINGS.has(heading)) {
      flush();
      title = heading;
      lines = [];
    } else lines.push(line.replace(/\*\*/g, '').replace(/^\s*[-*]\s+/, '• '));
  }
  flush();
  return sections;
}

export function summaryStats(source: string, summary: string) {
  const count = (text: string) =>
    Array.from(
      text
        .replace(/\*\*/g, '')
        .replace(/^#{1,6}\s*/gm, '')
        .replace(/^\s*[-*•]\s+/gm, '')
        .replace(/\s/g, '')
    ).length;
  const original = count(source);
  const length = count(summary);
  return {
    original,
    summary: length,
    reduction: original ? Math.max(0, Math.round((1 - length / original) * 100)) : 0
  };
}
