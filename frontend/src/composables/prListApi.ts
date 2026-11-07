export async function fetchPreviewLinks(
  apiBaseUrl: string,
  fetcher: typeof fetch = fetch
): Promise<string[]> {
  let response: Response;
  try {
    response = await fetcher(`${apiBaseUrl.replace(/\/+$/, '')}/api/pr-preview-links`);
  } catch (error) {
    throw new Error('無法連線至 PR 預覽 API，請稍後再試。', { cause: error });
  }
  if (!response.ok) {
    throw new Error(`無法取得 PR 預覽列表（HTTP ${response.status}），請聯絡管理員。`);
  }
  const links: unknown = await response.json();
  if (
    !Array.isArray(links) ||
    !links.every(
      (link) =>
        typeof link === 'string' &&
        (link === 'https://tp.dstw.dev' || /^https:\/\/pr-[1-9]\d*\.tp\.dstw\.dev$/.test(link))
    )
  ) {
    throw new Error('PR 預覽 API 回傳的網址列表格式錯誤。');
  }
  return links;
}
