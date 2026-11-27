/**
 * Protections anti-spam / anti-flood légères pour VIDNEX :
 * - Liste blanche stricte de domaines autorisés pour `/api/extract` + limite de taille d'URL (2048 car.)
 * - Rejet des requêtes sans User-Agent ou avec User-Agent de bots connus
 * - Verrou de concurrence : 1 extraction active à la fois par IP hachée
 * - Auto-blocage 24h dans D1 (`blocked_ips`) après 3 dépassements de limite en 1h
 * - Compteur journalier léger des requêtes refusées (`daily_metrics` platform='security', event='rejected_request')
 */

import { type AdminEnv, type ExecutionContextLike, getDb } from './db.ts';
import { isPrivateOrReservedHost } from './allowlist.ts';
import { formatUtcDay, incrementDailyMetrics } from './logger.ts';
import { incrementD1HourlyCounter, resetRateLimitBuckets } from './ratelimit.ts';
import { isBotUserAgent } from './visitAnalytics.ts';

export const MAX_EXTRACT_URL_LENGTH = 2048;
export const MAX_EXTRACT_TIMEOUT_MS = 25_000;
export const AUTO_BLOCK_VIOLATIONS_THRESHOLD = 3;
export const AUTO_BLOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 24 heures

const ALLOWED_EXTRACT_HOSTS = new Set([
  // TikTok
  'tiktok.com',
  'www.tiktok.com',
  'm.tiktok.com',
  'vm.tiktok.com',
  'vt.tiktok.com',
  // Instagram
  'instagram.com',
  'www.instagram.com',
  'm.instagram.com',
  'instagr.am',
  'www.instagr.am',
  // X / Twitter
  'x.com',
  'www.x.com',
  'mobile.x.com',
  'twitter.com',
  'www.twitter.com',
  'mobile.twitter.com',
  'm.twitter.com',
  't.co',
  // Facebook
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'web.facebook.com',
  'fb.watch',
  'www.fb.watch',
  'fb.com',
  'www.fb.com',
  'm.fb.com',
  // LinkedIn
  'linkedin.com',
  'www.linkedin.com',
  'm.linkedin.com',
  'mobile.linkedin.com',
]);

export function isSupportedExtractHostname(hostname: string): boolean {
  const lower = String(hostname || '').trim().toLowerCase();
  if (!lower || isPrivateOrReservedHost(lower)) return false;
  if (ALLOWED_EXTRACT_HOSTS.has(lower)) return true;
  if (/^[a-z]{2}\.linkedin\.com$/.test(lower)) return true;
  return false;
}

export type UrlWhitelistCheckResult =
  | { ok: true }
  | { ok: false; reason: 'MISSING' | 'TOO_LONG' | 'UNSUPPORTED_DOMAIN'; message: string };

/**
 * Valide la taille maximale (2048 car.), le schéma HTTP(S) et la liste blanche
 * des domaines supportés pour `/api/extract`.
 */
export function validateExtractUrlWhitelist(rawUrl: string): UrlWhitelistCheckResult {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) {
    return {
      ok: false,
      reason: 'MISSING',
      message:
        'Paramètre "url" manquant. Veuillez coller un lien TikTok, Instagram, X (Twitter), Facebook ou LinkedIn.',
    };
  }

  if (trimmed.length > MAX_EXTRACT_URL_LENGTH) {
    return {
      ok: false,
      reason: 'TOO_LONG',
      message: `URL trop longue (maximum ${MAX_EXTRACT_URL_LENGTH} caractères).`,
    };
  }

  // Rejeter tout protocole autre que http/https (ex: javascript:, data:, file:, ftp:)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return {
      ok: false,
      reason: 'UNSUPPORTED_DOMAIN',
      message: 'Seules les URLs HTTP(S) des plateformes supportées sont acceptées.',
    };
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return {
      ok: false,
      reason: 'UNSUPPORTED_DOMAIN',
      message: 'Format d’URL invalide.',
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      ok: false,
      reason: 'UNSUPPORTED_DOMAIN',
      message: 'Seules les URLs HTTP(S) des plateformes supportées sont acceptées.',
    };
  }

  if (!isSupportedExtractHostname(parsed.hostname)) {
    return {
      ok: false,
      reason: 'UNSUPPORTED_DOMAIN',
      message:
        'Domaine non autorisé. Seules les URLs TikTok, Instagram, X (Twitter), Facebook et LinkedIn sont acceptées.',
    };
  }

  return { ok: true };
}

/**
 * Retourne `true` si la requête n'a pas de User-Agent valide ou provient d'un bot connu.
 */
export function isBotOrMissingUserAgent(request: Request): boolean {
  const ua = request.headers.get('User-Agent');
  if (!ua || ua.trim().length < 8) {
    return true;
  }
  return isBotUserAgent(ua);
}

// =============================================================================
// Verrou de concurrence : 1 extraction active à la fois par IP hachée
// =============================================================================

const activeExtractions = new Map<string, number>();
const MAX_ACTIVE_LOCKS = 5000;

export function acquireExtractionLock(
  ipHash: string,
  nowMs: number = Date.now(),
  ttlMs: number = MAX_EXTRACT_TIMEOUT_MS + 2000
): boolean {
  if (activeExtractions.size > MAX_ACTIVE_LOCKS) {
    for (const [key, started] of activeExtractions.entries()) {
      if (nowMs - started > ttlMs) {
        activeExtractions.delete(key);
      }
    }
    if (activeExtractions.size > MAX_ACTIVE_LOCKS) {
      activeExtractions.clear();
    }
  }

  const existingStart = activeExtractions.get(ipHash);
  if (existingStart !== undefined && nowMs - existingStart < ttlMs) {
    return false;
  }

  activeExtractions.set(ipHash, nowMs);
  return true;
}

export function releaseExtractionLock(ipHash: string): void {
  activeExtractions.delete(ipHash);
}

export function resetExtractionLocks(): void {
  activeExtractions.clear();
}

// =============================================================================
// Auto-blocage 24h (`blocked_ips`) après 3 dépassements de limite en 1h
// =============================================================================

export interface BlockedIpRecord {
  ip_hash: string;
  reason: string;
  violations: number;
  blocked_at: number;
  expires_at: number;
}

const memoryBlockedIps = new Map<string, BlockedIpRecord>();

export function resetSecurityMemoryState(): void {
  activeExtractions.clear();
  memoryBlockedIps.clear();
  resetRateLimitBuckets();
}

export async function isIpBlockedInTable(
  env: AdminEnv | undefined,
  ipHash: string,
  nowMs: number = Date.now()
): Promise<{ blocked: boolean; expiresAt?: number; retryAfterSec?: number; reason?: string }> {
  const db = getDb(env);
  if (db) {
    try {
      const row = await db
        .prepare('SELECT ip_hash, reason, violations, blocked_at, expires_at FROM blocked_ips WHERE ip_hash = ?')
        .bind(ipHash)
        .first<BlockedIpRecord>();

      if (row && Number(row.expires_at) > nowMs) {
        const retryAfterSec = Math.max(1, Math.ceil((Number(row.expires_at) - nowMs) / 1000));
        return {
          blocked: true,
          expiresAt: Number(row.expires_at),
          retryAfterSec,
          reason: row.reason,
        };
      }
      return { blocked: false };
    } catch {
      // Fall back to memory map if D1 fails
    }
  }

  const mem = memoryBlockedIps.get(ipHash);
  if (mem) {
    if (mem.expires_at > nowMs) {
      return {
        blocked: true,
        expiresAt: mem.expires_at,
        retryAfterSec: Math.max(1, Math.ceil((mem.expires_at - nowMs) / 1000)),
        reason: mem.reason,
      };
    }
    memoryBlockedIps.delete(ipHash);
  }
  return { blocked: false };
}

export async function recordLimitExceedanceAndMaybeBlock(
  env: AdminEnv | undefined,
  ipHash: string,
  reason: string = 'rate_limit',
  nowMs: number = Date.now()
): Promise<{ blocked: boolean; violations: number; expiresAt?: number }> {
  const violations = await incrementD1HourlyCounter(env, `rl_violation:${ipHash}`, nowMs);
  if (violations < AUTO_BLOCK_VIOLATIONS_THRESHOLD) {
    return { blocked: false, violations };
  }

  const expiresAt = nowMs + AUTO_BLOCK_DURATION_MS;
  const db = getDb(env);
  if (db) {
    try {
      await db
        .prepare(
          `INSERT INTO blocked_ips (ip_hash, reason, violations, blocked_at, expires_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(ip_hash) DO UPDATE SET
             reason = excluded.reason,
             violations = excluded.violations,
             blocked_at = excluded.blocked_at,
             expires_at = excluded.expires_at`
        )
        .bind(ipHash, reason, violations, nowMs, expiresAt)
        .run();
      return { blocked: true, violations, expiresAt };
    } catch {
      // Fall back to memory
    }
  }

  memoryBlockedIps.set(ipHash, {
    ip_hash: ipHash,
    reason,
    violations,
    blocked_at: nowMs,
    expires_at: expiresAt,
  });
  return { blocked: true, violations, expiresAt };
}

export async function listActiveBlockedIps(
  env: AdminEnv | undefined,
  nowMs: number = Date.now()
): Promise<BlockedIpRecord[]> {
  const db = getDb(env);
  if (db) {
    try {
      // Purge opportuniste des IP expirées
      await db
        .prepare('DELETE FROM blocked_ips WHERE expires_at <= ?')
        .bind(nowMs)
        .run()
        .catch(() => {});

      const res = await db
        .prepare(
          'SELECT ip_hash, reason, violations, blocked_at, expires_at FROM blocked_ips WHERE expires_at > ? ORDER BY blocked_at DESC'
        )
        .bind(nowMs)
        .all<BlockedIpRecord>();
      return res.results || [];
    } catch {
      return [];
    }
  }

  const out: BlockedIpRecord[] = [];
  for (const [key, row] of memoryBlockedIps.entries()) {
    if (row.expires_at > nowMs) {
      out.push({ ...row });
    } else {
      memoryBlockedIps.delete(key);
    }
  }
  return out.sort((a, b) => b.blocked_at - a.blocked_at);
}

export async function unblockIpAddress(
  env: AdminEnv | undefined,
  ipHash: string
): Promise<void> {
  const normalized = String(ipHash || '').trim();
  if (!normalized) return;
  memoryBlockedIps.delete(normalized);

  const db = getDb(env);
  if (db) {
    try {
      await db
        .prepare('DELETE FROM blocked_ips WHERE ip_hash = ?')
        .bind(normalized)
        .run();
      await db
        .prepare('DELETE FROM rate_limits WHERE ip_hash = ?')
        .bind(`rl_violation:${normalized}`)
        .run()
        .catch(() => {});
    } catch {
      // Ignore
    }
  }
}

// =============================================================================
// Compteur journalier léger des requêtes refusées (`daily_metrics`)
// =============================================================================

export async function recordRejectedRequest(
  env: AdminEnv | undefined,
  ctx?: ExecutionContextLike,
  nowMs: number = Date.now()
): Promise<void> {
  const promise = incrementDailyMetrics(env, 'security', ['rejected_request'], nowMs);
  if (ctx && typeof ctx.waitUntil === 'function') {
    try {
      ctx.waitUntil(promise.catch(() => {}));
      return;
    } catch {
      // Fallback to direct await
    }
  }
  await promise.catch(() => {});
}

export async function getRejectedRequestsToday(
  env: AdminEnv | undefined,
  nowMs: number = Date.now()
): Promise<number> {
  const db = getDb(env);
  if (!db) return 0;

  const today = formatUtcDay(nowMs);
  try {
    const row = await db
      .prepare(
        `SELECT count FROM daily_metrics WHERE day = ? AND platform = 'security' AND event = 'rejected_request'`
      )
      .bind(today)
      .first<{ count: number }>();
    return Number(row?.count ?? 0);
  } catch {
    return 0;
  }
}
