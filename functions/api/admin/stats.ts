import { type AdminEnv, getDb } from '../../_lib/db.ts';
import { formatUtcDay, purgeOldLogs } from '../../_lib/logger.ts';

export interface PagesContext {
  request: Request;
  env?: AdminEnv;
}

const TRACKED_PLATFORMS = [
  'tiktok',
  'instagram',
  'instagram_profile',
  'x',
  'facebook',
  'linkedin',
] as const;

type TrackedPlatform = (typeof TRACKED_PLATFORMS)[number];

function normalizePlatformKey(raw: string): TrackedPlatform | null {
  if (raw === 'tiktok') return 'tiktok';
  if (raw === 'instagram') return 'instagram';
  if (raw === 'instagram_profile') return 'instagram_profile';
  if (raw === 'x' || raw === 'twitter') return 'x';
  if (raw === 'facebook' || raw === 'fb') return 'facebook';
  if (raw === 'linkedin') return 'linkedin';
  return null;
}

function createEmptyPlatformStats() {
  return {
    total: 0,
    success: 0,
    error: 0,
    successRate: 0,
    extract_started: 0,
    extract_success: 0,
    extract_error: 0,
    download_started: 0,
    download_success: 0,
    downloadRate: 0,
    downloadCompletionRate: 0,
  };
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const env = context.env || {};
  const db = getDb(env);

  const nowMs = Date.now();
  const todayDay = formatUtcDay(nowMs);
  const cutoff7dDay = formatUtcDay(nowMs - 6 * 86_400_000);
  const cutoff30dDay = formatUtcDay(nowMs - 29 * 86_400_000);
  const cutoff30dMs = nowMs - 30 * 86_400_000;

  // Build 30-day calendar buckets (YYYY-MM-DD in UTC)
  const dailyMap = new Map<
    string,
    {
      day: string;
      total: number;
      success: number;
      error: number;
      download_started: number;
      download_success: number;
    }
  >();
  for (let i = 29; i >= 0; i--) {
    const d = formatUtcDay(nowMs - i * 86_400_000);
    dailyMap.set(d, {
      day: d,
      total: 0,
      success: 0,
      error: 0,
      download_started: 0,
      download_success: 0,
    });
  }

  const platforms: Record<TrackedPlatform, ReturnType<typeof createEmptyPlatformStats>> = {
    tiktok: createEmptyPlatformStats(),
    instagram: createEmptyPlatformStats(),
    instagram_profile: createEmptyPlatformStats(),
    x: createEmptyPlatformStats(),
    facebook: createEmptyPlatformStats(),
    linkedin: createEmptyPlatformStats(),
  };

  const emptyFunnel = {
    extract_started: 0,
    extract_success: 0,
    extract_error: 0,
    download_started: 0,
    download_success: 0,
    extractSuccessRate: 0,
    downloadConversionRate: 0,
    downloadCompletionRate: 0,
  };

  if (!db) {
    return new Response(
      JSON.stringify({
        ok: true,
        dbConnected: false,
        counts: { today: 0, last7d: 0, last30d: 0 },
        funnel: emptyFunnel,
        platforms,
        errors: [],
        daily: Array.from(dailyMap.values()),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      }
    );
  }

  // Opportunistic purge of logs > 30 days on dashboard load
  await purgeOldLogs(env, nowMs);

  try {
    const [metricsRes, logRowsRes] = await Promise.all([
      db
        .prepare(
          'SELECT day, platform, event, count FROM daily_metrics WHERE day >= ?'
        )
        .bind(cutoff30dDay)
        .all<{
          day: string;
          platform: string;
          event: string;
          count: number;
        }>()
        .catch(() => ({ results: [] })),
      db
        .prepare(
          'SELECT ts, platform, status, error_code, duration_ms FROM request_log WHERE ts >= ?'
        )
        .bind(cutoff30dMs)
        .all<{
          ts: number;
          platform: string;
          status: string;
          error_code: string | null;
          duration_ms: number;
        }>()
        .catch(() => ({ results: [] })),
    ]);

    const metricRows = metricsRes.results || [];
    const logRows = logRowsRes.results || [];

    let todayCount = 0;
    let last7dCount = 0;
    let last30dCount = 0;

    const funnel = { ...emptyFunnel };

    for (const row of metricRows) {
      const count = Math.max(0, Number(row.count) || 0);
      if (count === 0) continue;

      const dayKey = String(row.day || '').slice(0, 10);
      const p = normalizePlatformKey(String(row.platform || ''));
      const ev = String(row.event || '');

      if (ev === 'extract_started') {
        funnel.extract_started += count;
        last30dCount += count;
        if (dayKey >= cutoff7dDay) last7dCount += count;
        if (dayKey === todayDay) todayCount += count;
        if (p) platforms[p].extract_started += count;
      } else if (ev === 'extract_success') {
        funnel.extract_success += count;
        if (p) {
          platforms[p].extract_success += count;
          platforms[p].success += count;
        }
        const bucket = dailyMap.get(dayKey);
        if (bucket) {
          bucket.success += count;
          bucket.total += count;
        }
      } else if (ev === 'extract_error') {
        funnel.extract_error += count;
        if (p) {
          platforms[p].extract_error += count;
          platforms[p].error += count;
        }
        const bucket = dailyMap.get(dayKey);
        if (bucket) {
          bucket.error += count;
          bucket.total += count;
        }
      } else if (ev === 'download_started') {
        funnel.download_started += count;
        if (p) platforms[p].download_started += count;
        const bucket = dailyMap.get(dayKey);
        if (bucket) bucket.download_started += count;
      } else if (ev === 'download_success') {
        funnel.download_success += count;
        if (p) platforms[p].download_success += count;
        const bucket = dailyMap.get(dayKey);
        if (bucket) bucket.download_success += count;
      }
    }

    const errorCounts = new Map<string, number>();

    for (const row of logRows) {
      if (row.status !== 'success') {
        const code = row.error_code || 'UNKNOWN';
        errorCounts.set(code, (errorCounts.get(code) || 0) + 1);
      }
    }

    for (const key of TRACKED_PLATFORMS) {
      const p = platforms[key];
      p.total = Math.max(p.extract_started, p.success + p.error);
      p.successRate =
        p.total > 0 ? Math.round((p.success / p.total) * 1000) / 10 : 0;
      p.downloadRate =
        p.success > 0
          ? Math.min(100, Math.round((p.download_success / p.success) * 1000) / 10)
          : 0;
      p.downloadCompletionRate =
        p.download_started > 0
          ? Math.min(
              100,
              Math.round((p.download_success / p.download_started) * 1000) / 10
            )
          : 0;
    }

    const totalExtractions = Math.max(
      funnel.extract_started,
      funnel.extract_success + funnel.extract_error
    );
    funnel.extract_started = totalExtractions;
    funnel.extractSuccessRate =
      totalExtractions > 0
        ? Math.round((funnel.extract_success / totalExtractions) * 1000) / 10
        : 0;
    funnel.downloadConversionRate =
      funnel.extract_success > 0
        ? Math.min(
            100,
            Math.round((funnel.download_success / funnel.extract_success) * 1000) / 10
          )
        : 0;
    funnel.downloadCompletionRate =
      funnel.download_started > 0
        ? Math.min(
            100,
            Math.round((funnel.download_success / funnel.download_started) * 1000) / 10
          )
        : 0;

    const errors = Array.from(errorCounts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);

    return new Response(
      JSON.stringify({
        ok: true,
        dbConnected: true,
        counts: {
          today: todayCount,
          last7d: last7dCount,
          last30d: last30dCount,
        },
        funnel,
        platforms,
        errors,
        daily: Array.from(dailyMap.values()),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        message: err instanceof Error ? err.message : 'Erreur lors de la lecture des statistiques D1.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      }
    );
  }
}
