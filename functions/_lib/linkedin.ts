import { BROWSER_USER_AGENT } from './http.ts';
import { isAllowedMediaUrl } from './allowlist.ts';
import type { ErrorCode, ExtractMediaItem, ExtractResponse } from './normalize.ts';

const LINKEDIN_ATTEMPT_TIMEOUT_MS = 4500;
const IMAGE_VALIDATION_TIMEOUT_MS = 3500;
const FALLBACK_SEARCH_TIMEOUT_MS = 4500;
const MAX_REDIRECT_HOPS = 4;

export const MAX_LINKEDIN_IMAGE_BYTES = 10 * 1024 * 1024; // 10 Mo max
export const MIN_LINKEDIN_IMAGE_BYTES = 16; // Au moins 16 octets pour l'en-tête binaire
export const MAX_FALLBACK_CANDIDATES = 6;

export const LINKEDIN_UNVERIFIED_FALLBACK_LABEL =
  'Résultats non vérifiés, peut-être pas la bonne personne';

const LINKEDIN_ALLOWED_REDIRECT_HOST_REGEX = /^(?:(?:www|[a-z]{2})\.)?linkedin\.com$/i;

/**
 * Messages d'erreur français distincts pour chaque code d'erreur LinkedIn.
 * Pour LOGIN_WALL, ne jamais dire « réessayez » — proposer la solution de repli.
 */
export const LINKEDIN_FRENCH_ERROR_MESSAGES: Record<
  'LOGIN_WALL' | 'RATE_LIMITED' | 'PROFILE_NOT_FOUND' | 'PHOTO_NOT_AVAILABLE' | 'INVALID_IMAGE',
  string
> = {
  LOGIN_WALL:
    'LinkedIn affiche un mur de connexion pour ce profil. Utilisez les résultats de recherche d’images proposés ou importez une image manuellement ci-dessous.',
  RATE_LIMITED:
    'Trop de requêtes envoyées vers LinkedIn (limite atteinte). Patientez quelques instants ou utilisez l’import manuel d’image ci-dessous.',
  PROFILE_NOT_FOUND:
    'Ce profil LinkedIn est introuvable ou a été supprimé (404). Vérifiez l’identifiant du profil dans l’URL.',
  PHOTO_NOT_AVAILABLE:
    'Aucune photo de profil publique n’est disponible sur ce compte LinkedIn (avatar absent ou par défaut).',
  INVALID_IMAGE:
    'Le fichier récupéré n’est pas une image valide (type MIME, signature binaire ou taille hors limite).',
};

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
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function isGhostOrDefaultLinkedInImage(url: string): boolean {
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

/**
 * 1a. Extraction de `og:image` depuis le HTML public.
 */
export function extractOgImageFromHtml(html: string): string | null {
  const metaRegex = /<meta\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = metaRegex.exec(html)) !== null) {
    const tag = match[0];
    const isOgImage =
      /\b(?:property|name)\s*=\s*["']og:image(?::secure_url)?["']/i.test(tag) ||
      /\bitemprop\s*=\s*["']image["']/i.test(tag);
    if (!isOgImage) continue;
    const contentMatch = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i);
    if (contentMatch && contentMatch[1]) {
      const candidate = decodeHtmlEntities(contentMatch[1].trim());
      if (candidate.startsWith('https://') || candidate.startsWith('http://')) {
        return candidate;
      }
    }
  }
  return null;
}

/**
 * 1b. Extraction de `twitter:image` (ou `twitter:image:src`) depuis le HTML public.
 */
export function extractTwitterImageFromHtml(html: string): string | null {
  const metaRegex = /<meta\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = metaRegex.exec(html)) !== null) {
    const tag = match[0];
    const isTwitterImage =
      /\b(?:name|property)\s*=\s*["']twitter:image(?::src)?["']/i.test(tag);
    if (!isTwitterImage) continue;
    const contentMatch = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i);
    if (contentMatch && contentMatch[1]) {
      const candidate = decodeHtmlEntities(contentMatch[1].trim());
      if (candidate.startsWith('https://') || candidate.startsWith('http://')) {
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
    if (typeof img === 'string' && (img.startsWith('https://') || img.startsWith('http://'))) {
      return decodeHtmlEntities(img.trim());
    }
    if (img && typeof img === 'object') {
      const imgObj = img as Record<string, unknown>;
      const rawUrl =
        (typeof imgObj.contentUrl === 'string' && imgObj.contentUrl) ||
        (typeof imgObj.url === 'string' && imgObj.url);
      if (rawUrl && (rawUrl.startsWith('https://') || rawUrl.startsWith('http://'))) {
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

/**
 * 1c. Extraction de l'attribut `"image"` depuis les blocs JSON-LD (`application/ld+json`).
 */
export function extractJsonLdImageFromHtml(html: string): string | null {
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
      // Ignorer les blocs JSON-LD malformés
    }
  }
  return null;
}

export function isLoginOrAuthwallRedirect(location: string): boolean {
  const lower = location.toLowerCase();
  return (
    lower.includes('/authwall') ||
    lower.includes('/login') ||
    lower.includes('/uas/login') ||
    lower.includes('/checkpoint') ||
    lower.includes('session_redirect')
  );
}

export function isAuthwallHtml(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes('/authwall') ||
    lower.includes('authwall-join-form') ||
    lower.includes('uas/login') ||
    lower.includes('/checkpoint/challenge') ||
    (lower.includes('trkcode=') && lower.includes('trkinfo=') && !lower.includes('og:image'))
  );
}

/**
 * Extrait un nom de personne propre depuis le titre de la page (si disponible et non générique)
 * ou depuis le slug de l'URL LinkedIn (ex: `jean-dupont-98a1b234` -> `Jean Dupont`).
 */
export function extractPersonNameFromSlugOrHtml(slug: string, html?: string): string {
  if (html && html.trim()) {
    const titleCandidates: string[] = [];
    const ogTitleMatch = html.match(
      /<meta\b[^>]*(?:property|name)\s*=\s*["'](?:og:title|twitter:title)["'][^>]*content\s*=\s*["']([^"']+)["']/i
    );
    if (ogTitleMatch?.[1]) {
      titleCandidates.push(decodeHtmlEntities(ogTitleMatch[1].trim()));
    }
    const titleTagMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleTagMatch?.[1]) {
      titleCandidates.push(decodeHtmlEntities(titleTagMatch[1].trim()));
    }

    for (const rawTitle of titleCandidates) {
      const cleaned = rawTitle
        .replace(/\s*\|\s*LinkedIn.*$/i, '')
        .replace(/\s*-\s*LinkedIn.*$/i, '')
        .split(/\s+[-–—|]\s+/)[0]
        ?.trim();
      if (
        cleaned &&
        cleaned.length >= 2 &&
        cleaned.length <= 70 &&
        !/^(?:linkedin|sign\s*in|sign\s*up|log\s*in|s['’]identifier|s['’]inscrire|rejoindre|authwall|security\s*verification)/i.test(
          cleaned
        )
      ) {
        return cleaned;
      }
    }
  }

  let decodedSlug = slug.trim();
  try {
    decodedSlug = decodeURIComponent(decodedSlug);
  } catch {
    // Garder tel quel
  }

  const parts = decodedSlug
    .replace(/^@+/, '')
    .split(/[-_.\s]+/)
    .filter(Boolean);

  // Retirer les suffixes d'identifiant LinkedIn (ex: 8a1b2c3d, 123456789, a1b2c3) s'il reste au moins 1 mot
  while (
    parts.length > 1 &&
    (/^\d+$/.test(parts[parts.length - 1]) ||
      (/^[0-9a-f]{6,}$/i.test(parts[parts.length - 1]) && /\d/.test(parts[parts.length - 1])) ||
      (/^[0-9a-z]{7,}$/i.test(parts[parts.length - 1]) && /\d/.test(parts[parts.length - 1])))
  ) {
    parts.pop();
  }

  const words = parts
    .map((w) => w.replace(/[^a-zA-ZÀ-ÿ0-9']/g, ''))
    .filter((w) => w.length > 0);

  if (words.length === 0) {
    return slug.trim() || 'LinkedIn';
  }

  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Vérifie les octets magiques (magic bytes) réels d'une image binaire.
 * Rejette systématiquement toute page HTML (`<!DOCTYPE`, `<html`, etc.) ou JSON.
 */
export function detectImageMagicBytes(
  bytes: Uint8Array
): 'jpg' | 'png' | 'webp' | 'gif' | null {
  if (!bytes || bytes.length < 4) return null;

  // JPEG : FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }

  // PNG : 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png';
  }

  // GIF : "GIF87a" ou "GIF89a"
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return 'gif';
  }

  // WebP : "RIFF" .... "WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp';
  }

  return null;
}

/**
 * Extrait les dimensions (largeur x hauteur) depuis les premiers octets binaires de l'image si disponibles.
 */
export function parseImageDimensionsFromBytes(
  bytes: Uint8Array,
  format: 'jpg' | 'png' | 'webp' | 'gif'
): { width?: number; height?: number } {
  try {
    if (format === 'png' && bytes.length >= 24) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const width = view.getUint32(16, false);
      const height = view.getUint32(20, false);
      if (width > 0 && height > 0 && width <= 20000 && height <= 20000) {
        return { width, height };
      }
    } else if (format === 'gif' && bytes.length >= 10) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const width = view.getUint16(6, true);
      const height = view.getUint16(8, true);
      if (width > 0 && height > 0) {
        return { width, height };
      }
    } else if (format === 'jpg' && bytes.length > 4) {
      let offset = 2;
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = bytes[offset + 1];
        if (marker === 0xff) {
          offset++;
          continue;
        }
        if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
          offset += 2;
          continue;
        }
        const segLen = (bytes[offset + 2] << 8) | bytes[offset + 3];
        if (segLen < 2) break;
        if (
          (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) &&
          offset + 8 < bytes.length
        ) {
          const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
          const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
          if (width > 0 && height > 0 && width <= 20000 && height <= 20000) {
            return { width, height };
          }
          break;
        }
        offset += 2 + segLen;
      }
    }
  } catch {
    // Ignorer si l'en-tête SOF est plus loin dans le flux
  }
  return {};
}

export function isSmallOrThumbnailImage(
  url: string,
  width?: number,
  height?: number,
  byteLength?: number
): boolean {
  const lower = url.toLowerCase();
  if (
    lower.includes('shrink_100_100') ||
    lower.includes('shrink_200_200') ||
    lower.includes('shrink_400_400') ||
    lower.includes('/thumb/') ||
    lower.includes('pithumbsize') ||
    lower.includes('iiurlwidth') ||
    lower.includes('_thumb') ||
    lower.includes('thumbnail')
  ) {
    return true;
  }
  if (
    (typeof width === 'number' && width > 0 && width <= 450) ||
    (typeof height === 'number' && height > 0 && height <= 450)
  ) {
    return true;
  }
  if (typeof byteLength === 'number' && byteLength > 0 && byteLength < 45_000) {
    return true;
  }
  // Si les dimensions exactes d'une photo LinkedIn ne sont pas >= 600px, annoncer "Miniature" par prudence
  if (!width && !height && !lower.includes('shrink_800_800')) {
    return true;
  }
  return false;
}

export interface ValidatedImageInfo {
  ok: boolean;
  finalUrl?: string;
  ext?: 'jpg' | 'png' | 'webp' | 'gif';
  contentType?: string;
  byteLength?: number;
  width?: number;
  height?: number;
  isThumbnail?: boolean;
  qualityLabel?: 'Miniature' | 'Standard';
  httpStatus?: number | null;
  errorCode?: ErrorCode;
}

/**
 * Valide rigoureusement une URL d'image avant de la retourner :
 * - Suit jusqu'à 4 redirections en vérifiant l'allowlist anti-SSRF
 * - Vérifie le statut HTTP 200 (ou 206 si Range est accepté)
 * - Vérifie l'en-tête `Content-Type: image/*` (ne retourne jamais une page HTML)
 * - Vérifie la limite de taille (`MIN_LINKEDIN_IMAGE_BYTES` .. `MAX_LINKEDIN_IMAGE_BYTES`)
 * - Vérifie les vrais magic bytes de l'image (JPEG, PNG, WebP, GIF)
 * - Indique `"Miniature"` lorsqu'une seule petite version est disponible (ne prétend jamais être en pleine résolution)
 */
export async function validateLinkedInImageUrl(
  rawUrl: string,
  options?: {
    signal?: AbortSignal;
    maxBytes?: number;
  }
): Promise<ValidatedImageInfo> {
  const maxBytes = options?.maxBytes ?? MAX_LINKEDIN_IMAGE_BYTES;
  let currentUrl = rawUrl.trim();

  if (!isAllowedMediaUrl(currentUrl)) {
    return {
      ok: false,
      httpStatus: null,
      errorCode: 'INVALID_IMAGE',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), IMAGE_VALIDATION_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  options?.signal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    let res: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
      res = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': BROWSER_USER_AGENT,
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          Range: 'bytes=0-16383',
        },
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location') || '';
        try {
          await res.body?.cancel();
        } catch {
          // Ignorer
        }
        if (!location || hop === MAX_REDIRECT_HOPS) {
          return {
            ok: false,
            httpStatus: res.status,
            errorCode: 'INVALID_IMAGE',
          };
        }
        let nextUrl: URL;
        try {
          nextUrl = new URL(location, currentUrl);
        } catch {
          return {
            ok: false,
            httpStatus: res.status,
            errorCode: 'INVALID_IMAGE',
          };
        }
        const resolvedNext = nextUrl.toString();
        if (!isAllowedMediaUrl(resolvedNext)) {
          return {
            ok: false,
            httpStatus: res.status,
            errorCode: 'INVALID_IMAGE',
          };
        }
        currentUrl = resolvedNext;
        continue;
      }
      break;
    }

    if (!res) {
      return { ok: false, httpStatus: null, errorCode: 'INVALID_IMAGE' };
    }

    const status = res.status;
    if (status === 429) {
      try {
        await res.body?.cancel();
      } catch {
        // Ignorer
      }
      return { ok: false, httpStatus: 429, errorCode: 'RATE_LIMITED' };
    }

    if (status === 404 || status === 410) {
      try {
        await res.body?.cancel();
      } catch {
        // Ignorer
      }
      return { ok: false, httpStatus: status, errorCode: 'PHOTO_NOT_AVAILABLE' };
    }

    if (status !== 200 && status !== 206) {
      try {
        await res.body?.cancel();
      } catch {
        // Ignorer
      }
      return { ok: false, httpStatus: status, errorCode: 'INVALID_IMAGE' };
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase().trim();
    if (
      !contentType.startsWith('image/') ||
      contentType.includes('text/html') ||
      contentType.includes('application/xhtml')
    ) {
      try {
        await res.body?.cancel();
      } catch {
        // Ignorer
      }
      return { ok: false, httpStatus: status, errorCode: 'INVALID_IMAGE' };
    }

    // Vérifier la taille totale depuis Content-Range (si 206) ou Content-Length
    let totalBytes: number | undefined;
    const contentRange = res.headers.get('content-range');
    if (contentRange) {
      const slashIdx = contentRange.lastIndexOf('/');
      if (slashIdx !== -1) {
        const parsedTotal = Number(contentRange.slice(slashIdx + 1).trim());
        if (Number.isFinite(parsedTotal) && parsedTotal > 0) {
          totalBytes = parsedTotal;
        }
      }
    }
    if (totalBytes === undefined) {
      const clHeader = res.headers.get('content-length');
      if (clHeader !== null && clHeader.trim() !== '') {
        const parsedLen = Number(clHeader);
        if (Number.isFinite(parsedLen) && parsedLen >= 0) {
          totalBytes = parsedLen;
        }
      }
    }

    if (
      totalBytes !== undefined &&
      (totalBytes > maxBytes || totalBytes < MIN_LINKEDIN_IMAGE_BYTES)
    ) {
      try {
        await res.body?.cancel();
      } catch {
        // Ignorer
      }
      return { ok: false, httpStatus: status, errorCode: 'INVALID_IMAGE' };
    }

    // Lire les premiers octets pour vérifier les magic bytes et la taille réelle
    const chunks: Uint8Array[] = [];
    let accumulated = 0;
    const probeLimit = Math.min(maxBytes + 1, 32768);

    if (res.body) {
      const reader = res.body.getReader();
      try {
        while (accumulated < probeLimit) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && value.byteLength > 0) {
            chunks.push(value);
            accumulated += value.byteLength;
          }
        }
      } finally {
        try {
          await reader.cancel();
        } catch {
          // Ignorer
        }
      }
    } else {
      const ab = await res.arrayBuffer();
      accumulated = ab.byteLength;
      chunks.push(new Uint8Array(ab.slice(0, probeLimit)));
    }

    const effectiveSize = totalBytes ?? accumulated;
    if (effectiveSize < MIN_LINKEDIN_IMAGE_BYTES || effectiveSize > maxBytes) {
      return { ok: false, httpStatus: status, errorCode: 'INVALID_IMAGE' };
    }

    const sampleLen = Math.min(accumulated, 16384);
    const sample = new Uint8Array(sampleLen);
    let offset = 0;
    for (const chunk of chunks) {
      const take = Math.min(chunk.byteLength, sampleLen - offset);
      if (take <= 0) break;
      sample.set(chunk.subarray(0, take), offset);
      offset += take;
    }

    const ext = detectImageMagicBytes(sample);
    if (!ext) {
      return { ok: false, httpStatus: status, errorCode: 'INVALID_IMAGE' };
    }

    const dims = parseImageDimensionsFromBytes(sample, ext);
    const isThumbnail = isSmallOrThumbnailImage(
      currentUrl,
      dims.width,
      dims.height,
      effectiveSize
    );

    return {
      ok: true,
      finalUrl: currentUrl,
      ext,
      contentType,
      byteLength: effectiveSize,
      width: dims.width,
      height: dims.height,
      isThumbnail,
      qualityLabel: isThumbnail ? 'Miniature' : 'Standard',
      httpStatus: 200,
    };
  } catch {
    return {
      ok: false,
      httpStatus: null,
      errorCode: 'INVALID_IMAGE',
    };
  } finally {
    clearTimeout(timeoutId);
    options?.signal?.removeEventListener('abort', onExternalAbort);
  }
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

/**
 * Analyse le HTML d'un profil public LinkedIn dans l'ordre strict :
 * 1. `og:image`
 * 2. `twitter:image`
 * 3. JSON-LD `"image"`
 */
export function parseLinkedInProfileHtml(
  html: string,
  slug: string,
  httpStatus = 200
): ExtractResponse {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!html || !html.trim()) {
    return errorResponse(
      'linkedin',
      'LOGIN_WALL',
      LINKEDIN_FRENCH_ERROR_MESSAGES.LOGIN_WALL,
      { engineStage: 'authwall', httpStatus, engineFn: 'linkedin.profile' }
    );
  }

  // Ordre strict demandé : og:image -> twitter:image -> JSON-LD "image"
  const ogImage = extractOgImageFromHtml(html);
  const twitterImage = !ogImage ? extractTwitterImageFromHtml(html) : null;
  const jsonLdImage = !ogImage && !twitterImage ? extractJsonLdImageFromHtml(html) : null;
  const candidateUrl = ogImage || twitterImage || jsonLdImage;

  if (!candidateUrl) {
    if (isAuthwallHtml(html)) {
      return errorResponse(
        'linkedin',
        'LOGIN_WALL',
        LINKEDIN_FRENCH_ERROR_MESSAGES.LOGIN_WALL,
        { engineStage: 'authwall', httpStatus, engineFn: 'linkedin.profile' }
      );
    }
    return errorResponse(
      'linkedin',
      'LOGIN_WALL',
      LINKEDIN_FRENCH_ERROR_MESSAGES.LOGIN_WALL,
      { engineStage: 'authwall', httpStatus, engineFn: 'linkedin.profile' }
    );
  }

  if (isGhostOrDefaultLinkedInImage(candidateUrl)) {
    return errorResponse(
      'linkedin',
      'PHOTO_NOT_AVAILABLE',
      LINKEDIN_FRENCH_ERROR_MESSAGES.PHOTO_NOT_AVAILABLE,
      { engineStage: 'direct', httpStatus, engineFn: 'linkedin.profile' }
    );
  }

  if (!isAllowedMediaUrl(candidateUrl)) {
    return errorResponse(
      'linkedin',
      'INVALID_IMAGE',
      LINKEDIN_FRENCH_ERROR_MESSAGES.INVALID_IMAGE,
      { engineStage: 'direct', httpStatus, engineFn: 'linkedin.profile' }
    );
  }

  const engineStage = ogImage
    ? 'og_image'
    : twitterImage
    ? 'twitter_image'
    : 'jsonld';
  const isThumb = isSmallOrThumbnailImage(candidateUrl);
  const qualityLabel = isThumb ? 'Miniature' : 'Standard';

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
        quality: qualityLabel,
        isThumbnail: isThumb,
      },
    ],
    engineStage,
    httpStatus,
    engineFn: 'linkedin.profile',
    contentKind: 'profile',
  };
}

interface RawFallbackCandidate {
  imageUrl: string;
  thumbnailUrl: string;
  sourceUrl: string;
  width?: number;
  height?: number;
}

function formatBytesHuman(bytes?: number): string | undefined {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return undefined;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Étape 2 — Recherche d'images de repli via des sources publiques gratuites compatibles Worker
 * (Wikimedia Commons API + Wikipedia PageImages API, sans clé payante ni scraping illégitime).
 * Valide chaque image (HTTP 200, image/*, magic bytes, limite de taille, redirections) et retourne
 * jusqu'à 6 candidats avec miniature + lien source.
 */
export async function searchLinkedInFallbackImages(
  personName: string,
  parentSignal?: AbortSignal
): Promise<ExtractMediaItem[]> {
  const cleanQuery = personName.trim();
  if (!cleanQuery || cleanQuery.length < 2) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FALLBACK_SEARCH_TIMEOUT_MS);
  const onParentAbort = () => controller.abort();
  parentSignal?.addEventListener('abort', onParentAbort, { once: true });

  const rawCandidates: RawFallbackCandidate[] = [];
  const seenImageUrls = new Set<string>();

  const pushCandidate = (c: RawFallbackCandidate) => {
    if (!c.imageUrl || !c.sourceUrl) return;
    if (!isAllowedMediaUrl(c.imageUrl)) return;
    const key = c.imageUrl.split('?')[0];
    if (seenImageUrls.has(key)) return;
    seenImageUrls.add(key);
    rawCandidates.push(c);
  };

  try {
    // Source 1 : Wikipedia PageImages (FR + EN) pour portraits d'articles encyclopédiques publics
    const wikiEndpoints = [
      `https://fr.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanQuery)}&gsrlimit=4&prop=pageimages|info&inprop=url&piprop=thumbnail&pithumbsize=360&format=json&origin=*`,
      `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanQuery)}&gsrlimit=4&prop=pageimages|info&inprop=url&piprop=thumbnail&pithumbsize=360&format=json&origin=*`,
      // Source 2 : Wikimedia Commons API (images bitmap libres)
      `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(`filetype:bitmap ${cleanQuery}`)}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|mime|size|dimensions&iiurlwidth=360&format=json&origin=*`,
    ];

    const responses = await Promise.allSettled(
      wikiEndpoints.map((endpoint) =>
        fetch(endpoint, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent': 'VIDNEX-Worker/1.0 (https://vidnex.space; public-commons-search)',
            Accept: 'application/json',
          },
        }).then((r) => (r.ok ? r.json() : null))
      )
    );

    for (const settled of responses) {
      if (settled.status !== 'fulfilled' || !settled.value) continue;
      const data = settled.value as Record<string, any>;
      const pages = data?.query?.pages;
      if (!pages || typeof pages !== 'object') continue;

      for (const page of Object.values(pages) as Array<Record<string, any>>) {
        // Format Wikipedia PageImages
        if (page?.thumbnail?.source && typeof page.fullurl === 'string') {
          const thumbUrl = String(page.thumbnail.source);
          pushCandidate({
            imageUrl: thumbUrl,
            thumbnailUrl: thumbUrl,
            sourceUrl: String(page.fullurl),
            width: typeof page.thumbnail.width === 'number' ? page.thumbnail.width : undefined,
            height: typeof page.thumbnail.height === 'number' ? page.thumbnail.height : undefined,
          });
        }

        // Format Wikimedia Commons imageinfo
        const ii = Array.isArray(page?.imageinfo) ? page.imageinfo[0] : null;
        if (ii) {
          const mime = String(ii.mime || '').toLowerCase();
          if (mime.startsWith('image/') && !mime.includes('svg')) {
            const imgUrl = String(ii.thumburl || ii.url || '');
            const srcUrl = String(
              ii.descriptionurl ||
                (page.title
                  ? `https://commons.wikimedia.org/wiki/${encodeURIComponent(String(page.title))}`
                  : '')
            );
            if (imgUrl && srcUrl) {
              pushCandidate({
                imageUrl: imgUrl,
                thumbnailUrl: imgUrl,
                sourceUrl: srcUrl,
                width: typeof ii.thumbwidth === 'number' ? ii.thumbwidth : ii.width,
                height: typeof ii.thumbheight === 'number' ? ii.thumbheight : ii.height,
              });
            }
          }
        }
      }
    }

    if (rawCandidates.length === 0) {
      return [];
    }

    // Valider chaque candidat avant de le retourner (max 6 candidats validés)
    const toValidate = rawCandidates.slice(0, MAX_FALLBACK_CANDIDATES + 2);
    const validations = await Promise.all(
      toValidate.map(async (candidate) => {
        const check = await validateLinkedInImageUrl(candidate.imageUrl, {
          signal: controller.signal,
        });
        return { candidate, check };
      })
    );

    const validatedItems: ExtractMediaItem[] = [];
    for (const { candidate, check } of validations) {
      if (!check.ok || !check.finalUrl) continue;
      const idx = validatedItems.length + 1;
      const width = check.width ?? candidate.width;
      const height = check.height ?? candidate.height;
      const isThumb =
        check.isThumbnail ??
        isSmallOrThumbnailImage(check.finalUrl, width, height, check.byteLength);

      validatedItems.push({
        id: `linkedin-fallback-${idx}`,
        index: idx,
        selected: idx === 1,
        kind: 'image',
        url: check.finalUrl,
        thumbnail: check.finalUrl,
        sourceUrl: candidate.sourceUrl,
        ext: check.ext || 'jpg',
        quality: isThumb ? 'Miniature' : 'Standard',
        isThumbnail: isThumb,
        width,
        height,
        size: formatBytesHuman(check.byteLength),
      });

      if (validatedItems.length >= MAX_FALLBACK_CANDIDATES) {
        break;
      }
    }

    return validatedItems;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', onParentAbort);
  }
}

/**
 * Extracteur de photo de profil LinkedIn en 3 niveaux :
 * 1. Primaire : requête de la page publique avec en-têtes navigateur normaux (`og:image` -> `twitter:image` -> JSON-LD `"image"`).
 *    Si mur de connexion (`/authwall`, `/login`, statut 999 ou absence de métadonnées), arrêt immédiat sans contournement et passage à l'étape 2.
 * 2. Repli (recherche d'images) : extrait le nom depuis le slug ou le titre de la page, cherche jusqu'à 6 images candidates via une source gratuite compatible Worker, valide chaque image (HTTP 200, `image/*`, magic bytes, limite de taille, redirections) et les affiche dans l'écran de sélection avec la mention `"Résultats non vérifiés, peut-être pas la bonne personne"`.
 * 3. Dernier recours : en cas d'absence de candidat ou d'échec, retourne un code d'erreur précis (`LOGIN_WALL`, `RATE_LIMITED`, `PROFILE_NOT_FOUND`, `PHOTO_NOT_AVAILABLE`, `INVALID_IMAGE`) permettant l'import manuel (drag & drop / sélecteur de fichier) avec aperçu.
 */
export async function extractLinkedIn(slug: string): Promise<ExtractResponse> {
  const normalizedSlug = slug.trim().toLowerCase();
  const initialUrl = `https://www.linkedin.com/in/${encodeURIComponent(normalizedSlug)}`;

  let blockedStage = 'authwall';
  let lastHttpStatus: number | null = null;
  let capturedHtml = '';
  let hitLoginWall = false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LINKEDIN_ATTEMPT_TIMEOUT_MS);

  try {
    let currentUrl = initialUrl;
    let res: Response | null = null;
    const cookieJar = new Map<string, string>();
    let redirectedToAuthwall = false;

    // Étape 1 : Requête unique avec en-têtes navigateur normaux (jusqu'à 2 redirections canoniques /in/)
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
          'User-Agent': BROWSER_USER_AGENT,
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
          hitLoginWall = true;
          blockedStage = 'authwall';
          lastHttpStatus = res.status;
          break;
        }

        let nextUrl: URL;
        try {
          nextUrl = new URL(location, currentUrl);
        } catch {
          redirectedToAuthwall = true;
          hitLoginWall = true;
          blockedStage = 'authwall';
          lastHttpStatus = res.status;
          break;
        }

        if (
          (nextUrl.protocol !== 'https:' && nextUrl.protocol !== 'http:') ||
          !LINKEDIN_ALLOWED_REDIRECT_HOST_REGEX.test(nextUrl.hostname) ||
          !nextUrl.pathname.toLowerCase().startsWith('/in/')
        ) {
          redirectedToAuthwall = true;
          hitLoginWall = true;
          blockedStage = 'authwall';
          lastHttpStatus = res.status;
          break;
        }

        currentUrl = nextUrl.toString();
        continue;
      }
      break;
    }

    if (!redirectedToAuthwall && res) {
      const status = res.status;
      lastHttpStatus = status;

      if (status === 404 || status === 410) {
        return errorResponse(
          'linkedin',
          'PROFILE_NOT_FOUND',
          LINKEDIN_FRENCH_ERROR_MESSAGES.PROFILE_NOT_FOUND,
          { engineStage: 'direct', httpStatus: status, engineFn: 'linkedin.profile' }
        );
      }

      if (status === 429) {
        return errorResponse(
          'linkedin',
          'RATE_LIMITED',
          LINKEDIN_FRENCH_ERROR_MESSAGES.RATE_LIMITED,
          { engineStage: 'direct', httpStatus: 429, engineFn: 'linkedin.profile' }
        );
      }

      if (status === 999 || status === 401 || status === 403) {
        hitLoginWall = true;
        blockedStage = 'authwall';
      } else if (status >= 200 && status < 300) {
        capturedHtml = await res.text();
        const parsed = parseLinkedInProfileHtml(capturedHtml, normalizedSlug, status);

        if (parsed.ok && parsed.items && parsed.items[0]) {
          // Valider systématiquement l'image primaire extraite avant de la retourner
          const primaryItem = parsed.items[0];
          const validation = await validateLinkedInImageUrl(primaryItem.url);
          if (!validation.ok || !validation.finalUrl) {
            const errCode = validation.errorCode || 'INVALID_IMAGE';
            const errMsg =
              errCode === 'RATE_LIMITED'
                ? LINKEDIN_FRENCH_ERROR_MESSAGES.RATE_LIMITED
                : errCode === 'PHOTO_NOT_AVAILABLE'
                ? LINKEDIN_FRENCH_ERROR_MESSAGES.PHOTO_NOT_AVAILABLE
                : LINKEDIN_FRENCH_ERROR_MESSAGES.INVALID_IMAGE;
            return errorResponse('linkedin', errCode, errMsg, {
              engineStage: parsed.engineStage || 'direct',
              httpStatus: validation.httpStatus ?? status,
              engineFn: 'linkedin.profile',
            });
          }

          const finalUrl = validation.finalUrl;
          const isThumb = validation.isThumbnail ?? true;
          const qualityLabel = isThumb ? 'Miniature' : 'Standard';

          return {
            ...parsed,
            author: {
              username: normalizedSlug,
              avatar: finalUrl,
            },
            thumbnail: finalUrl,
            items: [
              {
                ...primaryItem,
                url: finalUrl,
                thumbnail: finalUrl,
                ext: validation.ext || 'jpg',
                quality: qualityLabel,
                isThumbnail: isThumb,
                width: validation.width,
                height: validation.height,
                size: formatBytesHuman(validation.byteLength),
              },
            ],
          };
        }

        if (parsed.error?.code === 'PHOTO_NOT_AVAILABLE') {
          return parsed;
        }
        if (parsed.error?.code === 'INVALID_IMAGE') {
          return parsed;
        }

        // Sinon, c'est un mur de connexion ou une réponse sans métadonnées -> passer à l'étape 2
        hitLoginWall = true;
        blockedStage = parsed.engineStage || 'authwall';
      } else {
        hitLoginWall = true;
        blockedStage = 'authwall';
      }
    }
  } catch (err) {
    const isAbort =
      err instanceof Error &&
      (err.name === 'AbortError' ||
        err.name === 'TimeoutError' ||
        /abort|timeout/i.test(err.message));
    if (isAbort && lastHttpStatus === null) {
      return errorResponse(
        'linkedin',
        'TIMEOUT',
        'La récupération du profil LinkedIn a dépassé le délai maximum.',
        { engineStage: 'direct', httpStatus: null, engineFn: 'linkedin.profile' }
      );
    }
    hitLoginWall = true;
    blockedStage = 'authwall';
  } finally {
    clearTimeout(timer);
  }

  // Étape 2 : Repli par recherche d'images gratuites à partir du nom extrait du titre ou du slug
  if (hitLoginWall) {
    const personName = extractPersonNameFromSlugOrHtml(normalizedSlug, capturedHtml);
    const candidates = await searchLinkedInFallbackImages(personName);

    if (candidates.length > 0) {
      return {
        ok: true,
        id: normalizedSlug,
        platform: 'linkedin',
        type: 'carousel',
        title: `@${normalizedSlug}`,
        unverifiedFallback: true,
        unverifiedLabel: LINKEDIN_UNVERIFIED_FALLBACK_LABEL,
        author: {
          username: normalizedSlug,
          avatar: candidates[0].thumbnail || candidates[0].url,
        },
        thumbnail: candidates[0].thumbnail || candidates[0].url,
        items: candidates,
        stage: 'tiers',
        engineStage: 'fallback_search',
        httpStatus: 200,
        engineFn: 'linkedin.profile',
        contentKind: 'profile',
      };
    }
  }

  return errorResponse(
    'linkedin',
    'LOGIN_WALL',
    LINKEDIN_FRENCH_ERROR_MESSAGES.LOGIN_WALL,
    {
      engineStage: blockedStage,
      httpStatus: lastHttpStatus,
      engineFn: 'linkedin.profile',
    }
  );
}
