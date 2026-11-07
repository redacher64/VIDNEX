/**
 * Route Cloudflare Pages Function : `GET /api/download`
 * Proxy de streaming haute performance avec zero-buffering (aucune mise en mémoire),
 * transmission des cookies de session (`tt_chain_token` / `ttwid`) et repli automatique (auto-heal)
 * si un lien signé expire ou renvoie HTTP 403.
 */

import { isAllowedMediaHost } from '../_lib/allowlist.ts';
import { BROWSER_USER_AGENT } from '../_lib/http.ts';
import { detectUrl } from '../_lib/detect.ts';
import { extractTikTok } from '../_lib/tiktok.ts';
import { extractInstagram } from '../_lib/instagram.ts';

interface PagesContext {
  request: Request;
  env: Record<string, any>;
}

export function sanitizeFilename(raw: string | null): string {
  const cleaned = String(raw || 'VIDNEX_media.mp4')
    .replace(/\.{2,}/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_');
  return cleaned || 'VIDNEX_media.mp4';
}

function decodeBase64Safe(b64: string | null): string {
  if (!b64) return '';
  try {
    return decodeURIComponent(escape(atob(b64)));
  } catch {
    try {
      return atob(b64);
    } catch {
      return '';
    }
  }
}

function inferMimeType(
  filename: string,
  upstreamType: string | null,
  isInline: boolean
): string {
  if (
    upstreamType &&
    !upstreamType.includes('text/html') &&
    !upstreamType.includes('text/plain') &&
    !upstreamType.includes('application/json')
  ) {
    return upstreamType;
  }
  const lower = filename.toLowerCase();
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.zip')) return 'application/zip';
  return isInline ? 'image/jpeg' : 'video/mp4';
}

function inferReferer(hostname: string): string {
  const lower = hostname.toLowerCase();
  if (
    lower.includes('instagram') ||
    lower.includes('cdninstagram') ||
    lower.includes('fbcdn')
  ) {
    return 'https://www.instagram.com/';
  }
  if (lower.includes('tikwm')) {
    return 'https://www.tikwm.com/';
  }
  return 'https://www.tiktok.com/';
}

async function fetchMediaStream(
  targetUrl: string,
  method: string,
  isInline: boolean,
  rangeHeader: string | null,
  cookieHeader?: string
): Promise<Response | null> {
  let normalizedUrl = targetUrl.trim();
  if (normalizedUrl.startsWith('//')) {
    normalizedUrl = `https:${normalizedUrl}`;
  } else if (normalizedUrl.startsWith('/')) {
    normalizedUrl = `https://www.tikwm.com${normalizedUrl}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalizedUrl);
  } catch {
    return null;
  }

  if (
    (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
    !isAllowedMediaHost(parsed.hostname)
  ) {
    return null;
  }

  const referer = inferReferer(parsed.hostname);
  const headers = new Headers({
    'User-Agent': BROWSER_USER_AGENT,
    Accept: isInline ? 'image/avif,image/webp,image/*,*/*;q=0.8' : '*/*',
    Referer: referer,
  });

  if (cookieHeader) {
    headers.set('Cookie', cookieHeader);
  }
  if (rangeHeader) {
    headers.set('Range', rangeHeader);
  }

  try {
    const res = await fetch(parsed.toString(), {
      method: method === 'HEAD' ? 'HEAD' : 'GET',
      headers,
      redirect: 'follow',
    });

    if (res.ok || res.status === 206) {
      return res;
    }

    // Si 403 avec Cookie ou Origin, réessayer une fois avec Origin explicite
    if (res.status === 403) {
      headers.set('Origin', referer.replace(/\/$/, ''));
      const retryRes = await fetch(parsed.toString(), {
        method: method === 'HEAD' ? 'HEAD' : 'GET',
        headers,
        redirect: 'follow',
      });
      if (retryRes.ok || retryRes.status === 206) {
        return retryRes;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export const onRequestOptions = async (): Promise<Response> => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Accept',
      'Access-Control-Max-Age': '86400',
    },
  });
};

export const onRequestGet = async (context: PagesContext): Promise<Response> => {
  const reqUrl = new URL(context.request.url);
  const rawTargetUrl = (reqUrl.searchParams.get('url') || '').trim();
  const altTargetUrl = (reqUrl.searchParams.get('alt') || '').trim();
  const sourcePageUrl = (reqUrl.searchParams.get('src') || '').trim();
  const decodedCookie = decodeBase64Safe(reqUrl.searchParams.get('ck'));
  const safeFilename = sanitizeFilename(reqUrl.searchParams.get('filename'));
  const isInline = reqUrl.searchParams.get('inline') === '1';
  const rangeHeader = context.request.headers.get('Range');
  const method = context.request.method;

  if (!rawTargetUrl) {
    return new Response(
      JSON.stringify({ error: 'Paramètre "url" manquant.' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  // 1. Tentative sur l'URL principale (avec cookies de session si présents)
  let upstreamRes = await fetchMediaStream(
    rawTargetUrl,
    method,
    isInline,
    rangeHeader,
    decodedCookie
  );

  // 2. Tentative sur l'URL de secours (`alt`) si l'URL principale a échoué
  if (!upstreamRes && altTargetUrl) {
    upstreamRes = await fetchMediaStream(
      altTargetUrl,
      method,
      isInline,
      rangeHeader,
      decodedCookie
    );
  }

  // 3. Auto-Heal : Si le flux CDN signé a expiré ou renvoyé 403 et qu'on a l'URL source (`src`),
  //    on régénère un flux frais à la volée !
  if (!upstreamRes && sourcePageUrl) {
    try {
      const detection = detectUrl(sourcePageUrl);
      if (detection.isValid && detection.platform === 'tiktok') {
        const fresh = await extractTikTok(
          detection.cleanUrl,
          context.env,
          detection.kind === 'profile' ? 'profile' : 'video',
          detection.identifier
        );
        if (fresh.ok && fresh.items?.length) {
          const wantAudio = safeFilename.toLowerCase().endsWith('.mp3');
          const freshItem =
            fresh.items.find((it) =>
              wantAudio ? it.kind === 'audio' : it.kind === 'video'
            ) || fresh.items[0];
          if (freshItem?.url) {
            upstreamRes = await fetchMediaStream(
              freshItem.url,
              method,
              isInline,
              rangeHeader,
              freshItem.cookie || fresh.cookie
            );
          }
        }
      } else if (detection.isValid && detection.platform === 'instagram') {
        const fresh = await extractInstagram(
          detection.identifier || '',
          context.env,
          detection.kind === 'profile' ? 'profile' : 'post'
        );
        if (fresh.ok && fresh.items?.length) {
          const freshItem = fresh.items[0];
          if (freshItem?.url) {
            upstreamRes = await fetchMediaStream(
              freshItem.url,
              method,
              isInline,
              rangeHeader,
              freshItem.cookie || fresh.cookie
            );
          }
        }
      }
    } catch {
      // Ignorer si l'auto-heal échoue
    }
  }

  if (!upstreamRes) {
    return new Response(
      JSON.stringify({
        error:
          'Le flux média distant a expiré ou est temporairement indisponible. Veuillez relancer l\'extraction.',
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  const contentType = inferMimeType(
    safeFilename,
    upstreamRes.headers.get('Content-Type'),
    isInline
  );

  const responseHeaders = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers':
      'Content-Disposition, Content-Length, Content-Range, Accept-Ranges',
    'Content-Type': contentType,
    'Cache-Control': isInline ? 'public, max-age=3600' : 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });

  if (isInline) {
    responseHeaders.set(
      'Content-Disposition',
      `inline; filename="${safeFilename}"`
    );
  } else {
    responseHeaders.set(
      'Content-Disposition',
      `attachment; filename="${safeFilename}"`
    );
  }

  const contentLength = upstreamRes.headers.get('Content-Length');
  if (contentLength) {
    responseHeaders.set('Content-Length', contentLength);
  }

  const contentRange = upstreamRes.headers.get('Content-Range');
  if (contentRange) {
    responseHeaders.set('Content-Range', contentRange);
  }

  const acceptRanges = upstreamRes.headers.get('Accept-Ranges');
  if (acceptRanges) {
    responseHeaders.set('Accept-Ranges', acceptRanges);
  } else if (!isInline) {
    responseHeaders.set('Accept-Ranges', 'bytes');
  }

  // STREAMING DIRECT : upstreamRes.body est transmis sans mise en mémoire
  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: responseHeaders,
  });
};
