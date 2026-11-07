import type { AppContext } from '@/interfaces/document';

export function readAppContext(url: URL): AppContext {
  const hashQuery = url.hash.split('?')[1];
  const params = new URLSearchParams(hashQuery);
  const language = params.get('lang') ?? url.searchParams.get('lang');
  return {
    locale: language === 'id' ? 'id' : 'zh-TW',
    embedded: (params.get('embedded') ?? url.searchParams.get('embedded')) === '1',
    showHeader: url.searchParams.get('header') === '1'
  };
}
