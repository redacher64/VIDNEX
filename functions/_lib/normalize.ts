/**
 * Types et formateurs de réponses normalisées pour l'API VIDNEX (`/api/extract`).
 * Retourne des codes HTTP sémantiques (400, 403, 404, 429, 502, 504) en cas d'erreur.
 */

export type ErrorCode =
  | 'UNSUPPORTED_URL'
  | 'NOT_FOUND'
  | 'NO_MEDIA'
  | 'PRIVATE_OR_LOGIN_REQUIRED'
  | 'RATE_LIMITED'
  | 'BLOCKED_BY_PLATFORM'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'MAINTENANCE'
  | 'PLATFORM_DISABLED'
  | 'BLOCKED'
  | 'LOGIN_WALL'
  | 'PROFILE_NOT_FOUND'
  | 'PHOTO_NOT_AVAILABLE'
  | 'INVALID_IMAGE'
  | 'IMAGE_EXPIRED'
  | 'STORIES_UNAVAILABLE'
  | 'STORY_ACCOUNT_PRIVATE'
  | 'STORY_ACCOUNT_NOT_FOUND'
  | 'STORY_NO_ACTIVE'
  | 'STORY_RATE_LIMITED'
  | 'TURNSTILE_REQUIRED'
  | 'TURNSTILE_FAILED'
  | 'IP_BLOCKED';

export const STORIES_UNAVAILABLE_MESSAGE =
  'Les stories sont temporairement indisponibles.';

export interface ExtractStoryMeta {
  username: string;
  storyId?: string;
  takenAt?: string;
  expiresAt?: string;
  canListAll: boolean;
}

export interface ExtractMediaItem {
  index?: number;
  id?: string;
  selected?: boolean;
  label?: string;
  kind: 'video' | 'image' | 'audio';
  url: string;
  backupUrl?: string;
  cookie?: string;
  thumbnail?: string;
  quality?: string;
  isThumbnail?: boolean;
  ext: string;
  size?: string;
  width?: number;
  height?: number;
  date?: string;
}

export interface ExtractResponse {
  ok: boolean;
  id?: string;
  platform?: 'tiktok' | 'instagram' | 'x' | 'facebook' | 'linkedin';
  type?: 'video' | 'image' | 'carousel' | 'profile';
  title?: string;
  duration?: string;
  cookie?: string;
  author?: {
    username: string;
    nickname?: string;
    full_name?: string;
    avatar?: string;
    followers?: string;
    biography?: string;
    verified?: boolean;
  };
  thumbnail?: string;
  items?: ExtractMediaItem[];
  storyMeta?: ExtractStoryMeta;
  stage?: 'direct' | 'tiers';
  engineStage?: string;
  httpStatus?: number | null;
  contentKind?: string;
  engineFn?: string;
  error?: {
    code: ErrorCode;
    message: string;
  };
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, X-Turnstile-Token',
};

export function mapErrorCodeToHttpStatus(code: ErrorCode): number {
  switch (code) {
    case 'UNSUPPORTED_URL':
      return 400;
    case 'PRIVATE_OR_LOGIN_REQUIRED':
    case 'LOGIN_WALL':
    case 'PLATFORM_DISABLED':
    case 'BLOCKED':
    case 'STORY_ACCOUNT_PRIVATE':
    case 'TURNSTILE_REQUIRED':
    case 'TURNSTILE_FAILED':
    case 'IP_BLOCKED':
      return 403;
    case 'NOT_FOUND':
    case 'PROFILE_NOT_FOUND':
    case 'STORY_ACCOUNT_NOT_FOUND':
    case 'STORY_NO_ACTIVE':
      return 404;
    case 'IMAGE_EXPIRED':
      return 410;
    case 'NO_MEDIA':
    case 'PHOTO_NOT_AVAILABLE':
    case 'INVALID_IMAGE':
      return 422;
    case 'RATE_LIMITED':
    case 'STORY_RATE_LIMITED':
      return 429;
    case 'MAINTENANCE':
    case 'STORIES_UNAVAILABLE':
      return 503;
    case 'TIMEOUT':
      return 504;
    case 'NETWORK_ERROR':
    case 'BLOCKED_BY_PLATFORM':
    default:
      return 502;
  }
}

export function createSuccessResponse(
  data: Omit<ExtractResponse, 'ok'>,
  extraHeaders?: Record<string, string>
): Response {
  const { engineStage: _es, httpStatus: _hs, contentKind: _ck, engineFn: _ef, cookie: _ck2, ...publicData } = data;
  const body: ExtractResponse = {
    ok: true,
    ...publicData,
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300',
      ...(extraHeaders || {}),
    },
  });
}

export function createErrorResponse(
  code: ErrorCode,
  message: string,
  httpStatus?: number,
  extraHeaders?: Record<string, string>
): Response {
  const status = httpStatus ?? mapErrorCodeToHttpStatus(code);
  const body: ExtractResponse = {
    ok: false,
    error: {
      code,
      message,
    },
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(extraHeaders || {}),
    },
  });
}

export function optionsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      'Access-Control-Max-Age': '86400',
    },
  });
}
