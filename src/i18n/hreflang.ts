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
  BLOG_HUB_LOCALES,
  BLOG_HUB_SEO,
  type BlogLocale,
  getBlogHomePath,
  getPublishedArticleBySlug,
  getPublishedArticleTranslations,
  getPublishedArticlesForLocale,
  isBlogHubLocale,
} from '../data/blogArticles.ts';
import {
  getLocaleDefinition,
  getLocalizedPagePath,
  isLegalPageKey,
  isPlatformPageKey,
  LOCALES_CONFIG,
  type PageKey,
  type PlatformPageKey,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from './config.ts';
import { getLocaleBundleSync } from './localeLoader.ts';

export interface ShareUrls {
  canonicalUrl: string;
  whatsapp: string;
  telegram: string;
  facebook: string;
  x: string;
}

/**
 * Pure helper to build clean, tracking-free social share URLs for a given locale and tool page.
 * Exported for unit testing.
 */
export function buildSocialShareUrls(
  locale: SupportedLocale,
  pageKey: 'home' | PlatformPageKey
): ShareUrls {
  const bundle = getLocaleBundleSync(locale);
  const canonicalUrl = getPageCanonicalUrl(locale, pageKey);
  const pageData =
    pageKey === 'home' ? bundle.home : bundle.platforms[pageKey];
  const shareTitle = pageData.ogTitle || pageData.metaTitle;
  const shareTextWithUrl = `${shareTitle} — ${canonicalUrl}`;

  return {
    canonicalUrl,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(shareTextWithUrl)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(
      canonicalUrl
    )}&text=${encodeURIComponent(shareTitle)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      canonicalUrl
    )}`,
    x: `https://x.com/intent/tweet?url=${encodeURIComponent(
      canonicalUrl
    )}&text=${encodeURIComponent(shareTitle)}`,
  };
}

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
 * Génère la liste des liens hreflang pour le Blog Hub (/blog, /fr/blog, /es/blog, /de/blog)
 * ou un article du Blog (/blog/{slug}, /{locale}/blog/{localizedSlug}).
 * N'invente JAMAIS de balise hreflang pour une langue dans laquelle l'article n'est pas publié.
 */
export function buildBlogHreflangCluster(
  pageKey: 'blog' | 'blog_article',
  blogArticleId?: string | null
): HreflangEntry[] {
  if (pageKey === 'blog') {
    const entries: HreflangEntry[] = BLOG_HUB_LOCALES.map((loc) => ({
      hreflang: LOCALES_CONFIG[loc].hreflang,
      href: getCanonicalUrl(getBlogHomePath(loc)),
    }));
    entries.push({
      hreflang: 'x-default',
      href: getCanonicalUrl('/blog'),
    });
    return entries;
  }

  if (!blogArticleId) return [];

  const publishedTranslations = getPublishedArticleTranslations(blogArticleId);
  if (publishedTranslations.length === 0) return [];

  const entries: HreflangEntry[] = publishedTranslations.map((item) => ({
    hreflang: LOCALES_CONFIG[item.locale].hreflang,
    href: getCanonicalUrl(item.canonicalPath),
  }));

  const enItem =
    publishedTranslations.find((item) => item.locale === 'en') ||
    publishedTranslations[0];
  entries.push({
    hreflang: 'x-default',
    href: getCanonicalUrl(enItem.canonicalPath),
  });

  return entries;
}

/**
 * Génère la liste complète des liens hreflang pour une page donnée.
 * - Pour 'home' et les 5 pages plateformes : renvoie les 10 langues + 'x-default' vers la version anglaise.
 * - Pour 'blog' et 'blog_article' : renvoie uniquement les versions linguistiques réellement publiées + 'x-default' vers la version anglaise.
 * - Pour les pages légales ('about', 'privacy', 'terms', 'contact', 'dmca') : renvoie [].
 */
export function buildHreflangCluster(
  pageKey: PageKey | 'blog_article',
  blogArticleId?: string | null
): HreflangEntry[] {
  if (pageKey === 'blog' || pageKey === 'blog_article') {
    return buildBlogHreflangCluster(pageKey, blogArticleId);
  }

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
  pageKey: PageKey | 'blog_article',
  blogArticleId?: string | null
): { ogLocale: string; ogLocaleAlternates: string[] } {
  const currentDef = getLocaleDefinition(locale);
  if (isLegalPageKey(pageKey as PageKey)) {
    return { ogLocale: currentDef.ogLocale, ogLocaleAlternates: [] };
  }

  if (pageKey === 'blog') {
    const alternates = BLOG_HUB_LOCALES.filter((code) => code !== locale).map(
      (code) => LOCALES_CONFIG[code].ogLocale
    );
    return { ogLocale: currentDef.ogLocale, ogLocaleAlternates: alternates };
  }

  if (pageKey === 'blog_article') {
    const publishedTranslations = blogArticleId
      ? getPublishedArticleTranslations(blogArticleId)
      : [];
    const alternates = publishedTranslations
      .filter((t) => t.locale !== locale)
      .map((t) => LOCALES_CONFIG[t.locale].ogLocale);
    return { ogLocale: currentDef.ogLocale, ogLocaleAlternates: alternates };
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
  pageKey: PageKey | 'blog_article' | 'admin' | 'not_found',
  blogSlug?: string | null
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

  // Blog Hub (/blog, /fr/blog, /es/blog, /de/blog)
  if (pageKey === 'blog') {
    const blogLoc: BlogLocale = isBlogHubLocale(locale) ? locale : 'en';
    const blogMeta = BLOG_HUB_SEO[blogLoc];
    const canonicalUrl = getCanonicalUrl(getBlogHomePath(blogLoc));
    const hreflangs = buildBlogHreflangCluster('blog');
    const { ogLocale, ogLocaleAlternates } = getOgLocales(blogLoc, 'blog');
    const homeUrl = getPageCanonicalUrl(blogLoc, 'home');
    const title = clampSocialText(blogMeta.metaTitle, 60);
    const description = clampSocialText(blogMeta.metaDescription, 150);
    const ogImageAlt = `${SITE_NAME} — ${blogMeta.title}`;
    const articlesInLocale = getPublishedArticlesForLocale(blogLoc);

    const graph: Record<string, unknown>[] = [
      {
        '@type': 'Blog',
        '@id': `${canonicalUrl}#blog`,
        name: blogMeta.title,
        description,
        url: canonicalUrl,
        inLanguage: LOCALES_CONFIG[blogLoc].hreflang,
        publisher: {
          '@type': 'Organization',
          '@id': `${SITE_URL}/#organization`,
          name: SITE_NAME,
          url: SITE_URL,
          logo: {
            '@type': 'ImageObject',
            url: buildAbsoluteUrl('/icon-512.png'),
          },
        },
        blogPost: articlesInLocale.map((item) => ({
          '@type': 'BlogPosting',
          headline: item.translation.title,
          url: getCanonicalUrl(item.canonicalPath),
          datePublished: item.article.publishedAt,
          dateModified: item.article.updatedAt,
          inLanguage: LOCALES_CONFIG[blogLoc].hreflang,
        })),
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
            name: blogMeta.breadcrumbLabel,
            item: canonicalUrl,
          },
        ],
      },
    ];

    return {
      lang: LOCALES_CONFIG[blogLoc].code,
      dir: LOCALES_CONFIG[blogLoc].dir,
      title,
      description,
      canonicalUrl,
      robots: 'index, follow',
      themeColor: THEME_COLOR,
      ogType: 'website',
      ogSiteName: SITE_NAME,
      ogTitle: title,
      ogDescription: description,
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
      twitterTitle: title,
      twitterDescription: description,
      twitterImage: ogImage,
      twitterImageAlt: ogImageAlt,
      hreflangs,
      jsonLdGraph: {
        '@context': 'https://schema.org',
        '@graph': graph,
      },
    };
  }

  // Blog Article (/blog/{slug} or /{locale}/blog/{localizedSlug})
  if (pageKey === 'blog_article') {
    const blogLoc: BlogLocale = isBlogHubLocale(locale) ? locale : 'en';
    const resolved = blogSlug
      ? getPublishedArticleBySlug(blogLoc, blogSlug)
      : null;

    if (!resolved) {
      return buildHeadMetadataForRoute(locale, 'not_found');
    }

    const { article, translation, canonicalPath } = resolved;
    const canonicalUrl = getCanonicalUrl(canonicalPath);
    const blogHubUrl = getCanonicalUrl(getBlogHomePath(blogLoc));
    const homeUrl = getPageCanonicalUrl(blogLoc, 'home');
    const hreflangs = buildBlogHreflangCluster('blog_article', article.id);
    const { ogLocale, ogLocaleAlternates } = getOgLocales(
      blogLoc,
      'blog_article',
      article.id
    );

    const title = clampSocialText(translation.metaTitle, 60);
    const description = clampSocialText(translation.metaDescription, 150);
    const ogImageAlt =
      article.featuredImage.alt[blogLoc] ||
      article.featuredImage.alt.en ||
      title;

    const graph: Record<string, unknown>[] = [
      {
        '@type': 'BlogPosting',
        '@id': `${canonicalUrl}#article`,
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': canonicalUrl,
        },
        headline: translation.title,
        description,
        image: ogImage,
        datePublished: article.publishedAt,
        dateModified: article.updatedAt,
        inLanguage: LOCALES_CONFIG[blogLoc].hreflang,
        articleSection: article.category,
        keywords: [
          translation.primaryKeyword,
          ...translation.secondaryKeywords,
        ].join(', '),
        author: {
          '@type': 'Organization',
          name: article.author.name,
          url: SITE_URL,
        },
        publisher: {
          '@type': 'Organization',
          '@id': `${SITE_URL}/#organization`,
          name: SITE_NAME,
          url: SITE_URL,
          logo: {
            '@type': 'ImageObject',
            url: buildAbsoluteUrl('/icon-512.png'),
          },
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
            name: BLOG_HUB_SEO[blogLoc].breadcrumbLabel,
            item: blogHubUrl,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: translation.title,
            item: canonicalUrl,
          },
        ],
      },
    ];

    if (translation.faq.length > 0) {
      graph.push({
        '@type': 'FAQPage',
        '@id': `${canonicalUrl}#faq`,
        inLanguage: LOCALES_CONFIG[blogLoc].hreflang,
        mainEntity: translation.faq.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      });
    }

    return {
      lang: LOCALES_CONFIG[blogLoc].code,
      dir: LOCALES_CONFIG[blogLoc].dir,
      title,
      description,
      canonicalUrl,
      robots: 'index, follow',
      themeColor: THEME_COLOR,
      ogType: 'website',
      ogSiteName: SITE_NAME,
      ogTitle: title,
      ogDescription: description,
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
      twitterTitle: title,
      twitterDescription: description,
      twitterImage: ogImage,
      twitterImageAlt: ogImageAlt,
      hreflangs,
      jsonLdGraph: {
        '@context': 'https://schema.org',
        '@graph': graph,
      },
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
