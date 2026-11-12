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

export type PlatformPageKey =
  | 'tiktok'
  | 'instagram'
  | 'x'
  | 'facebook'
  | 'linkedin';

export type LegalPageKey = 'about' | 'privacy' | 'terms' | 'contact' | 'dmca';

export type PageKey = 'home' | PlatformPageKey | LegalPageKey;
export type RoutePageKey = PageKey;

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
    hasNativeLegalPages: false,
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
    hasNativeLegalPages: false,
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
    hasNativeLegalPages: false,
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
    hasNativeLegalPages: false,
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
    hasNativeLegalPages: false,
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
    hasNativeLegalPages: false,
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
    hasNativeLegalPages: false,
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

export const LEGAL_SUPPORTED_LOCALES: readonly ('fr' | 'en' | 'ar')[] = [
  'fr',
  'en',
  'ar',
] as const;

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

/**
 * Table des slugs localisés par langue pour les 4 pages plateformes.
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
 * Slugs des pages de confiance / légales (complètes en fr, en, ar ; les autres langues pointent vers /en/...).
 */
export const LEGAL_SLUGS: Record<'fr' | 'en' | 'ar', Record<LegalPageKey, string>> = {
  fr: {
    about: 'a-propos',
    privacy: 'confidentialite',
    terms: 'conditions',
    contact: 'contact',
    dmca: 'dmca',
  },
  en: {
    about: 'about',
    privacy: 'privacy',
    terms: 'terms',
    contact: 'contact',
    dmca: 'dmca',
  },
  ar: {
    about: 'about',
    privacy: 'privacy',
    terms: 'terms',
    contact: 'contact',
    dmca: 'dmca',
  },
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

  if (isPlatformPageKey(pageKey)) {
    const slug = PLATFORM_SLUGS[locale][pageKey];
    return `${def.prefix}/${slug}`;
  }

  if (isLegalPageKey(pageKey)) {
    if (locale === 'fr') {
      return `/${LEGAL_SLUGS.fr[pageKey]}`;
    }
    if (locale === 'ar') {
      return `/ar/${LEGAL_SLUGS.ar[pageKey]}`;
    }
    // Pour 'en' et les 7 autres langues, les pages légales pointent vers /en/...
    return `/en/${LEGAL_SLUGS.en[pageKey]}`;
  }

  return def.prefix || '/';
}

export interface ResolvedRoute {
  isValidRoute: boolean;
  isNotFound: boolean;
  isAdmin: boolean;
  locale: SupportedLocale;
  pageKey: PageKey | 'admin' | 'not_found';
  platformKey: PlatformPageKey | null;
  legalKey: LegalPageKey | null;
  canonicalPath: string;
  isLegacyAlias?: boolean;
}

/**
 * Résout un pathname URL vers sa langue, son type de page (home, platform, legal, admin)
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

      if (locale === 'en' || locale === 'ar') {
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

  // Support d'un ancien lien /fr ou /fr/... vers la racine sans préfixe
  if (first === 'fr') {
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
  pageKey: PageKey;
  hasHreflang: boolean;
  priority: string;
  changefreq: 'daily' | 'weekly' | 'monthly';
}

export function getAllPublicRoutes(): PublicRouteEntry[] {
  const routes: PublicRouteEntry[] = [];

  // 1. Accueil + 4 pages plateformes pour chacune des 10 langues (50 routes)
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
  }

  // 2. Pages légales (complètes en fr, en, ar, sans hreflang = 15 routes)
  for (const legalLoc of LEGAL_SUPPORTED_LOCALES) {
    for (const lKey of LEGAL_PAGE_KEYS) {
      routes.push({
        path: getLocalizedPagePath(legalLoc, lKey),
        locale: legalLoc,
        pageKey: lKey,
        hasHreflang: false,
        priority: '0.5',
        changefreq: 'monthly',
      });
    }
  }

  return routes;
}

/**
 * Génère le contenu de /llms.txt à partir de la configuration du site et des langues.
 */
export function buildLlmsTxt(siteUrl: string = 'https://vidnex.space'): string {
  const base = siteUrl.replace(/\/+$/, '');
  return [
    '# VIDNEX',
    '',
    '> VIDNEX est un téléchargeur web gratuit permettant d’enregistrer uniquement des vidéos publiques depuis TikTok, Instagram, X (Twitter) et Facebook en MP4 ou MP3 ainsi que les photos de profil publiques LinkedIn en JPG HD, sans compte et sans accès aux contenus privés.',
    '',
    '## Pages principales',
    '',
    `- [Accueil VIDNEX](${base}/)`,
    `- [Télécharger Vidéo TikTok](${base}${getLocalizedPagePath('fr', 'tiktok')})`,
    `- [Télécharger Reel et Vidéo Instagram](${base}${getLocalizedPagePath('fr', 'instagram')})`,
    `- [Télécharger Vidéo X (Twitter)](${base}${getLocalizedPagePath('fr', 'x')})`,
    `- [Télécharger Vidéo Facebook](${base}${getLocalizedPagePath('fr', 'facebook')})`,
    `- [Télécharger Photo de Profil LinkedIn](${base}${getLocalizedPagePath('fr', 'linkedin')})`,
    `- [À propos](${base}${getLocalizedPagePath('fr', 'about')})`,
    `- [Politique de confidentialité](${base}${getLocalizedPagePath('fr', 'privacy')})`,
    `- [Conditions d’utilisation](${base}${getLocalizedPagePath('fr', 'terms')})`,
    `- [Contact](${base}${getLocalizedPagePath('fr', 'contact')})`,
    `- [Droits d’auteur et DMCA](${base}${getLocalizedPagePath('fr', 'dmca')})`,
    '',
    '## Langues disponibles',
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

