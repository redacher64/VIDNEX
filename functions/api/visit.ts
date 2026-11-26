/**
 * Lightweight, cookie-free visit beacon endpoint (`POST /api/visit`).
 * Records real page visits directly in Cloudflare D1 (`page_visits`):
 * - date / timestamp (UTC)
 * - country from `request.cf.country` (never trusted from client)
 * - referrer_host & referrer_category (`search` | `direct` | `social` | `other`)
 * - entry_page (normalized path, rejecting /admin and /api)
 * - is_bot (derived server-side from User-Agent)
 * Zero cookies set or read. Zero IP stored.
 */

import {
  type AdminEnv,
  type ExecutionContextLike,
  getDb,
} from '../_lib/db.ts';
import { formatUtcDay } from '../_lib/logger.ts';
import {
  categorizeReferrerHost,
  extractReferrerHost,
  extractRequestCountry,
  isBotUserAgent,
  normalizeEntryPage,
} from '../_lib/visitAnalytics.ts';

export interface PagesContext {
  request: Request;
  env?: AdminEnv;
  ctx?: ExecutionContextLike;
  waitUntil?: (promise: Promise<unknown>) => void;
}

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'X-Robots-Tag': 'noindex, nofollow',
};

export const onRequestOptions = async (): Promise<Response> => {
  return new Response(null, {
    status: 204,
    headers: {
      ...NO_STORE_HEADERS,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};

export const onRequestPost = async (context: PagesContext): Promise<Response> => {
  const { request, env = {} } = context;
  const ctx: ExecutionContextLike | undefined =
    context.ctx || (context.waitUntil ? { waitUntil: context.waitUntil } : undefined);

  let rawPath = '/';
  let rawReferrer = '';

  try {
    const contentType = (request.headers.get('content-type') || '').toLowerCase();
    const rawText = await request.text();
    if (rawText && rawText.length <= 4096) {
      if (contentType.includes('application/json') || rawText.trim().startsWith('{')) {
        const parsed = JSON.parse(rawText) as { path?: unknown; referrer?: unknown };
        if (typeof parsed?.path === 'string') rawPath = parsed.path;
        if (typeof parsed?.referrer === 'string') rawReferrer = parsed.referrer;
      }
    }
  } catch {
    // Ignore malformed beacon body; fall back to defaults
  }

  const entryPage = normalizeEntryPage(rawPath);
  if (!entryPage) {
    // Explicitly ignore /admin, /api, and static assets
    return new Response(null, { status: 204, headers: NO_STORE_HEADERS });
  }

  const db = getDb(env);
  if (!db) {
    return new Response(null, { status: 204, headers: NO_STORE_HEADERS });
  }

  const nowMs = Date.now();
  const day = formatUtcDay(nowMs);
  const country = extractRequestCountry(request);
  const userAgent = request.headers.get('user-agent') || '';
  const isBot = isBotUserAgent(userAgent) ? 1 : 0;

  let reqHost = '';
  try {
    reqHost = new URL(request.url).hostname;
  } catch {
    reqHost = '';
  }

  const referrerHost = extractReferrerHost(
    rawReferrer || request.headers.get('referer'),
    reqHost ? [reqHost] : []
  );
  const referrerCategory = categorizeReferrerHost(referrerHost);

  const insertPromise = db
    .prepare(
      `INSERT INTO page_visits (ts, day, country, referrer_host, referrer_category, entry_page, is_bot)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(nowMs, day, country, referrerHost, referrerCategory, entryPage, isBot)
    .run()
    .catch(() => {
      // Never block or fail client beacon
    });

  if (ctx && typeof ctx.waitUntil === 'function') {
    try {
      ctx.waitUntil(insertPromise);
    } catch {
      await insertPromise;
    }
  } else {
    await insertPromise;
  }

  return new Response(null, { status: 204, headers: NO_STORE_HEADERS });
};
