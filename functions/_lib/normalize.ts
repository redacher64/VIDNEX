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
  | 'MAINTENANCE'
  | 'PLATFORM_DISABLED'
  | 'BLOCKED';

export interface ExtractMediaItem {
  kind: 'video' | 'image' | 'audio';
  url: string;
  backupUrl?: string;
  cookie?: string;
  thumbnail?: string;
  quality?: string;
  ext: string;
  size?: string;
  width?: number;
  height?: number;
}

export interface ExtractResponse {
  ok: boolean;
  platform?: 'tiktok' | 'instagram' | 'x';
  type?: 'video' | 'image' | 'carousel' | 'profile';
  title?: string;
  duration?: string;
  cookie?: string;
  author?: {
    username: string;
    nickname?: string;
    avatar?: string;
    followers?: string;
    biography?: string;
    verified?: boolean;
  };
  thumbnail?: string;
  items?: ExtractMediaItem[];
  error?: {
    code: ErrorCode;
    message: string;
  };
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

export function mapErrorCodeToHttpStatus(code: ErrorCode): number {
  switch (code) {
    case 'UNSUPPORTED_URL':
      return 400;
    case 'PRIVATE_OR_LOGIN_REQUIRED':
    case 'PLATFORM_DISABLED':
    case 'BLOCKED':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'NO_MEDIA':
      return 422;
    case 'RATE_LIMITED':
      return 429;
    case 'MAINTENANCE':
      return 503;
    case 'TIMEOUT':
      return 504;
    case 'BLOCKED_BY_PLATFORM':
    default:
      return 502;
  }
}

export function createSuccessResponse(
  data: Omit<ExtractResponse, 'ok'>,
  extraHeaders?: Record<string, string>
): Response {
  const body: ExtractResponse = {
    ok: true,
    ...data,
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
