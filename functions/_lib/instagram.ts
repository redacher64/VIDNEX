/**
 * Moteur d'extraction Instagram Hybride (Session Authentifiée + 3 Niveaux Sans Compte)
 * pour Cloudflare Pages Functions / Workers.
 *
 * - Niveau 0 (Session Authentifiée - Cookies Compte Instagram) :
 *   Si `IG_COOKIES` (JSON Cookie-Editor ou chaîne `Cookie`) ou `IG_SESSION_ID` est fourni,
 *   convertit le `shortcode` en `media_id` numérique et interroge l'API officielle
 *   `/api/v1/media/{media_id}/info/` ainsi que GraphQL authentifié (débloque les Reels
 *   restreints, les Carrousels HD, les Profils HD et les Stories).
 * - Niveau 1 (GraphQL Public / POST API) : Interroge `https://www.instagram.com/graphql/query`
 *   et `https://www.instagram.com/api/graphql` avec les `doc_id` publics actuels.
 * - Niveau 2 (Embed Captioned amélioré + OpenGraph) : Analyse `/p/{shortcode}/embed/captioned/`
 *   en parsant `window.__additionalDataLoaded`, `contextJSON` et les balises meta OpenGraph.
 * - Niveau 3 (Fallback Passerelles Publiques Gratuites Sans Clé) : Bascule automatiquement sur
 *   `api.vxinstagram.com` / `d.ddinstagram.com` si l'IP Cloudflare est filtrée.
 */

import { fetchWithContext, BROWSER_USER_AGENT, isTimeoutError } from './http.ts';
import type { ExtractResponse, ExtractMediaItem } from './normalize.ts';

const IG_WEB_APP_ID = '936619743392459';
const IG_ASBD_ID = '129477';
const IG_LSD_TOKEN = 'AVqbxe3J_YA';
const IG_BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const IG_GRAPHQL_DOC_IDS = [
  '8845758582119845',
  '10015901848480474',
  '7950326061742207',
];

export interface InstagramEnv {
  IG_SESSION_ID?: string;
  IG_CSRF_TOKEN?: string;
  IG_COOKIES?: string;
  allow_third_party?: boolean | string;
}

export interface ParsedInstagramAuth {
  cookieHeader: string;
  sessionId: string;
  csrfToken: string;
  dsUserId: string;
  igDid: string;
  hasSession: boolean;
}

/**
 * Analyse `IG_COOKIES` (format JSON exporté par Cookie-Editor `[...]` ou chaîne `k=v; k2=v2`)
 * ainsi que `IG_SESSION_ID` / `IG_CSRF_TOKEN` pour construire un en-tête `Cookie` complet.
 */
export function parseInstagramCookies(env?: InstagramEnv): ParsedInstagramAuth {
  const cookieMap = new Map<string, string>();

  const rawCookies = env?.IG_COOKIES?.trim() || '';
  if (rawCookies) {
    if (rawCookies.startsWith('[')) {
      try {
        const arr = JSON.parse(rawCookies);
        if (Array.isArray(arr)) {
          for (const item of arr) {
            if (item && typeof item.name === 'string' && item.value != null) {
              cookieMap.set(item.name.trim(), String(item.value).trim());
            }
          }
        }
      } catch {
        // Ignorer si JSON malformé
      }
    } else {
      for (const part of rawCookies.split(';')) {
        const eqIdx = part.indexOf('=');
        if (eqIdx > 0) {
          const k = part.slice(0, eqIdx).trim();
          const v = part.slice(eqIdx + 1).trim();
          if (k && v) {
            cookieMap.set(k, v);
          }
        }
      }
    }
  }

  const rawSession = env?.IG_SESSION_ID?.trim() || '';
  if (rawSession) {
    if (rawSession.startsWith('[')) {
      try {
        const arr = JSON.parse(rawSession);
        if (Array.isArray(arr)) {
          for (const item of arr) {
            if (item && typeof item.name === 'string' && item.value != null) {
              cookieMap.set(item.name.trim(), String(item.value).trim());
            }
          }
        }
      } catch {
        // Ignorer
      }
    } else if (rawSession.includes('=')) {
      for (const part of rawSession.split(';')) {
        const eqIdx = part.indexOf('=');
        if (eqIdx > 0) {
          const k = part.slice(0, eqIdx).trim();
          const v = part.slice(eqIdx + 1).trim();
          if (k && v) cookieMap.set(k, v);
        }
      }
    } else if (!cookieMap.has('sessionid')) {
      cookieMap.set('sessionid', rawSession);
    }
  }

  const rawCsrf = env?.IG_CSRF_TOKEN?.trim() || '';
  if (rawCsrf && !cookieMap.has('csrftoken')) {
    cookieMap.set('csrftoken', rawCsrf);
  }

  const sessionId = cookieMap.get('sessionid') || '';
  const csrfToken = cookieMap.get('csrftoken') || '';
  const dsUserId =
    cookieMap.get('ds_user_id') ||
    (sessionId.includes('%3A') ? sessionId.split('%3A')[0] : sessionId.split(':')[0]) ||
    '';
  const igDid = cookieMap.get('ig_did') || '';

  if (dsUserId && !cookieMap.has('ds_user_id')) {
    cookieMap.set('ds_user_id', dsUserId);
  }

  const pairs: string[] = [];
  for (const [k, v] of cookieMap.entries()) {
    pairs.push(`${k}=${v}`);
  }

  return {
    cookieHeader: pairs.join('; '),
    sessionId,
    csrfToken,
    dsUserId,
    igDid,
    hasSession: Boolean(sessionId),
  };
}

/**
 * Convertit un `shortcode` Instagram (ex: `C8x9kLmN2pQ`) en `media_id` numérique (ex: `3399123456789012345`)
 * pour interroger `/api/v1/media/{media_id}/info/`.
 */
export function shortcodeToMediaId(shortcode: string): string | null {
  const clean = shortcode.trim().slice(0, 11);
  if (!clean) return null;
  let id = 0n;
  for (let i = 0; i < clean.length; i++) {
    const idx = IG_BASE64_ALPHABET.indexOf(clean[i]);
    if (idx === -1) return null;
    id = id * 64n + BigInt(idx);
  }
  return id > 0n ? id.toString(10) : null;
}

export function cleanEscapedUrl(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\\u0026/g, '&')
    .replace(/\\u003d/gi, '=')
    .replace(/\\\//g, '/')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function formatDuration(sec: unknown): string | undefined {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const mins = Math.floor(n / 60);
  const secs = Math.floor(n % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatCount(count: unknown): string | undefined {
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Normalise un objet `shortcode_media` / `xdt_shortcode_media` / `items[0]` d'Instagram
 */
function parseMediaNode(media: any, shortcode: string): ExtractResponse | null {
  if (!media || typeof media !== 'object') return null;

  const owner = media.owner || media.user || {};
  const username = String(owner.username || 'instagram_user').replace(/^@/, '');
  const nickname = String(owner.full_name || `@${username}`);
  const avatar =
    owner.profile_pic_url_hd ||
    owner.hd_profile_pic_url_info?.url ||
    owner.profile_pic_url
      ? cleanEscapedUrl(
          String(
            owner.profile_pic_url_hd ||
              owner.hd_profile_pic_url_info?.url ||
              owner.profile_pic_url
          )
        )
      : undefined;
  const caption =
    media.edge_media_to_caption?.edges?.[0]?.node?.text ||
    media.caption?.text ||
    `Instagram (${shortcode})`;
  const duration = formatDuration(media.video_duration || media.duration);

  // 1. Carrousel multi-slides (`edge_sidecar_to_children` ou `carousel_media`)
  const sidecarEdges: any[] | undefined =
    media.edge_sidecar_to_children?.edges || media.carousel_media;

  if (Array.isArray(sidecarEdges) && sidecarEdges.length > 0) {
    const items: ExtractMediaItem[] = [];
    for (const edge of sidecarEdges) {
      const node = edge?.node || edge;
      if (!node) continue;
      const vidUrl = node.video_url || node.video_versions?.[0]?.url;
      const imgUrl =
        node.display_url ||
        node.display_resources?.[node.display_resources.length - 1]?.src ||
        node.image_versions2?.candidates?.[0]?.url ||
        node.thumbnail_src;

      if (vidUrl) {
        items.push({
          kind: 'video',
          url: cleanEscapedUrl(vidUrl),
          thumbnail: imgUrl ? cleanEscapedUrl(imgUrl) : undefined,
          quality: '1080p',
          ext: 'mp4',
          width: node.dimensions?.width || node.original_width || undefined,
          height: node.dimensions?.height || node.original_height || undefined,
        });
      } else if (imgUrl) {
        const cleanImg = cleanEscapedUrl(imgUrl);
        items.push({
          kind: 'image',
          url: cleanImg,
          thumbnail: cleanImg,
          quality: '1080p',
          ext: 'jpg',
          width: node.dimensions?.width || node.original_width || undefined,
          height: node.dimensions?.height || node.original_height || undefined,
        });
      }
    }

    if (items.length > 0) {
      return {
        ok: true,
        platform: 'instagram',
        type: 'carousel',
        title: String(caption).slice(0, 220),
        duration,
        author: {
          username,
          nickname,
          avatar,
          verified: Boolean(owner.is_verified),
        },
        thumbnail: items[0].thumbnail || items[0].url,
        items,
      };
    }
  }

  // 2. Vidéo / Reel Instagram
  const videoUrl = media.video_url || media.video_versions?.[0]?.url;
  const sdVideoUrl = media.video_versions?.[1]?.url;
  const coverUrl =
    media.display_url ||
    media.display_resources?.[media.display_resources.length - 1]?.src ||
    media.image_versions2?.candidates?.[0]?.url ||
    media.thumbnail_src;

  if (videoUrl) {
    const cleanVid = cleanEscapedUrl(videoUrl);
    const cleanCover = coverUrl ? cleanEscapedUrl(coverUrl) : cleanVid;
    const items: ExtractMediaItem[] = [
      {
        kind: 'video',
        url: cleanVid,
        backupUrl:
          sdVideoUrl && sdVideoUrl !== videoUrl
            ? cleanEscapedUrl(sdVideoUrl)
            : undefined,
        thumbnail: cleanCover,
        quality: '1080p',
        ext: 'mp4',
        width: media.dimensions?.width || media.original_width || undefined,
        height: media.dimensions?.height || media.original_height || undefined,
      },
    ];

    if (sdVideoUrl && sdVideoUrl !== videoUrl) {
      items.push({
        kind: 'video',
        url: cleanEscapedUrl(sdVideoUrl),
        thumbnail: cleanCover,
        quality: '720p',
        ext: 'mp4',
      });
    }

    items.push({
      kind: 'audio',
      url: cleanVid,
      quality: 'MP3',
      ext: 'mp3',
    });

    return {
      ok: true,
      platform: 'instagram',
      type: 'video',
      title: String(caption).slice(0, 200),
      duration,
      author: {
        username,
        nickname,
        avatar,
        verified: Boolean(owner.is_verified),
      },
      thumbnail: cleanCover,
      items,
    };
  }

  // 3. Publication Photo unique (si ce n'est pas un Reel vidéo masqué)
  if (coverUrl && media.is_video !== true && media.media_type !== 2) {
    const cleanImg = cleanEscapedUrl(coverUrl);
    return {
      ok: true,
      platform: 'instagram',
      type: 'image',
      title: String(caption).slice(0, 200),
      author: {
        username,
        nickname,
        avatar,
        verified: Boolean(owner.is_verified),
      },
      thumbnail: cleanImg,
      items: [
        {
          kind: 'image',
          url: cleanImg,
          thumbnail: cleanImg,
          quality: '1080p',
          ext: 'jpg',
          width: media.dimensions?.width || media.original_width || undefined,
          height: media.dimensions?.height || media.original_height || undefined,
        },
      ],
    };
  }

  return null;
}

/**
 * NIVEAU 0 : API REST Authentifiée (`/api/v1/media/{mediaId}/info/`) lorsque les cookies de session sont présents.
 */
async function queryAuthenticatedInstagramApiV1(
  shortcodeOrId: string,
  auth: ParsedInstagramAuth,
  isStory = false,
  isHighlight = false,
  customFetch?: typeof fetch
): Promise<ExtractResponse | null> {
  if (!auth.hasSession) return null;

  const trimmed = shortcodeOrId.trim().replace(/^@/, '');
  const parts = trimmed.split('/').filter(Boolean);
  const directNumericId = /^\d+$/.test(trimmed)
    ? trimmed
    : isStory && parts.length >= 2 && /^\d+$/.test(parts[1])
    ? parts[1]
    : null;

  const mediaId = directNumericId
    ? directNumericId
    : isStory || isHighlight
    ? null
    : shortcodeToMediaId(trimmed);

  const headers: Record<string, string> = {
    'User-Agent': BROWSER_USER_AGENT,
    'X-IG-App-ID': IG_WEB_APP_ID,
    'X-ASBD-ID': IG_ASBD_ID,
    'X-CSRFToken': auth.csrfToken || 'missing',
    'X-IG-WWW-Claim': '0',
    'X-Requested-With': 'XMLHttpRequest',
    Cookie: auth.cookieHeader,
    Referer: 'https://www.instagram.com/',
    Accept: 'application/json, text/plain, */*',
  };

  if (isHighlight && directNumericId) {
    try {
      const hlKey = `highlight:${directNumericId}`;
      const hlRes = await fetchWithContext(
        `https://www.instagram.com/api/v1/feed/reels_media/?reel_ids=${encodeURIComponent(hlKey)}`,
        { headers, timeoutMs: 7500 },
        customFetch
      );
      if (hlRes.response.ok) {
        const hlJson: any = await hlRes.response.json().catch(() => null);
        const hlItems: any[] =
          hlJson?.reels?.[hlKey]?.items ||
          hlJson?.reels_media?.[0]?.items ||
          [];
        if (hlItems.length > 0) {
          const parsed = parseMediaNode(hlItems[hlItems.length - 1], directNumericId);
          if (parsed) return parsed;
        }
      }
    } catch {
      // Continuer vers media info si disponible
    }
  }

  if (mediaId) {
    try {
      const infoRes = await fetchWithContext(
        `https://www.instagram.com/api/v1/media/${mediaId}/info/`,
        { headers, timeoutMs: 7500 },
        customFetch
      );
      if (infoRes.response.ok) {
        const json: any = await infoRes.response.json().catch(() => null);
        const item = json?.items?.[0];
        const parsed = parseMediaNode(item, mediaId);
        if (parsed) return parsed;
      }
    } catch {
      // Continuer vers reels_media par utilisateur si story
    }
  }

  // Si c'est une Story par nom d'utilisateur (ex: `username` ou `username/123456789`)
  if (isStory && !isHighlight && parts.length >= 1 && !/^\d+$/.test(parts[0])) {
    const cleanUser = parts[0];
    const targetStoryId = parts.length >= 2 && /^\d+$/.test(parts[1]) ? parts[1] : null;
    try {
      const profileRes = await fetchWithContext(
        `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(cleanUser)}`,
        { headers, timeoutMs: 7500 },
        customFetch
      );
      if (profileRes.response.ok) {
        const pJson: any = await profileRes.response.json().catch(() => null);
        const userId = pJson?.data?.user?.id;
        if (userId) {
          const reelsRes = await fetchWithContext(
            `https://www.instagram.com/api/v1/feed/reels_media/?reel_ids=${encodeURIComponent(String(userId))}`,
            { headers, timeoutMs: 7500 },
            customFetch
          );
          if (reelsRes.response.ok) {
            const rJson: any = await reelsRes.response.json().catch(() => null);
            const reelItems: any[] =
              rJson?.reels?.[userId]?.items ||
              rJson?.reels_media?.[0]?.items ||
              [];
            if (reelItems.length > 0) {
              const matchedStory = targetStoryId
                ? reelItems.find(
                    (it: any) =>
                      String(it?.pk || '') === targetStoryId ||
                      String(it?.id || '').startsWith(`${targetStoryId}_`) ||
                      String(it?.id || '') === targetStoryId
                  ) || reelItems[reelItems.length - 1]
                : reelItems[reelItems.length - 1];
              const parsed = parseMediaNode(matchedStory, cleanUser);
              if (parsed) return parsed;
            }
          }
        }
      }
    } catch {
      // Continuer
    }
  }

  return null;
}

/**
 * NIVEAU 1 : Requête POST GraphQL (`/graphql/query` & `/api/graphql`)
 * Fonctionne avec ou sans cookies de session.
 */
async function queryInstagramGraphQL(
  shortcode: string,
  auth: ParsedInstagramAuth
): Promise<ExtractResponse | null> {
  const endpoints = [
    'https://www.instagram.com/graphql/query',
    'https://www.instagram.com/api/graphql',
  ];

  for (const endpoint of endpoints) {
    for (const docId of IG_GRAPHQL_DOC_IDS) {
      try {
        const headers: Record<string, string> = {
          'User-Agent': BROWSER_USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-IG-App-ID': IG_WEB_APP_ID,
          'X-ASBD-ID': IG_ASBD_ID,
          'X-FB-LSD': IG_LSD_TOKEN,
          'X-CSRFToken': auth.csrfToken || 'missing',
          'X-Requested-With': 'XMLHttpRequest',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          Referer: `https://www.instagram.com/p/${shortcode}/`,
          Origin: 'https://www.instagram.com',
          Accept: '*/*',
        };

        if (auth.hasSession && auth.cookieHeader) {
          headers['Cookie'] = auth.cookieHeader;
        }

        const body = new URLSearchParams({
          av: auth.dsUserId || '0',
          __d: 'www',
          __user: auth.dsUserId || '0',
          __a: '1',
          __req: '1',
          lsd: IG_LSD_TOKEN,
          fb_api_caller_class: 'RelayModern',
          fb_api_req_friendly_name: 'PolarisPostActionLoadPostQueryQuery',
          variables: JSON.stringify({
            shortcode,
            fetch_comment_count: 2,
            fetch_related_profile_media_count: 0,
            parent_comment_count: 0,
            child_comment_count: 0,
            fetch_like_count: 10,
            fetch_tagged_user_count: null,
            fetch_preview_comment_count: 2,
            has_threaded_comments: true,
            hoisted_comment_id: null,
            hoisted_reply_id: null,
          }),
          server_timestamps: 'true',
          doc_id: docId,
        });

        const gqlRes = await fetchWithContext(endpoint, {
          method: 'POST',
          headers,
          body: body.toString(),
          timeoutMs: 7500,
        });

        if (gqlRes.response.ok) {
          const text = await gqlRes.response.text();
          const cleanedJson = text.replace(/^for\s*\(\s*;\s*;\s*\)\s*;/, '').trim();
          const json: any = JSON.parse(cleanedJson);
          const media =
            json?.data?.xdt_shortcode_media ||
            json?.data?.shortcode_media ||
            json?.graphql?.shortcode_media;

          const parsed = parseMediaNode(media, shortcode);
          if (parsed) return parsed;
        }
      } catch {
        // Essayer le doc_id / endpoint suivant
      }
    }
  }
  return null;
}

/**
 * NIVEAU 2 : Embed Captioned amélioré (`window.__additionalDataLoaded` + `contextJSON` + OpenGraph)
 */
async function extractViaInstagramEmbedAndOg(
  shortcode: string,
  auth?: ParsedInstagramAuth
): Promise<{
  videoOrCarousel: ExtractResponse | null;
  staticImageFallback: ExtractResponse | null;
  notFound: boolean;
}> {
  let staticImageFallback: ExtractResponse | null = null;

  try {
    const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
    const embedHeaders: Record<string, string> = {
      'User-Agent': MOBILE_USER_AGENT,
      Referer: 'https://www.instagram.com/',
      'Sec-Fetch-Dest': 'iframe',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site',
    };
    if (auth?.hasSession && auth.cookieHeader) {
      embedHeaders['Cookie'] = auth.cookieHeader;
    }

    const embedFetch = await fetchWithContext(embedUrl, {
      headers: embedHeaders,
      timeoutMs: 8500,
    });

    if (embedFetch.response.status === 404) {
      return { videoOrCarousel: null, staticImageFallback: null, notFound: true };
    }

    const html = await embedFetch.response.text();

    // 2A. Parser `window.__additionalDataLoaded`
    const additionalMatch = html.match(
      /window\.__additionalDataLoaded\s*\(\s*['"][^'"]+['"]\s*,\s*(\{[\s\S]*?\})\s*\)\s*;/
    );
    if (additionalMatch?.[1]) {
      try {
        const additionalData = JSON.parse(additionalMatch[1]);
        const media =
          additionalData?.shortcode_media ||
          additionalData?.gql_data?.shortcode_media ||
          additionalData?.data?.xdt_shortcode_media;
        const parsedNode = parseMediaNode(media, shortcode);
        if (parsedNode) {
          return {
            videoOrCarousel: parsedNode,
            staticImageFallback: null,
            notFound: false,
          };
        }
      } catch {
        // Continuer
      }
    }

    // 2B. Parser `contextJSON` (chaîne JSON doublement encodée dans TimeSliceImpl / ServerJS)
    const contextJsonMatch = html.match(/"contextJSON"\s*:\s*"((?:\\.|[^"\\])*)"/);
    if (contextJsonMatch?.[1]) {
      try {
        const unescapedString = JSON.parse(`"${contextJsonMatch[1]}"`);
        const contextObj = JSON.parse(unescapedString);
        const media =
          contextObj?.gql_data?.shortcode_media ||
          contextObj?.gql_data?.xdt_shortcode_media ||
          contextObj?.shortcode_media;
        const parsedNode = parseMediaNode(media, shortcode);
        if (parsedNode) {
          return {
            videoOrCarousel: parsedNode,
            staticImageFallback: null,
            notFound: false,
          };
        }
      } catch {
        // Continuer
      }
    }

    // 2C. Recherche directe de `video_url` et `display_url` dans l'embed
    const usernameMatch =
      html.match(/\\"username\\":\\"([^\\"]+)\\"/) ||
      html.match(/"username":"([^"]+)"/) ||
      html.match(/class="UsernameText"[^>]*>([^<]+)</i);
    const username = (usernameMatch?.[1] || 'instagram_user').replace(/^@/, '');

    const captionMatch =
      html.match(/class="Caption"[^>]*>[\s\S]*?<br\s*\/?>([\s\S]*?)<\/div>/i) ||
      html.match(/\\"caption\\":\\"([^\\"]+)\\"/);
    const title = captionMatch?.[1]
      ? captionMatch[1].replace(/<[^>]+>/g, '').trim()
      : `Instagram (@${username})`;

    const videoUrlMatch =
      html.match(/\\"video_url\\":\\"([^\\"]+)\\"/) ||
      html.match(/"video_url":"([^"]+)"/);

    const displayUrlMatch =
      html.match(/\\"display_url\\":\\"([^\\"]+)\\"/) ||
      html.match(/"display_url":"([^"]+)"/) ||
      html.match(/class="EmbeddedMediaImage"[^>]+src="([^"]+)"/i);

    if (videoUrlMatch?.[1]) {
      const videoUrl = cleanEscapedUrl(videoUrlMatch[1]);
      const displayUrl = displayUrlMatch?.[1]
        ? cleanEscapedUrl(displayUrlMatch[1])
        : videoUrl;

      return {
        videoOrCarousel: {
          ok: true,
          platform: 'instagram',
          type: 'video',
          title,
          author: {
            username,
            nickname: `@${username}`,
          },
          thumbnail: displayUrl,
          items: [
            {
              kind: 'video',
              url: videoUrl,
              quality: '1080p',
              ext: 'mp4',
            },
            {
              kind: 'audio',
              url: videoUrl,
              quality: 'MP3',
              ext: 'mp3',
            },
          ],
        },
        staticImageFallback: null,
        notFound: false,
      };
    }

    const isHiddenVideoInEmbed =
      html.includes('WatchOnInstagram') ||
      html.includes('"is_video":true') ||
      html.includes('\\"is_video\\":true');

    if (displayUrlMatch?.[1]) {
      const displayUrl = cleanEscapedUrl(displayUrlMatch[1]);
      staticImageFallback = {
        ok: true,
        platform: 'instagram',
        type: 'image',
        title,
        author: {
          username,
          nickname: `@${username}`,
        },
        thumbnail: displayUrl,
        items: [
          {
            kind: 'image',
            url: displayUrl,
            thumbnail: displayUrl,
            quality: '1080p',
            ext: 'jpg',
          },
        ],
      };

      if (!isHiddenVideoInEmbed) {
        return {
          videoOrCarousel: staticImageFallback,
          staticImageFallback,
          notFound: false,
        };
      }
    }
  } catch {
    // Continuer vers OpenGraph
  }

  // 2D. Dernier recours Niveau 2 : Balises meta OpenGraph (`og:video` / `og:image`)
  try {
    const pageFetch = await fetchWithContext(
      `https://www.instagram.com/p/${shortcode}/`,
      {
        headers: {
          'User-Agent':
            'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
          Accept: 'text/html,application/xhtml+xml',
        },
        timeoutMs: 6500,
      }
    );

    if (pageFetch.response.ok) {
      const html = await pageFetch.response.text();
      const ogVideo =
        html.match(/<meta\s+property="og:video"\s+content="([^"]+)"/i)?.[1] ||
        html.match(/<meta\s+property="og:video:secure_url"\s+content="([^"]+)"/i)?.[1];
      const ogImage =
        html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1];
      const ogTitle =
        html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)?.[1] ||
        `Instagram (${shortcode})`;

      if (ogVideo) {
        const cleanVid = cleanEscapedUrl(ogVideo);
        const cleanImg = ogImage ? cleanEscapedUrl(ogImage) : cleanVid;
        return {
          videoOrCarousel: {
            ok: true,
            platform: 'instagram',
            type: 'video',
            title: cleanEscapedUrl(ogTitle),
            author: {
              username: 'instagram_user',
              nickname: '@instagram_user',
            },
            thumbnail: cleanImg,
            items: [
              {
                kind: 'video',
                url: cleanVid,
                quality: '1080p',
                ext: 'mp4',
              },
              {
                kind: 'audio',
                url: cleanVid,
                quality: 'MP3',
                ext: 'mp3',
              },
            ],
          },
          staticImageFallback,
          notFound: false,
        };
      }
    }
  } catch {
    // Continuer vers Niveau 3
  }

  return { videoOrCarousel: null, staticImageFallback, notFound: false };
}

/**
 * NIVEAU 3 : Fallback Passerelles Publiques Gratuites Sans Clé (Anti-WAF Cloudflare)
 */
async function extractViaPublicFreeFallbacks(
  shortcode: string
): Promise<ExtractResponse | null> {
  const jsonGateways = [
    `https://api.vxinstagram.com/p/${shortcode}`,
    `https://d.ddinstagram.com/p/${shortcode}`,
  ];

  for (const gatewayUrl of jsonGateways) {
    try {
      const res = await fetchWithContext(gatewayUrl, {
        headers: {
          'User-Agent':
            'TelegramBot (like TwitterBot) Mozilla/5.0 (compatible; Discordbot/2.0)',
          Accept: 'application/json, text/html;q=0.9',
        },
        timeoutMs: 7500,
      });

      if (!res.response.ok) continue;

      const contentType = res.response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data: any = await res.response.json().catch(() => null);
        if (data && Array.isArray(data.media_extended) && data.media_extended.length > 0) {
          const username = String(data.user_screen_name || 'instagram_user').replace(
            /^@/,
            ''
          );
          const title = String(data.text || `Instagram (@${username})`);

          if (data.media_extended.length > 1) {
            const items: ExtractMediaItem[] = data.media_extended
              .filter((m: any) => m?.url)
              .map((m: any) => ({
                kind: m.type === 'video' ? ('video' as const) : ('image' as const),
                url: cleanEscapedUrl(String(m.url)),
                thumbnail: m.thumbnail_url
                  ? cleanEscapedUrl(String(m.thumbnail_url))
                  : undefined,
                quality: '1080p',
                ext: m.type === 'video' ? 'mp4' : 'jpg',
              }));

            if (items.length > 0) {
              return {
                ok: true,
                platform: 'instagram',
                type: 'carousel',
                title,
                author: {
                  username,
                  nickname: String(data.user_name || `@${username}`),
                },
                thumbnail: items[0].thumbnail || items[0].url,
                items,
              };
            }
          }

          const first = data.media_extended[0];
          if (first?.url) {
            const mediaUrl = cleanEscapedUrl(String(first.url));
            const thumbUrl = first.thumbnail_url
              ? cleanEscapedUrl(String(first.thumbnail_url))
              : mediaUrl;
            const isVid = first.type === 'video' || mediaUrl.includes('.mp4');

            return {
              ok: true,
              platform: 'instagram',
              type: isVid ? 'video' : 'image',
              title,
              author: {
                username,
                nickname: String(data.user_name || `@${username}`),
              },
              thumbnail: thumbUrl,
              items: isVid
                ? [
                    {
                      kind: 'video',
                      url: mediaUrl,
                      quality: '1080p',
                      ext: 'mp4',
                    },
                    {
                      kind: 'audio',
                      url: mediaUrl,
                      quality: 'MP3',
                      ext: 'mp3',
                    },
                  ]
                : [
                    {
                      kind: 'image',
                      url: mediaUrl,
                      quality: '1080p',
                      ext: 'jpg',
                    },
                  ],
            };
          }
        }
      } else {
        const html = await res.response.text();
        const ogVideo =
          html.match(/<meta\s+property="og:video(?::secure_url)?"\s+content="([^"]+)"/i)?.[1] ||
          html.match(/<meta\s+name="twitter:player:stream"\s+content="([^"]+)"/i)?.[1];
        const ogImage =
          html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1];
        const ogDesc =
          html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)?.[1] ||
          `Instagram (${shortcode})`;

        if (ogVideo && (ogVideo.includes('cdninstagram.com') || ogVideo.includes('fbcdn.net'))) {
          const cleanVid = cleanEscapedUrl(ogVideo);
          const cleanImg =
            ogImage && (ogImage.includes('cdninstagram.com') || ogImage.includes('fbcdn.net'))
              ? cleanEscapedUrl(ogImage)
              : cleanVid;

          return {
            ok: true,
            platform: 'instagram',
            type: 'video',
            title: cleanEscapedUrl(ogDesc).slice(0, 200),
            author: {
              username: 'instagram_user',
              nickname: '@instagram_user',
            },
            thumbnail: cleanImg,
            items: [
              {
                kind: 'video',
                url: cleanVid,
                quality: '1080p',
                ext: 'mp4',
              },
              {
                kind: 'audio',
                url: cleanVid,
                quality: 'MP3',
                ext: 'mp3',
              },
            ],
          };
        }
      }
    } catch {
      // Essayer la passerelle suivante
    }
  }

  return null;
}

interface ProfileSuccessBuildOptions {
  username: string;
  fullName?: string;
  photoUrl: string;
  quality: 'HD' | 'Standard';
  followers?: string;
  biography?: string;
  verified?: boolean;
  width?: number;
  height?: number;
  engineStage?: string;
  httpStatus?: number;
}

export const IG_PROFILE_BLOCKED_MESSAGE =
  'Instagram bloque temporairement la demande. Réessayez dans quelques minutes.';

function buildInstagramProfileResponse(
  opts: ProfileSuccessBuildOptions
): ExtractResponse {
  const cleanUser = opts.username.replace(/^@/, '').trim().toLowerCase();
  const cleanPhoto = cleanEscapedUrl(opts.photoUrl);
  const cleanFullName = opts.fullName ? cleanEscapedUrl(String(opts.fullName)).trim() : '';

  return {
    ok: true,
    platform: 'instagram',
    type: 'image',
    title: `@${cleanUser}`,
    stage: 'direct',
    engineStage: opts.engineStage,
    httpStatus: opts.httpStatus ?? 200,
    author: {
      username: cleanUser,
      nickname: cleanFullName || `@${cleanUser}`,
      full_name: cleanFullName || undefined,
      avatar: cleanPhoto,
      followers: opts.followers,
      biography: opts.biography ? cleanEscapedUrl(String(opts.biography)).trim() : undefined,
      verified: Boolean(opts.verified),
    },
    thumbnail: cleanPhoto,
    items: [
      {
        kind: 'image',
        url: cleanPhoto,
        quality: opts.quality,
        ext: 'jpg',
        width: opts.width,
        height: opts.height,
      },
    ],
  };
}

async function fetchProfileManual(
  url: string,
  init: RequestInit,
  timeoutMs = 8000,
  customFetch: typeof fetch = globalThis.fetch
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await customFetch(url, {
      ...init,
      redirect: 'manual',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function isLoginOrChallengeRedirect(status: number, locationHeader: string | null): boolean {
  if (status < 300 || status >= 400) return false;
  const loc = (locationHeader || '').toLowerCase();
  return (
    loc.includes('/accounts/login') ||
    loc.includes('/challenge') ||
    loc.includes('is_from_rle') ||
    loc.includes('/login')
  );
}

function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#064;/g, '@')
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _m;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _m;
    });
}

function extractFullNameFromOgTitle(ogTitle: string | undefined, username: string): string {
  if (!ogTitle) return '';
  const decoded = decodeHtmlEntities(cleanEscapedUrl(ogTitle)).trim();
  const markerIdx = decoded.toLowerCase().indexOf(`(@${username.toLowerCase()})`);
  if (markerIdx > 0) {
    return decoded.slice(0, markerIdx).trim();
  }
  return '';
}

function isInstagramNotFoundHtml(html: string, username: string): boolean {
  const lower = html.toLowerCase();
  if (
    lower.includes('/accounts/login') ||
    lower.includes('loginandsignuppage') ||
    lower.includes('login • instagram')
  ) {
    return false;
  }
  if (
    lower.includes("sorry, this page isn't available") ||
    lower.includes("cette page n'est malheureusement pas disponible") ||
    lower.includes('page not found') ||
    lower.includes('httperrorpage') ||
    lower.includes('polariserrorroot') ||
    lower.includes('the link you followed may be broken')
  ) {
    return true;
  }
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
  const hasOgImg = /<meta\s+[^>]*property="og:image"/i.test(html);
  const hasOgTitle = /<meta\s+[^>]*property="og:title"/i.test(html);
  const hasUsernameInTitle =
    titleMatch && decodeHtmlEntities(titleMatch).toLowerCase().includes(username.toLowerCase());
  if (titleMatch === 'Instagram' && !hasOgImg && !hasOgTitle && !hasUsernameInTitle) {
    return true;
  }
  return false;
}

/**
 * Extraction d'une Photo de Profil Instagram (`@username`) en 3 niveaux :
 * - Niveau 1 (sans compte) : `GET /api/v1/users/web_profile_info/?username={username}`
 *   avec `X-IG-App-ID: 936619743392459`, `User-Agent` navigateur récent, `redirect: 'manual'`, timeout 8s.
 * - Niveau 2 (optionnel, si `env.IG_SESSION_ID` / `env.IG_COOKIES` est défini) :
 *   Retente `web_profile_info` avec le cookie `sessionid` (sans jamais le logger ni l'exposer au front).
 * - Niveau 3 (repli sans compte) :
 *   Page publique `/{username}/` et `/embed/` en qualité `"Standard"` (indiquée clairement).
 *
 * Règle STRICTE `NOT_FOUND` (ÉTAPE 1) :
 * - Renvoie `NOT_FOUND` uniquement si DEUX sources indépendantes le confirment
 *   (ex. `web_profile_info` ET la page publique `/{username}/` ou `/{username}/embed/`).
 * - Un `404` isolé de l'endpoint interne, un `401/403/429`, une redirection vers `/accounts/login`
 *   ou une réponse vide renvoie `BLOCKED_BY_PLATFORM` avec le message :
 *   "Instagram bloque temporairement la demande. Réessayez dans quelques minutes."
 * - Un compte privé avec photo publique disponible renvoie la photo.
 */
export async function extractInstagramProfile(
  rawUsername: string,
  auth?: ParsedInstagramAuth,
  customFetch: typeof fetch = globalThis.fetch
): Promise<ExtractResponse> {
  const username = rawUsername.replace(/^@/, '').trim().toLowerCase();
  if (!username || !/^[a-z0-9._]{1,30}$/.test(username)) {
    return {
      ok: false,
      platform: 'instagram',
      engineStage: 'validation',
      httpStatus: 400,
      error: {
        code: 'UNSUPPORTED_URL',
        message: "Nom d'utilisateur Instagram invalide.",
      },
    };
  }

  const notFoundSources = new Set<'web_profile_info' | 'public_page' | 'embed_page'>();
  let blockedByPlatform = false;
  let privateWithoutPhoto = false;
  let timedOut = false;
  let lastStage = 'level1_web_profile_info';
  let lastHttpStatus = 0;

  const inspectWebProfileResponse = async (
    res: Response,
    stageName: 'level1_web_profile_info' | 'level2_session_cookie'
  ): Promise<ExtractResponse | null> => {
    lastStage = stageName;
    lastHttpStatus = res.status;

    if (res.status === 404) {
      // Un 404 sur web_profile_info compte comme 1 source (ne jamais renvoyer NOT_FOUND sans 2e source !)
      notFoundSources.add('web_profile_info');
      return null;
    }

    if (isLoginOrChallengeRedirect(res.status, res.headers.get('location'))) {
      blockedByPlatform = true;
      return null;
    }

    if (res.status === 401 || res.status === 403 || res.status === 429 || res.status >= 500) {
      blockedByPlatform = true;
      return null;
    }

    const rawText = await res.text().catch(() => '');
    if (!rawText || !rawText.trim()) {
      blockedByPlatform = true;
      return null;
    }

    let json: any = null;
    try {
      json = JSON.parse(rawText);
    } catch {
      if (
        rawText.includes('/accounts/login') ||
        rawText.includes('Login • Instagram') ||
        rawText.includes('login_required')
      ) {
        blockedByPlatform = true;
      }
      return null;
    }

    if (
      json?.message === 'checkpoint_required' ||
      json?.message === 'login_required' ||
      json?.require_login === true ||
      json?.error_type === 'rate_limit_error' ||
      json?.status === 'fail'
    ) {
      blockedByPlatform = true;
      return null;
    }

    if (
      res.status === 200 &&
      json &&
      typeof json === 'object' &&
      'data' in json &&
      json.data &&
      json.data.user === null
    ) {
      notFoundSources.add('web_profile_info');
      return null;
    }

    const user = json?.data?.user;
    if (user && typeof user === 'object') {
      const hdUrl =
        user.hd_profile_pic_url_info?.url || user.profile_pic_url_hd || '';
      const stdUrl = user.profile_pic_url || '';
      const bestUrl = hdUrl || stdUrl;

      if (bestUrl) {
        return buildInstagramProfileResponse({
          username: String(user.username || username),
          fullName: user.full_name ? String(user.full_name) : undefined,
          photoUrl: String(bestUrl),
          quality: hdUrl ? 'HD' : 'Standard',
          followers: formatCount(user.edge_followed_by?.count ?? user.follower_count),
          biography: user.biography ? String(user.biography) : undefined,
          verified: Boolean(user.is_verified),
          width:
            typeof user.hd_profile_pic_url_info?.width === 'number'
              ? user.hd_profile_pic_url_info.width
              : undefined,
          height:
            typeof user.hd_profile_pic_url_info?.height === 'number'
              ? user.hd_profile_pic_url_info.height
              : undefined,
          engineStage: stageName,
          httpStatus: res.status,
        });
      }

      if (user.is_private) {
        privateWithoutPhoto = true;
      }
    }

    return null;
  };

  const webProfileEndpoint = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;

  // ===========================================================================
  // NIVEAU 1 : Sans compte (`web_profile_info` public)
  // ===========================================================================
  try {
    const level1Res = await fetchProfileManual(
      webProfileEndpoint,
      {
        method: 'GET',
        headers: {
          'User-Agent': BROWSER_USER_AGENT,
          'X-IG-App-ID': IG_WEB_APP_ID,
          'X-ASBD-ID': IG_ASBD_ID,
          'X-Requested-With': 'XMLHttpRequest',
          Referer: `https://www.instagram.com/${username}/`,
          Accept: 'application/json',
        },
      },
      8000,
      customFetch
    );

    const parsedLevel1 = await inspectWebProfileResponse(
      level1Res,
      'level1_web_profile_info'
    );
    if (parsedLevel1) {
      return parsedLevel1;
    }
  } catch (err) {
    if (isTimeoutError(err)) {
      timedOut = true;
      lastStage = 'level1_web_profile_info';
      lastHttpStatus = 504;
    }
  }

  // ===========================================================================
  // NIVEAU 2 : Optionnel (si `env.IG_SESSION_ID` ou `env.IG_COOKIES` est défini)
  // Ne logge jamais le cookie et ne le renvoie jamais au front.
  // ===========================================================================
  if (auth?.hasSession && auth?.cookieHeader) {
    try {
      const level2Res = await fetchProfileManual(
        webProfileEndpoint,
        {
          method: 'GET',
          headers: {
            'User-Agent': BROWSER_USER_AGENT,
            'X-IG-App-ID': IG_WEB_APP_ID,
            'X-ASBD-ID': IG_ASBD_ID,
            'X-CSRFToken': auth.csrfToken || 'missing',
            'X-Requested-With': 'XMLHttpRequest',
            Referer: `https://www.instagram.com/${username}/`,
            Accept: 'application/json',
            Cookie: auth.cookieHeader,
          },
        },
        8000,
        customFetch
      );

      const parsedLevel2 = await inspectWebProfileResponse(
        level2Res,
        'level2_session_cookie'
      );
      if (parsedLevel2) {
        return parsedLevel2;
      }
    } catch (err) {
      if (isTimeoutError(err)) {
        timedOut = true;
        lastStage = 'level2_session_cookie';
        lastHttpStatus = 504;
      }
    }
  }

  // ===========================================================================
  // NIVEAU 3 : Page publique en repli (qualité "Standard" indiquée clairement)
  // ===========================================================================
  // 3a. Page publique `https://www.instagram.com/{username}/`
  const profilePageUrl = `https://www.instagram.com/${encodeURIComponent(username)}/`;
  const pageUserAgents = [
    'Twitterbot/1.0',
    'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
    'Mozilla/5.0 (compatible; Pinterestbot/1.0; +http://www.pinterest.com/bot.html)',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  ];

  for (const ua of pageUserAgents) {
    try {
      const pageRes = await fetchProfileManual(
        profilePageUrl,
        {
          method: 'GET',
          headers: {
            'User-Agent': ua,
          },
        },
        8000,
        customFetch
      );

      lastStage = 'level3_public_page';
      lastHttpStatus = pageRes.status;

      if (pageRes.status === 404) {
        notFoundSources.add('public_page');
        break;
      }

      if (isLoginOrChallengeRedirect(pageRes.status, pageRes.headers.get('location'))) {
        blockedByPlatform = true;
        continue;
      }

      if (
        pageRes.status === 401 ||
        pageRes.status === 403 ||
        pageRes.status === 429 ||
        pageRes.status >= 500
      ) {
        blockedByPlatform = true;
        continue;
      }

      if (pageRes.status >= 200 && pageRes.status < 300) {
        const html = await pageRes.text().catch(() => '');
        if (!html || !html.trim()) {
          blockedByPlatform = true;
          continue;
        }

        const ogTitle =
          html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)?.[1] ||
          html.match(/<meta\s+content="([^"]+)"\s+property="og:title"/i)?.[1];
        const ogDesc =
          html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)?.[1] ||
          html.match(/<meta\s+content="([^"]+)"\s+property="og:description"/i)?.[1];
        const fullNameFromOg = extractFullNameFromOgTitle(ogTitle, username);

        const embeddedHd =
          html.match(/"hd_profile_pic_url_info"\s*:\s*\{\s*"url"\s*:\s*"([^"]+)"/)?.[1] ||
          html.match(/"profile_pic_url_hd"\s*:\s*"([^"]+)"/)?.[1];

        if (embeddedHd && !embeddedHd.includes('rsrc.php')) {
          return buildInstagramProfileResponse({
            username,
            fullName: fullNameFromOg || undefined,
            photoUrl: embeddedHd,
            quality: 'Standard',
            biography: ogDesc ? decodeHtmlEntities(cleanEscapedUrl(ogDesc)) : undefined,
            engineStage: 'level3_public_page',
            httpStatus: pageRes.status,
          });
        }

        const ogImg =
          html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1] ||
          html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i)?.[1];

        if (
          ogImg &&
          !ogImg.includes('rsrc.php') &&
          (ogImg.includes('cdninstagram.com') ||
            ogImg.includes('fbcdn.net') ||
            ogImg.includes('fbsbx.com'))
        ) {
          return buildInstagramProfileResponse({
            username,
            fullName: fullNameFromOg || undefined,
            photoUrl: decodeHtmlEntities(ogImg),
            quality: 'Standard',
            biography: ogDesc ? decodeHtmlEntities(cleanEscapedUrl(ogDesc)) : undefined,
            engineStage: 'level3_public_page',
            httpStatus: pageRes.status,
          });
        }

        if (isInstagramNotFoundHtml(html, username)) {
          notFoundSources.add('public_page');
          break;
        }

        if (
          html.includes('/accounts/login') ||
          html.includes('LoginAndSignupPage') ||
          html.includes('Login • Instagram')
        ) {
          blockedByPlatform = true;
        }
      }
    } catch (err) {
      if (isTimeoutError(err)) {
        timedOut = true;
        lastStage = 'level3_public_page';
        lastHttpStatus = 504;
      }
    }
  }

  // 3b. Repli page publique `/embed/` (si la page `/{username}/` a été bloquée 302 ou pour confirmer une 2e source NOT_FOUND)
  if (notFoundSources.size < 2) {
    try {
      const embedRes = await fetchProfileManual(
        `https://www.instagram.com/${encodeURIComponent(username)}/embed/`,
        {
          method: 'GET',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            Referer: 'https://www.instagram.com/',
          },
        },
        8000,
        customFetch
      );

      lastStage = 'level3_public_embed';
      lastHttpStatus = embedRes.status;

      if (embedRes.status === 404) {
        notFoundSources.add('embed_page');
      } else if (isLoginOrChallengeRedirect(embedRes.status, embedRes.headers.get('location'))) {
        blockedByPlatform = true;
      } else if (
        embedRes.status === 401 ||
        embedRes.status === 403 ||
        embedRes.status === 429 ||
        embedRes.status >= 500
      ) {
        blockedByPlatform = true;
      } else if (embedRes.status === 200) {
        const embedHtml = await embedRes.text().catch(() => '');
        const ctxMatch = embedHtml.match(/"contextJSON"\s*:\s*"((?:\\.|[^"\\])*)"/);
        const dynamicLsd =
          embedHtml.match(/"LSD"\s*,\s*\[\]\s*,\s*\{\s*"token"\s*:\s*"([^"]+)"/)?.[1] ||
          IG_LSD_TOKEN;

        if (ctxMatch) {
          try {
            const unescapedJson = JSON.parse(`"${ctxMatch[1]}"`);
            const ctxPayload = JSON.parse(unescapedJson);
            const ctx = ctxPayload?.context;
            if (ctx && typeof ctx === 'object') {
              const ownerId = String(ctx.owner_id || ctx.profile_id || ctx.id || '');
              const embedFullName = ctx.full_name ? String(ctx.full_name) : undefined;
              const embedStdPic = ctx.profile_pic_url ? String(ctx.profile_pic_url) : '';
              const embedFollowers = formatCount(ctx.followers_count);
              const embedVerified = Boolean(ctx.is_verified);

              if (ownerId && /^\d+$/.test(ownerId)) {
                try {
                  const gqlVariables = JSON.stringify({
                    enable_integrity_filters: true,
                    id: ownerId,
                    render_surface: 'PROFILE',
                    __relay_internal__pv__PolarisCannesGuardianExperienceEnabledrelayprovider:
                      true,
                    __relay_internal__pv__PolarisCASB976ProfileEnabledrelayprovider:
                      false,
                    __relay_internal__pv__PolarisProfileInformTreatmentBannerEnabledrelayprovider:
                      false,
                    __relay_internal__pv__PolarisWebSchoolsEnabledrelayprovider:
                      false,
                    __relay_internal__pv__PolarisProfileRingsGradientEnabledrelayprovider:
                      false,
                    __relay_internal__pv__PolarisRepostsConsumptionEnabledrelayprovider:
                      false,
                    __relay_internal__pv__PolarisShortDramaEnabledrelayprovider:
                      false,
                  });

                  const gqlBody = new URLSearchParams({
                    av: '0',
                    __d: 'www',
                    __user: '0',
                    __a: '1',
                    __req: '1',
                    lsd: dynamicLsd,
                    fb_api_caller_class: 'RelayModern',
                    fb_api_req_friendly_name: 'PolarisProfilePageContentQuery',
                    variables: gqlVariables,
                    server_timestamps: 'true',
                    doc_id: '40158838120366999',
                  });

                  const gqlRes = await fetchProfileManual(
                    'https://www.instagram.com/api/graphql',
                    {
                      method: 'POST',
                      headers: {
                        'User-Agent':
                          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-IG-App-ID': IG_WEB_APP_ID,
                        'X-FB-LSD': dynamicLsd,
                        'X-ASBD-ID': IG_ASBD_ID,
                        Referer: `https://www.instagram.com/${username}/`,
                        Accept: '*/*',
                      },
                      body: gqlBody.toString(),
                    },
                    8000,
                    customFetch
                  );

                  if (gqlRes.status === 200) {
                    const gqlJson: any = await gqlRes.json().catch(() => null);
                    const gUser = gqlJson?.data?.user;
                    if (gUser && typeof gUser === 'object') {
                      const gHd =
                        gUser.hd_profile_pic_url_info?.url ||
                        gUser.profile_pic_url_hd ||
                        '';
                      const gStd = gUser.profile_pic_url || embedStdPic;
                      const bestPic = gHd || gStd;
                      if (bestPic) {
                        return buildInstagramProfileResponse({
                          username: String(gUser.username || ctx.username || username),
                          fullName: gUser.full_name
                            ? String(gUser.full_name)
                            : embedFullName,
                          photoUrl: String(bestPic),
                          quality: 'Standard',
                          followers:
                            formatCount(
                              gUser.follower_count ?? gUser.edge_followed_by?.count
                            ) || embedFollowers,
                          biography: gUser.biography
                            ? String(gUser.biography)
                            : undefined,
                          verified: Boolean(gUser.is_verified ?? embedVerified),
                          width:
                            typeof gUser.hd_profile_pic_url_info?.width === 'number'
                              ? gUser.hd_profile_pic_url_info.width
                              : undefined,
                          height:
                            typeof gUser.hd_profile_pic_url_info?.height === 'number'
                              ? gUser.hd_profile_pic_url_info.height
                              : undefined,
                          engineStage: 'level3_public_page',
                          httpStatus: 200,
                        });
                      }
                    }
                  }
                } catch {
                  // Repli sur la photo Standard issue de contextJSON
                }
              }

              if (embedStdPic && !embedStdPic.includes('rsrc.php')) {
                return buildInstagramProfileResponse({
                  username: String(ctx.username || username),
                  fullName: embedFullName,
                  photoUrl: embedStdPic,
                  quality: 'Standard',
                  followers: embedFollowers,
                  verified: embedVerified,
                  engineStage: 'level3_public_page',
                  httpStatus: embedRes.status,
                });
              }
            }
          } catch {
            // Ignorer si contextJSON non parsable
          }
        } else if (
          embedHtml.includes('EmbedIsBroken') ||
          embedHtml.includes('"contextJSON":null') ||
          isInstagramNotFoundHtml(embedHtml, username)
        ) {
          notFoundSources.add('embed_page');
          // Si embed_page confirme que le compte n'existe pas mais que les appels précédents
          // avaient été bloqués (429/302), on interroge une 2e source indépendante (`/embed/captioned/`)
          // qui renvoie 404 sur les profils inexistants.
          if (notFoundSources.size < 2) {
            try {
              const capRes = await fetchProfileManual(
                `https://www.instagram.com/${encodeURIComponent(username)}/embed/captioned/`,
                {
                  method: 'GET',
                  headers: {
                    'User-Agent':
                      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                  },
                },
                5000,
                customFetch
              );
              if (capRes.status === 404) {
                notFoundSources.add('public_page');
                lastHttpStatus = 404;
              }
            } catch {
              // Ignorer
            }
          }
        }
      }
    } catch (err) {
      if (isTimeoutError(err)) {
        timedOut = true;
        lastStage = 'level3_public_embed';
        lastHttpStatus = 504;
      }
    }
  }

  // ===========================================================================
  // CLASSIFICATION STRICTE DES ERREURS (ÉTAPE 1)
  // - NOT_FOUND uniquement si DEUX sources indépendantes le confirment (notFoundSources.size >= 2)
  // - Un 404 isolé, un 401/403/429, une redirection vers /accounts/login ou une réponse vide
  //   renvoie BLOCKED_BY_PLATFORM.
  // ===========================================================================
  if (notFoundSources.size >= 2) {
    return {
      ok: false,
      platform: 'instagram',
      engineStage: `${Array.from(notFoundSources).join('+')}`,
      httpStatus: 404,
      error: {
        code: 'NOT_FOUND',
        message: `Ce compte Instagram (@${username}) est introuvable ou n'existe pas.`,
      },
    };
  }

  if (privateWithoutPhoto && !blockedByPlatform) {
    return {
      ok: false,
      platform: 'instagram',
      engineStage: lastStage,
      httpStatus: lastHttpStatus || 403,
      error: {
        code: 'PRIVATE_OR_LOGIN_REQUIRED',
        message: `Impossible de récupérer la photo de profil publique pour @${username}.`,
      },
    };
  }

  if (timedOut && !blockedByPlatform) {
    return {
      ok: false,
      platform: 'instagram',
      engineStage: lastStage,
      httpStatus: 504,
      error: {
        code: 'TIMEOUT',
        message:
          "Le délai d'attente de 8 secondes a expiré lors de la récupération de la photo de profil Instagram.",
      },
    };
  }

  return {
    ok: false,
    platform: 'instagram',
    engineStage: lastStage,
    httpStatus: lastHttpStatus || 502,
    error: {
      code: 'BLOCKED_BY_PLATFORM',
      message: IG_PROFILE_BLOCKED_MESSAGE,
    },
  };
}

export const IG_STORY_LOGIN_REQUIRED_MESSAGE =
  'Les stories Instagram exigent une connexion : elles ne peuvent pas être téléchargées sans compte.';

export async function extractInstagram(
  identifier: string,
  env?: InstagramEnv,
  kind: 'post' | 'reel' | 'profile' | 'story' | 'highlight' = 'post',
  customFetch?: typeof fetch,
  allowThirdPartyOverride?: boolean
): Promise<ExtractResponse> {
  const auth = parseInstagramCookies(env);
  const allowThirdParty =
    typeof allowThirdPartyOverride === 'boolean'
      ? allowThirdPartyOverride
      : env?.allow_third_party !== false && env?.allow_third_party !== 'false';

  if (kind === 'profile') {
    return extractInstagramProfile(identifier, auth, customFetch);
  }

  const shortcode = identifier.trim();

  // ===========================================================================
  // STORIES & HIGHLIGHTS : N'utiliser JAMAIS le moteur Reels/Post sans session
  // ===========================================================================
  if (kind === 'story' || kind === 'highlight') {
    const contentKind = kind === 'highlight' ? 'highlight' : 'story';
    const engineFn = kind === 'highlight' ? 'instagram.highlight' : 'instagram.story';
    const hasIgSessionId = Boolean(env?.IG_SESSION_ID && String(env.IG_SESSION_ID).trim()) && auth.hasSession;

    if (!hasIgSessionId) {
      return {
        ok: false,
        platform: 'instagram',
        stage: 'direct',
        engineStage: 'story_auth_required',
        httpStatus: 403,
        contentKind,
        engineFn,
        error: {
          code: 'PRIVATE_OR_LOGIN_REQUIRED',
          message: IG_STORY_LOGIN_REQUIRED_MESSAGE,
        },
      };
    }

    const storyResult = await queryAuthenticatedInstagramApiV1(
      shortcode,
      auth,
      true,
      kind === 'highlight',
      customFetch
    );
    if (storyResult) {
      return {
        ...storyResult,
        stage: 'direct',
        engineStage: 'direct',
        httpStatus: 200,
        contentKind,
        engineFn,
      };
    }

    return {
      ok: false,
      platform: 'instagram',
      stage: 'direct',
      engineStage: 'direct',
      httpStatus: 403,
      contentKind,
      engineFn,
      error: {
        code: 'PRIVATE_OR_LOGIN_REQUIRED',
        message: IG_STORY_LOGIN_REQUIRED_MESSAGE,
      },
    };
  }

  // ===========================================================================
  // NIVEAU 0 : API REST Authentifiée (`/api/v1/media/{mediaId}/info/`)
  // ===========================================================================
  if (auth.hasSession) {
    const apiV1Result = await queryAuthenticatedInstagramApiV1(
      shortcode,
      auth,
      false,
      false,
      customFetch
    );
    if (apiV1Result) {
      return {
        ...apiV1Result,
        stage: 'direct',
        engineStage: 'direct',
      };
    }
  }

  // ===========================================================================
  // NIVEAU 1 : GraphQL Public / Authentifié POST API (`/graphql/query`)
  // ===========================================================================
  const graphqlResult = await queryInstagramGraphQL(shortcode, auth);
  if (graphqlResult) {
    return {
      ...graphqlResult,
      stage: 'direct',
      engineStage: 'direct',
    };
  }

  // ===========================================================================
  // NIVEAU 2 : Embed Captioned amélioré (`__additionalDataLoaded` + `contextJSON` + OG)
  // ===========================================================================
  let staticImageFallback: ExtractResponse | null = null;

  const embedResult = await extractViaInstagramEmbedAndOg(shortcode, auth);
  if (embedResult.notFound) {
    return {
      ok: false,
      platform: 'instagram',
      stage: 'direct',
      engineStage: 'embed',
      httpStatus: 404,
      error: {
        code: 'NOT_FOUND',
        message:
          'Cette publication Instagram est introuvable ou a été supprimée.',
      },
    };
  }
  if (embedResult.videoOrCarousel) {
    return {
      ...embedResult.videoOrCarousel,
      stage: 'direct',
      engineStage: 'embed',
      httpStatus: 200,
    };
  }
  staticImageFallback = embedResult.staticImageFallback;

  // ===========================================================================
  // NIVEAU 3 : Fallback Passerelles Publiques Gratuites Sans Clé (Anti-WAF)
  // Uniquement exécuté si allow_third_party est activé
  // ===========================================================================
  if (allowThirdParty) {
    const fallbackResult = await extractViaPublicFreeFallbacks(shortcode);
    if (fallbackResult) {
      return {
        ...fallbackResult,
        stage: 'tiers',
        engineStage: 'tiers',
        httpStatus: 200,
      };
    }
  }

  // Si l'embed a tout de même fourni une image haute résolution
  if (staticImageFallback) {
    return {
      ...staticImageFallback,
      stage: 'direct',
      engineStage: 'embed',
      httpStatus: 200,
    };
  }

  return {
    ok: false,
    platform: 'instagram',
    stage: 'direct',
    engineStage: 'embed',
    httpStatus: 403,
    error: {
      code: 'PRIVATE_OR_LOGIN_REQUIRED',
      message:
        'Ce contenu Instagram est privé, soumis à une restriction d\'âge ou temporairement inaccessible.',
    },
  };
}
