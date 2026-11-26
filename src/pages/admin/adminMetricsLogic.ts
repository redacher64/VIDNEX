import type {
  WidgetStatsInput,
  WidgetDailyBucket,
  ErrorByPlatformEntry,
} from './dashboardWidgetLogic.ts';

export type AdminPlatformKey =
  | 'tiktok'
  | 'instagram'
  | 'instagram_profile'
  | 'x'
  | 'facebook'
  | 'linkedin';

export type AdminOverviewPeriod = 'today' | '7d' | '30d';
export type ExtractionsSubTab = 'plateformes' | 'erreurs' | 'entonnoir';
export type PlatformCombinedStatus = 'ok' | 'degraded' | 'critical' | 'idle';

export interface AdminNavigationTarget {
  tab: 'dashboard' | 'extractions' | 'visitors' | 'blog' | 'controls' | 'users' | 'account';
  subTab?: ExtractionsSubTab;
  platform?: string;
  errorCode?: string;
}

export interface AdminEngineStatusRow {
  platform: AdminPlatformKey;
  last_success_ts: number | null;
  last_test_ts: number | null;
  last_test_ok: number | null;
  last_error_code: string | null;
  test_url?: string;
}

export interface AdminStatsData extends WidgetStatsInput {
  stories?: {
    story_opened: number;
    story_list_opened: number;
    story_download: number;
  };
}

export interface PlatformTableRow {
  key: AdminPlatformKey;
  label: string;
  engineSubtitle: string;
  total: number;
  success: number;
  error: number;
  successRate: number | null;
  topError: string | null;
  topErrorCount: number;
  status: PlatformCombinedStatus;
  lastTestOk: number | null;
  lastTestTs: number | null;
  lastSuccessTs: number | null;
  lastErrorCode: string | null;
  testUrl: string;
  direct7d: number;
  tiers7d: number;
  thirdPartyRate7d: number | null;
}

export type PlatformSortKey = 'label' | 'total' | 'successRate' | 'error' | 'status';

export interface ActionRequiredItem {
  id: string;
  severity: 'critical' | 'warning';
  title: string;
  detail: string;
  ctaLabel: string;
  target: AdminNavigationTarget;
}

export interface DailyChartPoint {
  day: string;
  shortLabel: string;
  total: number;
  success: number;
  error: number;
  downloads: number;
  successRate: number | null;
}

export interface ErrorLogRow {
  id: number;
  ts: number;
  platform: string;
  status: string;
  content_kind?: string | null;
  engine_fn?: string | null;
  engine_stage?: string | null;
  http_status?: number | null;
  error_code: string | null;
  error_message?: string | null;
  source_domain?: string | null;
  country?: string | null;
  duration_ms: number | null;
  ip_hash_short?: string;
  ip_hash?: string;
}

export interface VisibleErrorLogColumns {
  contentKind: boolean;
  engineFn: boolean;
  engineStage: boolean;
  httpStatus: boolean;
  sourceDomain: boolean;
  errorMessage: boolean;
  duration: boolean;
  ip: boolean;
}

export const ADMIN_PLATFORM_META: ReadonlyArray<{
  key: AdminPlatformKey;
  label: string;
  engineSubtitle: string;
}> = [
  { key: 'tiktok', label: 'TikTok', engineSubtitle: 'TikWM / HTML' },
  { key: 'instagram', label: 'Instagram', engineSubtitle: 'Embed / GraphQL' },
  {
    key: 'instagram_profile',
    label: 'Profil Instagram',
    engineSubtitle: 'web_profile_info / OG',
  },
  { key: 'x', label: 'X (Twitter)', engineSubtitle: 'Syndication twimg' },
  { key: 'facebook', label: 'Facebook', engineSubtitle: 'HTML / Mobile' },
  { key: 'linkedin', label: 'LinkedIn', engineSubtitle: 'Photo publique OG / JSON-LD' },
];

const PLATFORM_LABEL_MAP: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  instagram_profile: 'Profil Instagram',
  x: 'X (Twitter)',
  twitter: 'X (Twitter)',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  unknown: 'Inconnue',
};

export function formatPlatformDisplayName(platform: string | null | undefined): string {
  const key = String(platform || '').trim().toLowerCase();
  if (!key) return '—';
  return PLATFORM_LABEL_MAP[key] || platform || '—';
}

export function formatNumberFr(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return '—';
  }
  return Math.max(0, Math.round(Number(value))).toLocaleString('fr-FR');
}

export function formatCompactNumberFr(value: number | null | undefined): string {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return '—';
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}M`;
  }
  if (num >= 10_000) {
    return `${(num / 1_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}k`;
  }
  return Math.round(num).toLocaleString('fr-FR');
}

/**
 * Formats a percentage strictly guarding zero denominators.
 * Never returns "0 %" or "100 %" when denominator <= 0; returns "—".
 */
export function formatSafePercent(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
  decimals = 1
): string {
  const den = Number(denominator);
  const num = Number(numerator);
  if (!Number.isFinite(den) || den <= 0 || !Number.isFinite(num)) {
    return '—';
  }
  const pct = Math.max(0, Math.min(100, (num / den) * 100));
  return `${pct.toLocaleString('fr-FR', {
    minimumFractionDigits: pct > 0 && pct < 10 ? 1 : 0,
    maximumFractionDigits: decimals,
  })} %`;
}

/**
 * Formats a pre-computed percentage value (0..100) only when its denominator > 0.
 */
export function formatSafeRateValue(
  ratePct: number | null | undefined,
  denominator: number | null | undefined,
  decimals = 1
): string {
  const den = Number(denominator);
  if (!Number.isFinite(den) || den <= 0) return '—';
  const val = Number(ratePct);
  if (!Number.isFinite(val)) return '—';
  const clamped = Math.max(0, Math.min(100, val));
  return `${clamped.toLocaleString('fr-FR', {
    minimumFractionDigits: clamped > 0 && clamped < 10 ? 1 : 0,
    maximumFractionDigits: decimals,
  })} %`;
}

export function formatBytesFr(bytes: number | null | undefined): string {
  const b = Math.max(0, Number(bytes) || 0);
  if (b === 0) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
  const val = b / Math.pow(1024, i);
  return `${val.toLocaleString('fr-FR', {
    maximumFractionDigits: i >= 2 ? 2 : 0,
  })} ${units[i]}`;
}

export function formatTimeHHMM(ts: number | Date | null | undefined): string {
  if (!ts) return '—';
  const date = ts instanceof Date ? ts : new Date(ts < 10_000_000_000 ? ts * 1000 : ts);
  if (Number.isNaN(date.getTime())) return '—';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatDateTimeFr(ts: number | null | undefined): string {
  if (!ts || !Number.isFinite(ts)) return '—';
  const ms = ts < 10_000_000_000 ? ts * 1000 : ts;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDeltaPercent(
  current: number,
  previous: number
): { label: string; direction: 'up' | 'down' | 'flat' } | null {
  if (!Number.isFinite(previous) || previous <= 0 || !Number.isFinite(current)) {
    return null;
  }
  const delta = ((current - previous) / previous) * 100;
  const rounded = Math.round(delta * 10) / 10;
  if (rounded === 0) {
    return { label: '0 %', direction: 'flat' };
  }
  const sign = rounded > 0 ? '+' : '';
  return {
    label: `${sign}${rounded.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`,
    direction: rounded > 0 ? 'up' : 'down',
  };
}

/**
 * Combined platform health status blending live engine probe AND real extraction success rate.
 * Strict rule: NEVER returns 'ok' when real traffic has 0% success, when total >= 5 & rate < 50%,
 * or when the last probe failed (lastTestOk === 0).
 */
export function computeCombinedPlatformStatus(params: {
  total: number;
  successRate: number | null;
  lastTestOk: number | null | undefined;
  lastTestTs?: number | null;
}): PlatformCombinedStatus {
  const { total, successRate, lastTestOk, lastTestTs } = params;

  if (lastTestOk === 0) {
    return 'critical';
  }

  if (total > 0) {
    const rate = successRate ?? 0;
    if (rate === 0) return 'critical';
    if (total >= 5 && rate < 50) return 'critical';
    if (rate < 85) return 'degraded';
    return 'ok';
  }

  // Zero real traffic in window
  if (lastTestOk === 1 && lastTestTs) {
    return 'ok';
  }
  return 'idle';
}

export function getCombinedStatusMeta(status: PlatformCombinedStatus): {
  label: string;
  sortRank: number;
} {
  switch (status) {
    case 'critical':
      return { label: 'Critique', sortRank: 0 };
    case 'degraded':
      return { label: 'Dégradé', sortRank: 1 };
    case 'idle':
      return { label: 'Sans trafic', sortRank: 2 };
    case 'ok':
      return { label: 'OK', sortRank: 3 };
  }
}

export function buildPlatformTableRows(
  stats: AdminStatsData | null | undefined,
  engines: Partial<Record<AdminPlatformKey, AdminEngineStatusRow>> | null | undefined
): PlatformTableRow[] {
  const rawPlatforms = stats?.platforms || {};
  const errors30 = Array.isArray(stats?.errorsByPlatform?.['30d'])
    ? stats!.errorsByPlatform!['30d']!
    : [];

  // Map top error per platform
  const topErrorByPlatform = new Map<string, { code: string; count: number }>();
  for (const entry of errors30) {
    const key = String(entry.platform || '').toLowerCase();
    const existing = topErrorByPlatform.get(key);
    if (!existing || entry.count > existing.count) {
      topErrorByPlatform.set(key, { code: entry.error_code, count: entry.count });
    }
  }

  return ADMIN_PLATFORM_META.map(({ key, label, engineSubtitle }) => {
    const st = rawPlatforms[key];
    const eng = engines?.[key];
    const total = Math.max(0, Number(st?.total || 0));
    const success = Math.max(0, Number(st?.success || 0));
    const error = Math.max(0, Number(st?.error || 0));
    const successRate =
      total > 0
        ? Math.round(((success / total) * 100) * 10) / 10
        : null;

    const direct7d = Math.max(0, Number(st?.stage?.direct7d ?? st?.direct7d ?? 0));
    const tiers7d = Math.max(0, Number(st?.stage?.tiers7d ?? st?.tiers7d ?? 0));
    const stageTotal7d = direct7d + tiers7d;
    const thirdPartyRate7d =
      stageTotal7d > 0 ? Math.round(((tiers7d / stageTotal7d) * 100) * 10) / 10 : null;

    const topErr = topErrorByPlatform.get(key);
    const status = computeCombinedPlatformStatus({
      total,
      successRate,
      lastTestOk: eng?.last_test_ok ?? null,
      lastTestTs: eng?.last_test_ts ?? null,
    });

    return {
      key,
      label,
      engineSubtitle,
      total,
      success,
      error,
      successRate,
      topError: topErr?.code || eng?.last_error_code || null,
      topErrorCount: topErr?.count || 0,
      status,
      lastTestOk: eng?.last_test_ok ?? null,
      lastTestTs: eng?.last_test_ts ?? null,
      lastSuccessTs: eng?.last_success_ts ?? null,
      lastErrorCode: eng?.last_error_code ?? null,
      testUrl: eng?.test_url || '',
      direct7d,
      tiers7d,
      thirdPartyRate7d,
    };
  });
}

export function sortPlatformTableRows(
  rows: readonly PlatformTableRow[],
  sortKey: PlatformSortKey,
  direction: 'asc' | 'desc'
): PlatformTableRow[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    switch (sortKey) {
      case 'label':
        return a.label.localeCompare(b.label, 'fr') * factor;
      case 'total':
        return (a.total - b.total) * factor;
      case 'error':
        return (a.error - b.error) * factor;
      case 'successRate': {
        const av = a.successRate === null ? -1 : a.successRate;
        const bv = b.successRate === null ? -1 : b.successRate;
        return (av - bv) * factor;
      }
      case 'status': {
        const ar = getCombinedStatusMeta(a.status).sortRank;
        const br = getCombinedStatusMeta(b.status).sortRank;
        if (ar !== br) return (ar - br) * factor;
        return (b.total - a.total);
      }
    }
  });
}

/**
 * Automatic "À traiter" action queue for Overview:
 * 1) Any platform with < 50% success rate AND >= 5 requests
 * 2) Any engine currently marked down (last_test_ok === 0)
 * 3) Dominant error across 30 days (when > 0 errors exist)
 */
export function buildActionRequiredItems(
  stats: AdminStatsData | null | undefined,
  engines: Partial<Record<AdminPlatformKey, AdminEngineStatusRow>> | null | undefined
): ActionRequiredItem[] {
  const items: ActionRequiredItem[] = [];
  const rows = buildPlatformTableRows(stats, engines);
  const flaggedPlatforms = new Set<string>();

  for (const row of rows) {
    if (row.total >= 5 && row.successRate !== null && row.successRate < 50) {
      flaggedPlatforms.add(row.key);
      items.push({
        id: `low-rate-${row.key}`,
        severity: 'critical',
        title: `${row.label} sous 50 % de succès`,
        detail: `${formatSafeRateValue(row.successRate, row.total)} sur ${formatNumberFr(row.total)} req (${formatNumberFr(row.error)} échecs)${row.topError ? ` · ${row.topError}` : ''}`,
        ctaLabel: 'Diagnostiquer',
        target: { tab: 'extractions', subTab: 'plateformes', platform: row.key },
      });
    }
  }

  for (const row of rows) {
    if (row.lastTestOk === 0 && !flaggedPlatforms.has(row.key)) {
      items.push({
        id: `engine-down-${row.key}`,
        severity: 'critical',
        title: `Moteur ${row.label} hors ligne`,
        detail: row.lastErrorCode
          ? `Dernier test échoué (${row.lastErrorCode})`
          : 'Dernier test manuel en échec',
        ctaLabel: 'Tester',
        target: { tab: 'extractions', subTab: 'plateformes', platform: row.key },
      });
    }
  }

  const errors = Array.isArray(stats?.errors) ? stats!.errors! : [];
  const dominant = errors.find((e) => Number(e.count || 0) > 0);
  if (dominant) {
    const totalErr = errors.reduce((acc, e) => acc + Math.max(0, Number(e.count || 0)), 0);
    items.push({
      id: `dominant-error-${dominant.code}`,
      severity: 'warning',
      title: `Erreur dominante : ${dominant.code}`,
      detail: `${formatNumberFr(dominant.count)} occurrences (${formatSafePercent(dominant.count, totalErr)} des échecs sur 30j)`,
      ctaLabel: 'Voir le journal',
      target: { tab: 'extractions', subTab: 'erreurs', errorCode: dominant.code },
    });
  }

  return items;
}

function addUtcDays(isoDay: string, deltaDays: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay);
  if (!match) return isoDay;
  const d = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + deltaDays)
  );
  return d.toISOString().slice(0, 10);
}

/**
 * Builds a complete, dense chronological series of exactly 7 or 30 daily buckets.
 * Prevents the empty-chart bug caused by sparse or empty `daily` arrays.
 */
export function buildDailyChartSeries(
  daily: readonly WidgetDailyBucket[] | null | undefined,
  range: '7d' | '30d',
  anchorTodayIso?: string
): {
  points: DailyChartPoint[];
  maxTotal: number;
  totalCalls: number;
  totalSuccess: number;
  totalError: number;
} {
  const numDays = range === '7d' ? 7 : 30;
  const byDay = new Map<string, WidgetDailyBucket>();
  let latestDay: string | null = null;

  if (Array.isArray(daily)) {
    for (const bucket of daily) {
      if (!bucket?.day || !/^\d{4}-\d{2}-\d{2}$/.test(bucket.day)) continue;
      byDay.set(bucket.day, bucket);
      if (!latestDay || bucket.day > latestDay) {
        latestDay = bucket.day;
      }
    }
  }

  const endDay =
    anchorTodayIso && /^\d{4}-\d{2}-\d{2}$/.test(anchorTodayIso)
      ? anchorTodayIso
      : latestDay || new Date().toISOString().slice(0, 10);

  const points: DailyChartPoint[] = [];
  let maxTotal = 0;
  let totalCalls = 0;
  let totalSuccess = 0;
  let totalError = 0;

  for (let offset = numDays - 1; offset >= 0; offset--) {
    const day = addUtcDays(endDay, -offset);
    const raw = byDay.get(day);
    const success = Math.max(0, Number(raw?.success || 0));
    const error = Math.max(0, Number(raw?.error || 0));
    const rawTotal = Math.max(0, Number(raw?.total || 0));
    const total = Math.max(rawTotal, success + error);
    const downloads = Math.max(0, Number(raw?.download_success || 0));

    if (total > maxTotal) maxTotal = total;
    totalCalls += total;
    totalSuccess += success;
    totalError += error;

    const dd = day.slice(8, 10);
    const mm = day.slice(5, 7);
    points.push({
      day,
      shortLabel: `${dd}/${mm}`,
      total,
      success,
      error,
      downloads,
      successRate: total > 0 ? Math.round(((success / total) * 100) * 10) / 10 : null,
    });
  }

  return { points, maxTotal, totalCalls, totalSuccess, totalError };
}

/**
 * Extracts dynamic error codes strictly from real observed D1 data (never hardcoded).
 */
export function extractDynamicErrorCodes(params: {
  statsErrors?: ReadonlyArray<{ code: string; count: number }> | null;
  errorsByPlatform?: ReadonlyArray<ErrorByPlatformEntry> | null;
  activityItems?: ReadonlyArray<{ error_code?: string | null }> | null;
}): string[] {
  const counts = new Map<string, number>();

  for (const item of params.statsErrors || []) {
    const code = String(item?.code || '').trim();
    if (!code) continue;
    counts.set(code, (counts.get(code) || 0) + Math.max(1, Number(item.count || 0)));
  }

  for (const item of params.errorsByPlatform || []) {
    const code = String(item?.error_code || '').trim();
    if (!code) continue;
    if (!counts.has(code)) {
      counts.set(code, Math.max(1, Number(item.count || 0)));
    }
  }

  for (const row of params.activityItems || []) {
    const code = String(row?.error_code || '').trim();
    if (!code) continue;
    if (!counts.has(code)) {
      counts.set(code, 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([code]) => code);
}

function isNonEmptyCell(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  const trimmed = value.trim();
  return trimmed !== '' && trimmed !== '—' && trimmed !== 'anonyme';
}

/**
 * Determines which optional columns in the error log contain real data,
 * hiding completely empty columns (such as empty Domaine or Message).
 */
export function getVisibleErrorLogColumns(
  rows: readonly ErrorLogRow[]
): VisibleErrorLogColumns {
  if (!rows || rows.length === 0) {
    return {
      contentKind: false,
      engineFn: false,
      engineStage: false,
      httpStatus: true,
      sourceDomain: false,
      errorMessage: false,
      duration: true,
      ip: false,
    };
  }

  return {
    contentKind: rows.some((r) => isNonEmptyCell(r.content_kind)),
    engineFn: rows.some((r) => isNonEmptyCell(r.engine_fn)),
    engineStage: rows.some((r) => isNonEmptyCell(r.engine_stage)),
    httpStatus: rows.some((r) => r.http_status !== null && r.http_status !== undefined),
    sourceDomain: rows.some((r) => isNonEmptyCell(r.source_domain)),
    errorMessage: rows.some((r) => isNonEmptyCell(r.error_message)),
    duration: rows.some((r) => r.duration_ms !== null && r.duration_ms !== undefined),
    ip: rows.some((r) => isNonEmptyCell(r.ip_hash_short) || isNonEmptyCell(r.ip_hash)),
  };
}
