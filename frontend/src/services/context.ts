import type { AppContext } from '@/interfaces/document';

export function readAppContext(url: URL): AppContext {
  const hashQuery = url.hash.split('?')[1];
  const params = new URLSearchParams(hashQuery);
  const language = params.get('lang') ?? url.searchParams.get('lang');
  const embedded =
    (params.get('embedded') ?? url.searchParams.get('embedded')) === '1' ||
    url.pathname === '/govclear';
  const header = params.get('header') ?? url.searchParams.get('header');
  return {
    locale: language === 'id' ? 'id' : 'zh-TW',
    embedded,
    showHeader: header === '1' || (header !== '0' && !embedded)
  };
}
