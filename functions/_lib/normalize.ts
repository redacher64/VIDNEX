/**
 * Types et formateurs de réponses normalisées pour l'API VIDNEX (`/api/extract`).
 */

export type ErrorCode =
  | 'UNSUPPORTED_URL'
  | 'NOT_FOUND'
  | 'PRIVATE_OR_LOGIN_REQUIRED'
  | 'BLOCKED_BY_PLATFORM'
  | 'TIMEOUT';

export interface ExtractMediaItem {
  kind: 'video' | 'image' | 'audio';
  url: string;
  thumbnail?: string;
  quality?: string;
  ext: string;
  size?: string;
  width?: number;
  height?: number;
}

export interface ExtractResponse {
  ok: boolean;
  platform?: 'tiktok' | 'instagram';
  type?: 'video' | 'image' | 'carousel' | 'profile';
  title?: string;
  duration?: string;
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

export function createSuccessResponse(data: Omit<ExtractResponse, 'ok'>): Response {
  const body: ExtractResponse = {
    ok: true,
    ...data,
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export function createErrorResponse(
  code: ErrorCode,
  message: string,
  httpStatus = 200
): Response {
  const body: ExtractResponse = {
    ok: false,
    error: {
      code,
      message,
    },
  };
  return new Response(JSON.stringify(body), {
    status: httpStatus,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
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
