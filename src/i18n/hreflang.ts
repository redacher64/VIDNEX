/**
 * Générateur UNIQUE des balises hreflang, métadonnées Head et JSON-LD.
 * Utilisé à la fois pour :
 * 1. Le <head> pré-rendu au build (scripts/prerender.mjs)
 * 2. Le composant SEO côté client (src/components/SeoSchemaInjector.tsx)
 * 3. Le rewriter Edge Cloudflare (functions/_lib/seoRewriter.ts)
 * 4. La génération de sitemap.xml (scripts/prerender.mjs)
 *
 * Cela garantit une réciprocité et une identité 100 % strictes entre le <head> HTML et sitemap.xml.
 */

import {
  buildAbsoluteUrl,
  getCanonicalUrl,
  getOgImageUrlForPage,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_TYPE,
  OG_IMAGE_WIDTH,
  SITE_NAME,
  SITE_URL,
  THEME_COLOR,
} from '../config/site.ts';
import {
  getLocaleDefinition,
  getLocalizedPagePath,
  isLegalPageKey,
  isPlatformPageKey,
  LOCALES_CONFIG,
  type PageKey,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from './config.ts';
import { getLocaleBundleSync } from './localeLoader.ts';

export interface HreflangEntry {
  hreflang: string;
  href: string;
}

/**
 * Coupe proprement une chaîne pour OpenGraph / Twitter sans jamais couper un mot
 * ni un caractère / graphème arabe ou Unicode en deux.
 */
export function clampSocialText(text: string, maxChars: number): string {
  const normalized = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();

  type SegmenterConstructor = new (
    locale?: string,
    options?: { granularity?: 'grapheme' | 'word' | 'sentence' }
  ) => {
    segment(input: string): Iterable<{ segment: string }>;
  };

  const IntlWithSegmenter =
    typeof Intl !== 'undefined'
      ? (Intl as unknown as { Segmenter?: SegmenterConstructor })
      : undefined;

  const graphemes: string[] =
    IntlWithSegmenter && typeof IntlWithSegmenter.Segmenter === 'function'
      ? Array.from(
          new IntlWithSegmenter.Segmenter(undefined, {
            granularity: 'grapheme',
          }).segment(normalized),
          (s) => s.segment
        )
      : Array.from(normalized);

  if (graphemes.length <= maxChars) {
    return normalized;
  }

  const limit = Math.max(1, maxChars - 1);
  const sliced = graphemes.slice(0, limit).join('');
  const lastSpace = sliced.lastIndexOf(' ');
  const cleanCut =
    lastSpace >= Math.floor(limit * 0.6) ? sliced.slice(0, lastSpace) : sliced;
  return `${cleanCut.replace(/[,:;.\-–—\s]+$/u, '')}…`;
}

/**
 * Génère la liste complète des liens hreflang pour une page donnée.
 * - Pour 'home' et les 4 pages plateformes ('tiktok', 'instagram', 'x', 'facebook') :
 *   renvoie les 10 langues (y compris l'auto-référence) + 'x-default' pointant vers la version anglaise.
 * - Pour les pages légales ('about', 'privacy', 'terms', 'contact', 'dmca') :
 *   renvoie un tableau vide [] (conformément à l'ÉTAPE 2 : "sans hreflang pour ces pages").
 */
export function buildHreflangCluster(pageKey: PageKey): HreflangEntry[] {
  if (isLegalPageKey(pageKey)) {
    return [];
  }

  const entries: HreflangEntry[] = SUPPORTED_LOCALES.map((code) => {
    const loc = LOCALES_CONFIG[code];
    return {
      hreflang: loc.hreflang,
      href: getCanonicalUrl(getLocalizedPagePath(loc.code, pageKey)),
    };
  });

  // x-default pointe vers la version internationale anglaise (/en ou /en/{slug})
  entries.push({
    hreflang: 'x-default',
    href: getCanonicalUrl(getLocalizedPagePath('en', pageKey)),
  });

  return entries;
}

/**
 * Retourne l'URL canonique absolue d'une page donnée (pointe toujours sur elle-même, sans paramètres).
 */
export function getPageCanonicalUrl(
  locale: SupportedLocale,
  pageKey: PageKey
): string {
  return getCanonicalUrl(getLocalizedPagePath(locale, pageKey));
}

/**
 * Retourne og:locale et la liste des og:locale:alternate pour une page donnée.
 */
export function getOgLocales(
  locale: SupportedLocale,
  pageKey: PageKey
): { ogLocale: string; ogLocaleAlternates: string[] } {
  const currentDef = getLocaleDefinition(locale);
  if (isLegalPageKey(pageKey)) {
    return { ogLocale: currentDef.ogLocale, ogLocaleAlternates: [] };
  }

  const alternates = SUPPORTED_LOCALES.filter((code) => code !== locale).map(
    (code) => LOCALES_CONFIG[code].ogLocale
  );

  return {
    ogLocale: currentDef.ogLocale,
    ogLocaleAlternates: alternates,
  };
}

export interface RouteHeadMetadata {
  lang: SupportedLocale;
  dir: 'ltr' | 'rtl';
  title: string;
  description: string;
  canonicalUrl: string;
  robots: string;
  themeColor: string;
  ogType: 'website';
  ogSiteName: string;
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
  ogImage: string;
  ogImageSecureUrl: string;
  ogImageType: string;
  ogImageWidth: string;
  ogImageHeight: string;
  ogImageAlt: string;
  ogLocale: string;
  ogLocaleAlternates: string[];
  twitterCard: 'summary_large_image';
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  twitterImageAlt: string;
  hreflangs: HreflangEntry[];
  jsonLdGraph: Record<string, unknown>;
}

/**
 * Single source of truth for head tags & Schema.org JSON-LD across:
 * 1) Static build-time pre-rendering (scripts/prerender.mjs)
 * 2) Client-side SPA route updates (SeoSchemaInjector)
 * 3) Edge middleware fallback (functions/_lib/seoRewriter.ts)
 */
export function buildHeadMetadataForRoute(
  locale: SupportedLocale,
  pageKey: PageKey | 'admin' | 'not_found'
): RouteHeadMetadata {
  const localeMeta = LOCALES_CONFIG[locale] || LOCALES_CONFIG.fr;
  const bundle = getLocaleBundleSync(locale);
  const ogImage = getOgImageUrlForPage(pageKey);

  if (pageKey === 'admin') {
    const adminUrl = buildAbsoluteUrl('/admin');
    const adminTitle = `Administration | ${SITE_NAME}`;
    const adminDesc =
      'Panneau d’administration et de supervision technique de la plateforme VIDNEX.';
    return {
      lang: 'fr',
      dir: 'ltr',
      title: adminTitle,
      description: adminDesc,
      canonicalUrl: adminUrl,
      robots: 'noindex, nofollow',
      themeColor: THEME_COLOR,
      ogType: 'website',
      ogSiteName: SITE_NAME,
      ogTitle: adminTitle,
      ogDescription: adminDesc,
      ogUrl: adminUrl,
      ogImage,
      ogImageSecureUrl: ogImage,
      ogImageType: OG_IMAGE_TYPE,
      ogImageWidth: OG_IMAGE_WIDTH,
      ogImageHeight: OG_IMAGE_HEIGHT,
      ogImageAlt: 'Administration VIDNEX',
      ogLocale: 'fr_FR',
      ogLocaleAlternates: [],
      twitterCard: 'summary_large_image',
      twitterTitle: adminTitle,
      twitterDescription: adminDesc,
      twitterImage: ogImage,
      twitterImageAlt: 'Administration VIDNEX',
      hreflangs: [],
      jsonLdGraph: { '@context': 'https://schema.org', '@graph': [] },
    };
  }

  if (pageKey === 'not_found') {
    const nf = bundle.ui.notFound;
    const homeUrl = getPageCanonicalUrl(locale, 'home');
    const nfTitle = clampSocialText(nf.title, 60);
    const nfDesc = clampSocialText(nf.description, 150);
    return {
      lang: localeMeta.code,
      dir: localeMeta.dir,
      title: nfTitle,
      description: nfDesc,
      canonicalUrl: homeUrl,
      robots: 'noindex, nofollow',
      themeColor: THEME_COLOR,
      ogType: 'website',
      ogSiteName: SITE_NAME,
      ogTitle: nfTitle,
      ogDescription: nfDesc,
      ogUrl: homeUrl,
      ogImage,
      ogImageSecureUrl: ogImage,
      ogImageType: OG_IMAGE_TYPE,
      ogImageWidth: OG_IMAGE_WIDTH,
      ogImageHeight: OG_IMAGE_HEIGHT,
      ogImageAlt: bundle.home.ogImageAlt,
      ogLocale: localeMeta.ogLocale,
      ogLocaleAlternates: [],
      twitterCard: 'summary_large_image',
      twitterTitle: nfTitle,
      twitterDescription: nfDesc,
      twitterImage: ogImage,
      twitterImageAlt: bundle.home.ogImageAlt,
      hreflangs: [],
      jsonLdGraph: { '@context': 'https://schema.org', '@graph': [] },
    };
  }

  const canonicalUrl = getPageCanonicalUrl(locale, pageKey);
  const hreflangs = buildHreflangCluster(pageKey);
  const { ogLocale, ogLocaleAlternates } = getOgLocales(locale, pageKey);
  const homeUrl = getPageCanonicalUrl(locale, 'home');

  if (pageKey === 'home') {
    const home = bundle.home;
    const title = clampSocialText(home.metaTitle, 60);
    const description = clampSocialText(home.metaDescription, 150);
    const ogTitle = clampSocialText(home.ogTitle || home.metaTitle, 60);
    const ogDescription = clampSocialText(
      home.ogDescription || home.metaDescription,
      150
    );
    const ogImageAlt = home.ogImageAlt || ogTitle;

    const graph: Record<string, unknown>[] = [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: canonicalUrl,
        inLanguage: localeMeta.hreflang,
        description,
      },
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: buildAbsoluteUrl('/icon-512.png'),
      },
      {
        '@type': 'FAQPage',
        '@id': `${canonicalUrl}#faq`,
        inLanguage: localeMeta.hreflang,
        mainEntity: home.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
    ];

    return {
      lang: localeMeta.code,
      dir: localeMeta.dir,
      title,
      description,
      canonicalUrl,
      robots: 'index, follow',
      themeColor: THEME_COLOR,
      ogType: 'website',
      ogSiteName: SITE_NAME,
      ogTitle,
      ogDescription,
      ogUrl: canonicalUrl,
      ogImage,
      ogImageSecureUrl: ogImage,
      ogImageType: OG_IMAGE_TYPE,
      ogImageWidth: OG_IMAGE_WIDTH,
      ogImageHeight: OG_IMAGE_HEIGHT,
      ogImageAlt,
      ogLocale,
      ogLocaleAlternates,
      twitterCard: 'summary_large_image',
      twitterTitle: ogTitle,
      twitterDescription: ogDescription,
      twitterImage: ogImage,
      twitterImageAlt: ogImageAlt,
      hreflangs,
      jsonLdGraph: {
        '@context': 'https://schema.org',
        '@graph': graph,
      },
    };
  }

  if (isPlatformPageKey(pageKey)) {
    const p = bundle.platforms[pageKey];
    const title = clampSocialText(p.metaTitle, 60);
    const description = clampSocialText(p.metaDescription, 150);
    const ogTitle = clampSocialText(p.ogTitle || p.metaTitle, 60);
    const ogDescription = clampSocialText(
      p.ogDescription || p.metaDescription,
      150
    );
    const ogImageAlt = p.ogImageAlt || ogTitle;

    const graph: Record<string, unknown>[] = [
      {
        '@type': 'WebApplication',
        '@id': `${canonicalUrl}#webapp`,
        name: `${SITE_NAME} — ${p.h1}`,
        url: canonicalUrl,
        inLanguage: localeMeta.hreflang,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'All',
        description,
        image: ogImage,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: bundle.ui.sections.breadcrumbHome,
            item: homeUrl,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: p.breadcrumbLabel,
            item: canonicalUrl,
          },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': `${canonicalUrl}#faq`,
        inLanguage: localeMeta.hreflang,
        mainEntity: p.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
    ];

    return {
      lang: localeMeta.code,
      dir: localeMeta.dir,
      title,
      description,
      canonicalUrl,
      robots: 'index, follow',
      themeColor: THEME_COLOR,
      ogType: 'website',
      ogSiteName: SITE_NAME,
      ogTitle,
      ogDescription,
      ogUrl: canonicalUrl,
      ogImage,
      ogImageSecureUrl: ogImage,
      ogImageType: OG_IMAGE_TYPE,
      ogImageWidth: OG_IMAGE_WIDTH,
      ogImageHeight: OG_IMAGE_HEIGHT,
      ogImageAlt,
      ogLocale,
      ogLocaleAlternates,
      twitterCard: 'summary_large_image',
      twitterTitle: ogTitle,
      twitterDescription: ogDescription,
      twitterImage: ogImage,
      twitterImageAlt: ogImageAlt,
      hreflangs,
      jsonLdGraph: {
        '@context': 'https://schema.org',
        '@graph': graph,
      },
    };
  }

  // Legal / Trust Page ('about' | 'privacy' | 'terms' | 'contact' | 'dmca')
  const fallbackEn = getLocaleBundleSync('en');
  const fallbackFr = getLocaleBundleSync('fr');
  const legalDoc =
    bundle.legal?.[pageKey] ||
    fallbackEn.legal?.[pageKey] ||
    fallbackFr.legal?.[pageKey]!;

  const title = clampSocialText(legalDoc.metaTitle, 60);
  const description = clampSocialText(legalDoc.metaDescription, 150);
  const ogTitle = clampSocialText(legalDoc.ogTitle || legalDoc.metaTitle, 60);
  const ogDescription = clampSocialText(
    legalDoc.ogDescription || legalDoc.metaDescription,
    150
  );
  const ogImageAlt = legalDoc.ogImageAlt || ogTitle;

  const graph: Record<string, unknown>[] = [
    {
      '@type': 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
      name: title,
      url: canonicalUrl,
      inLanguage: localeMeta.hreflang,
      description,
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${canonicalUrl}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: bundle.ui.sections.breadcrumbHome,
          item: homeUrl,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: legalDoc.breadcrumbLabel,
          item: canonicalUrl,
        },
      ],
    },
  ];

  return {
    lang: localeMeta.code,
    dir: localeMeta.dir,
    title,
    description,
    canonicalUrl,
    robots: 'index, follow',
    themeColor: THEME_COLOR,
    ogType: 'website',
    ogSiteName: SITE_NAME,
    ogTitle,
    ogDescription,
    ogUrl: canonicalUrl,
    ogImage,
    ogImageSecureUrl: ogImage,
    ogImageType: OG_IMAGE_TYPE,
    ogImageWidth: OG_IMAGE_WIDTH,
    ogImageHeight: OG_IMAGE_HEIGHT,
    ogImageAlt,
    ogLocale,
    ogLocaleAlternates: [],
    twitterCard: 'summary_large_image',
    twitterTitle: ogTitle,
    twitterDescription: ogDescription,
    twitterImage: ogImage,
    twitterImageAlt: ogImageAlt,
    hreflangs: [], // Legal pages have NO hreflang per ÉTAPE 2 & 3
    jsonLdGraph: {
      '@context': 'https://schema.org',
      '@graph': graph,
    },
  };
}
