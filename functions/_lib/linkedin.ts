import { BROWSER_USER_AGENT } from './http';
import { isAllowedMediaUrl } from './allowlist';
import type { ErrorCode, ExtractResponse } from './normalize';

const LINKEDIN_TIMEOUT_MS = 8000;

function errorResponse(
  platform: 'linkedin',
  code: ErrorCode,
  message: string,
  meta?: { engineStage?: string; httpStatus?: number | null }
): ExtractResponse {
  return {
    ok: false,
    platform,
    engineStage: meta?.engineStage,
    httpStatus: meta?.httpStatus ?? undefined,
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
      { engineStage: 'linkedin_empty_body', httpStatus }
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
        { engineStage: 'linkedin_authwall_html', httpStatus }
      );
    }
    return errorResponse(
      'linkedin',
      'PRIVATE_OR_LOGIN_REQUIRED',
      'Ce profil LinkedIn n’est pas public ou ne possède pas de photo de profil publique.',
      { engineStage: 'linkedin_no_photo', httpStatus }
    );
  }

  if (isGhostOrDefaultLinkedInImage(candidateUrl) || !isAllowedMediaUrl(candidateUrl)) {
    return errorResponse(
      'linkedin',
      'PRIVATE_OR_LOGIN_REQUIRED',
      'Ce profil LinkedIn n’est pas public ou sa photo de profil est absente.',
      { engineStage: 'linkedin_ghost_or_private_photo', httpStatus }
    );
  }

  const engineStage = ogImage ? 'linkedin_og_image' : 'linkedin_jsonld_image';

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
  };
}

export async function extractLinkedIn(slug: string): Promise<ExtractResponse> {
  const normalizedSlug = slug.trim().toLowerCase();
  const targetUrl = `https://www.linkedin.com/in/${encodeURIComponent(normalizedSlug)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LINKEDIN_TIMEOUT_MS);

  try {
    let currentUrl = targetUrl;
    let res: Response | null = null;

    // Follow at most 1 canonical redirect (e.g. trailing slash), never follow login/authwall
    for (let hop = 0; hop < 2; hop++) {
      res = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': BROWSER_USER_AGENT,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
        },
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location') || '';
        if (!location || isLoginOrAuthwallRedirect(location)) {
          return errorResponse(
            'linkedin',
            'BLOCKED_BY_PLATFORM',
            'LinkedIn redirige vers un mur de connexion (authwall/login).',
            { engineStage: 'linkedin_redirect_authwall', httpStatus: res.status }
          );
        }
        const nextUrl = new URL(location, currentUrl);
        if (!nextUrl.pathname.toLowerCase().startsWith('/in/')) {
          return errorResponse(
            'linkedin',
            'BLOCKED_BY_PLATFORM',
            'LinkedIn redirige hors du profil public.',
            { engineStage: 'linkedin_redirect_blocked', httpStatus: res.status }
          );
        }
        currentUrl = nextUrl.toString();
        continue;
      }
      break;
    }

    if (!res) {
      return errorResponse(
        'linkedin',
        'BLOCKED_BY_PLATFORM',
        'LinkedIn bloque temporairement la demande.',
        { engineStage: 'linkedin_no_response', httpStatus: null }
      );
    }

    const status = res.status;

    if (status === 404 || status === 410) {
      return errorResponse(
        'linkedin',
        'NOT_FOUND',
        'Ce profil LinkedIn est introuvable (404).',
        { engineStage: 'linkedin_http_404', httpStatus: status }
      );
    }

    if (
      status === 999 ||
      status === 401 ||
      status === 403 ||
      status === 429 ||
      status >= 500
    ) {
      return errorResponse(
        'linkedin',
        'BLOCKED_BY_PLATFORM',
        'LinkedIn bloque temporairement la demande depuis ce réseau (statut ' +
          status +
          ').',
        { engineStage: `linkedin_http_${status}`, httpStatus: status }
      );
    }

    if (status < 200 || status >= 300) {
      return errorResponse(
        'linkedin',
        'BLOCKED_BY_PLATFORM',
        'LinkedIn bloque temporairement la demande.',
        { engineStage: `linkedin_http_${status}`, httpStatus: status }
      );
    }

    const html = await res.text();
    return parseLinkedInProfileHtml(html, normalizedSlug, status);
  } catch (err) {
    const isAbort =
      err instanceof Error &&
      (err.name === 'AbortError' ||
        err.name === 'TimeoutError' ||
        /abort|timeout/i.test(err.message));
    if (isAbort) {
      return errorResponse(
        'linkedin',
        'TIMEOUT',
        'La récupération du profil LinkedIn a dépassé le délai de 8 secondes.',
        { engineStage: 'linkedin_timeout', httpStatus: null }
      );
    }
    return errorResponse(
      'linkedin',
      'BLOCKED_BY_PLATFORM',
      'LinkedIn bloque temporairement la demande.',
      { engineStage: 'linkedin_fetch_error', httpStatus: null }
    );
  } finally {
    clearTimeout(timer);
  }
}
