/**
 * Moteur d'extraction Instagram 100 % Sans Compte pour Cloudflare Pages Functions.
 *
 * Stratégie Multi-Niveaux Robuste (Zéro cookie `IG_SESSION_ID` requis) :
 * - Niveau 1 (GraphQL Public / POST API) : Interroge `https://www.instagram.com/graphql/query`
 *   et `https://www.instagram.com/api/graphql` avec les `doc_id` publics actuels
 *   (`8845758582119845`, `10015901848480474`, `7950326061742207`) et en-têtes réalistes
 *   (`X-IG-App-ID: 936619743392459`, `Sec-Fetch-Mode: cors`, `User-Agent` mobile/desktop).
 * - Niveau 2 (Embed Captioned amélioré + OpenGraph) : Analyse `/p/{shortcode}/embed/captioned/`
 *   en parsant `window.__additionalDataLoaded`, `contextJSON` (chaîne JSON échappée) et les
 *   balises meta OpenGraph (`og:video`, `og:image`).
 * - Niveau 3 (Fallback Passerelles Publiques Gratuites Sans Clé) : Si les Niveaux 1 et 2
 *   sont bloqués par le WAF d'Instagram sur l'IP Cloudflare, interroge automatiquement les
 *   passerelles publiques sans clé (`api.vxinstagram.com`, `d.ddinstagram.com`) pour extraire
 *   le flux CDN officiel (`*.cdninstagram.com` / `*.fbcdn.net`).
 */

import { fetchWithContext, BROWSER_USER_AGENT } from './http.ts';
import type { ExtractResponse, ExtractMediaItem } from './normalize.ts';

const IG_WEB_APP_ID = '936619743392459';
const IG_ASBD_ID = '129477';
const IG_LSD_TOKEN = 'AVqbxe3J_YA';
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
  const avatar = owner.profile_pic_url_hd || owner.profile_pic_url
    ? cleanEscapedUrl(String(owner.profile_pic_url_hd || owner.profile_pic_url))
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
          width: node.dimensions?.width || undefined,
          height: node.dimensions?.height || undefined,
        });
      } else if (imgUrl) {
        const cleanImg = cleanEscapedUrl(imgUrl);
        items.push({
          kind: 'image',
          url: cleanImg,
          thumbnail: cleanImg,
          quality: '1080p',
          ext: 'jpg',
          width: node.dimensions?.width || undefined,
          height: node.dimensions?.height || undefined,
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
          width: media.dimensions?.width || undefined,
          height: media.dimensions?.height || undefined,
        },
      ],
    };
  }

  return null;
}

/**
 * NIVEAU 1 : Requête POST GraphQL Publique / API GraphQL Instagram (Sans compte)
 */
async function queryInstagramGraphQL(
  shortcode: string,
  sessionId?: string,
  csrfToken?: string
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
          'X-CSRFToken': csrfToken || 'missing',
          'X-Requested-With': 'XMLHttpRequest',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          Referer: `https://www.instagram.com/p/${shortcode}/`,
          Origin: 'https://www.instagram.com',
          Accept: '*/*',
        };

        if (sessionId) {
          const cleanSession = sessionId.includes('sessionid=')
            ? sessionId
            : `sessionid=${sessionId}`;
          headers['Cookie'] = csrfToken
            ? `${cleanSession}; csrftoken=${csrfToken};`
            : `${cleanSession};`;
        }

        const body = new URLSearchParams({
          av: '0',
          __d: 'www',
          __user: '0',
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
  shortcode: string
): Promise<{
  videoOrCarousel: ExtractResponse | null;
  staticImageFallback: ExtractResponse | null;
  notFound: boolean;
}> {
  let staticImageFallback: ExtractResponse | null = null;

  try {
    const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
    const embedFetch = await fetchWithContext(embedUrl, {
      headers: {
        'User-Agent': MOBILE_USER_AGENT,
        Referer: 'https://www.instagram.com/',
        'Sec-Fetch-Dest': 'iframe',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
      },
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
 * Interroge les résolveurs publics sans clé (vxinstagram / ddinstagram) qui extraient
 * les vraies URLs CDN (`*.cdninstagram.com` / `*.fbcdn.net`) d'un Reel ou post public.
 */
async function extractViaPublicFreeFallbacks(
  shortcode: string
): Promise<ExtractResponse | null> {
  // 3A. Passerelle JSON publique vxinstagram / instafix
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
        // Extraction des meta tags og:video / twitter:player:stream depuis la réponse HTML de la passerelle
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
  env?: InstagramEnv
): Promise<ExtractResponse> {
  const username = rawUsername.replace(/^@/, '').trim();
  const sessionId = env?.IG_SESSION_ID?.trim();

  // 1. API officielle Web Profile Info
  try {
    const headers: Record<string, string> = {
      'User-Agent': BROWSER_USER_AGENT,
      'X-IG-App-ID': IG_WEB_APP_ID,
      'X-ASBD-ID': IG_ASBD_ID,
      'X-Requested-With': 'XMLHttpRequest',
      Referer: `https://www.instagram.com/${username}/`,
      Accept: 'application/json',
    };
    if (sessionId) {
      headers['Cookie'] = `sessionid=${encodeURIComponent(sessionId)};`;
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
  if (kind === 'profile') {
    return extractInstagramProfile(identifier, env);
  }

  const shortcode = identifier.trim();
  const sessionId = env?.IG_SESSION_ID?.trim();
  const csrfToken = env?.IG_CSRF_TOKEN?.trim();

  // ===========================================================================
  // NIVEAU 1 : GraphQL Public / POST API (`https://www.instagram.com/graphql/query`)
  // ===========================================================================
  if (kind !== 'story') {
    const graphqlResult = await queryInstagramGraphQL(
      shortcode,
      sessionId,
      csrfToken
    );
    if (graphqlResult) {
      return graphqlResult;
    }
  }

  // ===========================================================================
  // NIVEAU 2 : Embed Captioned amélioré (`__additionalDataLoaded` + `contextJSON` + OG)
  // ===========================================================================
  let staticImageFallback: ExtractResponse | null = null;

  if (kind !== 'story') {
    const embedResult = await extractViaInstagramEmbedAndOg(shortcode);
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
        'Ce contenu Instagram est privé, soumis à une restriction d\'âge ou temporairement inaccessible sans compte.',
    },
  };
}
