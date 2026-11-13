/**
 * Extracteur X / Twitter 100 % gratuit (zéro API tierce, zéro clé, zéro domaine miroir).
 *
 * Source unique : Endpoint public de syndication d'embed officiel de X :
 * `GET https://cdn.syndication.twimg.com/tweet-result?id={ID}&token={TOKEN}&lang=en`
 */

import { BROWSER_USER_AGENT, fetchWithTimeout, isTimeoutError } from './http.ts';
import type { ErrorCode, ExtractMediaItem, ExtractResponse } from './normalize.ts';

const X_SYNDICATION_TIMEOUT_MS = 8000;
const TCO_RESOLVE_TIMEOUT_MS = 4000;
const TCO_MAX_REDIRECTS = 3;

/**
 * Calcule le jeton de syndication public utilisé par le widget d'embed officiel de X.
 * Formule connue : ((Number(ID) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '')
 */
export function computeSyndicationToken(tweetId: string): string {
  const num = Number(tweetId);
  if (!Number.isFinite(num) || num <= 0) return '1';
  const token = ((num / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
  return token || '1';
}

/**
 * Résout un lien court `https://t.co/{code}` en suivant manuellement jusqu'à 3 redirections
 * avec un timeout court (4 s). Supporte à la fois l'en-tête HTTP `Location` (301/302) et
 * la balise `<meta http-equiv="refresh" content="0;URL=...">` parfois renvoyée par t.co.
 */
export async function resolveTcoShortLink(
  shortUrl: string,
  maxRedirects = TCO_MAX_REDIRECTS,
  timeoutMs = TCO_RESOLVE_TIMEOUT_MS
): Promise<string | null> {
  let currentUrl = shortUrl.trim();
  if (!/^https?:\/\//i.test(currentUrl)) {
    currentUrl = `https://${currentUrl}`;
  }

  for (let hop = 0; hop < maxRedirects; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      return null;
    }

    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 't.co') {
      return currentUrl;
    }

    try {
      const response = await fetchWithTimeout(
        currentUrl,
        {
          method: 'GET',
          redirect: 'manual',
          headers: {
            'User-Agent': 'curl/8.5.0',
            Accept: '*/*',
          },
        },
        timeoutMs
      );

      if (
        response.status === 301 ||
        response.status === 302 ||
        response.status === 303 ||
        response.status === 307 ||
        response.status === 308
      ) {
        const location = response.headers.get('Location');
        if (!location) return null;
        const nextUrl = new URL(location, parsed).toString();
        const nextHost = new URL(nextUrl).hostname.toLowerCase().replace(/^www\./, '');
        if (nextHost !== 't.co') {
          return nextUrl;
        }
        currentUrl = nextUrl;
        continue;
      }

      if (response.status === 200) {
        const html = await response.text();
        const metaMatch =
          html.match(/URL=([^"'>\s]+)/i) ||
          html.match(/location\.replace\(["']([^"']+)["']\)/i) ||
          html.match(/<title>(https?:\/\/[^<]+)<\/title>/i);
        if (metaMatch?.[1]) {
          const decoded = metaMatch[1].replace(/&amp;/g, '&').trim();
          const nextHost = new URL(decoded).hostname.toLowerCase().replace(/^www\./, '');
          if (nextHost !== 't.co') {
            return decoded;
          }
          currentUrl = decoded;
          continue;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  return null;
}

function fail(
  code: ErrorCode,
  message: string,
  meta?: { engineStage?: string; httpStatus?: number | null; engineFn?: string }
): ExtractResponse {
  return {
    ok: false,
    platform: 'x',
    engineStage: meta?.engineStage ?? 'syndication',
    httpStatus: meta?.httpStatus !== undefined ? meta.httpStatus : null,
    engineFn: meta?.engineFn ?? 'x.syndication',
    error: { code, message },
  };
}

function formatDurationMillis(ms?: number): string | undefined {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return undefined;
  const totalSec = Math.max(1, Math.round(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function cleanAndTruncateTweetText(rawText: string | undefined, fallbackUsername: string): string {
  const cleaned = String(rawText || '')
    .replace(/https?:\/\/t\.co\/[A-Za-z0-9]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return `Publication X de @${fallbackUsername}`;
  }
  if (cleaned.length <= 100) {
    return cleaned;
  }
  return `${cleaned.slice(0, 97).trimEnd()}...`;
}

function ensureOrigImageUrl(mediaUrlHttps: string): { url: string; ext: string } {
  const raw = mediaUrlHttps.trim();
  const extMatch = raw.match(/\.([a-zA-Z0-9]{3,4})(?:$|\?)/);
  const ext = (extMatch?.[1] || 'jpg').toLowerCase() === 'png' ? 'png' : 'jpg';

  try {
    const u = new URL(raw);
    u.searchParams.set('name', 'orig');
    return { url: u.toString(), ext };
  } catch {
    const separator = raw.includes('?') ? '&' : '?';
    return { url: `${raw}${separator}name=orig`, ext };
  }
}

export interface ParsedMp4Variant {
  url: string;
  bitrate: number;
  quality: string;
  width?: number;
  height?: number;
}

/**
 * Filtre uniquement les variantes `video/mp4` (ignore les playlists `.m3u8`),
 * les trie par bitrate décroissant et déduit la résolution depuis l'URL (`/(\d+)x(\d+)/`).
 */
export function parseMp4Variants(
  variants: Array<{ content_type?: string; bitrate?: number; url?: string }>,
  fallbackWidth?: number,
  fallbackHeight?: number,
  isAnimatedGif = false
): ParsedMp4Variant[] {
  const mp4Only = (variants || []).filter(
    (v) =>
      v &&
      v.content_type === 'video/mp4' &&
      typeof v.url === 'string' &&
      v.url.startsWith('https://')
  );

  mp4Only.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));

  const results: ParsedMp4Variant[] = [];
  const seenQualities = new Set<string>();

  for (const variant of mp4Only) {
    const url = variant.url!.trim();
    const resMatch = url.match(/\/(\d+)x(\d+)\//);
    let width = fallbackWidth;
    let height = fallbackHeight;
    let quality = isAnimatedGif ? 'GIF MP4' : 'HD';

    if (resMatch) {
      width = Number(resMatch[1]);
      height = Number(resMatch[2]);
      const shortEdge = Math.min(width, height);
      quality = `${shortEdge}p`;
    } else if (fallbackWidth && fallbackHeight) {
      quality = `${Math.min(fallbackWidth, fallbackHeight)}p`;
    }

    if (seenQualities.has(quality)) {
      continue;
    }
    seenQualities.add(quality);

    results.push({
      url,
      bitrate: variant.bitrate ?? 0,
      quality,
      width,
      height,
    });
  }

  return results;
}

/**
 * Parse la charge utile JSON de `cdn.syndication.twimg.com/tweet-result` en `ExtractResponse`.
 * Exporté pour permettre des tests unitaires déterministes sur tous les cas de figure.
 */
export function parseSyndicationTweetPayload(
  data: Record<string, any> | null,
  tweetId: string,
  httpStatus = 200
): ExtractResponse {
  const meta = { engineStage: 'syndication', httpStatus, engineFn: 'x.syndication' };
  if (!data || typeof data !== 'object') {
    return fail(
      'BLOCKED_BY_PLATFORM',
      'Réponse vide ou invalide reçue depuis le service de syndication X.',
      meta
    );
  }

  // Tombstone / compte protégé / suspendu / restreint par l'âge
  if (
    data.__typename === 'TweetTombstone' ||
    data.tombstone ||
    data.reason === 'Protected' ||
    data.reason === 'Suspended' ||
    data.reason === 'NsfwViewerIsLoggedOut'
  ) {
    const tombstoneText: string =
      data.tombstone?.text?.text ||
      'Ce tweet est privé, supprimé ou soumis à une restriction d’âge sur X.';
    if (
      tombstoneText.toLowerCase().includes('age-restricted') ||
      tombstoneText.toLowerCase().includes('sensitive') ||
      data.reason === 'NsfwViewerIsLoggedOut'
    ) {
      return fail(
        'PRIVATE_OR_LOGIN_REQUIRED',
        'Ce tweet contient un média sensible ou restreint par l’âge qui nécessite une connexion sur X.',
        meta
      );
    }
    return fail(
      'PRIVATE_OR_LOGIN_REQUIRED',
      'Ce tweet provient d’un compte privé, protégé ou restreint sur X.',
      meta
    );
  }

  // Objet vide `{}` => Tweet introuvable / supprimé
  if (!data.__typename && !data.id_str && !data.text && !data.user) {
    return fail('NOT_FOUND', 'Ce tweet est introuvable ou a été supprimé.', meta);
  }

  const username = String(data.user?.screen_name || 'x_user').replace(/^@/, '');
  const nickname = String(data.user?.name || username);
  const rawAvatar =
    typeof data.user?.profile_image_url_https === 'string'
      ? data.user.profile_image_url_https.replace('_normal.', '_400x400.')
      : undefined;
  const verified = Boolean(data.user?.verified || data.user?.is_blue_verified);
  const title = cleanAndTruncateTweetText(data.text, username);

  // V1 : On lit uniquement mediaDetails du tweet principal (on ignore quoted_tweet)
  const mediaDetails: Array<Record<string, any>> = Array.isArray(data.mediaDetails)
    ? data.mediaDetails
    : [];

  if (mediaDetails.length === 0) {
    // Si le tweet est marqué sensible mais que la syndication a masqué mediaDetails
    if (data.possibly_sensitive === true) {
      return fail(
        'PRIVATE_OR_LOGIN_REQUIRED',
        'Ce tweet contient un média sensible ou restreint par l’âge qui ne peut pas être extrait sans session X.',
        meta
      );
    }
    return fail('NO_MEDIA', 'Ce tweet ne contient ni vidéo ni image.', meta);
  }

  // Vérification de disponibilité des médias (ex: DMCA / indisponible / sensible bloqué)
  const availableMedia = mediaDetails.filter((m) => {
    const status = m?.ext_media_availability?.status;
    return !status || status === 'Available';
  });

  if (availableMedia.length === 0) {
    return fail(
      'PRIVATE_OR_LOGIN_REQUIRED',
      'Le média de ce tweet est restreint, sensible ou indisponible publiquement.',
      meta
    );
  }

  const author = {
    username,
    nickname,
    avatar: rawAvatar,
    verified,
  };

  // Cas 1 : Plusieurs médias dans le tweet => Carrousel
  if (availableMedia.length > 1) {
    const carouselItems: ExtractMediaItem[] = [];
    for (const m of availableMedia) {
      const mType = String(m.type || '');
      const width = Number(m.original_info?.width || m.sizes?.large?.w) || undefined;
      const height = Number(m.original_info?.height || m.sizes?.large?.h) || undefined;
      const thumb = typeof m.media_url_https === 'string' ? m.media_url_https : undefined;

      if (mType === 'video' || mType === 'animated_gif') {
        const variants = parseMp4Variants(
          m.video_info?.variants || [],
          width,
          height,
          mType === 'animated_gif'
        );
        const best = variants[0];
        if (best) {
          carouselItems.push({
            kind: 'video',
            url: best.url,
            thumbnail: thumb,
            quality: best.quality,
            ext: 'mp4',
            width: best.width,
            height: best.height,
          });
        }
      } else if (mType === 'photo' && thumb) {
        const { url: origUrl, ext } = ensureOrigImageUrl(thumb);
        carouselItems.push({
          kind: 'image',
          url: origUrl,
          thumbnail: thumb,
          quality: 'Original',
          ext,
          width,
          height,
        });
      }
    }

    if (carouselItems.length === 0) {
      return fail('NO_MEDIA', 'Ce tweet ne contient ni vidéo ni image téléchargeable.', meta);
    }

    return {
      ok: true,
      platform: 'x',
      type: 'carousel',
      title,
      engineStage: 'syndication',
      httpStatus,
      engineFn: 'x.syndication',
      author,
      thumbnail: carouselItems[0].thumbnail || carouselItems[0].url,
      items: carouselItems,
    };
  }

  // Cas 2 : Un seul média (vidéo, GIF animé ou photo unique)
  const singleMedia = availableMedia[0];
  const mType = String(singleMedia.type || '');
  const origW = Number(singleMedia.original_info?.width || singleMedia.sizes?.large?.w) || undefined;
  const origH = Number(singleMedia.original_info?.height || singleMedia.sizes?.large?.h) || undefined;
  const mediaThumb =
    typeof singleMedia.media_url_https === 'string'
      ? singleMedia.media_url_https
      : typeof data.video?.poster === 'string'
      ? data.video.poster
      : undefined;

  if (mType === 'video' || mType === 'animated_gif') {
    const variants = parseMp4Variants(
      singleMedia.video_info?.variants || data.video?.variants || [],
      origW,
      origH,
      mType === 'animated_gif'
    );

    if (variants.length === 0) {
      if (data.possibly_sensitive) {
        return fail(
          'PRIVATE_OR_LOGIN_REQUIRED',
          'Cette vidéo X est restreinte par l’âge ou marquée comme contenu sensible.',
          meta
        );
      }
      return fail('NO_MEDIA', 'Aucune variante vidéo MP4 trouvée dans ce tweet.', meta);
    }

    const duration = formatDurationMillis(
      singleMedia.video_info?.duration_millis ?? data.video?.durationMs
    );

    const videoItems: ExtractMediaItem[] = variants.map((v) => ({
      kind: 'video',
      url: v.url,
      thumbnail: mediaThumb,
      quality: v.quality,
      ext: 'mp4',
      width: v.width,
      height: v.height,
    }));

    return {
      ok: true,
      platform: 'x',
      type: 'video',
      title,
      duration,
      engineStage: 'syndication',
      httpStatus,
      engineFn: 'x.syndication',
      author,
      thumbnail: mediaThumb,
      items: videoItems,
    };
  }

  if (mType === 'photo' && mediaThumb) {
    const { url: origUrl, ext } = ensureOrigImageUrl(mediaThumb);
    return {
      ok: true,
      platform: 'x',
      type: 'image',
      title,
      engineStage: 'syndication',
      httpStatus,
      engineFn: 'x.syndication',
      author,
      thumbnail: mediaThumb,
      items: [
        {
          kind: 'image',
          url: origUrl,
          thumbnail: mediaThumb,
          quality: origW && origH ? `${Math.min(origW, origH)}p` : 'Original',
          ext,
          width: origW,
          height: origH,
        },
      ],
    };
  }

  return fail('NO_MEDIA', `Ce tweet (${tweetId}) ne contient ni vidéo ni image.`, meta);
}

/**
 * Extrait un tweet X / Twitter via l'endpoint public d'embed syndication (`cdn.syndication.twimg.com`).
 */
export async function extractX(tweetId: string): Promise<ExtractResponse> {
  const cleanId = String(tweetId || '').trim();
  if (!/^\d+$/.test(cleanId)) {
    return fail('UNSUPPORTED_URL', 'Identifiant de tweet X invalide.', {
      engineStage: 'validate',
      httpStatus: null,
      engineFn: 'x.syndication',
    });
  }

  const token = computeSyndicationToken(cleanId);
  const endpointUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${encodeURIComponent(
    cleanId
  )}&token=${encodeURIComponent(token)}&lang=en`;

  let response: Response;
  try {
    response = await fetchWithTimeout(
      endpointUrl,
      {
        method: 'GET',
        headers: {
          'User-Agent': BROWSER_USER_AGENT,
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: 'https://platform.twitter.com/',
          Origin: 'https://platform.twitter.com',
        },
      },
      X_SYNDICATION_TIMEOUT_MS
    );
  } catch (err) {
    if (isTimeoutError(err)) {
      return fail(
        'TIMEOUT',
        'Le délai de 8 secondes a été dépassé lors de la connexion à X (Twitter).',
        { engineStage: 'syndication', httpStatus: null, engineFn: 'x.syndication' }
      );
    }
    return fail(
      'BLOCKED_BY_PLATFORM',
      'Impossible de joindre le serveur de syndication X (Twitter).',
      { engineStage: 'syndication', httpStatus: null, engineFn: 'x.syndication' }
    );
  }

  const status = response.status;
  const meta = { engineStage: 'syndication', httpStatus: status, engineFn: 'x.syndication' };

  if (status === 404) {
    return fail('NOT_FOUND', 'Tweet introuvable ou supprimé sur X (Twitter).', meta);
  }

  if (status === 429 || status === 403 || status === 401) {
    return fail(
      'BLOCKED_BY_PLATFORM',
      'X (Twitter) a temporairement limité les requêtes publiques. Veuillez réessayer dans quelques instants.',
      meta
    );
  }

  if (!response.ok) {
    return fail(
      'BLOCKED_BY_PLATFORM',
      `Erreur inattendue de X (HTTP ${status}).`,
      meta
    );
  }

  const rawText = await response.text().catch(() => '');
  if (!rawText || !rawText.trim()) {
    return fail('BLOCKED_BY_PLATFORM', 'X (Twitter) a renvoyé une réponse vide.', meta);
  }

  let data: Record<string, any> | null = null;
  try {
    data = JSON.parse(rawText);
  } catch {
    return fail('BLOCKED_BY_PLATFORM', 'Réponse JSON invalide reçue depuis X.', meta);
  }

  return parseSyndicationTweetPayload(data, cleanId, status);
}
