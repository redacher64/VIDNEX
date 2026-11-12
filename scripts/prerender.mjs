#!/usr/bin/env node
/**
 * Static Pre-Render & Sitemap Generator for VIDNEX (10 languages, 65 public routes).
 * Executed automatically during `npm run build` via `node scripts/prerender.mjs`.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { stop as stopEsbuild } from 'esbuild';
import { createServer } from 'vite';

const ROOT_DIR = process.cwd();
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const LOCALES_DIR = path.join(ROOT_DIR, 'src', 'i18n', 'locales');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Generates a valid 1200x630 PNG image with VIDNEX warm orange/dark branding using built-in node:zlib.
 */
function createOgPngBuffer(width = 1200, height = 630) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const combined = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(combined), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowSize;
    rawData[rowStart] = 0; // filter type 0
    const isTopBar = y < 18 || y > height - 18;
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 3;
      if (isTopBar) {
        // Warm orange accent bar (#ea580c)
        rawData[px] = 234;
        rawData[px + 1] = 88;
        rawData[px + 2] = 12;
      } else {
        // Dark espresso studio background (#140e0a -> #231710 gradient)
        const ratio = x / width;
        rawData[px] = Math.round(20 + ratio * 25);
        rawData[px + 1] = Math.round(14 + ratio * 12);
        rawData[px + 2] = Math.round(10 + ratio * 8);
      }
    }
  }

  const compressed = zlib.deflateSync(rawData, { level: 6 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function assertSocialLengths(locale, label, item) {
  const title = item.ogTitle || item.metaTitle || '';
  const desc = item.ogDescription || item.metaDescription || '';
  const alt = item.ogImageAlt || '';
  const titleLen = [...title].length;
  const descLen = [...desc].length;

  if (!title || titleLen > 60) {
    throw new Error(
      `[OG Validation Error] ${locale} (${label}): ogTitle length is ${titleLen} (must be 1..60 chars): "${title}"`
    );
  }
  if (!desc || descLen < 90 || descLen > 150) {
    throw new Error(
      `[OG Validation Error] ${locale} (${label}): ogDescription length is ${descLen} (must be 90..150 chars): "${desc}"`
    );
  }
  if (!alt || alt.trim().length < 15) {
    throw new Error(
      `[OG Validation Error] ${locale} (${label}): missing or too short ogImageAlt`
    );
  }
}

/**
 * Validates that all 10 locale JSON files exist and contain every required key.
 * Fails the build immediately if any key is missing or empty (ÉTAPE 1).
 */
function loadAndValidateAllLocales(
  SUPPORTED_LOCALES,
  PLATFORM_PAGE_KEYS,
  LEGAL_PAGE_KEYS,
  registerPreloadedLocale
) {
  const map = new Map();
  const refPath = path.join(LOCALES_DIR, 'fr.json');
  const refBundle = JSON.parse(fs.readFileSync(refPath, 'utf8'));

  function assertKeysMatch(obj, ref, locale, keyPath = '') {
    for (const key of Object.keys(ref)) {
      if (key === 'legal') continue; // Legal is mandatory on fr, en, ar
      const currentPath = keyPath ? `${keyPath}.${key}` : key;
      if (!(key in obj) || obj[key] === undefined || obj[key] === null) {
        throw new Error(
          `[i18n Validation Error] Missing key "${currentPath}" in src/i18n/locales/${locale}.json`
        );
      }
      const refVal = ref[key];
      const val = obj[key];
      if (typeof refVal === 'string') {
        if (typeof val !== 'string' || val.trim().length === 0) {
          throw new Error(
            `[i18n Validation Error] Empty or non-string key "${currentPath}" in src/i18n/locales/${locale}.json`
          );
        }
      } else if (Array.isArray(refVal)) {
        if (!Array.isArray(val) || val.length === 0) {
          throw new Error(
            `[i18n Validation Error] Empty array at "${currentPath}" in src/i18n/locales/${locale}.json`
          );
        }
      } else if (typeof refVal === 'object' && refVal !== null) {
        assertKeysMatch(val, refVal, locale, currentPath);
      }
    }
  }

  for (const locale of SUPPORTED_LOCALES) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`);
    if (!fs.existsSync(filePath)) {
      throw new Error(
        `[i18n Validation Error] Missing locale file: src/i18n/locales/${locale}.json`
      );
    }
    const bundle = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assertKeysMatch(bundle, refBundle, locale);
    assertSocialLengths(locale, 'home', bundle.home);

    for (const pKey of PLATFORM_PAGE_KEYS) {
      if (!bundle.platforms[pKey]) {
        throw new Error(
          `[i18n Validation Error] Missing platform "${pKey}" in ${locale}.json`
        );
      }
      assertSocialLengths(locale, `platforms.${pKey}`, bundle.platforms[pKey]);
    }

    if (locale === 'fr' || locale === 'en' || locale === 'ar') {
      for (const lKey of LEGAL_PAGE_KEYS) {
        if (!bundle.legal || !bundle.legal[lKey]) {
          throw new Error(
            `[i18n Validation Error] Missing legal page "${lKey}" in ${locale}.json`
          );
        }
        assertSocialLengths(locale, `legal.${lKey}`, bundle.legal[lKey]);
      }
    }

    registerPreloadedLocale(bundle);
    map.set(locale, bundle);
  }

  console.log(
    `✓ Validated all ${SUPPORTED_LOCALES.length} locale files (0 missing keys, 100% OG length compliance).`
  );
  return map;
}

function buildHtmlDocument(
  templateHtml,
  routePath,
  locale,
  pageKey,
  bundle,
  App,
  buildHeadMetadataForRoute
) {
  const meta = buildHeadMetadataForRoute(locale, pageKey);
  const appHtml = renderToString(
    React.createElement(App, { initialPath: routePath })
  );

  let html = templateHtml;

  // 1. Replace <html ...> attributes with lang and dir
  html = html.replace(
    /<html[^>]*>/i,
    `<html lang="${meta.lang}" dir="${meta.dir}" class="light">`
  );

  // 2. Replace <title>
  html = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(meta.title)}</title>`
  );

  // 3. Replace canonical
  html = html.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${escapeHtml(meta.canonicalUrl)}" />`
  );

  // 4. Replace meta theme-color and meta robots
  html = html.replace(
    /<meta\s+name="theme-color"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="theme-color" content="${escapeHtml(meta.themeColor)}" />`
  );
  html = html.replace(
    /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="robots" content="${escapeHtml(meta.robots)}" />`
  );

  // 5. Replace meta description
  html = html.replace(
    /<meta\s+name="description"[\s\S]*?\/>/i,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`
  );

  // 6. Replace OpenGraph & Twitter tags in template
  html = html.replace(
    /<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:type" content="${escapeHtml(meta.ogType)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:site_name"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:site_name" content="${escapeHtml(meta.ogSiteName)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${escapeHtml(meta.ogTitle)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:description"[\s\S]*?\/>/i,
    `<meta property="og:description" content="${escapeHtml(meta.ogDescription)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:url" content="${escapeHtml(meta.ogUrl)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:image" content="${escapeHtml(meta.ogImage)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:image:secure_url"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:image:secure_url" content="${escapeHtml(meta.ogImageSecureUrl)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:image:type"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:image:type" content="${escapeHtml(meta.ogImageType)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:image:width"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:image:width" content="${escapeHtml(meta.ogImageWidth)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:image:height"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:image:height" content="${escapeHtml(meta.ogImageHeight)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:image:alt"[\s\S]*?\/>/i,
    `<meta property="og:image:alt" content="${escapeHtml(meta.ogImageAlt)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:locale"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:locale" content="${escapeHtml(meta.ogLocale)}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:card"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:card" content="${escapeHtml(meta.twitterCard)}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:title" content="${escapeHtml(meta.twitterTitle)}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:description"[\s\S]*?\/>/i,
    `<meta name="twitter:description" content="${escapeHtml(meta.twitterDescription)}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:image" content="${escapeHtml(meta.twitterImage)}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:image:alt"[\s\S]*?\/>/i,
    `<meta name="twitter:image:alt" content="${escapeHtml(meta.twitterImageAlt)}" />`
  );

  // 7. Build extra head tags: og:locale:alternate, hreflang cluster, JSON-LD, and preloaded locale bundle
  const extraHeadParts = [];

  for (const altLoc of meta.ogLocaleAlternates) {
    extraHeadParts.push(
      `    <meta property="og:locale:alternate" content="${escapeHtml(altLoc)}" />`
    );
  }

  for (const hl of meta.hreflangs) {
    extraHeadParts.push(
      `    <link rel="alternate" hreflang="${escapeHtml(hl.hreflang)}" href="${escapeHtml(hl.href)}" data-vidnex-hreflang="true" />`
    );
  }

  extraHeadParts.push(
    `    <script id="vidnex-jsonld-schema" type="application/ld+json">${JSON.stringify(
      meta.jsonLdGraph
    )}</script>`
  );

  if (pageKey !== 'admin') {
    const safeBundleJson = JSON.stringify(bundle).replace(/</g, '\\u003c');
    extraHeadParts.push(
      `    <script>window.__VIDNEX_LOCALE_BUNDLE__=${safeBundleJson};</script>`
    );
  }

  html = html.replace('</head>', `${extraHeadParts.join('\n')}\n  </head>`);

  // 8. Inject pre-rendered React HTML into <div id="root">
  html = html.replace(
    '<div id="root"></div>',
    `<div id="root">${appHtml}</div>`
  );

  return html;
}

function generateSitemapXml(SITE_URL, getAllPublicRoutes, buildHreflangCluster) {
  const routes = getAllPublicRoutes();
  const lastmod = new Date().toISOString().split('T')[0];

  const urlBlocks = [];

  for (const r of routes) {
    const loc = r.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${r.path}`;
    const hreflangs = buildHreflangCluster(r.pageKey);

    const xhtmlLinks = hreflangs
      .map(
        (hl) =>
          `    <xhtml:link rel="alternate" hreflang="${escapeHtml(
            hl.hreflang
          )}" href="${escapeHtml(hl.href)}" />`
      )
      .join('\n');

    urlBlocks.push(
      [
        '  <url>',
        `    <loc>${escapeHtml(loc)}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${r.changefreq}</changefreq>`,
        `    <priority>${r.priority}</priority>`,
        ...(xhtmlLinks ? [xhtmlLinks] : []),
        '  </url>',
      ].join('\n')
    );
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?xml-stylesheet type="text/css" href="/sitemap.css"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urlBlocks,
    '</urlset>',
    '',
  ].join('\n');
}

async function main() {
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error(
      'dist/ directory does not exist. Run "vite build" before scripts/prerender.mjs.'
    );
  }

  const vite = await createServer({
    configFile: false,
    cacheDir: 'node_modules/.vite-prerender',
    server: {
      middlewareMode: true,
      watch: null,
      hmr: false,
      ws: false,
    },
    optimizeDeps: {
      noDiscovery: true,
    },
    appType: 'custom',
    logLevel: 'error',
  });

  try {
    const { App } = await vite.ssrLoadModule('/src/App.tsx');
    const { buildHeadMetadataForRoute } = await vite.ssrLoadModule(
      '/src/components/SeoSchemaInjector.tsx'
    );
    const { SITE_URL } = await vite.ssrLoadModule('/src/config/site.ts');
    const {
      buildLlmsTxt,
      getAllPublicRoutes,
      LEGAL_PAGE_KEYS,
      PLATFORM_PAGE_KEYS,
      SUPPORTED_LOCALES,
    } = await vite.ssrLoadModule('/src/i18n/config.ts');
    const { buildHreflangCluster } = await vite.ssrLoadModule(
      '/src/i18n/hreflang.ts'
    );
    const { registerPreloadedLocale } = await vite.ssrLoadModule(
      '/src/i18n/localeLoader.ts'
    );

    // 1. Ensure committed OG images in public/og/ are present in dist/og/
    const publicOgDir = path.join(PUBLIC_DIR, 'og');
    const distOgDir = path.join(DIST_DIR, 'og');
    if (fs.existsSync(publicOgDir)) {
      fs.mkdirSync(distOgDir, { recursive: true });
      for (const file of fs.readdirSync(publicOgDir)) {
        fs.copyFileSync(
          path.join(publicOgDir, file),
          path.join(distOgDir, file)
        );
      }
    }

    // 2. Load & validate all 10 locale JSON files
    const localesMap = loadAndValidateAllLocales(
      SUPPORTED_LOCALES,
      PLATFORM_PAGE_KEYS,
      LEGAL_PAGE_KEYS,
      registerPreloadedLocale
    );

    // 3. Read base built index.html template
    const templateHtml = fs.readFileSync(
      path.join(DIST_DIR, 'index.html'),
      'utf8'
    );

    // 4. Pre-render all 65 public routes
    const routes = getAllPublicRoutes();
    for (const route of routes) {
      const bundle = localesMap.get(route.locale);
      const html = buildHtmlDocument(
        templateHtml,
        route.path,
        route.locale,
        route.pageKey,
        bundle,
        App,
        buildHeadMetadataForRoute
      );

      const outPath =
        route.path === '/'
          ? path.join(DIST_DIR, 'index.html')
          : path.join(DIST_DIR, route.path.replace(/^\/+/, ''), 'index.html');

      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, html, 'utf8');
    }

    // 5. Generate /admin/index.html shell with <meta name="robots" content="noindex, nofollow">
    const adminHtml = buildHtmlDocument(
      templateHtml,
      '/admin',
      'fr',
      'admin',
      localesMap.get('fr'),
      App,
      buildHeadMetadataForRoute
    );
    const adminOutPath = path.join(DIST_DIR, 'admin', 'index.html');
    fs.mkdirSync(path.dirname(adminOutPath), { recursive: true });
    fs.writeFileSync(adminOutPath, adminHtml, 'utf8');

    // 6. Generate sitemap.xml and llms.txt in public/ and dist/ (and ensure sitemap.css is in dist/)
    const sitemapXml = generateSitemapXml(
      SITE_URL,
      getAllPublicRoutes,
      buildHreflangCluster
    );
    fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemapXml, 'utf8');
    fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemapXml, 'utf8');

    const llmsTxt = buildLlmsTxt(SITE_URL);
    fs.writeFileSync(path.join(PUBLIC_DIR, 'llms.txt'), llmsTxt, 'utf8');
    fs.writeFileSync(path.join(DIST_DIR, 'llms.txt'), llmsTxt, 'utf8');

    const cssPath = path.join(PUBLIC_DIR, 'sitemap.css');
    if (fs.existsSync(cssPath)) {
      fs.copyFileSync(cssPath, path.join(DIST_DIR, 'sitemap.css'));
    }

    console.log(
      `✓ Pre-rendered ${routes.length} public pages + /admin shell + sitemap.xml + llms.txt.`
    );
  } finally {
    await vite.close();
    await stopEsbuild();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
