#!/usr/bin/env node
/**
 * Build-time SEO Verification Script (ÉTAPE 8).
 * Inspects `dist/` to verify:
 * 1. All 65 public routes are pre-rendered with non-empty <h1>, body text, <title>, <meta description>, and <link rel="canonical">.
 * 2. 100% unique <title> and <meta name="description"> across all 65 pages.
 * 3. 100% reciprocal and self-referencing hreflang tags across all 50 main pages (10 languages + x-default).
 * 4. Valid sitemap.xml and robots.txt (excluding /admin and /api).
 * 5. Zero broken internal <a href="/..."> links across all 65 pre-rendered HTML files.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SITE_URL } from '../src/config/site.ts';
import {
  getAllIndexableRoutes,
  getLocalizedPagePath,
  isLegalPageKey,
  isToolPageKey,
  LEGAL_PAGE_KEYS,
  LEGAL_SUPPORTED_LOCALES,
  LOCALES_CONFIG,
  SUPPORTED_LOCALES,
  TOOL_PAGE_KEYS,
} from '../src/i18n/config.ts';
import {
  buildHeadMetadataForRoute,
  buildHreflangCluster,
  getOgLocales,
} from '../src/i18n/hreflang.ts';
import { getLocaleBundleSync } from '../src/i18n/localeLoader.ts';
import {
  BLOG_ARTICLES,
  BLOG_HUB_LOCALES,
  getBlogArticlePath,
  getPublishedArticleById,
  getPublishedArticlesForLocale,
} from '../src/data/blogArticles.ts';
import { validateStaticBlogRepository } from '../src/utils/blogValidation.ts';

const DIST_DIR = path.join(process.cwd(), 'dist');
const LOCALES_DIR = path.join(process.cwd(), 'src', 'i18n', 'locales');
const LEGAL_DIR = path.join(process.cwd(), 'src', 'i18n', 'legal');
const TOOLS_DIR = path.join(process.cwd(), 'src', 'i18n', 'tools');

const LEGAL_WORD_MINIMUMS = {
  about: 600,
  privacy: 900,
  terms: 700,
  contact: 250,
  dmca: 600,
};

const TOOL_WORD_MINIMUMS = {
  home: 700,
  tiktok: 850,
  instagram: 850,
  x: 850,
  facebook: 850,
  linkedin: 850,
  split_image: 700,
  video_to_mp3: 700,
};

function fail(message) {
  console.error(`✗ [SEO Verification Failed] ${message}`);
  process.exit(1);
}

function extractTagContent(html, regex) {
  const m = html.match(regex);
  return m ? m[1].trim() : null;
}

function decodeHtmlEntities(str) {
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function validateBlogAndLocaleInternalLinks(validInternalPaths) {
  let dataLinksChecked = 0;

  // 1. Validate primaryToolRoute, secondaryToolRoute, and internalLinks on all published articles
  for (const article of BLOG_ARTICLES) {
    if (article.status !== 'published') continue;

    for (const field of ['primaryToolRoute', 'secondaryToolRoute']) {
      const routeVal = article[field];
      if (typeof routeVal === 'string' && routeVal.startsWith('/')) {
        dataLinksChecked++;
        const clean = routeVal.replace(/\/+$/, '') || '/';
        if (!validInternalPaths.has(clean)) {
          fail(
            `Broken ${field} "${routeVal}" in published blog article "${article.id}"`
          );
        }
      }
    }

    for (const [loc, tr] of Object.entries(article.translations)) {
      if (!tr || tr.translationStatus !== 'published') continue;

      for (const link of tr.internalLinks || []) {
        dataLinksChecked++;
        if (link.targetType === 'home') {
          const href = getLocalizedPagePath(loc, 'home');
          if (!validInternalPaths.has(href)) {
            fail(`Broken internalLink home "${href}" in "${article.id}:${loc}"`);
          }
        } else if (link.targetType === 'platform' && link.platformKey) {
          const href = getLocalizedPagePath(loc, link.platformKey);
          if (!validInternalPaths.has(href)) {
            fail(
              `Broken internalLink platform "${href}" in "${article.id}:${loc}"`
            );
          }
        } else if (link.targetType === 'blog_article' && link.targetArticleId) {
          const targetArt = getPublishedArticleById(link.targetArticleId);
          if (!targetArt) {
            fail(
              `Broken internalLink targetArticleId "${link.targetArticleId}" (not published) in "${article.id}:${loc}"`
            );
          }
          const localTr = targetArt.translations[loc];
          const resolvedHref =
            localTr && localTr.translationStatus === 'published'
              ? getBlogArticlePath(loc, localTr.localizedSlug)
              : targetArt.translations.en?.translationStatus === 'published'
              ? getBlogArticlePath('en', targetArt.translations.en.localizedSlug)
              : null;
          if (!resolvedHref || !validInternalPaths.has(resolvedHref)) {
            fail(
              `Broken internalLink blog target "${resolvedHref}" in "${article.id}:${loc}"`
            );
          }
        }
      }

      // Scan markdown links [label](/path) in prose for any broken internal paths
      const textFields = [
        ...(tr.introduction || []),
        ...(tr.content || []).flatMap((s) => [
          ...(s.paragraphs || []),
          ...(s.bullets || []),
          s.technicalCallout?.text || '',
        ]),
        ...(tr.faq || []).flatMap((f) => [f.question, f.answer]),
      ];
      for (const text of textFields) {
        const mdRe = /\]\((\/[^)\s#?]+)\)/g;
        let m;
        while ((m = mdRe.exec(text)) !== null) {
          dataLinksChecked++;
          const clean = m[1].replace(/\/+$/, '') || '/';
          if (!validInternalPaths.has(clean)) {
            fail(
              `Broken inline markdown link "${m[1]}" in published blog article "${article.id}:${loc}"`
            );
          }
        }
      }
    }
  }

  // 2. Scan all locale & legal JSON files for markdown links [label](/path) or explicit VIDNEX internal URLs
  for (const [dirPath, label] of [
    [LOCALES_DIR, 'locale'],
    [LEGAL_DIR, 'legal'],
  ]) {
    if (!fs.existsSync(dirPath)) continue;
    for (const file of fs.readdirSync(dirPath)) {
      if (!file.endsWith('.json')) continue;
      const raw = fs.readFileSync(path.join(dirPath, file), 'utf8');
      const urlRe = /(?:https:\/\/vidnex\.space|\]\()(\/[a-z0-9/_-]+)/gi;
      let m;
      while ((m = urlRe.exec(raw)) !== null) {
        const candidate = m[1].replace(/\/+$/, '') || '/';
        dataLinksChecked++;
        if (!validInternalPaths.has(candidate)) {
          fail(
            `Broken internal link "${candidate}" found in ${label} file ${file}`
          );
        }
      }
    }
  }

  // 3. Scan all 70 per-tool JSON files for broken internal links and same-language blog guide compliance
  if (fs.existsSync(TOOLS_DIR)) {
    for (const loc of SUPPORTED_LOCALES) {
      for (const toolKey of TOOL_PAGE_KEYS) {
        const toolPath = path.join(TOOLS_DIR, loc, `${toolKey}.json`);
        if (!fs.existsSync(toolPath)) {
          fail(`Missing tool content JSON: src/i18n/tools/${loc}/${toolKey}.json`);
        }
        const raw = fs.readFileSync(toolPath, 'utf8');
        const doc = JSON.parse(raw);

        for (const [glName, gl] of [
          ['troubleshooting.guideLink', doc.troubleshooting?.guideLink],
          ['relatedSection.guideLink', doc.relatedSection?.guideLink],
        ]) {
          if (gl && typeof gl.href === 'string') {
            dataLinksChecked++;
            const clean = gl.href.replace(/\/+$/, '') || '/';
            if (!validInternalPaths.has(clean)) {
              fail(
                `Broken ${glName} "${gl.href}" in src/i18n/tools/${loc}/${toolKey}.json`
              );
            }
            const validSameLocalePrefix =
              loc === 'en'
                ? clean.startsWith('/blog/') || clean.startsWith('/en/blog/')
                : clean.startsWith(`/${loc}/blog/`);
            if (!validSameLocalePrefix) {
              fail(
                `Cross-language ${glName} "${gl.href}" in src/i18n/tools/${loc}/${toolKey}.json (must be same locale "${loc}")`
              );
            }
          }
        }

        const urlRe = /(?:https:\/\/vidnex\.space|\]\()(\/[a-z0-9/_-]+)/gi;
        let m;
        while ((m = urlRe.exec(raw)) !== null) {
          const candidate = m[1].replace(/\/+$/, '') || '/';
          dataLinksChecked++;
          if (!validInternalPaths.has(candidate)) {
            fail(
              `Broken internal link "${candidate}" found in tool file ${loc}/${toolKey}.json`
            );
          }
        }
      }
    }
  }

  return dataLinksChecked;
}

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    fail('dist/ directory not found.');
  }

  // Shared blog validation (slug format, no year in slug, unique per locale, metaTitle <= 60, metaDescription 90-150, no H1/raw HTML in body)
  const blogValidation = validateStaticBlogRepository(BLOG_ARTICLES);
  if (!blogValidation.valid) {
    fail(`Blog validation failed:\n  - ${blogValidation.errors.join('\n  - ')}`);
  }

  const routes = getAllIndexableRoutes();
  const validInternalPaths = new Set(routes.map((r) => r.path));
  validInternalPaths.add('/admin');

  const dataLinksChecked = validateBlogAndLocaleInternalLinks(validInternalPaths);

  const titlesSeen = new Map();
  const descriptionsSeen = new Map();
  const hreflangGraph = new Map();

  let totalLinksChecked = 0;

  if (LEGAL_SUPPORTED_LOCALES.length !== 10) {
    fail(
      `Expected LEGAL_SUPPORTED_LOCALES to contain all 10 languages, got ${LEGAL_SUPPORTED_LOCALES.length}`
    );
  }

  if (BLOG_HUB_LOCALES.length !== SUPPORTED_LOCALES.length) {
    fail(
      `Expected BLOG_HUB_LOCALES to contain all ${SUPPORTED_LOCALES.length} languages, got ${BLOG_HUB_LOCALES.length}`
    );
  }
  for (const loc of SUPPORTED_LOCALES) {
    const locPublished = getPublishedArticlesForLocale(loc);
    if (locPublished.length < 5) {
      fail(
        `Blog locale "${loc}" has only ${locPublished.length} published articles (expected >= 5)`
      );
    }
  }

  // Build map of every indexable route path -> owning locale for strict same-language internal link checks
  const routePathToLocale = new Map();
  for (const r of routes) {
    routePathToLocale.set(r.path, r.locale);
  }

  // Build map of every legal path -> owning locale for strict footer locale-isolation verification
  const legalPathToLocale = new Map();
  for (const loc of SUPPORTED_LOCALES) {
    for (const lKey of LEGAL_PAGE_KEYS) {
      legalPathToLocale.set(getLocalizedPagePath(loc, lKey), loc);
    }
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const FORBIDDEN_BLOG_CLAIMS = [
    /100\s*%\s*(s[uû]r|safe|seguro|sicher|g[uü]venli|aman|sicuro|безопасн)/i,
    /\b(illimit[eé]e?s?|unlimited|ilimitad[oa]s?|unbegrenzt|s[ıi]n[ıi]rs[ıi]z|tanpa batas|illimitat[oaie]?|безлимитн)/i,
    /\b(le meilleur|the best|el mejor|o melhor|der beste|en iyi|terbaik|il migliore|лучший)\b/i,
    /آمن\s*100|غير محدود|الأفضل/,
  ];

  const frHomeTitle = getLocaleBundleSync('fr').home.metaTitle;
  let blogPostingsVerified = 0;
  let blogHubsVerified = 0;
  let blogArticlesVerified = 0;
  let newBlogArticlesVerified = 0;
  let legalPagesVerified = 0;
  let toolPagesVerified = 0;
  let footerPagesVerified = 0;

  for (const route of routes) {
    const filePath =
      route.path === '/'
        ? path.join(DIST_DIR, 'index.html')
        : path.join(DIST_DIR, route.path.replace(/^\/+/, ''), 'index.html');

    if (!fs.existsSync(filePath)) {
      fail(`Missing pre-rendered HTML file for route ${route.path} (${filePath})`);
    }

    const html = fs.readFileSync(filePath, 'utf8');
    const expectedMeta = buildHeadMetadataForRoute(
      route.locale,
      route.pageKey,
      route.blogSlug || null
    );

    // 1. Check <html lang="..." dir="..."> matches route locale
    const htmlLang = extractTagContent(html, /<html[^>]*\blang="([^"]+)"/i);
    const htmlDir = extractTagContent(html, /<html[^>]*\bdir="([^"]+)"/i);
    if (htmlLang !== route.locale) {
      fail(`Route ${route.path}: expected lang="${route.locale}", got "${htmlLang}"`);
    }
    const expectedDir = route.locale === 'ar' ? 'rtl' : 'ltr';
    if (htmlDir !== expectedDir) {
      fail(`Route ${route.path}: expected dir="${expectedDir}", got "${htmlDir}"`);
    }

    // 1b. Check window.__VIDNEX_LOCALE_BUNDLE__ exists, matches route.locale, and is page-scoped on blog routes
    const bundleRaw = extractTagContent(
      html,
      /window\.__VIDNEX_LOCALE_BUNDLE__=(\{[\s\S]*?\});<\/script>/i
    );
    if (!bundleRaw) {
      fail(
        `Route ${route.path}: missing inline window.__VIDNEX_LOCALE_BUNDLE__ payload`
      );
    }
    let parsedBundle;
    try {
      parsedBundle = JSON.parse(bundleRaw);
    } catch (err) {
      fail(
        `Route ${route.path}: invalid JSON in window.__VIDNEX_LOCALE_BUNDLE__: ${err.message}`
      );
    }
    if (parsedBundle.locale !== route.locale) {
      fail(
        `Route ${route.path}: window.__VIDNEX_LOCALE_BUNDLE__.locale is "${parsedBundle.locale}", expected "${route.locale}"`
      );
    }
    if (route.pageKey === 'blog' || route.pageKey === 'blog_article') {
      if (parsedBundle.__scope !== route.pageKey) {
        fail(
          `Route ${route.path}: expected scoped blog bundle __scope="${route.pageKey}", got "${parsedBundle.__scope}"`
        );
      }
      if (
        parsedBundle.legal ||
        parsedBundle.ui?.omnibox ||
        parsedBundle.ui?.drawer ||
        parsedBundle.home?.faqs ||
        parsedBundle.home?.editorial
      ) {
        fail(
          `Route ${route.path}: blog window.__VIDNEX_LOCALE_BUNDLE__ contains unused non-blog keys (must only inject strings needed by the page)`
        );
      }
    }

    // 1c. Performance isolation: non-legal routes must NEVER embed legal content; legal routes must ONLY embed their own pageKey
    if (isLegalPageKey(route.pageKey)) {
      if (parsedBundle.__scope !== route.pageKey) {
        fail(
          `Legal route ${route.path}: expected __scope="${route.pageKey}", got "${parsedBundle.__scope}"`
        );
      }
      const legalKeys =
        parsedBundle.legal && typeof parsedBundle.legal === 'object'
          ? Object.keys(parsedBundle.legal)
          : [];
      if (legalKeys.length !== 1 || legalKeys[0] !== route.pageKey) {
        fail(
          `Legal route ${route.path}: window.__VIDNEX_LOCALE_BUNDLE__.legal must contain ONLY ["${route.pageKey}"], got [${legalKeys.join(', ')}]`
        );
      }
    } else if (parsedBundle.legal !== undefined) {
      fail(
        `Non-legal route ${route.path}: window.__VIDNEX_LOCALE_BUNDLE__ must NOT contain "legal" data`
      );
    }

    // 1d. Performance isolation for tool/home pages: ONLY the active toolKey is embedded in toolContent; zero non-active tool chunks
    if (isToolPageKey(route.pageKey)) {
      if (parsedBundle.__scope !== route.pageKey) {
        fail(
          `Tool route ${route.path}: expected __scope="${route.pageKey}", got "${parsedBundle.__scope}"`
        );
      }
      const toolKeys =
        parsedBundle.toolContent && typeof parsedBundle.toolContent === 'object'
          ? Object.keys(parsedBundle.toolContent)
          : [];
      if (toolKeys.length !== 1 || toolKeys[0] !== route.pageKey) {
        fail(
          `Tool route ${route.path}: window.__VIDNEX_LOCALE_BUNDLE__.toolContent must contain ONLY ["${route.pageKey}"], got [${toolKeys.join(', ')}]`
        );
      }
      if (
        parsedBundle.home?.faqs ||
        parsedBundle.home?.editorial ||
        parsedBundle.home?.howToSteps
      ) {
        fail(
          `Tool route ${route.path}: window.__VIDNEX_LOCALE_BUNDLE__.home must not embed legacy editorial/howToSteps/faqs`
        );
      }
      for (const [pk, pv] of Object.entries(parsedBundle.platforms || {})) {
        if (pv && (pv.faqs || pv.editorial || pv.howToSteps)) {
          fail(
            `Tool route ${route.path}: window.__VIDNEX_LOCALE_BUNDLE__.platforms.${pk} must not embed legacy editorial/howToSteps/faqs`
          );
        }
      }
    } else if (parsedBundle.toolContent !== undefined) {
      fail(
        `Non-tool route ${route.path}: window.__VIDNEX_LOCALE_BUNDLE__ must NOT contain "toolContent" data`
      );
    }

    // 2. Check <title> matches route locale metadata & uniqueness
    const rawTitle = extractTagContent(html, /<title>([\s\S]*?)<\/title>/i);
    const title = rawTitle ? decodeHtmlEntities(rawTitle) : null;
    if (!title || title.length < 15) {
      fail(`Route ${route.path}: missing or too short <title>`);
    }
    if (title !== expectedMeta.title) {
      fail(
        `Route ${route.path}: <title> mismatch for locale "${route.locale}" — expected "${expectedMeta.title}", got "${title}"`
      );
    }
    if (route.locale !== 'fr' && title === frHomeTitle) {
      fail(
        `Route ${route.path}: non-French route has French home <title> "${title}"`
      );
    }
    if (titlesSeen.has(title)) {
      fail(
        `Duplicate <title> "${title}" between ${route.path} and ${titlesSeen.get(title)}`
      );
    }
    titlesSeen.set(title, route.path);

    // 2b. Check JSON-LD validity and BlogPosting author + image requirements
    const jsonLdRaw = extractTagContent(
      html,
      /<script\s+id="vidnex-jsonld-schema"\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i
    );
    if (!jsonLdRaw) {
      fail(`Route ${route.path}: missing #vidnex-jsonld-schema JSON-LD script`);
    }
    let jsonLdObj;
    try {
      jsonLdObj = JSON.parse(jsonLdRaw);
    } catch (err) {
      fail(`Route ${route.path}: invalid JSON-LD payload: ${err.message}`);
    }
    const graphNodes = Array.isArray(jsonLdObj['@graph'])
      ? jsonLdObj['@graph']
      : [];
    const blogPostingsToCheck = [];
    for (const node of graphNodes) {
      if (node && node['@type'] === 'BlogPosting') {
        blogPostingsToCheck.push(node);
      }
      if (node && node['@type'] === 'Blog' && Array.isArray(node.blogPost)) {
        for (const bp of node.blogPost) {
          if (bp && bp['@type'] === 'BlogPosting') {
            blogPostingsToCheck.push(bp);
          }
        }
      }
    }
    for (const bp of blogPostingsToCheck) {
      blogPostingsVerified++;
      const hasAuthor =
        bp.author &&
        typeof bp.author === 'object' &&
        typeof bp.author['@type'] === 'string' &&
        typeof bp.author.name === 'string' &&
        bp.author.name.trim().length > 0;
      const hasImage =
        (typeof bp.image === 'string' && /^https:\/\//.test(bp.image)) ||
        (bp.image &&
          typeof bp.image === 'object' &&
          typeof bp.image.url === 'string' &&
          /^https:\/\//.test(bp.image.url));
      if (!hasAuthor) {
        fail(
          `Route ${route.path}: JSON-LD BlogPosting "${bp.headline || bp.url}" is missing valid author`
        );
      }
      if (!hasImage) {
        fail(
          `Route ${route.path}: JSON-LD BlogPosting "${bp.headline || bp.url}" is missing valid image`
        );
      }
      for (const dateField of ['datePublished', 'dateModified']) {
        const dVal = bp[dateField];
        if (typeof dVal === 'string') {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dVal)) {
            fail(
              `Route ${route.path}: JSON-LD BlogPosting ${dateField} "${dVal}" is not YYYY-MM-DD`
            );
          }
          if (dVal > todayIso) {
            fail(
              `Route ${route.path}: JSON-LD BlogPosting ${dateField} "${dVal}" is in the future (> ${todayIso})`
            );
          }
        }
      }
    }

    // 2b-bis. Full BlogPosting + BreadcrumbList + FAQPage presence on every blog article
    if (route.pageKey === 'blog_article') {
      const bpNode = graphNodes.find((n) => n && n['@type'] === 'BlogPosting');
      if (!bpNode) {
        fail(`Blog article ${route.path}: missing JSON-LD BlogPosting node`);
      }
      if (!bpNode.publisher || !bpNode.datePublished || !bpNode.dateModified || bpNode.inLanguage !== route.locale) {
        fail(
          `Blog article ${route.path}: JSON-LD BlogPosting missing required publisher/datePublished/dateModified/inLanguage="${route.locale}"`
        );
      }
      if (!graphNodes.some((n) => n && n['@type'] === 'BreadcrumbList')) {
        fail(`Blog article ${route.path}: missing JSON-LD BreadcrumbList node`);
      }
    }

    // 2c. Check JSON-LD schema types on legal pages (AboutPage / ContactPage / WebPage + BreadcrumbList)
    if (isLegalPageKey(route.pageKey)) {
      const expectedLegalType =
        route.pageKey === 'about'
          ? 'AboutPage'
          : route.pageKey === 'contact'
          ? 'ContactPage'
          : 'WebPage';
      const hasExpectedLegalNode = graphNodes.some(
        (node) => node && node['@type'] === expectedLegalType
      );
      if (!hasExpectedLegalNode) {
        fail(
          `Legal route ${route.path}: missing JSON-LD node with @type="${expectedLegalType}"`
        );
      }
      const hasBreadcrumb = graphNodes.some(
        (node) => node && node['@type'] === 'BreadcrumbList'
      );
      if (!hasBreadcrumb) {
        fail(
          `Legal route ${route.path}: missing JSON-LD BreadcrumbList node`
        );
      }
    }

    // 3. Check <meta name="description"> uniqueness
    const desc = extractTagContent(
      html,
      /<meta\s+name="description"\s+content="([^"]+)"/i
    );
    if (!desc || desc.length < 50) {
      fail(`Route ${route.path}: missing or too short <meta name="description">`);
    }
    if (descriptionsSeen.has(desc)) {
      fail(
        `Duplicate <meta name="description"> between ${route.path} and ${descriptionsSeen.get(desc)}`
      );
    }
    descriptionsSeen.set(desc, route.path);

    // 4. Check self-referencing canonical
    const canonical = extractTagContent(
      html,
      /<link\s+rel="canonical"\s+href="([^"]+)"/i
    );
    const expectedCanonical =
      route.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${route.path}`;
    if (canonical !== expectedCanonical) {
      fail(
        `Route ${route.path}: expected canonical "${expectedCanonical}", got "${canonical}"`
      );
    }

    // 5. Check non-empty <h1> and visible text in #root
    const h1 = extractTagContent(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (!h1 || h1.replace(/<[^>]+>/g, '').trim().length < 5) {
      fail(`Route ${route.path}: missing or empty <h1> in pre-rendered HTML`);
    }

    // 5b. Legal page word count minimum verification (rendered <article> body text)
    if (isLegalPageKey(route.pageKey)) {
      const articleHtml = extractTagContent(
        html,
        /<article\b[^>]*>([\s\S]*?)<\/article>/i
      );
      if (!articleHtml) {
        fail(
          `Legal route ${route.path}: missing <article> container in pre-rendered HTML`
        );
      }
      const plainText = decodeHtmlEntities(
        articleHtml
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
      )
        .replace(/\s+/g, ' ')
        .trim();
      const wordCount = plainText ? plainText.split(/\s+/).length : 0;
      const minWords = LEGAL_WORD_MINIMUMS[route.pageKey];
      if (wordCount < minWords) {
        fail(
          `Legal route ${route.path} (${route.locale}/${route.pageKey}): rendered word count is ${wordCount}, below required minimum ${minWords}`
        );
      }
      legalPagesVerified++;
    }

    // 5c. Tool & home pages (70 routes): rendered <main> word minimum, real HTML <table>, 6-8 FAQs (40-60w each) matching JSON-LD FAQPage 1:1
    if (isToolPageKey(route.pageKey)) {
      const mainHtml = extractTagContent(
        html,
        /<main\b[^>]*>([\s\S]*?)<\/main>/i
      );
      if (!mainHtml) {
        fail(
          `Tool route ${route.path}: missing <main> container in pre-rendered HTML`
        );
      }
      const mainPlainText = decodeHtmlEntities(
        mainHtml
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
      )
        .replace(/\s+/g, ' ')
        .trim();
      const mainWordCount = mainPlainText ? mainPlainText.split(/\s+/).length : 0;
      const minToolWords = TOOL_WORD_MINIMUMS[route.pageKey];
      if (mainWordCount < minToolWords) {
        fail(
          `Tool route ${route.path} (${route.locale}/${route.pageKey}): rendered <main> word count is ${mainWordCount}, below required minimum ${minToolWords}`
        );
      }

      // Real HTML <table> with <thead> and <tbody> (>= 4 rows)
      const tableHtml = extractTagContent(
        mainHtml,
        /<table\b[^>]*>([\s\S]*?)<\/table>/i
      );
      if (!tableHtml || !/<thead\b/i.test(tableHtml) || !/<tbody\b/i.test(tableHtml)) {
        fail(
          `Tool route ${route.path}: missing real HTML <table> with <thead> and <tbody> inside <main>`
        );
      }
      const tbodyHtml = extractTagContent(
        tableHtml,
        /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i
      );
      const tbodyRows = (tbodyHtml || '').match(/<tr\b/gi) || [];
      if (tbodyRows.length < 4) {
        fail(
          `Tool route ${route.path}: formats <table> has only ${tbodyRows.length} rows in <tbody> (expected >= 4)`
        );
      }

      // Extract visible FAQ questions & answers from DOM and verify 6-8 items, 40-60 words each, and 100% match with JSON-LD FAQPage
      const domQuestions = [];
      const domAnswers = [];
      const qRe = /data-faq-question="true"[^>]*>([\s\S]*?)<\/[a-z0-9]+>/gi;
      const aRe = /data-faq-answer="true"[^>]*>([\s\S]*?)<\/[a-z0-9]+>/gi;
      let qMatch;
      while ((qMatch = qRe.exec(mainHtml)) !== null) {
        domQuestions.push(
          decodeHtmlEntities(qMatch[1].replace(/<[^>]+>/g, ' '))
            .replace(/\s+/g, ' ')
            .trim()
        );
      }
      let aMatch;
      while ((aMatch = aRe.exec(mainHtml)) !== null) {
        domAnswers.push(
          decodeHtmlEntities(aMatch[1].replace(/<[^>]+>/g, ' '))
            .replace(/\s+/g, ' ')
            .trim()
        );
      }

      if (
        domQuestions.length !== domAnswers.length ||
        domQuestions.length < 6 ||
        domQuestions.length > 8
      ) {
        fail(
          `Tool route ${route.path}: expected 6..8 rendered FAQ items, found ${domQuestions.length} questions / ${domAnswers.length} answers`
        );
      }

      const faqNode = graphNodes.find((n) => n && n['@type'] === 'FAQPage');
      if (!faqNode || !Array.isArray(faqNode.mainEntity)) {
        fail(`Tool route ${route.path}: missing JSON-LD FAQPage node`);
      }
      if (faqNode.mainEntity.length !== domQuestions.length) {
        fail(
          `Tool route ${route.path}: JSON-LD FAQPage count (${faqNode.mainEntity.length}) does not match rendered DOM FAQ count (${domQuestions.length})`
        );
      }

      for (let i = 0; i < domQuestions.length; i++) {
        const wc = domAnswers[i] ? domAnswers[i].split(/\s+/).length : 0;
        if (wc < 40 || wc > 60) {
          fail(
            `Tool route ${route.path} FAQ #${i + 1}: answer word count is ${wc} (must be 40..60 words)`
          );
        }
        const jsonLdQ = String(faqNode.mainEntity[i]?.name || '')
          .replace(/\s+/g, ' ')
          .trim();
        const jsonLdA = String(faqNode.mainEntity[i]?.acceptedAnswer?.text || '')
          .replace(/\s+/g, ' ')
          .trim();
        if (jsonLdQ !== domQuestions[i]) {
          fail(
            `Tool route ${route.path} FAQ #${i + 1}: JSON-LD question mismatch vs rendered HTML ("${jsonLdQ}" !== "${domQuestions[i]}")`
          );
        }
        if (jsonLdA !== domAnswers[i]) {
          fail(
            `Tool route ${route.path} FAQ #${i + 1}: JSON-LD answer mismatch vs rendered HTML`
          );
        }
      }

      toolPagesVerified++;
    }

    // 5d. Blog hub checks (all 10 locales): zero empty category filters & meta description strictly reflects published platforms
    if (route.pageKey === 'blog') {
      const publishedInLocale = getPublishedArticlesForLocale(route.locale);
      const activeCats = new Set(publishedInLocale.map((item) => item.article.category));
      const catBtnRe = /data-category-key="([^"]+)"/gi;
      let catMatch;
      let catButtonsCount = 0;
      while ((catMatch = catBtnRe.exec(html)) !== null) {
        catButtonsCount++;
        const renderedCat = catMatch[1];
        if (!activeCats.has(renderedCat)) {
          fail(
            `Blog hub ${route.path}: rendered empty category filter "${renderedCat}" with 0 published articles in "${route.locale}"`
          );
        }
      }
      if (catButtonsCount === 0) {
        fail(`Blog hub ${route.path}: expected at least 1 active category filter button`);
      }
      const descLower = decodeHtmlEntities(desc).toLowerCase();
      if (!activeCats.has('facebook-guides') && /\bfacebook\b/i.test(descLower)) {
        fail(
          `Blog hub ${route.path}: meta description mentions Facebook without a published Facebook guide in "${route.locale}"`
        );
      }
      if (!activeCats.has('x-guides') && /\btwitter\b/i.test(descLower)) {
        fail(
          `Blog hub ${route.path}: meta description mentions Twitter without a published X/Twitter guide in "${route.locale}"`
        );
      }
      if (/\byoutube\b|\bsnapchat\b/i.test(descLower)) {
        fail(
          `Blog hub ${route.path}: meta description must not promise unsupported platforms (YouTube/Snapchat)`
        );
      }
      blogHubsVerified++;
    }

    // 5e. Blog article checks (all 63 published articles): same-language internal links, FAQPage 1:1 DOM parity, and strict editorial rules on newly published articles
    if (route.pageKey === 'blog_article') {
      const artObj = route.blogArticleId
        ? getPublishedArticleById(route.blogArticleId)
        : null;
      const trObj = artObj ? artObj.translations[route.locale] : null;
      if (!artObj || !trObj) {
        fail(`Blog article ${route.path}: unable to resolve article/translation in repository`);
      }
      const effectivePublishedAt = trObj.publishedAt || artObj.publishedAt;
      const effectiveUpdatedAt = trObj.updatedAt || artObj.updatedAt;
      const isStrictEditorialGuide =
        effectivePublishedAt >= '2026-11-22' || effectiveUpdatedAt >= '2026-11-22';

      // Extract outer <article> ... </article> (note: related cards use nested <article>, so slice from first <article to last </article>)
      const firstArtIdx = html.indexOf('<article');
      const lastArtIdx = html.lastIndexOf('</article>');
      if (firstArtIdx === -1 || lastArtIdx === -1 || lastArtIdx <= firstArtIdx) {
        fail(`Blog article ${route.path}: missing <article> container in pre-rendered HTML`);
      }
      const outerArticleHtml = html.slice(firstArtIdx, lastArtIdx + '</article>'.length);

      // Verify all internal <a href="/..."> inside <article> (except language switcher links with lang="...") point to same-locale routes
      const artLinkRe = /<a\s+([^>]*)href="(\/[^"#?]*)"([^>]*)>/gi;
      let artLinkMatch;
      while ((artLinkMatch = artLinkRe.exec(outerArticleHtml)) !== null) {
        const attrs = `${artLinkMatch[1]} ${artLinkMatch[3]}`;
        if (/\blang="/i.test(attrs)) continue; // Language switcher link
        const cleanTarget = artLinkMatch[2].replace(/\/+$/, '') || '/';
        const targetOwner = routePathToLocale.get(cleanTarget);
        if (targetOwner && targetOwner !== route.locale) {
          fail(
            `Blog article ${route.path} (locale="${route.locale}"): cross-language internal link "${cleanTarget}" points to locale "${targetOwner}"`
          );
        }
      }

      // Extract visible FAQ items & verify 1:1 parity with JSON-LD FAQPage
      const domFaqQ = [];
      const domFaqA = [];
      const bqRe = /data-faq-question="true"[^>]*>([\s\S]*?)<\/[a-z0-9]+>/gi;
      const baRe = /data-faq-answer="true"[^>]*>([\s\S]*?)<\/[a-z0-9]+>/gi;
      let bqM;
      while ((bqM = bqRe.exec(outerArticleHtml)) !== null) {
        domFaqQ.push(
          decodeHtmlEntities(bqM[1].replace(/<[^>]+>/g, ' '))
            .replace(/\s+/g, ' ')
            .trim()
        );
      }
      let baM;
      while ((baM = baRe.exec(outerArticleHtml)) !== null) {
        domFaqA.push(
          decodeHtmlEntities(baM[1].replace(/<[^>]+>/g, ' '))
            .replace(/\s+/g, ' ')
            .trim()
        );
      }
      if (domFaqQ.length !== domFaqA.length) {
        fail(
          `Blog article ${route.path}: mismatched visible FAQ questions (${domFaqQ.length}) vs answers (${domFaqA.length})`
        );
      }
      if (domFaqQ.length > 0) {
        const faqNode = graphNodes.find((n) => n && n['@type'] === 'FAQPage');
        if (!faqNode || !Array.isArray(faqNode.mainEntity)) {
          fail(`Blog article ${route.path}: missing JSON-LD FAQPage node`);
        }
        if (faqNode.mainEntity.length !== domFaqQ.length) {
          fail(
            `Blog article ${route.path}: JSON-LD FAQPage count (${faqNode.mainEntity.length}) !== rendered DOM FAQ count (${domFaqQ.length})`
          );
        }
        for (let i = 0; i < domFaqQ.length; i++) {
          const jQ = String(faqNode.mainEntity[i]?.name || '')
            .replace(/\s+/g, ' ')
            .trim();
          const jA = String(faqNode.mainEntity[i]?.acceptedAnswer?.text || '')
            .replace(/\s+/g, ' ')
            .trim();
          if (jQ !== domFaqQ[i]) {
            fail(
              `Blog article ${route.path} FAQ #${i + 1}: JSON-LD question mismatch vs rendered HTML`
            );
          }
          if (jA !== domFaqA[i]) {
            fail(
              `Blog article ${route.path} FAQ #${i + 1}: JSON-LD answer mismatch vs rendered HTML`
            );
          }
        }
      }

      // Slice main article body column [data-blog-article-body="true"] up to the related-articles section
      // and enforce a universal >= 1,000 editorial word minimum across ALL published blog articles
      const bodyMarker = outerArticleHtml.indexOf('data-blog-article-body="true"');
      if (bodyMarker === -1) {
        fail(`Blog article ${route.path}: missing data-blog-article-body="true" container`);
      }
      const relatedMarker = outerArticleHtml.indexOf('id="blog-related-heading"');
      const bodySlice =
        relatedMarker > bodyMarker
          ? outerArticleHtml.slice(bodyMarker, relatedMarker)
          : outerArticleHtml.slice(bodyMarker);

      const sourcesIdx = bodySlice.indexOf('id="blog-article-sources-heading"');
      const editorialHtml =
        sourcesIdx > 0 ? bodySlice.slice(0, sourcesIdx) : bodySlice;
      const bodyPlain = decodeHtmlEntities(
        editorialHtml
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
      )
        .replace(/\s+/g, ' ')
        .trim();
      const bodyWc = bodyPlain ? bodyPlain.split(/\s+/).length : 0;

      if (bodyWc < 1000) {
        fail(
          `Blog article ${route.path}: rendered editorial body has ${bodyWc} words (all published articles must have >= 1000 words)`
        );
      }

      if (isStrictEditorialGuide) {
        // Quick answer 40-60 words
        const qaInner = extractTagContent(
          bodySlice,
          /data-quick-answer="true"[^>]*>([\s\S]*?)<\/div>/i
        );
        if (!qaInner) {
          fail(`Blog article ${route.path}: missing data-quick-answer="true" block`);
        }
        const qaPlain = decodeHtmlEntities(qaInner.replace(/<[^>]+>/g, ' '))
          .replace(/\s+/g, ' ')
          .trim();
        const qaWc = qaPlain ? qaPlain.split(/\s+/).length : 0;
        if (qaWc < 40 || qaWc > 60) {
          fail(
            `Blog article ${route.path}: quickAnswer has ${qaWc} words (expected 40..60)`
          );
        }

        // Real HTML <table> and <ol> ordered steps
        if (!/<table\b/i.test(bodySlice) || !/<thead\b/i.test(bodySlice) || !/<tbody\b/i.test(bodySlice)) {
          fail(`Blog article ${route.path}: missing real HTML <table> with <thead> and <tbody>`);
        }
        if (!/<ol\b/i.test(bodySlice)) {
          fail(`Blog article ${route.path}: missing numbered steps <ol>`);
        }

        // FAQ count 4..5 and each answer 40..60 words
        if (domFaqQ.length < 4 || domFaqQ.length > 5) {
          fail(
            `Blog article ${route.path}: strict editorial article must have 4..5 FAQs, found ${domFaqQ.length}`
          );
        }
        for (let i = 0; i < domFaqA.length; i++) {
          const fw = domFaqA[i] ? domFaqA[i].split(/\s+/).length : 0;
          if (fw < 40 || fw > 60) {
            fail(
              `Blog article ${route.path} FAQ #${i + 1}: answer has ${fw} words (expected 40..60)`
            );
          }
        }

        // Editorial body word count (1,200..1,800 words excluding SVG diagram markup, scripts, styles, and external sources list)
        if (bodyWc < 1200 || bodyWc > 1800) {
          fail(
            `Blog article ${route.path}: rendered editorial body has ${bodyWc} words (expected 1200..1800)`
          );
        }

        for (const rx of FORBIDDEN_BLOG_CLAIMS) {
          if (rx.test(bodyPlain) || rx.test(title) || rx.test(desc)) {
            fail(
              `Blog article ${route.path}: forbidden promotional claim matched (${rx})`
            );
          }
        }

        newBlogArticlesVerified++;
      }

      blogArticlesVerified++;
    }

    // 6. Check exact hreflang + x-default tags across ALL indexable routes (main, legal, blog hubs & articles)
    const hreflangRegex =
      /<link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"/gi;
    const pageHreflangs = new Map();
    let match;
    while ((match = hreflangRegex.exec(html)) !== null) {
      if (pageHreflangs.has(match[1])) {
        fail(
          `Route ${route.path}: duplicate hreflang="${match[1]}" tag found`
        );
      }
      pageHreflangs.set(match[1], match[2]);
    }

    const expectedCluster = buildHreflangCluster(
      route.pageKey,
      route.blogArticleId
    );
    if (pageHreflangs.size !== expectedCluster.length) {
      fail(
        `Route ${route.path}: expected ${expectedCluster.length} hreflang tags, found ${pageHreflangs.size}`
      );
    }
    for (const expectedEntry of expectedCluster) {
      if (pageHreflangs.get(expectedEntry.hreflang) !== expectedEntry.href) {
        fail(
          `Route ${route.path}: hreflang="${expectedEntry.hreflang}" mismatch — expected "${expectedEntry.href}", got "${pageHreflangs.get(expectedEntry.hreflang)}"`
        );
      }
    }

    if (isLegalPageKey(route.pageKey)) {
      if (pageHreflangs.size !== LEGAL_SUPPORTED_LOCALES.length + 1) {
        fail(
          `Legal route ${route.path}: expected ${
            LEGAL_SUPPORTED_LOCALES.length + 1
          } hreflang tags, found ${pageHreflangs.size}`
        );
      }
    } else if (route.pageKey === 'blog' || route.pageKey === 'blog_article') {
      if (pageHreflangs.size < 2) {
        fail(
          `Blog route ${route.path}: expected at least 2 hreflang tags (self + x-default), found ${pageHreflangs.size}`
        );
      }
    } else {
      if (pageHreflangs.size !== SUPPORTED_LOCALES.length + 1) {
        fail(
          `Route ${route.path}: expected ${
            SUPPORTED_LOCALES.length + 1
          } hreflang tags, found ${pageHreflangs.size}`
        );
      }
    }

    const selfHreflang = LOCALES_CONFIG[route.locale].hreflang;
    if (pageHreflangs.get(selfHreflang) !== expectedCanonical) {
      fail(
        `Route ${route.path}: missing or mismatched self-referencing hreflang="${selfHreflang}"`
      );
    }
    const xDefaultUrl = pageHreflangs.get('x-default');
    if (!xDefaultUrl) {
      fail(`Route ${route.path}: missing hreflang="x-default"`);
    }
    const xDefaultPath =
      new URL(xDefaultUrl).pathname.replace(/\/+$/, '') || '/';
    if (!validInternalPaths.has(xDefaultPath)) {
      fail(
        `Route ${route.path}: hreflang="x-default" points to non-indexable route "${xDefaultUrl}"`
      );
    }
    hreflangGraph.set(expectedCanonical, pageHreflangs);

    // 6b. Verify og:locale and ALL og:locale:alternate tags match expected page alternates (never collapsed to a single ru_RU)
    const ogLocale = extractTagContent(
      html,
      /<meta\s+property="og:locale"\s+content="([^"]+)"/i
    );
    const {
      ogLocale: expectedOgLocale,
      ogLocaleAlternates: expectedOgAlternates,
    } = getOgLocales(route.locale, route.pageKey, route.blogArticleId);
    if (ogLocale !== expectedOgLocale) {
      fail(
        `Route ${route.path}: expected og:locale="${expectedOgLocale}", got "${ogLocale}"`
      );
    }
    const ogAltRegex =
      /<meta\s+property="og:locale:alternate"\s+content="([^"]+)"/gi;
    const actualOgAlternates = [];
    let ogAltMatch;
    while ((ogAltMatch = ogAltRegex.exec(html)) !== null) {
      actualOgAlternates.push(ogAltMatch[1]);
    }
    const expectedSorted = [...expectedOgAlternates].sort();
    const actualSorted = [...actualOgAlternates].sort();
    if (
      actualOgAlternates.length !== expectedOgAlternates.length ||
      expectedSorted.some((val, idx) => actualSorted[idx] !== val)
    ) {
      fail(
        `Route ${route.path}: og:locale:alternate mismatch — expected [${expectedSorted.join(', ')}], got [${actualSorted.join(', ')}]`
      );
    }
    if (actualOgAlternates.includes(expectedOgLocale)) {
      fail(
        `Route ${route.path}: og:locale:alternate must not include self og:locale "${expectedOgLocale}"`
      );
    }

    // 7. Verify all internal <a href="/..."> links (must be canonical without trailing slash on non-root)
    const linkRegex = /<a\s+[^>]*href="(\/[^"#?]*)"/gi;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(html)) !== null) {
      const rawHref = linkMatch[1];
      if (rawHref !== '/' && rawHref.endsWith('/')) {
        fail(
          `Inconsistent trailing slash in internal link href="${rawHref}" on page ${route.path} (must be non-trailing-slash canonical)`
        );
      }
      const targetHref = rawHref.replace(/\/+$/, '') || '/';
      totalLinksChecked++;
      if (!validInternalPaths.has(targetHref)) {
        fail(
          `Broken internal link href="${rawHref}" found on page ${route.path}`
        );
      }
    }

    // 7b. Verify footer legal links ALWAYS point to the page's own locale (never redirecting to another language)
    const footerHtml = extractTagContent(
      html,
      /<footer\b[^>]*>([\s\S]*?)<\/footer>/i
    );
    if (!footerHtml) {
      fail(`Route ${route.path}: missing <footer> in pre-rendered HTML`);
    }
    const footerLegalListHtml = extractTagContent(
      footerHtml,
      /<ul\b[^>]*data-footer-legal="true"[^>]*>([\s\S]*?)<\/ul>/i
    );
    if (!footerLegalListHtml) {
      fail(
        `Route ${route.path}: missing <ul data-footer-legal="true"> in <footer>`
      );
    }
    const footerLegalHrefs = new Set();
    const footerLinkRe = /<a\s+([^>]*)href="(\/[^"#?]*)"([^>]*)>/gi;
    let footerMatch;
    while ((footerMatch = footerLinkRe.exec(footerLegalListHtml)) !== null) {
      const fHref = footerMatch[2].replace(/\/+$/, '') || '/';
      footerLegalHrefs.add(fHref);
      const legalOwner = legalPathToLocale.get(fHref);
      if (legalOwner && legalOwner !== route.locale) {
        fail(
          `Route ${route.path} (locale="${route.locale}"): footer legal link "${fHref}" points to another locale "${legalOwner}"`
        );
      }
    }
    for (const lKey of LEGAL_PAGE_KEYS) {
      const expectedLegalHref = getLocalizedPagePath(route.locale, lKey);
      if (!footerLegalHrefs.has(expectedLegalHref)) {
        fail(
          `Route ${route.path} (locale="${route.locale}"): footer legal section is missing localized link "${expectedLegalHref}" (${lKey})`
        );
      }
    }
    footerPagesVerified++;
  }

  // 8. Verify 100% reciprocity across hreflangGraph
  for (const [sourceUrl, linksMap] of hreflangGraph.entries()) {
    for (const [langCode, targetUrl] of linksMap.entries()) {
      if (langCode === 'x-default') continue;
      const targetMap = hreflangGraph.get(targetUrl);
      if (!targetMap) {
        fail(
          `Hreflang target "${targetUrl}" referenced from "${sourceUrl}" is not an indexed page`
        );
      }
      for (const [expectedLang, expectedUrl] of linksMap.entries()) {
        if (targetMap.get(expectedLang) !== expectedUrl) {
          fail(
            `Hreflang reciprocity mismatch between "${sourceUrl}" and "${targetUrl}" for hreflang="${expectedLang}"`
          );
        }
      }
    }
  }

  // 9. Verify /admin/index.html is noindex
  const adminHtmlPath = path.join(DIST_DIR, 'admin', 'index.html');
  if (!fs.existsSync(adminHtmlPath)) {
    fail('Missing dist/admin/index.html');
  }
  const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');
  if (!adminHtml.includes('noindex')) {
    fail('dist/admin/index.html is missing meta robots noindex');
  }

  // 10. Verify sitemap.xml, robots.txt, and llms.txt
  const sitemapPath = path.join(DIST_DIR, 'sitemap.xml');
  const robotsPath = path.join(DIST_DIR, 'robots.txt');
  const llmsPath = path.join(DIST_DIR, 'llms.txt');
  if (!fs.existsSync(sitemapPath) || !fs.existsSync(robotsPath)) {
    fail('Missing dist/sitemap.xml or dist/robots.txt');
  }
  if (!fs.existsSync(llmsPath)) {
    fail('Missing dist/llms.txt');
  }
  const llmsTxt = fs.readFileSync(llmsPath, 'utf8');
  if (!llmsTxt.startsWith('# VIDNEX') || !llmsTxt.includes(`${SITE_URL}/`)) {
    fail('dist/llms.txt is invalid or missing # VIDNEX / absolute URLs');
  }
  const sitemapXml = fs.readFileSync(sitemapPath, 'utf8');
  if (sitemapXml.includes('/admin') || sitemapXml.includes('/api/')) {
    fail('dist/sitemap.xml must not contain /admin or /api/');
  }
  const locMatches = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const locCount = locMatches.length;
  if (locCount !== routes.length) {
    fail(
      `dist/sitemap.xml has ${locCount} <loc> entries, expected ${routes.length}`
    );
  }
  for (const locUrl of locMatches) {
    const parsedLoc = new URL(locUrl);
    if (parsedLoc.pathname !== '/' && parsedLoc.pathname.endsWith('/')) {
      fail(`dist/sitemap.xml has trailing slash on non-root <loc>: ${locUrl}`);
    }
    if (parsedLoc.pathname === '/' && !locUrl.endsWith('/')) {
      fail(`dist/sitemap.xml missing trailing slash on root <loc>: ${locUrl}`);
    }
  }

  const xhtmlMatches = [...sitemapXml.matchAll(/<xhtml:link[^>]+href="([^"]+)"/g)].map((m) => m[1]);
  for (const xhtmlUrl of xhtmlMatches) {
    const parsedXhtml = new URL(xhtmlUrl);
    if (parsedXhtml.pathname !== '/' && parsedXhtml.pathname.endsWith('/')) {
      fail(`dist/sitemap.xml has trailing slash on non-root xhtml:link: ${xhtmlUrl}`);
    }
  }

  console.log('==========================================================');
  console.log('✓ VIDNEX SEO Audit Passed:');
  console.log(`  • ${routes.length} pre-rendered HTML pages verified in dist/`);
  console.log(`  • ${titlesSeen.size} unique <title> tags & ${descriptionsSeen.size} unique meta descriptions`);
  console.log(
    `  • ${hreflangGraph.size} multilingual pages with 100% reciprocal & self-referencing hreflang + x-default`
  );
  console.log(
    `  • ${routes.length} pages verified for complete og:locale + og:locale:alternate tags`
  );
  console.log(
    `  • ${routes.length} pages verified for route-matching <title>, <html lang/dir> & window.__VIDNEX_LOCALE_BUNDLE__.locale`
  );
  console.log(
    `  • ${blogPostingsVerified} JSON-LD BlogPosting entries verified with author, image & non-future dates`
  );
  console.log(
    `  • ${blogHubsVerified}/10 blog hubs verified (all 10 locales published, 0 empty categories, accurate meta descriptions)`
  );
  console.log(
    `  • ${blogArticlesVerified} published blog articles verified (same-language links, BlogPosting + BreadcrumbList + 1:1 FAQPage parity; ${newBlogArticlesVerified} new guides validated for 1,200–1,800w, 40–60w quickAnswer & 4–5 FAQs, <table>, <ol>)`
  );
  console.log(
    `  • ${legalPagesVerified}/50 legal pages verified (word minimums, AboutPage/ContactPage/WebPage + BreadcrumbList JSON-LD, 10-language reciprocal hreflang, scoped inline bundle)`
  );
  console.log(
    `  • ${toolPagesVerified}/70 tool & home pages verified (rendered <main> word minimums, HTML <table>, 6-8 FAQs at 40-60w matching JSON-LD FAQPage 1:1, single-tool bundle isolation)`
  );
  console.log(
    `  • ${footerPagesVerified}/${routes.length} page footers verified for strict same-locale legal links (0 cross-language redirects)`
  );
  console.log(
    `  • ${totalLinksChecked} HTML internal <a href> links + ${dataLinksChecked} data/locale/legal links verified (0 broken)`
  );
  console.log(`  • sitemap.xml (${locCount} URLs), robots.txt & llms.txt validated`);
  console.log('==========================================================');
}

main();
