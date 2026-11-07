/**
 * Détection de plateforme et validation stricte d'URL pour VIDNEX.
 * Supporte TikTok (vidéos, photos, liens courts vm/vt) et Instagram (posts, reels, carrousels, tv).
 */

export type SupportedPlatform = 'tiktok' | 'instagram';

export interface DetectionResult {
  isValid: boolean;
  platform?: SupportedPlatform;
  cleanUrl: string;
  identifier?: string;
  isShortLink?: boolean;
}

export function detectUrl(rawUrl: string): DetectionResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, cleanUrl: '' };
  }

  let trimmed = rawUrl.trim();
  if (!trimmed) {
    return { isValid: false, cleanUrl: '' };
  }

  // Ajouter protocole si manquant
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { isValid: false, cleanUrl: '' };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');

  // 1. TikTok
  if (
    hostname === 'tiktok.com' ||
    hostname === 'm.tiktok.com' ||
    hostname === 'vm.tiktok.com' ||
    hostname === 'vt.tiktok.com' ||
    hostname.endsWith('.tiktok.com')
  ) {
    const isShortLink =
      hostname === 'vm.tiktok.com' ||
      hostname === 'vt.tiktok.com' ||
      parsed.pathname.startsWith('/t/');

    // Extraire l'ID numérique de vidéo si présent
    const videoIdMatch = parsed.pathname.match(/\/video\/([0-9]+)/i) ||
      parsed.pathname.match(/\/photo\/([0-9]+)/i);

    return {
      isValid: true,
      platform: 'tiktok',
      cleanUrl: parsed.toString(),
      identifier: videoIdMatch?.[1],
      isShortLink,
    };
  }

  // 2. Instagram
  if (
    hostname === 'instagram.com' ||
    hostname === 'instagr.am' ||
    hostname.endsWith('.instagram.com')
  ) {
    const path = parsed.pathname;
    const shortcodeMatch = path.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);

    if (shortcodeMatch) {
      return {
        isValid: true,
        platform: 'instagram',
        cleanUrl: `https://www.instagram.com/p/${shortcodeMatch[1]}/`,
        identifier: shortcodeMatch[1],
        isShortLink: false,
      };
    }
  }

  return { isValid: false, cleanUrl: parsed.toString() };
}
