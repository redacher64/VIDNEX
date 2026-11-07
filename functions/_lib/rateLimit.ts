/**
 * Rate Limiter léger en mémoire (Token Bucket / Fenêtre glissante par IP)
 * pour protéger le quota gratuit Cloudflare Workers (100k req/jour) et éviter
 * le bannissement IP par Instagram / TikTok en cas de rafale automatisée.
 */

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
    // Purge les entrées les plus anciennes pour borner la mémoire de l'isolat
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

export function resetRateLimitBuckets(): void {
  buckets.clear();
}
