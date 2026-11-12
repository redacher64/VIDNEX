/**
 * Limitation de débit par IP hachée stockée dans Cloudflare D1 (`rate_limits`),
 * avec repli transparent vers le limiteur mémoire Token Bucket si D1 est indisponible.
 */

import { type AdminEnv, getDb } from './db.ts';

interface BucketEntry {
  tokens: number;
  lastRefillMs: number;
}

const buckets = new Map<string, BucketEntry>();
const MAX_BUCKETS = 5000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function extractClientIp(request: Request): string {
  const cfIp = request.headers.get('CF-Connecting-IP');
  if (cfIp) return cfIp.trim();
  const xff = request.headers.get('X-Forwarded-For');
  if (xff) return xff.split(',')[0].trim();
  return 'anonymous';
}

export function checkRateLimit(
  key: string,
  capacity = 30,
  windowMs = 60_000,
  nowMs = Date.now()
): RateLimitResult {
  if (buckets.size > MAX_BUCKETS) {
    const cutoff = nowMs - windowMs * 2;
    for (const [k, v] of buckets.entries()) {
      if (v.lastRefillMs < cutoff) {
        buckets.delete(k);
      }
    }
    if (buckets.size > MAX_BUCKETS) {
      buckets.clear();
    }
  }

  const refillRatePerMs = capacity / windowMs;
  const existing = buckets.get(key);

  if (!existing) {
    buckets.set(key, {
      tokens: capacity - 1,
      lastRefillMs: nowMs,
    });
    return {
      allowed: true,
      remaining: capacity - 1,
      retryAfterSec: 0,
    };
  }

  const elapsed = Math.max(0, nowMs - existing.lastRefillMs);
  const replenished = Math.min(
    capacity,
    existing.tokens + elapsed * refillRatePerMs
  );

  if (replenished < 1) {
    const missing = 1 - replenished;
    const retryAfterSec = Math.max(
      1,
      Math.ceil(missing / refillRatePerMs / 1000)
    );
    existing.tokens = replenished;
    existing.lastRefillMs = nowMs;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec,
    };
  }

  existing.tokens = replenished - 1;
  existing.lastRefillMs = nowMs;

  return {
    allowed: true,
    remaining: Math.floor(existing.tokens),
    retryAfterSec: 0,
  };
}

const downloadFileWindowSeen = new Map<string, { window: number; result: D1RateLimitResult }>();
const MAX_DOWNLOAD_FILE_SEEN = 10_000;

export function resetRateLimitBuckets(): void {
  buckets.clear();
  downloadFileWindowSeen.clear();
}

export function resetD1RateLimitFallback(): void {
  buckets.clear();
  downloadFileWindowSeen.clear();
}

export interface D1RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfterSec: number;
  firstRequestForFile?: boolean;
}

/**
 * Incrémente le compteur de requêtes de `ipHash` pour la fenêtre minute courante dans `rate_limits`
 * et vérifie s'il dépasse `limitPerMin`.
 * Si D1 est coupé, utilise le limiteur en mémoire pour ne jamais casser l'extraction publique.
 */
export async function checkD1RateLimit(
  env: AdminEnv | undefined,
  ipHash: string,
  limitPerMin: number,
  nowMs = Date.now()
): Promise<D1RateLimitResult> {
  const safeLimit = Math.max(1, Math.floor(limitPerMin || 30));
  const currentWindow = Math.floor(nowMs / 60_000);
  const retryAfterSec = Math.max(
    1,
    Math.ceil(((currentWindow + 1) * 60_000 - nowMs) / 1000)
  );

  const db = getDb(env);
  if (!db) {
    const mem = checkRateLimit(
      `extract:${ipHash}`,
      safeLimit,
      60_000,
      nowMs
    );
    return {
      allowed: mem.allowed,
      count: safeLimit - mem.remaining,
      limit: safeLimit,
      retryAfterSec: mem.retryAfterSec,
    };
  }

  try {
    await db
      .prepare(
        `INSERT INTO rate_limits (ip_hash, window, count)
         VALUES (?, ?, 1)
         ON CONFLICT(ip_hash, window) DO UPDATE SET count = rate_limits.count + 1`
      )
      .bind(ipHash, currentWindow)
      .run();

    const row = await db
      .prepare('SELECT count FROM rate_limits WHERE ip_hash = ? AND window = ?')
      .bind(ipHash, currentWindow)
      .first<{ count: number }>();

    const count = Number(row?.count ?? 1);
    return {
      allowed: count <= safeLimit,
      count,
      limit: safeLimit,
      retryAfterSec: count <= safeLimit ? 0 : retryAfterSec,
    };
  } catch {
    const mem = checkRateLimit(
      `extract:${ipHash}`,
      safeLimit,
      60_000,
      nowMs
    );
    return {
      allowed: mem.allowed,
      count: safeLimit - mem.remaining,
      limit: safeLimit,
      retryAfterSec: mem.retryAfterSec,
    };
  }
}

/**
 * Limite le débit de `/api/download` par IP hachée via `checkD1RateLimit` (D1 `rate_limits` avec repli mémoire).
 * Compte UNE SEULE FOIS par fichier et par minute (requêtes HTTP `Range` comprises).
 */
export async function checkD1DownloadRateLimit(
  env: AdminEnv | undefined,
  ipHash: string,
  fileKey: string,
  limitPerMin = 60,
  nowMs = Date.now()
): Promise<D1RateLimitResult> {
  const safeLimit = Math.max(1, Math.floor(limitPerMin || 60));
  const currentWindow = Math.floor(nowMs / 60_000);
  const retryAfterSec = Math.max(
    1,
    Math.ceil(((currentWindow + 1) * 60_000 - nowMs) / 1000)
  );

  if (downloadFileWindowSeen.size > MAX_DOWNLOAD_FILE_SEEN) {
    for (const [k, v] of downloadFileWindowSeen.entries()) {
      if (v.window < currentWindow) {
        downloadFileWindowSeen.delete(k);
      }
    }
    if (downloadFileWindowSeen.size > MAX_DOWNLOAD_FILE_SEEN) {
      downloadFileWindowSeen.clear();
    }
  }

  const normalizedFileKey = (fileKey || 'default').trim();
  const dedupeKey = `${ipHash}:${currentWindow}:${normalizedFileKey}`;
  const seen = downloadFileWindowSeen.get(dedupeKey);
  if (seen && seen.window === currentWindow) {
    return {
      ...seen.result,
      retryAfterSec: seen.result.allowed ? 0 : retryAfterSec,
      firstRequestForFile: false,
    };
  }

  const res = await checkD1RateLimit(
    env,
    `dl:${ipHash}`,
    safeLimit,
    nowMs
  );

  const finalResult: D1RateLimitResult = {
    ...res,
    firstRequestForFile: true,
  };
  downloadFileWindowSeen.set(dedupeKey, {
    window: currentWindow,
    result: finalResult,
  });

  return finalResult;
}
