import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Pont de développement local Cloudflare Pages Functions (`/functions/api/*`).
 * Permet d'exécuter `/api/extract` et `/api/download` directement dans `vite` (`npm run dev`)
 * sans avoir besoin d'un dossier `/server` ou `/backend` externe.
 */
function cloudflarePagesFunctionsDevBridge(): Plugin {
  return {
    name: 'cloudflare-pages-functions-dev-bridge',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '');

      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) {
          return next();
        }

        try {
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

          let body: Buffer | undefined;
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            body = Buffer.concat(chunks);
          }

          const webReq = new Request(fullUrl, {
            method: req.method || 'GET',
            headers,
            body: body && body.length > 0 ? body : undefined,
          });

          const webRes: Response = await worker.fetch(
            webReq,
            { ...process.env, ...env },
            {}
          );

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
  base: './',
  plugins: [react(), cloudflarePagesFunctionsDevBridge()],
  build: {
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
});
