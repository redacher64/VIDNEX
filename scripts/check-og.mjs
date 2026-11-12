#!/usr/bin/env node
/**
 * Social Sharing & OpenGraph Verification Script (ÉTAPE 7 — scripts/check-og.mjs).
 * Inspects all 65 pre-rendered HTML files in `dist/` and fails the build if:
 * 1. Any required OpenGraph, Twitter Card, meta description, theme-color, canonical, or favicon tag is missing.
 * 2. Any URL (canonical, og:url, og:image, og:image:secure_url, twitter:image) is not an absolute https:// URL.
 * 3. og:url differs from <link rel="canonical">.
 * 4. The image file referenced by og:image is missing from dist/, is not 1200x630 px, or exceeds 300 KB.
 * 5. Any title exceeds 60 characters or any description is outside [90, 150] characters.
 * 6. Two pages in the same language share the same title or description.
 * 7. og:locale is inconsistent with the page language (<html lang="...">).
 */
import fs from 'node:fs';
import path from 'node:path';
import { SITE_URL, OG_IMAGES } from '../src/config/site.ts';
import {
  getAllIndexableRoutes,
  isPlatformPageKey,
  LOCALES_CONFIG,
} from '../src/i18n/config.ts';

const DIST_DIR = path.join(process.cwd(), 'dist');
const MAX_IMAGE_BYTES = 300 * 1024; // 300 KB max

function fail(msg) {
  console.error(`✗ [OG Audit Failed] ${msg}`);
  process.exit(1);
}

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function getMetaProperty(html, prop) {
  const re = new RegExp(
    `<meta\\s+property="${prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s+content="([^"]*)"`,
    'i'
  );
  const m = html.match(re);
  return m ? decodeHtmlEntities(m[1]) : null;
}

function getMetaName(html, name) {
  const re = new RegExp(
    `<meta\\s+name="${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s+content="([^"]*)"`,
    'i'
  );
  const m = html.match(re);
  return m ? decodeHtmlEntities(m[1]) : null;
}

/**
 * Reads exact pixel dimensions (width x height) from a JPEG or PNG buffer without external runtime dependencies.
 */
function readImageDimensions(buf) {
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf.length >= 24 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return {
      format: 'image/png',
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20),
    };
  }

  // JPEG signature: FF D8
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buf[offset + 1];
      // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        const height = buf.readUInt16BE(offset + 5);
        const width = buf.readUInt16BE(offset + 7);
        return { format: 'image/jpeg', width, height };
      }
      const segLen = buf.readUInt16BE(offset + 2);
      if (segLen < 2) break;
      offset += 2 + segLen;
    }
  }

  return null;
}

function verifyFaviconsInDist() {
  const requiredFiles = [
    { rel: 'favicon.svg', minBytes: 100 },
    { rel: 'favicon.ico', minBytes: 200 },
    { rel: 'favicon-48x48.png', width: 48, height: 48 },
    { rel: 'apple-touch-icon.png', width: 180, height: 180 },
    { rel: 'icon-192.png', width: 192, height: 192 },
    { rel: 'icon-512.png', width: 512, height: 512 },
    { rel: 'site.webmanifest', minBytes: 100 },
  ];

  for (const item of requiredFiles) {
    const fullPath = path.join(DIST_DIR, item.rel);
    if (!fs.existsSync(fullPath)) {
      fail(`Missing required favicon/manifest asset in dist/: ${item.rel}`);
    }
    const buf = fs.readFileSync(fullPath);
    if (item.minBytes && buf.length < item.minBytes) {
      fail(`Asset dist/${item.rel} is unexpectedly small (${buf.length} bytes)`);
    }
    if (item.width && item.height) {
      const dims = readImageDimensions(buf);
      if (!dims || dims.width !== item.width || dims.height !== item.height) {
        fail(
          `Asset dist/${item.rel} has dimensions ${dims ? `${dims.width}x${dims.height}` : 'unknown'}, expected ${item.width}x${item.height}`
        );
      }
    }
  }
}

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    fail('dist/ directory does not exist. Run "npm run build" first.');
  }

  verifyFaviconsInDist();

  const routes = getAllIndexableRoutes();
  const perLocaleTitles = new Map();
  const perLocaleDescriptions = new Map();
  const summaryRows = [];

  for (const route of routes) {
    const htmlPath =
      route.path === '/'
        ? path.join(DIST_DIR, 'index.html')
        : path.join(DIST_DIR, route.path.replace(/^\/+/, ''), 'index.html');

    if (!fs.existsSync(htmlPath)) {
      fail(`Missing pre-rendered HTML for ${route.path} at ${htmlPath}`);
    }

    const html = fs.readFileSync(htmlPath, 'utf8');

    // 1. Check <html lang="..."> and <title>
    const htmlLangMatch = html.match(/<html[^>]*\blang="([^"]+)"/i);
    const htmlLang = htmlLangMatch ? htmlLangMatch[1] : null;
    if (htmlLang !== route.locale) {
      fail(`Route ${route.path}: <html lang="${htmlLang}"> does not match route locale "${route.locale}"`);
    }

    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    const pageTitle = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : null;
    const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
    const canonicalUrl = canonicalMatch ? decodeHtmlEntities(canonicalMatch[1]) : null;

    // Check favicon <link> tags in <head>
    for (const requiredHref of [
      '/favicon.svg',
      '/favicon-48x48.png',
      '/favicon.ico',
      '/apple-touch-icon.png',
      '/site.webmanifest',
    ]) {
      if (!html.includes(`href="${requiredHref}"`)) {
        fail(`Route ${route.path}: missing <link ... href="${requiredHref}"> in <head>`);
      }
    }

    // 2. Extract all required meta tags (ÉTAPE 1)
    const metaDesc = getMetaName(html, 'description');
    const themeColor = getMetaName(html, 'theme-color');
    const ogType = getMetaProperty(html, 'og:type');
    const ogSiteName = getMetaProperty(html, 'og:site_name');
    const ogTitle = getMetaProperty(html, 'og:title');
    const ogDesc = getMetaProperty(html, 'og:description');
    const ogUrl = getMetaProperty(html, 'og:url');
    const ogLocale = getMetaProperty(html, 'og:locale');
    const ogImage = getMetaProperty(html, 'og:image');
    const ogImageSecure = getMetaProperty(html, 'og:image:secure_url');
    const ogImageType = getMetaProperty(html, 'og:image:type');
    const ogImageWidth = getMetaProperty(html, 'og:image:width');
    const ogImageHeight = getMetaProperty(html, 'og:image:height');
    const ogImageAlt = getMetaProperty(html, 'og:image:alt');

    const twCard = getMetaName(html, 'twitter:card');
    const twTitle = getMetaName(html, 'twitter:title');
    const twDesc = getMetaName(html, 'twitter:description');
    const twImage = getMetaName(html, 'twitter:image');
    const twImageAlt = getMetaName(html, 'twitter:image:alt');

    const requiredChecks = [
      ['<title>', pageTitle],
      ['<link rel="canonical">', canonicalUrl],
      ['meta[name="description"]', metaDesc],
      ['meta[name="theme-color"]', themeColor],
      ['meta[property="og:type"]', ogType],
      ['meta[property="og:site_name"]', ogSiteName],
      ['meta[property="og:title"]', ogTitle],
      ['meta[property="og:description"]', ogDesc],
      ['meta[property="og:url"]', ogUrl],
      ['meta[property="og:locale"]', ogLocale],
      ['meta[property="og:image"]', ogImage],
      ['meta[property="og:image:secure_url"]', ogImageSecure],
      ['meta[property="og:image:type"]', ogImageType],
      ['meta[property="og:image:width"]', ogImageWidth],
      ['meta[property="og:image:height"]', ogImageHeight],
      ['meta[property="og:image:alt"]', ogImageAlt],
      ['meta[name="twitter:card"]', twCard],
      ['meta[name="twitter:title"]', twTitle],
      ['meta[name="twitter:description"]', twDesc],
      ['meta[name="twitter:image"]', twImage],
      ['meta[name="twitter:image:alt"]', twImageAlt],
    ];

    for (const [tagLabel, val] of requiredChecks) {
      if (!val || String(val).trim().length === 0) {
        fail(`Route ${route.path}: missing or empty ${tagLabel}`);
      }
    }

    if (ogType !== 'website') {
      fail(`Route ${route.path}: expected og:type="website", got "${ogType}"`);
    }
    if (twCard !== 'summary_large_image') {
      fail(`Route ${route.path}: expected twitter:card="summary_large_image", got "${twCard}"`);
    }
    if (ogImageWidth !== '1200' || ogImageHeight !== '630') {
      fail(
        `Route ${route.path}: expected og:image:width="1200" and og:image:height="630", got ${ogImageWidth}x${ogImageHeight}`
      );
    }

    // 3. Check absolute https:// URLs and og:url === canonicalUrl
    for (const [urlLabel, u] of [
      ['canonical', canonicalUrl],
      ['og:url', ogUrl],
      ['og:image', ogImage],
      ['og:image:secure_url', ogImageSecure],
      ['twitter:image', twImage],
    ]) {
      if (!u.startsWith('https://')) {
        fail(`Route ${route.path}: ${urlLabel} must be an absolute https:// URL, got "${u}"`);
      }
    }

    if (ogUrl !== canonicalUrl) {
      fail(`Route ${route.path}: og:url ("${ogUrl}") differs from canonical ("${canonicalUrl}")`);
    }
    if (ogImageSecure !== ogImage || twImage !== ogImage) {
      fail(`Route ${route.path}: og:image, og:image:secure_url, and twitter:image must match`);
    }

    // 4. Verify platform-specific OG image assignment and physical file in dist/
    const expectedOgRelPath = isPlatformPageKey(route.pageKey)
      ? OG_IMAGES[route.pageKey]
      : OG_IMAGES.default;
    const expectedOgAbsUrl = `${SITE_URL}${expectedOgRelPath}`;
    if (ogImage !== expectedOgAbsUrl) {
      fail(
        `Route ${route.path} (${route.pageKey}): expected og:image "${expectedOgAbsUrl}", got "${ogImage}"`
      );
    }

    const imageRelPath = ogImage.replace(SITE_URL, '').replace(/^\/+/, '');
    const imageDiskPath = path.join(DIST_DIR, imageRelPath);
    if (!fs.existsSync(imageDiskPath)) {
      fail(`Route ${route.path}: OG image file missing in dist/: ${imageDiskPath}`);
    }
    const imgBuf = fs.readFileSync(imageDiskPath);
    if (imgBuf.length > MAX_IMAGE_BYTES) {
      fail(
        `Route ${route.path}: OG image ${imageRelPath} is ${(imgBuf.length / 1024).toFixed(1)} KB (exceeds 300 KB limit)`
      );
    }
    const dims = readImageDimensions(imgBuf);
    if (!dims || dims.width !== 1200 || dims.height !== 630) {
      fail(
        `Route ${route.path}: OG image ${imageRelPath} dimensions are ${
          dims ? `${dims.width}x${dims.height}` : 'invalid'
        }, expected 1200x630`
      );
    }
    if (dims.format !== ogImageType) {
      fail(
        `Route ${route.path}: og:image:type is "${ogImageType}", but file format is "${dims.format}"`
      );
    }

    // 5. Check title (<= 60 chars) and description (90..150 chars) lengths
    const ogTitleLen = [...ogTitle].length;
    const pageTitleLen = [...pageTitle].length;
    const ogDescLen = [...ogDesc].length;
    const metaDescLen = [...metaDesc].length;

    if (ogTitleLen > 60 || pageTitleLen > 60) {
      fail(
        `Route ${route.path}: title exceeds 60 chars (title=${pageTitleLen}, og:title=${ogTitleLen}): "${ogTitle}"`
      );
    }
    if (ogDescLen < 90 || ogDescLen > 150 || metaDescLen < 90 || metaDescLen > 150) {
      fail(
        `Route ${route.path}: description outside 90..150 chars (description=${metaDescLen}, og:description=${ogDescLen}): "${ogDesc}"`
      );
    }

    // 6. Check uniqueness of title & description within the same language
    if (!perLocaleTitles.has(route.locale)) {
      perLocaleTitles.set(route.locale, new Map());
      perLocaleDescriptions.set(route.locale, new Map());
    }
    const langTitles = perLocaleTitles.get(route.locale);
    const langDescs = perLocaleDescriptions.get(route.locale);

    if (langTitles.has(ogTitle)) {
      fail(
        `Duplicate og:title in locale "${route.locale}" between ${route.path} and ${langTitles.get(ogTitle)}: "${ogTitle}"`
      );
    }
    langTitles.set(ogTitle, route.path);

    if (langDescs.has(ogDesc)) {
      fail(
        `Duplicate og:description in locale "${route.locale}" between ${route.path} and ${langDescs.get(ogDesc)}: "${ogDesc}"`
      );
    }
    langDescs.set(ogDesc, route.path);

    // 7. Check og:locale consistency with route.locale
    const expectedOgLocale = LOCALES_CONFIG[route.locale].ogLocale;
    if (ogLocale !== expectedOgLocale) {
      fail(
        `Route ${route.path}: expected og:locale="${expectedOgLocale}" for lang="${route.locale}", got "${ogLocale}"`
      );
    }

    summaryRows.push({
      path: route.path,
      lang: route.locale,
      title: `${ogTitle} (${ogTitleLen}c)`,
      descLen: `${ogDescLen}c`,
      image: `${path.basename(imageDiskPath)} (${(imgBuf.length / 1024).toFixed(1)}KB)`,
    });
  }

  console.log('====================================================================================================');
  console.log(`✓ VIDNEX OpenGraph, Twitter Cards & Favicons Audit Passed (${routes.length}/${routes.length} pages verified)`);
  console.log('----------------------------------------------------------------------------------------------------');
  console.log(
    `${'PAGE'.padEnd(38)} | ${'LANG'.padEnd(4)} | ${'DESC'.padEnd(5)} | ${'IMAGE'.padEnd(32)} | TITLE`
  );
  console.log('----------------------------------------------------------------------------------------------------');
  for (const r of summaryRows) {
    console.log(
      `${r.path.padEnd(38)} | ${r.lang.padEnd(4)} | ${r.descLen.padEnd(5)} | ${r.image.padEnd(32)} | ${r.title}`
    );
  }
  console.log('====================================================================================================');
}

main();
