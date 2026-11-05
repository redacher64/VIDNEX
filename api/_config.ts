/**
 * Server-Side Only RapidAPI Configuration
 * NEVER import this module inside `src/` (frontend client code).
 */

export interface RapidApiServerConfig {
  rapidApiKey: string;
  instagramHost: string;
  tiktokHost: string;
  userAgent: string;
  isConfigured: boolean;
}

export function getRapidApiConfig(
  env: Record<string, string | undefined> = typeof process !== 'undefined'
    ? process.env
    : {}
): RapidApiServerConfig {
  const rapidApiKey = (env.RAPIDAPI_KEY || '').trim();
  const instagramHost = (
    env.RAPIDAPI_HOST || 'instagram-scraper-stable-api.p.rapidapi.com'
  ).trim();
  const tiktokHost = (
    env.RAPIDAPI_TIKTOK_HOST || 'tiktok-video-no-watermark2.p.rapidapi.com'
  ).trim();
  const userAgent = (env.RAPIDAPI_UA || 'RapidAPI-Playground').trim();

  return {
    rapidApiKey,
    instagramHost,
    tiktokHost,
    userAgent,
    isConfigured: rapidApiKey.length > 10,
  };
}

/**
 * Builds the exact HTTP headers required by RapidAPI from server-side config.
 * Note: When sending a `FormData` body (`multipart/form-data`), `fetch`
 * automatically sets `Content-Type: multipart/form-data; boundary=...`.
 */
export function buildRapidApiHeaders(
  host: string,
  config: RapidApiServerConfig,
  extraHeaders: Record<string, string> = {}
): Record<string, string> {
  return {
    accept: 'application/json',
    'x-rapidapi-host': host,
    'x-rapidapi-key': config.rapidApiKey,
    'x-rapidapi-ua': config.userAgent,
    ...extraHeaders,
  };
}
