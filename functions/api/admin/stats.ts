import { type AdminEnv, getDb } from '../../_lib/db.ts';
import { purgeOldLogs } from '../../_lib/logger.ts';

export interface PagesContext {
  request: Request;
  env?: AdminEnv;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const env = context.env || {};
  const db = getDb(env);

  const nowMs = Date.now();
  const startOfTodayMs = new Date(new Date(nowMs).setUTCHours(0, 0, 0, 0)).getTime();
  const cutoff7dMs = nowMs - 7 * 86_400_000;
  const cutoff30dMs = nowMs - 30 * 86_400_000;

  // Build 30-day calendar buckets (YYYY-MM-DD in UTC)
  const dailyMap = new Map<string, { day: string; total: number; success: number; error: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(nowMs - i * 86_400_000).toISOString().slice(0, 10);
    dailyMap.set(d, { day: d, total: 0, success: 0, error: 0 });
  }

  if (!db) {
    return new Response(
      JSON.stringify({
        ok: true,
        dbConnected: false,
        counts: { today: 0, last7d: 0, last30d: 0 },
        platforms: {
          tiktok: { total: 0, success: 0, error: 0, successRate: 0 },
          instagram: { total: 0, success: 0, error: 0, successRate: 0 },
          x: { total: 0, success: 0, error: 0, successRate: 0 },
        },
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
    const rowsRes = await db
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
      }>();

    const rows = rowsRes.results || [];
    let todayCount = 0;
    let last7dCount = 0;
    const last30dCount = rows.length;

    const platforms = {
      tiktok: { total: 0, success: 0, error: 0, successRate: 0 },
      instagram: { total: 0, success: 0, error: 0, successRate: 0 },
      x: { total: 0, success: 0, error: 0, successRate: 0 },
    };

    const errorCounts = new Map<string, number>();

    for (const row of rows) {
      const tsNum = Number(row.ts) || 0;
      const normalizedMs = tsNum < 10_000_000_000 ? tsNum * 1000 : tsNum;

      if (normalizedMs >= startOfTodayMs) todayCount++;
      if (normalizedMs >= cutoff7dMs) last7dCount++;

      const p =
        row.platform === 'tiktok'
          ? 'tiktok'
          : row.platform === 'instagram'
          ? 'instagram'
          : row.platform === 'x' || row.platform === 'twitter'
          ? 'x'
          : null;
      if (p) {
        platforms[p].total++;
        if (row.status === 'success') {
          platforms[p].success++;
        } else {
          platforms[p].error++;
        }
      }

      if (row.status !== 'success') {
        const code = row.error_code || 'UNKNOWN';
        errorCounts.set(code, (errorCounts.get(code) || 0) + 1);
      }

      const dayKey = new Date(normalizedMs).toISOString().slice(0, 10);
      const bucket = dailyMap.get(dayKey);
      if (bucket) {
        bucket.total++;
        if (row.status === 'success') bucket.success++;
        else bucket.error++;
      }
    }

    for (const key of ['tiktok', 'instagram', 'x'] as const) {
      const p = platforms[key];
      p.successRate = p.total > 0 ? Math.round((p.success / p.total) * 1000) / 10 : 0;
    }

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
