/**
 * Détecteur et normaliseur d'URL strict pour les plateformes supportées :
 * - TikTok (`tiktok.com`, `vm.tiktok.com`, `vt.tiktok.com`, `m.tiktok.com`)
 * - Instagram (`instagram.com`, `instagr.am`)
 * - X / Twitter (`x.com`, `twitter.com`, `mobile.twitter.com`, `m.twitter.com`, `t.co`)
 *
 * Rejette explicitement les domaines miroirs tiers (`fxtwitter`, `vxtwitter`, `fixupx`, etc.)
 * et toute URL non conforme avec `isValid: false` (qui renvoie `UNSUPPORTED_URL` · HTTP 400).
 */

export type SupportedPlatform = 'tiktok' | 'instagram' | 'x' | 'facebook' | 'linkedin';
export type ContentKind =
  | 'video'
  | 'photo'
  | 'slideshow'
  | 'reel'
  | 'post'
  | 'story'
  | 'highlight'
  | 'profile';

export type LogContentKind =
  | 'video'
  | 'reel'
  | 'photo'
  | 'carousel'
  | 'profile'
  | 'story'
  | 'highlight'
  | 'audio'
  | 'short_link';

export interface DetectionResult {
  isValid: boolean;
  unsupportedReason?: 'FB_PHOTO_UNSUPPORTED';
  platform: SupportedPlatform | null;
  kind: ContentKind | null;
  contentKind?: LogContentKind;
  content_kind?: LogContentKind;
  identifier?: string;
  cleanUrl: string;
  isShortLink?: boolean;
  isLoginRedirect?: boolean;
}

const ALLOWED_FACEBOOK_HOSTS = new Set([
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'web.facebook.com',
  'fb.watch',
  'www.fb.watch',
  'fb.com',
  'www.fb.com',
  'm.fb.com',
]);

export function isAllowedFacebookHost(hostname: string): boolean {
  return ALLOWED_FACEBOOK_HOSTS.has(hostname.trim().toLowerCase());
}

const RESERVED_LINKEDIN_SLUGS = new Set([
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
  const lowered = decoded.toLowerCase();
  if (!lowered || lowered.length < 2 || lowered.length > 100) return null;
  if (RESERVED_LINKEDIN_SLUGS.has(lowered)) return null;
  if (!/^[\p{L}\p{N}._-]+$/u.test(lowered)) return null;
  return lowered;
}

const RESERVED_IG_SEGMENTS = new Set([
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
    const targetPlatform: SupportedPlatform =
      preferredPlatform === 'tiktok' ? 'tiktok' : 'instagram';
    const username =
      targetPlatform === 'instagram'
        ? handleMatch[1].toLowerCase()
        : handleMatch[1];
    if (
      targetPlatform === 'instagram' &&
      RESERVED_IG_SEGMENTS.has(username)
    ) {
      return {
        isValid: false,
        platform: null,
        kind: null,
        identifier: undefined,
        cleanUrl: trimmed,
      };
    }
    return {
      isValid: true,
      platform: targetPlatform,
      kind: 'profile',
      contentKind: 'profile',
      content_kind: 'profile',
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

  const rawHost = parsed.hostname.toLowerCase();
  const host = rawHost.replace(/^www\./, '');
  const pathname = parsed.pathname;

  // =========================================================================
  // 0. LINKEDIN (linkedin.com/in/{slug} avec www. ou sous-domaine de pays)
  // =========================================================================
  const isLinkedInAllowedHost =
    rawHost === 'linkedin.com' ||
    rawHost === 'www.linkedin.com' ||
    /^[a-z]{2}\.linkedin\.com$/.test(rawHost);

  if (
    isLinkedInAllowedHost ||
    rawHost.endsWith('.linkedin.com') ||
    host === 'lnkd.in'
  ) {
    if (!isLinkedInAllowedHost) {
      return {
        isValid: false,
        platform: null,
        kind: null,
        identifier: undefined,
        cleanUrl: trimmed,
      };
    }
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length !== 2 || segments[0].toLowerCase() !== 'in') {
      return {
        isValid: false,
        platform: null,
        kind: null,
        identifier: undefined,
        cleanUrl: trimmed,
      };
    }
    const normalizedSlug = normalizeLinkedInSlug(segments[1]);
    if (!normalizedSlug) {
      return {
        isValid: false,
        platform: null,
        kind: null,
        identifier: undefined,
        cleanUrl: trimmed,
      };
    }
    return {
      isValid: true,
      platform: 'linkedin',
      kind: 'profile',
      contentKind: 'profile',
      content_kind: 'profile',
      identifier: normalizedSlug,
      cleanUrl: `https://www.linkedin.com/in/${encodeURIComponent(normalizedSlug)}`,
    };
  }

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
  // 1. INSTAGRAM (instagram.com, m.instagram.com, instagr.am)
  // =========================================================================
  if (
    host === 'instagram.com' ||
    host === 'm.instagram.com' ||
    host === 'instagr.am'
  ) {
    // 1.0 Redirection de connexion Instagram (/accounts/login/?next=...)
    if (pathname.toLowerCase().startsWith('/accounts/login')) {
      const nextParam = parsed.searchParams.get('next');
      if (nextParam) {
        try {
          const nextUrl = new URL(nextParam, 'https://www.instagram.com');
          const nextDetected = detectUrl(nextUrl.toString(), 'instagram');
          if (nextDetected.isValid && nextDetected.platform === 'instagram') {
            return {
              ...nextDetected,
              isLoginRedirect: true,
            };
          }
        } catch {
          // Ignorer
        }
      }
    }

    // 1A. Story Highlight (TESTÉ AVANT LES REELS) : /stories/highlights/{id}/ ou /s/{base64}/
    const highlightMatch = pathname.match(
      /^\/stories\/highlights\/([A-Za-z0-9_-]+)\/?/i
    );
    if (highlightMatch) {
      const highlightId = highlightMatch[1];
      return {
        isValid: true,
        platform: 'instagram',
        kind: 'highlight',
        contentKind: 'highlight',
        content_kind: 'highlight',
        identifier: highlightId,
        cleanUrl: `https://www.instagram.com/stories/highlights/${highlightId}/`,
      };
    }

    const highlightShortMatch = pathname.match(/^\/s\/([A-Za-z0-9_=-]{4,80})\/?$/i);
    if (highlightShortMatch) {
      const rawCode = highlightShortMatch[1];
      let highlightId = rawCode;
      try {
        const b64 = rawCode.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = atob(b64);
        const hlDecoded = decoded.match(/^highlight:(\d+)$/i);
        if (hlDecoded) {
          highlightId = hlDecoded[1];
        }
      } catch {
        // Conserver rawCode
      }
      return {
        isValid: true,
        platform: 'instagram',
        kind: 'highlight',
        contentKind: 'highlight',
        content_kind: 'highlight',
        identifier: highlightId,
        cleanUrl: `https://www.instagram.com/stories/highlights/${highlightId}/`,
        isShortLink: highlightId === rawCode,
      };
    }

    // 1B. Story Instagram (TESTÉ AVANT LES REELS) : /stories/{username}/{storyId?}
    const storyMatch = pathname.match(
      /^\/stories\/([A-Za-z0-9._]{1,30})(?:\/([0-9A-Za-z_-]+))?\/?/i
    );
    if (storyMatch && storyMatch[1].toLowerCase() !== 'highlights') {
      const username = storyMatch[1];
      const storyId = storyMatch[2];
      return {
        isValid: true,
        platform: 'instagram',
        kind: 'story',
        contentKind: 'story',
        content_kind: 'story',
        identifier: storyId ? `${username}/${storyId}` : username,
        cleanUrl: storyId
          ? `https://www.instagram.com/stories/${username}/${storyId}/`
          : `https://www.instagram.com/stories/${username}/`,
      };
    }

    // Tout autre chemin commençant par /stories ne doit jamais tomber dans les Reels
    if (pathname.toLowerCase().startsWith('/stories')) {
      return {
        isValid: false,
        platform: null,
        kind: null,
        identifier: undefined,
        cleanUrl: trimmed,
      };
    }

    // 1C. Liens courts / partage Instagram (/share/...)
    const igShareMatch = pathname.match(
      /^\/share\/(?:(stories|s|reel|reels|p)\/)?([A-Za-z0-9_-]{3,60})\/?$/i
    );
    if (igShareMatch) {
      const subKind = (igShareMatch[1] || '').toLowerCase();
      const shareCode = igShareMatch[2];
      const isShareStory = subKind === 'stories' || subKind === 's';
      const kind: ContentKind = isShareStory
        ? 'story'
        : subKind === 'reel' || subKind === 'reels'
        ? 'reel'
        : 'post';
      const contentKind: LogContentKind = isShareStory
        ? 'story'
        : subKind === 'reel' || subKind === 'reels'
        ? 'reel'
        : 'short_link';
      return {
        isValid: true,
        platform: 'instagram',
        kind,
        contentKind,
        content_kind: contentKind,
        identifier: shareCode,
        cleanUrl: stripTrackingParams(parsed.toString()),
        isShortLink: true,
      };
    }

    // 1D. IGTV / Vidéo : /tv/{code} ou /{username}/tv/{code}
    const tvMatch = pathname.match(
      /^\/(?:([A-Za-z0-9._]{1,30})\/)?tv\/([A-Za-z0-9_-]{5,40})/i
    );
    if (tvMatch && (!tvMatch[1] || tvMatch[1].toLowerCase() !== 'stories')) {
      const shortcode = tvMatch[2];
      return {
        isValid: true,
        platform: 'instagram',
        kind: 'video',
        contentKind: 'video',
        content_kind: 'video',
        identifier: shortcode,
        cleanUrl: `https://www.instagram.com/p/${shortcode}/`,
      };
    }

    // 1D-bis. Reel / Reels : /reel/{code} ou /reels/{code}
    const reelMatch = pathname.match(/^\/(?:reel|reels)\/([A-Za-z0-9_-]{5,40})/i);
    if (reelMatch) {
      const shortcode = reelMatch[1];
      return {
        isValid: true,
        platform: 'instagram',
        kind: 'reel',
        contentKind: 'reel',
        content_kind: 'reel',
        identifier: shortcode,
        cleanUrl: `https://www.instagram.com/p/${shortcode}/`,
      };
    }

    // 1E. Publication / Carrousel : /p/{code} ou /{username}/p/{code} ou /{username}/reel/{code}
    const postMatch = pathname.match(
      /^\/(?:([A-Za-z0-9._]{1,30})\/)?(p|reel|reels)\/([A-Za-z0-9_-]{5,40})/i
    );
    if (postMatch && (!postMatch[1] || postMatch[1].toLowerCase() !== 'stories')) {
      const isUserReel =
        postMatch[2].toLowerCase() === 'reel' ||
        postMatch[2].toLowerCase() === 'reels';
      const shortcode = postMatch[3];
      return {
        isValid: true,
        platform: 'instagram',
        kind: isUserReel ? 'reel' : 'post',
        contentKind: isUserReel ? 'reel' : 'carousel',
        content_kind: isUserReel ? 'reel' : 'carousel',
        identifier: shortcode,
        cleanUrl: `https://www.instagram.com/p/${shortcode}/`,
      };
    }

    // 1F. Profil : /{username}/ avec ou sans paramètres, avec ou sans / final (normalisé en minuscules)
    const profileMatch = pathname.match(/^\/([A-Za-z0-9._]{1,30})\/?$/);
    if (
      profileMatch &&
      !RESERVED_IG_SEGMENTS.has(profileMatch[1].toLowerCase())
    ) {
      const username = profileMatch[1].toLowerCase();
      return {
        isValid: true,
        platform: 'instagram',
        kind: 'profile',
        contentKind: 'profile',
        content_kind: 'profile',
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
          contentKind: 'short_link',
          content_kind: 'short_link',
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
        contentKind: 'short_link',
        content_kind: 'short_link',
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
        contentKind: 'photo',
        content_kind: 'photo',
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
        contentKind: 'video',
        content_kind: 'video',
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
        contentKind: 'profile',
        content_kind: 'profile',
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
        contentKind: 'short_link',
        content_kind: 'short_link',
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
        contentKind: 'short_link',
        content_kind: 'short_link',
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
    const isPhotoStatus = /\/photo\/\d+\/?$/i.test(pathname);
    const iStatusMatch = pathname.match(
      /^\/i\/(?:web\/)?status\/(\d+)(?:\/(?:video|photo)\/\d+)?\/?$/i
    );
    if (iStatusMatch) {
      const tweetId = iStatusMatch[1];
      const ck: LogContentKind = isPhotoStatus ? 'photo' : 'video';
      return {
        isValid: true,
        platform: 'x',
        kind: 'post',
        contentKind: ck,
        content_kind: ck,
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
        const ck: LogContentKind = isPhotoStatus ? 'photo' : 'video';
        return {
          isValid: true,
          platform: 'x',
          kind: 'post',
          contentKind: ck,
          content_kind: ck,
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

  // =========================================================================
  // 4. FACEBOOK (facebook.com, www.facebook.com, m.facebook.com, web.facebook.com, fb.watch, fb.com)
  // =========================================================================
  if (isAllowedFacebookHost(parsed.hostname)) {
    const rawHost = parsed.hostname.toLowerCase();
    const lowerPath = pathname.toLowerCase();

    // Détection immédiate d'une page de connexion (/login)
    if (
      lowerPath === '/login' ||
      lowerPath.startsWith('/login/') ||
      lowerPath.startsWith('/login.php')
    ) {
      const nextParam = parsed.searchParams.get('next');
      if (nextParam) {
        const nextDetected = detectUrl(nextParam, 'facebook');
        if (nextDetected.platform === 'facebook' && nextDetected.kind === 'story') {
          return {
            isValid: true,
            platform: 'facebook',
            kind: 'story',
            contentKind: 'story',
            content_kind: 'story',
            identifier: nextDetected.identifier,
            cleanUrl: nextDetected.cleanUrl,
            isLoginRedirect: true,
          };
        }
      }
      return {
        isValid: false,
        platform: 'facebook',
        kind: null,
        identifier: undefined,
        cleanUrl: parsed.toString(),
        isLoginRedirect: true,
      };
    }

    // Format 0A (TESTÉ AVANT LES REELS) : Stories Facebook (/stories/...)
    const fbStoriesMatch = pathname.match(
      /^\/stories\/([^/?#]+)(?:\/([^/?#]+))?/i
    );
    if (fbStoriesMatch) {
      const storyId = fbStoriesMatch[2] || fbStoriesMatch[1];
      return {
        isValid: true,
        platform: 'facebook',
        kind: 'story',
        contentKind: 'story',
        content_kind: 'story',
        identifier: storyId,
        cleanUrl: stripTrackingParams(parsed.toString()),
      };
    }

    // Format 0B (TESTÉ AVANT LES REELS) : /story.php?story_fbid=... (ou /permalink.php?story_fbid=...)
    if (
      lowerPath === '/story.php' ||
      lowerPath === '/story.php/' ||
      ((lowerPath === '/permalink.php' || lowerPath === '/permalink.php/') &&
        parsed.searchParams.has('story_fbid'))
    ) {
      const storyFbid = (parsed.searchParams.get('story_fbid') || '').trim();
      if (storyFbid) {
        return {
          isValid: true,
          platform: 'facebook',
          kind: 'story',
          contentKind: 'story',
          content_kind: 'story',
          identifier: storyFbid,
          cleanUrl: stripTrackingParams(parsed.toString()),
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

    // Format 0C (TESTÉ AVANT LES REELS) : Lien de partage de story /share/s/{code}
    const fbShareStoryMatch = pathname.match(
      /^\/share\/s\/([A-Za-z0-9_-]{3,60})\/?$/i
    );
    if (fbShareStoryMatch) {
      const shareCode = fbShareStoryMatch[1];
      return {
        isValid: true,
        platform: 'facebook',
        kind: 'story',
        contentKind: 'story',
        content_kind: 'story',
        identifier: shareCode,
        cleanUrl: `https://www.facebook.com/share/s/${shareCode}/`,
        isShortLink: true,
      };
    }

    // Tout autre chemin /stories ne doit jamais être classé en Reel
    if (lowerPath.startsWith('/stories')) {
      return {
        isValid: false,
        platform: null,
        kind: null,
        identifier: undefined,
        cleanUrl: trimmed,
      };
    }

    // Format 0D : Photos Facebook (/photo, /photo/, /photo.php, /photos/, /{page}/photos/...) -> kind: 'photo' (non pris en charge, message clair)
    if (
      lowerPath === '/photo' ||
      lowerPath === '/photo/' ||
      lowerPath === '/photo.php' ||
      lowerPath === '/photo.php/' ||
      lowerPath.startsWith('/photo/') ||
      lowerPath.startsWith('/photos/') ||
      lowerPath === '/photos' ||
      lowerPath.includes('/photos/') ||
      lowerPath.startsWith('/share/p/')
    ) {
      const photoFbid =
        (parsed.searchParams.get('fbid') || '').trim() ||
        pathname.split('/').filter(Boolean).pop() ||
        undefined;
      return {
        isValid: false,
        unsupportedReason: 'FB_PHOTO_UNSUPPORTED',
        platform: 'facebook',
        kind: 'photo',
        contentKind: 'photo',
        content_kind: 'photo',
        identifier: photoFbid,
        cleanUrl: stripTrackingParams(parsed.toString()),
      };
    }

    // Rejeter explicitement les lives avec UNSUPPORTED_URL
    if (
      lowerPath.includes('/live/') ||
      lowerPath.startsWith('/watch/live')
    ) {
      return {
        isValid: false,
        platform: null,
        kind: null,
        identifier: undefined,
        cleanUrl: trimmed,
      };
    }

    // Format 1 : Lien court fb.watch/{code} (ou fb.watch/v/{code})
    if (rawHost === 'fb.watch' || rawHost === 'www.fb.watch') {
      const fbWatchMatch = pathname.match(/^\/(?:v\/)?([A-Za-z0-9_-]{3,40})\/?$/);
      if (fbWatchMatch && fbWatchMatch[1].toLowerCase() !== 'login') {
        const code = fbWatchMatch[1];
        return {
          isValid: true,
          platform: 'facebook',
          kind: 'video',
          contentKind: 'short_link',
          content_kind: 'short_link',
          identifier: code,
          cleanUrl: `https://fb.watch/${code}/`,
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

    // Format 2 : /reel/{id} (ou /reels/{id})
    const fbReelMatch = pathname.match(/^\/(?:reel|reels)\/([0-9A-Za-z_-]{5,45})\/?$/i);
    if (fbReelMatch) {
      const reelId = fbReelMatch[1];
      return {
        isValid: true,
        platform: 'facebook',
        kind: 'reel',
        contentKind: 'reel',
        content_kind: 'reel',
        identifier: reelId,
        cleanUrl: `https://www.facebook.com/reel/${reelId}`,
      };
    }

    // Format 3 : /watch/?v={id} et /watch?v={id} (ou /watch/{id})
    if (pathname === '/watch' || pathname === '/watch/') {
      const vParam = parsed.searchParams.get('v')?.trim() || '';
      if (/^\d{5,30}$/.test(vParam)) {
        return {
          isValid: true,
          platform: 'facebook',
          kind: 'video',
          contentKind: 'video',
          content_kind: 'video',
          identifier: vParam,
          cleanUrl: `https://www.facebook.com/watch/?v=${vParam}`,
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

    // Format 4 : /video.php?v={id}
    if (pathname === '/video.php' || pathname === '/video.php/') {
      const vParam = (
        parsed.searchParams.get('v') ||
        parsed.searchParams.get('id') ||
        ''
      ).trim();
      if (/^\d{5,30}$/.test(vParam)) {
        return {
          isValid: true,
          platform: 'facebook',
          kind: 'video',
          contentKind: 'video',
          content_kind: 'video',
          identifier: vParam,
          cleanUrl: `https://www.facebook.com/watch/?v=${vParam}`,
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

    // Format 5 : /{page}/videos/{id} et /{page}/videos/{titre}/{id} (ou /videos/{id})
    const fbPageVideoMatch =
      pathname.match(
        /^\/([A-Za-z0-9._-]+)\/videos\/(?:[^/]+\/)?(\d{5,30})\/?$/i
      ) || pathname.match(/^\/videos\/(\d{5,30})\/?$/i);
    if (fbPageVideoMatch) {
      const isDirectVideos = fbPageVideoMatch.length === 2;
      const pageName = isDirectVideos ? 'facebook' : fbPageVideoMatch[1];
      const videoId = isDirectVideos ? fbPageVideoMatch[1] : fbPageVideoMatch[2];
      return {
        isValid: true,
        platform: 'facebook',
        kind: 'video',
        contentKind: 'video',
        content_kind: 'video',
        identifier: videoId,
        cleanUrl: `https://www.facebook.com/${pageName}/videos/${videoId}/`,
      };
    }

    // Format 6 : /share/v/{code}, /share/r/{code} ou /share/{code} (liens de partage à résoudre)
    const fbShareMatch = pathname.match(
      /^\/share\/(?:([vr])\/)?([A-Za-z0-9_-]{4,45})\/?$/i
    );
    if (fbShareMatch) {
      const shareType = (fbShareMatch[1] || 'v').toLowerCase();
      const shareCode = fbShareMatch[2];
      const cleanSharePath = fbShareMatch[1]
        ? `/share/${shareType}/${shareCode}/`
        : `/share/${shareCode}/`;
      return {
        isValid: true,
        platform: 'facebook',
        kind: shareType === 'r' ? 'reel' : 'video',
        contentKind: shareType === 'r' ? 'reel' : 'short_link',
        content_kind: shareType === 'r' ? 'reel' : 'short_link',
        identifier: shareCode,
        cleanUrl: `https://www.facebook.com${cleanSharePath}`,
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

  return {
    isValid: false,
    platform: null,
    kind: null,
    identifier: undefined,
    cleanUrl: trimmed,
  };
}

/**
 * Suit les redirections d'un lien court ou de partage (Facebook /share/..., fb.watch, Instagram /share/..., etc.)
 * puis reclasse l'URL finale avec `detectUrl` afin qu'un lien redirigeant vers `/stories/...`
 * soit toujours reclassé en `story` (ou `highlight`), jamais en `reel`.
 */
export async function resolveAndDetectUrl(
  rawInput: string,
  preferredPlatform: SupportedPlatform = 'instagram',
  customFetch: typeof fetch = globalThis.fetch
): Promise<DetectionResult> {
  const initial = detectUrl(rawInput, preferredPlatform);
  if (!initial.isValid || !initial.isShortLink || !initial.cleanUrl) {
    return initial;
  }

  let currentUrl = initial.cleanUrl;
  let sawLoginRedirect = false;
  for (let hop = 0; hop < 4; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      break;
    }

    try {
      const res = await customFetch(parsed.toString(), {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (
        res.status === 301 ||
        res.status === 302 ||
        res.status === 303 ||
        res.status === 307 ||
        res.status === 308
      ) {
        const location = res.headers.get('Location');
        if (!location) break;
        const nextUrl = new URL(location, parsed);
        const nextPathLower = nextUrl.pathname.toLowerCase();
        if (
          nextPathLower === '/login' ||
          nextPathLower.startsWith('/login/') ||
          nextPathLower.startsWith('/login.php') ||
          nextPathLower.startsWith('/accounts/login')
        ) {
          sawLoginRedirect = true;
          const nextTarget = nextUrl.searchParams.get('next');
          if (nextTarget) {
            currentUrl = new URL(nextTarget, nextUrl).toString();
            break;
          }
        }
        currentUrl = nextUrl.toString();
        continue;
      }

      if (res.status === 200) {
        const html = await res.text().catch(() => '');
        const refreshMatch =
          html.match(/http-equiv=["']refresh["'][^>]+content=["']\d+;\s*url=([^"']+)["']/i) ||
          html.match(/content=["']\d+;\s*url=([^"']+)["'][^>]+http-equiv=["']refresh["']/i) ||
          html.match(/window\.location\.replace\(["']([^"']+)["']\)/i);
        if (refreshMatch?.[1]) {
          const decoded = refreshMatch[1].replace(/\\\//g, '/').replace(/&amp;/gi, '&');
          currentUrl = new URL(decoded, parsed).toString();
          continue;
        }
      }
      break;
    } catch {
      break;
    }
  }

  if (currentUrl && currentUrl !== initial.cleanUrl) {
    const reclassified = detectUrl(currentUrl, initial.platform || preferredPlatform);
    if (reclassified.isValid || reclassified.isLoginRedirect) {
      return sawLoginRedirect
        ? { ...reclassified, isLoginRedirect: true }
        : reclassified;
    }
  }

  return initial;
}

export interface UrlLogClassification {
  platform: SupportedPlatform;
  contentKind: LogContentKind;
  engineFn: string;
}

/**
 * Classe le type de contenu (`content_kind`) et la fonction moteur (`engine_fn`)
 * directement depuis le motif du lien, SANS jamais stocker l'URL et même si l'extraction échoue.
 */
export function classifyUrlForLog(
  rawInput: string,
  preferredPlatform: SupportedPlatform = 'instagram',
  resolvedUrl?: string
): UrlLogClassification {
  const trimmed = (rawInput || '').trim();
  const effectiveInput = (resolvedUrl || trimmed).trim();

  if (!trimmed) {
    return {
      platform: preferredPlatform,
      contentKind: preferredPlatform === 'linkedin' ? 'profile' : 'video',
      engineFn: `${preferredPlatform}.validate`,
    };
  }

  if (/^@[A-Za-z0-9._-]{1,35}$/.test(trimmed)) {
    const plat: SupportedPlatform =
      preferredPlatform === 'tiktok'
        ? 'tiktok'
        : preferredPlatform === 'linkedin'
        ? 'linkedin'
        : 'instagram';
    return {
      platform: plat,
      contentKind: 'profile',
      engineFn: `${plat}.profile`,
    };
  }

  const parseSafe = (u: string): URL | null => {
    try {
      const withProto = /^https?:\/\//i.test(u) ? u : `https://${u}`;
      const parsed = new URL(withProto);
      const pLower = parsed.pathname.toLowerCase();
      if (
        (pLower === '/login' ||
          pLower.startsWith('/login/') ||
          pLower.startsWith('/login.php')) &&
        parsed.searchParams.get('next')
      ) {
        try {
          return new URL(parsed.searchParams.get('next')!, parsed);
        } catch {
          return parsed;
        }
      }
      return parsed;
    } catch {
      return null;
    }
  };

  const origParsed = parseSafe(trimmed);
  const effParsed = parseSafe(effectiveInput) || origParsed;

  if (!origParsed || !effParsed) {
    return {
      platform: preferredPlatform,
      contentKind: preferredPlatform === 'linkedin' ? 'profile' : 'video',
      engineFn: `${preferredPlatform}.validate`,
    };
  }

  const origHost = origParsed.hostname.toLowerCase().replace(/^www\./, '');
  const origPath = origParsed.pathname.toLowerCase();
  const host = effParsed.hostname.toLowerCase().replace(/^www\./, '');
  const path = effParsed.pathname.toLowerCase();

  // Détection de la plateforme d'après l'hôte (même si l'URL est invalide ou non supportée)
  let platform: SupportedPlatform = preferredPlatform;
  if (
    host.includes('tiktok.com') ||
    origHost.includes('tiktok.com')
  ) {
    platform = 'tiktok';
  } else if (
    host.includes('instagram.com') ||
    host === 'instagr.am' ||
    origHost.includes('instagram.com') ||
    origHost === 'instagr.am'
  ) {
    platform = 'instagram';
  } else if (
    host === 'x.com' ||
    host.endsWith('.x.com') ||
    host.includes('twitter.com') ||
    host === 't.co' ||
    host.includes('fxtwitter') ||
    host.includes('vxtwitter') ||
    host.includes('fixupx') ||
    origHost === 't.co'
  ) {
    platform = 'x';
  } else if (
    isAllowedFacebookHost(effParsed.hostname) ||
    isAllowedFacebookHost(origParsed.hostname) ||
    host.includes('facebook.com') ||
    host.includes('fb.watch') ||
    host.includes('fb.com')
  ) {
    platform = 'facebook';
  } else if (
    host.includes('linkedin.com') ||
    host === 'lnkd.in' ||
    origHost.includes('linkedin.com') ||
    origHost === 'lnkd.in'
  ) {
    platform = 'linkedin';
  }

  const isOrigShortLink =
    origHost === 'vm.tiktok.com' ||
    origHost === 'vt.tiktok.com' ||
    origPath.startsWith('/t/') ||
    origHost === 't.co' ||
    origHost === 'fb.watch' ||
    origPath.startsWith('/share/') ||
    origHost === 'lnkd.in' ||
    origHost === 'instagr.am';

  const hasResolvedDifferentTarget =
    Boolean(resolvedUrl) &&
    resolvedUrl!.trim() !== '' &&
    (host !== origHost || path !== origPath || effParsed.search !== origParsed.search);

  // 1. TIKTOK
  if (platform === 'tiktok') {
    if (path.includes('/photo/')) {
      return {
        platform: 'tiktok',
        contentKind: isOrigShortLink && !hasResolvedDifferentTarget ? 'short_link' : 'photo',
        engineFn: 'tiktok.photo',
      };
    }
    if (path.includes('/music/') || path.includes('/audio/')) {
      return {
        platform: 'tiktok',
        contentKind: 'audio',
        engineFn: 'tiktok.audio',
      };
    }
    if (/^\/@[a-z0-9._-]+\/?$/.test(path)) {
      return {
        platform: 'tiktok',
        contentKind: 'profile',
        engineFn: 'tiktok.profile',
      };
    }
    if (isOrigShortLink && !hasResolvedDifferentTarget) {
      return {
        platform: 'tiktok',
        contentKind: 'short_link',
        engineFn: 'tiktok.video',
      };
    }
    return {
      platform: 'tiktok',
      contentKind: 'video',
      engineFn: 'tiktok.video',
    };
  }

  // 2. INSTAGRAM (TESTER HIGHLIGHTS & STORIES AVANT REELS !)
  if (platform === 'instagram') {
    if (
      path.startsWith('/stories/highlights/') ||
      origPath.startsWith('/stories/highlights/')
    ) {
      return {
        platform: 'instagram',
        contentKind: 'highlight',
        engineFn: 'instagram.highlight',
      };
    }
    if (
      path.startsWith('/stories/') ||
      path.includes('/stories/') ||
      origPath.startsWith('/stories/') ||
      origPath.startsWith('/share/stories/')
    ) {
      return {
        platform: 'instagram',
        contentKind: 'story',
        engineFn: 'instagram.story',
      };
    }
    if (path.includes('/reels/audio/') || path.startsWith('/audio/')) {
      return {
        platform: 'instagram',
        contentKind: 'audio',
        engineFn: 'instagram.audio',
      };
    }
    if (
      /^\/(?:[a-z0-9._]{1,30}\/)?tv\//.test(path) ||
      (!path.startsWith('/stories') &&
        /^\/(?:[a-z0-9._]{1,30}\/)?tv\//.test(origPath))
    ) {
      return {
        platform: 'instagram',
        contentKind: isOrigShortLink && !hasResolvedDifferentTarget ? 'short_link' : 'video',
        engineFn: 'instagram.video',
      };
    }
    if (
      /^\/(?:[a-z0-9._]{1,30}\/)?(?:reel|reels)\//.test(path) ||
      (!path.startsWith('/stories') &&
        /^\/(?:[a-z0-9._]{1,30}\/)?(?:reel|reels)\//.test(origPath))
    ) {
      return {
        platform: 'instagram',
        contentKind: isOrigShortLink && !hasResolvedDifferentTarget ? 'short_link' : 'reel',
        engineFn: 'instagram.reel',
      };
    }
    if (/^\/(?:[a-z0-9._]{1,30}\/)?p\//.test(path)) {
      return {
        platform: 'instagram',
        contentKind: isOrigShortLink && !hasResolvedDifferentTarget ? 'short_link' : 'carousel',
        engineFn: 'instagram.carousel',
      };
    }
    const segs = path.split('/').filter(Boolean);
    if (segs.length === 1 && !RESERVED_IG_SEGMENTS.has(segs[0])) {
      return {
        platform: 'instagram',
        contentKind: 'profile',
        engineFn: 'instagram.profile',
      };
    }
    return {
      platform: 'instagram',
      contentKind: isOrigShortLink && !hasResolvedDifferentTarget ? 'short_link' : 'carousel',
      engineFn: 'instagram.carousel',
    };
  }

  // 3. X (TWITTER)
  if (platform === 'x') {
    const unresolvedTco = host === 't.co';
    if (unresolvedTco) {
      return {
        platform: 'x',
        contentKind: 'short_link',
        engineFn: 'x.tco',
      };
    }
    if (path.includes('/photo/')) {
      return {
        platform: 'x',
        contentKind: isOrigShortLink && !hasResolvedDifferentTarget ? 'short_link' : 'photo',
        engineFn: 'x.syndication',
      };
    }
    if (path.includes('/status/')) {
      return {
        platform: 'x',
        contentKind: isOrigShortLink && !hasResolvedDifferentTarget ? 'short_link' : 'video',
        engineFn: 'x.syndication',
      };
    }
    return {
      platform: 'x',
      contentKind: isOrigShortLink && !hasResolvedDifferentTarget ? 'short_link' : 'video',
      engineFn: 'x.syndication',
    };
  }

  // 4. FACEBOOK (TESTER STORIES AVANT REELS, MÊME APRÈS REDIRECTION DE LIEN COURT !)
  if (platform === 'facebook') {
    const isFbStory =
      path.startsWith('/stories/') ||
      (path === '/story.php' && effParsed.searchParams.has('story_fbid')) ||
      origPath.startsWith('/stories/') ||
      (origPath === '/story.php' && origParsed.searchParams.has('story_fbid')) ||
      origPath.startsWith('/share/s/');

    if (isFbStory) {
      return {
        platform: 'facebook',
        contentKind: 'story',
        engineFn: 'facebook.story',
      };
    }
    if (
      path.startsWith('/reel/') ||
      path.startsWith('/reels/') ||
      (!hasResolvedDifferentTarget &&
        (origPath.startsWith('/reel/') ||
          origPath.startsWith('/reels/') ||
          origPath.startsWith('/share/r/')))
    ) {
      return {
        platform: 'facebook',
        contentKind:
          isOrigShortLink && !hasResolvedDifferentTarget ? 'short_link' : 'reel',
        engineFn: 'facebook.reel',
      };
    }
    if (path.startsWith('/photo') || path.startsWith('/photos/')) {
      return {
        platform: 'facebook',
        contentKind: 'photo',
        engineFn: 'facebook.video',
      };
    }
    return {
      platform: 'facebook',
      contentKind:
        isOrigShortLink && !hasResolvedDifferentTarget ? 'short_link' : 'video',
      engineFn: 'facebook.video',
    };
  }

  // 5. LINKEDIN
  return {
    platform: 'linkedin',
    contentKind: isOrigShortLink && !hasResolvedDifferentTarget ? 'short_link' : 'profile',
    engineFn: 'linkedin.profile',
  };
}

