export interface WidgetDailyBucket {
  day: string;
  total: number;
  success: number;
  error: number;
  download_started?: number;
  download_success?: number;
  selection_started?: number;
  selection_download?: number;
}

export interface WidgetHourlyBucket {
  day: string;
  hour: number;
  total: number;
  success: number;
  error: number;
}

export interface WidgetPlatformStats {
  total: number;
  success: number;
  error: number;
  successRate: number;
  download_started?: number;
  download_success?: number;
  downloadRate?: number;
  downloadCompletionRate?: number;
  direct?: number;
  tiers?: number;
  direct7d?: number;
  tiers7d?: number;
  thirdPartyRate7d?: number;
  stage?: {
    direct: number;
    tiers: number;
    direct7d: number;
    tiers7d: number;
    thirdPartyRate7d: number;
  };
}

export interface ErrorByPlatformEntry {
  error_code: string;
  platform: string;
  count: number;
}

export interface RecentFailureEntry {
  id: number;
  ts: number;
  platform: string;
  error_code: string;
  http_status: number | null;
  error_message: string | null;
  source_domain: string | null;
  country: string | null;
}

export interface WidgetStatsInput {
  ok?: boolean;
  dbConnected?: boolean;
  counts?: {
    today: number;
    last7d: number;
    last30d: number;
  };
  funnel?: {
    extract_started: number;
    extract_success: number;
    extract_error: number;
    download_started: number;
    download_success: number;
    selection_started?: number;
    selection_download?: number;
    extractSuccessRate: number;
    globalConversionRate?: number;
    downloadConversionRate: number;
    downloadCompletionRate: number;
  };
  platforms?: Record<string, WidgetPlatformStats | undefined>;
  errors?: Array<{ code: string; count: number }>;
  errorsByPlatform?: {
    today?: ErrorByPlatformEntry[];
    '7d'?: ErrorByPlatformEntry[];
    '30d'?: ErrorByPlatformEntry[];
  };
  recentFailures?: RecentFailureEntry[];
  daily?: WidgetDailyBucket[];
  hourly?: WidgetHourlyBucket[];
  geo?: {
    periods?: Partial<
      Record<
        'today' | '7d' | '30d',
        {
          period?: 'today' | '7d' | '30d';
          humanVisits?: number;
          botVisits?: number;
          totalVisits?: number;
          totalExtractions?: number;
          totalExtractSuccess?: number;
          totalExtractError?: number;
          globalSuccessRate?: number;
          countries?: Array<{
            countryCode: string;
            humanVisits?: number;
            botVisits?: number;
            extractions?: number;
            extractSuccess?: number;
            extractError?: number;
            successRate?: number | null;
            sharePct?: number;
          }>;
          sources?: {
            categories?: Array<{
              category: 'search' | 'direct' | 'social' | 'other';
              label: string;
              visits: number;
              sharePct: number;
            }>;
            topReferrerHosts?: Array<{
              host: string;
              category: 'search' | 'direct' | 'social' | 'other';
              visits: number;
            }>;
            topEntryPages?: Array<{
              page: string;
              visits: number;
              sharePct: number;
            }>;
          };
        }
      >
    >;
  };
}

export interface PlatformSuccessSummary {
  key: string;
  label: string;
  total: number;
  success: number;
  error: number;
  successRate: number;
  failRate: number;
  sharePct: number;
  downloadStarted: number;
  downloadSuccess: number;
  downloadConversionPct: number;
  direct7d: number;
  tiers7d: number;
  thirdPartyRate7d: number;
}

export interface DailyUsageSummary {
  dbConnected: boolean;
  today: {
    day: string;
    total: number;
    success: number;
    error: number;
    successRate: number;
    downloads: number;
    downloadsStarted: number;
    selectionsStarted: number;
    selectionsDownloaded: number;
    hourlyVelocity: number;
  };
  yesterday: {
    day: string;
    total: number;
    success: number;
    error: number;
    successRate: number;
  };
  deltaTodayVsYesterdayPct: number | null;
  last7d: {
    total: number;
    success: number;
    error: number;
    successRate: number;
    avgDaily: number;
    downloads: number;
    downloadsStarted: number;
    selectionsStarted: number;
    selectionsDownloaded: number;
    directExtractions: number;
    thirdPartyExtractions: number;
    directSharePct: number;
    days: Array<WidgetDailyBucket & { successRate: number; downloadRate: number }>;
  };
  last30d: {
    total: number;
    success: number;
    error: number;
    successRate: number;
    avgDaily: number;
    downloads: number;
    downloadsStarted: number;
    downloadConversionRate: number;
    downloadCompletionRate: number;
    selectionsStarted: number;
    selectionsDownloaded: number;
    selectionConversionRate: number;
    peakDay: string | null;
    peakTotal: number;
    activeDaysCount: number;
  };
  platforms: PlatformSuccessSummary[];
  topErrors: Array<{ code: string; count: number; percentage: number }>;
}

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  instagram_profile: 'Profil Instagram',
  x: 'X (Twitter)',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
};

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function computeDailyUsageSummary(input: WidgetStatsInput | null | undefined): DailyUsageSummary {
  const dailyRaw = Array.isArray(input?.daily) ? input!.daily : [];
  const now = new Date();
  const todayUtc = now.toISOString().slice(0, 10);
  const elapsedUtcHours = Math.max(1, now.getUTCHours() + now.getUTCMinutes() / 60);

  const enrichedDaily = dailyRaw.map((bucket) => {
    const total = Number(bucket.total || 0);
    const success = Number(bucket.success || 0);
    const error = Number(bucket.error || 0);
    const dlStarted = Number(bucket.download_started || 0);
    const dlSuccess = Number(bucket.download_success || 0);
    const selStarted = Number(bucket.selection_started || 0);
    const selDownload = Number(bucket.selection_download || 0);
    const successRate = total > 0 ? roundOneDecimal((success / total) * 100) : 0;
    const downloadRate = success > 0 ? roundOneDecimal((dlSuccess / success) * 100) : 0;
    return {
      day: bucket.day,
      total,
      success,
      error,
      download_started: dlStarted,
      download_success: dlSuccess,
      selection_started: selStarted,
      selection_download: selDownload,
      successRate,
      downloadRate,
    };
  });

  const todayBucket =
    enrichedDaily.length > 0
      ? enrichedDaily[enrichedDaily.length - 1]
      : {
          day: todayUtc,
          total: Number(input?.counts?.today || 0),
          success: 0,
          error: 0,
          download_started: 0,
          download_success: 0,
          selection_started: 0,
          selection_download: 0,
          successRate: 0,
          downloadRate: 0,
        };

  const yesterdayBucket =
    enrichedDaily.length >= 2
      ? enrichedDaily[enrichedDaily.length - 2]
      : {
          day: '—',
          total: 0,
          success: 0,
          error: 0,
          download_started: 0,
          download_success: 0,
          selection_started: 0,
          selection_download: 0,
          successRate: 0,
          downloadRate: 0,
        };

  const deltaTodayVsYesterdayPct =
    yesterdayBucket.total > 0
      ? roundOneDecimal(((todayBucket.total - yesterdayBucket.total) / yesterdayBucket.total) * 100)
      : null;

  const recent7 = enrichedDaily.slice(-7);
  const sum7Total = recent7.reduce((acc, d) => acc + d.total, 0) || Number(input?.counts?.last7d || 0);
  const sum7Success = recent7.reduce((acc, d) => acc + d.success, 0);
  const sum7Error = recent7.reduce((acc, d) => acc + d.error, 0);
  const sum7Downloads = recent7.reduce((acc, d) => acc + (d.download_success || 0), 0);
  const sum7DownloadsStarted = recent7.reduce((acc, d) => acc + (d.download_started || 0), 0);
  const sum7SelectionsStarted = recent7.reduce((acc, d) => acc + (d.selection_started || 0), 0);
  const sum7SelectionsDownloaded = recent7.reduce((acc, d) => acc + (d.selection_download || 0), 0);
  const rate7 = sum7Total > 0 ? roundOneDecimal((sum7Success / sum7Total) * 100) : 0;

  const sum30Total =
    enrichedDaily.reduce((acc, d) => acc + d.total, 0) ||
    Number(input?.funnel?.extract_started ?? input?.counts?.last30d ?? 0);
  const sum30Success =
    enrichedDaily.reduce((acc, d) => acc + d.success, 0) ||
    Number(input?.funnel?.extract_success ?? 0);
  const sum30Error =
    enrichedDaily.reduce((acc, d) => acc + d.error, 0) ||
    Number(input?.funnel?.extract_error ?? 0);
  const sum30DownloadsStarted =
    Number(input?.funnel?.download_started ?? 0) ||
    enrichedDaily.reduce((acc, d) => acc + (d.download_started || 0), 0);
  const sum30Downloads =
    Number(input?.funnel?.download_success ?? 0) ||
    enrichedDaily.reduce((acc, d) => acc + (d.download_success || 0), 0);
  const sum30SelectionsStarted =
    Number(input?.funnel?.selection_started ?? 0) ||
    enrichedDaily.reduce((acc, d) => acc + (d.selection_started || 0), 0);
  const sum30SelectionsDownloaded =
    Number(input?.funnel?.selection_download ?? 0) ||
    enrichedDaily.reduce((acc, d) => acc + (d.selection_download || 0), 0);

  const rate30 =
    sum30Total > 0
      ? roundOneDecimal((sum30Success / sum30Total) * 100)
      : Number(input?.funnel?.extractSuccessRate ?? 0);

  const downloadConversionRate30 =
    typeof input?.funnel?.downloadConversionRate === 'number' && input.funnel.downloadConversionRate > 0
      ? roundOneDecimal(input.funnel.downloadConversionRate)
      : sum30Success > 0
      ? roundOneDecimal((sum30DownloadsStarted / sum30Success) * 100)
      : 0;

  const downloadCompletionRate30 =
    typeof input?.funnel?.downloadCompletionRate === 'number' && input.funnel.downloadCompletionRate > 0
      ? roundOneDecimal(input.funnel.downloadCompletionRate)
      : sum30DownloadsStarted > 0
      ? roundOneDecimal((sum30Downloads / sum30DownloadsStarted) * 100)
      : 0;

  const selectionConversionRate30 =
    sum30SelectionsStarted > 0
      ? roundOneDecimal((sum30SelectionsDownloaded / sum30SelectionsStarted) * 100)
      : 0;

  let peakDay: string | null = null;
  let peakTotal = 0;
  let activeDaysCount = 0;
  for (const d of enrichedDaily) {
    if (d.total > 0) activeDaysCount += 1;
    if (d.total > peakTotal) {
      peakTotal = d.total;
      peakDay = d.day;
    }
  }

  const rawPlatforms = input?.platforms || {};
  let totalDirect7d = 0;
  let totalTiers7d = 0;

  const platformEntries = Object.entries(PLATFORM_LABELS).map(([key, label]) => {
    const st = rawPlatforms[key];
    const total = Number(st?.total || 0);
    const success = Number(st?.success || 0);
    const error = Number(st?.error || 0);
    const dlStarted = Number(st?.download_started || 0);
    const dlSuccess = Number(st?.download_success || 0);
    const direct7d = Number(st?.stage?.direct7d ?? st?.direct7d ?? 0);
    const tiers7d = Number(st?.stage?.tiers7d ?? st?.tiers7d ?? 0);
    const thirdPartyRate7d = Number(st?.stage?.thirdPartyRate7d ?? st?.thirdPartyRate7d ?? 0);

    totalDirect7d += direct7d;
    totalTiers7d += tiers7d;

    const successRate =
      typeof st?.successRate === 'number' && st.total
        ? roundOneDecimal(st.successRate)
        : total > 0
        ? roundOneDecimal((success / total) * 100)
        : 0;
    const failRate = total > 0 ? roundOneDecimal((error / total) * 100) : 0;
    const downloadConversionPct =
      success > 0 ? roundOneDecimal((dlSuccess / success) * 100) : 0;

    return {
      key,
      label,
      total,
      success,
      error,
      successRate,
      failRate,
      sharePct: 0,
      downloadStarted: dlStarted,
      downloadSuccess: dlSuccess,
      downloadConversionPct,
      direct7d,
      tiers7d,
      thirdPartyRate7d,
    };
  });

  const totalPlatformRequests = platformEntries.reduce((acc, p) => acc + p.total, 0);
  const platforms: PlatformSuccessSummary[] = platformEntries
    .map((p) => ({
      ...p,
      sharePct:
        totalPlatformRequests > 0 ? roundOneDecimal((p.total / totalPlatformRequests) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total || b.successRate - a.successRate);

  const stageTotal7d = totalDirect7d + totalTiers7d;
  const directSharePct =
    stageTotal7d > 0 ? roundOneDecimal((totalDirect7d / stageTotal7d) * 100) : 100;

  const rawErrors = Array.isArray(input?.errors) ? input!.errors : [];
  const totalErrorCount = rawErrors.reduce((acc, e) => acc + Number(e.count || 0), 0);
  const topErrors = rawErrors.slice(0, 5).map((e) => ({
    code: e.code,
    count: Number(e.count || 0),
    percentage:
      totalErrorCount > 0 ? roundOneDecimal((Number(e.count || 0) / totalErrorCount) * 100) : 0,
  }));

  return {
    dbConnected: Boolean(input?.dbConnected),
    today: {
      day: todayBucket.day,
      total: todayBucket.total,
      success: todayBucket.success,
      error: todayBucket.error,
      successRate: todayBucket.successRate,
      downloads: todayBucket.download_success || 0,
      downloadsStarted: todayBucket.download_started || 0,
      selectionsStarted: todayBucket.selection_started || 0,
      selectionsDownloaded: todayBucket.selection_download || 0,
      hourlyVelocity: roundOneDecimal(todayBucket.total / elapsedUtcHours),
    },
    yesterday: {
      day: yesterdayBucket.day,
      total: yesterdayBucket.total,
      success: yesterdayBucket.success,
      error: yesterdayBucket.error,
      successRate: yesterdayBucket.successRate,
    },
    deltaTodayVsYesterdayPct,
    last7d: {
      total: sum7Total,
      success: sum7Success,
      error: sum7Error,
      successRate: rate7,
      avgDaily: roundOneDecimal(sum7Total / Math.max(1, recent7.length || 7)),
      downloads: sum7Downloads,
      downloadsStarted: sum7DownloadsStarted,
      selectionsStarted: sum7SelectionsStarted,
      selectionsDownloaded: sum7SelectionsDownloaded,
      directExtractions: totalDirect7d,
      thirdPartyExtractions: totalTiers7d,
      directSharePct,
      days: [...recent7].reverse(),
    },
    last30d: {
      total: sum30Total,
      success: sum30Success,
      error: sum30Error,
      successRate: rate30,
      avgDaily: roundOneDecimal(sum30Total / Math.max(1, enrichedDaily.length || 30)),
      downloads: sum30Downloads,
      downloadsStarted: sum30DownloadsStarted,
      downloadConversionRate: downloadConversionRate30,
      downloadCompletionRate: downloadCompletionRate30,
      selectionsStarted: sum30SelectionsStarted,
      selectionsDownloaded: sum30SelectionsDownloaded,
      selectionConversionRate: selectionConversionRate30,
      peakDay,
      peakTotal,
      activeDaysCount,
    },
    platforms,
    topErrors,
  };
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates an RFC-4180 compliant CSV string for the daily API usage metrics table.
 */
export function buildDailyUsageCsv(
  days: Array<
    WidgetDailyBucket & {
      successRate?: number;
      downloadRate?: number;
    }
  >
): string {
  const headers = [
    'Date (UTC)',
    'Appels API',
    'Succès',
    'Échecs',
    'Téléchargements',
    'Taux de succès (%)',
  ];

  const rows = (Array.isArray(days) ? days : []).map((d) => {
    const total = Number(d.total || 0);
    const success = Number(d.success || 0);
    const error = Number(d.error || 0);
    const downloads = Number(d.download_success || 0);
    const successRate =
      typeof d.successRate === 'number'
        ? roundOneDecimal(d.successRate)
        : total > 0
        ? roundOneDecimal((success / total) * 100)
        : 0;

    return [
      escapeCsvCell(d.day),
      escapeCsvCell(total),
      escapeCsvCell(success),
      escapeCsvCell(error),
      escapeCsvCell(downloads),
      escapeCsvCell(successRate),
    ].join(',');
  });

  return [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
}

