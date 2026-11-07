/**
 * Route Cloudflare Pages Function : `GET /api/extract?url=...` (et `POST /api/extract`)
 * Point d'entrée unique d'extraction sans API tierce pour VIDNEX.
 */

import { detectUrl } from '../_lib/detect.ts';
import { extractTikTok } from '../_lib/tiktok.ts';
import { extractInstagram } from '../_lib/instagram.ts';
import {
  createSuccessResponse,
  createErrorResponse,
  optionsResponse,
  type ExtractResponse,
} from '../_lib/normalize.ts';

interface Env {
  IG_SESSION_ID?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

export const onRequestOptions = async (): Promise<Response> => {
  return optionsResponse();
};

export const onRequestGet = async (context: PagesContext): Promise<Response> => {
  return handleExtract(context.request, context.env);
};

export const onRequestPost = async (context: PagesContext): Promise<Response> => {
  return handleExtract(context.request, context.env);
};

async function handleExtract(request: Request, env: Env): Promise<Response> {
  let targetUrl = '';

  if (request.method === 'GET') {
    const parsed = new URL(request.url);
    targetUrl = (parsed.searchParams.get('url') || '').trim();
  } else if (request.method === 'POST') {
    try {
      const body: any = await request.json().catch(() => ({}));
      targetUrl = String(body?.url || '').trim();
    } catch {
      targetUrl = '';
    }
  }

  if (!targetUrl) {
    return createErrorResponse(
      'UNSUPPORTED_URL',
      'Paramètre "url" manquant. Veuillez fournir l\'adresse d\'une vidéo TikTok ou publication Instagram.',
      400
    );
  }

  // 1. Détection et validation d'URL
  const detection = detectUrl(targetUrl);
  if (!detection.isValid || !detection.platform) {
    return createErrorResponse(
      'UNSUPPORTED_URL',
      'URL non supportée. VIDNEX prend en charge les vidéos/photos TikTok et les Reels/posts Instagram.',
      400
    );
  }

  let result: ExtractResponse;

  // 2. Aiguillage vers les moteurs 100 % gratuits
  if (detection.platform === 'tiktok') {
    result = await extractTikTok(detection.cleanUrl);
  } else if (detection.platform === 'instagram') {
    result = await extractInstagram(detection.identifier || '', env);
  } else {
    return createErrorResponse(
      'UNSUPPORTED_URL',
      'Plateforme non prise en charge.',
      400
    );
  }

  if (!result.ok || result.error) {
    return createErrorResponse(
      result.error?.code || 'BLOCKED_BY_PLATFORM',
      result.error?.message || 'Erreur lors de l\'extraction du contenu.',
      200
    );
  }

  // 3. Transformation des URLs d'items vers le proxy sécurisé /api/download
  const username = result.author?.username || 'media';
  const transformedItems = (result.items || []).map((item, idx) => {
    const ext = item.ext || (item.kind === 'video' ? 'mp4' : item.kind === 'audio' ? 'mp3' : 'jpg');
    const safeFilename = `VIDNEX_${result.platform}_${username}_${idx + 1}.${ext}`;
    const proxyDownloadUrl = `/api/download?${new URLSearchParams({
      url: item.url,
      filename: safeFilename,
    }).toString()}`;

    return {
      ...item,
      url: proxyDownloadUrl,
    };
  });

  // Proxy pour le thumbnail également
  let proxyThumbnail = result.thumbnail || '';
  if (proxyThumbnail && (proxyThumbnail.startsWith('http://') || proxyThumbnail.startsWith('https://'))) {
    proxyThumbnail = `/api/download?${new URLSearchParams({
      url: proxyThumbnail,
      filename: `VIDNEX_${result.platform}_${username}_thumb.jpg`,
      inline: '1',
    }).toString()}`;
  }

  return createSuccessResponse({
    platform: result.platform,
    type: result.type,
    title: result.title,
    author: result.author,
    thumbnail: proxyThumbnail,
    items: transformedItems,
  });
}
