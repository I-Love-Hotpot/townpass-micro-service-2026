import type { AppContext } from '@/interfaces/document';

export function readAppContext(
  url: URL,
  systemLanguage = globalThis.navigator?.language ?? 'zh-TW'
): AppContext {
  const hashQuery = url.hash.split('?')[1];
  const params = new URLSearchParams(hashQuery);
  const language = params.get('lang') ?? url.searchParams.get('lang') ?? systemLanguage;
  const code = language.toLowerCase().split(/[-_]/)[0];
  const embedded =
    (params.get('embedded') ?? url.searchParams.get('embedded')) === '1' ||
    url.pathname === '/govclear';
  const header = params.get('header') ?? url.searchParams.get('header');
  return {
    locale: code === 'id' ? 'id' : 'zh-TW',
    appLanguage: code === 'en' ? 'en' : code === 'id' ? 'id' : 'zh-TW',
    embedded,
    showHeader: header === '1'
  };
}
