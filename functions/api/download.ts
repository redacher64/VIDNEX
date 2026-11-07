/**
 * Route Cloudflare Pages Function : `GET /api/download`
 * Proxy de streaming haute performance avec zero-buffering (aucune mise en mémoire).
 * 
 * Sécurité :
 * - Restreint strictement aux domaines de l'allowlist (CDNs officiels TikTok et Meta/Instagram).
 * - Tout domaine non autorisé est immédiatement rejeté avec HTTP 403.
 */

import { isAllowedMediaHost } from '../_lib/allowlist.ts';
import { BROWSER_USER_AGENT } from '../_lib/http.ts';

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

function inferMimeType(filename: string, upstreamType: string | null, isInline: boolean): string {
  if (
    upstreamType &&
    !upstreamType.includes('text/html') &&
    !upstreamType.includes('text/plain')
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
  return isInline ? 'image/jpeg' : 'application/octet-stream';
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
  const safeFilename = sanitizeFilename(reqUrl.searchParams.get('filename'));
  const isInline = reqUrl.searchParams.get('inline') === '1';

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

  // 1. Validation de l'URL cible
  let parsedTarget: URL;
  try {
    parsedTarget = new URL(rawTargetUrl);
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

  // 2. Vérification de l'allowlist stricte (protection anti-SSRF)
  if (
    (parsedTarget.protocol !== 'https:' && parsedTarget.protocol !== 'http:') ||
    !isAllowedMediaHost(parsedTarget.hostname)
  ) {
    return new Response(
      JSON.stringify({
        error: `Domaine média non autorisé : ${parsedTarget.hostname}. Le proxy est réservé aux CDNs officiels.`,
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

  // 3. Configuration des en-têtes amont
  const lowerHost = parsedTarget.hostname.toLowerCase();
  const referer =
    lowerHost.includes('instagram') ||
    lowerHost.includes('cdninstagram') ||
    lowerHost.includes('fbcdn')
      ? 'https://www.instagram.com/'
      : lowerHost.includes('tikwm')
      ? 'https://www.tikwm.com/'
      : 'https://www.tiktok.com/';

  const upstreamHeaders = new Headers({
    'User-Agent': BROWSER_USER_AGENT,
    Accept: isInline ? 'image/avif,image/webp,image/*,*/*;q=0.8' : '*/*',
    Referer: referer,
  });

  // Transmission de l'en-tête Range pour le défilement vidéo et reprise de téléchargement
  const rangeHeader = context.request.headers.get('Range');
  if (rangeHeader) {
    upstreamHeaders.set('Range', rangeHeader);
  }

  try {
    const upstreamRes = await fetch(parsedTarget.toString(), {
      method: context.request.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: upstreamHeaders,
      redirect: 'follow',
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return new Response(
        JSON.stringify({
          error: `Le serveur distant a renvoyé l'erreur HTTP ${upstreamRes.status}.`,
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
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });

    if (isInline) {
      responseHeaders.set('Content-Disposition', `inline; filename="${safeFilename}"`);
    } else {
      responseHeaders.set('Content-Disposition', `attachment; filename="${safeFilename}"`);
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

    // STREAMING DIRECT : upstreamRes.body est renvoyé sans mise en tampon mémoire
    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error:
          err instanceof Error
            ? `Échec du streaming média : ${err.message}`
            : 'Erreur de streaming média.',
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
};
