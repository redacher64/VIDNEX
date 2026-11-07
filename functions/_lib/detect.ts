/**
 * Détection de plateforme et validation stricte d'URL pour VIDNEX.
 * Supporte :
 * - TikTok : vidéos, carrousels photos, liens courts (vm/vt.tiktok.com), et profils (@username)
 * - Instagram : Reels, posts, carrousels, IGTV, Stories, et profils (@username)
 */

export type SupportedPlatform = 'tiktok' | 'instagram';
export type DetectedContentKind = 'video' | 'post' | 'profile' | 'story';

export interface DetectionResult {
  isValid: boolean;
  platform?: SupportedPlatform;
  kind?: DetectedContentKind;
  cleanUrl: string;
  identifier?: string;
  isShortLink?: boolean;
}

const RESERVED_IG_PATHS = new Set([
  'explore',
  'direct',
  'accounts',
  'reels',
  'stories',
  'p',
  'reel',
  'tv',
  'about',
  'legal',
  'developer',
]);

export function detectUrl(
  rawUrl: string,
  preferredPlatform: SupportedPlatform = 'instagram'
): DetectionResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, cleanUrl: '' };
  }

  let trimmed = rawUrl.trim();
  if (!trimmed) {
    return { isValid: false, cleanUrl: '' };
  }

  // 0. Détection directe d'un pseudo @username
  const handleMatch = trimmed.match(/^@([A-Za-z0-9._]{1,30})$/);
  if (handleMatch) {
    const handle = handleMatch[1];
    const platform = preferredPlatform === 'tiktok' ? 'tiktok' : 'instagram';
    return {
      isValid: true,
      platform,
      kind: 'profile',
      cleanUrl:
        platform === 'tiktok'
          ? `https://www.tiktok.com/@${handle}`
          : `https://www.instagram.com/${handle}/`,
      identifier: handle,
      isShortLink: false,
    };
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

    const videoIdMatch =
      parsed.pathname.match(/\/video\/([0-9]+)/i) ||
      parsed.pathname.match(/\/photo\/([0-9]+)/i);

    const profileOnlyMatch = parsed.pathname.match(/^\/@([A-Za-z0-9._]+)\/?$/i);
    if (profileOnlyMatch && !videoIdMatch) {
      return {
        isValid: true,
        platform: 'tiktok',
        kind: 'profile',
        cleanUrl: `https://www.tiktok.com/@${profileOnlyMatch[1]}`,
        identifier: profileOnlyMatch[1],
        isShortLink: false,
      };
    }

    return {
      isValid: true,
      platform: 'tiktok',
      kind: 'video',
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

    // Post, Reel, Carrousel ou IGTV
    const shortcodeMatch = path.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
    if (shortcodeMatch) {
      return {
        isValid: true,
        platform: 'instagram',
        kind: 'post',
        cleanUrl: `https://www.instagram.com/p/${shortcodeMatch[1]}/`,
        identifier: shortcodeMatch[1],
        isShortLink: false,
      };
    }

    // Story Instagram
    const storyMatch = path.match(/\/stories\/([A-Za-z0-9._]+)(?:\/([0-9]+))?/i);
    if (storyMatch) {
      return {
        isValid: true,
        platform: 'instagram',
        kind: 'story',
        cleanUrl: parsed.toString(),
        identifier: storyMatch[1],
        isShortLink: false,
      };
    }

    // Profil Instagram (/username/)
    const profileMatch = path.match(/^\/([A-Za-z0-9._]{1,30})\/?$/i);
    if (profileMatch && !RESERVED_IG_PATHS.has(profileMatch[1].toLowerCase())) {
      return {
        isValid: true,
        platform: 'instagram',
        kind: 'profile',
        cleanUrl: `https://www.instagram.com/${profileMatch[1]}/`,
        identifier: profileMatch[1],
        isShortLink: false,
      };
    }
  }

  return { isValid: false, cleanUrl: parsed.toString() };
}
