import { BROWSER_USER_AGENT } from './http.ts';
import { isAllowedMediaUrl } from './allowlist.ts';
import type { ErrorCode, ExtractResponse } from './normalize.ts';

const LINKEDIN_TIMEOUT_MS = 8000;
const LINKEDIN_ATTEMPT_TIMEOUT_MS = 4500;
const LINKEDIN_ALLOWED_REDIRECT_HOST_REGEX = /^(?:(?:www|[a-z]{2})\.)?linkedin\.com$/i;

/**
 * Ordre des User-Agents publics utilisés pour récupérer les métadonnées OpenGraph / JSON-LD
 * d'un profil public LinkedIn sans compte ni cookie de session utilisateur :
 * 1. WhatsApp / Slackbot / Discordbot / FacebookExternalHit : reçoivent directement le HTML public
 *    contenant `og:image` et `application/ld+json` sans blocage HTTP 999.
 * 2. BROWSER_USER_AGENT : repli navigateur standard.
 */
const LINKEDIN_PUBLIC_USER_AGENTS: readonly string[] = [
  'WhatsApp/2.24.12.78 A',
  'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
  'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  BROWSER_USER_AGENT,
];

function errorResponse(
  platform: 'linkedin',
  code: ErrorCode,
  message: string,
  meta?: { engineStage?: string; httpStatus?: number | null; engineFn?: string }
): ExtractResponse {
  return {
    ok: false,
    platform,
    engineStage: meta?.engineStage ?? 'direct',
    httpStatus: meta?.httpStatus !== undefined ? meta.httpStatus : null,
    engineFn: meta?.engineFn ?? 'linkedin.profile',
    contentKind: 'profile',
    error: {
      code,
      message,
    },
  };
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&#x26;/gi, '&')
    .replace(/&#38;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function isGhostOrDefaultLinkedInImage(url: string): boolean {
  const lower = url.toLowerCase();
  if (
    lower.includes('static.licdn.com') ||
    lower.includes('ghost-person') ||
    lower.includes('ghost_person') ||
    lower.includes('default-avatar') ||
    lower.includes('/aero-v1/sc/h/') ||
    lower.includes('/sc/h/')
  ) {
    return true;
  }
  return false;
}

function extractOgImageFromHtml(html: string): string | null {
  const metaRegex = /<meta\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = metaRegex.exec(html)) !== null) {
    const tag = match[0];
    const isOgImage =
      /\b(?:property|name)\s*=\s*["']og:image["']/i.test(tag) ||
      /\bitemprop\s*=\s*["']image["']/i.test(tag);
    if (!isOgImage) continue;
    const contentMatch = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i);
    if (contentMatch && contentMatch[1]) {
      const candidate = decodeHtmlEntities(contentMatch[1].trim());
      if (candidate.startsWith('https://') && ! isGhostOrDefaultLinkedInImage(candidate)) {
        return candidate;
      }
      if (candidate.startsWith('https://')) {
        return candidate;
      }
    }
  }
  return null;
}

function findImageInJsonLdNode(node: unknown): string | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findImageInJsonLdNode(item);
      if (found) return found;
    }
    return null;
  }

  const record = node as Record<string, unknown>;
  const typeVal = record['@type'];
  const isPersonOrProfile =
    typeVal === 'Person' ||
    typeVal === 'ProfilePage' ||
    (Array.isArray(typeVal) &&
      (typeVal.includes('Person') || typeVal.includes('ProfilePage')));

  if (isPersonOrProfile && record.image) {
    const img = record.image;
    if (typeof img === 'string' && img.startsWith('https://')) {
      return decodeHtmlEntities(img.trim());
    }
    if (img && typeof img === 'object') {
      const imgObj = img as Record<string, unknown>;
      const rawUrl =
        (typeof imgObj.contentUrl === 'string' && imgObj.contentUrl) ||
        (typeof imgObj.url === 'string' && imgObj.url);
      if (rawUrl && rawUrl.startsWith('https://')) {
        return decodeHtmlEntities(rawUrl.trim());
      }
    }
  }

  if (record.mainEntity) {
    const fromMain = findImageInJsonLdNode(record.mainEntity);
    if (fromMain) return fromMain;
  }
  if (record['@graph']) {
    const fromGraph = findImageInJsonLdNode(record['@graph']);
    if (fromGraph) return fromGraph;
  }

  return null;
}

function extractJsonLdImageFromHtml(html: string): string | null {
  const scriptRegex =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html)) !== null) {
    const rawJson = match[1]?.trim();
    if (!rawJson) continue;
    try {
      const parsed = JSON.parse(rawJson);
      const found = findImageInJsonLdNode(parsed);
      if (found) return found;
    } catch {
      // Ignore malformed JSON-LD blocks
    }
  }
  return null;
}

function isLoginOrAuthwallRedirect(location: string): boolean {
  const lower = location.toLowerCase();
  return (
    lower.includes('/authwall') ||
    lower.includes('/login') ||
    lower.includes('/uas/login') ||
    lower.includes('/checkpoint') ||
    lower.includes('session_redirect')
  );
}

function isAuthwallHtml(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes('/authwall') ||
    lower.includes('authwall-join-form') ||
    lower.includes('uas/login') ||
    (lower.includes('trkcode=') && lower.includes('trkinfo=') && !lower.includes('og:image'))
  );
}

function collectResponseCookies(headers: Headers, cookieJar: Map<string, string>): void {
  const anyHeaders = headers as Headers & { getSetCookie?: () => string[] };
  const rawList: string[] =
    typeof anyHeaders.getSetCookie === 'function'
      ? anyHeaders.getSetCookie()
      : [];

  if (rawList.length === 0) {
    const single = headers.get('set-cookie');
    if (single) {
      rawList.push(...single.split(/,(?=\s*[A-Za-z0-9_-]+=)/));
    }
  }

  for (const sc of rawList) {
    const firstPart = sc.split(';')[0]?.trim();
    if (!firstPart) continue;
    const eqIdx = firstPart.indexOf('=');
    if (eqIdx > 0) {
      const name = firstPart.slice(0, eqIdx).trim();
      const val = firstPart.slice(eqIdx + 1).trim();
      if (name && val) {
        cookieJar.set(name, val);
      }
    }
  }
}

export function parseLinkedInProfileHtml(
  html: string,
  slug: string,
  httpStatus = 200
): ExtractResponse {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!html || !html.trim()) {
    return errorResponse(
      'linkedin',
      'BLOCKED_BY_PLATFORM',
      'LinkedIn bloque temporairement la demande (réponse vide). Réessayez dans quelques minutes.',
      { engineStage: 'direct', httpStatus, engineFn: 'linkedin.profile' }
    );
  }

  const ogImage = extractOgImageFromHtml(html);
  const jsonLdImage = extractJsonLdImageFromHtml(html);
  const candidateUrl = ogImage || jsonLdImage;

  if (!candidateUrl) {
    if (isAuthwallHtml(html)) {
      return errorResponse(
        'linkedin',
        'BLOCKED_BY_PLATFORM',
        'LinkedIn bloque temporairement l’accès public (mur de connexion).',
        { engineStage: 'authwall', httpStatus, engineFn: 'linkedin.profile' }
      );
    }
    return errorResponse(
      'linkedin',
      'PRIVATE_OR_LOGIN_REQUIRED',
      'Ce profil LinkedIn n’est pas public ou ne possède pas de photo de profil publique.',
      { engineStage: 'direct', httpStatus, engineFn: 'linkedin.profile' }
    );
  }

  if (isGhostOrDefaultLinkedInImage(candidateUrl) || !isAllowedMediaUrl(candidateUrl)) {
    return errorResponse(
      'linkedin',
      'PRIVATE_OR_LOGIN_REQUIRED',
      'Ce profil LinkedIn n’est pas public ou sa photo de profil est absente.',
      { engineStage: 'direct', httpStatus, engineFn: 'linkedin.profile' }
    );
  }

  const engineStage = ogImage ? 'og_image' : 'jsonld';

  return {
    ok: true,
    id: normalizedSlug,
    platform: 'linkedin',
    type: 'image',
    title: `@${normalizedSlug}`,
    author: {
      username: normalizedSlug,
      avatar: candidateUrl,
    },
    thumbnail: candidateUrl,
    items: [
      {
        kind: 'image',
        url: candidateUrl,
        thumbnail: candidateUrl,
        ext: 'jpg',
        quality: 'HD',
      },
    ],
    engineStage,
    httpStatus,
    engineFn: 'linkedin.profile',
    contentKind: 'profile',
  };
}

export async function extractLinkedIn(slug: string): Promise<ExtractResponse> {
  const normalizedSlug = slug.trim().toLowerCase();
  const initialUrl = `https://www.linkedin.com/in/${encodeURIComponent(normalizedSlug)}`;
  const startTimeMs = Date.now();

  let lastBlockedStage = 'direct';
  let lastHttpStatus: number | null = null;
  let sawTimeout = false;

  for (const userAgent of LINKEDIN_PUBLIC_USER_AGENTS) {
    const elapsedMs = Date.now() - startTimeMs;
    const remainingMs = LINKEDIN_TIMEOUT_MS - elapsedMs;
    if (remainingMs <= 400) {
      sawTimeout = true;
      break;
    }

    const attemptTimeoutMs = Math.min(LINKEDIN_ATTEMPT_TIMEOUT_MS, remainingMs);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), attemptTimeoutMs);

    try {
      let currentUrl = initialUrl;
      let res: Response | null = null;
      const cookieJar = new Map<string, string>();
      let redirectedToAuthwall = false;

      // Suit jusqu'à 2 redirections canoniques (ex. www.linkedin.com -> ma.linkedin.com/in/{slug})
      // en propageant les cookies techniques (__cf_bm, bcookie, lidc) mais sans jamais suivre un authwall.
      for (let hop = 0; hop < 3; hop++) {
        const cookieHeader =
          cookieJar.size > 0
            ? Array.from(cookieJar.entries())
                .map(([k, v]) => `${k}=${v}`)
                .join('; ')
            : '';

        res = await fetch(currentUrl, {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'User-Agent': userAgent,
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
            'Cache-Control': 'no-cache',
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
        });

        collectResponseCookies(res.headers, cookieJar);

        if (res.status >= 300 && res.status < 400) {
          const location = res.headers.get('location') || '';
          if (!location || isLoginOrAuthwallRedirect(location)) {
            redirectedToAuthwall = true;
            lastBlockedStage = 'authwall';
            lastHttpStatus = res.status;
            break;
          }

          let nextUrl: URL;
          try {
            nextUrl = new URL(location, currentUrl);
          } catch {
            redirectedToAuthwall = true;
            lastBlockedStage = 'redirect';
            lastHttpStatus = res.status;
            break;
          }

          if (
            (nextUrl.protocol !== 'https:' && nextUrl.protocol !== 'http:') ||
            !LINKEDIN_ALLOWED_REDIRECT_HOST_REGEX.test(nextUrl.hostname) ||
            !nextUrl.pathname.toLowerCase().startsWith('/in/')
          ) {
            redirectedToAuthwall = true;
            lastBlockedStage = 'redirect';
            lastHttpStatus = res.status;
            break;
          }

          currentUrl = nextUrl.toString();
          continue;
        }
        break;
      }

      if (redirectedToAuthwall || !res) {
        continue;
      }

      const status = res.status;
      lastHttpStatus = status;

      if (status === 404 || status === 410) {
        return errorResponse(
          'linkedin',
          'NOT_FOUND',
          'Ce profil LinkedIn est introuvable (404).',
          { engineStage: 'direct', httpStatus: status, engineFn: 'linkedin.profile' }
        );
      }

      if (
        status === 999 ||
        status === 401 ||
        status === 403 ||
        status === 429 ||
        status >= 500
      ) {
        lastBlockedStage = 'direct';
        continue;
      }

      if (status < 200 || status >= 300) {
        lastBlockedStage = 'direct';
        continue;
      }

      const html = await res.text();
      const parsed = parseLinkedInProfileHtml(html, normalizedSlug, status);
      if (parsed.ok || parsed.error?.code === 'PRIVATE_OR_LOGIN_REQUIRED') {
        return parsed;
      }

      lastBlockedStage = parsed.engineStage || 'direct';
    } catch (err) {
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' ||
          err.name === 'TimeoutError' ||
          /abort|timeout/i.test(err.message));
      if (isAbort) {
        sawTimeout = true;
        lastBlockedStage = 'direct';
      } else {
        lastBlockedStage = 'direct';
      }
    } finally {
      clearTimeout(timer);
    }
  }

  if (sawTimeout && lastHttpStatus === null) {
    return errorResponse(
      'linkedin',
      'TIMEOUT',
      'La récupération du profil LinkedIn a dépassé le délai de 8 secondes.',
      { engineStage: 'direct', httpStatus: null, engineFn: 'linkedin.profile' }
    );
  }

  return errorResponse(
    'linkedin',
    'BLOCKED_BY_PLATFORM',
    lastHttpStatus
      ? `LinkedIn bloque temporairement la demande depuis ce réseau (statut ${lastHttpStatus}).`
      : 'LinkedIn bloque temporairement la demande (mur de connexion).',
    { engineStage: lastBlockedStage, httpStatus: lastHttpStatus, engineFn: 'linkedin.profile' }
  );
}
