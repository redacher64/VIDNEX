import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createMemoryD1Database } from './functions/_lib/db';

/**
 * Pont de développement local Cloudflare Pages Functions (`/functions/api/*`).
 * Permet d'exécuter `/api/extract`, `/api/download`, `/api/public-config` et `/api/admin/*`
 * directement dans `vite` (`npm run dev`) avec une instance D1 en mémoire.
 */
function cloudflarePagesFunctionsDevBridge(): Plugin {
  const localDevDb = createMemoryD1Database();

  return {
    name: 'cloudflare-pages-functions-dev-bridge',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '');

      server.middlewares.use(async (req, res, next) => {
        if (!req.url) {
          return next();
        }

        // Add X-Robots-Tag: noindex, nofollow on /admin HTML navigation in dev
        if (req.url === '/admin' || req.url.startsWith('/admin?') || req.url.startsWith('/admin/')) {
          res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        }

        if (!req.url.startsWith('/api/')) {
          const cleanPath = req.url.split('?')[0];
          if (cleanPath === '/llms.txt') {
            const { buildLlmsTxt } = await import('./src/i18n/config.ts');
            const { SITE_URL } = await import('./src/config/site.ts');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end(buildLlmsTxt(SITE_URL));
            return;
          }
          if (
            cleanPath === '/.well-known/ai-catalog.json' ||
            cleanPath === '/.well-known/ard.json' ||
            cleanPath.startsWith('/.well-known/')
          ) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('X-Robots-Tag', 'noindex, nofollow');
            res.end(req.method === 'HEAD' ? undefined : 'Not Found');
            return;
          }
          const isStaticAsset =
            cleanPath.startsWith('/src/') ||
            cleanPath.startsWith('/@') ||
            cleanPath.startsWith('/node_modules/') ||
            cleanPath.startsWith('/assets/') ||
            cleanPath.includes('.');
          if (!isStaticAsset) {
            const { parsePathname } = await import('./src/utils/i18nRouting.ts');
            const parsed = parsePathname(cleanPath);
            if (parsed.isNotFound && !parsed.isAdmin) {
              res.statusCode = 404;
              res.setHeader('X-Robots-Tag', 'noindex, nofollow');
            }
          }
          return next();
        }

        try {
          let body: Uint8Array | undefined;
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            const buf = Buffer.concat(chunks);
            if (buf.length > 0) {
              body = new Uint8Array(buf);
            }
          }

          const workerMod = await import('./worker.ts');
          const worker = workerMod.default;

          const protocol = 'http';
          const host = req.headers.host || 'localhost:3000';
          const fullUrl = `${protocol}://${host}${req.url}`;

          const headers = new Headers();
          for (const [key, val] of Object.entries(req.headers)) {
            if (typeof val === 'string') {
              headers.set(key, val);
            } else if (Array.isArray(val)) {
              headers.set(key, val.join(', '));
            }
          }

          const webReq = new Request(fullUrl, {
            method: req.method || 'GET',
            headers,
            body,
          });

          const mergedEnv = {
            ...process.env,
            ...env,
            DB: localDevDb,
            ADMIN_PASSWORD:
              env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'vidnex-admin-dev',
            SESSION_SECRET:
              env.SESSION_SECRET ||
              process.env.SESSION_SECRET ||
              'vidnex-local-dev-hmac-secret-key-2026',
            IP_HASH_SALT:
              env.IP_HASH_SALT || process.env.IP_HASH_SALT || 'vidnex-local-dev-ip-salt',
          };

          const pendingTasks: Promise<unknown>[] = [];
          const ctx = {
            waitUntil(p: Promise<unknown>) {
              pendingTasks.push(p.catch(() => {}));
            },
          };

          const webRes: Response = await worker.fetch(webReq, mergedEnv, ctx);
          if (pendingTasks.length > 0) {
            await Promise.allSettled(pendingTasks);
          }

          res.statusCode = webRes.status;
          webRes.headers.forEach((value, key) => {
            res.setHeader(key, value);
          });

          if (!webRes.body) {
            res.end();
            return;
          }

          const arrayBuf = await webRes.arrayBuffer();
          res.end(Buffer.from(arrayBuf));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              ok: false,
              error: {
                code: 'BLOCKED_BY_PLATFORM',
                message:
                  err instanceof Error ? err.message : 'Erreur interne du Worker.',
              },
            })
          );
        }
      });
    },
    async transformIndexHtml(html, ctx) {
      if (!ctx.server) {
        return html;
      }
      try {
        const rawUrl = ctx.originalUrl || ctx.path || '/';
        const cleanPath = rawUrl.split('?')[0].split('#')[0] || '/';
        const { parsePathname } = await import('./src/utils/i18nRouting.ts');
        const { buildHeadMetadataForRoute } = await import(
          './src/i18n/hreflang.ts'
        );
        const { getLocaleBundleSync } = await import(
          './src/i18n/localeLoader.ts'
        );

        const parsed = parsePathname(cleanPath);
        const bundle = getLocaleBundleSync(parsed.lang);
        const meta = buildHeadMetadataForRoute(
          parsed.lang,
          parsed.isAdmin ? 'admin' : parsed.pageKey
        );

        const esc = (s: string) =>
          String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

        let out = html
          .replace(
            /<html[^>]*>/i,
            `<html lang="${meta.lang}" dir="${meta.dir}" class="light">`
          )
          .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(meta.title)}</title>`)
          .replace(
            /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
            `<link rel="canonical" href="${esc(meta.canonicalUrl)}" />`
          )
          .replace(
            /<meta\s+name="theme-color"\s+content="[^"]*"\s*\/?>/i,
            `<meta name="theme-color" content="${esc(meta.themeColor)}" />`
          )
          .replace(
            /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i,
            `<meta name="robots" content="${esc(meta.robots)}" />`
          )
          .replace(
            /<meta\s+name="description"[\s\S]*?\/>/i,
            `<meta name="description" content="${esc(meta.description)}" />`
          )
          .replace(
            /<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/i,
            `<meta property="og:type" content="${esc(meta.ogType)}" />`
          )
          .replace(
            /<meta\s+property="og:site_name"\s+content="[^"]*"\s*\/?>/i,
            `<meta property="og:site_name" content="${esc(meta.ogSiteName)}" />`
          )
          .replace(
            /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
            `<meta property="og:title" content="${esc(meta.ogTitle)}" />`
          )
          .replace(
            /<meta\s+property="og:description"[\s\S]*?\/>/i,
            `<meta property="og:description" content="${esc(meta.ogDescription)}" />`
          )
          .replace(
            /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
            `<meta property="og:url" content="${esc(meta.ogUrl)}" />`
          )
          .replace(
            /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i,
            `<meta property="og:image" content="${esc(meta.ogImage)}" />`
          )
          .replace(
            /<meta\s+property="og:image:secure_url"\s+content="[^"]*"\s*\/?>/i,
            `<meta property="og:image:secure_url" content="${esc(meta.ogImageSecureUrl)}" />`
          )
          .replace(
            /<meta\s+property="og:image:type"\s+content="[^"]*"\s*\/?>/i,
            `<meta property="og:image:type" content="${esc(meta.ogImageType)}" />`
          )
          .replace(
            /<meta\s+property="og:image:width"\s+content="[^"]*"\s*\/?>/i,
            `<meta property="og:image:width" content="${esc(meta.ogImageWidth)}" />`
          )
          .replace(
            /<meta\s+property="og:image:height"\s+content="[^"]*"\s*\/?>/i,
            `<meta property="og:image:height" content="${esc(meta.ogImageHeight)}" />`
          )
          .replace(
            /<meta\s+property="og:image:alt"[\s\S]*?\/>/i,
            `<meta property="og:image:alt" content="${esc(meta.ogImageAlt)}" />`
          )
          .replace(
            /<meta\s+property="og:locale"\s+content="[^"]*"\s*\/?>/i,
            `<meta property="og:locale" content="${esc(meta.ogLocale)}" />`
          )
          .replace(
            /<meta\s+name="twitter:card"\s+content="[^"]*"\s*\/?>/i,
            `<meta name="twitter:card" content="${esc(meta.twitterCard)}" />`
          )
          .replace(
            /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
            `<meta name="twitter:title" content="${esc(meta.twitterTitle)}" />`
          )
          .replace(
            /<meta\s+name="twitter:description"[\s\S]*?\/>/i,
            `<meta name="twitter:description" content="${esc(meta.twitterDescription)}" />`
          )
          .replace(
            /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i,
            `<meta name="twitter:image" content="${esc(meta.twitterImage)}" />`
          )
          .replace(
            /<meta\s+name="twitter:image:alt"[\s\S]*?\/>/i,
            `<meta name="twitter:image:alt" content="${esc(meta.twitterImageAlt)}" />`
          );

        const extra: string[] = [];
        for (const altLoc of meta.ogLocaleAlternates) {
          extra.push(
            `    <meta property="og:locale:alternate" content="${esc(altLoc)}" />`
          );
        }
        for (const hl of meta.hreflangs) {
          extra.push(
            `    <link rel="alternate" hreflang="${esc(hl.hreflang)}" href="${esc(
              hl.href
            )}" data-vidnex-hreflang="true" />`
          );
        }
        extra.push(
          `    <script id="vidnex-jsonld-schema" type="application/ld+json">${JSON.stringify(
            meta.jsonLdGraph
          )}</script>`
        );
        if (!parsed.isAdmin) {
          const safeBundleJson = JSON.stringify(bundle).replace(/</g, '\\u003c');
          extra.push(
            `    <script>window.__VIDNEX_LOCALE_BUNDLE__=${safeBundleJson};</script>`
          );
        }

        out = out.replace('</head>', `${extra.join('\n')}\n  </head>`);
        return out;
      } catch {
        return html;
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), cloudflarePagesFunctionsDevBridge()],
  build: {
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
});
