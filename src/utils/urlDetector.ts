export type PlatformId =
  | 'instagram'
  | 'tiktok'
  | 'x'
  | 'twitter'
  | 'youtube'
  | 'facebook'
  | 'linkedin'
  | 'snapchat';

export type MediaType =
  | 'reel'
  | 'post'
  | 'story'
  | 'highlight'
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

export type SampleLabelKey =
  | 'igReel'
  | 'tiktokVid'
  | 'xVid'
  | 'fbVid'
  | 'igDp'
  | 'linkedinDp';

export interface SampleLink {
  id: string;
  labelKey: SampleLabelKey;
  label: string;
  platform: PlatformId;
  subType: string;
  url: string;
}

export const SUPPORTED_BACKEND_PLATFORMS = new Set<PlatformId>([
  'instagram',
  'tiktok',
  'x',
  'twitter',
  'facebook',
  'linkedin',
]);

let runtimeEnabledPlatforms: {
  tiktok: boolean;
  instagram: boolean;
  x: boolean;
  facebook: boolean;
  linkedin: boolean;
} = {
  tiktok: true,
  instagram: true,
  x: true,
  facebook: true,
  linkedin: true,
};

export function setRuntimePlatformStates(states: {
  tiktok?: boolean;
  instagram?: boolean;
  x?: boolean;
  facebook?: boolean;
  linkedin?: boolean;
}): void {
  runtimeEnabledPlatforms = {
    tiktok:
      states.tiktok !== undefined
        ? states.tiktok
        : runtimeEnabledPlatforms.tiktok,
    instagram:
      states.instagram !== undefined
        ? states.instagram
        : runtimeEnabledPlatforms.instagram,
    x: states.x !== undefined ? states.x : runtimeEnabledPlatforms.x,
    facebook:
      states.facebook !== undefined
        ? states.facebook
        : runtimeEnabledPlatforms.facebook,
    linkedin:
      states.linkedin !== undefined
        ? states.linkedin
        : runtimeEnabledPlatforms.linkedin,
  };
}

export function isPlatformSupported(platform: PlatformId): boolean {
  if (!SUPPORTED_BACKEND_PLATFORMS.has(platform)) return false;
  if (platform === 'tiktok') return runtimeEnabledPlatforms.tiktok;
  if (platform === 'instagram') return runtimeEnabledPlatforms.instagram;
  if (platform === 'x' || platform === 'twitter') return runtimeEnabledPlatforms.x;
  if (platform === 'facebook') return runtimeEnabledPlatforms.facebook;
  if (platform === 'linkedin') return runtimeEnabledPlatforms.linkedin;
  return true;
}

export const SAMPLE_LINKS: SampleLink[] = [
  {
    id: 'ig-reel',
    labelKey: 'igReel',
    label: 'Reel Instagram',
    platform: 'instagram',
    subType: 'Reel',
    url: 'https://www.instagram.com/reel/C8x9kLmN2pQ/',
  },
  {
    id: 'tiktok-vid',
    labelKey: 'tiktokVid',
    label: 'Vidéo TikTok',
    platform: 'tiktok',
    subType: 'Video',
    url: 'https://www.tiktok.com/@tiktok/video/7106594312292453675',
  },
  {
    id: 'x-vid',
    labelKey: 'xVid',
    label: 'Vidéo X (Twitter)',
    platform: 'x',
    subType: 'Video',
    url: 'https://x.com/reactiive_/status/2040511285998313827',
  },
  {
    id: 'fb-vid',
    labelKey: 'fbVid',
    label: 'Vidéo Facebook',
    platform: 'facebook',
    subType: 'Video',
    url: 'https://www.facebook.com/facebook/videos/10153231379946729/',
  },
  {
    id: 'ig-dp',
    labelKey: 'igDp',
    label: 'Photo de profil Instagram',
    platform: 'instagram',
    subType: 'Profile',
    url: 'https://www.instagram.com/natgeo/',
  },
  {
    id: 'linkedin-dp',
    labelKey: 'linkedinDp',
    label: 'Photo de profil LinkedIn',
    platform: 'linkedin',
    subType: 'Profile',
    url: 'https://www.linkedin.com/in/satyanadella',
  },
];

const RESERVED_IG_PATHS = new Set([
  'p',
  'reel',
  'reels',
  'tv',
  'stories',
  'explore',
  'accounts',
  'direct',
  'about',
  'developer',
  'developers',
  'legal',
  'challenge',
  'graphql',
  'api',
  'login',
  'session',
  'privacy',
  'terms',
  'help',
  'press',
  'web',
  'tags',
  'locations',
  'directory',
  'share',
  's',
  'clips',
]);

const RESERVED_X_USERS = new Set([
  'home',
  'explore',
  'notifications',
  'messages',
  'settings',
  'search',
  'compose',
  'login',
  'signup',
  'tos',
  'privacy',
]);

const REJECTED_MIRROR_DOMAINS = [
  'fxtwitter.com',
  'vxtwitter.com',
  'fixupx.com',
  'fixvx.com',
  'twittpr.com',
  'nitter.net',
  'bettertwitfix.com',
];

export const LINKEDIN_ALLOWED_HOST_REGEX =
  /^(?:(?:www|[a-z]{2})\.)?linkedin\.com$/i;

export const LINKEDIN_ANY_HOST_REGEX =
  /(?:^|\.)linkedin\.com$|^(?:www\.)?lnkd\.in$/i;

export const LINKEDIN_PROFILE_PATH_REGEX = /^\/in\/([^/]+)\/?$/i;

export const LINKEDIN_SLUG_REGEX = /^[\p{L}\p{N}._-]{2,100}$/u;

export const LINKEDIN_PROFILE_URL_REGEX =
  /^(?:https?:\/\/)?(?:(?:www|[a-z]{2})\.)?linkedin\.com\/in\/([^/?#]+)\/?(?:\?[^#]*)?(?:#.*)?$/i;

export const RESERVED_LINKEDIN_SLUGS: ReadonlySet<string> = new Set([
  'login',
  'authwall',
  'checkpoint',
  'feed',
  'company',
  'posts',
  'jobs',
  'pulse',
  'school',
  'learning',
  'pub',
  'groups',
  'events',
  'help',
  'legal',
]);

export function normalizeLinkedInSlug(rawSegment: string): string | null {
  if (!rawSegment) return null;
  let decoded = rawSegment.trim();
  try {
    decoded = decodeURIComponent(decoded).trim();
  } catch {
    return null;
  }
  const normalizedSlug = decoded.toLowerCase();
  if (
    !normalizedSlug ||
    RESERVED_LINKEDIN_SLUGS.has(normalizedSlug) ||
    !LINKEDIN_SLUG_REGEX.test(normalizedSlug)
  ) {
    return null;
  }
  return normalizedSlug;
}

export function detectLinkedInUrl(rawInput: string): DetectedUrlInfo | null {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) return null;

  const urlWithProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsedLi: URL;
  try {
    parsedLi = new URL(urlWithProtocol);
  } catch {
    return null;
  }

  if (parsedLi.protocol !== 'http:' && parsedLi.protocol !== 'https:') {
    return null;
  }

  const liRawHost = parsedLi.hostname.toLowerCase();
  if (!LINKEDIN_ANY_HOST_REGEX.test(liRawHost)) {
    return null;
  }

  if (!LINKEDIN_ALLOWED_HOST_REGEX.test(liRawHost)) {
    return {
      isValid: false,
      platform: null,
      mediaType: null,
      badgeLabel: '',
      normalizedUrl: trimmed,
    };
  }

  const pathMatch = parsedLi.pathname.match(LINKEDIN_PROFILE_PATH_REGEX);
  if (!pathMatch || !pathMatch[1]) {
    return {
      isValid: false,
      platform: null,
      mediaType: null,
      badgeLabel: '',
      normalizedUrl: trimmed,
    };
  }

  const normalizedSlug = normalizeLinkedInSlug(pathMatch[1]);
  if (!normalizedSlug) {
    return {
      isValid: false,
      platform: null,
      mediaType: null,
      badgeLabel: '',
      normalizedUrl: trimmed,
    };
  }

  return {
    isValid: true,
    platform: 'linkedin',
    mediaType: 'profile',
    badgeLabel: `LinkedIn (@${normalizedSlug})`,
    identifier: normalizedSlug,
    normalizedUrl: `https://www.linkedin.com/in/${encodeURIComponent(normalizedSlug)}`,
  };
}

/**
 * Real-time deterministic parser for social media URLs and @handles.
 * Synchronized with `functions/_lib/detect.ts`.
 * Active backend extractors: Instagram, TikTok, X (Twitter), Facebook, LinkedIn.
 * Coming Soon: YouTube, Snapchat.
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
    const targetPlatform: PlatformId =
      preferredPlatform === 'tiktok' ? 'tiktok' : 'instagram';
    const cleanHandle =
      targetPlatform === 'instagram'
        ? directHandleMatch[1].toLowerCase()
        : directHandleMatch[1];

    if (
      targetPlatform === 'instagram' &&
      RESERVED_IG_PATHS.has(cleanHandle)
    ) {
      return {
        isValid: false,
        platform: null,
        mediaType: null,
        badgeLabel: '',
        normalizedUrl: trimmed,
      };
    }

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

  // Reject third-party X mirror domains (fxtwitter, vxtwitter, fixupx, etc.)
  try {
    const parsedHost = new URL(urlWithProtocol).hostname
      .toLowerCase()
      .replace(/^www\./, '');
    if (
      REJECTED_MIRROR_DOMAINS.some(
        (m) => parsedHost === m || parsedHost.endsWith(`.${m}`)
      ) ||
      parsedHost.includes('fxtwitter') ||
      parsedHost.includes('vxtwitter') ||
      parsedHost.includes('fixupx') ||
      parsedHost.includes('twittpr')
    ) {
      return {
        isValid: false,
        platform: null,
        mediaType: null,
        badgeLabel: '',
        normalizedUrl: trimmed,
      };
    }
  } catch {
    // Continue
  }

  // 1. INSTAGRAM DETECTION (instagram.com & instagr.am) — TEST HIGHLIGHTS & STORIES BEFORE REELS!
  const igHighlightMatch = urlWithProtocol.match(
    /^https?:\/\/(?:(?:www|m)\.)?(?:instagram\.com|instagr\.am)\/stories\/highlights\/([A-Za-z0-9_-]+)\/?/i
  );
  if (igHighlightMatch) {
    return {
      isValid: true,
      platform: 'instagram',
      mediaType: 'highlight',
      badgeLabel: `Instagram Highlight (${igHighlightMatch[1]})`,
      identifier: igHighlightMatch[1],
      normalizedUrl: `https://www.instagram.com/stories/highlights/${igHighlightMatch[1]}/`,
    };
  }

  const igHighlightShortMatch = urlWithProtocol.match(
    /^https?:\/\/(?:(?:www|m)\.)?(?:instagram\.com|instagr\.am)\/s\/([A-Za-z0-9_=-]{4,80})\/?(?:\?.*)?$/i
  );
  if (igHighlightShortMatch) {
    const rawCode = igHighlightShortMatch[1];
    let highlightId = rawCode;
    try {
      const b64 = rawCode.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = atob(b64);
      const hlDecoded = decoded.match(/^highlight:(\d+)$/i);
      if (hlDecoded) {
        highlightId = hlDecoded[1];
      }
    } catch {
      // keep rawCode
    }
    return {
      isValid: true,
      platform: 'instagram',
      mediaType: 'highlight',
      badgeLabel: `Instagram Highlight (${highlightId})`,
      identifier: highlightId,
      normalizedUrl: `https://www.instagram.com/stories/highlights/${highlightId}/`,
    };
  }

  const igStoryMatch = urlWithProtocol.match(
    /^https?:\/\/(?:(?:www|m)\.)?(?:instagram\.com|instagr\.am)\/stories\/([A-Za-z0-9._]{1,30})(?:\/([0-9A-Za-z_-]+))?\/?/i
  );
  if (igStoryMatch && igStoryMatch[1].toLowerCase() !== 'highlights') {
    const storyUser = igStoryMatch[1];
    const storyId = igStoryMatch[2];
    return {
      isValid: true,
      platform: 'instagram',
      mediaType: 'story',
      badgeLabel: `Instagram Story (@${storyUser})`,
      identifier: storyId ? `${storyUser}/${storyId}` : storyUser,
      normalizedUrl: storyId
        ? `https://www.instagram.com/stories/${storyUser}/${storyId}/`
        : `https://www.instagram.com/stories/${storyUser}/`,
    };
  }

  const igShareMatch = urlWithProtocol.match(
    /^https?:\/\/(?:(?:www|m)\.)?(?:instagram\.com|instagr\.am)\/share\/(?:(stories|s|reel|reels|p)\/)?([A-Za-z0-9_-]{3,60})\/?(?:\?.*)?$/i
  );
  if (igShareMatch) {
    const subKind = (igShareMatch[1] || '').toLowerCase();
    const shareCode = igShareMatch[2];
    const isStoryShare = subKind === 'stories' || subKind === 's';
    const isReelShare = subKind === 'reel' || subKind === 'reels';
    return {
      isValid: true,
      platform: 'instagram',
      mediaType: isStoryShare ? 'story' : isReelShare ? 'reel' : 'post',
      badgeLabel: isStoryShare
        ? 'Instagram Story'
        : isReelShare
        ? 'Instagram Reel'
        : 'Instagram Share Link',
      identifier: shareCode,
      normalizedUrl: urlWithProtocol.split('?')[0],
    };
  }

  const igReelMatch = urlWithProtocol.match(
    /^https?:\/\/(?:(?:www|m)\.)?(?:instagram\.com|instagr\.am)\/(?:reel|reels|tv)\/([A-Za-z0-9_-]+)/i
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

  const igPostMatch = urlWithProtocol.match(
    /^https?:\/\/(?:(?:www|m)\.)?(?:instagram\.com|instagr\.am)\/(?:([A-Za-z0-9._]{1,30})\/)?p\/([A-Za-z0-9_-]+)/i
  );
  if (igPostMatch && (!igPostMatch[1] || igPostMatch[1].toLowerCase() !== 'stories')) {
    return {
      isValid: true,
      platform: 'instagram',
      mediaType: 'post',
      badgeLabel: 'Instagram Post / Carousel',
      identifier: igPostMatch[2],
      normalizedUrl: `https://www.instagram.com/p/${igPostMatch[2]}/`,
    };
  }

  const igProfileMatch = urlWithProtocol.match(
    /^https?:\/\/(?:(?:www|m)\.)?(?:instagram\.com|instagr\.am)\/([A-Za-z0-9._]{1,30})\/?(?:\?.*)?$/i
  );
  if (igProfileMatch && !RESERVED_IG_PATHS.has(igProfileMatch[1].toLowerCase())) {
    const cleanUser = igProfileMatch[1].toLowerCase();
    return {
      isValid: true,
      platform: 'instagram',
      mediaType: 'profile',
      badgeLabel: `Instagram Profile (@${cleanUser})`,
      identifier: `@${cleanUser}`,
      normalizedUrl: `https://www.instagram.com/${cleanUser}/`,
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

  // 3. X / TWITTER DETECTION (x.com, twitter.com, mobile.twitter.com, m.twitter.com, t.co)
  const tcoShortMatch = urlWithProtocol.match(
    /^https?:\/\/(?:www\.)?t\.co\/([A-Za-z0-9]{4,25})\/?(?:\?.*)?$/i
  );
  if (tcoShortMatch) {
    return {
      isValid: true,
      platform: 'x',
      mediaType: 'video',
      badgeLabel: 'X (Twitter) Short Link',
      identifier: tcoShortMatch[1],
      normalizedUrl: `https://t.co/${tcoShortMatch[1]}`,
    };
  }

  const xIStatusMatch = urlWithProtocol.match(
    /^https?:\/\/(?:(?:www|mobile|m)\.)?(?:x\.com|twitter\.com)\/i\/(?:web\/)?status\/(\d+)(?:\/(?:video|photo)\/\d+)?\/?(?:\?.*)?$/i
  );
  if (xIStatusMatch) {
    return {
      isValid: true,
      platform: 'x',
      mediaType: 'video',
      badgeLabel: 'X (Twitter) Post',
      identifier: xIStatusMatch[1],
      normalizedUrl: `https://x.com/i/status/${xIStatusMatch[1]}`,
    };
  }

  const xPostMatch = urlWithProtocol.match(
    /^https?:\/\/(?:(?:www|mobile|m)\.)?(?:x\.com|twitter\.com)\/([A-Za-z0-9_]{1,30})\/status\/(\d+)(?:\/(?:video|photo)\/\d+)?\/?(?:\?.*)?$/i
  );
  if (xPostMatch && !RESERVED_X_USERS.has(xPostMatch[1].toLowerCase())) {
    return {
      isValid: true,
      platform: 'x',
      mediaType: 'video',
      badgeLabel: `X Post (@${xPostMatch[1]})`,
      identifier: xPostMatch[2],
      normalizedUrl: `https://x.com/${xPostMatch[1]}/status/${xPostMatch[2]}`,
    };
  }

  // 4. YOUTUBE DETECTION (Coming Soon)
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

  // 5. FACEBOOK DETECTION (facebook.com, www/m/web.facebook.com, fb.watch, fb.com)
  try {
    const parsedFb = new URL(urlWithProtocol);
    const fbHost = parsedFb.hostname.toLowerCase();
    const isFbDomain =
      fbHost === 'facebook.com' ||
      fbHost === 'www.facebook.com' ||
      fbHost === 'm.facebook.com' ||
      fbHost === 'web.facebook.com' ||
      fbHost === 'fb.watch' ||
      fbHost === 'www.fb.watch' ||
      fbHost === 'fb.com' ||
      fbHost === 'www.fb.com' ||
      fbHost === 'm.fb.com';

    if (isFbDomain) {
      const fbPath = parsedFb.pathname.replace(/\/+$/, '');
      const fbPathLower = fbPath.toLowerCase();

      // 5.0 TEST STORIES BEFORE REELS! (/stories/..., /story.php?story_fbid=..., /share/s/...)
      const fbStoriesMatch = fbPath.match(/^\/stories\/([^/?#]+)(?:\/([^/?#]+))?/i);
      if (fbStoriesMatch) {
        const storyId = fbStoriesMatch[2] || fbStoriesMatch[1];
        return {
          isValid: true,
          platform: 'facebook',
          mediaType: 'story',
          badgeLabel: 'Facebook Story',
          identifier: storyId,
          normalizedUrl: urlWithProtocol,
        };
      }

      if (
        fbPathLower === '/story.php' ||
        (fbPathLower === '/permalink.php' && parsedFb.searchParams.has('story_fbid'))
      ) {
        const storyFbid = (parsedFb.searchParams.get('story_fbid') || '').trim();
        if (storyFbid) {
          return {
            isValid: true,
            platform: 'facebook',
            mediaType: 'story',
            badgeLabel: 'Facebook Story',
            identifier: storyFbid,
            normalizedUrl: urlWithProtocol,
          };
        }
      }

      const fbShareStoryMatch = fbPath.match(/^\/share\/s\/([A-Za-z0-9_-]{3,60})$/i);
      if (fbShareStoryMatch) {
        return {
          isValid: true,
          platform: 'facebook',
          mediaType: 'story',
          badgeLabel: 'Facebook Story',
          identifier: fbShareStoryMatch[1],
          normalizedUrl: `https://www.facebook.com/share/s/${fbShareStoryMatch[1]}/`,
        };
      }

      // Reject photos and lives
      if (
        fbPathLower.startsWith('/photo') ||
        fbPathLower.startsWith('/photos') ||
        fbPathLower.includes('/photos/') ||
        fbPathLower.startsWith('/stories') ||
        fbPathLower.includes('/live/') ||
        fbPathLower.endsWith('/live')
      ) {
        return {
          isValid: false,
          platform: null,
          mediaType: null,
          badgeLabel: '',
          normalizedUrl: trimmed,
        };
      }

      // 5a. fb.watch/{code}
      if (fbHost === 'fb.watch' || fbHost === 'www.fb.watch') {
        const watchShort = fbPath.match(/^\/([A-Za-z0-9_-]{3,40})$/);
        if (watchShort) {
          return {
            isValid: true,
            platform: 'facebook',
            mediaType: 'video',
            badgeLabel: 'Facebook Watch Link',
            identifier: watchShort[1],
            normalizedUrl: `https://fb.watch/${watchShort[1]}/`,
          };
        }
      }

      // 5b. /share/v/{code} or /share/r/{code} or /share/{code}
      const fbShareMatch = fbPath.match(/^\/share\/(?:(v|r)\/)?([A-Za-z0-9_-]{3,60})$/i);
      if (fbShareMatch) {
        const shareKind = (fbShareMatch[1] || 'v').toLowerCase();
        const shareCode = fbShareMatch[2];
        const cleanSharePath = fbShareMatch[1]
          ? `/share/${shareKind}/${shareCode}/`
          : `/share/${shareCode}/`;
        return {
          isValid: true,
          platform: 'facebook',
          mediaType: shareKind === 'r' ? 'reel' : 'video',
          badgeLabel: shareKind === 'r' ? 'Facebook Reel' : 'Facebook Video',
          identifier: shareCode,
          normalizedUrl: `https://www.facebook.com${cleanSharePath}`,
        };
      }

      // 5c. /reel/{id} or /reels/{id}
      const fbReelMatch = fbPath.match(/^\/reels?\/([0-9A-Za-z_-]{5,45})$/i);
      if (fbReelMatch) {
        return {
          isValid: true,
          platform: 'facebook',
          mediaType: 'reel',
          badgeLabel: 'Facebook Reel',
          identifier: fbReelMatch[1],
          normalizedUrl: `https://www.facebook.com/reel/${fbReelMatch[1]}`,
        };
      }

      // 5d. /watch/?v={id} or /watch?v={id} or /video.php?v={id}
      if (fbPathLower === '/watch' || fbPathLower === '/video.php') {
        const vId = (parsedFb.searchParams.get('v') || '').trim();
        if (/^\d{5,30}$/.test(vId)) {
          return {
            isValid: true,
            platform: 'facebook',
            mediaType: 'video',
            badgeLabel: 'Facebook Watch Video',
            identifier: vId,
            normalizedUrl:
              fbPathLower === '/video.php'
                ? `https://www.facebook.com/video.php?v=${vId}`
                : `https://www.facebook.com/watch/?v=${vId}`,
          };
        }
      }

      // 5e. /{page}/videos/{id} or /{page}/videos/{titre}/{id}
      const fbPageVideoMatch = fbPath.match(
        /^\/([^/]+)\/videos\/(?:[^/]+\/)?(\d{5,30})$/i
      );
      if (fbPageVideoMatch) {
        return {
          isValid: true,
          platform: 'facebook',
          mediaType: 'video',
          badgeLabel: 'Facebook Video',
          identifier: fbPageVideoMatch[2],
          normalizedUrl: `https://www.facebook.com/${fbPageVideoMatch[1]}/videos/${fbPageVideoMatch[2]}/`,
        };
      }
    }
  } catch {
    // Continue
  }

  // 5B. LINKEDIN PUBLIC PROFILE DETECTION (linkedin.com/in/{slug} with www. or country subdomain)
  const linkedInDetected = detectLinkedInUrl(trimmed);
  if (linkedInDetected) {
    return linkedInDetected;
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

export function getDetectedUrlInfo(
  rawInput: string,
  preferredPlatform: PlatformId = 'instagram'
): DetectedUrlInfo {
  return detectMediaUrl(rawInput, preferredPlatform);
}

