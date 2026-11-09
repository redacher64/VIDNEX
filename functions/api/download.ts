/**
 * Route Cloudflare Pages Function : `GET /api/download`
 * Proxy de streaming haute performance avec zero-buffering (aucune mise en mémoire).
 *
 * Sécurité & Fiabilité (Étape 3) :
 * - Suivi manuel des redirections (`redirect: 'manual'`, max 4 sauts) en vérifiant que chaque
 *   URL `Location` cible appartient bien à l'allowlist anti-SSRF (`isAllowedMediaHost`).
 * - Adaptation dynamique des headers (`User-Agent`, `Referer` adapté au CDN cible :
 *   `https://www.instagram.com/` ou `https://www.tiktok.com/`).
 * - Limite stricte de taille : rejette tout flux dont `Content-Length` dépasse 250 Mo avec HTTP 413.
 * - Auto-Heal : en cas d'expiration de lien signé (403), bascule sur `alt` ou régénère le flux via `src`.
 */

import { isAllowedMediaHost } from '../_lib/allowlist.ts';
import { BROWSER_USER_AGENT } from '../_lib/http.ts';
import { detectUrl } from '../_lib/detect.ts';
import { extractTikTok } from '../_lib/tiktok.ts';
import { extractInstagram } from '../_lib/instagram.ts';
import { extractX } from '../_lib/x.ts';
import { extractFacebook } from '../_lib/facebook.ts';
import { checkRateLimit, extractClientIp } from '../_lib/ratelimit.ts';

export interface PagesContext {
  request: Request;
  env: Record<string, string | undefined>;
}

const MAX_REDIRECTS = 4;
const MAX_CONTENT_LENGTH_BYTES = 250 * 1024 * 1024; // 250 Mo

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

export function inferRefererForHost(hostname: string, isFacebookHint = false): string {
  const lower = hostname.toLowerCase();
  if (
    isFacebookHint ||
    (lower.includes('fbcdn') && (lower.includes('video') || lower.startsWith('fb')))
  ) {
    return 'https://www.facebook.com/';
  }
  if (
    lower.includes('cdninstagram') ||
    lower.includes('fbcdn') ||
    lower.includes('fbsbx') ||
    lower.includes('instagram')
  ) {
    return 'https://www.instagram.com/';
  }
  if (lower.includes('twimg.com') || lower.includes('twitter') || lower === 'x.com') {
    return 'https://x.com/';
  }
  if (lower.includes('tikwm')) {
    return 'https://www.tikwm.com/';
  }
  return 'https://www.tiktok.com/';
}

interface StreamAttemptResult {
  response: Response | null;
  forbiddenHost?: string;
  tooLarge?: boolean;
}

/**
 * Exécute la requête vers le CDN média avec suivi manuel des redirections (jusqu'à 4 sauts max)
 * et validation anti-SSRF de chaque `Location` cible.
 */
async function fetchMediaStreamWithManualRedirects(
  initialTargetUrl: string,
  method: string,
  isInline: boolean,
  rangeHeader: string | null,
  cookieHeader?: string
): Promise<StreamAttemptResult> {
  let currentUrlStr = initialTargetUrl.trim();
  if (currentUrlStr.startsWith('//')) {
    currentUrlStr = `https:${currentUrlStr}`;
  } else if (currentUrlStr.startsWith('/')) {
    currentUrlStr = `https://www.tikwm.com${currentUrlStr}`;
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(currentUrlStr);
    } catch {
      return { response: null };
    }

    if (
      (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
      !isAllowedMediaHost(parsed.hostname)
    ) {
      return { response: null, forbiddenHost: parsed.hostname };
    }

    const referer = inferRefererForHost(parsed.hostname);
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
        redirect: 'manual',
      });

      // Suivi manuel des redirections 301 / 302 / 303 / 307 / 308
      if (
        res.status === 301 ||
        res.status === 302 ||
        res.status === 303 ||
        res.status === 307 ||
        res.status === 308
      ) {
        const location = res.headers.get('Location');
        if (!location) {
          return { response: null };
        }
        try {
          const nextUrl = new URL(location, parsed);
          if (!isAllowedMediaHost(nextUrl.hostname)) {
            return { response: null, forbiddenHost: nextUrl.hostname };
          }
          currentUrlStr = nextUrl.toString();
          continue;
        } catch {
          return { response: null };
        }
      }

      if (res.ok || res.status === 206) {
        const lenStr = res.headers.get('Content-Length');
        if (lenStr) {
          const byteLen = Number(lenStr);
          if (Number.isFinite(byteLen) && byteLen > MAX_CONTENT_LENGTH_BYTES) {
            return { response: null, tooLarge: true };
          }
        }
        return { response: res };
      }

      // En cas de 403, réessayer une fois avec l'en-tête Origin explicite
      if (res.status === 403) {
        headers.set('Origin', referer.replace(/\/$/, ''));
        const retryRes = await fetch(parsed.toString(), {
          method: method === 'HEAD' ? 'HEAD' : 'GET',
          headers,
          redirect: 'manual',
        });
        if (retryRes.ok || retryRes.status === 206) {
          const lenStr = retryRes.headers.get('Content-Length');
          if (lenStr && Number(lenStr) > MAX_CONTENT_LENGTH_BYTES) {
            return { response: null, tooLarge: true };
          }
          return { response: retryRes };
        }
      }

      return { response: null };
    } catch {
      return { response: null };
    }
  }

  return { response: null };
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
  const clientIp = extractClientIp(context.request);
  if (clientIp !== 'anonymous') {
    const rate = checkRateLimit(`download:${clientIp}`, 60, 60_000);
    if (!rate.allowed) {
      return new Response(
        JSON.stringify({
          error: `Trop de téléchargements simultanés. Veuillez réessayer dans ${rate.retryAfterSec}s.`,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Retry-After': String(rate.retryAfterSec),
          },
        }
      );
    }
  }

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

  // Validation initiale de l'URL cible avant tout appel réseau
  let initialParsed: URL;
  try {
    const normalizedInitial = rawTargetUrl.startsWith('//')
      ? `https:${rawTargetUrl}`
      : rawTargetUrl.startsWith('/')
      ? `https://www.tikwm.com${rawTargetUrl}`
      : rawTargetUrl;
    initialParsed = new URL(normalizedInitial);
  } catch {
    return new Response(
      JSON.stringify({ error: 'URL cible malformée.' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  if (
    (initialParsed.protocol !== 'https:' && initialParsed.protocol !== 'http:') ||
    !isAllowedMediaHost(initialParsed.hostname)
  ) {
    return new Response(
      JSON.stringify({
        error: `Domaine média non autorisé : ${initialParsed.hostname}. Le proxy est réservé aux CDNs officiels.`,
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  // 1. Tentative sur l'URL principale (avec suivi manuel des redirections)
  let attempt = await fetchMediaStreamWithManualRedirects(
    rawTargetUrl,
    method,
    isInline,
    rangeHeader,
    decodedCookie
  );

  if (attempt.tooLarge) {
    return new Response(
      JSON.stringify({
        error: 'Le fichier média dépasse la limite maximale autorisée de 250 Mo.',
      }),
      {
        status: 413,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  if (attempt.forbiddenHost) {
    return new Response(
      JSON.stringify({
        error: `Redirection bloquée vers un domaine non autorisé : ${attempt.forbiddenHost}.`,
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  // 2. Tentative sur l'URL de secours (`alt`) si l'URL principale a échoué
  if (!attempt.response && altTargetUrl) {
    attempt = await fetchMediaStreamWithManualRedirects(
      altTargetUrl,
      method,
      isInline,
      rangeHeader,
      decodedCookie
    );
    if (attempt.tooLarge) {
      return new Response(
        JSON.stringify({
          error: 'Le fichier média dépasse la limite maximale autorisée de 250 Mo.',
        }),
        {
          status: 413,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  }

  // 3. Auto-Heal : Si le flux CDN signé a expiré ou renvoyé 403 et qu'on a l'URL source (`src`),
  //    on régénère un flux frais à la volée
  if (!attempt.response && sourcePageUrl) {
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
            attempt = await fetchMediaStreamWithManualRedirects(
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
            attempt = await fetchMediaStreamWithManualRedirects(
              freshItem.url,
              method,
              isInline,
              rangeHeader,
              freshItem.cookie || fresh.cookie
            );
          }
        }
      } else if (detection.isValid && detection.platform === 'x') {
        const fresh = await extractX(detection.identifier || '');
        if (fresh.ok && fresh.items?.length) {
          const freshItem = fresh.items[0];
          if (freshItem?.url) {
            attempt = await fetchMediaStreamWithManualRedirects(
              freshItem.url,
              method,
              isInline,
              rangeHeader
            );
          }
        }
      } else if (detection.isValid && detection.platform === 'facebook') {
        const fresh = await extractFacebook(detection.cleanUrl, detection.identifier);
        if (fresh.ok && fresh.items?.length) {
          const freshItem = fresh.items[0];
          if (freshItem?.url) {
            attempt = await fetchMediaStreamWithManualRedirects(
              freshItem.url,
              method,
              isInline,
              rangeHeader
            );
          }
        }
      }
    } catch {
      // Ignorer si l'auto-heal échoue
    }
  }

  const upstreamRes = attempt.response;
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

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: responseHeaders,
  });
};
