/**
 * Route Cloudflare Pages Function : `GET /api/extract?url=...` et `POST /api/extract`
 * Point d'entrée unifié d'extraction 100 % gratuit pour VIDNEX (TikTok & Instagram).
 * Intègre D1 (maintenance, plateformes, blocklist, rate-limit, logs et engine_status via waitUntil)
 * tout en garantissant que l'extraction publique continue si D1 est indisponible.
 */

import { detectUrl, type SupportedPlatform } from '../_lib/detect.ts';
import { extractTikTok } from '../_lib/tiktok.ts';
import { extractInstagram } from '../_lib/instagram.ts';
import { extractX, resolveTcoShortLink } from '../_lib/x.ts';
import {
  createSuccessResponse,
  createErrorResponse,
  mapErrorCodeToHttpStatus,
  optionsResponse,
  type ExtractResponse,
} from '../_lib/normalize.ts';
import {
  type AdminEnv,
  type ExecutionContextLike,
  getRawClientIp,
  hashIpAddress,
} from '../_lib/db.ts';
import { getSystemSettings, isRequestBlocked } from '../_lib/settings.ts';
import { checkD1RateLimit } from '../_lib/ratelimit.ts';
import { logExtractionEvent } from '../_lib/logger.ts';

export interface Env extends AdminEnv {
  IG_SESSION_ID?: string;
  IG_CSRF_TOKEN?: string;
  IG_COOKIES?: string;
  TIKWM_API_KEY?: string;
  TT_COOKIE?: string;
}

export interface PagesContext {
  request: Request;
  env: Env;
  ctx?: ExecutionContextLike;
  waitUntil?: (promise: Promise<unknown>) => void;
}

export const onRequestOptions = async (): Promise<Response> => {
  return optionsResponse();
};

export const onRequestGet = async (context: PagesContext): Promise<Response> => {
  const ctx: ExecutionContextLike | undefined =
    context.ctx || (context.waitUntil ? { waitUntil: context.waitUntil } : undefined);
  return handleExtract(context.request, context.env || {}, ctx);
};

export const onRequestPost = async (context: PagesContext): Promise<Response> => {
  const ctx: ExecutionContextLike | undefined =
    context.ctx || (context.waitUntil ? { waitUntil: context.waitUntil } : undefined);
  return handleExtract(context.request, context.env || {}, ctx);
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

function scheduleAsyncLog(
  ctx: ExecutionContextLike | undefined,
  promise: Promise<unknown>
): void {
  const safePromise = promise.catch(() => {
    // Silent failure: logging must never break public extraction
  });
  if (ctx && typeof ctx.waitUntil === 'function') {
    try {
      ctx.waitUntil(safePromise);
      return;
    } catch {
      // Fallback
    }
  }
}

async function handleExtract(
  request: Request,
  env: Env,
  ctx?: ExecutionContextLike
): Promise<Response> {
  const startedAt = Date.now();
  const rawIp = getRawClientIp(request);
  const ipHash = await hashIpAddress(rawIp, env.IP_HASH_SALT);

  // 0. Chargement de la configuration D1 (avec repli silencieux si D1 est coupé)
  const settings = await getSystemSettings(env);

  // Vérification 1 : Mode maintenance global
  if (settings.maintenance) {
    return createErrorResponse(
      'MAINTENANCE',
      'VIDNEX est temporairement en maintenance programmée. Veuillez réessayer dans quelques instants.',
      503
    );
  }

  let targetUrl = '';
  let preferredPlatform: SupportedPlatform = 'instagram';

  if (request.method === 'GET') {
    const parsed = new URL(request.url);
    targetUrl = (parsed.searchParams.get('url') || '').trim();
    const p = parsed.searchParams.get('platform');
    if (p === 'tiktok' || p === 'instagram' || p === 'x') {
      preferredPlatform = p;
    } else if (p === 'twitter') {
      preferredPlatform = 'x';
    }
  } else if (request.method === 'POST') {
    try {
      const body: any = await request.json().catch(() => ({}));
      targetUrl = String(body?.url || '').trim();
      if (body?.platform === 'tiktok' || body?.platform === 'instagram' || body?.platform === 'x') {
        preferredPlatform = body.platform;
      } else if (body?.platform === 'twitter') {
        preferredPlatform = 'x';
      }
    } catch {
      targetUrl = '';
    }
  }

  // Vérification 2 : Liste de blocage (IP hachée, domaine ou URL)
  const isBlocked = await isRequestBlocked(env, ipHash, targetUrl);
  if (isBlocked) {
    scheduleAsyncLog(
      ctx,
      logExtractionEvent(env, {
        platform: preferredPlatform,
        status: 'error',
        errorCode: 'BLOCKED',
        durationMs: Date.now() - startedAt,
        ipHash,
      })
    );
    return createErrorResponse(
      'BLOCKED',
      'Cette requête ou ressource a été restreinte par l’administrateur.',
      403
    );
  }

  // Vérification 3 : Limite de débit par IP (D1 rate_limits avec fallback mémoire)
  const rate = await checkD1RateLimit(env, ipHash, settings.rate_limit_per_min);
  if (!rate.allowed) {
    scheduleAsyncLog(
      ctx,
      logExtractionEvent(env, {
        platform: preferredPlatform,
        status: 'error',
        errorCode: 'RATE_LIMITED',
        durationMs: Date.now() - startedAt,
        ipHash,
      })
    );
    return createErrorResponse(
      'RATE_LIMITED',
      `Limite de requêtes atteinte (${settings.rate_limit_per_min}/min). Veuillez patienter ${rate.retryAfterSec}s avant de réessayer.`,
      429,
      { 'Retry-After': String(rate.retryAfterSec) }
    );
  }

  if (!targetUrl) {
    return createErrorResponse(
      'UNSUPPORTED_URL',
      'Paramètre "url" manquant. Veuillez coller un lien TikTok, Instagram ou X (Twitter).',
      400
    );
  }

  // 1. Détection et validation d'URL
  let detection = detectUrl(targetUrl, preferredPlatform);
  if (!detection.isValid || !detection.platform) {
    return createErrorResponse(
      'UNSUPPORTED_URL',
      'URL non supportée. VIDNEX prend en charge les vidéos, carrousels et profils TikTok, Instagram et X (Twitter).',
      400
    );
  }

  // Résolution des liens courts t.co (limite 3 redirections, timeout court), puis revalidation stricte
  if (detection.platform === 'x' && detection.isShortLink) {
    const resolvedTco = await resolveTcoShortLink(detection.cleanUrl);
    if (!resolvedTco) {
      return createErrorResponse(
        'UNSUPPORTED_URL',
        'Impossible de résoudre ce lien court t.co vers un tweet X valide.',
        400
      );
    }
    const revalidated = detectUrl(resolvedTco, 'x');
    if (!revalidated.isValid || revalidated.platform !== 'x' || revalidated.isShortLink) {
      return createErrorResponse(
        'UNSUPPORTED_URL',
        'Le lien court t.co ne pointe pas vers une publication X (Twitter) valide.',
        400
      );
    }
    detection = revalidated;
  }

  // Vérification 4 : Plateforme désactivée dans l'admin
  if (
    (detection.platform === 'tiktok' && !settings.platform_tiktok) ||
    (detection.platform === 'instagram' && !settings.platform_instagram) ||
    (detection.platform === 'x' && settings.platform_x === false)
  ) {
    const label =
      detection.platform === 'tiktok'
        ? 'TikTok'
        : detection.platform === 'instagram'
        ? 'Instagram'
        : 'X (Twitter)';
    scheduleAsyncLog(
      ctx,
      logExtractionEvent(env, {
        platform: detection.platform,
        status: 'error',
        errorCode: 'PLATFORM_DISABLED',
        durationMs: Date.now() - startedAt,
        ipHash,
      })
    );
    return createErrorResponse(
      'PLATFORM_DISABLED',
      `L'extraction ${label} est temporairement désactivée par l'administrateur.`,
      403
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
  } else if (detection.platform === 'x') {
    result = await extractX(detection.identifier || '');
  } else {
    return createErrorResponse(
      'UNSUPPORTED_URL',
      'Plateforme non prise en charge.',
      400
    );
  }

  const durationMs = Date.now() - startedAt;

  if (!result.ok || result.error) {
    const errCode = result.error?.code || 'BLOCKED_BY_PLATFORM';
    scheduleAsyncLog(
      ctx,
      logExtractionEvent(env, {
        platform: detection.platform,
        status: 'error',
        errorCode: errCode,
        durationMs,
        ipHash,
      })
    );
    return createErrorResponse(
      errCode,
      result.error?.message || "Erreur lors de l'extraction du contenu.",
      mapErrorCodeToHttpStatus(errCode)
    );
  }

  // Journalisation asynchrone du succès + mise à jour engine_status via waitUntil()
  scheduleAsyncLog(
    ctx,
    logExtractionEvent(env, {
      platform: detection.platform,
      status: 'success',
      errorCode: null,
      durationMs,
      ipHash,
    })
  );

  // 3. Transformation des URLs d'items vers le proxy sécurisé /api/download
  const username = (result.author?.username || 'media').replace(/[^a-zA-Z0-9_-]/g, '');
  const sharedCookie = result.cookie;
  const tweetOrMediaId = (detection.identifier || 'post').replace(/[^a-zA-Z0-9_-]/g, '');

  const transformedItems = (result.items || []).map((item, idx) => {
    const ext =
      item.ext ||
      (item.kind === 'video' ? 'mp4' : item.kind === 'audio' ? 'mp3' : 'jpg');
    const qualityTag = (item.quality || `${idx + 1}`).replace(/[^a-zA-Z0-9]/g, '');
    const safeFilename =
      result.platform === 'x'
        ? (result.items || []).length > 1
          ? `x_${username}_${tweetOrMediaId}_${qualityTag || idx + 1}.${ext}`
          : `x_${username}_${tweetOrMediaId}.${ext}`
        : `VIDNEX_${result.platform}_${username}_${qualityTag}.${ext}`;
    const itemCookie = item.cookie || sharedCookie;

    return {
      ...item,
      thumbnail: item.thumbnail
        ? wrapDownloadUrl(
            item.thumbnail,
            result.platform === 'x'
              ? `x_${username}_${tweetOrMediaId}_thumb_${idx + 1}.jpg`
              : `VIDNEX_${result.platform}_${username}_slide_${idx + 1}.jpg`,
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
