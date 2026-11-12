/**
 * Moteur d'extraction TikTok 100 % Gratuit pour Cloudflare Pages Functions.
 *
 * Sécurité & Architecture :
 * 1. Aucune clé API codée en dur : utilise uniquement `env?.TIKWM_API_KEY` si définie,
 *    sinon appelle l'API publique gratuite `https://www.tikwm.com/api/` sans clé.
 * 2. Convertit toutes les URLs relatives (`/video/media/...`) ou `//` en URLs absolues.
 * 3. En cas de limite sur TikWM, bascule automatiquement sur le scraping direct de la page
 *    TikTok (`__UNIVERSAL_DATA_FOR_REHYDRATION__` / `SIGI_STATE` / `__NEXT_DATA__`), extrait
 *    `playAddr` / `downloadAddr` et transmet les cookies de session (`tt_chain_token`, `ttwid`)
 *    au proxy `/api/download`.
 */

import { fetchWithContext } from './http.ts';
import { isAllowedTikTokAudioHost } from './allowlist.ts';
import type { ExtractResponse, ExtractMediaItem } from './normalize.ts';

export interface TikTokEnv {
  TIKWM_API_KEY?: string;
  TT_COOKIE?: string;
}

export function resolveTikWmMediaUrl(rawUrl: unknown): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('/')) return `https://www.tikwm.com${trimmed}`;
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://www.tikwm.com/${trimmed.replace(/^\/+/, '')}`;
  }
  return trimmed;
}

function decodeTikTokEscapedUrl(raw: string): string {
  return raw
    .replace(/\\u002F/gi, '/')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u003D/gi, '=')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
    .trim();
}

/**
 * Extrait l'URL audio depuis l'objet `music` du JSON de la page TikTok.
 * Retourne `null` si la vidéo n'a pas de son récupérable ou si l'hôte n'est pas autorisé.
 */
export function extractTikTokMusicUrl(music: any): string | null {
  if (!music || typeof music !== 'object') return null;
  const rawCandidate =
    (typeof music.playUrl === 'string' ? music.playUrl : null) ||
    (Array.isArray(music.playUrl?.urlList) ? music.playUrl.urlList[0] : null) ||
    (typeof music.play_url === 'string' ? music.play_url : null) ||
    (typeof music.play_url?.uri === 'string' && music.play_url.uri.startsWith('http')
      ? music.play_url.uri
      : null) ||
    (Array.isArray(music.play_url?.url_list) ? music.play_url.url_list[0] : null) ||
    (typeof music.play === 'string' ? music.play : null);

  if (!rawCandidate || typeof rawCandidate !== 'string') return null;
  const decoded = decodeTikTokEscapedUrl(rawCandidate);
  if (!decoded.startsWith('http://') && !decoded.startsWith('https://')) return null;
  try {
    const parsed = new URL(decoded);
    if (!isAllowedTikTokAudioHost(parsed.hostname)) return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Détermine l'extension réelle (`mp3` ou `m4a`) fournie par la source audio TikTok.
 * Ne renvoie `mp3` que si le flux est réellement du MP3 (`audio/mpeg`, `.mp3`, `mime_type=audio_mpeg`).
 */
export function detectTikTokAudioExt(
  audioUrl: string,
  contentType?: string | null
): 'mp3' | 'm4a' {
  if (contentType) {
    const ct = contentType.toLowerCase();
    if (ct.includes('audio/mpeg') || ct.includes('audio/mp3')) {
      return 'mp3';
    }
    if (ct.includes('m4a') || ct.includes('mp4') || ct.includes('aac')) {
      return 'm4a';
    }
  }

  try {
    const parsed = new URL(audioUrl);
    const pathLower = parsed.pathname.toLowerCase();
    const mimeParam = (parsed.searchParams.get('mime_type') || '').toLowerCase();
    if (
      pathLower.endsWith('.mp3') ||
      mimeParam === 'audio_mpeg' ||
      mimeParam === 'audio/mpeg'
    ) {
      return 'mp3';
    }
    if (
      pathLower.endsWith('.m4a') ||
      pathLower.endsWith('.mp4') ||
      pathLower.endsWith('.aac') ||
      mimeParam.includes('mp4') ||
      mimeParam.includes('m4a') ||
      mimeParam.includes('aac')
    ) {
      return 'm4a';
    }
  } catch {
    // Ignorer
  }

  return 'm4a';
}

/**
 * Vérifie le format réel de l'URL audio TikTok (via les en-têtes HEAD et paramètres d'URL)
 * et construit l'item `{ kind: "audio", url, quality: "Audio", ext }`.
 * Retourne `null` si la vidéo n'a pas de son récupérable.
 */
export async function buildVerifiedTikTokAudioItem(
  rawAudioUrl?: string | null,
  sessionCookies?: string
): Promise<ExtractMediaItem | null> {
  if (!rawAudioUrl || typeof rawAudioUrl !== 'string') return null;
  const cleanUrl = decodeTikTokEscapedUrl(rawAudioUrl);
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) return null;

  try {
    const parsed = new URL(cleanUrl);
    if (!isAllowedTikTokAudioHost(parsed.hostname)) return null;
  } catch {
    return null;
  }

  let contentType: string | null = null;
  try {
    const headFetch = await fetchWithContext(cleanUrl, {
      method: 'HEAD',
      timeoutMs: 2500,
      headers: {
        Referer: 'https://www.tiktok.com/',
        ...(sessionCookies ? { Cookie: sessionCookies } : {}),
      },
    });
    const status = headFetch.response.status;
    if (status === 404 || status === 410 || status === 403) {
      return null;
    }
    if (headFetch.response.ok || status === 206) {
      contentType = headFetch.response.headers.get('content-type');
    }
  } catch {
    // En cas de timeout sur HEAD, on détermine le format via l'URL
  }

  const ext = detectTikTokAudioExt(cleanUrl, contentType);
  return {
    kind: 'audio',
    url: cleanUrl,
    ...(sessionCookies ? { cookie: sessionCookies } : {}),
    quality: 'Audio',
    ext,
  };
}

function parseItemStructFromTikTokHtml(html: string): any | null {
  let itemStruct: any = null;

  const universalMatch = html.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/i
  );
  if (universalMatch?.[1]) {
    try {
      const parsed = JSON.parse(universalMatch[1]);
      const defaultScope = parsed['__DEFAULT_SCOPE__'] || {};
      const videoDetail =
        defaultScope['webapp.video-detail'] ||
        defaultScope['webapp.reflow.video.detail'] ||
        {};
      itemStruct = videoDetail.itemInfo?.itemStruct;
    } catch {
      // Poursuivre
    }
  }

  if (!itemStruct) {
    const sigiMatch = html.match(
      /<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/i
    );
    if (sigiMatch?.[1]) {
      try {
        const parsed = JSON.parse(sigiMatch[1]);
        const itemModule = parsed.ItemModule || {};
        const firstKey = Object.keys(itemModule)[0];
        if (firstKey) {
          itemStruct = itemModule[firstKey];
        }
      } catch {
        // Poursuivre
      }
    }
  }

  if (!itemStruct) {
    const nextMatch = html.match(
      /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i
    );
    if (nextMatch?.[1]) {
      try {
        const parsed = JSON.parse(nextMatch[1]);
        itemStruct = parsed.props?.pageProps?.itemInfo?.itemStruct;
      } catch {
        // Poursuivre
      }
    }
  }

  return itemStruct;
}

function formatDuration(sec: unknown): string | undefined {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const mins = Math.floor(n / 60);
  const secs = Math.floor(n % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatBytesToMb(bytes: unknown): string | undefined {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const mb = n / (1024 * 1024);
  if (mb < 1) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${mb.toFixed(1)} MB`;
}

function formatCount(count: unknown): string | undefined {
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

async function callTikWmApi(
  targetUrl: string,
  apiKey?: string
): Promise<any | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const form = new URLSearchParams({
      url: targetUrl,
      hd: '1',
    });
    if (apiKey && attempt === 0) {
      form.set('api_key', apiKey);
    }

    const tikwmFetch = await fetchWithContext('https://www.tikwm.com/api/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Accept: 'application/json',
        Referer: 'https://www.tikwm.com/',
      },
      body: form.toString(),
      timeoutMs: 9000,
    });

    if (tikwmFetch.response.ok) {
      const json: any = await tikwmFetch.response.json().catch(() => null);
      if (json?.code === 0 && json?.data) {
        return json.data;
      }
      // En cas de limite gratuite 1 req/sec (code -1), attendre 1.05s et réessayer
      if (json?.code === -1 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 1050));
        continue;
      }
    }
    break;
  }
  return null;
}

export async function extractTikTok(
  targetUrl: string,
  env?: TikTokEnv,
  kind: 'video' | 'profile' = 'video',
  identifier?: string
): Promise<ExtractResponse> {
  const apiKey = env?.TIKWM_API_KEY?.trim() || undefined;

  // ===========================================================================
  // CAS PROFIL TIKTOK (@username) : Photo de profil HD DP
  // ===========================================================================
  if (kind === 'profile') {
    const cleanHandle = (
      identifier ||
      targetUrl.split('/').filter(Boolean).pop() ||
      'tiktok'
    ).replace(/^@/, '');

    try {
      const params = new URLSearchParams({ unique_id: cleanHandle });
      if (apiKey) params.set('api_key', apiKey);

      const userFetch = await fetchWithContext(
        `https://www.tikwm.com/api/user/info?${params.toString()}`,
        {
          headers: {
            Accept: 'application/json',
            Referer: 'https://www.tikwm.com/',
          },
          timeoutMs: 9000,
        }
      );

      if (userFetch.response.ok) {
        const json: any = await userFetch.response.json().catch(() => null);
        const data = json?.data;
        const user = data?.user;
        const stats = data?.stats;
        const avatar = resolveTikWmMediaUrl(
          user?.avatarLarger || user?.avatarMedium || user?.avatarThumb
        );

        if (avatar) {
          const username = String(user?.uniqueId || cleanHandle).replace(/^@/, '');
          return {
            ok: true,
            platform: 'tiktok',
            type: 'profile',
            title: user?.signature ? String(user.signature) : `@${username}`,
            author: {
              username,
              nickname: String(user?.nickname || `@${username}`),
              avatar,
              followers: formatCount(stats?.followerCount),
              biography: user?.signature ? String(user.signature) : undefined,
              verified: Boolean(user?.verified),
            },
            thumbnail: avatar,
            items: [
              {
                kind: 'image',
                url: avatar,
                quality: '1080p',
                ext: 'jpg',
              },
            ],
          };
        }
      }
    } catch {
      // Continuer vers le scraping HTML
    }
  }

  // Pré-récupération du JSON de la page TikTok pour extraire l'URL audio officielle (`itemStruct.music`)
  let cachedPageFetch: {
    responseStatus: number;
    html: string;
    sessionCookies: string;
    itemStruct: any | null;
  } | null = null;

  const fetchOfficialPageOnce = async () => {
    if (cachedPageFetch) return cachedPageFetch;
    const customHeaders: Record<string, string> = {
      Referer: 'https://www.tiktok.com/',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    };
    if (env?.TT_COOKIE?.trim()) {
      customHeaders['Cookie'] = env.TT_COOKIE.trim();
    }
    const initialFetch = await fetchWithContext(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: customHeaders,
      timeoutMs: 8000,
    });
    const html = await initialFetch.response.text();
    const sessionCookies = initialFetch.cookieString || '';
    const itemStruct =
      initialFetch.response.ok && html ? parseItemStructFromTikTokHtml(html) : null;
    cachedPageFetch = {
      responseStatus: initialFetch.response.status,
      html,
      sessionCookies,
      itemStruct,
    };
    return cachedPageFetch;
  };

  // ===========================================================================
  // NIVEAU 1 : API Publique TikWM + JSON Page TikTok pour le son
  // ===========================================================================
  try {
    const [data, pageSnapshot] = await Promise.all([
      callTikWmApi(targetUrl, apiKey),
      kind !== 'profile' ? fetchOfficialPageOnce().catch(() => null) : Promise.resolve(null),
    ]);

    if (data && typeof data === 'object') {
      const resolvedVideoId = String(
        data.id || data.video_id || pageSnapshot?.itemStruct?.id || identifier || ''
      ).trim() || undefined;
      const author = data.author || {};
      const username = String(
        author.unique_id || author.uniqueId || identifier || 'tiktok_user'
      ).replace(/^@/, '');
      const nickname = String(author.nickname || `@${username}`);
      const avatar = resolveTikWmMediaUrl(author.avatar);
      const title = String(data.title || `@${username}`);
      const cover = resolveTikWmMediaUrl(
        data.origin_cover || data.cover || author.avatar
      );
      const duration = formatDuration(data.duration);

      // Récupération prioritaire de l'URL audio depuis le JSON de la page TikTok (`itemStruct.music`), sinon depuis `data.music_info` / `data.music`
      const pageMusicUrl = extractTikTokMusicUrl(pageSnapshot?.itemStruct?.music);
      const tikwmMusicUrl = resolveTikWmMediaUrl(
        typeof data.music === 'string' ? data.music : data.music_info?.play
      );
      let audioItem = await buildVerifiedTikTokAudioItem(
        pageMusicUrl,
        pageSnapshot?.sessionCookies
      );
      if (!audioItem && tikwmMusicUrl) {
        audioItem = await buildVerifiedTikTokAudioItem(tikwmMusicUrl);
      }

      // 1A. Carrousel Photo TikTok (Photo Mode Slideshow)
      if (Array.isArray(data.images) && data.images.length > 0) {
        const items: ExtractMediaItem[] = data.images
          .map((img: unknown) => resolveTikWmMediaUrl(img))
          .filter(Boolean)
          .map((imgUrl: string) => ({
            kind: 'image' as const,
            url: imgUrl,
            thumbnail: imgUrl,
            quality: '1080p',
            ext: 'jpg',
          }));

        if (audioItem) {
          items.push(audioItem);
        }

        if (items.length > 0) {
          return {
            ok: true,
            id: resolvedVideoId,
            platform: 'tiktok',
            type: 'carousel',
            title,
            duration,
            author: {
              username,
              nickname,
              avatar,
            },
            thumbnail: cover || items[0].url,
            items,
          };
        }
      }

      // 1B. Vidéo TikTok HD 1080p & 720p Sans Filigrane
      const hdPlay = resolveTikWmMediaUrl(data.hdplay || data.play);
      const sdPlay = resolveTikWmMediaUrl(data.play || data.wmplay || hdPlay);

      if (hdPlay) {
        const items: ExtractMediaItem[] = [
          {
            kind: 'video',
            url: hdPlay,
            backupUrl: sdPlay && sdPlay !== hdPlay ? sdPlay : undefined,
            quality: '1080p',
            ext: 'mp4',
            size: formatBytesToMb(data.hd_size || data.size),
          },
        ];

        if (sdPlay && sdPlay !== hdPlay) {
          items.push({
            kind: 'video',
            url: sdPlay,
            quality: '720p',
            ext: 'mp4',
            size: formatBytesToMb(data.size),
          });
        }

        if (audioItem) {
          items.push(audioItem);
        }

        return {
          ok: true,
          id: resolvedVideoId,
          platform: 'tiktok',
          type: 'video',
          title,
          duration,
          author: {
            username,
            nickname,
            avatar,
          },
          thumbnail: cover || hdPlay,
          items,
        };
      }
    }
  } catch {
    // Basculer automatiquement sur le Niveau 2 (Scraping direct TikTok)
  }

  // ===========================================================================
  // NIVEAU 2 : Scraping Direct Page Officielle TikTok (+ transmission cookies)
  // ===========================================================================
  try {
    const pageSnapshot = await fetchOfficialPageOnce();

    if (pageSnapshot.responseStatus === 404) {
      return {
        ok: false,
        platform: 'tiktok',
        error: {
          code: 'NOT_FOUND',
          message: 'Cette vidéo TikTok est introuvable ou a été supprimée.',
        },
      };
    }

    const { html, sessionCookies } = pageSnapshot;

    if (
      html.includes('verify-bar') ||
      html.includes('captcha-disable') ||
      html.includes('SlardarWAF') ||
      html.includes('_wafchallengeid') ||
      pageSnapshot.responseStatus === 403
    ) {
      return {
        ok: false,
        platform: 'tiktok',
        error: {
          code: 'BLOCKED_BY_PLATFORM',
          message:
            'TikTok a temporairement activé un contrôle de sécurité (WAF). Veuillez réessayer dans quelques instants.',
        },
      };
    }

    let itemStruct: any = pageSnapshot.itemStruct;

    if (kind === 'profile') {
      const universalMatch = html.match(
        /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/i
      );
      if (universalMatch?.[1]) {
        try {
          const parsed = JSON.parse(universalMatch[1]);
          const defaultScope = parsed['__DEFAULT_SCOPE__'] || {};
          const userDetail = defaultScope['webapp.user-detail']?.userInfo;
          if (userDetail?.user) {
            const u = userDetail.user;
            const s = userDetail.stats;
            const avatar = String(
              u.avatarLarger || u.avatarMedium || u.avatarThumb || ''
            );
            if (avatar) {
              const uname = String(u.uniqueId || identifier || 'tiktok').replace(
                /^@/,
                ''
              );
              return {
                ok: true,
                platform: 'tiktok',
                type: 'profile',
                title: u.signature ? String(u.signature) : `@${uname}`,
                cookie: sessionCookies,
                author: {
                  username: uname,
                  nickname: String(u.nickname || `@${uname}`),
                  avatar,
                  followers: formatCount(s?.followerCount),
                  biography: u.signature ? String(u.signature) : undefined,
                  verified: Boolean(u.verified),
                },
                thumbnail: avatar,
                items: [
                  {
                    kind: 'image',
                    url: avatar,
                    cookie: sessionCookies,
                    quality: '1080p',
                    ext: 'jpg',
                  },
                ],
              };
            }
          }
        } catch {
          // Poursuivre
        }
      }
    }

    if (!itemStruct) {
      return {
        ok: false,
        platform: 'tiktok',
        error: {
          code: 'NOT_FOUND',
          message:
            'Impossible de lire les métadonnées de la vidéo TikTok. Vérifiez que le lien est public.',
        },
      };
    }

    if (itemStruct.privateItem === true || itemStruct.secret === true) {
      return {
        ok: false,
        platform: 'tiktok',
        error: {
          code: 'PRIVATE_OR_LOGIN_REQUIRED',
          message:
            'Cette vidéo TikTok provient d\'un compte privé ou est restreinte.',
        },
      };
    }

    const resolvedVideoId = String(itemStruct.id || identifier || '').trim() || undefined;
    const author = itemStruct.author || {};
    const username = String(author.uniqueId || 'tiktok_user').replace(/^@/, '');
    const nickname = String(author.nickname || `@${username}`);
    const avatar = String(
      author.avatarLarger || author.avatarMedium || author.avatarThumb || ''
    );
    const title = String(itemStruct.desc || itemStruct.title || `@${username}`);
    const cover = String(
      itemStruct.video?.originCover ||
        itemStruct.video?.cover ||
        itemStruct.video?.dynamicCover ||
        avatar
    );
    const duration = formatDuration(itemStruct.video?.duration);

    const pageMusicUrl = extractTikTokMusicUrl(itemStruct.music);
    const audioItem = await buildVerifiedTikTokAudioItem(
      pageMusicUrl,
      sessionCookies
    );

    const items: ExtractMediaItem[] = [];

    if (
      Array.isArray(itemStruct.imagePost?.images) &&
      itemStruct.imagePost.images.length > 0
    ) {
      itemStruct.imagePost.images.forEach((img: any) => {
        const imgUrl =
          img.displayImage?.urlList?.[0] ||
          img.thumbnail?.urlList?.[0] ||
          img.urlList?.[0];
        if (imgUrl) {
          items.push({
            kind: 'image',
            url: imgUrl,
            cookie: sessionCookies,
            thumbnail: imgUrl,
            quality: '1080p',
            ext: 'jpg',
          });
        }
      });

      if (audioItem) {
        items.push(audioItem);
      }

      return {
        ok: true,
        id: resolvedVideoId,
        platform: 'tiktok',
        type: 'carousel',
        title,
        duration,
        cookie: sessionCookies,
        author: {
          username,
          nickname,
          avatar,
          verified: Boolean(author.verified),
        },
        thumbnail: cover,
        items,
      };
    }

    const video = itemStruct.video || {};
    let videoStreamUrl = video.playAddr || video.downloadAddr || '';
    const backupStreamUrl = video.downloadAddr || video.playAddr || '';

    if (Array.isArray(video.bitrateInfo) && video.bitrateInfo.length > 0) {
      const bestBitrate = video.bitrateInfo[0];
      const candidate = bestBitrate?.PlayAddr?.UrlList?.[0];
      if (candidate) {
        videoStreamUrl = candidate;
      }
    }

    if (!videoStreamUrl) {
      return {
        ok: false,
        platform: 'tiktok',
        error: {
          code: 'NOT_FOUND',
          message: 'Flux vidéo introuvable dans la publication TikTok.',
        },
      };
    }

    items.push({
      kind: 'video',
      url: videoStreamUrl,
      backupUrl:
        backupStreamUrl && backupStreamUrl !== videoStreamUrl
          ? backupStreamUrl
          : undefined,
      cookie: sessionCookies,
      quality: '1080p',
      ext: 'mp4',
      size: formatBytesToMb(video.size),
      width: video.width || undefined,
      height: video.height || undefined,
    });

    if (audioItem) {
      items.push(audioItem);
    }

    return {
      ok: true,
      id: resolvedVideoId,
      platform: 'tiktok',
      type: 'video',
      title,
      duration,
      cookie: sessionCookies,
      author: {
        username,
        nickname,
        avatar,
        verified: Boolean(author.verified),
      },
      thumbnail: cover,
      items,
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return {
        ok: false,
        platform: 'tiktok',
        error: {
          code: 'TIMEOUT',
          message: 'Le délai d\'attente a expiré lors de la connexion à TikTok.',
        },
      };
    }
    return {
      ok: false,
      platform: 'tiktok',
      error: {
        code: 'BLOCKED_BY_PLATFORM',
        message:
          err instanceof Error
            ? `Erreur lors de l'extraction TikTok : ${err.message}`
            : 'Erreur inattendue lors de l\'extraction TikTok.',
      },
    };
  }
}
