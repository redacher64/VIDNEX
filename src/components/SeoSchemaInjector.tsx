import React, { useEffect } from 'react';
import type { PageKey, SupportedLocale } from '../i18n/config.ts';
import {
  buildHeadMetadataForRoute,
  type RouteHeadMetadata,
} from '../i18n/hreflang.ts';
import { getLocaleBundleSync } from '../i18n/localeLoader.ts';

export { buildHeadMetadataForRoute, type RouteHeadMetadata };

interface SeoSchemaInjectorProps {
  pageKey: PageKey | 'blog_article' | 'admin' | 'not_found';
  language: SupportedLocale;
  blogSlug?: string | null;
}

export const SeoSchemaInjector: React.FC<SeoSchemaInjectorProps> = ({
  pageKey,
  language,
  blogSlug,
}) => {
  const loadedBundleLocale = getLocaleBundleSync(language).locale;

  useEffect(() => {
    const meta = buildHeadMetadataForRoute(language, pageKey, blogSlug);

    document.documentElement.lang = meta.lang;
    document.documentElement.dir = meta.dir;
    document.title = meta.title;

    const upsertNameMeta = (name: string, content: string) => {
      let el = document.querySelector(
        `meta[name="${name}"]`
      ) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.name = name;
        document.head.appendChild(el);
      }
      el.content = content;
    };

    const upsertPropertyMeta = (property: string, content: string) => {
      let el = document.querySelector(
        `meta[property="${property}"]`
      ) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', property);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    upsertNameMeta('description', meta.description);
    upsertNameMeta('robots', meta.robots);
    upsertNameMeta('theme-color', meta.themeColor);
    upsertNameMeta('twitter:card', meta.twitterCard);
    upsertNameMeta('twitter:title', meta.twitterTitle);
    upsertNameMeta('twitter:description', meta.twitterDescription);
    upsertNameMeta('twitter:image', meta.twitterImage);
    upsertNameMeta('twitter:image:alt', meta.twitterImageAlt);

    let canonicalLink = document.querySelector(
      'link[rel="canonical"]'
    ) as HTMLLinkElement | null;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = meta.canonicalUrl;

    upsertPropertyMeta('og:type', meta.ogType);
    upsertPropertyMeta('og:site_name', meta.ogSiteName);
    upsertPropertyMeta('og:title', meta.ogTitle);
    upsertPropertyMeta('og:description', meta.ogDescription);
    upsertPropertyMeta('og:url', meta.ogUrl);
    upsertPropertyMeta('og:image', meta.ogImage);
    upsertPropertyMeta('og:image:secure_url', meta.ogImageSecureUrl);
    upsertPropertyMeta('og:image:type', meta.ogImageType);
    upsertPropertyMeta('og:image:width', meta.ogImageWidth);
    upsertPropertyMeta('og:image:height', meta.ogImageHeight);
    upsertPropertyMeta('og:image:alt', meta.ogImageAlt);
    upsertPropertyMeta('og:locale', meta.ogLocale);

    document
      .querySelectorAll('meta[property="og:locale:alternate"]')
      .forEach((n) => n.remove());
    meta.ogLocaleAlternates.forEach((altLoc) => {
      const m = document.createElement('meta');
      m.setAttribute('property', 'og:locale:alternate');
      m.content = altLoc;
      document.head.appendChild(m);
    });

    document
      .querySelectorAll('link[rel="alternate"][hreflang]')
      .forEach((node) => node.remove());

    meta.hreflangs.forEach((entry) => {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = entry.hreflang;
      link.href = entry.href;
      link.setAttribute('data-vidnex-hreflang', 'true');
      document.head.appendChild(link);
    });

    let scriptEl = document.getElementById(
      'vidnex-jsonld-schema'
    ) as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.id = 'vidnex-jsonld-schema';
      scriptEl.type = 'application/ld+json';
      document.head.appendChild(scriptEl);
    }
    scriptEl.textContent = JSON.stringify(meta.jsonLdGraph);
  }, [pageKey, language, blogSlug, loadedBundleLocale]);

  return null;
};
