import type { ToolSlug } from '../../src/data/seoToolsConfig.ts';
import { SEO_TOOLS_CONFIG } from '../../src/data/seoToolsConfig.ts';
import type { LanguageCode } from '../../src/i18n/translations.ts';
import {
  getLocalizedToolConfig,
  SUPPORTED_LANGUAGES,
} from '../../src/i18n/translations.ts';
import {
  buildLocalizedPath,
  DEFAULT_LANGUAGE,
  parsePathname,
} from '../../src/utils/i18nRouting.ts';

const SITE_ORIGIN = 'https://vidnex.space';

// Types for Cloudflare Workers HTMLRewriter runtime global
interface HTMLRewriterElement {
  setAttribute(name: string, value: string): HTMLRewriterElement;
  removeAttribute(name: string): HTMLRewriterElement;
  setInnerContent(
    content: string,
    options?: { html?: boolean }
  ): HTMLRewriterElement;
  append(content: string, options?: { html?: boolean }): HTMLRewriterElement;
}

interface HTMLRewriterHandler {
  element?: (element: HTMLRewriterElement) => void | Promise<void>;
}

declare class HTMLRewriter {
  on(selector: string, handlers: HTMLRewriterHandler): HTMLRewriter;
  transform(response: Response): Response;
}

const HOME_METAS: Record<LanguageCode, { title: string; description: string }> = {
  en: {
    title: 'VIDNEX — Universal Media Downloader',
    description:
      'Fast, clean, zero-watermark HD media extraction for Instagram (Reels, Carousels, Stories, HD DP) and TikTok (Videos, Photo Slideshows, MP3, HD DP).',
  },
  fr: {
    title: 'VIDNEX — Téléchargeur Vidéo HD Sans Filigrane (Instagram, TikTok, X)',
    description:
      'Téléchargez instantanément et gratuitement vos vidéos Instagram, Reels, TikTok sans filigrane, photos HD et audios MP3 en qualité originale.',
  },
  es: {
    title: 'VIDNEX — Descargador de Videos HD Sin Marca de Agua (Instagram, TikTok, X)',
    description:
      'Descarga videos de Instagram Reels, TikTok sin marca de agua, fotos HD y música MP3 en calidad original sin publicidad invasiva.',
  },
  pt: {
    title: 'VIDNEX — Baixar Vídeos HD Sem Marca d’Água (Instagram, TikTok, X)',
    description:
      'Baixe vídeos do Instagram Reels, TikTok sem marca d’água, fotos de perfil HD e áudios MP3 na qualidade original.',
  },
  ar: {
    title: 'VIDNEX — تحميل فيديو عالي الدقة بدون علامة مائية (إنستغرام، تيك توك، إكس)',
    description:
      'تحميل مقاطع إنستغرام ريلز وتيك توك بدون علامة مائية وصور البروفايل بدقة عالية ومقاطع صوت MP3 مجاناً وبأعلى جودة.',
  },
};

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
  const { lang, toolSlug } = parsePathname(pathname);
  const langMeta =
    SUPPORTED_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_LANGUAGES[0];

  let title = HOME_METAS[lang]?.title || HOME_METAS[DEFAULT_LANGUAGE].title;
  let description =
    HOME_METAS[lang]?.description || HOME_METAS[DEFAULT_LANGUAGE].description;

  if (toolSlug && toolSlug in SEO_TOOLS_CONFIG) {
    const baseConfig = SEO_TOOLS_CONFIG[toolSlug as ToolSlug];
    const localized = getLocalizedToolConfig(baseConfig, lang);
    if (localized.metaTitle) title = localized.metaTitle;
    if (localized.metaDescription) description = localized.metaDescription;
  }

  const canonicalPath = buildLocalizedPath(lang, toolSlug);
  const canonicalUrl = `${SITE_ORIGIN}${canonicalPath}`;

  const hreflangs = SUPPORTED_LANGUAGES.map((l) => ({
    lang: l.code,
    href: `${SITE_ORIGIN}${buildLocalizedPath(l.code, toolSlug)}`,
  }));

  const xDefaultHref = `${SITE_ORIGIN}${buildLocalizedPath(DEFAULT_LANGUAGE, toolSlug)}`;

  return {
    lang,
    dir: langMeta.dir,
    title,
    description,
    canonicalUrl,
    hreflangs,
    xDefaultHref,
  };
}

/**
 * Transforms an HTML Response on Cloudflare Edge using HTMLRewriter.
 * Injects localized <html lang="...">, <title>, <meta description>, canonical, and hreflang links.
 */
export function applySeoHtmlRewriter(
  request: Request,
  response: Response
): Response {
  // Only rewrite HTML responses
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  const url = new URL(request.url);
  const { pathname } = url;

  // Never touch admin paths
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return response;
  }

  const meta = resolveSeoMetadataForPath(pathname);

  const rewriter = new HTMLRewriter()
    .on('html', {
      element(el) {
        el.setAttribute('lang', meta.lang);
        if (meta.dir === 'rtl') {
          el.setAttribute('dir', 'rtl');
        } else {
          el.removeAttribute('dir');
        }
      },
    })
    .on('title', {
      element(el) {
        el.setInnerContent(meta.title);
      },
    })
    .on('meta[name="description"]', {
      element(el) {
        el.setAttribute('content', meta.description);
      },
    })
    .on('meta[property="og:title"]', {
      element(el) {
        el.setAttribute('content', meta.title);
      },
    })
    .on('meta[property="og:description"]', {
      element(el) {
        el.setAttribute('content', meta.description);
      },
    })
    .on('meta[property="og:url"]', {
      element(el) {
        el.setAttribute('content', meta.canonicalUrl);
      },
    })
    .on('link[rel="canonical"]', {
      element(el) {
        el.setAttribute('href', meta.canonicalUrl);
      },
    })
    .on('head', {
      element(el) {
        // Append all alternate hreflang tags
        for (const hl of meta.hreflangs) {
          el.append(
            `<link rel="alternate" hreflang="${hl.lang}" href="${hl.href}" />`,
            { html: true }
          );
        }
        // Append x-default pointing to the default English URL
        el.append(
          `<link rel="alternate" hreflang="x-default" href="${meta.xDefaultHref}" />`,
          { html: true }
        );
      },
    });

  return rewriter.transform(response);
}
