/**
 * Configuration SEO centrale de VIDNEX.
 * Domaine réel détecté dans le dépôt (wrangler.jsonc, robots.txt, appConfig.ts) : https://vidnex.space
 */

export const SITE_URL = 'https://vidnex.space';
export const SITE_NAME = 'VIDNEX';
export const LANG = 'fr';
export const DEFAULT_OG_IMAGE = '/og-default.png';
export const CONTACT_EMAIL = 'compliance@vidnex.space';

/**
 * Construit une URL absolue propre à partir d'un chemin relatif, sans paramètres de requête.
 */
export function buildAbsoluteUrl(pathname: string): string {
  const cleanPath = (pathname || '/').split('?')[0].split('#')[0];
  if (!cleanPath || cleanPath === '/') {
    return `${SITE_URL}/`;
  }
  const normalized = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
}

export function getCanonicalUrl(pathname: string): string {
  const cleanPath = (pathname || '/').split('?')[0].split('#')[0];
  if (!cleanPath || cleanPath === '/') {
    return `${SITE_URL}/`;
  }
  const normalized = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  const trimmed = normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
  return `${SITE_URL}${trimmed}`;
}
