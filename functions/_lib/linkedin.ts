import { BROWSER_USER_AGENT } from './http.ts';
import { isAllowedMediaUrl } from './allowlist.ts';
import type { ErrorCode, ExtractMediaItem, ExtractResponse } from './normalize.ts';

const LINKEDIN_ATTEMPT_TIMEOUT_MS = 6500;
const IMAGE_VALIDATION_TIMEOUT_MS = 4500;
const FALLBACK_SEARCH_TIMEOUT_MS = 4500;
const MAX_REDIRECT_HOPS = 4;
const LINKEDIN_CACHE_DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const LINKEDIN_CACHE_MAX_ENTRIES = 250;

export const MAX_LINKEDIN_IMAGE_BYTES = 10 * 1024 * 1024; // 10 Mo max
export const MIN_LINKEDIN_IMAGE_BYTES = 12; // Au moins 12 octets pour l'en-tête binaire
export const MAX_FALLBACK_CANDIDATES = 6;

export const LINKEDIN_UNVERIFIED_FALLBACK_LABEL =
  'Résultats non vérifiés, peut-être pas la bonne personne';

const LINKEDIN_ALLOWED_REDIRECT_HOST_REGEX =
  /^(?:(?:www|m|mobile|[a-z]{2})\.)?linkedin\.com$/i;

export type LinkedInErrorCode =
  | 'PROFILE_NOT_FOUND'
  | 'LOGIN_WALL'
  | 'RATE_LIMITED'
  | 'PHOTO_NOT_AVAILABLE'
  | 'INVALID_IMAGE'
  | 'IMAGE_EXPIRED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR';

/**
 * Messages d'erreur français distincts pour chaque code d'erreur LinkedIn.
 * Pour LOGIN_WALL, ne jamais dire « réessayez » — proposer la solution de repli.
 */
export const LINKEDIN_FRENCH_ERROR_MESSAGES: Record<LinkedInErrorCode, string> = {
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
  IMAGE_EXPIRED:
    'Le lien signé de la photo de profil LinkedIn a expiré. Relancez l’extraction pour obtenir un nouveau lien valide.',
  TIMEOUT:
    'La récupération du profil LinkedIn a dépassé le délai maximum autorisé.',
  NETWORK_ERROR:
    'Impossible de contacter LinkedIn en raison d’une erreur réseau. Vérifiez la connexion ou utilisez l’import manuel ci-dessous.',
};

interface CachedLinkedInEntry {
  response: ExtractResponse;
  cachedAtMs: number;
  expiresAtMs: number;
  signedUrlExpiryMs: number | null;
}

const linkedInMemoryCache = new Map<string, CachedLinkedInEntry>();
const inFlightLinkedInExtractions = new Map<string, Promise<ExtractResponse>>();
let lastObservedFetchRef: typeof fetch | null = null;

function syncCacheWithFetchEnv(): void {
  if (lastObservedFetchRef !== globalThis.fetch) {
    linkedInMemoryCache.clear();
    inFlightLinkedInExtractions.clear();
    lastObservedFetchRef = globalThis.fetch;
  }
}

export function clearLinkedInCache(): void {
  linkedInMemoryCache.clear();
  inFlightLinkedInExtractions.clear();
}

/**
 * Extrait le timestamp d'expiration (en ms) du paramètre signé `?e=` sur `media.licdn.com`.
 */
export function getLinkedInSignedUrlExpiryMs(rawUrl: string): number | null {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.hostname.toLowerCase().endsWith('.licdn.com')) return null;
    const eParam = parsed.searchParams.get('e');
    if (!eParam || !/^\d{9,11}$/.test(eParam.trim())) return null;
    const epochSec = Number(eParam.trim());
    if (!Number.isFinite(epochSec) || epochSec <= 0) return null;
    return epochSec * 1000;
  } catch {
    return null;
  }
}

/**
 * Indique si une URL signée `media.licdn.com` possède un paramètre `e=` arrivé à expiration.
 */
export function isLinkedInImageUrlExpired(
  rawUrl: string,
  nowMs = Date.now()
): boolean {
  const expiryMs = getLinkedInSignedUrlExpiryMs(rawUrl);
  if (expiryMs === null) return false;
  return expiryMs <= nowMs;
}

export function getCachedLinkedInResult(
  slug: string,
  nowMs = Date.now()
): ExtractResponse | null {
  syncCacheWithFetchEnv();
  const key = slug.trim().toLowerCase();
  const entry = linkedInMemoryCache.get(key);
  if (!entry) return null;

  if (nowMs >= entry.expiresAtMs) {
    linkedInMemoryCache.delete(key);
    return null;
  }

  // Si l'URL signée était valide au moment de la mise en cache mais a expiré depuis, évincer
  if (
    entry.signedUrlExpiryMs !== null &&
    entry.signedUrlExpiryMs > entry.cachedAtMs &&
    nowMs >= entry.signedUrlExpiryMs - 5000
  ) {
    linkedInMemoryCache.delete(key);
    return null;
  }

  return entry.response;
}

export function setCachedLinkedInResult(
  slug: string,
  response: ExtractResponse,
  nowMs = Date.now()
): void {
  syncCacheWithFetchEnv();
  // Ne jamais mettre en cache un échec ou une réponse sans image validée
  if (!response.ok || !response.items || response.items.length === 0) {
    return;
  }

  const key = slug.trim().toLowerCase();
  const primaryUrl = response.items[0]?.url || response.thumbnail || '';
  const signedUrlExpiryMs = getLinkedInSignedUrlExpiryMs(primaryUrl);

  // Si l'URL possède un timestamp futur, caler le TTL avant son expiration
  let expiresAtMs = nowMs + LINKEDIN_CACHE_DEFAULT_TTL_MS;
  if (signedUrlExpiryMs !== null && signedUrlExpiryMs > nowMs) {
    const safeExpiry = signedUrlExpiryMs - 15_000;
    if (safeExpiry <= nowMs) {
      return;
    }
    expiresAtMs = Math.min(expiresAtMs, safeExpiry);
  }

  if (linkedInMemoryCache.size >= LINKEDIN_CACHE_MAX_ENTRIES) {
    const oldestKey = linkedInMemoryCache.keys().next().value;
    if (oldestKey) {
      linkedInMemoryCache.delete(oldestKey);
    }
  }

  linkedInMemoryCache.set(key, {
    response,
    cachedAtMs: nowMs,
    expiresAtMs,
    signedUrlExpiryMs,
  });
}

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
    .replace(/&gt;/g, '>')
    .replace(/\\u0026/gi, '&')
    .replace(/\\\//g, '/');
}

export function isGhostOrDefaultLinkedInImage(url: string): boolean {
  const lower = url.toLowerCase();
  if (
    lower.includes('static.licdn.com') ||
    lower.includes('ghost-person') ||
    lower.includes('ghost_person') ||
    lower.includes('ghost-organization') ||
    lower.includes('default-avatar') ||
    lower.includes('/aero-v1/sc/h/') ||
    lower.includes('/sc/h/')
  ) {
    return true;
  }
  return false;
}

export function isBannerOrNonProfileLinkedInImage(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('profile-displaybackgroundimage') ||
    lower.includes('company-logo') ||
    lower.includes('organization-logo') ||
    lower.includes('feedshare-') ||
    lower.includes('article-cover_')
  );
}

/**
 * Attribue un score de résolution aux URLs d'images de profil LinkedIn
 * pour privilégier la meilleure résolution réellement disponible (`800x800` > `400x400` > `200x200` > `100x100`).
 */
export function scoreLinkedInImageResolution(url: string): number {
  const lower = url.toLowerCase();
  if (lower.includes('800_800') || lower.includes('original')) return 800;
  if (lower.includes('400_400')) return 400;
  if (lower.includes('200_200')) return 200;
  if (lower.includes('100_100')) return 100;
  const shrinkMatch = lower.match(/(?:shrink|scale)_(\d{2,4})_(\d{2,4})/);
  if (shrinkMatch) {
    return Math.max(Number(shrinkMatch[1]), Number(shrinkMatch[2]));
  }
  return 300;
}

export function inferDimensionsFromLinkedInUrl(
  url: string
): { width?: number; height?: number } {
  const lower = url.toLowerCase();
  const match = lower.match(/(?:shrink|scale)_(\d{2,4})_(\d{2,4})/);
  if (match) {
    const w = Number(match[1]);
    const h = Number(match[2]);
    if (w >= 50 && w <= 4096 && h >= 50 && h <= 4096) {
      return { width: w, height: h };
    }
  }
  return {};
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
      /\b(?:property|name)\s*=\s*["']og:image(?::secure_url|:url)?["']/i.test(tag) ||
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

function extractImageUrlFromJsonLdValue(img: unknown): string | null {
  if (!img) return null;
  if (typeof img === 'string' && (img.startsWith('https://') || img.startsWith('http://'))) {
    return decodeHtmlEntities(img.trim());
  }
  if (Array.isArray(img)) {
    let best: string | null = null;
    let bestScore = -1;
    for (const item of img) {
      const url = extractImageUrlFromJsonLdValue(item);
      if (url) {
        const s = scoreLinkedInImageResolution(url);
        if (s > bestScore) {
          best = url;
          bestScore = s;
        }
      }
    }
    return best;
  }
  if (typeof img === 'object') {
    const imgObj = img as Record<string, unknown>;
    const rawUrl =
      (typeof imgObj.contentUrl === 'string' && imgObj.contentUrl) ||
      (typeof imgObj.url === 'string' && imgObj.url);
    if (rawUrl && (rawUrl.startsWith('https://') || rawUrl.startsWith('http://'))) {
      return decodeHtmlEntities(rawUrl.trim());
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
    const extracted = extractImageUrlFromJsonLdValue(record.image);
    if (extracted) return extracted;
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

function findBestVectorImageInObject(node: unknown): string | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    let best: string | null = null;
    let bestScore = -1;
    for (const item of node) {
      const candidate = findBestVectorImageInObject(item);
      if (candidate) {
        const score = scoreLinkedInImageResolution(candidate);
        if (score > bestScore) {
          best = candidate;
          bestScore = score;
        }
      }
    }
    return best;
  }

  const rec = node as Record<string, unknown>;
  if (typeof rec.rootUrl === 'string' && Array.isArray(rec.artifacts)) {
    const rootUrl = decodeHtmlEntities(rec.rootUrl.trim());
    if (
      rootUrl.startsWith('https://') &&
      rootUrl.includes('licdn.com') &&
      !isBannerOrNonProfileLinkedInImage(rootUrl)
    ) {
      let bestSegment = '';
      let bestArea = -1;
      for (const art of rec.artifacts) {
        if (!art || typeof art !== 'object') continue;
        const artRec = art as Record<string, unknown>;
        const seg =
          typeof artRec.fileIdentifyingUrlPathSegment === 'string'
            ? decodeHtmlEntities(artRec.fileIdentifyingUrlPathSegment.trim())
            : '';
        if (!seg || isBannerOrNonProfileLinkedInImage(seg)) continue;
        const w = typeof artRec.width === 'number' ? artRec.width : 0;
        const h = typeof artRec.height === 'number' ? artRec.height : 0;
        const area = w > 0 && h > 0 ? w * h : scoreLinkedInImageResolution(seg);
        if (area > bestArea) {
          bestArea = area;
          bestSegment = seg;
        }
      }
      if (bestSegment) {
        const joined =
          rootUrl.endsWith('/') ||
          rootUrl.endsWith('-') ||
          rootUrl.endsWith('_') ||
          bestSegment.startsWith('/')
            ? `${rootUrl}${bestSegment}`
            : `${rootUrl}/${bestSegment}`;
        if (
          joined.includes('profile-displayphoto') ||
          joined.includes('profile-framedphoto') ||
          !isBannerOrNonProfileLinkedInImage(joined)
        ) {
          return joined;
        }
      }
    }
  }

  let bestNested: string | null = null;
  let bestNestedScore = -1;
  for (const val of Object.values(rec)) {
    if (val && typeof val === 'object') {
      const found = findBestVectorImageInObject(val);
      if (found) {
        const s = scoreLinkedInImageResolution(found);
        if (s > bestNestedScore) {
          bestNested = found;
          bestNestedScore = s;
        }
      }
    }
  }
  return bestNested;
}

/**
 * 1d. Extraction depuis les métadonnées publiques embarquées dans le DOM LinkedIn :
 * - Blocs `<code>` JSON (`rootUrl` + `artifacts[].fileIdentifyingUrlPathSegment`)
 * - Attributs `data-delayed-url` / `src` / `srcset` contenant `media.licdn.com/dms/image/.../profile-displayphoto...`
 * Retourne toujours la variante de plus haute résolution disponible.
 */
export function extractEmbeddedProfileImageFromHtml(html: string): string | null {
  const candidates: string[] = [];

  // 1. Parcourir les blocs <code ...>...</code> contenant du JSON Voyager public
  const codeRegex = /<code\b[^>]*>([\s\S]*?)<\/code>/gi;
  let codeMatch: RegExpExecArray | null;
  while ((codeMatch = codeRegex.exec(html)) !== null) {
    const rawContent = decodeHtmlEntities((codeMatch[1] || '').trim());
    if (
      !rawContent ||
      (!rawContent.includes('profile-displayphoto') &&
        !rawContent.includes('profile-framedphoto') &&
        !rawContent.includes('fileIdentifyingUrlPathSegment'))
    ) {
      continue;
    }
    try {
      const parsed = JSON.parse(rawContent);
      const vectorCandidate = findBestVectorImageInObject(parsed);
      if (vectorCandidate) {
        candidates.push(vectorCandidate);
      }
    } catch {
      // Continuer vers l'analyse regex directe
    }
  }

  // 2. Rechercher les URLs directes media.licdn.com/dms/image/.../profile-displayphoto...
  const decodedHtml = decodeHtmlEntities(html);
  const directUrlRegex =
    /https:\/\/(?:[a-z0-9-]+\.)?media\.licdn\.com\/dms\/image\/[^\s"'<>\\)]+/gi;
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = directUrlRegex.exec(decodedHtml)) !== null) {
    const rawCandidate = urlMatch[0].replace(/[;,]+$/, '');
    const lower = rawCandidate.toLowerCase();
    if (
      (lower.includes('profile-displayphoto') ||
        lower.includes('profile-framedphoto')) &&
      !isBannerOrNonProfileLinkedInImage(rawCandidate) &&
      !isGhostOrDefaultLinkedInImage(rawCandidate)
    ) {
      candidates.push(rawCandidate);
    }
  }

  if (candidates.length === 0) return null;

  let bestUrl = candidates[0];
  let bestScore = scoreLinkedInImageResolution(bestUrl);
  for (let i = 1; i < candidates.length; i++) {
    const score = scoreLinkedInImageResolution(candidates[i]);
    if (score > bestScore) {
      bestScore = score;
      bestUrl = candidates[i];
    }
  }

  return bestUrl;
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

export function isProfileNotFoundHtml(html: string): boolean {
  const lower = html.toLowerCase();
  if (isAuthwallHtml(html)) return false;
  return (
    lower.includes('profile-not-found') ||
    lower.includes('page-not-found') ||
    lower.includes('exact-match-404') ||
    lower.includes('this page doesn’t exist') ||
    lower.includes("this page doesn't exist") ||
    lower.includes('ce profil n’est pas disponible') ||
    lower.includes("ce profil n'est pas disponible") ||
    lower.includes('cette page n’existe pas') ||
    lower.includes("cette page n'existe pas")
  );
}

export function isPublicProfileWithoutPhotoHtml(html: string): boolean {
  const lower = html.toLowerCase();
  if (isAuthwallHtml(html) || isProfileNotFoundHtml(html)) return false;
  if (
    lower.includes('ghost-person') ||
    lower.includes('ghost_person') ||
    lower.includes('244xhbkr7g40x6bsu4gi6q4ry')
  ) {
    return true;
  }
  const hasPublicProfileMarkers =
    lower.includes('top-card-layout') ||
    lower.includes('pv-top-card') ||
    lower.includes('public_profile_') ||
    lower.includes('"@type":"profilepage"') ||
    lower.includes('"@type": "profilepage"');
  return hasPublicProfileMarkers;
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
        !/^(?:linkedin|sign\s*in|sign\s*up|log\s*in|s['’]identifier|s['’]inscrire|rejoindre|authwall|security\s*verification|page\s*not\s*found|404)/i.test(
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
 * Extrait les dimensions (largeur x hauteur) depuis les premiers octets binaires de l'image
 * (PNG, GIF, JPEG tous marqueurs SOF, et WebP VP8 / VP8L / VP8X).
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
    } else if (format === 'webp' && bytes.length >= 30) {
      const chunkFourCC = String.fromCharCode(
        bytes[12],
        bytes[13],
        bytes[14],
        bytes[15]
      );
      if (chunkFourCC === 'VP8 ' && bytes.length >= 30) {
        // Sync code 0x9D 0x01 0x2A aux octets 23..25
        if (bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
          const width = ((bytes[27] << 8) | bytes[26]) & 0x3fff;
          const height = ((bytes[29] << 8) | bytes[28]) & 0x3fff;
          if (width > 0 && height > 0 && width <= 20000 && height <= 20000) {
            return { width, height };
          }
        }
      } else if (chunkFourCC === 'VP8L' && bytes.length >= 25) {
        // Signature 0x2F à l'octet 20
        if (bytes[20] === 0x2f) {
          const b1 = bytes[21];
          const b2 = bytes[22];
          const b3 = bytes[23];
          const b4 = bytes[24];
          const width = 1 + (((b2 & 0x3f) << 8) | b1);
          const height =
            1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
          if (width > 0 && height > 0 && width <= 20000 && height <= 20000) {
            return { width, height };
          }
        }
      } else if (chunkFourCC === 'VP8X' && bytes.length >= 30) {
        const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
        const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
        if (width > 0 && height > 0 && width <= 20000 && height <= 20000) {
          return { width, height };
        }
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
        const isSofMarker =
          (marker >= 0xc0 && marker <= 0xc3) ||
          (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) ||
          (marker >= 0xcd && marker <= 0xcf);
        if (isSofMarker && offset + 8 < bytes.length) {
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
    lower.includes('scale_100_100') ||
    lower.includes('scale_200_200') ||
    lower.includes('scale_400_400') ||
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
  if (
    typeof width === 'number' &&
    width >= 600 &&
    typeof height === 'number' &&
    height >= 600
  ) {
    return false;
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
 * - Vérifie le statut HTTP 200 (ou 206 si Range est accepté), avec repli sans Range si le CDN refuse Range
 * - Détecte les URLs d'images signées expirées (`IMAGE_EXPIRED`)
 * - Vérifie l'en-tête `Content-Type: image/*` (ne retourne jamais une page HTML)
 * - Vérifie la limite de taille (`MIN_LINKEDIN_IMAGE_BYTES` .. `MAX_LINKEDIN_IMAGE_BYTES`)
 * - Vérifie les vrais magic bytes de l'image (JPEG, PNG, WebP, GIF)
 * - Extrait ou déduit les dimensions (PNG, GIF, JPEG, WebP)
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

  const buildImageHeaders = (targetUrl: string, useRange: boolean): Record<string, string> => {
    const isLicdn = targetUrl.toLowerCase().includes('.licdn.com');
    return {
      'User-Agent': BROWSER_USER_AGENT,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      ...(isLicdn ? { Referer: 'https://www.linkedin.com/' } : {}),
      ...(useRange ? { Range: 'bytes=0-16383' } : {}),
    };
  };

  try {
    let res: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
      res = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: buildImageHeaders(currentUrl, true),
      });

      // Certains nœuds CDN rejettent l'en-tête Range avec 400 ou 416 : réessayer sans Range
      if (res.status === 400 || res.status === 416) {
        try {
          await res.body?.cancel();
        } catch {
          // Ignorer
        }
        res = await fetch(currentUrl, {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: buildImageHeaders(currentUrl, false),
        });
      }

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

    // Détection explicite des URLs d'images LinkedIn expirées (HTTP 401/403/410 sur CDN ou signature e= expirée)
    const isLicdnUrl = currentUrl.toLowerCase().includes('.licdn.com');
    const hasExpiredTimestamp = isLinkedInImageUrlExpired(currentUrl);
    if (
      status === 401 ||
      status === 403 ||
      (status === 410 && (isLicdnUrl || hasExpiredTimestamp)) ||
      (status === 404 && hasExpiredTimestamp)
    ) {
      try {
        await res.body?.cancel();
      } catch {
        // Ignorer
      }
      return { ok: false, httpStatus: status, errorCode: 'IMAGE_EXPIRED' };
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
      return {
        ok: false,
        httpStatus: status,
        errorCode: hasExpiredTimestamp ? 'IMAGE_EXPIRED' : 'INVALID_IMAGE',
      };
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

    const parsedDims = parseImageDimensionsFromBytes(sample, ext);
    const inferredDims =
      !parsedDims.width || !parsedDims.height
        ? inferDimensionsFromLinkedInUrl(currentUrl)
        : {};
    const width = parsedDims.width ?? inferredDims.width;
    const height = parsedDims.height ?? inferredDims.height;

    const isThumbnail = isSmallOrThumbnailImage(
      currentUrl,
      width,
      height,
      effectiveSize
    );

    return {
      ok: true,
      finalUrl: currentUrl,
      ext,
      contentType,
      byteLength: effectiveSize,
      width,
      height,
      isThumbnail,
      qualityLabel: isThumbnail ? 'Miniature' : 'Standard',
      httpStatus: 200,
    };
  } catch (err) {
    const isAbort =
      err instanceof Error &&
      (err.name === 'AbortError' ||
        err.name === 'TimeoutError' ||
        /abort|timeout/i.test(err.message));
    return {
      ok: false,
      httpStatus: null,
      errorCode: isAbort ? 'TIMEOUT' : 'INVALID_IMAGE',
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
 * Analyse le HTML d'un profil public LinkedIn dans l'ordre de priorité :
 * 1. `og:image`
 * 2. `twitter:image`
 * 3. JSON-LD `"image"`
 * 4. Métadonnées publiques embarquées (`<code>` / `media.licdn.com/dms/image/.../profile-displayphoto...`)
 *
 * Si plusieurs variantes de la photo de profil publique sont exposées dans la page,
 * sélectionne la meilleure résolution disponible.
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

  // Ordre de priorité : og:image -> twitter:image -> JSON-LD "image" -> embedded public metadata
  const ogImage = extractOgImageFromHtml(html);
  const twitterImage = !ogImage ? extractTwitterImageFromHtml(html) : null;
  const jsonLdImage = !ogImage && !twitterImage ? extractJsonLdImageFromHtml(html) : null;
  const embeddedImage = extractEmbeddedProfileImageFromHtml(html);

  let candidateUrl = ogImage || twitterImage || jsonLdImage || embeddedImage;

  // Si og:image / twitter:image / JSON-LD pointe vers un avatar fantôme mais qu'une vraie photo publique est embarquée
  if (
    candidateUrl &&
    isGhostOrDefaultLinkedInImage(candidateUrl) &&
    embeddedImage &&
    !isGhostOrDefaultLinkedInImage(embeddedImage)
  ) {
    candidateUrl = embeddedImage;
  }

  // Si une variante embarquée offre une meilleure résolution de la photo de profil, la privilégier
  if (
    candidateUrl &&
    embeddedImage &&
    embeddedImage !== candidateUrl &&
    !isGhostOrDefaultLinkedInImage(embeddedImage) &&
    isAllowedMediaUrl(embeddedImage) &&
    scoreLinkedInImageResolution(embeddedImage) >
      scoreLinkedInImageResolution(candidateUrl)
  ) {
    candidateUrl = embeddedImage;
  }

  if (!candidateUrl) {
    if (isProfileNotFoundHtml(html)) {
      return errorResponse(
        'linkedin',
        'PROFILE_NOT_FOUND',
        LINKEDIN_FRENCH_ERROR_MESSAGES.PROFILE_NOT_FOUND,
        { engineStage: 'direct', httpStatus: 404, engineFn: 'linkedin.profile' }
      );
    }
    if (isPublicProfileWithoutPhotoHtml(html)) {
      return errorResponse(
        'linkedin',
        'PHOTO_NOT_AVAILABLE',
        LINKEDIN_FRENCH_ERROR_MESSAGES.PHOTO_NOT_AVAILABLE,
        { engineStage: 'direct', httpStatus, engineFn: 'linkedin.profile' }
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
    : jsonLdImage
    ? 'jsonld'
    : 'embedded_meta';
  const isThumb = isSmallOrThumbnailImage(candidateUrl);
  const qualityLabel = isThumb ? 'Miniature' : 'Standard';
  const inferredDims = inferDimensionsFromLinkedInUrl(candidateUrl);

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
        ...(inferredDims.width ? { width: inferredDims.width } : {}),
        ...(inferredDims.height ? { height: inferredDims.height } : {}),
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
 * jusqu'à 6 candidats avec miniature + lien source, marqués comme non vérifiés.
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

export interface ExtractLinkedInOptions {
  bypassCache?: boolean;
  allowFallbackSearch?: boolean;
}

/**
 * Extracteur de photo de profil LinkedIn en 3 niveaux avec cache intelligent :
 * 1. Primaire : requête de la page publique avec en-têtes navigateur normaux (`og:image` -> `twitter:image` -> JSON-LD -> métadonnées embarquées).
 *    Si mur de connexion (`/authwall`, `/login`, statut 999), arrêt immédiat sans contournement et passage à l'étape 2.
 * 2. Repli (recherche d'images optionnelle) : extrait le nom depuis le slug ou le titre de la page, cherche jusqu'à 6 images candidates via Wikimedia/Wikipedia, valide chaque image (HTTP 200, `image/*`, magic bytes, limite de taille) et les marque explicitement comme non vérifiées (`unverifiedFallback: true`).
 * 3. Dernier recours : en cas d'absence de candidat ou d'échec, retourne un code d'erreur précis (`PROFILE_NOT_FOUND`, `LOGIN_WALL`, `RATE_LIMITED`, `PHOTO_NOT_AVAILABLE`, `INVALID_IMAGE`, `IMAGE_EXPIRED`, `TIMEOUT`, `NETWORK_ERROR`).
 */
export async function extractLinkedIn(
  slug: string,
  options?: ExtractLinkedInOptions
): Promise<ExtractResponse> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) {
    return errorResponse(
      'linkedin',
      'PROFILE_NOT_FOUND',
      LINKEDIN_FRENCH_ERROR_MESSAGES.PROFILE_NOT_FOUND,
      { engineStage: 'direct', httpStatus: 404, engineFn: 'linkedin.profile' }
    );
  }

  syncCacheWithFetchEnv();

  if (!options?.bypassCache) {
    const cached = getCachedLinkedInResult(normalizedSlug);
    if (cached) {
      return cached;
    }
    const inFlight = inFlightLinkedInExtractions.get(normalizedSlug);
    if (inFlight) {
      return inFlight;
    }
  }

  const extractionPromise = performLinkedInExtraction(normalizedSlug, options);
  if (!options?.bypassCache) {
    inFlightLinkedInExtractions.set(normalizedSlug, extractionPromise);
  }

  try {
    const result = await extractionPromise;
    if (result.ok && !result.unverifiedFallback) {
      setCachedLinkedInResult(normalizedSlug, result);
    }
    return result;
  } finally {
    inFlightLinkedInExtractions.delete(normalizedSlug);
  }
}

async function performLinkedInExtraction(
  normalizedSlug: string,
  options?: ExtractLinkedInOptions
): Promise<ExtractResponse> {
  const initialUrl = `https://www.linkedin.com/in/${encodeURIComponent(normalizedSlug)}`;
  const allowFallbackSearch = options?.allowFallbackSearch ?? true;

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
    let redirectedToNotFound = false;

    // Étape 1 : Requête avec en-têtes navigateur normaux (jusqu'à MAX_REDIRECT_HOPS redirections canoniques /in/)
    for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
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
        try {
          await res.body?.cancel();
        } catch {
          // Ignorer
        }
        if (location.toLowerCase().includes('/404')) {
          redirectedToNotFound = true;
          lastHttpStatus = 404;
          break;
        }
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

    if (redirectedToNotFound) {
      return errorResponse(
        'linkedin',
        'PROFILE_NOT_FOUND',
        LINKEDIN_FRENCH_ERROR_MESSAGES.PROFILE_NOT_FOUND,
        { engineStage: 'direct', httpStatus: 404, engineFn: 'linkedin.profile' }
      );
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
          const validation = await validateLinkedInImageUrl(primaryItem.url, {
            signal: controller.signal,
          });
          if (!validation.ok || !validation.finalUrl) {
            const errCode = (validation.errorCode || 'INVALID_IMAGE') as ErrorCode;
            const errMsg =
              errCode === 'RATE_LIMITED'
                ? LINKEDIN_FRENCH_ERROR_MESSAGES.RATE_LIMITED
                : errCode === 'PHOTO_NOT_AVAILABLE'
                ? LINKEDIN_FRENCH_ERROR_MESSAGES.PHOTO_NOT_AVAILABLE
                : errCode === 'IMAGE_EXPIRED'
                ? LINKEDIN_FRENCH_ERROR_MESSAGES.IMAGE_EXPIRED
                : errCode === 'TIMEOUT'
                ? LINKEDIN_FRENCH_ERROR_MESSAGES.TIMEOUT
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

        if (
          parsed.error?.code === 'PHOTO_NOT_AVAILABLE' ||
          parsed.error?.code === 'PROFILE_NOT_FOUND' ||
          parsed.error?.code === 'INVALID_IMAGE' ||
          parsed.error?.code === 'IMAGE_EXPIRED'
        ) {
          return parsed;
        }

        // Sinon, c'est un mur de connexion ou une réponse sans métadonnées -> passer à l'étape 2
        hitLoginWall = true;
        blockedStage = parsed.engineStage || 'authwall';
      } else if (status >= 500 && status <= 599) {
        return errorResponse(
          'linkedin',
          'NETWORK_ERROR',
          LINKEDIN_FRENCH_ERROR_MESSAGES.NETWORK_ERROR,
          { engineStage: 'direct', httpStatus: status, engineFn: 'linkedin.profile' }
        );
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
        LINKEDIN_FRENCH_ERROR_MESSAGES.TIMEOUT,
        { engineStage: 'direct', httpStatus: null, engineFn: 'linkedin.profile' }
      );
    }
    const isStatus999RangeError =
      err instanceof RangeError && /status|999/i.test(err.message);
    if (isStatus999RangeError) {
      hitLoginWall = true;
      blockedStage = 'authwall';
      lastHttpStatus = 999;
    } else if (lastHttpStatus === null) {
      return errorResponse(
        'linkedin',
        'NETWORK_ERROR',
        LINKEDIN_FRENCH_ERROR_MESSAGES.NETWORK_ERROR,
        { engineStage: 'direct', httpStatus: null, engineFn: 'linkedin.profile' }
      );
    } else {
      hitLoginWall = true;
      blockedStage = 'authwall';
    }
  } finally {
    clearTimeout(timer);
  }

  // Étape 2 : Repli par recherche d'images publiques gratuites à partir du nom extrait du titre ou du slug
  if (hitLoginWall && allowFallbackSearch) {
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
