/**
 * Allowlist de sécurité pour le proxy de téléchargement en streaming VIDNEX (`/api/download`).
 * Empêche tout abus SSRF en n'autorisant que les domaines CDN officiels de TikTok (et TikWM) et Meta/Instagram.
 */

const ALLOWED_CDN_DOMAINS = [
  // TikTok, ByteDance & TikWM CDNs
  'tiktokcdn.com',
  'tiktokcdn-us.com',
  'tiktokcdn-eu.com',
  'tiktokv.com',
  'tiktok.com',
  'tikwm.com',
  'musical.ly',
  'byteoversea.com',
  'ibytedtos.com',
  'ibyteimg.com',

  // Instagram & Meta CDNs
  'cdninstagram.com',
  'instagram.com',
  'fbcdn.net',
  'facebook.com',
  'fbsbx.com',
];

export function isAllowedMediaHost(hostname: string): boolean {
  if (!hostname) return false;
  const lower = hostname.trim().toLowerCase();

  // Bloquer les adresses privées / locales
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower.startsWith('10.') ||
    lower.startsWith('192.168.') ||
    lower.startsWith('169.254.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(lower)
  ) {
    return false;
  }

  // Vérifier si le domaine se termine par un suffixe autorisé
  return ALLOWED_CDN_DOMAINS.some(
    (domain) => lower === domain || lower.endsWith(`.${domain}`)
  );
}
