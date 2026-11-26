import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from './AdminIcons';
import { AdminPageHeader } from './AdminPageHeader';
import type { AdminStatsData } from './adminMetricsLogic';
import { isoToEmojiFlag } from './worldMapLogic';
import { AudienceSummarySection } from './audience/AudienceSummarySection';
import { AudienceGeoSection } from './audience/AudienceGeoSection';
import { AudienceSourcesSection } from './audience/AudienceSourcesSection';
import { AudienceTechnicalDetails } from './audience/AudienceTechnicalDetails';

export type VisitorsPeriodKey = '24h' | '7d' | '30d';

export interface CountryVisitorsRow {
  countryCode: string;
  countryName: string;
  flag: string;
  requests: number;
  percentage: number;
  bytes?: number;
  threats?: number;
}

export interface StatusCodeBreakdown {
  status2xx: number;
  status3xx: number;
  status4xx: number;
  status5xx: number;
  statusOther: number;
  details: Array<{
    code: number;
    requests: number;
    percentage: number;
  }>;
}

export interface BrowserVisitorsRow {
  browser: string;
  pageViews: number;
  percentage: number;
}

export interface VisitorsTimeseriesPoint {
  timestamp: string;
  label: string;
  requests: number;
  cachedRequests: number;
  uniques: number;
  bytes: number;
  threats: number;
  errors: number;
  invocations: number;
}

export interface SubrequestHostRow {
  host: string;
  platform: string;
  requests: number;
  status2xx: number;
  status3xx: number;
  status4xx: number;
  status5xx: number;
  avgDurationMs: number;
}

export interface HostnameTrafficRow {
  hostname: string;
  requests: number;
  percentage: number;
}

export interface WorkerRuntimeMetrics {
  invocations: number;
  subrequests: number;
  errors: number;
  errorRate: number;
  cpuTimeP50Ms: number;
  cpuTimeP99Ms: number;
  wallTimeP50Ms: number;
}

export interface PeriodVisitorsSummary {
  period: VisitorsPeriodKey;
  totalRequests: number;
  uniqueVisitors: number;
  pageViews?: number;
  cachedRequests?: number;
  cacheHitRate?: number;
  totalBytes?: number;
  cachedBytes?: number;
  bandwidthCacheRate?: number;
  threats?: number;
  requestsPerSecond?: number;
  countries: CountryVisitorsRow[];
  statusCodes?: StatusCodeBreakdown;
  browsers?: BrowserVisitorsRow[];
  timeseries?: VisitorsTimeseriesPoint[];
  workerMetrics?: WorkerRuntimeMetrics;
  subrequestHosts?: SubrequestHostRow[];
  topHostnames?: HostnameTrafficRow[];
}

interface VisitorsApiResponse {
  ok: boolean;
  cached?: boolean;
  fetchedAt?: number;
  sourceScope?: 'zone' | 'zone+account' | 'account' | 'd1-fallback';
  rateLimitedWarning?: string;
  periods?: Record<VisitorsPeriodKey, PeriodVisitorsSummary>;
  errorCode?: string;
  message?: string;
}

const AUDIENCE_PERIOD_OPTIONS = [
  { id: '24h', label: '24h' },
  { id: '7d', label: '7j' },
  { id: '30d', label: '30j' },
] as const;

export const Visitors: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<VisitorsPeriodKey>('7d');
  const [cfData, setCfData] = useState<VisitorsApiResponse | null>(null);
  const [d1Data, setD1Data] = useState<AdminStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);

  const loadAudience = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfRes, d1Res] = await Promise.all([
        fetch('/api/admin/visitors', {
          method: 'GET',
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        }),
        fetch('/api/admin/stats', {
          method: 'GET',
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        }),
      ]);

      const cfJson: VisitorsApiResponse | null = await cfRes.json().catch(() => null);
      const d1Json: AdminStatsData | null = await d1Res.json().catch(() => null);

      if (d1Res.ok && d1Json?.ok) {
        setD1Data(d1Json);
      }

      if (!cfRes.ok || !cfJson || !cfJson.ok || !cfJson.periods) {
        setError(
          cfJson?.message ||
            `Impossible de charger les statistiques Cloudflare (HTTP ${cfRes.status}).`
        );
      } else {
        setCfData(cfJson);
      }

      setFetchedAt(cfJson?.fetchedAt || Date.now());
    } catch {
      setError('Erreur réseau lors du chargement des statistiques d’audience.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAudience();
  }, [loadAudience]);

  const handleExportExcel = async () => {
    if (exporting || !d1Data) return;
    setExporting(true);
    try {
      const { downloadAdminStatsExcel } = await import('./excelExport');
      await downloadAdminStatsExcel(d1Data);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Erreur lors de l’export Excel : ${err.message}`
          : 'Erreur lors de l’export Excel.'
      );
    } finally {
      setExporting(false);
    }
  };

  const activeCfSummary: PeriodVisitorsSummary = useMemo(() => {
    return (
      cfData?.periods?.[selectedPeriod] || {
        period: selectedPeriod,
        totalRequests: 0,
        uniqueVisitors: 0,
        pageViews: 0,
        cachedRequests: 0,
        cacheHitRate: 0,
        totalBytes: 0,
        cachedBytes: 0,
        bandwidthCacheRate: 0,
        threats: 0,
        countries: [],
      }
    );
  }, [cfData, selectedPeriod]);

  const d1PeriodKey = selectedPeriod === '24h' ? 'today' : selectedPeriod;
  const activeD1Geo = d1Data?.geo?.periods?.[d1PeriodKey];
  const periodLabel =
    selectedPeriod === '24h' ? '24h' : selectedPeriod === '7d' ? '7j' : '30j';

  const statusCodes: StatusCodeBreakdown = activeCfSummary.statusCodes || {
    status2xx: activeCfSummary.totalRequests,
    status3xx: 0,
    status4xx: 0,
    status5xx: 0,
    statusOther: 0,
    details: [],
  };

  const workerMetrics: WorkerRuntimeMetrics = activeCfSummary.workerMetrics || {
    invocations: 0,
    subrequests: 0,
    errors: 0,
    errorRate: 0,
    cpuTimeP50Ms: 0,
    cpuTimeP99Ms: 0,
    wallTimeP50Ms: 0,
  };

  const { effectiveGeoCountries, geoSourceLabel } = useMemo(() => {
    const cfCountries = activeCfSummary.countries || [];
    if (cfCountries.length > 0 && cfData?.sourceScope !== 'd1-fallback') {
      return {
        effectiveGeoCountries: cfCountries,
        geoSourceLabel: 'Source : Trafic brut Cloudflare (bots inclus)',
      };
    }

    const d1CountriesRaw = activeD1Geo?.countries || [];
    if (d1CountriesRaw.length > 0) {
      let regionDisplay: Intl.DisplayNames | null = null;
      try {
        regionDisplay = new Intl.DisplayNames(['fr'], { type: 'region' });
      } catch {
        regionDisplay = null;
      }

      const totalVol = d1CountriesRaw.reduce(
        (acc, c) => acc + Math.max(0, Number(c.humanVisits || c.extractions || 0)),
        0
      );

      const mapped: CountryVisitorsRow[] = d1CountriesRaw
        .map((c) => {
          const code = String(c.countryCode || '').trim().toUpperCase();
          const volume = Math.max(0, Number(c.humanVisits || c.extractions || 0));
          let countryName = code;
          if (regionDisplay && /^[A-Z]{2}$/.test(code)) {
            try {
              countryName = regionDisplay.of(code) || code;
            } catch {
              countryName = code;
            }
          }
          return {
            countryCode: code,
            countryName,
            flag: isoToEmojiFlag(code),
            requests: volume,
            bytes: 0,
            percentage: totalVol > 0 ? Math.round(((volume / totalVol) * 100) * 10) / 10 : 0,
          };
        })
        .filter((c) => c.requests > 0);

      return {
        effectiveGeoCountries: mapped,
        geoSourceLabel: 'Source : Humains vérifiés (D1)',
      };
    }

    return {
      effectiveGeoCountries: cfCountries,
      geoSourceLabel:
        cfData?.sourceScope === 'd1-fallback'
          ? 'Source : Humains vérifiés (D1)'
          : 'Source : Trafic brut Cloudflare (bots inclus)',
    };
  }, [activeCfSummary.countries, cfData?.sourceScope, activeD1Geo?.countries]);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Audience"
        subtitle="Distinction explicite entre visiteurs humains (D1) et trafic brut Edge (Cloudflare)"
        fetchedAt={fetchedAt}
        loading={loading}
        onRefresh={loadAudience}
        onExport={handleExportExcel}
        exporting={exporting}
        exportDisabled={!d1Data || loading}
        periodOptions={AUDIENCE_PERIOD_OPTIONS}
        selectedPeriod={selectedPeriod}
        onSelectPeriod={setSelectedPeriod}
        periodAriaLabel="Période Audience"
      />

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800/70 text-red-900 dark:text-red-200 text-xs flex items-start gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!error && cfData?.rateLimitedWarning && (
        <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/50 text-amber-900 dark:text-amber-200 text-xs">
          {cfData.rateLimitedWarning}
        </div>
      )}

      {/* 1. Explicitly separated D1 Verified Humans vs Raw Cloudflare Traffic */}
      <AudienceSummarySection
        periodShortLabel={periodLabel}
        loading={loading}
        d1HumanVisits={Number(activeD1Geo?.humanVisits || 0)}
        d1BotVisits={Number(activeD1Geo?.botVisits || 0)}
        d1Extractions={Number(activeD1Geo?.totalExtractions || 0)}
        cfTotalRequests={activeCfSummary.totalRequests}
        cfUniqueVisitors={activeCfSummary.uniqueVisitors}
        cfPageViews={Number(activeCfSummary.pageViews || 0)}
        cfCacheHitRate={Number(activeCfSummary.cacheHitRate || 0)}
      />

      {/* 2. Compact 2-column Map + Top 10 countries + collapsed "Voir tout" */}
      <AudienceGeoSection
        countries={effectiveGeoCountries}
        periodLabel={periodLabel}
        sourceLabel={geoSourceLabel}
      />

      {/* 3. Traffic sources + Top entry pages (D1) */}
      <AudienceSourcesSection
        categories={activeD1Geo?.sources?.categories || []}
        topReferrerHosts={activeD1Geo?.sources?.topReferrerHosts || []}
        topEntryPages={activeD1Geo?.sources?.topEntryPages || []}
        periodLabel={periodLabel}
      />

      {/* 4. Collapsed Technical Details (CPU, Worker, Subrequests, Bandwidth, HTTP, Domaines) */}
      <AudienceTechnicalDetails
        periodLabel={periodLabel}
        totalRequests={activeCfSummary.totalRequests}
        totalBytes={Number(activeCfSummary.totalBytes || 0)}
        cachedBytes={Number(activeCfSummary.cachedBytes || 0)}
        threats={Number(activeCfSummary.threats || 0)}
        workerMetrics={workerMetrics}
        statusCodes={statusCodes}
        timeseries={activeCfSummary.timeseries || []}
        topHostnames={activeCfSummary.topHostnames || []}
        subrequestHosts={activeCfSummary.subrequestHosts || []}
      />
    </div>
  );
};
