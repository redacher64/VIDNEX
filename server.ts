import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import extractHandler from './server/api/extract';
import downloadHandler from './server/api/download';
import proxyImageHandler from './server/api/proxy-image';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // CORS headers for cross-origin frontend requests (e.g. localhost:3000 -> localhost:7860)
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      engines: ['tikwm', 'vxtwitter', 'yt-dlp'],
      cookiesConfigured: Boolean(process.env.COOKIES_TXT_BASE64),
    });
  });

  app.all('/api/extract', async (req, res) => {
    await extractHandler(req, res);
  });

  app.all('/api/download', async (req, res) => {
    await downloadHandler(req, res);
  });

  app.all('/api/proxy-image', async (req, res) => {
    await proxyImageHandler(req, res);
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VIDNEX App Server running on http://0.0.0.0:${PORT}`);
  });

  // Also bind port 7860 in local dev so http://localhost:7860 works out of the box
  if (PORT !== 7860) {
    const apiPortServer = app.listen(7860, '0.0.0.0', () => {
      console.log(`VIDNEX Docker API Bridge listening on http://0.0.0.0:7860`);
    });
    apiPortServer.on('error', () => {
      // Ignore if port 7860 is already bound by Docker / uvicorn
    });
  }
}

startServer();
