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
  DEFAULT_OG_IMAGE,
  getCanonicalUrl,
  SITE_NAME,
  SITE_URL,
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
  ogType: 'website';
  ogSiteName: string;
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
  ogImage: string;
  ogLocale: string;
  ogLocaleAlternates: string[];
  twitterCard: 'summary_large_image';
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
  const ogImage = buildAbsoluteUrl(DEFAULT_OG_IMAGE);

  if (pageKey === 'admin') {
    const adminUrl = buildAbsoluteUrl('/admin');
    return {
      lang: 'fr',
      dir: 'ltr',
      title: `Administration | ${SITE_NAME}`,
      description: 'Panneau d’administration VIDNEX.',
      canonicalUrl: adminUrl,
      robots: 'noindex, nofollow',
      ogType: 'website',
      ogSiteName: SITE_NAME,
      ogTitle: `Administration | ${SITE_NAME}`,
      ogDescription: 'Panneau d’administration VIDNEX.',
      ogUrl: adminUrl,
      ogImage,
      ogLocale: 'fr_FR',
      ogLocaleAlternates: [],
      twitterCard: 'summary_large_image',
      hreflangs: [],
      jsonLdGraph: { '@context': 'https://schema.org', '@graph': [] },
    };
  }

  if (pageKey === 'not_found') {
    const nf = bundle.ui.notFound;
    const homeUrl = getPageCanonicalUrl(locale, 'home');
    return {
      lang: localeMeta.code,
      dir: localeMeta.dir,
      title: nf.title,
      description: nf.description,
      canonicalUrl: homeUrl,
      robots: 'noindex, nofollow',
      ogType: 'website',
      ogSiteName: SITE_NAME,
      ogTitle: nf.title,
      ogDescription: nf.description,
      ogUrl: homeUrl,
      ogImage,
      ogLocale: localeMeta.ogLocale,
      ogLocaleAlternates: [],
      twitterCard: 'summary_large_image',
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
    const graph: Record<string, unknown>[] = [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: canonicalUrl,
        inLanguage: localeMeta.hreflang,
        description: home.metaDescription,
      },
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: buildAbsoluteUrl('/favicon.svg'),
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
      title: home.metaTitle,
      description: home.metaDescription,
      canonicalUrl,
      robots: 'index, follow',
      ogType: 'website',
      ogSiteName: SITE_NAME,
      ogTitle: home.metaTitle,
      ogDescription: home.metaDescription,
      ogUrl: canonicalUrl,
      ogImage,
      ogLocale,
      ogLocaleAlternates,
      twitterCard: 'summary_large_image',
      hreflangs,
      jsonLdGraph: {
        '@context': 'https://schema.org',
        '@graph': graph,
      },
    };
  }

  if (isPlatformPageKey(pageKey)) {
    const p = bundle.platforms[pageKey];
    const graph: Record<string, unknown>[] = [
      {
        '@type': 'WebApplication',
        '@id': `${canonicalUrl}#webapp`,
        name: `${SITE_NAME} — ${p.h1}`,
        url: canonicalUrl,
        inLanguage: localeMeta.hreflang,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'All',
        description: p.metaDescription,
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
      title: p.metaTitle,
      description: p.metaDescription,
      canonicalUrl,
      robots: 'index, follow',
      ogType: 'website',
      ogSiteName: SITE_NAME,
      ogTitle: p.metaTitle,
      ogDescription: p.metaDescription,
      ogUrl: canonicalUrl,
      ogImage,
      ogLocale,
      ogLocaleAlternates,
      twitterCard: 'summary_large_image',
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

  const graph: Record<string, unknown>[] = [
    {
      '@type': 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
      name: legalDoc.metaTitle,
      url: canonicalUrl,
      inLanguage: localeMeta.hreflang,
      description: legalDoc.metaDescription,
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
    title: legalDoc.metaTitle,
    description: legalDoc.metaDescription,
    canonicalUrl,
    robots: 'index, follow',
    ogType: 'website',
    ogSiteName: SITE_NAME,
    ogTitle: legalDoc.metaTitle,
    ogDescription: legalDoc.metaDescription,
    ogUrl: canonicalUrl,
    ogImage,
    ogLocale,
    ogLocaleAlternates: [],
    twitterCard: 'summary_large_image',
    hreflangs: [], // Legal pages have NO hreflang per ÉTAPE 2 & 3
    jsonLdGraph: {
      '@context': 'https://schema.org',
      '@graph': graph,
    },
  };
}
