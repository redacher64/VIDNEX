import fs from 'node:fs';

/**
 * Multi-Engine Backend Configuration
 * - Engine 1: TikWM (`https://www.tikwm.com/api/`) with server-side API key
 * - Engine 2: BetterTwitFix (`https://github.com/dylanpdx/BetterTwitFix.git`)
 * - Engine 3: Universal `yt-dlp` with optional `COOKIES_TXT_BASE64`
 */

export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

export const DEFAULT_TIKWM_API_KEY = 'fbef7469f068f8ee1493378b59468819';

/**
 * Reads the internal URL of the `backend` service injected at runtime by
 * Vercel Service Bindings (`{ "type": "service", "service": "backend", "format": "url", "env": "BACKEND_URL" }`).
 */
export function getBoundBackendUrl(
  env: Record<string, string | undefined> = typeof process !== 'undefined'
    ? process.env
    : {}
): string {
  return (env.BACKEND_URL || '').trim();
}

export function getTikWmApiKey(
  env: Record<string, string | undefined> = typeof process !== 'undefined'
    ? process.env
    : {}
): string {
  return (env.TIKWM_API_KEY || DEFAULT_TIKWM_API_KEY).trim();
}

export function getBetterTwitFixBaseUrl(
  env: Record<string, string | undefined> = typeof process !== 'undefined'
    ? process.env
    : {}
): string {
  return (env.BETTERTWITFIX_API_URL || 'https://api.vxtwitter.com')
    .trim()
    .replace(/\/+$/, '');
}

/**
 * Ported from `dylanpdx/BetterTwitFix` (`twExtract/twUtils.py`: `calcSyndicationToken`)
 * Computes the base-36 pi token required by `https://cdn.syndication.twimg.com/tweet-result`
 */
export function calcSyndicationToken(idStr: string): string {
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
  const num = Number(idStr);
  if (!Number.isFinite(num) || num <= 0) return '0';
  const x = (num / 1e15) * Math.PI;
  const base = 36;

  let result = '';
  let intPart = Math.floor(x);
  while (intPart > 0) {
    result = digits[intPart % base] + result;
    intPart = Math.floor(intPart / base);
  }

  let frac = x - Math.floor(x);
  if (frac !== 0) {
    result += '.';
    let d = 0;
    while (frac !== Math.floor(frac) && d < 8) {
      frac *= base;
      result += digits[Math.floor(frac % base)];
      d += 1;
    }
  }

  const cleaned = result.replace(/0/g, '').replace(/\./g, '');
  return cleaned || '0';
}

/**
 * Ported from `dylanpdx/BetterTwitFix` (`vxApi.py`: `getBestMediaUrl`)
 * Finds the highest bitrate H.264 `video/mp4` stream, excluding `/hevc/` variants
 * and stripping query tags (`?tag=`).
 */
export function getBestTwitterMp4Url(variants: any[]): string {
  if (!Array.isArray(variants)) return '';
  let bestBitrate = -1;
  let bestUrl = '';

  for (const v of variants) {
    if (!v || typeof v !== 'object') continue;
    const contentType = String(v.content_type || '');
    const url = String(v.url || '');
    const bitrate = typeof v.bitrate === 'number' ? v.bitrate : 0;
    if (
      contentType === 'video/mp4' &&
      url &&
      !url.includes('/hevc/') &&
      bitrate > bestBitrate
    ) {
      bestUrl = url;
      bestBitrate = bitrate;
    }
  }

  if (bestUrl.includes('?tag=')) {
    bestUrl = bestUrl.slice(0, bestUrl.indexOf('?tag='));
  }
  return bestUrl;
}

export function prepareCookiesFile(
  env: Record<string, string | undefined> = typeof process !== 'undefined'
    ? process.env
    : {}
): string | null {
  const b64 = (env.COOKIES_TXT_BASE64 || '').trim();
  if (!b64) return null;
  try {
    const decoded = Buffer.from(b64, 'base64').toString('utf-8');
    if (!decoded.includes('\t') && !decoded.includes('Netscape')) {
      return null;
    }
    const cookiePath = '/tmp/cookies.txt';
    fs.writeFileSync(cookiePath, decoded, 'utf-8');
    return cookiePath;
  } catch {
    return null;
  }
}
