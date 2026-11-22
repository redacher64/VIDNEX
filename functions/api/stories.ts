/**
 * Route Cloudflare Pages Function : `GET /api/stories?username=...` et `POST /api/stories`
 * Liste toutes les stories actives d'un compte Instagram PUBLIC.
 *
 * Protections :
 * - Interrupteur admin `feature_stories` (désactivé par défaut => 503 « Les stories sont temporairement indisponibles. »)
 * - Comptes publics uniquement (messages distincts : privé, introuvable, aucune story active)
 * - Limite par IP hachée (5 requêtes / heure par défaut, réglable en admin)
 * - Plafond global horaire (réglable en admin) pour maîtriser le coût des fournisseurs
 * - Cache métadonnées de 5 minutes (jamais les fichiers média)
 * - Toutes les miniatures et vidéos passent par `/api/download` avec `&story=1`
 * - Compteur agrégé `story_list_opened` dans `daily_metrics`
 */

import {
  type AdminEnv,
  type ExecutionContextLike,
  getRawClientIp,
  hashIpAddress,
} from '../_lib/db.ts';
import {
  createErrorResponse,
  mapErrorCodeToHttpStatus,
  optionsResponse,
  STORIES_UNAVAILABLE_MESSAGE,
} from '../_lib/normalize.ts';
import { getSystemSettings, isRequestBlocked } from '../_lib/settings.ts';
import { checkD1HourlyRateLimit } from '../_lib/ratelimit.ts';
import {
  incrementDailyMetrics,
  logExtractionEvent,
} from '../_lib/logger.ts';
import {
  getListStoriesCacheKey,
  getStoryMetadataCacheEntry,
  listStoriesWithProviders,
  normalizeInstagramStoryUsername,
} from '../_lib/instagramStories.ts';

export interface PagesContext {
  request: Request;
  env?: AdminEnv;
  ctx?: ExecutionContextLike;
  waitUntil?: (promise: Promise<unknown>) => void;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

export const onRequestOptions = async (): Promise<Response> => {
  return optionsResponse();
};

export const onRequestGet = async (context: PagesContext): Promise<Response> => {
  const ctx: ExecutionContextLike | undefined =
    context.ctx || (context.waitUntil ? { waitUntil: context.waitUntil } : undefined);
  return handleListStories(context.request, context.env || {}, ctx);
};

export const onRequestPost = async (context: PagesContext): Promise<Response> => {
  const ctx: ExecutionContextLike | undefined =
    context.ctx || (context.waitUntil ? { waitUntil: context.waitUntil } : undefined);
  return handleListStories(context.request, context.env || {}, ctx);
};

function scheduleAsync(
  ctx: ExecutionContextLike | undefined,
  promise: Promise<unknown>
): void {
  const safe = promise.catch(() => {});
  if (ctx && typeof ctx.waitUntil === 'function') {
    try {
      ctx.waitUntil(safe);
    } catch {
      // ignore
    }
  }
}

function wrapStoryDownloadUrl(
  rawUrl: string,
  filename: string,
  inline: boolean
): string {
  if (!rawUrl || rawUrl.startsWith('/api/download')) return rawUrl;
  const params = new URLSearchParams({
    url: rawUrl,
    filename,
    story: '1',
  });
  if (inline) {
    params.set('inline', '1');
  }
  return `/api/download?${params.toString()}`;
}

function getStoryErrorDefaultMessage(code: string): string {
  switch (code) {
    case 'STORY_ACCOUNT_PRIVATE':
      return 'Ce compte Instagram est privé. Seules les stories des comptes publics peuvent être consultées.';
    case 'STORY_ACCOUNT_NOT_FOUND':
      return 'Compte Instagram introuvable. Vérifiez le nom d’utilisateur.';
    case 'STORY_NO_ACTIVE':
      return 'Aucune story active trouvée pour ce compte (les stories expirent après 24 h).';
    case 'STORY_RATE_LIMITED':
      return 'Limite horaire atteinte pour le chargement des stories. Veuillez réessayer plus tard.';
    case 'STORIES_UNAVAILABLE':
    default:
      return STORIES_UNAVAILABLE_MESSAGE;
  }
}

async function handleListStories(
  request: Request,
  env: AdminEnv,
  ctx?: ExecutionContextLike
): Promise<Response> {
  const startedAt = Date.now();
  const rawIp = getRawClientIp(request);
  const ipHash = await hashIpAddress(rawIp, env.IP_HASH_SALT);
  const settings = await getSystemSettings(env);

  if (settings.maintenance) {
    return createErrorResponse(
      'MAINTENANCE',
      'VIDNEX est temporairement en maintenance programmée. Veuillez réessayer dans quelques instants.',
      503
    );
  }

  if (!settings.platform_instagram) {
    return createErrorResponse(
      'PLATFORM_DISABLED',
      "L'extraction Instagram est temporairement désactivée par l'administrateur.",
      403
    );
  }

  if (!settings.feature_stories) {
    scheduleAsync(
      ctx,
      logExtractionEvent(env, {
        platform: 'instagram',
        status: 'error',
        errorCode: 'STORIES_UNAVAILABLE',
        durationMs: Date.now() - startedAt,
        ipHash,
        engineStage: 'feature_disabled',
        httpStatus: 503,
        contentKind: 'story',
        engineFn: 'instagram.story',
      })
    );
    return createErrorResponse(
      'STORIES_UNAVAILABLE',
      STORIES_UNAVAILABLE_MESSAGE,
      503
    );
  }

  let rawUsername = '';
  let requestedStoryId = '';
  if (request.method === 'GET') {
    const parsed = new URL(request.url);
    rawUsername = (parsed.searchParams.get('username') || '').trim();
    requestedStoryId = (parsed.searchParams.get('story_id') || '').trim();
  } else if (request.method === 'POST') {
    const body = (await request.json().catch(() => ({}))) as {
      username?: unknown;
      story_id?: unknown;
    };
    rawUsername = String(body?.username ?? '').trim();
    requestedStoryId = String(body?.story_id ?? '').trim();
  }

  const username = normalizeInstagramStoryUsername(rawUsername);
  if (!username) {
    return createErrorResponse(
      'UNSUPPORTED_URL',
      'Nom d’utilisateur Instagram invalide.',
      400
    );
  }

  const canonicalAccountUrl = `https://www.instagram.com/stories/${username}/`;
  const blocked = await isRequestBlocked(env, ipHash, canonicalAccountUrl);
  if (blocked) {
    scheduleAsync(
      ctx,
      logExtractionEvent(env, {
        platform: 'instagram',
        status: 'error',
        errorCode: 'BLOCKED',
        durationMs: Date.now() - startedAt,
        ipHash,
        engineStage: 'blocklist',
        httpStatus: 403,
        contentKind: 'story',
        engineFn: 'instagram.story',
      })
    );
    return createErrorResponse(
      'BLOCKED',
      'Cette requête ou ressource a été restreinte par l’administrateur.',
      403
    );
  }

  // 1. Limite horaire par IP hachée (5 / heure par défaut, réglable en admin)
  const ipRate = await checkD1HourlyRateLimit(
    env,
    `story_list_ip:${ipHash}`,
    settings.stories_list_rate_limit_per_hour
  );
  if (!ipRate.allowed) {
    scheduleAsync(
      ctx,
      logExtractionEvent(env, {
        platform: 'instagram',
        status: 'error',
        errorCode: 'STORY_RATE_LIMITED',
        durationMs: Date.now() - startedAt,
        ipHash,
        engineStage: 'rate_limit_ip',
        httpStatus: 429,
        contentKind: 'story',
        engineFn: 'instagram.story',
      })
    );
    return createErrorResponse(
      'STORY_RATE_LIMITED',
      `Limite atteinte (${settings.stories_list_rate_limit_per_hour} listes de stories par heure). Veuillez réessayer plus tard.`,
      429,
      { 'Retry-After': String(ipRate.retryAfterSec) }
    );
  }

  // 2. Plafond global horaire (uniquement sur cache miss afin de préserver le budget fournisseur)
  const cacheKey = getListStoriesCacheKey(username);
  const hasCachedList = Boolean(getStoryMetadataCacheEntry(cacheKey));
  if (!hasCachedList) {
    const globalRate = await checkD1HourlyRateLimit(
      env,
      'story_list_global',
      settings.stories_global_hourly_cap
    );
    if (!globalRate.allowed) {
      scheduleAsync(
        ctx,
        logExtractionEvent(env, {
          platform: 'instagram',
          status: 'error',
          errorCode: 'STORY_RATE_LIMITED',
          durationMs: Date.now() - startedAt,
          ipHash,
          engineStage: 'rate_limit_global',
          httpStatus: 429,
          contentKind: 'story',
          engineFn: 'instagram.story',
        })
      );
      return createErrorResponse(
        'STORY_RATE_LIMITED',
        'Le plafond horaire global de consultation des stories est temporairement atteint. Veuillez réessayer dans une heure.',
        429,
        { 'Retry-After': String(globalRate.retryAfterSec) }
      );
    }
  }

  // 3. Résolution via l'architecture fournisseurs (avec cache métadonnées 5 min)
  const outcome = await listStoriesWithProviders(username, env, settings, {
    request,
  });

  // Journaliser chaque échec de fournisseur avec content_kind = 'story', engine_stage = fournisseur, http_status
  for (const attempt of outcome.attempts) {
    if (!attempt.ok) {
      scheduleAsync(
        ctx,
        logExtractionEvent(env, {
          platform: 'instagram',
          status: 'error',
          errorCode: attempt.errorCode || 'BLOCKED_BY_PLATFORM',
          durationMs: attempt.durationMs,
          ipHash,
          engineStage: attempt.provider,
          httpStatus: attempt.httpStatus ?? null,
          contentKind: 'story',
          engineFn: 'instagram.story',
        })
      );
    }
  }

  if (!outcome.ok) {
    const errCode = outcome.errorCode || 'STORIES_UNAVAILABLE';
    const httpStatus = mapErrorCodeToHttpStatus(errCode);
    if (outcome.attempts.length === 0) {
      scheduleAsync(
        ctx,
        logExtractionEvent(env, {
          platform: 'instagram',
          status: 'error',
          errorCode: errCode,
          durationMs: Date.now() - startedAt,
          ipHash,
          engineStage: outcome.provider || 'no_provider',
          httpStatus: outcome.httpStatus ?? httpStatus,
          contentKind: 'story',
          engineFn: 'instagram.story',
        })
      );
    }
    return createErrorResponse(
      errCode,
      outcome.message || getStoryErrorDefaultMessage(errCode),
      httpStatus
    );
  }

  // 4. Compteurs agrégés `story_list_opened` et `selection_started`
  scheduleAsync(
    ctx,
    incrementDailyMetrics(env, 'instagram', [
      'story_list_opened',
      'selection_started',
    ])
  );

  // 5. Proxy de toutes les miniatures et médias via `/api/download`
  const safeUser = username.replace(/[^a-z0-9._-]/g, '') || 'instagram';
  const proxiedItems = outcome.items.map((item, idx) => {
    const ext = item.kind === 'video' ? 'mp4' : 'jpg';
    const fileId = (item.id || String(idx + 1)).replace(/[^a-zA-Z0-9_-]/g, '');
    const isSelected = requestedStoryId
      ? item.id === requestedStoryId ||
        item.id.startsWith(`${requestedStoryId}_`)
      : undefined;
    return {
      id: item.id,
      index: idx + 1,
      kind: item.kind,
      ext,
      quality: item.kind === 'video' ? '1080p' : 'HD',
      ...(item.width ? { width: item.width } : {}),
      ...(item.height ? { height: item.height } : {}),
      taken_at: item.taken_at,
      expires_at: item.expires_at,
      ...(typeof isSelected === 'boolean' ? { selected: isSelected } : {}),
      thumbnail: wrapStoryDownloadUrl(
        item.thumbnail,
        `instagram_${safeUser}_story_${fileId}_thumb.jpg`,
        true
      ),
      url: wrapStoryDownloadUrl(
        item.url,
        `instagram_${safeUser}_story_${idx + 1}_${fileId}.${ext}`,
        false
      ),
    };
  });

  const proxiedAuthor = outcome.author
    ? {
        ...outcome.author,
        avatar:
          outcome.author.avatar &&
          (outcome.author.avatar.startsWith('http://') ||
            outcome.author.avatar.startsWith('https://'))
            ? wrapStoryDownloadUrl(
                outcome.author.avatar,
                `instagram_${safeUser}_avatar.jpg`,
                true
              )
            : outcome.author.avatar,
      }
    : { username: safeUser };

  return new Response(
    JSON.stringify({
      ok: true,
      platform: 'instagram',
      username: safeUser,
      author: proxiedAuthor,
      cached: outcome.cached,
      items: proxiedItems,
    }),
    {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }
  );
}
