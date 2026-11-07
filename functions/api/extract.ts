/**
 * Route Cloudflare Pages Function : `GET /api/extract?url=...` et `POST /api/extract`
 * Point d'entrée unifié d'extraction 100 % gratuit pour VIDNEX (TikTok & Instagram).
 * Renvoie les vrais codes HTTP sémantiques (400, 403, 404, 429, 502, 504) en cas d'erreur.
 */

import { detectUrl, type SupportedPlatform } from '../_lib/detect.ts';
import { extractTikTok } from '../_lib/tiktok.ts';
import { extractInstagram } from '../_lib/instagram.ts';
import {
  createSuccessResponse,
  createErrorResponse,
  mapErrorCodeToHttpStatus,
  optionsResponse,
  type ExtractResponse,
} from '../_lib/normalize.ts';

export interface Env {
  IG_SESSION_ID?: string;
  IG_CSRF_TOKEN?: string;
  TIKWM_API_KEY?: string;
  TT_COOKIE?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

export const onRequestOptions = async (): Promise<Response> => {
  return optionsResponse();
};

export const onRequestGet = async (context: PagesContext): Promise<Response> => {
  return handleExtract(context.request, context.env || {});
};

export const onRequestPost = async (context: PagesContext): Promise<Response> => {
  return handleExtract(context.request, context.env || {});
};

function encodeBase64Safe(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return '';
  }
}

function wrapDownloadUrl(
  rawUrl: string,
  filename: string,
  inline = false,
  options?: {
    cookie?: string;
    backupUrl?: string;
    sourceUrl?: string;
  }
): string {
  if (!rawUrl || rawUrl.startsWith('/api/download')) return rawUrl;
  const params = new URLSearchParams({
    url: rawUrl,
    filename,
  });
  if (inline) {
    params.set('inline', '1');
  }
  if (options?.cookie) {
    const b64 = encodeBase64Safe(options.cookie);
    if (b64) params.set('ck', b64);
  }
  if (options?.backupUrl) {
    params.set('alt', options.backupUrl);
  }
  if (options?.sourceUrl && !inline) {
    params.set('src', options.sourceUrl);
  }
  return `/api/download?${params.toString()}`;
}

async function handleExtract(request: Request, env: Env): Promise<Response> {
  let targetUrl = '';
  let preferredPlatform: SupportedPlatform = 'instagram';

  if (request.method === 'GET') {
    const parsed = new URL(request.url);
    targetUrl = (parsed.searchParams.get('url') || '').trim();
    const p = parsed.searchParams.get('platform');
    if (p === 'tiktok' || p === 'instagram') {
      preferredPlatform = p;
    }
  } else if (request.method === 'POST') {
    try {
      const body: any = await request.json().catch(() => ({}));
      targetUrl = String(body?.url || '').trim();
      if (body?.platform === 'tiktok' || body?.platform === 'instagram') {
        preferredPlatform = body.platform;
      }
    } catch {
      targetUrl = '';
    }
  }

  if (!targetUrl) {
    return createErrorResponse(
      'UNSUPPORTED_URL',
      'Paramètre "url" manquant. Veuillez coller un lien TikTok ou Instagram.',
      400
    );
  }

  // 1. Détection et validation d'URL
  const detection = detectUrl(targetUrl, preferredPlatform);
  if (!detection.isValid || !detection.platform) {
    return createErrorResponse(
      'UNSUPPORTED_URL',
      'URL non supportée. VIDNEX prend en charge les vidéos, carrousels et profils TikTok et Instagram.',
      400
    );
  }

  let result: ExtractResponse;

  // 2. Aiguillage vers les moteurs 100 % gratuits
  if (detection.platform === 'tiktok') {
    result = await extractTikTok(
      detection.cleanUrl,
      env,
      detection.kind === 'profile' ? 'profile' : 'video',
      detection.identifier
    );
  } else if (detection.platform === 'instagram') {
    result = await extractInstagram(
      detection.identifier || '',
      env,
      detection.kind === 'profile'
        ? 'profile'
        : detection.kind === 'story'
        ? 'story'
        : 'post'
    );
  } else {
    return createErrorResponse(
      'UNSUPPORTED_URL',
      'Plateforme non prise en charge.',
      400
    );
  }

  if (!result.ok || result.error) {
    const errCode = result.error?.code || 'BLOCKED_BY_PLATFORM';
    return createErrorResponse(
      errCode,
      result.error?.message || 'Erreur lors de l\'extraction du contenu.',
      mapErrorCodeToHttpStatus(errCode)
    );
  }

  // 3. Transformation des URLs d'items vers le proxy sécurisé /api/download
  const username = (result.author?.username || 'media').replace(/[^a-zA-Z0-9_-]/g, '');
  const sharedCookie = result.cookie;

  const transformedItems = (result.items || []).map((item, idx) => {
    const ext =
      item.ext ||
      (item.kind === 'video' ? 'mp4' : item.kind === 'audio' ? 'mp3' : 'jpg');
    const qualityTag = (item.quality || `${idx + 1}`).replace(/[^a-zA-Z0-9]/g, '');
    const safeFilename = `VIDNEX_${result.platform}_${username}_${qualityTag}.${ext}`;
    const itemCookie = item.cookie || sharedCookie;

    return {
      ...item,
      thumbnail: item.thumbnail
        ? wrapDownloadUrl(
            item.thumbnail,
            `VIDNEX_${result.platform}_${username}_slide_${idx + 1}.jpg`,
            true,
            { cookie: itemCookie }
          )
        : undefined,
      url: wrapDownloadUrl(item.url, safeFilename, false, {
        cookie: itemCookie,
        backupUrl: item.backupUrl,
        sourceUrl: detection.cleanUrl,
      }),
    };
  });

  // Proxy pour la miniature principale (inline=1)
  let proxyThumbnail = result.thumbnail || '';
  if (
    proxyThumbnail &&
    (proxyThumbnail.startsWith('http://') || proxyThumbnail.startsWith('https://'))
  ) {
    proxyThumbnail = wrapDownloadUrl(
      proxyThumbnail,
      `VIDNEX_${result.platform}_${username}_thumb.jpg`,
      true,
      { cookie: sharedCookie }
    );
  }

  // Proxy pour l'avatar auteur si présent
  const transformedAuthor = result.author
    ? {
        ...result.author,
        avatar:
          result.author.avatar &&
          (result.author.avatar.startsWith('http://') ||
            result.author.avatar.startsWith('https://'))
            ? wrapDownloadUrl(
                result.author.avatar,
                `VIDNEX_${result.platform}_${username}_avatar.jpg`,
                true,
                { cookie: sharedCookie }
              )
            : result.author.avatar,
      }
    : undefined;

  return createSuccessResponse({
    platform: result.platform,
    type: result.type,
    title: result.title,
    duration: result.duration,
    author: transformedAuthor,
    thumbnail: proxyThumbnail,
    items: transformedItems,
  });
}
