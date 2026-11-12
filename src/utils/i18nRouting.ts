import {
  DEFAULT_LOCALE,
  getLocalizedPagePath,
  isSupportedLocale,
  type PageKey,
  type PlatformPageKey,
  resolveBlogRedirectPath,
  resolveRouteFromPathname,
  type ResolvedRoute,
  type SupportedLocale,
} from '../i18n/config.ts';
import type { ToolSlug } from '../data/seoToolsConfig.ts';
import { SEO_TOOLS_CONFIG } from '../data/seoToolsConfig.ts';

export const DEFAULT_LANGUAGE: SupportedLocale = DEFAULT_LOCALE;

export interface ParsedPath {
  lang: SupportedLocale;
  pageKey: PageKey | 'blog_article' | 'admin' | 'not_found';
  toolSlug: ToolSlug | null;
  blogSlug?: string | null;
  blogArticleId?: string | null;
  isAdmin: boolean;
  isNotFound: boolean;
}

const PLATFORM_TO_PRIMARY_TOOL_SLUG: Record<PlatformPageKey, ToolSlug> = {
  tiktok: 'tiktok-no-watermark',
  instagram: 'instagram-reels',
  x: 'x-video',
  facebook: 'facebook-reels',
  linkedin: 'linkedin-dp',
};

const TOOL_SLUG_TO_PLATFORM_PAGE: Record<ToolSlug, PlatformPageKey> = {
  'tiktok-no-watermark': 'tiktok',
  'tiktok-slideshow': 'tiktok',
  'tiktok-mp3': 'tiktok',
  'tiktok-dp': 'tiktok',
  'instagram-reels': 'instagram',
  'instagram-dp': 'instagram',
  'instagram-carousel': 'instagram',
  'instagram-stories': 'instagram',
  'x-video': 'x',
  'facebook-reels': 'facebook',
  'linkedin-dp': 'linkedin',
  'youtube-shorts': 'tiktok',
  'snapchat-spotlight': 'tiktok',
};

export function isSupportedLanguage(code: string): code is SupportedLocale {
  return isSupportedLocale(code);
}

export function isValidToolSlug(slug: string): slug is ToolSlug {
  return Boolean(
    slug && Object.prototype.hasOwnProperty.call(SEO_TOOLS_CONFIG, slug)
  );
}

export function pageKeyToPrimaryToolSlug(
  pageKey: PageKey | 'blog_article'
): ToolSlug | null {
  if (
    pageKey === 'tiktok' ||
    pageKey === 'instagram' ||
    pageKey === 'x' ||
    pageKey === 'facebook' ||
    pageKey === 'linkedin'
  ) {
    return PLATFORM_TO_PRIMARY_TOOL_SLUG[pageKey];
  }
  return null;
}

export function toolSlugToPageKey(slug?: string | null): PageKey {
  if (!slug) return 'home';
  const clean = slug.replace(/^\/+|\/+$/g, '');
  if (
    clean === 'home' ||
    clean === 'blog' ||
    clean === 'tiktok' ||
    clean === 'instagram' ||
    clean === 'x' ||
    clean === 'facebook' ||
    clean === 'linkedin' ||
    clean === 'about' ||
    clean === 'privacy' ||
    clean === 'terms' ||
    clean === 'contact' ||
    clean === 'dmca'
  ) {
    return clean;
  }
  if (isValidToolSlug(clean)) {
    return TOOL_SLUG_TO_PLATFORM_PAGE[clean];
  }
  return 'home';
}

/**
 * Parses a URL pathname into our 10-language route descriptor:
 * - "/" => { lang: "fr", pageKey: "home", ... }
 * - "/blog" => { lang: "en", pageKey: "blog", ... }
 * - "/blog/tiktok-video-not-downloading" => { lang: "en", pageKey: "blog_article", blogSlug: "tiktok-video-not-downloading", ... }
 * - "/fr/blog" => { lang: "fr", pageKey: "blog", ... }
 * - "/telecharger-video-tiktok" => { lang: "fr", pageKey: "tiktok", toolSlug: "tiktok-no-watermark", ... }
 * - "/en" => { lang: "en", pageKey: "home", ... }
 * - "/en/tiktok-video-downloader" => { lang: "en", pageKey: "tiktok", toolSlug: "tiktok-no-watermark", ... }
 * - "/ar/facebook-video-downloader" => { lang: "ar", pageKey: "facebook", toolSlug: "facebook-reels", ... }
 * - "/admin" => { lang: "fr", pageKey: "admin", isAdmin: true, ... }
 */
export function parsePathname(pathname: string): ParsedPath {
  const resolved: ResolvedRoute = resolveRouteFromPathname(pathname);

  if (resolved.pageKey === 'admin') {
    return {
      lang: DEFAULT_LOCALE,
      pageKey: 'admin',
      toolSlug: null,
      isAdmin: true,
      isNotFound: false,
    };
  }

  if (resolved.pageKey === 'not_found') {
    // Legacy compatibility: check if someone visited an old toolSlug like /instagram-reels or /fr/instagram-reels
    const trimmed = (pathname || '').replace(/^\/+|\/+$/g, '');
    const parts = trimmed.split('/');
    if (parts.length === 1 && isValidToolSlug(parts[0])) {
      const pKey = TOOL_SLUG_TO_PLATFORM_PAGE[parts[0]];
      return {
        lang: DEFAULT_LOCALE,
        pageKey: pKey,
        toolSlug: parts[0],
        isAdmin: false,
        isNotFound: false,
      };
    }
    if (
      parts.length === 2 &&
      isSupportedLocale(parts[0]) &&
      isValidToolSlug(parts[1])
    ) {
      const pKey = TOOL_SLUG_TO_PLATFORM_PAGE[parts[1]];
      return {
        lang: parts[0],
        pageKey: pKey,
        toolSlug: parts[1],
        isAdmin: false,
        isNotFound: false,
      };
    }

    return {
      lang: resolved.locale,
      pageKey: 'not_found',
      toolSlug: null,
      isAdmin: false,
      isNotFound: true,
    };
  }

  return {
    lang: resolved.locale,
    pageKey: resolved.pageKey,
    toolSlug: pageKeyToPrimaryToolSlug(resolved.pageKey),
    blogSlug: resolved.blogSlug || null,
    blogArticleId: resolved.blogArticleId || null,
    isAdmin: false,
    isNotFound: false,
  };
}

/**
 * Builds the canonical localized path for any (locale, pageKey or toolSlug).
 * French ('fr') is at root without prefix; the 9 other languages are under /{code}/.
 */
export function buildLocalizedPath(
  lang: string,
  pageOrSlug?: PageKey | ToolSlug | string | null
): string {
  const validLang: SupportedLocale = isSupportedLocale(lang)
    ? lang
    : DEFAULT_LOCALE;
  if (!pageOrSlug) {
    return getLocalizedPagePath(validLang, 'home');
  }
  const pageKey = toolSlugToPageKey(pageOrSlug);
  return getLocalizedPagePath(validLang, pageKey);
}

export function handleLegacyQueryRedirect(): {
  redirected: boolean;
  path: string;
} {
  if (typeof window === 'undefined') {
    return { redirected: false, path: '' };
  }

  const blogRedirect = resolveBlogRedirectPath(window.location.pathname);
  if (blogRedirect) {
    const finalBlogUrl = `${blogRedirect}${window.location.search}${window.location.hash}`;
    window.history.replaceState({}, '', finalBlogUrl);
    return { redirected: true, path: blogRedirect };
  }

  const search = window.location.search;
  if (!search) {
    return { redirected: false, path: window.location.pathname };
  }

  const params = new URLSearchParams(search);
  const langParam = params.get('lang');
  const toolParam = params.get('tool');

  let shouldRedirect = false;
  const parsed = parsePathname(window.location.pathname);

  let targetLang: SupportedLocale = parsed.lang;
  if (langParam && isSupportedLocale(langParam)) {
    targetLang = langParam;
    params.delete('lang');
    shouldRedirect = true;
  }

  let targetPage: PageKey =
    parsed.pageKey === 'not_found' ||
    parsed.pageKey === 'admin' ||
    parsed.pageKey === 'blog_article'
      ? 'home'
      : parsed.pageKey;
  if (toolParam && isValidToolSlug(toolParam)) {
    targetPage = TOOL_SLUG_TO_PLATFORM_PAGE[toolParam];
    params.delete('tool');
    shouldRedirect = true;
  }

  if (shouldRedirect) {
    const newPath = getLocalizedPagePath(targetLang, targetPage);
    const remaining = params.toString();
    const finalUrl = `${newPath}${remaining ? `?${remaining}` : ''}${window.location.hash}`;

    if (window.location.pathname + window.location.search !== finalUrl) {
      window.history.replaceState(
        { pageKey: targetPage, language: targetLang },
        '',
        finalUrl
      );
      return { redirected: true, path: finalUrl };
    }
  }

  return { redirected: false, path: window.location.pathname };
}
