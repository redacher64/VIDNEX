/**
 * Architecture unifiée des fournisseurs de Stories Instagram pour VIDNEX.
 *
 * Interface unique :
 *   - `getStory(url)`       -> renvoie la story demandée dans `items[]`
 *   - `listStories(username)` -> renvoie toutes les stories actives d'un compte public dans `items[]`
 *
 * Chaque élément respecte le format :
 *   `{ id, kind: 'photo' | 'video', url, thumbnail, taken_at, expires_at }`
 *
 * Ordre d'essai configuré en admin (`stories_provider_order`) :
 *   (a) `session` : session Instagram (`IG_SESSION_ID` / `IG_COOKIES`)
 *   (b) `relay`   : relais dédié (`RELAY_URL`, jeton optionnel `RELAY_TOKEN`)
 *   (c) `paid`    : service payant à l'usage (`STORIES_PAID_API_URL` + `STORIES_PAID_API_TOKEN`)
 *   (d) `mock`    : strictement réservé au développement local et aux tests (jamais actif en production)
 *
 * Cache métadonnées uniquement (5 minutes, jamais de fichiers média).
 * Comptes publics uniquement : aucune tentative de contournement.
 */

import { type AdminEnv, getDb } from './db.ts';
import { BROWSER_USER_AGENT } from './http.ts';
import { cleanEscapedUrl, parseInstagramCookies, type ParsedInstagramAuth } from './instagram.ts';
import { isAllowedMediaUrl } from './allowlist.ts';
import {
  STORIES_UNAVAILABLE_MESSAGE,
  type ErrorCode,
} from './normalize.ts';
import {
  CONFIGURABLE_STORY_PROVIDERS,
  type StoryProviderId,
  type SystemSettings,
} from './settings.ts';
import {
  getD1HourlyCount,
  incrementD1HourlyCounter,
} from './ratelimit.ts';

export type StoryProviderName = StoryProviderId;

export interface StoryMediaItem {
  id: string;
  kind: 'photo' | 'video';
  url: string;
  thumbnail: string;
  taken_at: string;
  expires_at: string;
  width?: number;
  height?: number;
}

export interface StoryAuthorInfo {
  username: string;
  full_name?: string;
  avatar?: string;
  verified?: boolean;
}

export type StoryErrorCode = Extract<
  ErrorCode,
  | 'STORIES_UNAVAILABLE'
  | 'STORY_ACCOUNT_PRIVATE'
  | 'STORY_ACCOUNT_NOT_FOUND'
  | 'STORY_NO_ACTIVE'
  | 'STORY_RATE_LIMITED'
  | 'BLOCKED_BY_PLATFORM'
  | 'TIMEOUT'
>;

export interface StoryProviderResult {
  ok: boolean;
  provider: StoryProviderName;
  items: StoryMediaItem[];
  author?: StoryAuthorInfo;
  errorCode?: StoryErrorCode;
  httpStatus?: number;
  message?: string;
}

export interface StoryProviderContext {
  request?: Request;
  customFetch?: typeof fetch;
  nowMs?: number;
}

export interface StoryProvider {
  readonly name: StoryProviderName;
  isAvailable(env: AdminEnv, ctx?: StoryProviderContext): boolean;
  getStory(
    url: string,
    env: AdminEnv,
    ctx?: StoryProviderContext
  ): Promise<StoryProviderResult>;
  listStories(
    username: string,
    env: AdminEnv,
    ctx?: StoryProviderContext
  ): Promise<StoryProviderResult>;
}

export interface StoryAttemptDiagnostic {
  provider: StoryProviderName;
  ok: boolean;
  errorCode?: StoryErrorCode;
  httpStatus?: number;
  durationMs: number;
}

export interface StoryResolutionOutcome {
  ok: boolean;
  provider?: StoryProviderName;
  items: StoryMediaItem[];
  author?: StoryAuthorInfo;
  username?: string;
  storyId?: string;
  cached: boolean;
  errorCode?: StoryErrorCode;
  httpStatus?: number;
  message?: string;
  attempts: StoryAttemptDiagnostic[];
}

export interface StoryProviderEventRecord {
  ts: number;
  provider: StoryProviderName;
  action: 'getStory' | 'listStories';
  ok: boolean;
  errorCode: string | null;
  httpStatus: number | null;
}

export interface StoriesAdminStatusSnapshot {
  enabled: boolean;
  activeProvider: StoryProviderName | null;
  providerOrder: StoryProviderName[];
  perIpHourlyLimit: number;
  globalHourlyCap: number;
  callsLastHour: number;
  listCallsLastHour: number;
  providers: Array<{
    name: StoryProviderName;
    configured: boolean;
    callsLastHour: number;
    lastSuccessTs: number | null;
    lastFailureTs: number | null;
    lastErrorCode: string | null;
    lastHttpStatus: number | null;
  }>;
  recentSuccesses: StoryProviderEventRecord[];
  recentFailures: StoryProviderEventRecord[];
}

export const STORY_METADATA_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 heures
const MAX_CACHE_ENTRIES = 250;
const PROVIDER_FETCH_TIMEOUT_MS = 12_000;
const IG_WEB_APP_ID = '936619743392459';

const RESERVED_IG_STORY_SEGMENTS = new Set([
  'highlights',
  'explore',
  'accounts',
  'direct',
  'p',
  'reel',
  'reels',
  'tv',
  'stories',
  'login',
  'api',
]);

const USERNAME_REGEX = /^[a-z0-9._]{1,30}$/;

export function normalizeInstagramStoryUsername(raw: string): string | null {
  const cleaned = (raw || '').trim().replace(/^@+/, '').toLowerCase();
  if (!cleaned || !USERNAME_REGEX.test(cleaned)) return null;
  if (RESERVED_IG_STORY_SEGMENTS.has(cleaned)) return null;
  return cleaned;
}

export function parseStoryUrl(rawUrl: string): {
  username: string | null;
  storyId: string | null;
} {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return { username: null, storyId: null };

  // Forme courte interne `{username}/{storyId}`
  if (!/^https?:\/\//i.test(trimmed) && !trimmed.includes('instagram.com')) {
    const parts = trimmed.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const username = normalizeInstagramStoryUsername(parts[0]);
      const storyId = /^\d{5,30}$/.test(parts[1]) ? parts[1] : null;
      return { username, storyId };
    }
    if (parts.length === 1) {
      if (/^\d{5,30}$/.test(parts[0])) {
        return { username: null, storyId: parts[0] };
      }
      return {
        username: normalizeInstagramStoryUsername(parts[0]),
        storyId: null,
      };
    }
  }

  try {
    const parsed = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    );
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (
      segments[0]?.toLowerCase() === 'stories' &&
      segments[1] &&
      segments[1].toLowerCase() !== 'highlights'
    ) {
      const username = normalizeInstagramStoryUsername(segments[1]);
      const rawId = segments[2] || parsed.searchParams.get('story_media_id') || '';
      const idMatch = rawId.match(/^(\d{5,30})/);
      return {
        username,
        storyId: idMatch ? idMatch[1] : null,
      };
    }
  } catch {
    // ignore malformed URL
  }
  return { username: null, storyId: null };
}

/**
 * Le fournisseur `mock` est STRICTEMENT interdit en production.
 * Il n'est autorisé qu'en développement local ou dans la suite de tests automatisés
 * lorsque `STORIES_ALLOW_MOCK === 'true'` ET hors environnement Cloudflare production.
 */
export function isMockProviderAllowed(
  env?: AdminEnv,
  request?: Request
): boolean {
  if (!env || env.STORIES_ALLOW_MOCK !== 'true') {
    return false;
  }
  if (env.CF_PAGES === '1' || env.NODE_ENV === 'production') {
    return false;
  }
  if (request) {
    try {
      const hostname = new URL(request.url).hostname.toLowerCase();
      if (
        hostname === 'vidnex.space' ||
        hostname.endsWith('.vidnex.space') ||
        hostname.endsWith('.pages.dev') ||
        hostname.endsWith('.workers.dev')
      ) {
        return false;
      }
      const isLocalHost =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname === '[::1]';
      if (!isLocalHost && env.VIDNEX_LOCAL_DEV !== 'true') {
        return false;
      }
    } catch {
      return false;
    }
  } else if (env.VIDNEX_LOCAL_DEV !== 'true') {
    return false;
  }
  return true;
}

function isValidExternalEndpointUrl(rawUrl?: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    // Empêche tout SSRF vers métadonnées cloud
    if (
      host === '169.254.169.254' ||
      host === 'metadata.google.internal' ||
      host.startsWith('169.254.')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function toIsoTimestamp(value: unknown, fallbackMs: number): string {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const ms = value > 1e12 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) {
      const ms = num > 1e12 ? num : num * 1000;
      return new Date(ms).toISOString();
    }
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return new Date(fallbackMs).toISOString();
}

function computeExpiresAt(takenAtIso: string, rawExpiresAt?: unknown): string {
  if (rawExpiresAt !== undefined && rawExpiresAt !== null && rawExpiresAt !== '') {
    const parsed = Date.parse(toIsoTimestamp(rawExpiresAt, 0));
    if (!Number.isNaN(parsed) && parsed > 0) {
      return new Date(parsed).toISOString();
    }
  }
  const takenMs = Date.parse(takenAtIso);
  const baseMs = Number.isNaN(takenMs) ? Date.now() : takenMs;
  return new Date(baseMs + STORY_LIFETIME_MS).toISOString();
}

function sanitizeMediaItem(
  raw: Record<string, unknown>,
  index: number,
  nowMs: number
): StoryMediaItem | null {
  const rawUrl = cleanEscapedUrl(
    String(raw.url || raw.media_url || raw.video_url || raw.image_url || '')
  );
  if (!rawUrl || !isAllowedMediaUrl(rawUrl)) {
    return null;
  }
  const rawThumb = cleanEscapedUrl(
    String(raw.thumbnail || raw.thumbnail_url || raw.poster || rawUrl)
  );
  const safeThumb = rawThumb && isAllowedMediaUrl(rawThumb) ? rawThumb : rawUrl;

  const rawKind = String(raw.kind || raw.type || '').toLowerCase();
  const isVideo =
    rawKind === 'video' ||
    raw.media_type === 2 ||
    raw.is_video === true ||
    /\.mp4(?:$|\?)/i.test(rawUrl);

  const rawId = String(raw.id || raw.pk || `${index + 1}`).split('_')[0];
  const takenAt = toIsoTimestamp(raw.taken_at ?? raw.date ?? raw.timestamp, nowMs);
  const expiresAt = computeExpiresAt(takenAt, raw.expires_at ?? raw.expiring_at);

  const width =
    typeof raw.width === 'number' && Number.isFinite(raw.width)
      ? raw.width
      : undefined;
  const height =
    typeof raw.height === 'number' && Number.isFinite(raw.height)
      ? raw.height
      : undefined;

  return {
    id: rawId || String(index + 1),
    kind: isVideo ? 'video' : 'photo',
    url: rawUrl,
    thumbnail: safeThumb,
    taken_at: takenAt,
    expires_at: expiresAt,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  customFetch?: typeof fetch,
  timeoutMs: number = PROVIDER_FETCH_TIMEOUT_MS
): Promise<Response> {
  const fetchImpl = customFetch || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

interface CachedIgUserProfile {
  userId: string;
  isPrivate: boolean;
  author: StoryAuthorInfo;
  expiresAt: number;
}

const igUserProfileCache = new Map<string, CachedIgUserProfile>();

function getCachedIgUserProfile(
  username: string,
  nowMs: number
): CachedIgUserProfile | null {
  const key = username.toLowerCase();
  const entry = igUserProfileCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= nowMs) {
    igUserProfileCache.delete(key);
    return null;
  }
  return entry;
}

function setCachedIgUserProfile(
  username: string,
  entry: Omit<CachedIgUserProfile, 'expiresAt'>,
  nowMs: number
): void {
  const key = username.toLowerCase();
  if (!key) return;
  if (igUserProfileCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = igUserProfileCache.keys().next().value;
    if (oldestKey) igUserProfileCache.delete(oldestKey);
  }
  igUserProfileCache.set(key, {
    ...entry,
    expiresAt: nowMs + STORY_METADATA_CACHE_TTL_MS,
  });
}

function buildIgSessionHeaders(
  cookieHeader: string,
  csrfToken: string,
  referer = 'https://www.instagram.com/'
): Record<string, string> {
  return {
    'User-Agent': BROWSER_USER_AGENT,
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
    'X-IG-App-ID': IG_WEB_APP_ID,
    'X-ASBD-ID': '129477',
    'X-IG-WWW-Claim': '0',
    'X-Requested-With': 'XMLHttpRequest',
    'X-CSRFToken': csrfToken || 'missing',
    Referer: referer,
    Cookie: cookieHeader,
  };
}

function isIgAuthOrRateLimitPayload(json: Record<string, unknown> | null): boolean {
  if (!json) return false;
  const msg = String(json.message || '').toLowerCase();
  return (
    json.require_login === true ||
    json.status === 'fail' ||
    msg === 'login_required' ||
    msg === 'checkpoint_required' ||
    msg.includes('please wait a few minutes') ||
    msg.includes('rate limit') ||
    json.error_type === 'rate_limit_error'
  );
}

function isIgPrivatePayload(json: Record<string, unknown> | null): boolean {
  if (!json) return false;
  const msg = String(json.message || '').toLowerCase();
  return (
    msg.includes('not authorized to view user') ||
    msg.includes('private account') ||
    msg.includes('user is private')
  );
}

function parseInstagramApiStoryItem(
  node: Record<string, unknown>,
  nowMs: number
): StoryMediaItem | null {
  const videoVersions = Array.isArray(node.video_versions)
    ? (node.video_versions as Array<Record<string, unknown>>)
    : [];
  const imageCandidates = Array.isArray(
    (node.image_versions2 as Record<string, unknown> | undefined)?.candidates
  )
    ? ((node.image_versions2 as Record<string, unknown>).candidates as Array<
        Record<string, unknown>
      >)
    : [];

  const sortedVideos = [...videoVersions]
    .filter((v) => typeof v?.url === 'string' && v.url)
    .sort(
      (a, b) =>
        Number(b.width || 0) * Number(b.height || 0) -
        Number(a.width || 0) * Number(a.height || 0)
    );
  const sortedImages = [...imageCandidates]
    .filter((c) => typeof c?.url === 'string' && c.url)
    .sort(
      (a, b) =>
        Number(b.width || 0) * Number(b.height || 0) -
        Number(a.width || 0) * Number(a.height || 0)
    );

  const bestVideo = sortedVideos[0];
  const bestImage = sortedImages[0];
  const fallbackVideoUrl =
    typeof node.video_url === 'string' && node.video_url ? node.video_url : '';
  const displayResources = Array.isArray(node.display_resources)
    ? (node.display_resources as Array<Record<string, unknown>>)
    : [];
  const fallbackImageUrl =
    (typeof node.display_url === 'string' && node.display_url) ||
    (displayResources.length > 0 &&
    typeof displayResources[displayResources.length - 1]?.src === 'string'
      ? String(displayResources[displayResources.length - 1].src)
      : '') ||
    (typeof node.thumbnail_src === 'string' && node.thumbnail_src
      ? node.thumbnail_src
      : '');

  const rawVideoUrl = String(bestVideo?.url || fallbackVideoUrl || '');
  const rawImageUrl = String(bestImage?.url || fallbackImageUrl || '');
  const isVideo = Boolean(rawVideoUrl);

  const primaryUrl = cleanEscapedUrl(isVideo ? rawVideoUrl : rawImageUrl);
  if (!primaryUrl || !isAllowedMediaUrl(primaryUrl)) {
    return null;
  }

  const thumbUrl = cleanEscapedUrl(rawImageUrl || primaryUrl);
  const safeThumb = thumbUrl && isAllowedMediaUrl(thumbUrl) ? thumbUrl : primaryUrl;
  const rawId = String(node.pk || node.id || '').split('_')[0];
  const takenAt = toIsoTimestamp(
    node.taken_at ?? node.taken_at_timestamp ?? node.device_timestamp,
    nowMs
  );
  const expiresAt = computeExpiresAt(takenAt, node.expiring_at);

  const width = Number(
    (isVideo ? bestVideo?.width : bestImage?.width) ||
      node.original_width ||
      (node.dimensions as Record<string, unknown> | undefined)?.width ||
      0
  );
  const height = Number(
    (isVideo ? bestVideo?.height : bestImage?.height) ||
      node.original_height ||
      (node.dimensions as Record<string, unknown> | undefined)?.height ||
      0
  );

  return {
    id: rawId || String(nowMs),
    kind: isVideo ? 'video' : 'photo',
    url: primaryUrl,
    thumbnail: safeThumb,
    taken_at: takenAt,
    expires_at: expiresAt,
    ...(width > 0 ? { width } : {}),
    ...(height > 0 ? { height } : {}),
  };
}

async function resolveIgUserProfileByUsername(
  normalized: string,
  auth: ParsedInstagramAuth,
  nowMs: number,
  customFetch?: typeof fetch
): Promise<
  | { ok: true; userId: string; author: StoryAuthorInfo }
  | { ok: false; errorCode: StoryErrorCode; httpStatus: number }
> {
  // Cas d'un identifiant numérique passé à la place du nom d'utilisateur (`/stories/12345678/...`)
  if (/^\d{4,30}$/.test(normalized)) {
    return {
      ok: true,
      userId: normalized,
      author: { username: normalized },
    };
  }

  const cached = getCachedIgUserProfile(normalized, nowMs);
  if (cached) {
    if (cached.isPrivate) {
      return {
        ok: false,
        errorCode: 'STORY_ACCOUNT_PRIVATE',
        httpStatus: 403,
      };
    }
    return {
      ok: true,
      userId: cached.userId,
      author: cached.author,
    };
  }

  const notFoundSources = new Set<string>();
  let explicitUserNullOk = false;
  let blockedByPlatform = false;
  let timedOut = false;
  let lastHttpStatus = 502;

  const inspectWebProfileResponse = async (
    res: Response,
    sourceTag: string
  ): Promise<
    | { ok: true; userId: string; author: StoryAuthorInfo }
    | { ok: false; errorCode: StoryErrorCode; httpStatus: number }
    | null
  > => {
    lastHttpStatus = res.status;

    if (res.status === 404) {
      notFoundSources.add(sourceTag);
      return null;
    }

    if (res.status >= 300 && res.status < 400) {
      blockedByPlatform = true;
      return null;
    }

    if (
      res.status === 401 ||
      res.status === 403 ||
      res.status === 429 ||
      res.status >= 500
    ) {
      blockedByPlatform = true;
      return null;
    }

    const rawText = await res.text().catch(() => '');
    if (!rawText.trim()) {
      blockedByPlatform = true;
      return null;
    }

    let profileJson: {
      status?: string;
      message?: string;
      require_login?: boolean;
      error_type?: string;
      data?: {
        user?: {
          id?: string;
          pk?: string;
          username?: string;
          full_name?: string;
          profile_pic_url?: string;
          profile_pic_url_hd?: string;
          is_private?: boolean;
          is_verified?: boolean;
        } | null;
      };
    } | null = null;

    try {
      profileJson = JSON.parse(rawText);
    } catch {
      blockedByPlatform = true;
      return null;
    }

    if (
      !profileJson ||
      isIgAuthOrRateLimitPayload(profileJson as unknown as Record<string, unknown>)
    ) {
      blockedByPlatform = true;
      return null;
    }

    if (profileJson.data && profileJson.data.user === null) {
      notFoundSources.add(sourceTag);
      if (profileJson.status === 'ok') {
        explicitUserNullOk = true;
      }
      return null;
    }

    const user = profileJson.data?.user;
    if (user && typeof user === 'object') {
      const userId = String(user.id || user.pk || '').trim();
      const author: StoryAuthorInfo = {
        username: String(user.username || normalized).replace(/^@/, ''),
        full_name: user.full_name || undefined,
        avatar: user.profile_pic_url_hd || user.profile_pic_url || undefined,
        verified: Boolean(user.is_verified),
      };
      if (user.is_private === true) {
        if (userId) {
          setCachedIgUserProfile(
            normalized,
            { userId, isPrivate: true, author },
            nowMs
          );
        }
        return {
          ok: false,
          errorCode: 'STORY_ACCOUNT_PRIVATE',
          httpStatus: 403,
        };
      }
      if (userId) {
        setCachedIgUserProfile(
          normalized,
          { userId, isPrivate: false, author },
          nowMs
        );
        return { ok: true, userId, author };
      }
    }

    return null;
  };

  const webProfileUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(normalized)}`;
  const sessionHeaders = buildIgSessionHeaders(
    auth.cookieHeader,
    auth.csrfToken,
    `https://www.instagram.com/${encodeURIComponent(normalized)}/`
  );

  // 1. web_profile_info avec session
  try {
    const resAuth = await fetchWithTimeout(
      webProfileUrl,
      { method: 'GET', headers: sessionHeaders, redirect: 'manual' },
      customFetch
    );
    const parsedAuth = await inspectWebProfileResponse(resAuth, 'web_profile_auth');
    if (parsedAuth) return parsedAuth;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      timedOut = true;
    } else {
      blockedByPlatform = true;
    }
  }

  // 2. web_profile_info sans cookies (comme extractInstagramProfile Niveau 1)
  if (!explicitUserNullOk) {
    try {
      const resPub = await fetchWithTimeout(
        webProfileUrl,
        {
          method: 'GET',
          headers: {
            'User-Agent': BROWSER_USER_AGENT,
            Accept: 'application/json, text/plain, */*',
            'X-IG-App-ID': IG_WEB_APP_ID,
            'X-ASBD-ID': '129477',
            'X-Requested-With': 'XMLHttpRequest',
            Referer: `https://www.instagram.com/${encodeURIComponent(normalized)}/`,
          },
          redirect: 'manual',
        },
        customFetch
      );
      const parsedPub = await inspectWebProfileResponse(resPub, 'web_profile_public');
      if (parsedPub) return parsedPub;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        timedOut = true;
      }
    }
  }

  // 3. Recherche authentifiée exacte (`/api/v1/users/search/`) si web_profile_info a été bloqué/filtré
  if (notFoundSources.size < 2 && !explicitUserNullOk) {
    try {
      const searchRes = await fetchWithTimeout(
        `https://www.instagram.com/api/v1/users/search/?q=${encodeURIComponent(normalized)}&count=5`,
        { method: 'GET', headers: sessionHeaders, redirect: 'manual' },
        customFetch
      );
      if (searchRes.ok) {
        const sJson = (await searchRes.json().catch(() => null)) as {
          status?: string;
          users?: Array<{
            pk?: string | number;
            id?: string | number;
            username?: string;
            full_name?: string;
            profile_pic_url?: string;
            is_private?: boolean;
            is_verified?: boolean;
          }>;
        } | null;
        if (sJson && Array.isArray(sJson.users)) {
          const exact = sJson.users.find(
            (u) => String(u?.username || '').toLowerCase() === normalized
          );
          if (exact) {
            const userId = String(exact.pk || exact.id || '').trim();
            const author: StoryAuthorInfo = {
              username: String(exact.username || normalized).replace(/^@/, ''),
              full_name: exact.full_name || undefined,
              avatar: exact.profile_pic_url || undefined,
              verified: Boolean(exact.is_verified),
            };
            if (exact.is_private === true) {
              if (userId) {
                setCachedIgUserProfile(
                  normalized,
                  { userId, isPrivate: true, author },
                  nowMs
                );
              }
              return {
                ok: false,
                errorCode: 'STORY_ACCOUNT_PRIVATE',
                httpStatus: 403,
              };
            }
            if (userId) {
              setCachedIgUserProfile(
                normalized,
                { userId, isPrivate: false, author },
                nowMs
              );
              return { ok: true, userId, author };
            }
          }
        }
      }
    } catch {
      // Continuer vers le repli embed
    }
  }

  // 4. Repli page publique `/embed/` (éprouvé sur Cloudflare Workers dans instagram.ts)
  if (notFoundSources.size < 2 && !explicitUserNullOk) {
    try {
      const embedRes = await fetchWithTimeout(
        `https://www.instagram.com/${encodeURIComponent(normalized)}/embed/`,
        {
          method: 'GET',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            Referer: 'https://www.instagram.com/',
          },
          redirect: 'manual',
        },
        customFetch
      );
      if (embedRes.status === 404) {
        notFoundSources.add('embed_page');
      } else if (embedRes.status === 200) {
        const embedHtml = await embedRes.text().catch(() => '');
        const ctxMatch = embedHtml.match(/"contextJSON"\s*:\s*"((?:\\.|[^"\\])*)"/);
        if (ctxMatch?.[1]) {
          try {
            const unescaped = JSON.parse(`"${ctxMatch[1]}"`);
            const ctxPayload = JSON.parse(unescaped) as {
              context?: {
                owner_id?: string | number;
                profile_id?: string | number;
                id?: string | number;
                username?: string;
                full_name?: string;
                profile_pic_url?: string;
                is_private?: boolean;
                is_verified?: boolean;
              };
            };
            const ctx = ctxPayload?.context;
            const ownerId = String(
              ctx?.owner_id || ctx?.profile_id || ctx?.id || ''
            ).trim();
            if (ctx?.is_private === true) {
              return {
                ok: false,
                errorCode: 'STORY_ACCOUNT_PRIVATE',
                httpStatus: 403,
              };
            }
            if (ownerId && /^\d+$/.test(ownerId)) {
              const author: StoryAuthorInfo = {
                username: String(ctx?.username || normalized).replace(/^@/, ''),
                full_name: ctx?.full_name || undefined,
                avatar: ctx?.profile_pic_url || undefined,
                verified: Boolean(ctx?.is_verified),
              };
              setCachedIgUserProfile(
                normalized,
                { userId: ownerId, isPrivate: false, author },
                nowMs
              );
              return { ok: true, userId: ownerId, author };
            }
          } catch {
            // Ignorer
          }
        } else if (
          embedHtml.includes('EmbedIsBroken') ||
          embedHtml.includes('"contextJSON":null')
        ) {
          notFoundSources.add('embed_page');
        }
      }
    } catch {
      // Ignorer
    }
  }

  if (notFoundSources.size >= 2 || (explicitUserNullOk && !blockedByPlatform)) {
    return {
      ok: false,
      errorCode: 'STORY_ACCOUNT_NOT_FOUND',
      httpStatus: 404,
    };
  }
  if (timedOut && !blockedByPlatform) {
    return {
      ok: false,
      errorCode: 'TIMEOUT',
      httpStatus: 504,
    };
  }
  return {
    ok: false,
    errorCode: 'BLOCKED_BY_PLATFORM',
    httpStatus: lastHttpStatus || 502,
  };
}

async function fetchIgSingleStoryByMediaId(
  storyId: string,
  fallbackUsername: string | null,
  auth: ParsedInstagramAuth,
  nowMs: number,
  customFetch?: typeof fetch
): Promise<StoryProviderResult> {
  const referer = fallbackUsername
    ? `https://www.instagram.com/stories/${encodeURIComponent(fallbackUsername)}/${encodeURIComponent(storyId)}/`
    : 'https://www.instagram.com/';
  const headers = buildIgSessionHeaders(auth.cookieHeader, auth.csrfToken, referer);

  const endpoints = [
    `https://www.instagram.com/api/v1/media/${encodeURIComponent(storyId)}/info/`,
    `https://i.instagram.com/api/v1/media/${encodeURIComponent(storyId)}/info/`,
  ];

  let lastError: StoryProviderResult = {
    ok: false,
    provider: 'session',
    items: [],
    errorCode: 'BLOCKED_BY_PLATFORM',
    httpStatus: 502,
  };

  for (const endpoint of endpoints) {
    try {
      const infoRes = await fetchWithTimeout(
        endpoint,
        { method: 'GET', headers, redirect: 'manual' },
        customFetch
      );

      if (infoRes.status === 404) {
        return {
          ok: false,
          provider: 'session',
          items: [],
          errorCode: 'STORY_NO_ACTIVE',
          httpStatus: 404,
        };
      }

      if (infoRes.status >= 300 && infoRes.status < 400) {
        lastError = {
          ok: false,
          provider: 'session',
          items: [],
          errorCode: 'BLOCKED_BY_PLATFORM',
          httpStatus: infoRes.status,
        };
        continue;
      }

      const rawText = await infoRes.text().catch(() => '');
      let json: {
        status?: string;
        message?: string;
        require_login?: boolean;
        items?: Array<Record<string, unknown>>;
      } | null = null;
      try {
        json = rawText ? JSON.parse(rawText) : null;
      } catch {
        json = null;
      }

      if (infoRes.status === 403) {
        if (isIgPrivatePayload(json as unknown as Record<string, unknown> | null)) {
          return {
            ok: false,
            provider: 'session',
            items: [],
            errorCode: 'STORY_ACCOUNT_PRIVATE',
            httpStatus: 403,
          };
        }
        lastError = {
          ok: false,
          provider: 'session',
          items: [],
          errorCode: 'BLOCKED_BY_PLATFORM',
          httpStatus: 403,
        };
        continue;
      }

      if (!infoRes.ok || !json) {
        const msg = String(json?.message || '').toLowerCase();
        if (msg.includes('media not found') || msg.includes('unavailable')) {
          return {
            ok: false,
            provider: 'session',
            items: [],
            errorCode: 'STORY_NO_ACTIVE',
            httpStatus: 404,
          };
        }
        lastError = {
          ok: false,
          provider: 'session',
          items: [],
          errorCode: 'BLOCKED_BY_PLATFORM',
          httpStatus: infoRes.status || 502,
        };
        continue;
      }

      if (isIgPrivatePayload(json as unknown as Record<string, unknown>)) {
        return {
          ok: false,
          provider: 'session',
          items: [],
          errorCode: 'STORY_ACCOUNT_PRIVATE',
          httpStatus: 403,
        };
      }

      if (isIgAuthOrRateLimitPayload(json as unknown as Record<string, unknown>)) {
        const msg = String(json.message || '').toLowerCase();
        if (msg.includes('media not found') || msg.includes('unavailable')) {
          return {
            ok: false,
            provider: 'session',
            items: [],
            errorCode: 'STORY_NO_ACTIVE',
            httpStatus: 404,
          };
        }
        lastError = {
          ok: false,
          provider: 'session',
          items: [],
          errorCode: 'BLOCKED_BY_PLATFORM',
          httpStatus: infoRes.status,
        };
        continue;
      }

      const firstNode = json.items?.[0];
      if (!firstNode) {
        return {
          ok: false,
          provider: 'session',
          items: [],
          errorCode: 'STORY_NO_ACTIVE',
          httpStatus: 404,
        };
      }

      const nodeUser = (firstNode.user || firstNode.owner) as
        | Record<string, unknown>
        | undefined;
      if (nodeUser?.is_private === true) {
        return {
          ok: false,
          provider: 'session',
          items: [],
          errorCode: 'STORY_ACCOUNT_PRIVATE',
          httpStatus: 403,
        };
      }

      const parsed = parseInstagramApiStoryItem(firstNode, nowMs);
      if (!parsed) {
        return {
          ok: false,
          provider: 'session',
          items: [],
          errorCode: 'STORY_NO_ACTIVE',
          httpStatus: 404,
        };
      }

      const resolvedUsername = String(
        nodeUser?.username || fallbackUsername || 'instagram'
      ).replace(/^@/, '');
      const author: StoryAuthorInfo = {
        username: resolvedUsername,
        full_name: nodeUser?.full_name ? String(nodeUser.full_name) : undefined,
        avatar: nodeUser?.profile_pic_url
          ? String(nodeUser.profile_pic_url)
          : undefined,
        verified: Boolean(nodeUser?.is_verified),
      };

      // Mémoriser username -> userId en cache 5 min (métadonnées uniquement)
      // pour accélérer et fiabiliser « Voir toutes les stories de @username »
      const resolvedUserId = String(
        nodeUser?.pk || nodeUser?.id || nodeUser?.pk_id || ''
      ).trim();
      if (resolvedUserId && /^\d+$/.test(resolvedUserId)) {
        const normFromNode = normalizeInstagramStoryUsername(resolvedUsername);
        if (normFromNode) {
          setCachedIgUserProfile(
            normFromNode,
            { userId: resolvedUserId, isPrivate: false, author },
            nowMs
          );
        }
        if (fallbackUsername && fallbackUsername !== normFromNode) {
          setCachedIgUserProfile(
            fallbackUsername,
            { userId: resolvedUserId, isPrivate: false, author },
            nowMs
          );
        }
      }

      return {
        ok: true,
        provider: 'session',
        items: [parsed],
        author,
        httpStatus: 200,
      };
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      lastError = {
        ok: false,
        provider: 'session',
        items: [],
        errorCode: isTimeout ? 'TIMEOUT' : 'BLOCKED_BY_PLATFORM',
        httpStatus: isTimeout ? 504 : 502,
      };
    }
  }

  return lastError;
}

async function fetchIgUserStoriesReel(
  userId: string,
  authorHint: StoryAuthorInfo,
  auth: ParsedInstagramAuth,
  nowMs: number,
  customFetch?: typeof fetch
): Promise<StoryProviderResult> {
  const referer = authorHint.username
    ? `https://www.instagram.com/stories/${encodeURIComponent(authorHint.username)}/`
    : 'https://www.instagram.com/';
  const headers = buildIgSessionHeaders(auth.cookieHeader, auth.csrfToken, referer);

  const endpoints = [
    `https://www.instagram.com/api/v1/feed/reels_media/?reel_ids=${encodeURIComponent(userId)}`,
    `https://i.instagram.com/api/v1/feed/reels_media/?reel_ids=${encodeURIComponent(userId)}`,
  ];

  let lastError: StoryProviderResult = {
    ok: false,
    provider: 'session',
    items: [],
    errorCode: 'BLOCKED_BY_PLATFORM',
    httpStatus: 502,
  };

  for (const endpoint of endpoints) {
    try {
      const reelsRes = await fetchWithTimeout(
        endpoint,
        { method: 'GET', headers, redirect: 'manual' },
        customFetch
      );

      if (!reelsRes.ok) {
        lastError = {
          ok: false,
          provider: 'session',
          items: [],
          errorCode: 'BLOCKED_BY_PLATFORM',
          httpStatus: reelsRes.status,
        };
        continue;
      }

      const rawText = await reelsRes.text().catch(() => '');
      let reelsJson: {
        status?: string;
        message?: string;
        require_login?: boolean;
        reels_media?: Array<{
          user?: Record<string, unknown>;
          items?: Array<Record<string, unknown>>;
        }>;
        reels?: Record<
          string,
          {
            user?: Record<string, unknown>;
            items?: Array<Record<string, unknown>>;
          }
        >;
      } | null = null;
      try {
        reelsJson = rawText ? JSON.parse(rawText) : null;
      } catch {
        reelsJson = null;
      }

      if (
        !reelsJson ||
        isIgAuthOrRateLimitPayload(reelsJson as unknown as Record<string, unknown>)
      ) {
        lastError = {
          ok: false,
          provider: 'session',
          items: [],
          errorCode: 'BLOCKED_BY_PLATFORM',
          httpStatus: reelsRes.status || 502,
        };
        continue;
      }

      const reelObj = reelsJson.reels?.[userId] || reelsJson.reels_media?.[0];
      const reelUser = reelObj?.user;
      if (reelUser?.is_private === true) {
        return {
          ok: false,
          provider: 'session',
          items: [],
          errorCode: 'STORY_ACCOUNT_PRIVATE',
          httpStatus: 403,
        };
      }

      const mergedAuthor: StoryAuthorInfo = {
        username: String(reelUser?.username || authorHint.username).replace(/^@/, ''),
        full_name:
          (reelUser?.full_name ? String(reelUser.full_name) : undefined) ||
          authorHint.full_name,
        avatar:
          (reelUser?.profile_pic_url
            ? String(reelUser.profile_pic_url)
            : undefined) || authorHint.avatar,
        verified: Boolean(reelUser?.is_verified ?? authorHint.verified),
      };

      const rawItems = reelObj?.items || [];
      const items: StoryMediaItem[] = [];
      for (const rawNode of rawItems) {
        const parsed = parseInstagramApiStoryItem(rawNode, nowMs);
        if (parsed) items.push(parsed);
      }

      if (items.length === 0) {
        return {
          ok: false,
          provider: 'session',
          items: [],
          author: mergedAuthor,
          errorCode: 'STORY_NO_ACTIVE',
          httpStatus: 404,
        };
      }

      return {
        ok: true,
        provider: 'session',
        items,
        author: mergedAuthor,
        httpStatus: 200,
      };
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      lastError = {
        ok: false,
        provider: 'session',
        items: [],
        errorCode: isTimeout ? 'TIMEOUT' : 'BLOCKED_BY_PLATFORM',
        httpStatus: isTimeout ? 504 : 502,
      };
    }
  }

  return lastError;
}

/**
 * (a) Fournisseur `session` : utilise la session Instagram (`IG_SESSION_ID` / `IG_COOKIES`)
 */
export const sessionStoryProvider: StoryProvider = {
  name: 'session',

  isAvailable(env: AdminEnv): boolean {
    return parseInstagramCookies(env).hasSession;
  },

  async listStories(
    username: string,
    env: AdminEnv,
    ctx?: StoryProviderContext
  ): Promise<StoryProviderResult> {
    const auth = parseInstagramCookies(env);
    if (!auth.hasSession) {
      return {
        ok: false,
        provider: 'session',
        items: [],
        errorCode: 'STORIES_UNAVAILABLE',
        httpStatus: 503,
        message: STORIES_UNAVAILABLE_MESSAGE,
      };
    }

    const normalized = normalizeInstagramStoryUsername(username);
    if (!normalized) {
      return {
        ok: false,
        provider: 'session',
        items: [],
        errorCode: 'STORY_ACCOUNT_NOT_FOUND',
        httpStatus: 404,
      };
    }

    const nowMs = ctx?.nowMs ?? Date.now();
    const profileRes = await resolveIgUserProfileByUsername(
      normalized,
      auth,
      nowMs,
      ctx?.customFetch
    );
    if (!profileRes.ok) {
      return {
        ok: false,
        provider: 'session',
        items: [],
        errorCode: profileRes.errorCode,
        httpStatus: profileRes.httpStatus,
      };
    }

    return fetchIgUserStoriesReel(
      profileRes.userId,
      profileRes.author,
      auth,
      nowMs,
      ctx?.customFetch
    );
  },

  async getStory(
    url: string,
    env: AdminEnv,
    ctx?: StoryProviderContext
  ): Promise<StoryProviderResult> {
    const auth = parseInstagramCookies(env);
    if (!auth.hasSession) {
      return {
        ok: false,
        provider: 'session',
        items: [],
        errorCode: 'STORIES_UNAVAILABLE',
        httpStatus: 503,
        message: STORIES_UNAVAILABLE_MESSAGE,
      };
    }

    const { username, storyId } = parseStoryUrl(url);
    const nowMs = ctx?.nowMs ?? Date.now();

    // 1. Si un storyId numérique est présent, interroger directement `/api/v1/media/{storyId}/info/`
    // (même endpoint fiable que les Reels & Publications, 1 seule requête authentifiée,
    // et pré-remplit le cache username -> userId pour « Voir toutes les stories »).
    let mediaInfoRes: StoryProviderResult | null = null;
    if (storyId) {
      mediaInfoRes = await fetchIgSingleStoryByMediaId(
        storyId,
        username,
        auth,
        nowMs,
        ctx?.customFetch
      );
      if (mediaInfoRes.ok || mediaInfoRes.errorCode === 'STORY_ACCOUNT_PRIVATE') {
        return mediaInfoRes;
      }
    }

    // 2. Repli (ou lien `/stories/{username}/` sans storyId) : lister les stories actives du compte
    if (username) {
      const listRes = await this.listStories(username, env, ctx);
      if (listRes.ok) {
        // Préchauffer le cache de liste 5 min (métadonnées uniquement)
        setStoryMetadataCacheEntry(
          getListStoriesCacheKey(username),
          {
            ok: true,
            provider: 'session',
            items: listRes.items,
            author: listRes.author || { username },
            username,
            httpStatus: 200,
          },
          nowMs
        );
        const matched = storyId
          ? listRes.items.find(
              (item) =>
                item.id === storyId || item.id.startsWith(`${storyId}_`)
            )
          : listRes.items[0];
        if (matched) {
          return {
            ok: true,
            provider: 'session',
            items: [matched],
            author: listRes.author,
            httpStatus: 200,
          };
        }
        return {
          ok: false,
          provider: 'session',
          items: [],
          author: listRes.author,
          errorCode: 'STORY_NO_ACTIVE',
          httpStatus: 404,
        };
      }

      if (
        listRes.errorCode === 'STORY_ACCOUNT_PRIVATE' ||
        listRes.errorCode === 'STORY_ACCOUNT_NOT_FOUND' ||
        listRes.errorCode === 'STORY_NO_ACTIVE'
      ) {
        return listRes;
      }

      if (mediaInfoRes && mediaInfoRes.errorCode === 'STORY_NO_ACTIVE') {
        return mediaInfoRes;
      }
      return listRes;
    }

    if (mediaInfoRes) {
      return mediaInfoRes;
    }

    return {
      ok: false,
      provider: 'session',
      items: [],
      errorCode: 'STORY_ACCOUNT_NOT_FOUND',
      httpStatus: 404,
    };
  },
};

function mapExternalProviderPayload(
  provider: StoryProviderName,
  status: number,
  body: unknown,
  fallbackUsername: string | null,
  nowMs: number
): StoryProviderResult {
  const obj = (body && typeof body === 'object' ? body : {}) as Record<
    string,
    unknown
  >;
  const errObj = (obj.error && typeof obj.error === 'object'
    ? obj.error
    : null) as Record<string, unknown> | null;
  const rawCode = String(
    errObj?.code || obj.error_code || obj.code || ''
  ).toUpperCase();

  if (
    rawCode === 'STORY_ACCOUNT_PRIVATE' ||
    rawCode === 'PRIVATE' ||
    rawCode === 'PRIVATE_ACCOUNT' ||
    obj.is_private === true
  ) {
    return {
      ok: false,
      provider,
      items: [],
      errorCode: 'STORY_ACCOUNT_PRIVATE',
      httpStatus: 403,
    };
  }
  if (
    rawCode === 'STORY_ACCOUNT_NOT_FOUND' ||
    rawCode === 'NOT_FOUND' ||
    rawCode === 'USER_NOT_FOUND'
  ) {
    return {
      ok: false,
      provider,
      items: [],
      errorCode: 'STORY_ACCOUNT_NOT_FOUND',
      httpStatus: 404,
    };
  }
  if (
    rawCode === 'STORY_NO_ACTIVE' ||
    rawCode === 'NO_ACTIVE_STORIES' ||
    rawCode === 'NO_STORIES'
  ) {
    return {
      ok: false,
      provider,
      items: [],
      errorCode: 'STORY_NO_ACTIVE',
      httpStatus: 404,
    };
  }

  if (status < 200 || status >= 300) {
    return {
      ok: false,
      provider,
      items: [],
      errorCode: 'BLOCKED_BY_PLATFORM',
      httpStatus: status,
    };
  }

  const dataNode =
    obj.data && typeof obj.data === 'object'
      ? (obj.data as Record<string, unknown>)
      : obj;

  const rawItems = Array.isArray(dataNode.items)
    ? (dataNode.items as Array<Record<string, unknown>>)
    : Array.isArray(dataNode.stories)
    ? (dataNode.stories as Array<Record<string, unknown>>)
    : [];

  const items: StoryMediaItem[] = [];
  rawItems.forEach((entry, idx) => {
    const clean = sanitizeMediaItem(entry, idx, nowMs);
    if (clean) items.push(clean);
  });

  const authorRaw = (dataNode.author || dataNode.user || obj.author) as
    | Record<string, unknown>
    | undefined;
  const author: StoryAuthorInfo | undefined =
    authorRaw || fallbackUsername
      ? {
          username: String(
            authorRaw?.username || fallbackUsername || 'instagram'
          ).replace(/^@/, ''),
          full_name: authorRaw?.full_name
            ? String(authorRaw.full_name)
            : undefined,
          avatar: authorRaw?.avatar
            ? String(authorRaw.avatar)
            : authorRaw?.profile_pic_url
            ? String(authorRaw.profile_pic_url)
            : undefined,
          verified: Boolean(authorRaw?.verified ?? authorRaw?.is_verified),
        }
      : undefined;

  if (items.length === 0) {
    return {
      ok: false,
      provider,
      items: [],
      author,
      errorCode: 'STORY_NO_ACTIVE',
      httpStatus: 404,
    };
  }

  return {
    ok: true,
    provider,
    items,
    author,
    httpStatus: status,
  };
}

/**
 * (b) Fournisseur `relay` : appelle le relais privé défini par `RELAY_URL` (et jeton optionnel `RELAY_TOKEN`)
 */
export const relayStoryProvider: StoryProvider = {
  name: 'relay',

  isAvailable(env: AdminEnv): boolean {
    return isValidExternalEndpointUrl(env?.RELAY_URL);
  },

  async getStory(
    url: string,
    env: AdminEnv,
    ctx?: StoryProviderContext
  ): Promise<StoryProviderResult> {
    if (!this.isAvailable(env)) {
      return {
        ok: false,
        provider: 'relay',
        items: [],
        errorCode: 'STORIES_UNAVAILABLE',
        httpStatus: 503,
      };
    }
    const base = String(env.RELAY_URL).trim().replace(/\/+$/, '');
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (env.RELAY_TOKEN && String(env.RELAY_TOKEN).trim()) {
      headers.Authorization = `Bearer ${String(env.RELAY_TOKEN).trim()}`;
    }
    const { username } = parseStoryUrl(url);
    try {
      const res = await fetchWithTimeout(
        `${base}/stories/item?url=${encodeURIComponent(url)}`,
        { method: 'GET', headers },
        ctx?.customFetch
      );
      const json = await res.json().catch(() => null);
      return mapExternalProviderPayload(
        'relay',
        res.status,
        json,
        username,
        ctx?.nowMs ?? Date.now()
      );
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      return {
        ok: false,
        provider: 'relay',
        items: [],
        errorCode: isTimeout ? 'TIMEOUT' : 'BLOCKED_BY_PLATFORM',
        httpStatus: isTimeout ? 504 : 502,
      };
    }
  },

  async listStories(
    username: string,
    env: AdminEnv,
    ctx?: StoryProviderContext
  ): Promise<StoryProviderResult> {
    if (!this.isAvailable(env)) {
      return {
        ok: false,
        provider: 'relay',
        items: [],
        errorCode: 'STORIES_UNAVAILABLE',
        httpStatus: 503,
      };
    }
    const normalized = normalizeInstagramStoryUsername(username);
    if (!normalized) {
      return {
        ok: false,
        provider: 'relay',
        items: [],
        errorCode: 'STORY_ACCOUNT_NOT_FOUND',
        httpStatus: 404,
      };
    }
    const base = String(env.RELAY_URL).trim().replace(/\/+$/, '');
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (env.RELAY_TOKEN && String(env.RELAY_TOKEN).trim()) {
      headers.Authorization = `Bearer ${String(env.RELAY_TOKEN).trim()}`;
    }
    try {
      const res = await fetchWithTimeout(
        `${base}/stories/list?username=${encodeURIComponent(normalized)}`,
        { method: 'GET', headers },
        ctx?.customFetch
      );
      const json = await res.json().catch(() => null);
      return mapExternalProviderPayload(
        'relay',
        res.status,
        json,
        normalized,
        ctx?.nowMs ?? Date.now()
      );
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      return {
        ok: false,
        provider: 'relay',
        items: [],
        errorCode: isTimeout ? 'TIMEOUT' : 'BLOCKED_BY_PLATFORM',
        httpStatus: isTimeout ? 504 : 502,
      };
    }
  },
};

/**
 * (c) Fournisseur `paid` : adaptateur configurable pour service payant à l'usage
 * Variables serveur uniquement (`STORIES_PAID_API_URL`, `STORIES_PAID_API_TOKEN`, `STORIES_PAID_API_HEADER`).
 */
export const paidStoryProvider: StoryProvider = {
  name: 'paid',

  isAvailable(env: AdminEnv): boolean {
    return (
      isValidExternalEndpointUrl(env?.STORIES_PAID_API_URL) &&
      Boolean(env?.STORIES_PAID_API_TOKEN && String(env.STORIES_PAID_API_TOKEN).trim())
    );
  },

  async getStory(
    url: string,
    env: AdminEnv,
    ctx?: StoryProviderContext
  ): Promise<StoryProviderResult> {
    if (!this.isAvailable(env)) {
      return {
        ok: false,
        provider: 'paid',
        items: [],
        errorCode: 'STORIES_UNAVAILABLE',
        httpStatus: 503,
      };
    }
    const base = String(env.STORIES_PAID_API_URL).trim().replace(/\/+$/, '');
    const token = String(env.STORIES_PAID_API_TOKEN).trim();
    const headerName = String(env.STORIES_PAID_API_HEADER || '').trim();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (headerName) {
      headers[headerName] = token;
    } else {
      headers.Authorization = `Bearer ${token}`;
    }
    const { username } = parseStoryUrl(url);
    try {
      const res = await fetchWithTimeout(
        `${base}/stories/item?url=${encodeURIComponent(url)}`,
        { method: 'GET', headers },
        ctx?.customFetch
      );
      const json = await res.json().catch(() => null);
      return mapExternalProviderPayload(
        'paid',
        res.status,
        json,
        username,
        ctx?.nowMs ?? Date.now()
      );
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      return {
        ok: false,
        provider: 'paid',
        items: [],
        errorCode: isTimeout ? 'TIMEOUT' : 'BLOCKED_BY_PLATFORM',
        httpStatus: isTimeout ? 504 : 502,
      };
    }
  },

  async listStories(
    username: string,
    env: AdminEnv,
    ctx?: StoryProviderContext
  ): Promise<StoryProviderResult> {
    if (!this.isAvailable(env)) {
      return {
        ok: false,
        provider: 'paid',
        items: [],
        errorCode: 'STORIES_UNAVAILABLE',
        httpStatus: 503,
      };
    }
    const normalized = normalizeInstagramStoryUsername(username);
    if (!normalized) {
      return {
        ok: false,
        provider: 'paid',
        items: [],
        errorCode: 'STORY_ACCOUNT_NOT_FOUND',
        httpStatus: 404,
      };
    }
    const base = String(env.STORIES_PAID_API_URL).trim().replace(/\/+$/, '');
    const token = String(env.STORIES_PAID_API_TOKEN).trim();
    const headerName = String(env.STORIES_PAID_API_HEADER || '').trim();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (headerName) {
      headers[headerName] = token;
    } else {
      headers.Authorization = `Bearer ${token}`;
    }
    try {
      const res = await fetchWithTimeout(
        `${base}/stories/list?username=${encodeURIComponent(normalized)}`,
        { method: 'GET', headers },
        ctx?.customFetch
      );
      const json = await res.json().catch(() => null);
      return mapExternalProviderPayload(
        'paid',
        res.status,
        json,
        normalized,
        ctx?.nowMs ?? Date.now()
      );
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      return {
        ok: false,
        provider: 'paid',
        items: [],
        errorCode: isTimeout ? 'TIMEOUT' : 'BLOCKED_BY_PLATFORM',
        httpStatus: isTimeout ? 504 : 502,
      };
    }
  },
};

function buildMockStoriesForUser(
  username: string,
  nowMs: number,
  requestedStoryId?: string | null
): StoryMediaItem[] {
  const baseTaken = nowMs - 4 * 3_600_000;
  const defaults: StoryMediaItem[] = [
    {
      id: '3399000000000000001',
      kind: 'photo',
      url: `https://scontent.cdninstagram.com/v/t51.2885-15/${username}_story_1.jpg`,
      thumbnail: `https://scontent.cdninstagram.com/v/t51.2885-15/${username}_story_1_thumb.jpg`,
      taken_at: new Date(baseTaken).toISOString(),
      expires_at: new Date(baseTaken + STORY_LIFETIME_MS).toISOString(),
      width: 1080,
      height: 1920,
    },
    {
      id: '3399000000000000002',
      kind: 'video',
      url: `https://scontent.cdninstagram.com/v/t50.2886-16/${username}_story_2.mp4`,
      thumbnail: `https://scontent.cdninstagram.com/v/t51.2885-15/${username}_story_2_thumb.jpg`,
      taken_at: new Date(baseTaken + 3_600_000).toISOString(),
      expires_at: new Date(baseTaken + 3_600_000 + STORY_LIFETIME_MS).toISOString(),
      width: 1080,
      height: 1920,
    },
    {
      id: '3399000000000000003',
      kind: 'photo',
      url: `https://scontent.cdninstagram.com/v/t51.2885-15/${username}_story_3.jpg`,
      thumbnail: `https://scontent.cdninstagram.com/v/t51.2885-15/${username}_story_3_thumb.jpg`,
      taken_at: new Date(baseTaken + 2 * 3_600_000).toISOString(),
      expires_at: new Date(
        baseTaken + 2 * 3_600_000 + STORY_LIFETIME_MS
      ).toISOString(),
      width: 1080,
      height: 1920,
    },
    {
      id: '3399000000000000004',
      kind: 'video',
      url: `https://scontent.cdninstagram.com/v/t50.2886-16/${username}_story_4.mp4`,
      thumbnail: `https://scontent.cdninstagram.com/v/t51.2885-15/${username}_story_4_thumb.jpg`,
      taken_at: new Date(baseTaken + 3 * 3_600_000).toISOString(),
      expires_at: new Date(
        baseTaken + 3 * 3_600_000 + STORY_LIFETIME_MS
      ).toISOString(),
      width: 1080,
      height: 1920,
    },
  ];

  if (requestedStoryId && !defaults.some((item) => item.id === requestedStoryId)) {
    defaults[1] = {
      ...defaults[1],
      id: requestedStoryId,
    };
  }
  return defaults;
}

/**
 * (d) Fournisseur `mock` : strictement réservé au développement local et aux tests automatisés.
 * Ne s'active JAMAIS en production.
 */
export const mockStoryProvider: StoryProvider = {
  name: 'mock',

  isAvailable(env: AdminEnv, ctx?: StoryProviderContext): boolean {
    return isMockProviderAllowed(env, ctx?.request);
  },

  async listStories(
    username: string,
    env: AdminEnv,
    ctx?: StoryProviderContext
  ): Promise<StoryProviderResult> {
    if (!this.isAvailable(env, ctx)) {
      return {
        ok: false,
        provider: 'mock',
        items: [],
        errorCode: 'STORIES_UNAVAILABLE',
        httpStatus: 503,
      };
    }

    const normalized = normalizeInstagramStoryUsername(username);
    if (
      !normalized ||
      normalized === 'missing_account' ||
      normalized === 'notfound_user' ||
      normalized === 'introuvable'
    ) {
      return {
        ok: false,
        provider: 'mock',
        items: [],
        errorCode: 'STORY_ACCOUNT_NOT_FOUND',
        httpStatus: 404,
      };
    }
    if (
      normalized === 'private_account' ||
      normalized === 'private_user' ||
      normalized === 'compte_prive'
    ) {
      return {
        ok: false,
        provider: 'mock',
        items: [],
        errorCode: 'STORY_ACCOUNT_PRIVATE',
        httpStatus: 403,
      };
    }
    if (
      normalized === 'empty_stories' ||
      normalized === 'no_stories_user' ||
      normalized === 'sans_story'
    ) {
      return {
        ok: false,
        provider: 'mock',
        items: [],
        author: { username: normalized, full_name: 'Compte sans story' },
        errorCode: 'STORY_NO_ACTIVE',
        httpStatus: 404,
      };
    }
    if (
      normalized === 'failing_provider' ||
      normalized === 'error_user' ||
      normalized === 'provider_error'
    ) {
      return {
        ok: false,
        provider: 'mock',
        items: [],
        errorCode: 'BLOCKED_BY_PLATFORM',
        httpStatus: 502,
      };
    }

    const nowMs = ctx?.nowMs ?? Date.now();
    const items = buildMockStoriesForUser(normalized, nowMs);
    return {
      ok: true,
      provider: 'mock',
      items,
      author: {
        username: normalized,
        full_name: `@${normalized}`,
        verified: normalized === 'natgeo' || normalized === 'demo_creator',
      },
      httpStatus: 200,
    };
  },

  async getStory(
    url: string,
    env: AdminEnv,
    ctx?: StoryProviderContext
  ): Promise<StoryProviderResult> {
    if (!this.isAvailable(env, ctx)) {
      return {
        ok: false,
        provider: 'mock',
        items: [],
        errorCode: 'STORIES_UNAVAILABLE',
        httpStatus: 503,
      };
    }

    const { username, storyId } = parseStoryUrl(url);
    const targetUsername = username || 'demo_creator';
    const listRes = await this.listStories(targetUsername, env, ctx);
    if (!listRes.ok) {
      return listRes;
    }
    const nowMs = ctx?.nowMs ?? Date.now();
    const items = buildMockStoriesForUser(targetUsername, nowMs, storyId);
    const chosen = storyId
      ? items.find((item) => item.id === storyId) || items[0]
      : items[0];

    return {
      ok: true,
      provider: 'mock',
      items: [chosen],
      author: listRes.author,
      httpStatus: 200,
    };
  },
};

export const STORY_PROVIDERS_REGISTRY: Record<StoryProviderName, StoryProvider> = {
  session: sessionStoryProvider,
  relay: relayStoryProvider,
  paid: paidStoryProvider,
  mock: mockStoryProvider,
};

// --- Cache métadonnées 5 minutes (jamais de fichiers média) ---

interface StoryCacheEntry {
  outcome: Omit<StoryResolutionOutcome, 'cached' | 'attempts'>;
  expiresAt: number;
}

const storyMetadataCache = new Map<string, StoryCacheEntry>();

export function clearStoryMetadataCache(): void {
  storyMetadataCache.clear();
  igUserProfileCache.clear();
}

export function getStoryMetadataCacheEntry(
  key: string,
  nowMs: number = Date.now()
): Omit<StoryResolutionOutcome, 'cached' | 'attempts'> | null {
  const entry = storyMetadataCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= nowMs) {
    storyMetadataCache.delete(key);
    return null;
  }
  return entry.outcome;
}

function setStoryMetadataCacheEntry(
  key: string,
  outcome: Omit<StoryResolutionOutcome, 'cached' | 'attempts'>,
  nowMs: number = Date.now()
): void {
  if (storyMetadataCache.size >= MAX_CACHE_ENTRIES) {
    for (const [k, v] of storyMetadataCache.entries()) {
      if (v.expiresAt <= nowMs) {
        storyMetadataCache.delete(k);
      }
    }
    if (storyMetadataCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = storyMetadataCache.keys().next().value;
      if (oldestKey) storyMetadataCache.delete(oldestKey);
    }
  }
  storyMetadataCache.set(key, {
    outcome: {
      ...outcome,
      items: outcome.items.map((item) => ({ ...item })),
    },
    expiresAt: nowMs + STORY_METADATA_CACHE_TTL_MS,
  });
}

// --- Suivi en mémoire de l'état des fournisseurs pour le panneau admin ---

const MAX_RECENT_EVENTS = 20;
const recentStorySuccesses: StoryProviderEventRecord[] = [];
const recentStoryFailures: StoryProviderEventRecord[] = [];
let lastActiveStoryProvider: StoryProviderName | null = null;

const perProviderLastState = new Map<
  StoryProviderName,
  {
    lastSuccessTs: number | null;
    lastFailureTs: number | null;
    lastErrorCode: string | null;
    lastHttpStatus: number | null;
  }
>();

export function resetStoryProviderTelemetry(): void {
  recentStorySuccesses.length = 0;
  recentStoryFailures.length = 0;
  lastActiveStoryProvider = null;
  perProviderLastState.clear();
}

async function recordProviderTelemetry(
  env: AdminEnv,
  provider: StoryProviderName,
  action: 'getStory' | 'listStories',
  res: StoryProviderResult,
  nowMs: number
): Promise<void> {
  const current = perProviderLastState.get(provider) || {
    lastSuccessTs: null,
    lastFailureTs: null,
    lastErrorCode: null,
    lastHttpStatus: null,
  };

  const event: StoryProviderEventRecord = {
    ts: nowMs,
    provider,
    action,
    ok: res.ok,
    errorCode: res.ok ? null : res.errorCode || 'BLOCKED_BY_PLATFORM',
    httpStatus: typeof res.httpStatus === 'number' ? res.httpStatus : null,
  };

  if (res.ok) {
    lastActiveStoryProvider = provider;
    current.lastSuccessTs = nowMs;
    current.lastErrorCode = null;
    current.lastHttpStatus = res.httpStatus ?? 200;
    recentStorySuccesses.unshift(event);
    if (recentStorySuccesses.length > MAX_RECENT_EVENTS) {
      recentStorySuccesses.length = MAX_RECENT_EVENTS;
    }
  } else {
    current.lastFailureTs = nowMs;
    current.lastErrorCode = res.errorCode || 'BLOCKED_BY_PLATFORM';
    current.lastHttpStatus = res.httpStatus ?? null;
    recentStoryFailures.unshift(event);
    if (recentStoryFailures.length > MAX_RECENT_EVENTS) {
      recentStoryFailures.length = MAX_RECENT_EVENTS;
    }
  }
  perProviderLastState.set(provider, current);

  await Promise.all([
    incrementD1HourlyCounter(env, 'story_calls_total', nowMs),
    incrementD1HourlyCounter(env, `story_calls_provider:${provider}`, nowMs),
  ]).catch(() => {});
}

function isDefinitiveAccountError(code?: StoryErrorCode): boolean {
  return (
    code === 'STORY_ACCOUNT_PRIVATE' ||
    code === 'STORY_ACCOUNT_NOT_FOUND' ||
    code === 'STORY_NO_ACTIVE'
  );
}

function getEffectiveProviderSequence(
  settings: SystemSettings,
  env: AdminEnv,
  ctx?: StoryProviderContext
): StoryProvider[] {
  const sequence: StoryProvider[] = [];
  const seen = new Set<StoryProviderName>();
  for (const id of settings.stories_provider_order) {
    if (seen.has(id)) continue;
    const provider = STORY_PROVIDERS_REGISTRY[id];
    if (!provider) continue;
    if (provider.name === 'mock' && !isMockProviderAllowed(env, ctx?.request)) {
      continue;
    }
    if (provider.isAvailable(env, ctx)) {
      seen.add(id);
      sequence.push(provider);
    }
  }
  // En développement local / tests uniquement, ajoute le fournisseur mock en dernier recours si explicitement autorisé
  if (!seen.has('mock') && isMockProviderAllowed(env, ctx?.request)) {
    seen.add('mock');
    sequence.push(mockStoryProvider);
  }
  return sequence;
}

export async function resolveStoryWithProviders(
  storyUrl: string,
  env: AdminEnv,
  settings: SystemSettings,
  ctx?: StoryProviderContext
): Promise<StoryResolutionOutcome> {
  const nowMs = ctx?.nowMs ?? Date.now();
  const { username, storyId } = parseStoryUrl(storyUrl);

  if (!settings.feature_stories) {
    return {
      ok: false,
      items: [],
      username: username || undefined,
      storyId: storyId || undefined,
      cached: false,
      errorCode: 'STORIES_UNAVAILABLE',
      httpStatus: 503,
      message: STORIES_UNAVAILABLE_MESSAGE,
      attempts: [],
    };
  }

  const providers = getEffectiveProviderSequence(settings, env, ctx);
  if (providers.length === 0) {
    return {
      ok: false,
      items: [],
      username: username || undefined,
      storyId: storyId || undefined,
      cached: false,
      errorCode: 'STORIES_UNAVAILABLE',
      httpStatus: 503,
      message: STORIES_UNAVAILABLE_MESSAGE,
      attempts: [],
    };
  }

  const cacheKey = `story:${username || 'unknown'}:${storyId || storyUrl.trim()}`;
  const cachedOutcome = getStoryMetadataCacheEntry(cacheKey, nowMs);
  if (cachedOutcome) {
    return {
      ...cachedOutcome,
      cached: true,
      attempts: [],
    };
  }

  const attempts: StoryAttemptDiagnostic[] = [];
  let lastError: StoryProviderResult | null = null;

  for (const provider of providers) {
    const t0 = Date.now();
    const res = await provider.getStory(storyUrl, env, { ...ctx, nowMs });
    const durationMs = Math.max(0, Date.now() - t0);
    attempts.push({
      provider: provider.name,
      ok: res.ok,
      errorCode: res.errorCode,
      httpStatus: res.httpStatus,
      durationMs,
    });
    await recordProviderTelemetry(env, provider.name, 'getStory', res, nowMs);

    if (res.ok && res.items.length > 0) {
      const outcome: Omit<StoryResolutionOutcome, 'cached' | 'attempts'> = {
        ok: true,
        provider: provider.name,
        items: res.items,
        author: res.author,
        username: res.author?.username || username || undefined,
        storyId: storyId || res.items[0]?.id,
        httpStatus: 200,
      };
      setStoryMetadataCacheEntry(cacheKey, outcome, nowMs);
      return {
        ...outcome,
        cached: false,
        attempts,
      };
    }

    lastError = res;
    if (isDefinitiveAccountError(res.errorCode)) {
      return {
        ok: false,
        provider: provider.name,
        items: [],
        author: res.author,
        username: username || undefined,
        storyId: storyId || undefined,
        cached: false,
        errorCode: res.errorCode,
        httpStatus: res.httpStatus,
        message: res.message,
        attempts,
      };
    }
  }

  return {
    ok: false,
    provider: lastError?.provider,
    items: [],
    username: username || undefined,
    storyId: storyId || undefined,
    cached: false,
    errorCode: 'STORIES_UNAVAILABLE',
    httpStatus: lastError?.httpStatus ?? 503,
    message: STORIES_UNAVAILABLE_MESSAGE,
    attempts,
  };
}

export function getListStoriesCacheKey(username: string): string {
  return `list:${(username || '').trim().toLowerCase()}`;
}

export async function listStoriesWithProviders(
  username: string,
  env: AdminEnv,
  settings: SystemSettings,
  ctx?: StoryProviderContext
): Promise<StoryResolutionOutcome> {
  const nowMs = ctx?.nowMs ?? Date.now();
  const normalized = normalizeInstagramStoryUsername(username);

  if (!settings.feature_stories) {
    return {
      ok: false,
      items: [],
      username: normalized || undefined,
      cached: false,
      errorCode: 'STORIES_UNAVAILABLE',
      httpStatus: 503,
      message: STORIES_UNAVAILABLE_MESSAGE,
      attempts: [],
    };
  }

  if (!normalized) {
    return {
      ok: false,
      items: [],
      cached: false,
      errorCode: 'STORY_ACCOUNT_NOT_FOUND',
      httpStatus: 404,
      attempts: [],
    };
  }

  const providers = getEffectiveProviderSequence(settings, env, ctx);
  if (providers.length === 0) {
    return {
      ok: false,
      items: [],
      username: normalized,
      cached: false,
      errorCode: 'STORIES_UNAVAILABLE',
      httpStatus: 503,
      message: STORIES_UNAVAILABLE_MESSAGE,
      attempts: [],
    };
  }

  const cacheKey = getListStoriesCacheKey(normalized);
  const cachedOutcome = getStoryMetadataCacheEntry(cacheKey, nowMs);
  if (cachedOutcome) {
    return {
      ...cachedOutcome,
      cached: true,
      attempts: [],
    };
  }

  const attempts: StoryAttemptDiagnostic[] = [];
  let lastError: StoryProviderResult | null = null;

  for (const provider of providers) {
    const t0 = Date.now();
    const res = await provider.listStories(normalized, env, { ...ctx, nowMs });
    const durationMs = Math.max(0, Date.now() - t0);
    attempts.push({
      provider: provider.name,
      ok: res.ok,
      errorCode: res.errorCode,
      httpStatus: res.httpStatus,
      durationMs,
    });
    await recordProviderTelemetry(env, provider.name, 'listStories', res, nowMs);

    if (res.ok && res.items.length > 0) {
      const outcome: Omit<StoryResolutionOutcome, 'cached' | 'attempts'> = {
        ok: true,
        provider: provider.name,
        items: res.items,
        author: res.author || { username: normalized },
        username: normalized,
        httpStatus: 200,
      };
      setStoryMetadataCacheEntry(cacheKey, outcome, nowMs);
      return {
        ...outcome,
        cached: false,
        attempts,
      };
    }

    lastError = res;
    if (isDefinitiveAccountError(res.errorCode)) {
      return {
        ok: false,
        provider: provider.name,
        items: [],
        author: res.author,
        username: normalized,
        cached: false,
        errorCode: res.errorCode,
        httpStatus: res.httpStatus,
        message: res.message,
        attempts,
      };
    }
  }

  return {
    ok: false,
    provider: lastError?.provider,
    items: [],
    username: normalized,
    cached: false,
    errorCode: 'STORIES_UNAVAILABLE',
    httpStatus: lastError?.httpStatus ?? 503,
    message: STORIES_UNAVAILABLE_MESSAGE,
    attempts,
  };
}

/**
 * Construit le panneau d'état des fournisseurs de Stories pour l'administration
 * sans jamais exposer aucune clé ou jeton secret.
 */
export async function getStoriesAdminStatusSnapshot(
  env: AdminEnv,
  settings: SystemSettings,
  request?: Request
): Promise<StoriesAdminStatusSnapshot> {
  const nowMs = Date.now();
  const providerList: StoryProviderName[] = [...CONFIGURABLE_STORY_PROVIDERS];
  if (isMockProviderAllowed(env, request)) {
    providerList.push('mock');
  }

  const [callsLastHour, listCallsLastHour, ...providerHourlyCounts] =
    await Promise.all([
      getD1HourlyCount(env, 'story_calls_total', nowMs),
      getD1HourlyCount(env, 'story_list_global', nowMs),
      ...providerList.map((name) =>
        getD1HourlyCount(env, `story_calls_provider:${name}`, nowMs)
      ),
    ]);

  // Enrichir avec les erreurs récentes stockées en D1 (`request_log` where content_kind = 'story')
  const dbFailures: StoryProviderEventRecord[] = [];
  const db = getDb(env);
  if (db) {
    try {
      const rows = await db
        .prepare(
          'SELECT id, ts, platform, status, error_code, duration_ms, ip_hash, engine_stage, http_status, content_kind, engine_fn FROM request_log ORDER BY ts DESC, id DESC LIMIT ? OFFSET ?'
        )
        .bind(80, 0)
        .all<{
          ts: number;
          status: string;
          error_code: string | null;
          engine_stage: string | null;
          http_status: number | null;
          content_kind?: string | null;
        }>();
      for (const row of rows.results || []) {
        if (row.content_kind !== 'story') continue;
        const stage = (row.engine_stage || '').toLowerCase() as StoryProviderName;
        if (
          stage === 'session' ||
          stage === 'relay' ||
          stage === 'paid' ||
          stage === 'mock'
        ) {
          dbFailures.push({
            ts: Number(row.ts || 0),
            provider: stage,
            action: 'getStory',
            ok: row.status === 'success',
            errorCode: row.error_code,
            httpStatus: row.http_status ?? null,
          });
        }
      }
    } catch {
      // Non-blocking
    }
  }

  const providers = providerList.map((name, idx) => {
    const provider = STORY_PROVIDERS_REGISTRY[name];
    const configured = provider.isAvailable(env, { request });
    const mem = perProviderLastState.get(name);
    const dbLatestFail = dbFailures.find((f) => f.provider === name && !f.ok);
    return {
      name,
      configured,
      callsLastHour: providerHourlyCounts[idx] ?? 0,
      lastSuccessTs: mem?.lastSuccessTs ?? null,
      lastFailureTs: mem?.lastFailureTs ?? dbLatestFail?.ts ?? null,
      lastErrorCode: mem?.lastErrorCode ?? dbLatestFail?.errorCode ?? null,
      lastHttpStatus: mem?.lastHttpStatus ?? dbLatestFail?.httpStatus ?? null,
    };
  });

  // Fournisseur actif : dernier fournisseur en succès si disponible, sinon le premier configuré selon l'ordre admin
  const effectiveProviders = getEffectiveProviderSequence(settings, env, {
    request,
  });
  const activeProvider: StoryProviderName | null = !settings.feature_stories
    ? null
    : lastActiveStoryProvider &&
        effectiveProviders.some((p) => p.name === lastActiveStoryProvider)
      ? lastActiveStoryProvider
      : effectiveProviders[0]?.name ?? null;

  const mergedFailures =
    recentStoryFailures.length > 0
      ? recentStoryFailures.slice(0, 10)
      : dbFailures.filter((f) => !f.ok).slice(0, 10);

  return {
    enabled: settings.feature_stories,
    activeProvider,
    providerOrder: [...settings.stories_provider_order],
    perIpHourlyLimit: settings.stories_list_rate_limit_per_hour,
    globalHourlyCap: settings.stories_global_hourly_cap,
    callsLastHour,
    listCallsLastHour,
    providers,
    recentSuccesses: recentStorySuccesses.slice(0, 10),
    recentFailures: mergedFailures,
  };
}
