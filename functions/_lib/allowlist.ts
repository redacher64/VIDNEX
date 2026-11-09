/**
 * Allowlist de sécurité pour le proxy de téléchargement en streaming VIDNEX (`/api/download`).
 *
 * Règles anti-SSRF strictes :
 * - Autorise uniquement les sous-domaines CDN médias légitimes de Meta/Instagram et TikTok/ByteDance/TikWM.
 * - Exclut les domaines web principaux nus (`instagram.com`, `facebook.com`, `tiktok.com`).
 * - Bloque toutes les plages IPv4/IPv6 locales et privées (RFC 1918 : 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, 127.0.0.0/8).
 */

/**
 * Domaines CDN où l'hôte exact OU tout sous-domaine (`*.domain`) est autorisé.
 */
const ALLOWED_CDN_WILDCARD_DOMAINS = [
  // Instagram & Meta Media CDNs
  'cdninstagram.com',
  'fbcdn.net',
  'fbsbx.com',

  // TikTok, ByteDance & TikWM Media CDNs
  'tiktokcdn.com',
  'tiktokcdn-us.com',
  'tiktokcdn-eu.com',
  'tiktokcdn-in.com',
  'tiktokv.com',
  'tiktokv.us',
  'tiktokv.eu',
  'byteoversea.com',
  'ibytedtos.com',
  'ibyteimg.com',
  'byteimg.com',
  'bytednsdoc.com',
  'musically.com',
  'musical.ly',
  'muscdn.com',
  'tikwm.com',
  'webapp-prime.tiktok.com',
];

/**
 * Hôtes exacts autorisés pour les médias X / Twitter (pas de wildcard *.twimg.com trop large).
 */
const ALLOWED_EXACT_MEDIA_HOSTS = new Set([
  'video.twimg.com',
  'pbs.twimg.com',
  'abs.twimg.com',
]);

/**
 * Domaines où SEULS les sous-domaines stricts (`*.domain`) sont autorisés,
 * mais JAMAIS le domaine nu (`facebook.com`, `instagram.com`, `tiktok.com`).
 */
const SUBDOMAIN_ONLY_DOMAINS = ['tiktok.com'];

export function isPrivateOrReservedHost(hostname: string): boolean {
  const lower = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!lower) return true;

  if (
    lower === 'localhost' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower === '::' ||
    lower.startsWith('fe80:') ||
    lower.startsWith('fc00:') ||
    lower.startsWith('fd00:') ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower.endsWith('.localhost')
  ) {
    return true;
  }

  // Vérification IPv4 RFC 1918, Loopback et Link-Local
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(lower)) {
    const parts = lower.split('.').map(Number);
    if (parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
      return true;
    }
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC 1918: 172.16.0.0/12
    if (a === 192 && b === 168) return true; // RFC 1918: 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT: 100.64.0.0/10
    return true; // Toute IP littérale directe est interdite pour un CDN média
  }

  return false;
}

export function isAllowedMediaHost(hostname: string): boolean {
  if (!hostname) return false;
  const lower = hostname.trim().toLowerCase();

  if (isPrivateOrReservedHost(lower)) {
    return false;
  }

  // Rejeter explicitement les domaines web principaux nus ou www
  if (
    lower === 'instagram.com' ||
    lower === 'www.instagram.com' ||
    lower === 'facebook.com' ||
    lower === 'www.facebook.com' ||
    lower === 'tiktok.com' ||
    lower === 'www.tiktok.com' ||
    lower === 'm.tiktok.com' ||
    lower === 'vm.tiktok.com' ||
    lower === 'vt.tiktok.com' ||
    lower === 'x.com' ||
    lower === 'www.x.com' ||
    lower === 'twitter.com' ||
    lower === 'www.twitter.com' ||
    lower === 'mobile.twitter.com' ||
    lower === 'm.twitter.com' ||
    lower === 't.co' ||
    lower === 'twimg.com' ||
    lower === 'www.twimg.com' ||
    lower === 'cdn.syndication.twimg.com'
  ) {
    return false;
  }

  // Autoriser strictement les 3 hôtes médias officiels de X (pas de wildcard *.twimg.com)
  if (ALLOWED_EXACT_MEDIA_HOSTS.has(lower)) {
    return true;
  }

  if (
    ALLOWED_CDN_WILDCARD_DOMAINS.some(
      (domain) => lower === domain || lower.endsWith(`.${domain}`)
    )
  ) {
    return true;
  }

  // Autoriser les sous-domaines CDN de tiktok.com (ex: v16-webapp-prime.tiktok.com, v19-webapp-prime.tiktok.com)
  if (
    SUBDOMAIN_ONLY_DOMAINS.some(
      (domain) =>
        lower.endsWith(`.${domain}`) &&
        (lower.includes('webapp') || lower.includes('cdn') || lower.startsWith('v'))
    )
  ) {
    return true;
  }

  return false;
}
