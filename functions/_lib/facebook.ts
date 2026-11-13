/**
 * Extracteur Facebook (Vidéos & Reels publics) 100 % gratuit, sans API tierce et sans compte.
 *
 * Architecture à 2 niveaux :
 * - Niveau 1 : Récupération de la page vidéo desktop (`www.facebook.com`) avec en-têtes navigateur
 *   réalistes (`User-Agent`, `Accept-Language`, `Sec-Fetch-*`), timeout 8 s, redirections suivies (max 4 sauts)
 *   et revalidées contre la liste d'hôtes Facebook (anti-SSRF).
 * - Niveau 2 : Repli automatique sur la version mobile (`m.facebook.com`) et l'embed officiel Facebook
 *   (`www.facebook.com/plugins/video.php`) avec les mêmes extracteurs multi-motifs.
 *
 * Extraction multi-motifs :
 * - Qualité HD : `browser_native_hd_url`, `playable_url_quality_hd`, `hd_src_no_ratelimit`, `hd_src`
 * - Qualité SD : `browser_native_sd_url`, `playable_url`, `sd_src_no_ratelimit`, `sd_src`, `og:video`
 * - Décodage complet des échappements JSON (`\u0025`, `\/`, `\u0026`) et entités HTML (`&amp;`, `&#x3a;`).
 * - Dédoublonnage automatique si l'URL HD est identique à l'URL SD.
 */

import { isAllowedMediaHost } from './allowlist.ts';
import { isAllowedFacebookHost } from './detect.ts';
import { BROWSER_USER_AGENT, fetchWithTimeout, isTimeoutError } from './http.ts';
import type { ErrorCode, ExtractMediaItem, ExtractResponse } from './normalize.ts';

const FACEBOOK_TIMEOUT_MS = 8000;
const FB_SHORTLINK_TIMEOUT_MS = 5000;
const FB_MAX_REDIRECTS = 4;

const FB_NAVIGATION_HEADERS: Record<string, string> = {
  'User-Agent': BROWSER_USER_AGENT,
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

function fail(
  code: ErrorCode,
  message: string,
  meta?: { engineStage?: string; httpStatus?: number | null; engineFn?: string }
): ExtractResponse {
  return {
    ok: false,
    platform: 'facebook',
    engineStage: meta?.engineStage,
    httpStatus: meta?.httpStatus !== undefined ? meta.httpStatus : null,
    engineFn: meta?.engineFn,
    error: { code, message },
  };
}

/**
 * Décode les échappements JSON (`\/`, `\u0025`, `\u0026`, etc.) et entités HTML (`&amp;`, `&#x...;`)
 * présents dans les scripts embarqués de Facebook.
 */
export function decodeFacebookEscapedString(raw: string): string {
  if (!raw) return '';
  let decoded = raw.trim();

  // 1. Décodage des séquences JSON (\uXXXX et \/)
  try {
    const safeJson = `"${decoded.replace(/(?<!\\)"/g, '\\"')}"`;
    decoded = JSON.parse(safeJson);
  } catch {
    decoded = decoded
      .replace(/\\\//g, '/')
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      );
  }

  // 2. Décodage des entités HTML courantes
  decoded = decoded
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));

  return decoded.trim();
}

/**
 * Vérifie qu'une candidate URL décodée est une URL HTTPS valide hébergée sur un CDN Facebook autorisé.
 */
export function extractValidFbCdnUrl(rawCandidate: string | undefined | null): string | null {
  if (!rawCandidate) return null;
  const decoded = decodeFacebookEscapedString(rawCandidate);
  if (!decoded.startsWith('https://')) return null;

  try {
    const parsed = new URL(decoded);
    if (!isAllowedMediaHost(parsed.hostname)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export const FB_STORY_LOGIN_REQUIRED_MESSAGE =
  'Les stories Facebook exigent une connexion : elles ne peuvent pas être téléchargées sans compte.';

export interface FacebookRedirectResolution {
  ok: boolean;
  finalUrl?: string;
  errorCode?: ErrorCode;
  errorMessage?: string;
  rawStatus?: number;
}

/**
 * Vérifie si une URL correspond à une story Facebook (`/stories/...`, `/story.php?story_fbid=...`, `/share/s/...`)
 * ou à une redirection `/login?next=` menant à une story.
 */
export function isFacebookStoryUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    const p = u.pathname.toLowerCase();
    if (
      /^\/stories\/[^/?#]+/i.test(p) ||
      p === '/stories' ||
      p === '/stories/' ||
      ((p === '/story.php' || p === '/permalink.php') && u.searchParams.has('story_fbid')) ||
      /^\/share\/s\/[^/?#]+/i.test(p)
    ) {
      return true;
    }
    const nextParam = u.searchParams.get('next');
    if (nextParam) {
      const nextUrl = new URL(nextParam, 'https://www.facebook.com');
      const nextPath = nextUrl.pathname.toLowerCase();
      if (
        /^\/stories\/[^/?#]+/i.test(nextPath) ||
        nextPath === '/stories' ||
        nextPath === '/stories/' ||
        ((nextPath === '/story.php' || nextPath === '/permalink.php') &&
          nextUrl.searchParams.has('story_fbid')) ||
        /^\/share\/s\/[^/?#]+/i.test(nextPath)
      ) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function extractStoryUrlFromLoginRedirect(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    const nextParam = u.searchParams.get('next');
    if (!nextParam) return null;
    const nextUrl = new URL(nextParam, 'https://www.facebook.com');
    if (isFacebookStoryUrl(nextUrl.toString())) {
      return nextUrl.toString();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Vérifie si une URL correspond à une redirection vers le mur de connexion ou checkpoint Facebook.
 */
export function isFacebookLoginOrCheckpointUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    const p = u.pathname.toLowerCase();
    return (
      p === '/login' ||
      p.startsWith('/login/') ||
      p.startsWith('/login.php') ||
      p.startsWith('/checkpoint/') ||
      p.includes('/recover/') ||
      u.searchParams.has('next') && p.includes('login')
    );
  } catch {
    return false;
  }
}

/**
 * Résout un lien Facebook (notamment `fb.watch/{code}`, `/share/v/{code}`, `/share/r/{code}`)
 * en suivant manuellement jusqu'à 4 redirections avec validation anti-SSRF stricte à chaque saut.
 */
export async function resolveFacebookRedirect(
  initialUrl: string,
  maxRedirects = FB_MAX_REDIRECTS,
  timeoutMs = FB_SHORTLINK_TIMEOUT_MS
): Promise<FacebookRedirectResolution> {
  let currentUrl = initialUrl.trim();
  if (!/^https?:\/\//i.test(currentUrl)) {
    currentUrl = `https://${currentUrl}`;
  }

  for (let hop = 0; hop <= maxRedirects; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      return {
        ok: false,
        errorCode: 'UNSUPPORTED_URL',
        errorMessage: 'URL Facebook malformée.',
      };
    }

    if (
      (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
      !isAllowedFacebookHost(parsed.hostname)
    ) {
      return {
        ok: false,
        errorCode: 'UNSUPPORTED_URL',
        errorMessage: `Redirection bloquée vers un hôte externe non autorisé (${parsed.hostname}).`,
      };
    }

    if (isFacebookLoginOrCheckpointUrl(parsed.toString())) {
      const isCheckpoint = parsed.pathname.toLowerCase().includes('checkpoint');
      const storyTarget = extractStoryUrlFromLoginRedirect(parsed.toString());
      return {
        ok: false,
        finalUrl: storyTarget || parsed.toString(),
        errorCode: isCheckpoint ? 'BLOCKED_BY_PLATFORM' : 'PRIVATE_OR_LOGIN_REQUIRED',
        errorMessage: isCheckpoint
          ? 'Facebook a renvoyé un contrôle de sécurité (checkpoint/captcha).'
          : storyTarget
          ? FB_STORY_LOGIN_REQUIRED_MESSAGE
          : "Cette vidéo n'est pas publique ou Facebook demande une connexion. Seules les vidéos publiques peuvent être téléchargées.",
      };
    }

    // Si on a déjà atteint une URL de story (/stories/... ou /story.php?story_fbid=...), on la renvoie immédiatement pour reclassement
    if (
      hop > 0 &&
      isFacebookStoryUrl(parsed.toString()) &&
      !/^\/share\/s\//i.test(parsed.pathname)
    ) {
      return { ok: true, finalUrl: parsed.toString() };
    }

    if (hop === maxRedirects) {
      break;
    }

    try {
      const response = await fetchWithTimeout(
        parsed.toString(),
        {
          method: 'GET',
          redirect: 'manual',
          headers: FB_NAVIGATION_HEADERS,
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
        if (!location) {
          return { ok: true, finalUrl: parsed.toString(), rawStatus: response.status };
        }
        const nextUrl = new URL(location, parsed);
        if (!isAllowedFacebookHost(nextUrl.hostname)) {
          return {
            ok: false,
            errorCode: 'UNSUPPORTED_URL',
            errorMessage: `Redirection Facebook vers un domaine non autorisé (${nextUrl.hostname}).`,
          };
        }
        if (isFacebookLoginOrCheckpointUrl(nextUrl.toString())) {
          const isCheckpoint = nextUrl.pathname.toLowerCase().includes('checkpoint');
          const storyTarget = extractStoryUrlFromLoginRedirect(nextUrl.toString());
          return {
            ok: false,
            finalUrl: storyTarget || nextUrl.toString(),
            errorCode: isCheckpoint ? 'BLOCKED_BY_PLATFORM' : 'PRIVATE_OR_LOGIN_REQUIRED',
            errorMessage: isCheckpoint
              ? 'Facebook a renvoyé un contrôle de sécurité (checkpoint).'
              : storyTarget
              ? FB_STORY_LOGIN_REQUIRED_MESSAGE
              : "Cette vidéo n'est pas publique ou Facebook demande une connexion. Seules les vidéos publiques peuvent être téléchargées.",
            rawStatus: response.status,
          };
        }
        if (
          isFacebookStoryUrl(nextUrl.toString()) &&
          !/^\/share\/s\//i.test(nextUrl.pathname)
        ) {
          return {
            ok: true,
            finalUrl: nextUrl.toString(),
            rawStatus: response.status,
          };
        }
        currentUrl = nextUrl.toString();
        continue;
      }

      // Vérifie si une page 200 contient un meta-refresh vers une URL Facebook
      if (response.status === 200) {
        const hostLower = parsed.hostname.toLowerCase().replace(/^www\./, '');
        const isShortPath =
          hostLower === 'fb.watch' ||
          parsed.pathname.startsWith('/share/v/') ||
          parsed.pathname.startsWith('/share/r/') ||
          parsed.pathname.startsWith('/share/s/') ||
          parsed.pathname.startsWith('/share/');
        if (isShortPath) {
          const html = await response.text().catch(() => '');
          const refreshMatch =
            html.match(/http-equiv=["']refresh["'][^>]+content=["']\d+;\s*url=([^"']+)["']/i) ||
            html.match(/content=["']\d+;\s*url=([^"']+)["'][^>]+http-equiv=["']refresh["']/i) ||
            html.match(/window\.location\.replace\(["']([^"']+)["']\)/i);
          if (refreshMatch?.[1]) {
            const refreshedUrl = new URL(
              decodeFacebookEscapedString(refreshMatch[1]),
              parsed
            );
            if (!isAllowedFacebookHost(refreshedUrl.hostname)) {
              return {
                ok: false,
                errorCode: 'UNSUPPORTED_URL',
                errorMessage: 'Redirection meta-refresh vers un domaine externe refusée.',
              };
            }
            if (isFacebookLoginOrCheckpointUrl(refreshedUrl.toString())) {
              return {
                ok: false,
                errorCode: 'PRIVATE_OR_LOGIN_REQUIRED',
                errorMessage:
                  "Cette vidéo n'est pas publique ou Facebook demande une connexion. Seules les vidéos publiques peuvent être téléchargées.",
              };
            }
            currentUrl = refreshedUrl.toString();
            continue;
          }
        }
      }

      return { ok: true, finalUrl: parsed.toString(), rawStatus: response.status };
    } catch (err) {
      if (isTimeoutError(err)) {
        return {
          ok: false,
          errorCode: 'TIMEOUT',
          errorMessage: 'Délai dépassé lors de la résolution du lien de partage Facebook.',
        };
      }
      return {
        ok: false,
        errorCode: 'BLOCKED_BY_PLATFORM',
        errorMessage: 'Impossible de résoudre le lien de partage Facebook.',
      };
    }
  }

  return { ok: true, finalUrl: currentUrl };
}

function cleanFacebookTitle(rawTitle: string | undefined, authorName: string): string {
  if (!rawTitle) return `Vidéo Facebook de ${authorName}`;
  let cleaned = decodeFacebookEscapedString(rawTitle)
    .replace(/\s*\|\s*Facebook\s*$/i, '')
    .replace(/\s*-\s*Facebook\s*$/i, '')
    .replace(/^(?:[\d.,]+[KMBkmb]?\s*(?:views|vues|reproducciones)\s*[·•|-]\s*)+/i, '')
    .replace(/^(?:[\d.,]+[KMBkmb]?\s*(?:reactions|réactions|likes|j’aime)\s*[·•|-]\s*)+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (
    !cleaned ||
    cleaned.toLowerCase() === 'facebook' ||
    cleaned.toLowerCase() === 'watch' ||
    cleaned.toLowerCase() === 'discover popular videos'
  ) {
    return `Vidéo Facebook de ${authorName}`;
  }

  if (cleaned.length > 110) {
    cleaned = `${cleaned.slice(0, 107).trimEnd()}...`;
  }
  return cleaned;
}

function formatDurationSeconds(sec: number | undefined): string | undefined {
  if (typeof sec !== 'number' || !Number.isFinite(sec) || sec <= 0) return undefined;
  const rounded = Math.max(1, Math.round(sec));
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Parse le HTML (et les blocs JSON Relay embarqués) d'une page Facebook (desktop, mobile ou embed)
 * pour en extraire les flux MP4 HD / SD, le titre, l'auteur et la miniature.
 */
export function parseFacebookHtmlPayload(
  html: string,
  _videoId = 'video',
  finalUrl = ''
): ExtractResponse {
  if (!html || !html.trim()) {
    return fail('BLOCKED_BY_PLATFORM', 'Facebook a renvoyé une réponse vide.');
  }

  if (finalUrl && isFacebookLoginOrCheckpointUrl(finalUrl)) {
    const isCheckpoint = finalUrl.toLowerCase().includes('checkpoint');
    return fail(
      isCheckpoint ? 'BLOCKED_BY_PLATFORM' : 'PRIVATE_OR_LOGIN_REQUIRED',
      isCheckpoint
        ? 'Facebook a renvoyé une vérification de sécurité (checkpoint/captcha).'
        : "Cette vidéo n'est pas publique ou Facebook demande une connexion. Seules les vidéos publiques peuvent être téléchargées."
    );
  }

  const lowerHtml = html.toLowerCase();

  // Si Facebook redirige une vidéo supprimée/inexistante vers le flux générique "Discover Popular Videos"
  // ou affiche explicitement que la vidéo n'est plus disponible, ne pas extraire une vidéo aléatoire du flux suggéré.
  const isDiscoverPopularFallback =
    /<title[^>]*>\s*discover popular videos\s*\|\s*facebook\s*<\/title>/i.test(html) ||
    /property=["']og:title["'][^>]+content=["']discover popular videos\s*\|\s*facebook["']/i.test(
      html
    ) ||
    lowerHtml.includes("this video isn't available anymore") ||
    lowerHtml.includes('this video isn&#039;t available anymore') ||
    lowerHtml.includes('this video may no longer exist') ||
    lowerHtml.includes('cette vidéo n’existe peut-être plus') ||
    lowerHtml.includes("cette vidéo n'existe peut-être plus");

  if (isDiscoverPopularFallback) {
    return fail(
      'NOT_FOUND',
      'Cette vidéo Facebook est introuvable ou a été supprimée.'
    );
  }

  // 1. Recherche multi-motifs pour la version HD
  const hdPatterns: RegExp[] = [
    /"browser_native_hd_url"\s*:\s*"([^"]+)"/i,
    /"playable_url_quality_hd"\s*:\s*"([^"]+)"/i,
    /"hd_src_no_ratelimit"\s*:\s*"([^"]+)"/i,
    /"hd_src"\s*:\s*"([^"]+)"/i,
    /\bhd_src\s*:\s*"([^"]+)"/i,
  ];

  // 2. Recherche multi-motifs pour la version SD
  const sdPatterns: RegExp[] = [
    /"browser_native_sd_url"\s*:\s*"([^"]+)"/i,
    /"playable_url"\s*:\s*"([^"]+)"/i,
    /"sd_src_no_ratelimit"\s*:\s*"([^"]+)"/i,
    /"sd_src"\s*:\s*"([^"]+)"/i,
    /\bsd_src\s*:\s*"([^"]+)"/i,
    /<meta[^>]+property=["']og:video(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::secure_url|:url)?["']/i,
  ];

  let hdUrl: string | null = null;
  for (const regex of hdPatterns) {
    const match = html.match(regex);
    if (match?.[1] && match[1] !== 'null') {
      const valid = extractValidFbCdnUrl(match[1]);
      if (valid) {
        hdUrl = valid;
        break;
      }
    }
  }

  let sdUrl: string | null = null;
  for (const regex of sdPatterns) {
    const match = html.match(regex);
    if (match?.[1] && match[1] !== 'null') {
      const valid = extractValidFbCdnUrl(match[1]);
      if (valid) {
        sdUrl = valid;
        break;
      }
    }
  }

  // Si aucune URL vidéo n'a été trouvée, diagnostiquer précisément la cause
  if (!hdUrl && !sdUrl) {
    // Détection checkpoint / captcha
    if (
      lowerHtml.includes('/checkpoint/') ||
      lowerHtml.includes('security check') ||
      lowerHtml.includes('captcha')
    ) {
      return fail(
        'BLOCKED_BY_PLATFORM',
        'Facebook a demandé une vérification anti-robot (checkpoint/captcha).'
      );
    }

    // Détection vidéo supprimée ou introuvable
    if (
      lowerHtml.includes('this video may no longer exist') ||
      lowerHtml.includes("this video isn't available") ||
      lowerHtml.includes('this video isn&#039;t available') ||
      lowerHtml.includes('this video is no longer available') ||
      lowerHtml.includes("this content isn't available") ||
      lowerHtml.includes('this content isn&#039;t available') ||
      lowerHtml.includes('page not found') ||
      lowerHtml.includes('this page isn&#039;t available') ||
      lowerHtml.includes("this page isn't available") ||
      lowerHtml.includes('discover popular videos | facebook') ||
      lowerHtml.includes('ce contenu n’est pas disponible') ||
      lowerHtml.includes("ce contenu n'est pas disponible") ||
      lowerHtml.includes('cette vidéo n’est plus disponible') ||
      lowerHtml.includes("cette vidéo n'est plus disponible")
    ) {
      return fail(
        'NOT_FOUND',
        'Cette vidéo Facebook est introuvable ou a été supprimée.'
      );
    }

    // Détection mur de connexion / vidéo privée / groupe privé / restriction d'âge
    if (
      lowerHtml.includes('you must log in to continue') ||
      lowerHtml.includes('log in to facebook') ||
      lowerHtml.includes('log into facebook') ||
      lowerHtml.includes('connectez-vous à facebook') ||
      lowerHtml.includes('vous devez vous connecter') ||
      lowerHtml.includes('caafetamanualloginrenderer') ||
      lowerHtml.includes('login_form') ||
      lowerHtml.includes('private group') ||
      lowerHtml.includes('age-restricted')
    ) {
      return fail(
        'PRIVATE_OR_LOGIN_REQUIRED',
        "Cette vidéo n'est pas publique ou Facebook demande une connexion. Seules les vidéos publiques peuvent être téléchargées."
      );
    }

    return fail('NO_MEDIA', 'Aucune vidéo publique détectée sur cette page Facebook.');
  }

  // 3. Extraction de l'auteur
  const ownerMatch =
    html.match(
      /"video_owner"\s*:\s*\{[^{}]*"name"\s*:\s*"([^"]+)"/i
    ) ||
    html.match(/"owner"\s*:\s*\{[^{}]*"name"\s*:\s*"([^"]+)"/i) ||
    html.match(/"actors"\s*:\s*\[\s*\{[^{}]*"name"\s*:\s*"([^"]+)"/i);
  const authorName = ownerMatch?.[1]
    ? decodeFacebookEscapedString(ownerMatch[1])
    : 'Facebook Creator';
  const usernameSlug =
    authorName
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'facebook';

  // 4. Extraction du titre
  const ogTitleMatch =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
    html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
    html.match(/"message"\s*:\s*\{\s*"text"\s*:\s*"([^"]+)"/i);
  const title = cleanFacebookTitle(ogTitleMatch?.[1], authorName);

  // 5. Extraction de la miniature (og:image ou URI fbcdn t15 / scontent)
  const thumbPatterns: RegExp[] = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /"preferred_thumbnail"\s*:\s*\{[^{}]*"image"\s*:\s*\{[^{}]*"uri"\s*:\s*"([^"]+)"/i,
    /"thumbnailImage"\s*:\s*\{[^{}]*"uri"\s*:\s*"([^"]+)"/i,
    /"image"\s*:\s*\{\s*"uri"\s*:\s*"(https:\\\/\\\/scontent[^"]+fbcdn\.net\\\/v\\\/t15\.[^"]+)"/i,
    /"uri"\s*:\s*"(https:\\\/\\\/scontent[^"]+fbcdn\.net\\\/[^"]+\.jpg[^"]*)"/i,
  ];
  let thumbnail: string | undefined;
  for (const regex of thumbPatterns) {
    const m = html.match(regex);
    if (m?.[1]) {
      const validThumb = extractValidFbCdnUrl(m[1]);
      if (validThumb) {
        thumbnail = validThumb;
        break;
      }
    }
  }

  // 6. Extraction de la durée
  const durationSecMatch =
    html.match(/"duration_s"\s*:\s*(\d+)/) ||
    html.match(/"length_in_second"\s*:\s*(\d+)/);
  const durationMsMatch = html.match(/"playable_duration_in_ms"\s*:\s*(\d+)/);
  const durationSec = durationSecMatch?.[1]
    ? Number(durationSecMatch[1])
    : durationMsMatch?.[1]
    ? Math.round(Number(durationMsMatch[1]) / 1000)
    : undefined;
  const duration = formatDurationSeconds(durationSec);

  // 7. Construction des items (HD puis SD, avec dédoublonnage si HD = SD)
  const items: ExtractMediaItem[] = [];
  if (hdUrl) {
    items.push({
      kind: 'video',
      url: hdUrl,
      thumbnail,
      quality: 'HD',
      ext: 'mp4',
    });
  }
  if (sdUrl && sdUrl !== hdUrl) {
    items.push({
      kind: 'video',
      url: sdUrl,
      thumbnail,
      quality: 'SD',
      ext: 'mp4',
    });
  }

  return {
    ok: true,
    platform: 'facebook',
    type: 'video',
    title,
    duration,
    author: {
      username: usernameSlug,
      nickname: authorName,
      verified: html.includes('"is_verified":true'),
    },
    thumbnail,
    items,
  };
}

/**
 * Récupère une page Facebook en suivant manuellement jusqu'à 4 redirections revalidées (anti-SSRF).
 */
async function fetchFacebookPageWithSafeRedirects(
  targetUrl: string,
  timeoutMs = FACEBOOK_TIMEOUT_MS
): Promise<{
  status: number;
  finalUrl: string;
  html: string;
  loginRedirect?: boolean;
  checkpointRedirect?: boolean;
}> {
  let currentUrl = targetUrl;

  for (let hop = 0; hop <= FB_MAX_REDIRECTS; hop++) {
    const parsed = new URL(currentUrl);
    if (!isAllowedFacebookHost(parsed.hostname)) {
      throw new Error(`FORBIDDEN_HOST:${parsed.hostname}`);
    }

    if (isFacebookLoginOrCheckpointUrl(parsed.toString())) {
      const isCheckpoint = parsed.pathname.toLowerCase().includes('checkpoint');
      return {
        status: 302,
        finalUrl: parsed.toString(),
        html: '',
        loginRedirect: !isCheckpoint,
        checkpointRedirect: isCheckpoint,
      };
    }

    const res = await fetchWithTimeout(
      parsed.toString(),
      {
        method: 'GET',
        redirect: 'manual',
        headers: FB_NAVIGATION_HEADERS,
      },
      timeoutMs
    );

    if (
      res.status === 301 ||
      res.status === 302 ||
      res.status === 303 ||
      res.status === 307 ||
      res.status === 308
    ) {
      const location = res.headers.get('Location');
      if (!location) {
        return { status: res.status, finalUrl: parsed.toString(), html: '' };
      }
      const nextUrl = new URL(location, parsed);
      if (!isAllowedFacebookHost(nextUrl.hostname)) {
        throw new Error(`FORBIDDEN_HOST:${nextUrl.hostname}`);
      }
      if (isFacebookLoginOrCheckpointUrl(nextUrl.toString())) {
        const isCheckpoint = nextUrl.pathname.toLowerCase().includes('checkpoint');
        return {
          status: res.status,
          finalUrl: nextUrl.toString(),
          html: '',
          loginRedirect: !isCheckpoint,
          checkpointRedirect: isCheckpoint,
        };
      }
      currentUrl = nextUrl.toString();
      continue;
    }

    const html = await res.text().catch(() => '');
    return {
      status: res.status,
      finalUrl: parsed.toString(),
      html,
    };
  }

  return { status: 310, finalUrl: currentUrl, html: '' };
}

/**
 * Moteur principal d'extraction Facebook en deux niveaux sans compte.
 */
export async function extractFacebook(
  cleanUrl: string,
  videoId?: string
): Promise<ExtractResponse> {
  // STORIES FACEBOOK : Ne jamais utiliser le moteur Reels ou Vidéo ni tenter de contourner le mur de connexion
  if (isFacebookStoryUrl(cleanUrl)) {
    return {
      ...fail(
        'PRIVATE_OR_LOGIN_REQUIRED',
        FB_STORY_LOGIN_REQUIRED_MESSAGE,
        {
          engineStage: 'story_auth_required',
          httpStatus: 403,
          engineFn: 'facebook.story',
        }
      ),
      contentKind: 'story',
    };
  }

  const cleanId = (videoId || '').replace(/[^0-9A-Za-z_-]/g, '');
  const isReel = /\/(?:reel|reels|share\/r)\//i.test(cleanUrl);
  const engineFn = isReel ? 'facebook.reel' : 'facebook.video';

  // Niveau 1 : Page desktop principale (www.facebook.com)
  const level1Urls: string[] = [cleanUrl];
  if (cleanId && /^\d+$/.test(cleanId)) {
    const watchUrl = `https://www.facebook.com/watch/?v=${cleanId}`;
    if (!level1Urls.includes(watchUrl)) {
      level1Urls.push(watchUrl);
    }
  }

  let sawLoginWall = false;
  let sawNotFound = false;
  let lastStage: 'direct' | 'mobile' | 'embed' = 'direct';
  let lastHttpStatus: number | null = null;

  for (const candidateUrl of level1Urls) {
    try {
      lastStage = 'direct';
      const page = await fetchFacebookPageWithSafeRedirects(
        candidateUrl,
        FACEBOOK_TIMEOUT_MS
      );
      lastHttpStatus = page.status;

      if (page.checkpointRedirect || page.status === 403 || page.status === 429) {
        return fail(
          'BLOCKED_BY_PLATFORM',
          `Facebook a temporairement bloqué ou limité la requête (HTTP ${page.status}).`,
          { engineStage: 'direct', httpStatus: page.status, engineFn }
        );
      }

      if (page.status === 404) {
        sawNotFound = true;
        continue;
      }

      if (page.loginRedirect) {
        sawLoginWall = true;
        continue;
      }

      if (page.status >= 200 && page.status < 300 && page.html) {
        const parsed = parseFacebookHtmlPayload(page.html, cleanId, page.finalUrl);
        if (parsed.ok && parsed.items && parsed.items.length > 0) {
          return {
            ...parsed,
            engineStage: 'direct',
            httpStatus: page.status,
            engineFn,
          };
        }
        if (parsed.error?.code === 'NOT_FOUND') {
          sawNotFound = true;
        } else if (parsed.error?.code === 'PRIVATE_OR_LOGIN_REQUIRED') {
          sawLoginWall = true;
        } else if (parsed.error?.code === 'BLOCKED_BY_PLATFORM') {
          return {
            ...parsed,
            engineStage: 'direct',
            httpStatus: page.status,
            engineFn,
          };
        }
      }
    } catch (err) {
      if (isTimeoutError(err)) {
        return fail(
          'TIMEOUT',
          'Le délai de 8 secondes a été dépassé lors de la connexion à Facebook.',
          { engineStage: 'direct', httpStatus: null, engineFn }
        );
      }
      if (err instanceof Error && err.message.startsWith('FORBIDDEN_HOST:')) {
        return fail('UNSUPPORTED_URL', 'Redirection vers un domaine externe refusée.', {
          engineStage: 'direct',
          httpStatus: lastHttpStatus,
          engineFn,
        });
      }
    }
  }

  // Niveau 2 : Version mobile (m.facebook.com) + Embed public (plugins/video.php)
  const level2Urls: string[] = [];
  if (cleanId && /^\d+$/.test(cleanId)) {
    level2Urls.push(`https://m.facebook.com/watch/?v=${cleanId}`);
    level2Urls.push(
      `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
        `https://www.facebook.com/facebook/videos/${cleanId}/`
      )}`
    );
  } else {
    try {
      const u = new URL(cleanUrl);
      u.hostname = 'm.facebook.com';
      level2Urls.push(u.toString());
    } catch {
      // Ignore
    }
  }

  for (const mobileOrPluginUrl of level2Urls) {
    const stageName: 'mobile' | 'embed' = mobileOrPluginUrl.includes('/plugins/video.php')
      ? 'embed'
      : 'mobile';
    try {
      lastStage = stageName;
      const page = await fetchFacebookPageWithSafeRedirects(
        mobileOrPluginUrl,
        FACEBOOK_TIMEOUT_MS
      );
      lastHttpStatus = page.status;

      if (page.checkpointRedirect || page.status === 403 || page.status === 429) {
        return fail(
          'BLOCKED_BY_PLATFORM',
          `Facebook a limité l'accès sur la version mobile (HTTP ${page.status}).`,
          { engineStage: stageName, httpStatus: page.status, engineFn }
        );
      }

      if (page.status === 404) {
        sawNotFound = true;
        continue;
      }

      if (page.loginRedirect) {
        sawLoginWall = true;
        continue;
      }

      if (page.status >= 200 && page.status < 300 && page.html) {
        const parsed = parseFacebookHtmlPayload(page.html, cleanId, page.finalUrl);
        if (parsed.ok && parsed.items && parsed.items.length > 0) {
          return {
            ...parsed,
            engineStage: stageName,
            httpStatus: page.status,
            engineFn,
          };
        }
        if (parsed.error?.code === 'NOT_FOUND') {
          sawNotFound = true;
        } else if (parsed.error?.code === 'PRIVATE_OR_LOGIN_REQUIRED') {
          sawLoginWall = true;
        }
      }
    } catch (err) {
      if (isTimeoutError(err)) {
        return fail(
          'TIMEOUT',
          'Le délai de 8 secondes a été dépassé sur la version mobile de Facebook.',
          { engineStage: stageName, httpStatus: null, engineFn }
        );
      }
    }
  }

  if (sawNotFound && !sawLoginWall) {
    return fail('NOT_FOUND', 'Cette vidéo Facebook est introuvable ou a été supprimée.', {
      engineStage: lastStage,
      httpStatus: lastHttpStatus ?? 404,
      engineFn,
    });
  }

  if (sawLoginWall) {
    // Si watch/?v={id} ET plugins/video.php indiquent "Discover Popular Videos" / "may no longer exist",
    // mais que /{page}/videos/{id} redirige vers /login, c'est une vidéo supprimée/inexistante si sawNotFound est aussi vrai
    if (sawNotFound) {
      return fail('NOT_FOUND', 'Cette vidéo Facebook est introuvable ou a été supprimée.', {
        engineStage: lastStage,
        httpStatus: lastHttpStatus ?? 404,
        engineFn,
      });
    }
    return fail(
      'PRIVATE_OR_LOGIN_REQUIRED',
      "Cette vidéo n'est pas publique ou Facebook demande une connexion. Seules les vidéos publiques peuvent être téléchargées.",
      {
        engineStage: lastStage,
        httpStatus: lastHttpStatus,
        engineFn,
      }
    );
  }

  return fail('NO_MEDIA', 'Aucune vidéo publique trouvée à cette adresse Facebook.', {
    engineStage: lastStage,
    httpStatus: lastHttpStatus,
    engineFn,
  });
}
