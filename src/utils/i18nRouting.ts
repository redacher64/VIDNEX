import type { ToolSlug } from '../data/seoToolsConfig.ts';
import { SEO_TOOLS_CONFIG } from '../data/seoToolsConfig.ts';
import type { LanguageCode } from '../i18n/translations.ts';
import { SUPPORTED_LANGUAGES } from '../i18n/translations.ts';

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export interface ParsedPath {
  lang: LanguageCode;
  toolSlug: ToolSlug | null;
  isAdmin: boolean;
}

/**
 * Checks whether a given string matches any of the registered languages.
 */
export function isSupportedLanguage(code: string): code is LanguageCode {
  return SUPPORTED_LANGUAGES.some((l) => l.code === code);
}

/**
 * Checks whether a given slug matches any of the registered SEO tool configurations.
 */
export function isValidToolSlug(slug: string): slug is ToolSlug {
  return Boolean(slug && Object.prototype.hasOwnProperty.call(SEO_TOOLS_CONFIG, slug));
}

/**
 * Parses a pathname into its localized components: language, tool slug, and admin flag.
 *
 * Examples:
 * - "/" => { lang: "en", toolSlug: null, isAdmin: false }
 * - "/fr" => { lang: "fr", toolSlug: null, isAdmin: false }
 * - "/instagram-reels" => { lang: "en", toolSlug: "instagram-reels", isAdmin: false }
 * - "/fr/instagram-reels" => { lang: "fr", toolSlug: "instagram-reels", isAdmin: false }
 * - "/admin" or "/admin/stats" => { lang: "en", toolSlug: null, isAdmin: true }
 */
export function parsePathname(pathname: string): ParsedPath {
  const trimmed = (pathname || '').replace(/^\/+|\/+$/g, '');

  if (!trimmed) {
    return { lang: DEFAULT_LANGUAGE, toolSlug: null, isAdmin: false };
  }

  const segments = trimmed.split('/');
  const first = segments[0];

  // Admin routes remain top-level and unlocalized
  if (first === 'admin') {
    return { lang: DEFAULT_LANGUAGE, toolSlug: null, isAdmin: true };
  }

  // Check if first segment is a supported language
  if (isSupportedLanguage(first)) {
    const lang = first;
    const second = segments[1];

    if (second && isValidToolSlug(second)) {
      return { lang, toolSlug: second, isAdmin: false };
    }

    return { lang, toolSlug: null, isAdmin: false };
  }

  // No language prefix -> default English
  if (isValidToolSlug(first)) {
    return { lang: DEFAULT_LANGUAGE, toolSlug: first, isAdmin: false };
  }

  return { lang: DEFAULT_LANGUAGE, toolSlug: null, isAdmin: false };
}

/**
 * Builds a localized path with subfolder architecture for non-default languages
 * and root paths for default English.
 *
 * Examples:
 * - buildLocalizedPath('en') => '/'
 * - buildLocalizedPath('fr') => '/fr'
 * - buildLocalizedPath('en', 'instagram-reels') => '/instagram-reels'
 * - buildLocalizedPath('fr', 'instagram-reels') => '/fr/instagram-reels'
 */
export function buildLocalizedPath(lang: string, slug?: string | null): string {
  const cleanSlug = (slug || '').replace(/^\/+|\/+$/g, '');
  const isEn = lang === DEFAULT_LANGUAGE;

  if (!cleanSlug) {
    return isEn ? '/' : `/${lang}`;
  }

  return isEn ? `/${cleanSlug}` : `/${lang}/${cleanSlug}`;
}

/**
 * Backward-compatibility helper:
 * Detects legacy query parameters (e.g. ?lang=fr or ?tool=instagram-reels&lang=fr)
 * and seamlessly redirects via window.history.replaceState to the new subfolder URL
 * (/fr/instagram-reels).
 */
export function handleLegacyQueryRedirect(): {
  redirected: boolean;
  path: string;
} {
  if (typeof window === 'undefined') {
    return { redirected: false, path: '' };
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

  // Determine target language
  let targetLang: LanguageCode = parsed.lang;
  if (langParam && isSupportedLanguage(langParam)) {
    targetLang = langParam;
    params.delete('lang');
    shouldRedirect = true;
  }

  // Determine target tool slug
  let targetSlug: ToolSlug | null = parsed.toolSlug;
  if (toolParam && isValidToolSlug(toolParam)) {
    targetSlug = toolParam;
    params.delete('tool');
    shouldRedirect = true;
  }

  // If path was /?lang=fr, targetSlug might be null, so we redirect to /fr
  if (shouldRedirect) {
    const newPath = buildLocalizedPath(targetLang, targetSlug);
    const remaining = params.toString();
    const finalUrl = `${newPath}${remaining ? `?${remaining}` : ''}${window.location.hash}`;

    if (window.location.pathname + window.location.search !== finalUrl) {
      window.history.replaceState(
        { slug: targetSlug || 'instagram-reels', language: targetLang },
        '',
        finalUrl
      );
      return { redirected: true, path: finalUrl };
    }
  }

  return { redirected: false, path: window.location.pathname };
}
