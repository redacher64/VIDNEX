import { type AdminEnv, getDb } from '../../_lib/db.ts';
import { requirePermission } from '../../_lib/auth.ts';
import { formatUtcDay, purgeOldLogs } from '../../_lib/logger.ts';
import type { ReferrerCategory } from '../../_lib/visitAnalytics.ts';

export interface PagesContext {
  request: Request;
  env?: AdminEnv;
}

export type StatsPeriodKey = 'today' | '7d' | '30d';

const TRACKED_PLATFORMS = [
  'tiktok',
  'instagram',
  'instagram_profile',
  'x',
  'facebook',
  'linkedin',
] as const;

type TrackedPlatform = (typeof TRACKED_PLATFORMS)[number];

const REFERRER_CATEGORY_ORDER: Array<{ key: ReferrerCategory; label: string }> = [
  { key: 'search', label: 'Recherche' },
  { key: 'direct', label: 'Direct' },
  { key: 'social', label: 'Réseaux sociaux' },
  { key: 'other', label: 'Autres sites' },
];

export const ERRORS_BY_PLATFORM_SQL = `SELECT COALESCE(error_code, 'UNKNOWN_ERROR') AS error_code,
       platform,
       COUNT(*) AS count
FROM request_log
WHERE status = 'error' AND ts >= ?
GROUP BY error_code, platform
ORDER BY count DESC, error_code ASC`;

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizePlatformKey(raw: string): TrackedPlatform | null {
  if (raw === 'tiktok') return 'tiktok';
  if (raw === 'instagram') return 'instagram';
  if (raw === 'instagram_profile') return 'instagram_profile';
  if (raw === 'x' || raw === 'twitter') return 'x';
  if (raw === 'facebook' || raw === 'fb') return 'facebook';
  if (raw === 'linkedin') return 'linkedin';
  return null;
}

function normalizeReferrerCategory(raw: string | null | undefined): ReferrerCategory {
  if (raw === 'search' || raw === 'direct' || raw === 'social' || raw === 'other') {
    return raw;
  }
  return 'direct';
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
    selection_started: 0,
    selection_download: 0,
    downloadRate: 0,
    downloadCompletionRate: 0,
    direct: 0,
    tiers: 0,
    direct7d: 0,
    tiers7d: 0,
    thirdPartyRate7d: 0,
    stage: {
      direct: 0,
      tiers: 0,
      direct7d: 0,
      tiers7d: 0,
      thirdPartyRate7d: 0,
    },
  };
}

export interface ErrorByPlatformRow {
  error_code: string;
  platform: string;
  count: number;
}

export interface RecentFailureRow {
  id: number;
  ts: number;
  platform: string;
  error_code: string;
  http_status: number | null;
  error_message: string | null;
  source_domain: string | null;
  country: string | null;
}

export interface HourlyBucket {
  day: string;
  hour: number;
  total: number;
  success: number;
  error: number;
}

export interface GeoCountryPeriodRow {
  countryCode: string;
  humanVisits: number;
  botVisits: number;
  extractions: number;
  extractSuccess: number;
  extractError: number;
  successRate: number | null;
  sharePct: number;
}

export interface VisitorSourceCategoryRow {
  category: ReferrerCategory;
  label: string;
  visits: number;
  sharePct: number;
}

export interface EntryPageRow {
  page: string;
  visits: number;
  sharePct: number;
}

export interface ReferrerHostRow {
  host: string;
  category: ReferrerCategory;
  visits: number;
}

export interface GeoPeriodAnalytics {
  period: StatsPeriodKey;
  humanVisits: number;
  botVisits: number;
  totalVisits: number;
  totalExtractions: number;
  totalExtractSuccess: number;
  totalExtractError: number;
  globalSuccessRate: number;
  countries: GeoCountryPeriodRow[];
  sources: {
    categories: VisitorSourceCategoryRow[];
    topReferrerHosts: ReferrerHostRow[];
    topEntryPages: EntryPageRow[];
  };
}

function createEmptyGeoPeriod(period: StatsPeriodKey): GeoPeriodAnalytics {
  return {
    period,
    humanVisits: 0,
    botVisits: 0,
    totalVisits: 0,
    totalExtractions: 0,
    totalExtractSuccess: 0,
    totalExtractError: 0,
    globalSuccessRate: 0,
    countries: [],
    sources: {
      categories: REFERRER_CATEGORY_ORDER.map((c) => ({
        category: c.key,
        label: c.label,
        visits: 0,
        sharePct: 0,
      })),
      topReferrerHosts: [],
      topEntryPages: [],
    },
  };
}

interface CountryMetricDbRow {
  day: string;
  country: string;
  extract_started: number;
  extract_success: number;
  extract_error: number;
}

interface PageVisitDbRow {
  id: number;
  ts: number;
  day: string;
  country: string;
  referrer_host: string | null;
  referrer_category: string;
  entry_page: string;
  is_bot: number;
}

function buildGeoPeriod(
  period: StatsPeriodKey,
  minDay: string,
  countryMetricRows: CountryMetricDbRow[],
  visitRows: PageVisitDbRow[],
  periodTotals: { started: number; success: number; error: number }
): GeoPeriodAnalytics {
  const countryMap = new Map<
    string,
    {
      humanVisits: number;
      botVisits: number;
      extractions: number;
      extractSuccess: number;
      extractError: number;
    }
  >();

  const ensureCountry = (rawCode: string) => {
    const code = (rawCode || 'XX').trim().toUpperCase();
    const key = /^[A-Z]{2}$/.test(code) ? code : 'XX';
    let entry = countryMap.get(key);
    if (!entry) {
      entry = {
        humanVisits: 0,
        botVisits: 0,
        extractions: 0,
        extractSuccess: 0,
        extractError: 0,
      };
      countryMap.set(key, entry);
    }
    return entry;
  };

  for (const row of countryMetricRows) {
    const dayKey = String(row.day || '').slice(0, 10);
    if (dayKey < minDay) continue;
    const started = Math.max(0, Number(row.extract_started) || 0);
    const success = Math.max(0, Number(row.extract_success) || 0);
    const err = Math.max(0, Number(row.extract_error) || 0);
    const total = Math.max(started, success + err);
    if (total === 0) continue;
    const entry = ensureCountry(row.country);
    entry.extractions += total;
    entry.extractSuccess += success;
    entry.extractError += err;
  }

  let humanVisits = 0;
  let botVisits = 0;

  const categoryCounts: Record<ReferrerCategory, number> = {
    search: 0,
    direct: 0,
    social: 0,
    other: 0,
  };
  const hostCounts = new Map<string, { category: ReferrerCategory; visits: number }>();
  const entryPageCounts = new Map<string, number>();

  for (const row of visitRows) {
    const dayKey = String(row.day || '').slice(0, 10);
    if (dayKey < minDay) continue;
    const isBot = Number(row.is_bot) ? 1 : 0;
    const countryEntry = ensureCountry(row.country);

    if (isBot) {
      botVisits += 1;
      countryEntry.botVisits += 1;
    } else {
      humanVisits += 1;
      countryEntry.humanVisits += 1;

      const cat = normalizeReferrerCategory(row.referrer_category);
      categoryCounts[cat] += 1;

      const host = row.referrer_host ? String(row.referrer_host).trim().toLowerCase() : '';
      if (host) {
        const prevHost = hostCounts.get(host);
        if (prevHost) {
          prevHost.visits += 1;
        } else {
          hostCounts.set(host, { category: cat, visits: 1 });
        }
      }

      const page = row.entry_page ? String(row.entry_page).trim() : '/';
      entryPageCounts.set(page || '/', (entryPageCounts.get(page || '/') || 0) + 1);
    }
  }

  const totalVisits = humanVisits + botVisits;

  // Canonical D1 extraction totals for this period (same source of truth as Synthèse API)
  const totalExtractions = Math.max(
    periodTotals.started,
    periodTotals.success + periodTotals.error
  );
  const totalExtractSuccess = periodTotals.success;
  const totalExtractError = periodTotals.error;
  const globalSuccessRate =
    totalExtractions > 0
      ? roundOneDecimal((totalExtractSuccess / totalExtractions) * 100)
      : 0;

  // Build sorted country list (strictly from D1, zero fake/scaled data)
  const countries: GeoCountryPeriodRow[] = Array.from(countryMap.entries())
    .filter(([, data]) => data.humanVisits > 0 || data.extractions > 0)
    .map(([countryCode, data]) => {
      const shareDenominator = humanVisits > 0 ? humanVisits : totalExtractions;
      const shareNumerator = humanVisits > 0 ? data.humanVisits : data.extractions;
      const sharePct =
        shareDenominator > 0
          ? roundOneDecimal((shareNumerator / shareDenominator) * 100)
          : 0;
      const successRate =
        data.extractions > 0
          ? roundOneDecimal((data.extractSuccess / data.extractions) * 100)
          : null;
      return {
        countryCode,
        humanVisits: data.humanVisits,
        botVisits: data.botVisits,
        extractions: data.extractions,
        extractSuccess: data.extractSuccess,
        extractError: data.extractError,
        successRate,
        sharePct,
      };
    })
    .sort(
      (a, b) =>
        b.humanVisits - a.humanVisits ||
        b.extractions - a.extractions ||
        a.countryCode.localeCompare(b.countryCode)
    );

  const categories: VisitorSourceCategoryRow[] = REFERRER_CATEGORY_ORDER.map(
    ({ key, label }) => {
      const visits = categoryCounts[key];
      return {
        category: key,
        label,
        visits,
        sharePct:
          humanVisits > 0 ? roundOneDecimal((visits / humanVisits) * 100) : 0,
      };
    }
  );

  const topReferrerHosts: ReferrerHostRow[] = Array.from(hostCounts.entries())
    .map(([host, info]) => ({
      host,
      category: info.category,
      visits: info.visits,
    }))
    .sort((a, b) => b.visits - a.visits || a.host.localeCompare(b.host))
    .slice(0, 8);

  const topEntryPages: EntryPageRow[] = Array.from(entryPageCounts.entries())
    .map(([page, visits]) => ({
      page,
      visits,
      sharePct:
        humanVisits > 0 ? roundOneDecimal((visits / humanVisits) * 100) : 0,
    }))
    .sort((a, b) => b.visits - a.visits || a.page.localeCompare(b.page))
    .slice(0, 10);

  return {
    period,
    humanVisits,
    botVisits,
    totalVisits,
    totalExtractions,
    totalExtractSuccess,
    totalExtractError,
    globalSuccessRate,
    countries,
    sources: {
      categories,
      topReferrerHosts,
      topEntryPages,
    },
  };
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const env = context.env || {};
  const auth = await requirePermission(context.request, env, 'dashboard.view');
  if (!auth.ok) return auth.response;

  const db = getDb(env);

  const nowMs = Date.now();
  const todayDay = formatUtcDay(nowMs);
  const cutoff7dDay = formatUtcDay(nowMs - 6 * 86_400_000);
  const cutoff30dDay = formatUtcDay(nowMs - 29 * 86_400_000);
  const todayStartMs = Date.parse(`${todayDay}T00:00:00.000Z`);
  const cutoff7dMs = Date.parse(`${cutoff7dDay}T00:00:00.000Z`);
  const cutoff30dMs = Date.parse(`${cutoff30dDay}T00:00:00.000Z`);

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
      selection_started: number;
      selection_download: number;
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
      selection_started: 0,
      selection_download: 0,
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
    selection_started: 0,
    selection_download: 0,
    extractSuccessRate: 0,
    globalConversionRate: 0,
    downloadConversionRate: 0,
    downloadCompletionRate: 0,
  };

  const emptyStories = {
    story_opened: 0,
    story_list_opened: 0,
    story_download: 0,
  };

  const emptyGeoPeriods: Record<StatsPeriodKey, GeoPeriodAnalytics> = {
    today: createEmptyGeoPeriod('today'),
    '7d': createEmptyGeoPeriod('7d'),
    '30d': createEmptyGeoPeriod('30d'),
  };

  if (!db) {
    return new Response(
      JSON.stringify({
        ok: true,
        dbConnected: false,
        counts: { today: 0, last7d: 0, last30d: 0 },
        funnel: emptyFunnel,
        stories: emptyStories,
        platforms,
        errors: [],
        errorsByPlatform: { today: [], '7d': [], '30d': [] },
        recentFailures: [],
        daily: Array.from(dailyMap.values()),
        hourly: [],
        geo: { periods: emptyGeoPeriods },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  // Opportunistic purge of logs > 30 days on dashboard load
  await purgeOldLogs(env, nowMs);

  try {
    const [
      metricsRes,
      logRowsRes,
      errPlatTodayRes,
      errPlat7dRes,
      errPlat30dRes,
      recentFailuresRes,
      countryMetricsRes,
      visitsRes,
    ] = await Promise.all([
      db
        .prepare('SELECT day, platform, event, count FROM daily_metrics WHERE day >= ?')
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
      db
        .prepare(ERRORS_BY_PLATFORM_SQL)
        .bind(todayStartMs)
        .all<ErrorByPlatformRow>()
        .catch(() => ({ results: [] })),
      db
        .prepare(ERRORS_BY_PLATFORM_SQL)
        .bind(cutoff7dMs)
        .all<ErrorByPlatformRow>()
        .catch(() => ({ results: [] })),
      db
        .prepare(ERRORS_BY_PLATFORM_SQL)
        .bind(cutoff30dMs)
        .all<ErrorByPlatformRow>()
        .catch(() => ({ results: [] })),
      db
        .prepare(
          `SELECT id, ts, platform, error_code, http_status, error_message, source_domain, country
           FROM request_log
           WHERE status = 'error'
           ORDER BY ts DESC, id DESC
           LIMIT 20`
        )
        .all<RecentFailureRow>()
        .catch(async () => {
          return db
            .prepare(
              `SELECT id, ts, platform, error_code, http_status
               FROM request_log
               WHERE status = 'error'
               ORDER BY ts DESC, id DESC
               LIMIT 20`
            )
            .all<RecentFailureRow>()
            .catch(() => ({ results: [] }));
        }),
      db
        .prepare(
          'SELECT day, country, extract_started, extract_success, extract_error FROM daily_country_metrics WHERE day >= ?'
        )
        .bind(cutoff30dDay)
        .all<CountryMetricDbRow>()
        .catch(() => ({ results: [] })),
      db
        .prepare(
          'SELECT id, ts, day, country, referrer_host, referrer_category, entry_page, is_bot FROM page_visits WHERE day >= ?'
        )
        .bind(cutoff30dDay)
        .all<PageVisitDbRow>()
        .catch(() => ({ results: [] })),
    ]);

    const metricRows = metricsRes.results || [];
    const logRows = logRowsRes.results || [];

    const periodExtractionTotals: Record<
      StatsPeriodKey,
      { started: number; success: number; error: number }
    > = {
      today: { started: 0, success: 0, error: 0 },
      '7d': { started: 0, success: 0, error: 0 },
      '30d': { started: 0, success: 0, error: 0 },
    };

    const funnel = { ...emptyFunnel };
    const success7dByPlatform = new Map<TrackedPlatform, number>();
    const hourlyMetricMap = new Map<string, { day: string; hour: number; success: number; error: number }>();

    const ensureHourlyMetric = (day: string, hour: number) => {
      const key = `${day}::${hour}`;
      let entry = hourlyMetricMap.get(key);
      if (!entry) {
        entry = { day, hour, success: 0, error: 0 };
        hourlyMetricMap.set(key, entry);
      }
      return entry;
    };

    for (const row of metricRows) {
      const count = Math.max(0, Number(row.count) || 0);
      if (count === 0) continue;

      const dayKey = String(row.day || '').slice(0, 10);
      const p = normalizePlatformKey(String(row.platform || ''));
      const ev = String(row.event || '');

      if (ev === 'extract_started') {
        funnel.extract_started += count;
        periodExtractionTotals['30d'].started += count;
        if (dayKey >= cutoff7dDay) periodExtractionTotals['7d'].started += count;
        if (dayKey === todayDay) periodExtractionTotals.today.started += count;
        if (p) platforms[p].extract_started += count;
      } else if (ev === 'extract_success') {
        funnel.extract_success += count;
        periodExtractionTotals['30d'].success += count;
        if (dayKey >= cutoff7dDay) periodExtractionTotals['7d'].success += count;
        if (dayKey === todayDay) periodExtractionTotals.today.success += count;
        if (p) {
          platforms[p].extract_success += count;
          platforms[p].success += count;
          if (dayKey >= cutoff7dDay) {
            success7dByPlatform.set(p, (success7dByPlatform.get(p) || 0) + count);
          }
        }
        const bucket = dailyMap.get(dayKey);
        if (bucket) {
          bucket.success += count;
          bucket.total += count;
        }
      } else if (ev === 'extract_success_direct') {
        if (p) {
          platforms[p].direct += count;
          if (dayKey >= cutoff7dDay) {
            platforms[p].direct7d += count;
          }
        }
      } else if (ev === 'extract_success_tiers') {
        if (p) {
          platforms[p].tiers += count;
          if (dayKey >= cutoff7dDay) {
            platforms[p].tiers7d += count;
          }
        }
      } else if (ev === 'extract_error') {
        funnel.extract_error += count;
        periodExtractionTotals['30d'].error += count;
        if (dayKey >= cutoff7dDay) periodExtractionTotals['7d'].error += count;
        if (dayKey === todayDay) periodExtractionTotals.today.error += count;
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
      } else if (ev === 'selection_started') {
        funnel.selection_started += count;
        if (p) platforms[p].selection_started += count;
        const bucket = dailyMap.get(dayKey);
        if (bucket) bucket.selection_started += count;
      } else if (ev === 'selection_download') {
        funnel.selection_download += count;
        if (p) platforms[p].selection_download += count;
        const bucket = dailyMap.get(dayKey);
        if (bucket) bucket.selection_download += count;
      } else if (ev === 'story_opened') {
        emptyStories.story_opened += count;
      } else if (ev === 'story_list_opened') {
        emptyStories.story_list_opened += count;
      } else if (ev === 'story_download') {
        emptyStories.story_download += count;
      } else if (ev.startsWith('extract_success_h') && ev.length === 19) {
        const hour = Number.parseInt(ev.slice(17), 10);
        if (Number.isInteger(hour) && hour >= 0 && hour <= 23 && dailyMap.has(dayKey)) {
          ensureHourlyMetric(dayKey, hour).success += count;
        }
      } else if (ev.startsWith('extract_error_h') && ev.length === 17) {
        const hour = Number.parseInt(ev.slice(15), 10);
        if (Number.isInteger(hour) && hour >= 0 && hour <= 23 && dailyMap.has(dayKey)) {
          ensureHourlyMetric(dayKey, hour).error += count;
        }
      }
    }

    const errorCounts = new Map<string, number>();
    const hourlyLogMap = new Map<string, { day: string; hour: number; success: number; error: number }>();

    for (const row of logRows) {
      if (row.status !== 'success') {
        const code = row.error_code || 'UNKNOWN_ERROR';
        errorCounts.set(code, (errorCounts.get(code) || 0) + 1);
      }
      const tsNum = Number(row.ts);
      if (Number.isFinite(tsNum) && tsNum >= cutoff30dMs) {
        const d = new Date(tsNum);
        const dayKey = d.toISOString().slice(0, 10);
        if (dailyMap.has(dayKey)) {
          const hour = d.getUTCHours();
          const key = `${dayKey}::${hour}`;
          let entry = hourlyLogMap.get(key);
          if (!entry) {
            entry = { day: dayKey, hour, success: 0, error: 0 };
            hourlyLogMap.set(key, entry);
          }
          if (row.status === 'success') {
            entry.success += 1;
          } else {
            entry.error += 1;
          }
        }
      }
    }

    const hourlyKeys = new Set<string>([
      ...hourlyMetricMap.keys(),
      ...hourlyLogMap.keys(),
    ]);
    const hourly: HourlyBucket[] = Array.from(hourlyKeys)
      .map((key) => {
        const m = hourlyMetricMap.get(key);
        const l = hourlyLogMap.get(key);
        const day = m?.day ?? l?.day ?? todayDay;
        const hour = m?.hour ?? l?.hour ?? 0;
        const success = Math.max(m?.success ?? 0, l?.success ?? 0);
        const error = Math.max(m?.error ?? 0, l?.error ?? 0);
        return {
          day,
          hour,
          total: success + error,
          success,
          error,
        };
      })
      .filter((b) => b.total > 0)
      .sort((a, b) => a.day.localeCompare(b.day) || a.hour - b.hour);

    for (const key of TRACKED_PLATFORMS) {
      const p = platforms[key];
      p.total = Math.max(p.extract_started, p.success + p.error);
      p.successRate = p.total > 0 ? roundOneDecimal((p.success / p.total) * 100) : 0;
      p.downloadRate =
        p.success > 0
          ? Math.min(100, roundOneDecimal((p.download_success / p.success) * 100))
          : 0;
      p.downloadCompletionRate =
        p.download_started > 0
          ? Math.min(
              100,
              roundOneDecimal((p.download_success / p.download_started) * 100)
            )
          : 0;

      const stageTotal7d = Math.max(
        p.direct7d + p.tiers7d,
        success7dByPlatform.get(key) || 0
      );
      p.thirdPartyRate7d =
        stageTotal7d > 0
          ? Math.min(100, roundOneDecimal((p.tiers7d / stageTotal7d) * 100))
          : 0;
      p.stage = {
        direct: p.direct,
        tiers: p.tiers,
        direct7d: p.direct7d,
        tiers7d: p.tiers7d,
        thirdPartyRate7d: p.thirdPartyRate7d,
      };
    }

    const totalExtractions = Math.max(
      funnel.extract_started,
      funnel.extract_success + funnel.extract_error
    );
    funnel.extract_started = totalExtractions;
    funnel.extractSuccessRate =
      totalExtractions > 0
        ? roundOneDecimal((funnel.extract_success / totalExtractions) * 100)
        : 0;
    // Conversion globale = extract_success / extract_started
    funnel.globalConversionRate = funnel.extractSuccessRate;
    funnel.downloadConversionRate =
      funnel.extract_success > 0
        ? Math.min(
            100,
            roundOneDecimal((funnel.download_success / funnel.extract_success) * 100)
          )
        : 0;
    funnel.downloadCompletionRate =
      funnel.download_started > 0
        ? Math.min(
            100,
            roundOneDecimal((funnel.download_success / funnel.download_started) * 100)
          )
        : 0;

    const todayCount = Math.max(
      periodExtractionTotals.today.started,
      periodExtractionTotals.today.success + periodExtractionTotals.today.error
    );
    const last7dCount = Math.max(
      periodExtractionTotals['7d'].started,
      periodExtractionTotals['7d'].success + periodExtractionTotals['7d'].error
    );
    const last30dCount = totalExtractions;

    const errors = Array.from(errorCounts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);

    const normalizeErrorPlatformRows = (
      rows: ErrorByPlatformRow[] | undefined
    ): ErrorByPlatformRow[] =>
      (rows || []).map((r) => ({
        error_code: String(r.error_code || 'UNKNOWN_ERROR'),
        platform: String(r.platform || 'unknown'),
        count: Math.max(0, Number(r.count) || 0),
      }));

    const recentFailures: RecentFailureRow[] = (recentFailuresRes.results || []).map(
      (r) => ({
        id: Number(r.id) || 0,
        ts: Number(r.ts) || 0,
        platform: String(r.platform || 'unknown'),
        error_code: String(r.error_code || 'UNKNOWN_ERROR'),
        http_status:
          r.http_status !== null && r.http_status !== undefined
            ? Number(r.http_status)
            : null,
        error_message: r.error_message ? String(r.error_message) : null,
        source_domain: r.source_domain ? String(r.source_domain) : null,
        country: r.country ? String(r.country).toUpperCase() : null,
      })
    );

    const countryMetricRows = countryMetricsRes.results || [];
    const visitRows = visitsRes.results || [];

    const geoPeriods: Record<StatsPeriodKey, GeoPeriodAnalytics> = {
      today: buildGeoPeriod(
        'today',
        todayDay,
        countryMetricRows,
        visitRows,
        periodExtractionTotals.today
      ),
      '7d': buildGeoPeriod(
        '7d',
        cutoff7dDay,
        countryMetricRows,
        visitRows,
        periodExtractionTotals['7d']
      ),
      '30d': buildGeoPeriod(
        '30d',
        cutoff30dDay,
        countryMetricRows,
        visitRows,
        periodExtractionTotals['30d']
      ),
    };

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
        stories: emptyStories,
        platforms,
        errors,
        errorsByPlatform: {
          today: normalizeErrorPlatformRows(errPlatTodayRes.results),
          '7d': normalizeErrorPlatformRows(errPlat7dRes.results),
          '30d': normalizeErrorPlatformRows(errPlat30dRes.results),
        },
        recentFailures,
        daily: Array.from(dailyMap.values()),
        hourly,
        geo: {
          periods: geoPeriods,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Erreur lors de la lecture des statistiques D1.',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
