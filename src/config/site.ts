/**
 * Configuration SEO centrale de VIDNEX.
 * Domaine réel détecté dans le dépôt (wrangler.jsonc, robots.txt, appConfig.ts) : https://vidnex.space
 */

export const SITE_URL = 'https://vidnex.space';
export const SITE_NAME = 'VIDNEX';
export const LANG = 'fr';
export const THEME_COLOR = '#ea580c';
export const CONTACT_EMAIL = 'compliance@vidnex.space';

/**
 * Images d'aperçu OpenGraph / Twitter (1200x630 JPEG optimisés < 40 Ko avec hash de contenu)
 * générées par `scripts/generate-og.mjs` et commitées dans `public/og/`.
 */
export const OG_IMAGES = {
  default: '/og/og-default.922f9d8e.jpg',
  tiktok: '/og/og-tiktok.ff988d6c.jpg',
  instagram: '/og/og-instagram.ba9cd0f7.jpg',
  x: '/og/og-x.02de4119.jpg',
  facebook: '/og/og-facebook.0a720bf6.jpg',
  linkedin: '/og/og-linkedin.08770587.jpg',
} as const;

export const DEFAULT_OG_IMAGE = OG_IMAGES.default;
export const OG_IMAGE_WIDTH = '1200';
export const OG_IMAGE_HEIGHT = '630';
export const OG_IMAGE_TYPE = 'image/jpeg';

/**
 * Construit une URL absolue https://vidnex.space/... propre à partir d'un chemin relatif,
 * sans paramètres de requête ni ancre.
 */
export function buildAbsoluteUrl(pathname: string): string {
  if (/^https?:\/\//i.test(pathname)) {
    return pathname;
  }
  const cleanPath = (pathname || '/').split('?')[0].split('#')[0];
  if (!cleanPath || cleanPath === '/') {
    return `${SITE_URL}/`;
  }
  const normalized = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  const trimmed =
    normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
  return `${SITE_URL}${trimmed}`;
}

export function getCanonicalUrl(pathname: string): string {
  return buildAbsoluteUrl(pathname);
}

export function getOgImageUrlForPage(pageKey: string): string {
  if (
    pageKey === 'tiktok' ||
    pageKey === 'instagram' ||
    pageKey === 'x' ||
    pageKey === 'facebook' ||
    pageKey === 'linkedin'
  ) {
    return buildAbsoluteUrl(OG_IMAGES[pageKey]);
  }
  return buildAbsoluteUrl(OG_IMAGES.default);
}
