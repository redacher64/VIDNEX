export type PlatformId =
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'twitter'
  | 'facebook'
  | 'snapchat';

export type MediaType =
  | 'reel'
  | 'post'
  | 'story'
  | 'profile'
  | 'video'
  | 'slideshow'
  | 'short'
  | 'spotlight';

export interface DetectedUrlInfo {
  isValid: boolean;
  isComingSoon?: boolean;
  platform: PlatformId | null;
  mediaType: MediaType | null;
  badgeLabel: string;
  identifier?: string;
  normalizedUrl: string;
}

export interface SampleLink {
  id: string;
  label: string;
  platform: PlatformId;
  subType: string;
  url: string;
}

export const SUPPORTED_BACKEND_PLATFORMS = new Set<PlatformId>([
  'instagram',
  'tiktok',
]);

export function isPlatformSupported(platform: PlatformId): boolean {
  return SUPPORTED_BACKEND_PLATFORMS.has(platform);
}

export const SAMPLE_LINKS: SampleLink[] = [
  {
    id: 'ig-reel',
    label: 'IG Reel 1080p',
    platform: 'instagram',
    subType: 'Reel',
    url: 'https://www.instagram.com/reel/C8x9kLmN2pQ/',
  },
  {
    id: 'ig-dp',
    label: 'IG Profile HD DP',
    platform: 'instagram',
    subType: 'Profile',
    url: 'https://www.instagram.com/natgeo/',
  },
  {
    id: 'tiktok-vid',
    label: 'TikTok No-WM',
    platform: 'tiktok',
    subType: 'Video',
    url: 'https://www.tiktok.com/@tiktok/video/7106594312292453675',
  },
  {
    id: 'ig-carousel',
    label: 'IG Carousel',
    platform: 'instagram',
    subType: 'Carousel',
    url: 'https://www.instagram.com/p/C9aBcDeFgHi/',
  },
  {
    id: 'tiktok-dp',
    label: 'TikTok Profile DP',
    platform: 'tiktok',
    subType: 'Profile',
    url: 'https://www.tiktok.com/@tiktok',
  },
];

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

/**
 * Real-time deterministic parser for social media URLs and @handles.
 * Synchronized with `functions/_lib/detect.ts`.
 * Platforms without active backend extractors (YouTube, X, Facebook, Snapchat)
 * are recognized with `isComingSoon: true` and `isValid: false`.
 */
export function detectMediaUrl(
  rawInput: string,
  preferredPlatform: PlatformId = 'instagram'
): DetectedUrlInfo {
  const trimmed = rawInput.trim();

  if (!trimmed) {
    return {
      isValid: false,
      platform: null,
      mediaType: null,
      badgeLabel: '',
      normalizedUrl: '',
    };
  }

  // 0. DIRECT @USERNAME HANDLE DETECTION (Instagram & TikTok)
  const directHandleMatch = trimmed.match(/^@([A-Za-z0-9._]{1,30})$/);
  if (directHandleMatch) {
    const cleanHandle = directHandleMatch[1];
    const targetPlatform: PlatformId =
      preferredPlatform === 'tiktok' ? 'tiktok' : 'instagram';

    return {
      isValid: true,
      platform: targetPlatform,
      mediaType: 'profile',
      badgeLabel:
        targetPlatform === 'tiktok'
          ? `TikTok Profile (@${cleanHandle})`
          : `Instagram Profile (@${cleanHandle})`,
      identifier: `@${cleanHandle}`,
      normalizedUrl:
        targetPlatform === 'tiktok'
          ? `https://www.tiktok.com/@${cleanHandle}`
          : `https://www.instagram.com/${cleanHandle}/`,
    };
  }

  // Allow user to paste with or without protocol
  const urlWithProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  // 1. INSTAGRAM DETECTION (instagram.com & instagr.am)
  const igReelMatch = urlWithProtocol.match(
    /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am)\/(?:reel|reels|tv)\/([A-Za-z0-9_-]+)/i
  );
  if (igReelMatch) {
    return {
      isValid: true,
      platform: 'instagram',
      mediaType: 'reel',
      badgeLabel: 'Instagram Reel',
      identifier: igReelMatch[1],
      normalizedUrl: `https://www.instagram.com/p/${igReelMatch[1]}/`,
    };
  }

  const igStoryMatch = urlWithProtocol.match(
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/stories\/([A-Za-z0-9._]+)(?:\/([0-9]+))?/i
  );
  if (igStoryMatch) {
    return {
      isValid: true,
      platform: 'instagram',
      mediaType: 'story',
      badgeLabel: `Instagram Story (@${igStoryMatch[1]})`,
      identifier: igStoryMatch[1],
      normalizedUrl: urlWithProtocol,
    };
  }

  const igPostMatch = urlWithProtocol.match(
    /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am)\/p\/([A-Za-z0-9_-]+)/i
  );
  if (igPostMatch) {
    return {
      isValid: true,
      platform: 'instagram',
      mediaType: 'post',
      badgeLabel: 'Instagram Post / Carousel',
      identifier: igPostMatch[1],
      normalizedUrl: `https://www.instagram.com/p/${igPostMatch[1]}/`,
    };
  }

  const igProfileMatch = urlWithProtocol.match(
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:\?.*)?$/i
  );
  if (igProfileMatch && !RESERVED_IG_PATHS.has(igProfileMatch[1].toLowerCase())) {
    return {
      isValid: true,
      platform: 'instagram',
      mediaType: 'profile',
      badgeLabel: `Instagram Profile (@${igProfileMatch[1]})`,
      identifier: `@${igProfileMatch[1]}`,
      normalizedUrl: `https://www.instagram.com/${igProfileMatch[1]}/`,
    };
  }

  // 2. TIKTOK DETECTION (www, m, vm, vt)
  const ttPhotoMatch = urlWithProtocol.match(
    /(?:https?:\/\/)?(?:(?:www|m)\.)?tiktok\.com\/@([A-Za-z0-9._]+)\/photo\/([0-9]+)/i
  );
  if (ttPhotoMatch) {
    return {
      isValid: true,
      platform: 'tiktok',
      mediaType: 'slideshow',
      badgeLabel: 'TikTok Photo Slideshow',
      identifier: ttPhotoMatch[2],
      normalizedUrl: urlWithProtocol,
    };
  }

  const ttVideoMatch = urlWithProtocol.match(
    /(?:https?:\/\/)?(?:(?:www|m|vm|vt)\.)?tiktok\.com\/(?:@([A-Za-z0-9._]+)\/video\/([0-9]+)|t\/([A-Za-z0-9_-]+)|([A-Za-z0-9_-]+))/i
  );
  if (ttVideoMatch) {
    const ttProfileOnly = urlWithProtocol.match(
      /(?:https?:\/\/)?(?:(?:www|m)\.)?tiktok\.com\/@([A-Za-z0-9._]+)\/?(?:\?.*)?$/i
    );
    if (ttProfileOnly) {
      return {
        isValid: true,
        platform: 'tiktok',
        mediaType: 'profile',
        badgeLabel: `TikTok Profile (@${ttProfileOnly[1]})`,
        identifier: `@${ttProfileOnly[1]}`,
        normalizedUrl: `https://www.tiktok.com/@${ttProfileOnly[1]}`,
      };
    }

    return {
      isValid: true,
      platform: 'tiktok',
      mediaType: 'video',
      badgeLabel: 'TikTok Video',
      identifier: ttVideoMatch[2] || ttVideoMatch[3] || ttVideoMatch[4],
      normalizedUrl: urlWithProtocol,
    };
  }

  // 3. YOUTUBE DETECTION (Coming Soon)
  const ytShortsMatch = urlWithProtocol.match(
    /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/i
  );
  if (ytShortsMatch) {
    return {
      isValid: false,
      isComingSoon: true,
      platform: 'youtube',
      mediaType: 'short',
      badgeLabel: 'YouTube Short (Soon)',
      identifier: ytShortsMatch[1],
      normalizedUrl: urlWithProtocol,
    };
  }

  const ytVideoMatch = urlWithProtocol.match(
    /(?:https?:\/\/)?(?:(?:www|m)\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/i
  );
  if (ytVideoMatch) {
    return {
      isValid: false,
      isComingSoon: true,
      platform: 'youtube',
      mediaType: 'video',
      badgeLabel: 'YouTube Video (Soon)',
      identifier: ytVideoMatch[1],
      normalizedUrl: urlWithProtocol,
    };
  }

  // 4. X / TWITTER DETECTION (Coming Soon)
  const xPostMatch = urlWithProtocol.match(
    /(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/([A-Za-z0-9_]+)\/status\/([0-9]+)/i
  );
  if (xPostMatch) {
    return {
      isValid: false,
      isComingSoon: true,
      platform: 'twitter',
      mediaType: 'video',
      badgeLabel: `X Post (@${xPostMatch[1]}) (Soon)`,
      identifier: xPostMatch[2],
      normalizedUrl: urlWithProtocol,
    };
  }

  // 5. FACEBOOK DETECTION (Coming Soon)
  const fbReelMatch = urlWithProtocol.match(
    /(?:https?:\/\/)?(?:www\.|m\.|web\.)?facebook\.com\/reel\/([0-9]+)/i
  );
  if (fbReelMatch) {
    return {
      isValid: false,
      isComingSoon: true,
      platform: 'facebook',
      mediaType: 'reel',
      badgeLabel: 'Facebook Reel (Soon)',
      identifier: fbReelMatch[1],
      normalizedUrl: urlWithProtocol,
    };
  }

  const fbVideoMatch = urlWithProtocol.match(
    /(?:https?:\/\/)?(?:www\.|m\.|web\.|fb\.watch)?(?:facebook\.com\/(?:watch\/?\?v=|.*\/videos\/)|fb\.watch\/)([A-Za-z0-9_-]+)/i
  );
  if (fbVideoMatch) {
    return {
      isValid: false,
      isComingSoon: true,
      platform: 'facebook',
      mediaType: 'video',
      badgeLabel: 'Facebook Video (Soon)',
      identifier: fbVideoMatch[1],
      normalizedUrl: urlWithProtocol,
    };
  }

  // 6. SNAPCHAT DETECTION (Coming Soon)
  const snapSpotlightMatch = urlWithProtocol.match(
    /(?:https?:\/\/)?(?:www\.|story\.)?snapchat\.com\/(?:spotlight\/([A-Za-z0-9_-]+)|s\/([A-Za-z0-9_:-]+)|add\/([A-Za-z0-9._-]+))/i
  );
  if (snapSpotlightMatch) {
    const isSpotlight = urlWithProtocol.toLowerCase().includes('/spotlight/');
    return {
      isValid: false,
      isComingSoon: true,
      platform: 'snapchat',
      mediaType: isSpotlight ? 'spotlight' : 'story',
      badgeLabel: isSpotlight ? 'Snapchat Spotlight (Soon)' : 'Snapchat Story (Soon)',
      identifier:
        snapSpotlightMatch[1] || snapSpotlightMatch[2] || snapSpotlightMatch[3],
      normalizedUrl: urlWithProtocol,
    };
  }

  return {
    isValid: false,
    platform: null,
    mediaType: null,
    badgeLabel: '',
    normalizedUrl: trimmed,
  };
}
