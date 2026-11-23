/**
 * Architecture multilingue SEO internationale de VIDNEX (Phase 1 : 10 langues).
 * - Français ('fr') est la langue par défaut à la racine SANS préfixe (/ , /telecharger-video-tiktok, etc.).
 * - Les 9 autres langues ('en', 'ar', 'es', 'pt', 'de', 'tr', 'id', 'it', 'ru') sont servies sous /{code}/...
 * - Les slugs des 4 plateformes sont localisés pour les alphabets latins (fr, en, es, pt, de, tr, id, it)
 *   et utilisent les slugs anglais sous le préfixe de langue pour 'ar' et 'ru'.
 */

export type SupportedLocale =
  | 'fr'
  | 'en'
  | 'ar'
  | 'es'
  | 'pt'
  | 'de'
  | 'tr'
  | 'id'
  | 'it'
  | 'ru';

export type Locale = SupportedLocale;

export type PlatformPageKey =
  | 'tiktok'
  | 'instagram'
  | 'x'
  | 'facebook'
  | 'linkedin';

export type LegalPageKey = 'about' | 'privacy' | 'terms' | 'contact' | 'dmca';

export type PageKey =
  | 'home'
  | PlatformPageKey
  | LegalPageKey
  | 'blog'
  | 'tools_hub'
  | 'split_image'
  | 'video_to_mp3';
export type RoutePageKey = PageKey | 'blog_article';

import {
  BLOG_HUB_LOCALES,
  type BlogLocale,
  getBlogHomePath,
  getPublishedArticleBySlug,
  getPublishedArticlesForLocale,
  isBlogHubLocale,
} from '../data/blogArticles.ts';

export interface LocaleDefinition {
  code: SupportedLocale;
  nativeName: string;
  shortLabel: string;
  dir: 'ltr' | 'rtl';
  hreflang: string;
  ogLocale: string;
  prefix: string;
  urlPrefix: string;
  hasNativeLegalPages: boolean;
}

export const DEFAULT_LOCALE: SupportedLocale = 'fr';
export const BLOG_DEFAULT_LOCALE: SupportedLocale = 'en';

export const BLOG_NAV_LABELS: Record<SupportedLocale, string> = {
  fr: 'Blog',
  en: 'Blog',
  ar: 'المدونة',
  es: 'Blog',
  pt: 'Blog',
  de: 'Blog',
  tr: 'Blog',
  id: 'Blog',
  it: 'Blog',
  ru: 'Блог',
};

export function getBlogNavLabel(locale: SupportedLocale): string {
  return BLOG_NAV_LABELS[locale] || 'Blog';
}

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = [
  'fr',
  'en',
  'ar',
  'es',
  'pt',
  'de',
  'tr',
  'id',
  'it',
  'ru',
] as const;

export const SUPPORTED_LOCALE_CODES = SUPPORTED_LOCALES;

export const LOCALES_CONFIG: Record<SupportedLocale, LocaleDefinition> = {
  fr: {
    code: 'fr',
    nativeName: 'Français',
    shortLabel: 'FR',
    dir: 'ltr',
    hreflang: 'fr',
    ogLocale: 'fr_FR',
    prefix: '',
    urlPrefix: '',
    hasNativeLegalPages: true,
  },
  en: {
    code: 'en',
    nativeName: 'English',
    shortLabel: 'EN',
    dir: 'ltr',
    hreflang: 'en',
    ogLocale: 'en_US',
    prefix: '/en',
    urlPrefix: '/en',
    hasNativeLegalPages: true,
  },
  ar: {
    code: 'ar',
    nativeName: 'العربية',
    shortLabel: 'AR',
    dir: 'rtl',
    hreflang: 'ar',
    ogLocale: 'ar_AR',
    prefix: '/ar',
    urlPrefix: '/ar',
    hasNativeLegalPages: true,
  },
  es: {
    code: 'es',
    nativeName: 'Español',
    shortLabel: 'ES',
    dir: 'ltr',
    hreflang: 'es',
    ogLocale: 'es_ES',
    prefix: '/es',
    urlPrefix: '/es',
    hasNativeLegalPages: true,
  },
  pt: {
    code: 'pt',
    nativeName: 'Português',
    shortLabel: 'PT',
    dir: 'ltr',
    hreflang: 'pt',
    ogLocale: 'pt_BR',
    prefix: '/pt',
    urlPrefix: '/pt',
    hasNativeLegalPages: true,
  },
  de: {
    code: 'de',
    nativeName: 'Deutsch',
    shortLabel: 'DE',
    dir: 'ltr',
    hreflang: 'de',
    ogLocale: 'de_DE',
    prefix: '/de',
    urlPrefix: '/de',
    hasNativeLegalPages: true,
  },
  tr: {
    code: 'tr',
    nativeName: 'Türkçe',
    shortLabel: 'TR',
    dir: 'ltr',
    hreflang: 'tr',
    ogLocale: 'tr_TR',
    prefix: '/tr',
    urlPrefix: '/tr',
    hasNativeLegalPages: true,
  },
  id: {
    code: 'id',
    nativeName: 'Bahasa Indonesia',
    shortLabel: 'ID',
    dir: 'ltr',
    hreflang: 'id',
    ogLocale: 'id_ID',
    prefix: '/id',
    urlPrefix: '/id',
    hasNativeLegalPages: true,
  },
  it: {
    code: 'it',
    nativeName: 'Italiano',
    shortLabel: 'IT',
    dir: 'ltr',
    hreflang: 'it',
    ogLocale: 'it_IT',
    prefix: '/it',
    urlPrefix: '/it',
    hasNativeLegalPages: true,
  },
  ru: {
    code: 'ru',
    nativeName: 'Русский',
    shortLabel: 'RU',
    dir: 'ltr',
    hreflang: 'ru',
    ogLocale: 'ru_RU',
    prefix: '/ru',
    urlPrefix: '/ru',
    hasNativeLegalPages: true,
  },
};

export const PLATFORM_PAGE_KEYS: readonly PlatformPageKey[] = [
  'tiktok',
  'instagram',
  'x',
  'facebook',
  'linkedin',
] as const;

export const LEGAL_PAGE_KEYS: readonly LegalPageKey[] = [
  'about',
  'privacy',
  'terms',
  'contact',
  'dmca',
] as const;

export const TOOL_PAGE_KEYS = [
  'home',
  'tiktok',
  'instagram',
  'x',
  'facebook',
  'linkedin',
  'split_image',
  'video_to_mp3',
] as const;

export type ToolPageKey = (typeof TOOL_PAGE_KEYS)[number];

export const LEGAL_SUPPORTED_LOCALES: readonly SupportedLocale[] =
  SUPPORTED_LOCALES;

export function isPlatformPageKey(value: unknown): value is PlatformPageKey {
  return (
    typeof value === 'string' &&
    PLATFORM_PAGE_KEYS.includes(value as PlatformPageKey)
  );
}

export function isLegalPageKey(value: unknown): value is LegalPageKey {
  return (
    typeof value === 'string' &&
    LEGAL_PAGE_KEYS.includes(value as LegalPageKey)
  );
}

export function isToolPageKey(value: unknown): value is ToolPageKey {
  return (
    typeof value === 'string' &&
    (TOOL_PAGE_KEYS as readonly string[]).includes(value)
  );
}

/**
 * Table des slugs localisés par langue pour les 5 pages plateformes.
 * - Alphabets latins (fr, en, es, pt, de, tr, id, it) : slugs dans la langue cible
 * - Alphabets non-latins (ar, ru) : slugs anglais sous le préfixe /ar/ et /ru/
 */
export const PLATFORM_SLUGS: Record<
  SupportedLocale,
  Record<PlatformPageKey, string>
> = {
  fr: {
    tiktok: 'telecharger-video-tiktok',
    instagram: 'telecharger-reel-instagram',
    x: 'telecharger-video-x-twitter',
    facebook: 'telecharger-video-facebook',
    linkedin: 'telecharger-photo-profil-linkedin',
  },
  en: {
    tiktok: 'tiktok-video-downloader',
    instagram: 'instagram-reels-downloader',
    x: 'x-twitter-video-downloader',
    facebook: 'facebook-video-downloader',
    linkedin: 'linkedin-profile-picture-downloader',
  },
  ar: {
    tiktok: 'tiktok-video-downloader',
    instagram: 'instagram-reels-downloader',
    x: 'x-twitter-video-downloader',
    facebook: 'facebook-video-downloader',
    linkedin: 'linkedin-profile-picture-downloader',
  },
  es: {
    tiktok: 'descargar-video-tiktok',
    instagram: 'descargar-reels-instagram',
    x: 'descargar-video-x-twitter',
    facebook: 'descargar-video-facebook',
    linkedin: 'descargar-foto-perfil-linkedin',
  },
  pt: {
    tiktok: 'baixar-video-tiktok',
    instagram: 'baixar-reels-instagram',
    x: 'baixar-video-x-twitter',
    facebook: 'baixar-video-facebook',
    linkedin: 'baixar-foto-perfil-linkedin',
  },
  de: {
    tiktok: 'tiktok-video-herunterladen',
    instagram: 'instagram-reels-herunterladen',
    x: 'x-twitter-video-herunterladen',
    facebook: 'facebook-video-herunterladen',
    linkedin: 'linkedin-profilbild-herunterladen',
  },
  tr: {
    tiktok: 'tiktok-video-indir',
    instagram: 'instagram-reels-indir',
    x: 'x-twitter-video-indir',
    facebook: 'facebook-video-indir',
    linkedin: 'linkedin-profil-fotografi-indir',
  },
  id: {
    tiktok: 'download-video-tiktok',
    instagram: 'download-reels-instagram',
    x: 'download-video-x-twitter',
    facebook: 'download-video-facebook',
    linkedin: 'download-foto-profil-linkedin',
  },
  it: {
    tiktok: 'scaricare-video-tiktok',
    instagram: 'scaricare-reel-instagram',
    x: 'scaricare-video-x-twitter',
    facebook: 'scaricare-video-facebook',
    linkedin: 'scaricare-foto-profilo-linkedin',
  },
  ru: {
    tiktok: 'tiktok-video-downloader',
    instagram: 'instagram-reels-downloader',
    x: 'x-twitter-video-downloader',
    facebook: 'facebook-video-downloader',
    linkedin: 'linkedin-profile-picture-downloader',
  },
};

/**
 * Alias de slugs alternatifs acceptés à la résolution d'URL pour éviter tout 404
 * (ex: telecharger-video-instagram, descargar-videos-facebook, twitter-x-video-downloader).
 */
export const ALT_PLATFORM_SLUGS: Record<string, PlatformPageKey> = {
  'telecharger-video-instagram': 'instagram',
  'descargar-videos-facebook': 'facebook',
  'descargar-videos-tiktok': 'tiktok',
  'descargar-videos-instagram': 'instagram',
  'descargar-videos-twitter-x': 'x',
  'twitter-x-video-downloader': 'x',
  'instagram-video-downloader': 'instagram',
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
  'telecharger-photo-linkedin': 'linkedin',
  'linkedin-photo-downloader': 'linkedin',
};

/**
 * Slugs des pages de confiance / légales (natifs et complets dans les 10 langues).
 * - FR à la racine : /a-propos, /confidentialite, /conditions, /contact, /dmca
 * - 9 autres langues : /{lang}/about, /{lang}/privacy, /{lang}/terms, /{lang}/contact, /{lang}/dmca
 */
const STANDARD_LEGAL_SLUGS: Record<LegalPageKey, string> = {
  about: 'about',
  privacy: 'privacy',
  terms: 'terms',
  contact: 'contact',
  dmca: 'dmca',
};

export const LEGAL_SLUGS: Record<
  SupportedLocale,
  Record<LegalPageKey, string>
> = {
  fr: {
    about: 'a-propos',
    privacy: 'confidentialite',
    terms: 'conditions',
    contact: 'contact',
    dmca: 'dmca',
  },
  en: STANDARD_LEGAL_SLUGS,
  ar: STANDARD_LEGAL_SLUGS,
  es: STANDARD_LEGAL_SLUGS,
  pt: STANDARD_LEGAL_SLUGS,
  de: STANDARD_LEGAL_SLUGS,
  tr: STANDARD_LEGAL_SLUGS,
  id: STANDARD_LEGAL_SLUGS,
  it: STANDARD_LEGAL_SLUGS,
  ru: STANDARD_LEGAL_SLUGS,
};

export function isSupportedLocale(
  value: string | null | undefined
): value is SupportedLocale {
  return Boolean(
    value && SUPPORTED_LOCALES.includes(value as SupportedLocale)
  );
}

export function getLocaleDefinition(locale: SupportedLocale): LocaleDefinition {
  return LOCALES_CONFIG[locale] || LOCALES_CONFIG.fr;
}

/**
 * Construit le chemin relatif canonique pour une langue et une clé de page donnée.
 */
export function getLocalizedPagePath(
  locale: SupportedLocale,
  pageKey: PageKey
): string {
  const def = getLocaleDefinition(locale);

  if (pageKey === 'home') {
    return def.prefix || '/';
  }

  if (pageKey === 'tools_hub') {
    return `${def.prefix}/tools`;
  }

  if (pageKey === 'split_image') {
    return `${def.prefix}/tools/split-image`;
  }

  if (pageKey === 'video_to_mp3') {
    return `${def.prefix}/tools/video/video-to-mp3`;
  }

  if (pageKey === 'blog') {
    return getBlogHomePath(locale);
  }

  if (isPlatformPageKey(pageKey)) {
    const slug = PLATFORM_SLUGS[locale][pageKey];
    return `${def.prefix}/${slug}`;
  }

  if (isLegalPageKey(pageKey)) {
    const slug = LEGAL_SLUGS[locale][pageKey];
    return `${def.prefix}/${slug}`;
  }

  return def.prefix || '/';
}

export interface ResolvedRoute {
  isValidRoute: boolean;
  isNotFound: boolean;
  isAdmin: boolean;
  locale: SupportedLocale;
  pageKey: PageKey | 'blog_article' | 'admin' | 'not_found';
  platformKey: PlatformPageKey | null;
  legalKey: LegalPageKey | null;
  blogSlug?: string | null;
  blogArticleId?: string | null;
  canonicalPath: string;
  isLegacyAlias?: boolean;
}

/**
 * Résout un pathname URL vers sa langue, son type de page (home, platform, legal, blog, blog_article, split_image, admin)
 * ou signale `isValidRoute: false` / `isNotFound: true` (pour renvoyer un vrai 404).
 */
export function resolveRouteFromPathname(rawPathname: string): ResolvedRoute {
  const clean = (rawPathname || '/').split('?')[0].split('#')[0];
  const trimmed = clean.replace(/^\/+|\/+$/g, '');

  // 1. Racine '/' => Accueil en français (langue par défaut sans préfixe)
  if (!trimmed) {
    return {
      isValidRoute: true,
      isNotFound: false,
      isAdmin: false,
      locale: DEFAULT_LOCALE,
      pageKey: 'home',
      platformKey: null,
      legalKey: null,
      canonicalPath: '/',
    };
  }

  const segments = trimmed.split('/');
  const first = segments[0];

  // 2. Route /admin (toujours client-side, noindex)
  if (first === 'admin') {
    return {
      isValidRoute: true,
      isNotFound: false,
      isAdmin: true,
      locale: DEFAULT_LOCALE,
      pageKey: 'admin',
      platformKey: null,
      legalKey: null,
      canonicalPath: '/admin',
    };
  }

  // 2a. Routes /tools, /tools/split-image et /tools/video/video-to-mp3 en français (langue par défaut)
  if (first === 'tools' && segments.length === 1) {
    return {
      isValidRoute: true,
      isNotFound: false,
      isAdmin: false,
      locale: DEFAULT_LOCALE,
      pageKey: 'tools_hub',
      platformKey: null,
      legalKey: null,
      canonicalPath: '/tools',
    };
  }

  if (first === 'tools' && segments.length === 2 && segments[1] === 'split-image') {
    return {
      isValidRoute: true,
      isNotFound: false,
      isAdmin: false,
      locale: DEFAULT_LOCALE,
      pageKey: 'split_image',
      platformKey: null,
      legalKey: null,
      canonicalPath: '/tools/split-image',
    };
  }

  if (
    first === 'tools' &&
    segments.length === 3 &&
    segments[1] === 'video' &&
    segments[2] === 'video-to-mp3'
  ) {
    return {
      isValidRoute: true,
      isNotFound: false,
      isAdmin: false,
      locale: DEFAULT_LOCALE,
      pageKey: 'video_to_mp3',
      platformKey: null,
      legalKey: null,
      canonicalPath: '/tools/video/video-to-mp3',
    };
  }

  // 2b. Route /blog et /blog/{slug} => redirigées en 301 vers /en/blog et /en/blog/{slug} via resolveBlogRedirectPath
  if (first === 'blog') {
    return {
      isValidRoute: false,
      isNotFound: true,
      isAdmin: false,
      locale: 'en',
      pageKey: 'not_found',
      platformKey: null,
      legalKey: null,
      canonicalPath: '/en/blog',
    };
  }

  // 3. Route avec préfixe de langue (/en, /ar, /es, /pt, /de, /tr, /id, /it, /ru)
  if (isSupportedLocale(first) && first !== DEFAULT_LOCALE) {
    const locale = first;

    if (segments.length === 1) {
      return {
        isValidRoute: true,
        isNotFound: false,
        isAdmin: false,
        locale,
        pageKey: 'home',
        platformKey: null,
        legalKey: null,
        canonicalPath: `/${locale}`,
      };
    }

    // Hub /tools sous préfixe de langue (ex: /en/tools)
    if (segments.length === 2 && segments[1] === 'tools') {
      return {
        isValidRoute: true,
        isNotFound: false,
        isAdmin: false,
        locale,
        pageKey: 'tools_hub',
        platformKey: null,
        legalKey: null,
        canonicalPath: getLocalizedPagePath(locale, 'tools_hub'),
      };
    }

    // Outil /tools/split-image sous préfixe de langue (ex: /en/tools/split-image)
    if (
      segments.length === 3 &&
      segments[1] === 'tools' &&
      segments[2] === 'split-image'
    ) {
      return {
        isValidRoute: true,
        isNotFound: false,
        isAdmin: false,
        locale,
        pageKey: 'split_image',
        platformKey: null,
        legalKey: null,
        canonicalPath: getLocalizedPagePath(locale, 'split_image'),
      };
    }

    // Outil /tools/video/video-to-mp3 sous préfixe de langue (ex: /en/tools/video/video-to-mp3)
    if (
      segments.length === 4 &&
      segments[1] === 'tools' &&
      segments[2] === 'video' &&
      segments[3] === 'video-to-mp3'
    ) {
      return {
        isValidRoute: true,
        isNotFound: false,
        isAdmin: false,
        locale,
        pageKey: 'video_to_mp3',
        platformKey: null,
        legalKey: null,
        canonicalPath: getLocalizedPagePath(locale, 'video_to_mp3'),
      };
    }

    // Blog sous préfixe de langue : /en/blog, /es/blog, /de/blog, /ar/blog
    if (segments[1] === 'blog') {
      if (isBlogHubLocale(locale)) {
        if (segments.length === 2) {
          return {
            isValidRoute: true,
            isNotFound: false,
            isAdmin: false,
            locale,
            pageKey: 'blog',
            platformKey: null,
            legalKey: null,
            canonicalPath: `/${locale}/blog`,
          };
        }
        if (segments.length === 3) {
          const resolvedLoc = getPublishedArticleBySlug(
            locale as BlogLocale,
            segments[2]
          );
          if (resolvedLoc) {
            return {
              isValidRoute: true,
              isNotFound: false,
              isAdmin: false,
              locale,
              pageKey: 'blog_article',
              platformKey: null,
              legalKey: null,
              blogSlug: resolvedLoc.translation.localizedSlug,
              blogArticleId: resolvedLoc.article.id,
              canonicalPath: resolvedLoc.canonicalPath,
            };
          }
        }
      }

      return {
        isValidRoute: false,
        isNotFound: true,
        isAdmin: false,
        locale,
        pageKey: 'not_found',
        platformKey: null,
        legalKey: null,
        canonicalPath: isBlogHubLocale(locale) ? `/${locale}/blog` : `/${locale}`,
      };
    }

    if (segments.length === 2) {
      const second = segments[1];

      for (const pKey of PLATFORM_PAGE_KEYS) {
        if (PLATFORM_SLUGS[locale][pKey] === second) {
          return {
            isValidRoute: true,
            isNotFound: false,
            isAdmin: false,
            locale,
            pageKey: pKey,
            platformKey: pKey,
            legalKey: null,
            canonicalPath: getLocalizedPagePath(locale, pKey),
          };
        }
      }

      for (const lKey of LEGAL_PAGE_KEYS) {
        if (LEGAL_SLUGS[locale][lKey] === second) {
          return {
            isValidRoute: true,
            isNotFound: false,
            isAdmin: false,
            locale,
            pageKey: lKey,
            platformKey: null,
            legalKey: lKey,
            canonicalPath: getLocalizedPagePath(locale, lKey),
          };
        }
      }

      if (second in ALT_PLATFORM_SLUGS) {
        const pKey = ALT_PLATFORM_SLUGS[second];
        return {
          isValidRoute: true,
          isNotFound: false,
          isAdmin: false,
          locale,
          pageKey: pKey,
          platformKey: pKey,
          legalKey: null,
          canonicalPath: getLocalizedPagePath(locale, pKey),
          isLegacyAlias: true,
        };
      }
    }

    return {
      isValidRoute: false,
      isNotFound: true,
      isAdmin: false,
      locale,
      pageKey: 'not_found',
      platformKey: null,
      legalKey: null,
      canonicalPath: `/${locale}`,
    };
  }

  // Support de /fr/blog, /fr/blog/{slug} et d'un ancien lien /fr ou /fr/...
  if (first === 'fr') {
    if (segments.length === 2 && segments[1] === 'tools') {
      return {
        isValidRoute: true,
        isNotFound: false,
        isAdmin: false,
        locale: 'fr',
        pageKey: 'tools_hub',
        platformKey: null,
        legalKey: null,
        canonicalPath: '/tools',
        isLegacyAlias: true,
      };
    }

    if (
      segments.length === 3 &&
      segments[1] === 'tools' &&
      segments[2] === 'split-image'
    ) {
      return {
        isValidRoute: true,
        isNotFound: false,
        isAdmin: false,
        locale: 'fr',
        pageKey: 'split_image',
        platformKey: null,
        legalKey: null,
        canonicalPath: '/tools/split-image',
        isLegacyAlias: true,
      };
    }

    if (
      segments.length === 4 &&
      segments[1] === 'tools' &&
      segments[2] === 'video' &&
      segments[3] === 'video-to-mp3'
    ) {
      return {
        isValidRoute: true,
        isNotFound: false,
        isAdmin: false,
        locale: 'fr',
        pageKey: 'video_to_mp3',
        platformKey: null,
        legalKey: null,
        canonicalPath: '/tools/video/video-to-mp3',
        isLegacyAlias: true,
      };
    }

    if (segments[1] === 'blog') {
      if (segments.length === 2) {
        return {
          isValidRoute: true,
          isNotFound: false,
          isAdmin: false,
          locale: 'fr',
          pageKey: 'blog',
          platformKey: null,
          legalKey: null,
          canonicalPath: '/fr/blog',
        };
      }
      if (segments.length === 3) {
        const resolvedFr = getPublishedArticleBySlug('fr', segments[2]);
        if (resolvedFr) {
          return {
            isValidRoute: true,
            isNotFound: false,
            isAdmin: false,
            locale: 'fr',
            pageKey: 'blog_article',
            platformKey: null,
            legalKey: null,
            blogSlug: resolvedFr.translation.localizedSlug,
            blogArticleId: resolvedFr.article.id,
            canonicalPath: resolvedFr.canonicalPath,
          };
        }
      }
      return {
        isValidRoute: false,
        isNotFound: true,
        isAdmin: false,
        locale: 'fr',
        pageKey: 'not_found',
        platformKey: null,
        legalKey: null,
        canonicalPath: '/fr/blog',
      };
    }

    if (segments.length === 1) {
      return {
        isValidRoute: true,
        isNotFound: false,
        isAdmin: false,
        locale: 'fr',
        pageKey: 'home',
        platformKey: null,
        legalKey: null,
        canonicalPath: '/',
        isLegacyAlias: true,
      };
    }
    if (segments.length === 2) {
      const second = segments[1];
      for (const pKey of PLATFORM_PAGE_KEYS) {
        if (PLATFORM_SLUGS.fr[pKey] === second) {
          return {
            isValidRoute: true,
            isNotFound: false,
            isAdmin: false,
            locale: 'fr',
            pageKey: pKey,
            platformKey: pKey,
            legalKey: null,
            canonicalPath: getLocalizedPagePath('fr', pKey),
            isLegacyAlias: true,
          };
        }
      }
      if (second in ALT_PLATFORM_SLUGS) {
        const pKey = ALT_PLATFORM_SLUGS[second];
        return {
          isValidRoute: true,
          isNotFound: false,
          isAdmin: false,
          locale: 'fr',
          pageKey: pKey,
          platformKey: pKey,
          legalKey: null,
          canonicalPath: getLocalizedPagePath('fr', pKey),
          isLegacyAlias: true,
        };
      }
    }
  }

  // 4. Route sans préfixe à la racine (langue par défaut 'fr')
  if (segments.length === 1) {
    for (const pKey of PLATFORM_PAGE_KEYS) {
      if (PLATFORM_SLUGS.fr[pKey] === first) {
        return {
          isValidRoute: true,
          isNotFound: false,
          isAdmin: false,
          locale: 'fr',
          pageKey: pKey,
          platformKey: pKey,
          legalKey: null,
          canonicalPath: getLocalizedPagePath('fr', pKey),
        };
      }
    }

    for (const lKey of LEGAL_PAGE_KEYS) {
      if (LEGAL_SLUGS.fr[lKey] === first) {
        return {
          isValidRoute: true,
          isNotFound: false,
          isAdmin: false,
          locale: 'fr',
          pageKey: lKey,
          platformKey: null,
          legalKey: lKey,
          canonicalPath: getLocalizedPagePath('fr', lKey),
        };
      }
    }

    if (first in ALT_PLATFORM_SLUGS) {
      const pKey = ALT_PLATFORM_SLUGS[first];
      return {
        isValidRoute: true,
        isNotFound: false,
        isAdmin: false,
        locale: 'fr',
        pageKey: pKey,
        platformKey: pKey,
        legalKey: null,
        canonicalPath: getLocalizedPagePath('fr', pKey),
        isLegacyAlias: true,
      };
    }
  }

  // 5. Toute autre URL est inconnue => 404
  return {
    isValidRoute: false,
    isNotFound: true,
    isAdmin: false,
    locale: DEFAULT_LOCALE,
    pageKey: 'not_found',
    platformKey: null,
    legalKey: null,
    canonicalPath: '/',
  };
}

export interface PublicRouteEntry {
  path: string;
  locale: SupportedLocale;
  pageKey: PageKey | 'blog_article';
  blogSlug?: string;
  blogArticleId?: string;
  lastmod?: string;
  hasHreflang: boolean;
  priority: string;
  changefreq: 'daily' | 'weekly' | 'monthly';
}

export function getAllPublicRoutes(): PublicRouteEntry[] {
  const routes: PublicRouteEntry[] = [];

  // 1. Accueil + 5 pages plateformes + 1 outil (split_image) pour chacune des 10 langues (70 routes)
  for (const code of SUPPORTED_LOCALES) {
    routes.push({
      path: getLocalizedPagePath(code, 'home'),
      locale: code,
      pageKey: 'home',
      hasHreflang: true,
      priority: code === DEFAULT_LOCALE ? '1.0' : '0.9',
      changefreq: 'daily',
    });

    for (const pKey of PLATFORM_PAGE_KEYS) {
      routes.push({
        path: getLocalizedPagePath(code, pKey),
        locale: code,
        pageKey: pKey,
        hasHreflang: true,
        priority: code === DEFAULT_LOCALE ? '0.9' : '0.8',
        changefreq: 'weekly',
      });
    }

    routes.push({
      path: getLocalizedPagePath(code, 'tools_hub'),
      locale: code,
      pageKey: 'tools_hub',
      hasHreflang: true,
      priority: code === DEFAULT_LOCALE ? '0.9' : '0.8',
      changefreq: 'weekly',
    });

    routes.push({
      path: getLocalizedPagePath(code, 'split_image'),
      locale: code,
      pageKey: 'split_image',
      hasHreflang: true,
      priority: code === DEFAULT_LOCALE ? '0.9' : '0.8',
      changefreq: 'weekly',
    });

    routes.push({
      path: getLocalizedPagePath(code, 'video_to_mp3'),
      locale: code,
      pageKey: 'video_to_mp3',
      hasHreflang: true,
      priority: code === DEFAULT_LOCALE ? '0.9' : '0.8',
      changefreq: 'weekly',
    });
  }

  // 2. Pages légales (complètes dans les 10 langues, avec hreflang bidirectionnel = 50 routes)
  for (const legalLoc of LEGAL_SUPPORTED_LOCALES) {
    for (const lKey of LEGAL_PAGE_KEYS) {
      routes.push({
        path: getLocalizedPagePath(legalLoc, lKey),
        locale: legalLoc,
        pageKey: lKey,
        hasHreflang: true,
        priority: '0.5',
        changefreq: 'monthly',
      });
    }
  }

  return routes;
}

/**
 * Retourne l'ensemble des routes publiques du Blog (Hubs linguistiques publiés + Articles publiés).
 * Exclut strictement tous les articles en brouillon (`status: 'draft'`) et toutes les traductions
 * en brouillon (`translationStatus: 'draft'`).
 */
export function getAllBlogPublicRoutes(): PublicRouteEntry[] {
  const blogRoutes: PublicRouteEntry[] = [];

  for (const blogLoc of BLOG_HUB_LOCALES) {
    const hubPath = getBlogHomePath(blogLoc);
    blogRoutes.push({
      path: hubPath,
      locale: blogLoc,
      pageKey: 'blog',
      hasHreflang: true,
      priority: blogLoc === 'en' ? '0.9' : '0.8',
      changefreq: 'weekly',
    });

    const publishedArticles = getPublishedArticlesForLocale(blogLoc);
    for (const item of publishedArticles) {
      blogRoutes.push({
        path: item.canonicalPath,
        locale: blogLoc,
        pageKey: 'blog_article',
        blogSlug: item.translation.localizedSlug,
        blogArticleId: item.article.id,
        lastmod: item.translation.updatedAt || item.article.updatedAt,
        hasHreflang: true,
        priority: blogLoc === 'en' ? '0.8' : '0.7',
        changefreq: 'monthly',
      });
    }
  }

  return blogRoutes;
}

/**
 * Retourne la totalité des routes indexables du site (120 routes principales + routes publiques du Blog).
 * Utilisé par scripts/prerender.mjs, sitemap.xml, scripts/verify-seo.mjs et scripts/check-og.mjs.
 */
export function getAllIndexableRoutes(): PublicRouteEntry[] {
  return [...getAllPublicRoutes(), ...getAllBlogPublicRoutes()];
}

export const LEGACY_BLOG_SLUG_REDIRECTS: Record<string, string> = {
  '/blog/tiktok-video-not-downloading':
    '/en/blog/troubleshooting-expired-blocked-social-media-links',
  '/blog/download-tiktok-without-watermark':
    '/en/blog/save-public-tiktok-videos-without-watermark-guide',
  '/blog/mp4-vs-mp3-difference':
    '/en/blog/tiktok-audio-tracks-mp3-vs-m4a-aac-guide',
  '/blog/instagram-reel-without-sound':
    '/en/blog/instagram-reels-carousels-resolution-compression-guide',
  '/blog/social-media-video-aspect-ratios-safe-zones-2026':
    '/en/blog/social-media-video-aspect-ratios-safe-zones',
  '/en/blog/tiktok-video-not-downloading':
    '/en/blog/troubleshooting-expired-blocked-social-media-links',
  '/en/blog/download-tiktok-without-watermark':
    '/en/blog/save-public-tiktok-videos-without-watermark-guide',
  '/en/blog/mp4-vs-mp3-difference':
    '/en/blog/tiktok-audio-tracks-mp3-vs-m4a-aac-guide',
  '/en/blog/instagram-reel-without-sound':
    '/en/blog/instagram-reels-carousels-resolution-compression-guide',
  '/en/blog/social-media-video-aspect-ratios-safe-zones-2026':
    '/en/blog/social-media-video-aspect-ratios-safe-zones',
  '/fr/blog/son-reel-instagram-manquant':
    '/fr/blog/instagram-reels-carrousels-resolution-compression-guide',
  '/fr/blog/difference-mp4-et-mp3':
    '/fr/blog/audio-tiktok-mp3-vs-m4a-aac-guide-technique',
};

/**
 * Résout les redirections permanentes 301 du Blog :
 * - /blog -> /en/blog
 * - /blog/{slug} -> /en/blog/{slug} (avec normalisation d'ancien slug ou retrait de -2026)
 * - Anciens slugs publiés ou slugs contenant -2026 -> nouveau slug canonique sans année
 */
export function resolveBlogRedirectPath(rawPathname: string): string | null {
  const clean = (rawPathname || '/').split('?')[0].split('#')[0];
  const normalized = clean.replace(/\/+$/, '') || '/';

  if (normalized === '/blog') {
    return '/en/blog';
  }

  if (normalized in LEGACY_BLOG_SLUG_REDIRECTS) {
    return LEGACY_BLOG_SLUG_REDIRECTS[normalized];
  }

  if (normalized.startsWith('/blog/')) {
    const rest = normalized.slice('/blog/'.length).replace(/^\/+|\/+$/g, '');
    if (!rest) return '/en/blog';
    const strippedSlug = rest.replace(/-2026$/, '');
    const legacyKey = `/blog/${strippedSlug}`;
    if (legacyKey in LEGACY_BLOG_SLUG_REDIRECTS) {
      return LEGACY_BLOG_SLUG_REDIRECTS[legacyKey];
    }
    return `/en/blog/${strippedSlug}`;
  }

  if (
    BLOG_HUB_LOCALES.some((loc) => normalized.startsWith(`/${loc}/blog/`)) &&
    normalized.endsWith('-2026')
  ) {
    const stripped = normalized.replace(/-2026$/, '');
    return LEGACY_BLOG_SLUG_REDIRECTS[stripped] || stripped;
  }

  return null;
}

/**
 * Génère le contenu structuré de /llms.txt à partir de la configuration du site, des outils et du Blog
 * pour l'indexation GEO (ChatGPT Search, Perplexity, Claude, Google AI Overviews).
 */
export function buildLlmsTxt(siteUrl: string = 'https://vidnex.space'): string {
  const base = siteUrl.replace(/\/+$/, '');
  const blogHubLines = BLOG_HUB_LOCALES.map((loc) => {
    const def = LOCALES_CONFIG[loc];
    return `- [VIDNEX Blog (${def.nativeName})](${base}${getBlogHomePath(loc)})`;
  });
  const blogArticleSections = BLOG_HUB_LOCALES.flatMap((loc) => {
    const def = LOCALES_CONFIG[loc];
    const articles = getPublishedArticlesForLocale(loc);
    return [
      `## Guides techniques publiés (${def.nativeName} — /${loc}/blog)`,
      '',
      ...articles.map(
        (item) => `- [${item.translation.title}](${base}${item.canonicalPath})`
      ),
      '',
    ];
  });

  return [
    '# VIDNEX',
    '',
    '> VIDNEX (https://vidnex.space) est un outil web gratuit, sans inscription ni compte, permettant d’enregistrer uniquement des vidéos publiques et médias publics depuis TikTok, Instagram, X (Twitter), Facebook et les photos de profil publiques LinkedIn, ainsi que de découper des images en grille directement dans le navigateur. VIDNEX ne stocke aucun fichier média sur ses serveurs et ne prend pas en charge YouTube, Snapchat ni les comptes privés.',
    '',
    '## Définition et périmètre technique (Verified Facts)',
    '',
    '- **Nature du service** : Résolveur web de métadonnées publiques à la demande et boîte à outils créateurs 100 % côté navigateur (sans compte utilisateur, sans extension navigateur, sans stockage serveur des vidéos ou photos).',
    '- **Plateformes prises en charge (5)** : TikTok, Instagram, X (Twitter), Facebook, LinkedIn (photo de profil publique uniquement).',
    '- **Sélection multi-médias et archive ZIP côté navigateur** : Pour les carrousels Instagram, les diaporamas photo TikTok et les Stories publiques, VIDNEX affiche un écran de sélection préalable (cases à cocher, Tout sélectionner / Tout désélectionner, aperçu individuel, téléchargement unitaire ou archive groupée `.ZIP` jusqu’à 50 éléments / 50 Mo).',
    '- **Outils créateurs intégrés (100 % locaux)** : Hub des outils (`/tools`), Convertisseur Vidéo → MP3 / WAV (`/tools/video/video-to-mp3`, décodage Web Audio API, encodage MP3 `lamejs` 128–320 kbps et WAV 16-bit PCM manuel 44,1/48 kHz, découpe par forme d’onde, normalisation du volume, 500 Mo desktop / 200 Mo mobile, zéro upload serveur) et Découper une image / Split Image (`/tools/split-image`, HTML5 Canvas + JSZip), tous déclinés dans les 10 langues.',
    '- **Exclusions strictes** : VIDNEX ne prend PAS en charge YouTube, Snapchat, ni aucun compte privé, story privée ou publication protégée par connexion.',
    '- **Confidentialité et droit d’auteur** : Aucun stockage de comptes utilisateurs ni d’historique d’URLs. L’enregistrement est réservé aux publications publiques dans le respect du droit d’auteur des créateurs.',
    '',
    '## Outils principaux et formats pris en charge',
    '',
    `- **Hub des outils (/tools)** — [FR: ${base}${getLocalizedPagePath('fr', 'tools_hub')}](${base}${getLocalizedPagePath('fr', 'tools_hub')}) | [EN: ${base}${getLocalizedPagePath('en', 'tools_hub')}](${base}${getLocalizedPagePath('en', 'tools_hub')})`,
    '  - Catalogue central regroupant les outils 100 % navigateur (Vidéo → MP3 / WAV, Découper une image) et les 5 téléchargeurs publics VIDNEX.',
    `- **Vidéo → MP3 / WAV (100 % navigateur)** — [FR: ${base}${getLocalizedPagePath('fr', 'video_to_mp3')}](${base}${getLocalizedPagePath('fr', 'video_to_mp3')}) | [EN: ${base}${getLocalizedPagePath('en', 'video_to_mp3')}](${base}${getLocalizedPagePath('en', 'video_to_mp3')})`,
    '  - Fonction : Extraction audio locale depuis MP4, MOV ou WebM via Web Audio API sans aucun upload ni API serveur. Encodage MP3 (`lamejs` : 128, 192, 256, 320 kbps) ou WAV PCM 16-bit manuel (44,1 / 48 kHz, mono ou stéréo), découpe d’extrait sur forme d’onde interactive avec poignées Début/Fin, normalisation du volume (-0,2 dB), barre de progression, taille estimée, lecteur d’aperçu et nom de fichier modifiable. Limite : 500 Mo sur ordinateur, 200 Mo sur mobile. Transfert direct en un clic depuis les téléchargeurs TikTok, Instagram, X et Facebook via « Extraire l’audio (MP3) » sans re-upload.',
    `- **TikTok** — [FR: ${base}${getLocalizedPagePath('fr', 'tiktok')}](${base}${getLocalizedPagePath('fr', 'tiktok')}) | [EN: ${base}${getLocalizedPagePath('en', 'tiktok')}](${base}${getLocalizedPagePath('en', 'tiktok')})`,
    '  - Formats : Vidéo MP4 publique (sans filigrane lorsque la piste source le permet), piste audio MP3 ou M4A/AAC originale, diaporamas photos publics (téléchargement unitaire ou archive `.ZIP`) et photo de profil publique.',
    `- **Instagram** — [FR: ${base}${getLocalizedPagePath('fr', 'instagram')}](${base}${getLocalizedPagePath('fr', 'instagram')}) | [EN: ${base}${getLocalizedPagePath('en', 'instagram')}](${base}${getLocalizedPagePath('en', 'instagram')})`,
    '  - Formats : Reels publics en MP4 avec audio, publications `/p/` publiques (photo JPG, vidéo MP4 ou carrousel multi-slides avec sélection par cases à cocher et téléchargement `.ZIP`), Stories publiques accessibles et photo de profil publique en JPG.',
    `- **X (Twitter)** — [FR: ${base}${getLocalizedPagePath('fr', 'x')}](${base}${getLocalizedPagePath('fr', 'x')}) | [EN: ${base}${getLocalizedPagePath('en', 'x')}](${base}${getLocalizedPagePath('en', 'x')})`,
    '  - Formats : Vidéos publiques en MP4 (multi-résolutions disponibles avec lecteur d’aperçu intégré), GIFs animés convertis en boucle MP4 et photos de publications publiques (`x.com` et `twitter.com`).',
    `- **Facebook** — [FR: ${base}${getLocalizedPagePath('fr', 'facebook')}](${base}${getLocalizedPagePath('fr', 'facebook')}) | [EN: ${base}${getLocalizedPagePath('en', 'facebook')}](${base}${getLocalizedPagePath('en', 'facebook')})`,
    '  - Formats : Vidéos publiques (`/watch/`, `/videos/`, `fb.watch`), Stories publiques accessibles et Reels Facebook publics (`/reel/`) en MP4 HD ou SD avec son.',
    `- **LinkedIn** — [FR: ${base}${getLocalizedPagePath('fr', 'linkedin')}](${base}${getLocalizedPagePath('fr', 'linkedin')}) | [EN: ${base}${getLocalizedPagePath('en', 'linkedin')}](${base}${getLocalizedPagePath('en', 'linkedin')})`,
    '  - Formats : Photo de profil publique LinkedIn (`linkedin.com/in/...`) en résolution JPG/PNG/WebP d’origine avec aperçu zoom HD, plus un module d’import manuel local (glisser-déposer ou fichier, vérification par signature binaire, zéro envoi serveur) lorsque LinkedIn affiche un mur de connexion.',
    `- **Découper une image (Split Image)** — [FR: ${base}${getLocalizedPagePath('fr', 'split_image')}](${base}${getLocalizedPagePath('fr', 'split_image')}) | [EN: ${base}${getLocalizedPagePath('en', 'split_image')}](${base}${getLocalizedPagePath('en', 'split_image')})`,
    '  - Fonction : Découpe d’images JPG, PNG et WebP en grille 2×2, 3×3 (grille profil Instagram), 1×3 (carrousel), 3×1 ou personnalisée (1 à 10 lignes × colonnes), avec option « Ordre Instagram » inversant la numérotation, aperçu interactif des lignes de coupe, export PNG ou JPG (qualité réglable de 10 % à 100 %), téléchargement individuel (`image-1`, `image-2`...) ou archive complète `.ZIP` via JSZip. Gratuit, sans inscription, traitement 100 % local côté navigateur (HTML5 Canvas, aucune API, aucun upload serveur, réduction automatique > 8000 px).',
    '',
    '## Pages principales et Informations légales',
    '',
    `- [Accueil VIDNEX (FR)](${base}/) | [VIDNEX Home (EN)](${base}/en)`,
    `- [Tous les outils VIDNEX (FR)](${base}/tools) | [All VIDNEX Tools (EN)](${base}/en/tools)`,
    `- [Vidéo → MP3 / WAV (FR)](${base}/tools/video/video-to-mp3) | [Video to MP3 / WAV (EN)](${base}/en/tools/video/video-to-mp3)`,
    `- [Découper une image (FR)](${base}/tools/split-image) | [Split Image Online (EN)](${base}/en/tools/split-image)`,
    ...blogHubLines,
    `- **Pages de confiance (disponibles dans les 10 langues)** :`,
    ...LEGAL_PAGE_KEYS.map((lKey) => {
      const links = SUPPORTED_LOCALES.map(
        (code) =>
          `[${code.toUpperCase()}](${base}${getLocalizedPagePath(code, lKey)})`
      ).join(' | ');
      return `  - **${lKey}** : ${links}`;
    }),
    '',
    ...blogArticleSections,
    '## Langues disponibles (10)',
    '',
    ...SUPPORTED_LOCALES.map((code) => {
      const def = LOCALES_CONFIG[code];
      const homePath = getLocalizedPagePath(code, 'home');
      const url = homePath === '/' ? `${base}/` : `${base}${homePath}`;
      return `- [${def.nativeName} (${def.shortLabel})](${url})`;
    }),
    '',
  ].join('\n');
}
