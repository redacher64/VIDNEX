/**
 * Sécurité & Authentification Admin (`/admin` et `/api/admin/*`) :
 * - Comparaison de mot de passe en temps constant (SHA-256 + XOR bit-à-bit) contre `ADMIN_PASSWORD`.
 * - Session par cookie signé HMAC-SHA256 (`SESSION_SECRET`) via Web Crypto API, expiration 12 h,
 *   drapeaux `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`.
 * - Anti-brute-force stocké dans Cloudflare D1 (`login_attempts`) : blocage 15 min après 5 échecs.
 * - Protection CSRF sur toutes les routes mutatives : exige `Content-Type: application/json`
 *   et vérifie que l'en-tête `Origin` correspond à l'origine du site.
 */

import { type AdminEnv, type D1Database, getDb } from './db.ts';

export const ADMIN_COOKIE_NAME = 'vidnex_admin_session';
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 heures
export const MAX_LOGIN_ATTEMPTS = 5;
export const BRUTE_FORCE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Comparaison en temps constant de deux chaînes via leurs condensats SHA-256 (32 octets fixes)
 * pour empêcher toute attaque temporelle (timing attack), même si les longueurs diffèrent.
 */
export async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const bytesA = new Uint8Array(hashA);
  const bytesB = new Uint8Array(hashB);
  let diff = a.length ^ b.length;
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i];
  }
  return diff === 0;
}

async function computeHmacSha256Hex(
  payload: string,
  secret: string
): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(payload));
  return toHex(new Uint8Array(sig));
}

/**
 * Génère la valeur signée du cookie de session Admin (`expTs.nonce.hmacHex`).
 */
export async function createSignedSessionToken(
  sessionSecret: string,
  nowMs = Date.now()
): Promise<string> {
  const expTs = nowMs + SESSION_TTL_MS;
  const randomBytes = new Uint8Array(12);
  crypto.getRandomValues(randomBytes);
  const nonce = toHex(randomBytes);
  const payload = `admin.${expTs}.${nonce}`;
  const signature = await computeHmacSha256Hex(payload, sessionSecret);
  return `${payload}.${signature}`;
}

/**
 * Vérifie l'intégrité HMAC-SHA256 et la date d'expiration (12 h) du token de session.
 */
export async function verifySignedSessionToken(
  token: string,
  sessionSecret: string,
  nowMs = Date.now()
): Promise<boolean> {
  if (!token || !sessionSecret) return false;
  const parts = token.split('.');
  if (parts.length !== 4) return false;

  const [role, expStr, nonce, providedSig] = parts;
  if (role !== 'admin' || !nonce || !providedSig) return false;

  const expTs = Number(expStr);
  if (!Number.isFinite(expTs) || nowMs > expTs) {
    return false;
  }

  const payload = `${role}.${expStr}.${nonce}`;
  const expectedSig = await computeHmacSha256Hex(payload, sessionSecret);
  return constantTimeEqual(providedSig, expectedSig);
}

/**
 * Extrait la valeur d'un cookie nommé depuis l'en-tête `Cookie`.
 */
export function parseCookieValue(
  cookieHeader: string | null,
  name: string
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx > 0) {
      const k = part.slice(0, eqIdx).trim();
      const v = part.slice(eqIdx + 1).trim();
      if (k === name) return v;
    }
  }
  return null;
}

/**
 * Construit l'en-tête `Set-Cookie` sécurisé (HttpOnly, Secure, SameSite=Strict, 12h).
 */
export function buildSessionSetCookieHeader(token: string): string {
  const maxAgeSec = Math.floor(SESSION_TTL_MS / 1000);
  return `${ADMIN_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAgeSec}`;
}

/**
 * Construit l'en-tête `Set-Cookie` de déconnexion immédiate.
 */
export function buildLogoutSetCookieHeader(): string {
  return `${ADMIN_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

/**
 * Vérifie si la requête possède une session Admin valide.
 */
export async function isRequestAdminAuthenticated(
  request: Request,
  env: AdminEnv
): Promise<boolean> {
  const secret = String(env.SESSION_SECRET || '').trim();
  if (!secret) return false;
  const token = parseCookieValue(
    request.headers.get('Cookie'),
    ADMIN_COOKIE_NAME
  );
  if (!token) return false;
  return verifySignedSessionToken(token, secret);
}

/**
 * Vérifie la protection CSRF sur les requêtes qui modifient des données (`POST`, `PUT`, `DELETE`) :
 * 1. Exige `Content-Type: application/json`
 * 2. Vérifie que l'en-tête `Origin` correspond à l'origine de la requête.
 */
export function verifyCsrfAndJson(request: Request): {
  ok: boolean;
  error?: string;
} {
  const contentType = (request.headers.get('Content-Type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return {
      ok: false,
      error: 'En-tête Content-Type: application/json obligatoire.',
    };
  }

  const originHeader = request.headers.get('Origin');
  if (!originHeader) {
    return {
      ok: false,
      error: 'En-tête Origin manquant (protection CSRF).',
    };
  }

  try {
    const reqUrl = new URL(request.url);
    const originUrl = new URL(originHeader);
    if (originUrl.host !== reqUrl.host) {
      return {
        ok: false,
        error: 'Origine non autorisée (protection CSRF).',
      };
    }
  } catch {
    return {
      ok: false,
      error: 'En-tête Origin invalide.',
    };
  }

  return { ok: true };
}

export interface BruteForceStatus {
  blocked: boolean;
  retryAfterSec: number;
  remainingAttempts: number;
}

/**
 * Vérifie dans la table D1 `login_attempts` si l'IP hachée est actuellement bloquée.
 */
export async function checkLoginBruteForce(
  db: D1Database | null,
  ipHash: string,
  nowMs = Date.now()
): Promise<BruteForceStatus> {
  if (!db) {
    return {
      blocked: false,
      retryAfterSec: 0,
      remainingAttempts: MAX_LOGIN_ATTEMPTS,
    };
  }

  try {
    const row = await db
      .prepare(
        'SELECT ip_hash, count, window_start_ts, blocked_until_ts FROM login_attempts WHERE ip_hash = ?'
      )
      .bind(ipHash)
      .first<{
        ip_hash: string;
        count: number;
        window_start_ts: number;
        blocked_until_ts: number | null;
      }>();

    if (!row) {
      return {
        blocked: false,
        retryAfterSec: 0,
        remainingAttempts: MAX_LOGIN_ATTEMPTS,
      };
    }

    if (row.blocked_until_ts && Number(row.blocked_until_ts) > nowMs) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((Number(row.blocked_until_ts) - nowMs) / 1000)
      );
      return {
        blocked: true,
        retryAfterSec,
        remainingAttempts: 0,
      };
    }

    // Si la fenêtre de 15 minutes ou le blocage est expiré, on repart à zéro
    if (nowMs - Number(row.window_start_ts) > BRUTE_FORCE_WINDOW_MS) {
      return {
        blocked: false,
        retryAfterSec: 0,
        remainingAttempts: MAX_LOGIN_ATTEMPTS,
      };
    }

    const used = Number(row.count) || 0;
    return {
      blocked: false,
      retryAfterSec: 0,
      remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - used),
    };
  } catch {
    return {
      blocked: false,
      retryAfterSec: 0,
      remainingAttempts: MAX_LOGIN_ATTEMPTS,
    };
  }
}

/**
 * Enregistre un échec de connexion dans `login_attempts` et active le blocage de 15 min au 5e échec.
 */
export async function recordFailedLoginAttempt(
  env: AdminEnv,
  ipHash: string,
  nowMs = Date.now()
): Promise<BruteForceStatus> {
  const db = getDb(env);
  if (!db) {
    return {
      blocked: false,
      retryAfterSec: 0,
      remainingAttempts: MAX_LOGIN_ATTEMPTS - 1,
    };
  }

  try {
    const existing = await db
      .prepare(
        'SELECT ip_hash, count, window_start_ts, blocked_until_ts FROM login_attempts WHERE ip_hash = ?'
      )
      .bind(ipHash)
      .first<{
        ip_hash: string;
        count: number;
        window_start_ts: number;
        blocked_until_ts: number | null;
      }>();

    let nextCount = 1;
    let windowStart = nowMs;

    if (
      existing &&
      nowMs - Number(existing.window_start_ts) <= BRUTE_FORCE_WINDOW_MS &&
      (!existing.blocked_until_ts || Number(existing.blocked_until_ts) <= nowMs)
    ) {
      nextCount = (Number(existing.count) || 0) + 1;
      windowStart = Number(existing.window_start_ts);
    }

    const blockedUntil =
      nextCount >= MAX_LOGIN_ATTEMPTS ? nowMs + LOCKOUT_DURATION_MS : null;

    await db
      .prepare(
        `INSERT INTO login_attempts (ip_hash, count, window_start_ts, blocked_until_ts)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(ip_hash) DO UPDATE SET
           count = excluded.count,
           window_start_ts = excluded.window_start_ts,
           blocked_until_ts = excluded.blocked_until_ts`
      )
      .bind(ipHash, nextCount, windowStart, blockedUntil)
      .run();

    if (blockedUntil) {
      return {
        blocked: true,
        retryAfterSec: Math.ceil(LOCKOUT_DURATION_MS / 1000),
        remainingAttempts: 0,
      };
    }

    return {
      blocked: false,
      retryAfterSec: 0,
      remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - nextCount),
    };
  } catch {
    return {
      blocked: false,
      retryAfterSec: 0,
      remainingAttempts: MAX_LOGIN_ATTEMPTS - 1,
    };
  }
}

/**
 * Réinitialise le compteur d'échecs après une connexion réussie.
 */
export async function clearLoginAttempts(
  env: AdminEnv,
  ipHash: string
): Promise<void> {
  const db = getDb(env);
  if (!db) return;
  try {
    await db
      .prepare('DELETE FROM login_attempts WHERE ip_hash = ?')
      .bind(ipHash)
      .run();
  } catch {
    // Ignorer si D1 est indisponible
  }
}
