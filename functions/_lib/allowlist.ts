/**
 * Allowlist de sécurité pour le proxy de téléchargement en streaming VIDNEX (`/api/download`).
 * Autorise tous les domaines CDN officiels de TikTok, ByteDance, TikWM et Meta/Instagram,
 * tout en bloquant strictement les hôtes internes/privés (anti-SSRF).
 */

const ALLOWED_CDN_DOMAINS = [
  // TikTok, ByteDance, Akamai & TikWM CDNs
  'tiktokcdn.com',
  'tiktokcdn-us.com',
  'tiktokcdn-eu.com',
  'tiktokcdn-in.com',
  'tiktokv.com',
  'tiktokv.us',
  'tiktokv.eu',
  'tiktok.com',
  'tikwm.com',
  'musical.ly',
  'muscdn.com',
  'byteoversea.com',
  'ibytedtos.com',
  'ibyteimg.com',
  'byteimg.com',
  'bytednsdoc.com',
  'snssdk.com',
  'amemv.com',
  'ttwstatic.com',
  'akamaized.net',

  // Instagram & Meta CDNs
  'cdninstagram.com',
  'instagram.com',
  'fbcdn.net',
  'facebook.com',
  'fbsbx.com',
  'ig.me',
];

export function isAllowedMediaHost(hostname: string): boolean {
  if (!hostname) return false;
  const lower = hostname.trim().toLowerCase();

  // Bloquer strictement les adresses privées / locales (anti-SSRF)
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower.startsWith('10.') ||
    lower.startsWith('192.168.') ||
    lower.startsWith('169.254.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(lower)
  ) {
    return false;
  }

  return ALLOWED_CDN_DOMAINS.some(
    (domain) => lower === domain || lower.endsWith(`.${domain}`)
  );
}
