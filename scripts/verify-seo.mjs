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
  LEGAL_SUPPORTED_LOCALES,
  LOCALES_CONFIG,
  SUPPORTED_LOCALES,
} from '../src/i18n/config.ts';
import {
  buildHreflangCluster,
  getOgLocales,
} from '../src/i18n/hreflang.ts';
import {
  BLOG_ARTICLES,
  getBlogArticlePath,
  getPublishedArticleById,
} from '../src/data/blogArticles.ts';
import { validateStaticBlogRepository } from '../src/utils/blogValidation.ts';

const DIST_DIR = path.join(process.cwd(), 'dist');
const LOCALES_DIR = path.join(process.cwd(), 'src', 'i18n', 'locales');

function fail(message) {
  console.error(`✗ [SEO Verification Failed] ${message}`);
  process.exit(1);
}

function extractTagContent(html, regex) {
  const m = html.match(regex);
  return m ? m[1].trim() : null;
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

  // 2. Scan all locale JSON files for markdown links [label](/path) or explicit VIDNEX internal URLs
  if (fs.existsSync(LOCALES_DIR)) {
    for (const file of fs.readdirSync(LOCALES_DIR)) {
      if (!file.endsWith('.json')) continue;
      const raw = fs.readFileSync(path.join(LOCALES_DIR, file), 'utf8');
      const urlRe = /(?:https:\/\/vidnex\.space|\]\()(\/[a-z0-9/_-]+)/gi;
      let m;
      while ((m = urlRe.exec(raw)) !== null) {
        const candidate = m[1].replace(/\/+$/, '') || '/';
        dataLinksChecked++;
        if (!validInternalPaths.has(candidate)) {
          fail(`Broken internal link "${candidate}" found in locale file ${file}`);
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

  for (const route of routes) {
    const filePath =
      route.path === '/'
        ? path.join(DIST_DIR, 'index.html')
        : path.join(DIST_DIR, route.path.replace(/^\/+/, ''), 'index.html');

    if (!fs.existsSync(filePath)) {
      fail(`Missing pre-rendered HTML file for route ${route.path} (${filePath})`);
    }

    const html = fs.readFileSync(filePath, 'utf8');

    // 1. Check <html lang="..." dir="...">
    const htmlLang = extractTagContent(html, /<html[^>]*\blang="([^"]+)"/i);
    const htmlDir = extractTagContent(html, /<html[^>]*\bdir="([^"]+)"/i);
    if (htmlLang !== route.locale) {
      fail(`Route ${route.path}: expected lang="${route.locale}", got "${htmlLang}"`);
    }
    const expectedDir = route.locale === 'ar' ? 'rtl' : 'ltr';
    if (htmlDir !== expectedDir) {
      fail(`Route ${route.path}: expected dir="${expectedDir}", got "${htmlDir}"`);
    }

    // 2. Check <title> uniqueness
    const title = extractTagContent(html, /<title>([\s\S]*?)<\/title>/i);
    if (!title || title.length < 15) {
      fail(`Route ${route.path}: missing or too short <title>`);
    }
    if (titlesSeen.has(title)) {
      fail(
        `Duplicate <title> "${title}" between ${route.path} and ${titlesSeen.get(title)}`
      );
    }
    titlesSeen.set(title, route.path);

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
    `  • ${totalLinksChecked} HTML internal <a href> links + ${dataLinksChecked} data/locale links verified (0 broken)`
  );
  console.log(`  • sitemap.xml (${locCount} URLs), robots.txt & llms.txt validated`);
  console.log('==========================================================');
}

main();
