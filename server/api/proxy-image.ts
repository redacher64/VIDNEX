import fs from 'node:fs';
import path from 'node:path';
import { BROWSER_USER_AGENT, getBoundBackendUrl } from './_config.ts';

function isDisallowedPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower.startsWith('10.') ||
    lower.startsWith('192.168.') ||
    lower.startsWith('169.254.')
  );
}

function sendStudioFallbackImage(res: any) {
  try {
    const sampleImgPath = path.resolve(
      process.cwd(),
      'public/samples/sample-dp-1080.jpg'
    );
    if (fs.existsSync(sampleImgPath)) {
      const buf = fs.readFileSync(sampleImgPath);
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.status(200).send(buf);
    }
  } catch {
    // Fallback to inline SVG below
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 900" width="720" height="900">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1f130b"/>
        <stop offset="55%" stop-color="#2e1a10"/>
        <stop offset="100%" stop-color="#431407"/>
      </linearGradient>
    </defs>
    <rect width="720" height="900" fill="url(#g)"/>
    <circle cx="360" cy="410" r="56" fill="#ea580c" fill-opacity="0.9"/>
    <polygon points="346,386 346,434 388,410" fill="#fffaf5"/>
    <text x="360" y="540" text-anchor="middle" fill="#fffaf5" font-family="sans-serif" font-size="26" font-weight="700">VIDNEX HD STREAM</text>
  </svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).send(Buffer.from(svg, 'utf-8'));
}

/**
 * Thumbnail CORS Stream Proxy (`GET /api/proxy-image?url=...`)
 * Prevents Instagram / TikTok / X CDN `Cross-Origin-Resource-Policy: same-origin`
 * blocks in Chrome, Safari, and Firefox.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  let rawUrl = typeof req.query?.url === 'string' ? req.query.url.trim() : '';
  if (!rawUrl) {
    return res.status(400).json({ message: 'Missing image url parameter.' });
  }

  if (rawUrl.startsWith('//')) {
    rawUrl = `https:${rawUrl}`;
  } else if (rawUrl.startsWith('/')) {
    rawUrl = `https://www.tikwm.com${rawUrl}`;
  }

  const boundBackendUrl = getBoundBackendUrl();
  if (boundBackendUrl) {
    try {
      const targetEndpoint = new URL('/api/proxy-image', boundBackendUrl);
      targetEndpoint.searchParams.set('url', rawUrl);
      const boundRes = await fetch(targetEndpoint, {
        signal: AbortSignal.timeout(10000),
      });
      if (boundRes.ok) {
        const buf = Buffer.from(await boundRes.arrayBuffer());
        if (buf.byteLength >= 64) {
          res.setHeader(
            'Content-Type',
            boundRes.headers.get('content-type') || 'image/jpeg'
          );
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return res.status(200).send(buf);
        }
      }
    } catch {
      // Fallback to direct image proxy below
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return sendStudioFallbackImage(res);
  }

  if (
    (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
    isDisallowedPrivateHost(parsed.hostname)
  ) {
    return res.status(400).json({ message: 'Disallowed image host.' });
  }

  try {
    const referer = parsed.hostname.includes('instagram')
      ? 'https://www.instagram.com/'
      : parsed.hostname.includes('tikwm')
      ? 'https://www.tikwm.com/'
      : parsed.hostname.includes('tiktok')
      ? 'https://www.tiktok.com/'
      : `${parsed.protocol}//${parsed.hostname}/`;

    const upstream = await fetch(parsed.toString(), {
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        Referer: referer,
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!upstream.ok) {
      return sendStudioFallbackImage(res);
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.byteLength < 64 || contentType.includes('text/html')) {
      return sendStudioFallbackImage(res);
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(buf);
  } catch {
    return sendStudioFallbackImage(res);
  }
}
