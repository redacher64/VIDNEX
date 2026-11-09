/**
 * Détecteur et normaliseur d'URL strict pour les plateformes supportées :
 * - TikTok (`tiktok.com`, `vm.tiktok.com`, `vt.tiktok.com`, `m.tiktok.com`)
 * - Instagram (`instagram.com`, `instagr.am`)
 * - X / Twitter (`x.com`, `twitter.com`, `mobile.twitter.com`, `m.twitter.com`, `t.co`)
 *
 * Rejette explicitement les domaines miroirs tiers (`fxtwitter`, `vxtwitter`, `fixupx`, etc.)
 * et toute URL non conforme avec `isValid: false` (qui renvoie `UNSUPPORTED_URL` · HTTP 400).
 */

export type SupportedPlatform = 'tiktok' | 'instagram' | 'x';
export type ContentKind = 'video' | 'slideshow' | 'reel' | 'post' | 'story' | 'profile';

export interface DetectionResult {
  isValid: boolean;
  platform: SupportedPlatform | null;
  kind: ContentKind | null;
  identifier?: string;
  cleanUrl: string;
  isShortLink?: boolean;
}

const RESERVED_IG_SEGMENTS = new Set([
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
  'challenge',
  'graphql',
  'api',
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

const TRACKING_PARAMS = [
  'igshid',
  'igsh',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  '_r',
  '_t',
  'is_from_webapp',
  'sender_device',
  'web_id',
  'checksum',
  'tt_from',
  'share_item_id',
  'share_app_id',
  's',
  't',
];

export function stripTrackingParams(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    for (const key of TRACKING_PARAMS) {
      parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

export function detectUrl(
  rawInput: string,
  preferredPlatform: SupportedPlatform = 'instagram'
): DetectionResult {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    return {
      isValid: false,
      platform: null,
      kind: null,
      identifier: undefined,
      cleanUrl: '',
    };
  }

  // 0. Support direct @username pour les outils Photo de Profil (DP) Instagram & TikTok
  const handleMatch = trimmed.match(/^@([A-Za-z0-9._]{1,30})$/);
  if (handleMatch) {
    const username = handleMatch[1];
    const targetPlatform: SupportedPlatform =
      preferredPlatform === 'tiktok' ? 'tiktok' : 'instagram';
    return {
      isValid: true,
      platform: targetPlatform,
      kind: 'profile',
      identifier: username,
      cleanUrl:
        targetPlatform === 'tiktok'
          ? `https://www.tiktok.com/@${username}`
          : `https://www.instagram.com/${username}/`,
    };
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return {
      isValid: false,
      platform: null,
      kind: null,
      identifier: undefined,
      cleanUrl: trimmed,
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      isValid: false,
      platform: null,
      kind: null,
      identifier: undefined,
      cleanUrl: trimmed,
    };
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const pathname = parsed.pathname;

  // Rejet explicite des domaines miroirs tiers (fxtwitter, vxtwitter, etc.)
  if (
    REJECTED_MIRROR_DOMAINS.some(
      (mirror) => host === mirror || host.endsWith(`.${mirror}`)
    ) ||
    host.includes('fxtwitter') ||
    host.includes('vxtwitter') ||
    host.includes('fixupx') ||
    host.includes('twittpr')
  ) {
    return {
      isValid: false,
      platform: null,
      kind: null,
      identifier: undefined,
      cleanUrl: trimmed,
    };
  }

  // =========================================================================
  // 1. INSTAGRAM (instagram.com, instagr.am)
  // =========================================================================
  if (
    host === 'instagram.com' ||
    host === 'm.instagram.com' ||
    host === 'instagr.am'
  ) {
    // Reel / Reels / IGTV : /reel/{code} ou /reels/{code} ou /tv/{code}
    const reelMatch = pathname.match(/^\/(?:reel|reels|tv)\/([A-Za-z0-9_-]{5,40})/i);
    if (reelMatch) {
      const shortcode = reelMatch[1];
      return {
        isValid: true,
        platform: 'instagram',
        kind: 'reel',
        identifier: shortcode,
        cleanUrl: `https://www.instagram.com/p/${shortcode}/`,
      };
    }

    // Publication / Carrousel : /p/{code} ou /{username}/p/{code} ou /{username}/reel/{code}
    const postMatch = pathname.match(
      /^\/(?:[A-Za-z0-9._]{1,30}\/)?(?:p|reel|reels)\/([A-Za-z0-9_-]{5,40})/i
    );
    if (postMatch) {
      const shortcode = postMatch[1];
      return {
        isValid: true,
        platform: 'instagram',
        kind: 'post',
        identifier: shortcode,
        cleanUrl: `https://www.instagram.com/p/${shortcode}/`,
      };
    }

    // Story : /stories/{username}/{storyId?}
    const storyMatch = pathname.match(
      /^\/stories\/([A-Za-z0-9._]{1,30})(?:\/([0-9]+))?/i
    );
    if (storyMatch) {
      const username = storyMatch[1];
      return {
        isValid: true,
        platform: 'instagram',
        kind: 'story',
        identifier: username,
        cleanUrl: `https://www.instagram.com/stories/${username}/`,
      };
    }

    // Profil : /{username}/
    const profileMatch = pathname.match(/^\/([A-Za-z0-9._]{1,30})\/?$/);
    if (
      profileMatch &&
      !RESERVED_IG_SEGMENTS.has(profileMatch[1].toLowerCase())
    ) {
      const username = profileMatch[1];
      return {
        isValid: true,
        platform: 'instagram',
        kind: 'profile',
        identifier: username,
        cleanUrl: `https://www.instagram.com/${username}/`,
      };
    }

    return {
      isValid: false,
      platform: null,
      kind: null,
      identifier: undefined,
      cleanUrl: trimmed,
    };
  }

  // =========================================================================
  // 2. TIKTOK (tiktok.com, m.tiktok.com, vm.tiktok.com, vt.tiktok.com)
  // =========================================================================
  if (
    host === 'tiktok.com' ||
    host === 'm.tiktok.com' ||
    host === 'vm.tiktok.com' ||
    host === 'vt.tiktok.com'
  ) {
    // Liens courts vm.tiktok.com/{code} ou vt.tiktok.com/{code} ou tiktok.com/t/{code}
    if (host === 'vm.tiktok.com' || host === 'vt.tiktok.com') {
      const shortMatch = pathname.match(/^\/([A-Za-z0-9_-]{4,35})\/?$/);
      if (shortMatch) {
        return {
          isValid: true,
          platform: 'tiktok',
          kind: 'video',
          identifier: shortMatch[1],
          cleanUrl: `https://${host}/${shortMatch[1]}/`,
          isShortLink: true,
        };
      }
    }

    const tShortMatch = pathname.match(/^\/t\/([A-Za-z0-9_-]{4,35})\/?$/);
    if (tShortMatch) {
      return {
        isValid: true,
        platform: 'tiktok',
        kind: 'video',
        identifier: tShortMatch[1],
        cleanUrl: `https://www.tiktok.com/t/${tShortMatch[1]}/`,
        isShortLink: true,
      };
    }

    // Carrousel Photo Mode : /@user/photo/{id}
    const photoMatch = pathname.match(/^\/@([A-Za-z0-9._-]+)\/photo\/([0-9]{10,25})/);
    if (photoMatch) {
      return {
        isValid: true,
        platform: 'tiktok',
        kind: 'slideshow',
        identifier: photoMatch[2],
        cleanUrl: `https://www.tiktok.com/@${photoMatch[1]}/photo/${photoMatch[2]}`,
      };
    }

    // Vidéo classique : /@user/video/{id} ou /v/{id}
    const videoMatch =
      pathname.match(/^\/@([A-Za-z0-9._-]+)\/video\/([0-9]{10,25})/) ||
      pathname.match(/^\/(v)\/([0-9]{10,25})/);
    if (videoMatch) {
      const videoId = videoMatch[2];
      const userPart = videoMatch[1] === 'v' ? 'tiktok' : videoMatch[1];
      return {
        isValid: true,
        platform: 'tiktok',
        kind: 'video',
        identifier: videoId,
        cleanUrl: `https://www.tiktok.com/@${userPart}/video/${videoId}`,
      };
    }

    // Profil TikTok : /@user
    const profileMatch = pathname.match(/^\/@([A-Za-z0-9._-]{1,35})\/?$/);
    if (profileMatch) {
      return {
        isValid: true,
        platform: 'tiktok',
        kind: 'profile',
        identifier: profileMatch[1],
        cleanUrl: `https://www.tiktok.com/@${profileMatch[1]}`,
      };
    }

    // Lien court racine tiktok.com/{shortCode}
    const rootShortMatch = pathname.match(/^\/([A-Za-z0-9_-]{6,20})\/?$/);
    if (rootShortMatch) {
      return {
        isValid: true,
        platform: 'tiktok',
        kind: 'video',
        identifier: rootShortMatch[1],
        cleanUrl: stripTrackingParams(parsed.toString()),
        isShortLink: true,
      };
    }
  }

  // =========================================================================
  // 3. X / TWITTER (x.com, twitter.com, mobile.twitter.com, m.twitter.com, t.co)
  // =========================================================================
  if (host === 't.co') {
    const tcoMatch = pathname.match(/^\/([A-Za-z0-9]{4,25})\/?$/);
    if (tcoMatch) {
      return {
        isValid: true,
        platform: 'x',
        kind: 'post',
        identifier: tcoMatch[1],
        cleanUrl: `https://t.co/${tcoMatch[1]}`,
        isShortLink: true,
      };
    }
    return {
      isValid: false,
      platform: null,
      kind: null,
      identifier: undefined,
      cleanUrl: trimmed,
    };
  }

  if (
    host === 'x.com' ||
    host === 'twitter.com' ||
    host === 'mobile.twitter.com' ||
    host === 'm.twitter.com' ||
    host === 'mobile.x.com'
  ) {
    // Chemins acceptés :
    // - /{user}/status/{id}
    // - /{user}/status/{id}/video/{N}
    // - /{user}/status/{id}/photo/{N}
    // - /i/status/{id} (et /i/status/{id}/video/{N} ou /photo/{N})
    // - /i/web/status/{id}
    const iStatusMatch = pathname.match(
      /^\/i\/(?:web\/)?status\/(\d+)(?:\/(?:video|photo)\/\d+)?\/?$/i
    );
    if (iStatusMatch) {
      const tweetId = iStatusMatch[1];
      return {
        isValid: true,
        platform: 'x',
        kind: 'post',
        identifier: tweetId,
        cleanUrl: `https://x.com/i/status/${tweetId}`,
      };
    }

    const userStatusMatch = pathname.match(
      /^\/([A-Za-z0-9_]{1,30})\/status\/(\d+)(?:\/(?:video|photo)\/\d+)?\/?$/i
    );
    if (userStatusMatch) {
      const user = userStatusMatch[1];
      const tweetId = userStatusMatch[2];
      if (!RESERVED_X_USERS.has(user.toLowerCase())) {
        return {
          isValid: true,
          platform: 'x',
          kind: 'post',
          identifier: tweetId,
          cleanUrl: `https://x.com/${user}/status/${tweetId}`,
        };
      }
    }

    return {
      isValid: false,
      platform: null,
      kind: null,
      identifier: undefined,
      cleanUrl: trimmed,
    };
  }

  return {
    isValid: false,
    platform: null,
    kind: null,
    identifier: undefined,
    cleanUrl: trimmed,
  };
}
