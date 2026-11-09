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
