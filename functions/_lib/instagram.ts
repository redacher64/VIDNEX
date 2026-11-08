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

import { fetchWithContext, BROWSER_USER_AGENT } from './http.ts';
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
  isStory = false
): Promise<ExtractResponse | null> {
  if (!auth.hasSession) return null;

  const mediaId = /^\d+$/.test(shortcodeOrId)
    ? shortcodeOrId
    : isStory
    ? null
    : shortcodeToMediaId(shortcodeOrId);

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

  if (mediaId) {
    try {
      const infoRes = await fetchWithContext(
        `https://www.instagram.com/api/v1/media/${mediaId}/info/`,
        { headers, timeoutMs: 7500 }
      );
      if (infoRes.response.ok) {
        const json: any = await infoRes.response.json().catch(() => null);
        const item = json?.items?.[0];
        const parsed = parseMediaNode(item, shortcodeOrId);
        if (parsed) return parsed;
      }
    } catch {
      // Continuer vers GraphQL
    }
  }

  // Si c'est une Story par nom d'utilisateur (ex: `stories/username`)
  if (isStory && !/^\d+$/.test(shortcodeOrId)) {
    const cleanUser = shortcodeOrId.replace(/^@/, '').split('/')[0];
    try {
      const profileRes = await fetchWithContext(
        `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(cleanUser)}`,
        { headers, timeoutMs: 7500 }
      );
      if (profileRes.response.ok) {
        const pJson: any = await profileRes.response.json().catch(() => null);
        const userId = pJson?.data?.user?.id;
        if (userId) {
          const reelsRes = await fetchWithContext(
            `https://www.instagram.com/api/v1/feed/reels_media/?reel_ids=${encodeURIComponent(String(userId))}`,
            { headers, timeoutMs: 7500 }
          );
          if (reelsRes.response.ok) {
            const rJson: any = await reelsRes.response.json().catch(() => null);
            const reelItems: any[] =
              rJson?.reels?.[userId]?.items ||
              rJson?.reels_media?.[0]?.items ||
              [];
            if (reelItems.length > 0) {
              const latestStory = reelItems[reelItems.length - 1];
              const parsed = parseMediaNode(latestStory, cleanUser);
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

/**
 * Extraction d'une Photo de Profil Instagram HD DP (`@username`)
 */
async function extractInstagramProfile(
  rawUsername: string,
  auth: ParsedInstagramAuth
): Promise<ExtractResponse> {
  const username = rawUsername.replace(/^@/, '').trim();

  // 1. API officielle Web Profile Info
  try {
    const headers: Record<string, string> = {
      'User-Agent': BROWSER_USER_AGENT,
      'X-IG-App-ID': IG_WEB_APP_ID,
      'X-ASBD-ID': IG_ASBD_ID,
      'X-CSRFToken': auth.csrfToken || 'missing',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: `https://www.instagram.com/${username}/`,
      Accept: 'application/json',
    };
    if (auth.hasSession && auth.cookieHeader) {
      headers['Cookie'] = auth.cookieHeader;
    }

    const apiRes = await fetchWithContext(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
      { headers, timeoutMs: 8000 }
    );

    if (apiRes.response.ok) {
      const json: any = await apiRes.response.json().catch(() => null);
      const user = json?.data?.user;
      const hdAvatar =
        user?.hd_profile_pic_url_info?.url ||
        user?.profile_pic_url_hd ||
        user?.profile_pic_url;

      if (hdAvatar) {
        const cleanAvatar = cleanEscapedUrl(hdAvatar);
        return {
          ok: true,
          platform: 'instagram',
          type: 'profile',
          title: user?.biography ? String(user.biography) : `@${username}`,
          author: {
            username: String(user?.username || username),
            nickname: String(user?.full_name || `@${username}`),
            avatar: cleanAvatar,
            followers: formatCount(user?.edge_followed_by?.count),
            biography: user?.biography ? String(user.biography) : undefined,
            verified: Boolean(user?.is_verified),
          },
          thumbnail: cleanAvatar,
          items: [
            {
              kind: 'image',
              url: cleanAvatar,
              quality: '1080p',
              ext: 'jpg',
            },
          ],
        };
      }
    }
  } catch {
    // Fallback vers og:image
  }

  // 2. Fallback OpenGraph og:image sur la page publique du profil
  try {
    const pageRes = await fetchWithContext(
      `https://www.instagram.com/${encodeURIComponent(username)}/`,
      {
        headers: {
          'User-Agent':
            'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
          Referer: 'https://www.instagram.com/',
        },
        timeoutMs: 7500,
      }
    );
    const html = await pageRes.response.text();
    const ogImg =
      html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1] ||
      html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i)?.[1];
    const ogDesc =
      html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)?.[1];

    if (ogImg) {
      const cleanAvatar = cleanEscapedUrl(ogImg);
      return {
        ok: true,
        platform: 'instagram',
        type: 'profile',
        title: ogDesc ? cleanEscapedUrl(ogDesc) : `@${username}`,
        author: {
          username,
          nickname: `@${username}`,
          avatar: cleanAvatar,
          biography: ogDesc ? cleanEscapedUrl(ogDesc) : undefined,
        },
        thumbnail: cleanAvatar,
        items: [
          {
            kind: 'image',
            url: cleanAvatar,
            quality: '1080p',
            ext: 'jpg',
          },
        ],
      };
    }
  } catch {
    // Ignorer
  }

  return {
    ok: false,
    platform: 'instagram',
    error: {
      code: 'NOT_FOUND',
      message: `Impossible de récupérer la photo de profil publique pour @${username}.`,
    },
  };
}

export async function extractInstagram(
  identifier: string,
  env?: InstagramEnv,
  kind: 'post' | 'profile' | 'story' = 'post'
): Promise<ExtractResponse> {
  const auth = parseInstagramCookies(env);

  if (kind === 'profile') {
    return extractInstagramProfile(identifier, auth);
  }

  const shortcode = identifier.trim();

  // ===========================================================================
  // NIVEAU 0 : API REST Authentifiée (`/api/v1/media/{mediaId}/info/` & Stories)
  // ===========================================================================
  if (auth.hasSession) {
    const apiV1Result = await queryAuthenticatedInstagramApiV1(
      shortcode,
      auth,
      kind === 'story'
    );
    if (apiV1Result) {
      return apiV1Result;
    }
  }

  // ===========================================================================
  // NIVEAU 1 : GraphQL Public / Authentifié POST API (`/graphql/query`)
  // ===========================================================================
  if (kind !== 'story') {
    const graphqlResult = await queryInstagramGraphQL(shortcode, auth);
    if (graphqlResult) {
      return graphqlResult;
    }
  }

  // ===========================================================================
  // NIVEAU 2 : Embed Captioned amélioré (`__additionalDataLoaded` + `contextJSON` + OG)
  // ===========================================================================
  let staticImageFallback: ExtractResponse | null = null;

  if (kind !== 'story') {
    const embedResult = await extractViaInstagramEmbedAndOg(shortcode, auth);
    if (embedResult.notFound) {
      return {
        ok: false,
        platform: 'instagram',
        error: {
          code: 'NOT_FOUND',
          message:
            'Cette publication Instagram est introuvable ou a été supprimée.',
        },
      };
    }
    if (embedResult.videoOrCarousel) {
      return embedResult.videoOrCarousel;
    }
    staticImageFallback = embedResult.staticImageFallback;
  }

  // ===========================================================================
  // NIVEAU 3 : Fallback Passerelles Publiques Gratuites Sans Clé (Anti-WAF)
  // ===========================================================================
  if (kind !== 'story') {
    const fallbackResult = await extractViaPublicFreeFallbacks(shortcode);
    if (fallbackResult) {
      return fallbackResult;
    }
  }

  // Si l'embed a tout de même fourni une image haute résolution
  if (staticImageFallback) {
    return staticImageFallback;
  }

  return {
    ok: false,
    platform: 'instagram',
    error: {
      code: 'PRIVATE_OR_LOGIN_REQUIRED',
      message:
        'Ce contenu Instagram est privé, soumis à une restriction d\'âge ou temporairement inaccessible.',
    },
  };
}
