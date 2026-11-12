import { buildHeadMetadataForRoute } from '../../src/i18n/hreflang.ts';
import type { LanguageCode } from '../../src/i18n/translations.ts';
import { parsePathname } from '../../src/utils/i18nRouting.ts';

export interface PageSeoMetadata {
  lang: LanguageCode;
  dir: 'ltr' | 'rtl';
  title: string;
  description: string;
  canonicalUrl: string;
  hreflangs: Array<{ lang: string; href: string }>;
  xDefaultHref: string;
}

export function resolveSeoMetadataForPath(pathname: string): PageSeoMetadata {
  const parsed = parsePathname(pathname);
  const headMeta = buildHeadMetadataForRoute(
    parsed.lang,
    parsed.isAdmin ? 'admin' : parsed.pageKey,
    parsed.blogSlug
  );

  const hreflangs = headMeta.hreflangs
    .filter((h) => h.hreflang !== 'x-default')
    .map((h) => ({ lang: h.hreflang, href: h.href }));

  const xDefaultEntry = headMeta.hreflangs.find(
    (h) => h.hreflang === 'x-default'
  );

  return {
    lang: headMeta.lang,
    dir: headMeta.dir,
    title: headMeta.title,
    description: headMeta.description,
    canonicalUrl: headMeta.canonicalUrl,
    hreflangs,
    xDefaultHref: xDefaultEntry ? xDefaultEntry.href : headMeta.canonicalUrl,
  };
}

/**
 * Since static pre-rendering (scripts/prerender.mjs) injects complete localized <head>
 * and <body> markup into every route's HTML file at build time, applySeoHtmlRewriter
 * returns the pre-rendered HTML response directly without duplicating <link rel="alternate"> tags.
 */
export function applySeoHtmlRewriter(
  _request: Request,
  response: Response
): Response {
  return response;
}
