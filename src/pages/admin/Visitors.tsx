import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Globe,
  Users,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  TrendingUp,
  Activity,
  CheckCircle2,
} from './AdminIcons';
import { WorldMapVisualization } from './WorldMapVisualization';
import { computeExtendedVisitorMetrics } from './worldMapLogic';

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
  cacheExpiresAt?: number;
  cacheTtlSeconds?: number;
  sourceScope?: 'zone' | 'zone+account' | 'account' | 'd1-fallback';
  rateLimitedWarning?: string;
  periods?: Record<VisitorsPeriodKey, PeriodVisitorsSummary>;
  errorCode?: string;
  message?: string;
}

const PERIOD_OPTIONS: Array<{
  key: VisitorsPeriodKey;
  shortLabel: string;
  fullLabel: string;
  subtitle: string;
}> = [
  {
    key: '24h',
    shortLabel: '24h',
    fullLabel: 'Dernières 24 heures',
    subtitle: 'Agrégation horaire (Cloudflare 1h)',
  },
  {
    key: '7d',
    shortLabel: '7j',
    fullLabel: '7 derniers jours',
    subtitle: 'Agrégation journalière (7 jours)',
  },
  {
    key: '30d',
    shortLabel: '30j',
    fullLabel: '30 derniers jours',
    subtitle: 'Agrégation mensuelle (30 jours)',
  },
];

function formatNumber(n: number | undefined | null): string {
  return Math.max(0, Number(n) || 0).toLocaleString('fr-FR');
}

function formatCompactNumber(n: number | undefined | null): string {
  const val = Math.max(0, Number(n) || 0);
  if (val >= 1_000_000) {
    return `${(val / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}M`;
  }
  if (val >= 10_000) {
    return `${(val / 1_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}k`;
  }
  return val.toLocaleString('fr-FR');
}

function formatBytes(bytes: number | undefined | null): string {
  const b = Math.max(0, Number(bytes) || 0);
  if (b === 0) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(b) / Math.log(1024))
  );
  const val = b / Math.pow(1024, i);
  return `${val.toLocaleString('fr-FR', {
    maximumFractionDigits: i >= 2 ? 2 : 0,
  })} ${units[i]}`;
}

function formatPercentage(pct: number | undefined | null): string {
  const val = Number(pct) || 0;
  return `${val.toLocaleString('fr-FR', {
    minimumFractionDigits: val > 0 && val < 10 ? 1 : 0,
    maximumFractionDigits: 1,
  })} %`;
}

function resolveSourceScopeLabel(
  scope: VisitorsApiResponse['sourceScope']
): string {
  if (scope === 'zone+account') {
    return 'Cloudflare GraphQL (Zone Edge + Workers)';
  }
  if (scope === 'zone') {
    return 'Cloudflare GraphQL (Zone Edge HTTP)';
  }
  if (scope === 'account') {
    return 'Cloudflare GraphQL (Compte + Workers Adaptive)';
  }
  if (scope === 'd1-fallback') {
    return 'Base D1 VIDNEX (daily_metrics + request_log)';
  }
  return 'Cloudflare GraphQL & D1 Analytics';
}

export const Visitors: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<VisitorsPeriodKey>('24h');
  const [chartMode, setChartMode] = useState<'requests' | 'uniques' | 'invocations'>('requests');
  const [countrySearch, setCountrySearch] = useState('');
  const [data, setData] = useState<VisitorsApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ code?: string; message: string } | null>(
    null
  );

  const fetchVisitors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/visitors', {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
        },
      });

      let json: VisitorsApiResponse | null = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (!res.ok || !json || !json.ok || !json.periods) {
        setError({
          code: json?.errorCode || `HTTP_${res.status}`,
          message:
            json?.message ||
            `Impossible de charger les statistiques Cloudflare (HTTP ${res.status}).`,
        });
        setLoading(false);
        return;
      }

      setData(json);
    } catch {
      setError({
        code: 'NETWORK_ERROR',
        message:
          'Erreur réseau lors de la récupération des statistiques visiteurs Cloudflare.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVisitors();
  }, [fetchVisitors]);

  const activeSummary: PeriodVisitorsSummary = useMemo(() => {
    return (
      data?.periods?.[selectedPeriod] || {
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
        requestsPerSecond: 0,
        countries: [],
      }
    );
  }, [data, selectedPeriod]);

  const activePeriodMeta =
    PERIOD_OPTIONS.find((p) => p.key === selectedPeriod) || PERIOD_OPTIONS[0];

  const filteredCountries = useMemo(() => {
    const list = activeSummary.countries || [];
    const q = countrySearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.countryName.toLowerCase().includes(q) ||
        c.countryCode.toLowerCase().includes(q)
    );
  }, [activeSummary.countries, countrySearch]);

  const timeseries = activeSummary.timeseries || [];
  const maxChartValue = useMemo(() => {
    if (timeseries.length === 0) return 1;
    let max = 1;
    for (const pt of timeseries) {
      const val =
        chartMode === 'uniques'
          ? pt.uniques
          : chartMode === 'invocations'
          ? pt.invocations
          : pt.requests;
      if (val > max) max = val;
    }
    return max;
  }, [timeseries, chartMode]);

  const statusCodes = activeSummary.statusCodes || {
    status2xx: activeSummary.totalRequests,
    status3xx: 0,
    status4xx: 0,
    status5xx: 0,
    statusOther: 0,
    details: [],
  };
  const statusTotal = Math.max(
    1,
    statusCodes.status2xx +
      statusCodes.status3xx +
      statusCodes.status4xx +
      statusCodes.status5xx +
      statusCodes.statusOther
  );

  const workerMetrics = activeSummary.workerMetrics || {
    invocations: 0,
    subrequests: 0,
    errors: 0,
    errorRate: 0,
    cpuTimeP50Ms: 0,
    cpuTimeP99Ms: 0,
    wallTimeP50Ms: 0,
  };

  const subrequestHosts = activeSummary.subrequestHosts || [];
  const topHostnames = activeSummary.topHostnames || [];
  const browsers = activeSummary.browsers || [];
  const extendedMetrics = useMemo(
    () =>
      computeExtendedVisitorMetrics({
        totalRequests: activeSummary.totalRequests,
        uniqueVisitors: activeSummary.uniqueVisitors,
        pageViews: activeSummary.pageViews,
        cachedRequests: activeSummary.cachedRequests,
        totalBytes: activeSummary.totalBytes,
        cachedBytes: activeSummary.cachedBytes,
        threats: activeSummary.threats,
        statusCodes,
        workerMetrics,
        countries: activeSummary.countries,
      }),
    [activeSummary, statusCodes, workerMetrics]
  );

  const sourceLabel = resolveSourceScopeLabel(data?.sourceScope);

  return (
    <div className="space-y-6">
      {/* Header + Sélecteur de période */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-admin-surface border border-admin-border rounded-2xl p-5 shadow-2xs">
        <div>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-admin-accent-bg border border-admin-accent-border flex items-center justify-center text-admin-accent shrink-0 mt-0.5">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-lg font-bold text-admin-text tracking-tight">
                  Visiteurs &amp; Métriques Cloudflare
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60">
                  <CheckCircle2 className="w-3 h-3" />
                  Production · vidnex.space
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-admin-accent-bg text-admin-accent border border-admin-accent-border">
                  Ressource : {sourceLabel}
                </span>
              </div>
              <p className="text-xs text-admin-text-muted font-mono mt-0.5">
                Trafic Edge, taux de cache, invocations Worker, sous-requêtes, codes HTTP et distribution géographique (cache serveur 5 min)
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sélecteur de période 24h / 7j / 30j */}
          <div
            className="inline-flex items-center bg-admin-muted border border-admin-border rounded-xl p-1"
            role="tablist"
            aria-label="Sélecteur de période"
          >
            {PERIOD_OPTIONS.map((opt) => {
              const active = selectedPeriod === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedPeriod(opt.key)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-admin-accent text-white shadow-2xs'
                      : 'text-admin-text-secondary hover:text-admin-text hover:bg-admin-hover'
                  }`}
                >
                  {opt.shortLabel}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={fetchVisitors}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-admin-muted hover:bg-admin-hover text-admin-text border border-admin-border-strong text-xs font-mono font-medium transition-colors disabled:opacity-50 cursor-pointer"
            title="Actualiser les données"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-admin-accent ${loading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* Message d'erreur clair si l'API échoue (aucun crash) */}
      {error && (
        <div
          role="alert"
          className="bg-red-50 dark:bg-rose-950/45 border border-red-300 dark:border-rose-500/40 rounded-2xl p-5 text-red-950 dark:text-rose-100 shadow-2xs"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-rose-500/15 border border-red-300 dark:border-rose-500/30 flex items-center justify-center text-red-700 dark:text-rose-400 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-sm font-bold text-red-950 dark:text-white">
                  Impossible de charger les statistiques Cloudflare
                </h2>
                {error.code && (
                  <span className="px-2 py-0.5 rounded-md bg-red-100 dark:bg-rose-900/60 border border-red-300 dark:border-rose-500/30 text-[11px] font-mono font-semibold text-red-800 dark:text-rose-200">
                    {error.code}
                  </span>
                )}
              </div>
              <p className="text-xs text-red-900 dark:text-rose-200/90 leading-relaxed">
                {error.message}
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={fetchVisitors}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 dark:bg-rose-500/25 dark:hover:bg-rose-500/35 border border-red-800 dark:border-rose-500/40 text-xs font-mono font-semibold text-white transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Réessayer
                </button>
                <span className="text-[11px] font-mono text-red-800 dark:text-rose-300/85">
                  Secrets Pages requis :{' '}
                  <code className="font-mono font-semibold">CF_API_TOKEN</code> (ou{' '}
                  <code className="font-mono font-semibold">CF_API</code>) +{' '}
                  <code className="font-mono font-semibold">CF_ZONE_ID</code> (ou{' '}
                  <code className="font-mono font-semibold">CF_ACCOUNT_ID</code>)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Avertissement non bloquant en cas de quota GraphQL temporaire (affiche le cache ou le repli D1) */}
      {!error && data?.rateLimitedWarning && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/40 rounded-2xl p-4 text-amber-950 dark:text-amber-100 flex items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0" />
            <p className="text-xs font-mono leading-relaxed">{data.rateLimitedWarning}</p>
          </div>
          <button
            type="button"
            onClick={fetchVisitors}
            disabled={loading}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 dark:bg-amber-500/25 dark:hover:bg-amber-500/35 border border-amber-800 dark:border-amber-500/40 text-xs font-mono font-semibold text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Réessayer
          </button>
        </div>
      )}

      {/* Aperçu rapide par période (24h, 7j, 30j) */}
      {data?.periods && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PERIOD_OPTIONS.map((opt) => {
            const summary = data.periods?.[opt.key];
            const isSelected = selectedPeriod === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSelectedPeriod(opt.key)}
                className={`text-left rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  isSelected
                    ? 'bg-admin-surface border-admin-accent ring-1 ring-admin-accent/40'
                    : 'bg-admin-surface/80 border-admin-border hover:border-admin-border-strong'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-display font-bold text-admin-text">
                    {opt.fullLabel}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold ${
                      isSelected
                        ? 'bg-admin-accent text-white'
                        : 'bg-admin-muted text-admin-text-secondary border border-admin-border'
                    }`}
                  >
                    {opt.shortLabel}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-[11px] font-mono text-admin-text-muted">Visites</div>
                    <div className="text-base font-bold text-admin-text font-mono mt-0.5 tabular-nums">
                      {formatCompactNumber(summary?.totalRequests ?? 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-mono text-admin-text-muted">Uniques</div>
                    <div className="text-base font-bold text-emerald-800 dark:text-emerald-400 font-mono mt-0.5 tabular-nums">
                      {formatCompactNumber(summary?.uniqueVisitors ?? 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-mono text-admin-text-muted">Cache Hit</div>
                    <div className="text-base font-bold text-sky-800 dark:text-sky-400 font-mono mt-0.5 tabular-nums">
                      {formatPercentage(summary?.cacheHitRate ?? 0)}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Bandeau des 6 cartes de métriques Cloudflare (comme sur Workers & Pages > vidnex > Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* 1. Asset Requests / Visites */}
        <div className="bg-admin-surface border border-admin-border rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-admin-text-secondary mb-1.5">
            <span>Visites (Requêtes)</span>
            <BarChart3 className="w-3.5 h-3.5 text-admin-accent" />
          </div>
          <div className="text-xl font-bold text-admin-text font-mono tabular-nums">
            {loading && !data ? '—' : formatNumber(activeSummary.totalRequests)}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-admin-text-muted">
            <span>Pages : {formatCompactNumber(activeSummary.pageViews)}</span>
            <span className="text-admin-accent font-semibold">
              {activeSummary.requestsPerSecond ?? 0} req/s
            </span>
          </div>
        </div>

        {/* 2. Visiteurs uniques */}
        <div className="bg-admin-surface border border-admin-border rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-admin-text-secondary mb-1.5">
            <span>Visiteurs uniques</span>
            <Users className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-800 dark:text-emerald-400 font-mono tabular-nums">
            {loading && !data ? '—' : formatNumber(activeSummary.uniqueVisitors)}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-admin-text-muted">
            <span>{activeSummary.countries.length} pays actifs</span>
            <span className="text-emerald-800 dark:text-emerald-300 font-semibold">
              {activeSummary.uniqueVisitors > 0
                ? `${(
                    activeSummary.totalRequests / activeSummary.uniqueVisitors
                  ).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} req/vis.`
                : '0 req/vis.'}
            </span>
          </div>
        </div>

        {/* 3. Asset Cache Hit Rate */}
        <div className="bg-admin-surface border border-admin-border rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-admin-text-secondary mb-1.5">
            <span>Taux de cache Edge</span>
            <TrendingUp className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400" />
          </div>
          <div className="text-xl font-bold text-sky-800 dark:text-sky-400 font-mono tabular-nums">
            {loading && !data ? '—' : formatPercentage(activeSummary.cacheHitRate)}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-admin-text-muted">
            <span>Cache : {formatCompactNumber(activeSummary.cachedRequests)}</span>
            <span className="text-sky-800 dark:text-sky-300 font-semibold">
              {formatBytes(activeSummary.totalBytes)}
            </span>
          </div>
        </div>

        {/* 4. Invocations Worker / Pages Functions */}
        <div className="bg-admin-surface border border-admin-border rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-admin-text-secondary mb-1.5">
            <span>Invocations Worker</span>
            <Activity className="w-3.5 h-3.5 text-admin-accent" />
          </div>
          <div className="text-xl font-bold text-admin-text font-mono tabular-nums">
            {loading && !data ? '—' : formatNumber(workerMetrics.invocations)}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-admin-text-muted">
            <span>Exécutions API</span>
            <span className="text-admin-accent font-semibold">100% trafic</span>
          </div>
        </div>

        {/* 5. Subrequests (Sous-requêtes sortantes) */}
        <div className="bg-admin-surface border border-admin-border rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-admin-text-secondary mb-1.5">
            <span>Sous-requêtes</span>
            <Globe className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-800 dark:text-amber-300 font-mono tabular-nums">
            {loading && !data ? '—' : formatNumber(workerMetrics.subrequests)}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-admin-text-muted">
            <span>Moteurs sociaux</span>
            <span className="text-amber-800 dark:text-amber-300 font-semibold">
              {subrequestHosts.length} hôtes
            </span>
          </div>
        </div>

        {/* 6. Errors & Median CPU Time */}
        <div className="bg-admin-surface border border-admin-border rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-admin-text-secondary mb-1.5">
            <span>Erreurs &amp; CPU médian</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={`text-xl font-bold font-mono tabular-nums ${
                workerMetrics.errors > 0
                  ? 'text-red-700 dark:text-rose-400'
                  : 'text-emerald-800 dark:text-emerald-400'
              }`}
            >
              {loading && !data ? '—' : formatNumber(workerMetrics.errors)}
            </span>
            <span className="text-xs font-mono text-admin-text-secondary font-semibold">
              CPU {workerMetrics.cpuTimeP50Ms} ms
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-admin-text-muted">
            <span>Erreur : {formatPercentage(workerMetrics.errorRate)}</span>
            <span className="text-admin-text-secondary">
              Menaces : {formatNumber(activeSummary.threats)}
            </span>
          </div>
        </div>
      </div>

      {/* 4 Cartes de Métriques Avancées Edge, Engagement & Concentration Géographique */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-admin-surface border border-admin-border rounded-2xl p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-admin-text-secondary">
            <span>Disponibilité HTTP &amp; Origin</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold font-mono text-emerald-800 dark:text-emerald-400 tabular-nums">
              {formatPercentage(extendedMetrics.availabilityRatePct)}
            </span>
            <span className="text-xs font-mono text-admin-text-secondary tabular-nums">
              Origin : {formatCompactNumber(extendedMetrics.originRequests)} req (
              {extendedMetrics.originRatePct}%)
            </span>
          </div>
          <div className="text-[11px] font-mono text-admin-text-muted">
            Disponibilité Edge sans erreur 5xx
          </div>
        </div>

        <div className="bg-admin-surface border border-admin-border rounded-2xl p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-admin-text-secondary">
            <span>Bande passante économisée</span>
            <TrendingUp className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold font-mono text-sky-800 dark:text-sky-400 tabular-nums">
              {formatBytes(extendedMetrics.savedBytes)}
            </span>
            <span className="text-xs font-mono text-admin-text-secondary tabular-nums">
              {formatBytes(extendedMetrics.avgBytesPerRequest)} / req
            </span>
          </div>
          <div className="text-[11px] font-mono text-admin-text-muted">
            Trafic Origin : {formatBytes(extendedMetrics.originBytes)}
          </div>
        </div>

        <div className="bg-admin-surface border border-admin-border rounded-2xl p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-admin-text-secondary">
            <span>Intensité par Visiteur Unique</span>
            <Users className="w-3.5 h-3.5 text-admin-accent" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold font-mono text-admin-text tabular-nums">
              {extendedMetrics.requestsPerUniqueVisitor} req/vis.
            </span>
            <span className="text-xs font-mono text-admin-accent font-semibold tabular-nums">
              {extendedMetrics.pageViewsPerUniqueVisitor} pages/vis.
            </span>
          </div>
          <div className="text-[11px] font-mono text-admin-text-muted">
            Ratio sous-requêtes/invocation : {extendedMetrics.subrequestsPerInvocation}x
          </div>
        </div>

        <div className="bg-admin-surface border border-admin-border rounded-2xl p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-admin-text-secondary">
            <span>Concentration Géo &amp; CPU P99</span>
            <Globe className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold font-mono text-amber-800 dark:text-amber-300 tabular-nums">
              Top 3 : {formatPercentage(extendedMetrics.top3ConcentrationPct)}
            </span>
            <span className="text-xs font-mono text-admin-text-secondary tabular-nums">
              P99 : {workerMetrics.cpuTimeP99Ms} ms
            </span>
          </div>
          <div className="text-[11px] font-mono text-admin-text-muted">
            Pays #1 : {formatPercentage(extendedMetrics.topCountrySharePct)} · Menaces :{' '}
            {extendedMetrics.threatRatePct}%
          </div>
        </div>
      </div>

      {/* Barre d'état du déploiement actif */}
      <div className="bg-admin-surface border border-admin-border rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <div className="text-[11px] font-mono text-admin-text-muted">Période analysée</div>
            <div className="text-xs font-display font-bold text-admin-text mt-0.5">
              {activePeriodMeta.fullLabel}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-mono text-admin-text-muted">Trafic routé</div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-20 h-1.5 rounded-full bg-admin-muted border border-admin-border overflow-hidden">
                <div className="h-full bg-admin-accent rounded-full w-full" />
              </div>
              <span className="text-xs font-mono font-bold text-admin-text">100%</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] font-mono text-admin-text-muted">
              Bande passante (Totale / Cache)
            </div>
            <div className="text-xs font-mono text-admin-text font-semibold mt-0.5">
              {formatBytes(activeSummary.totalBytes)}{' '}
              <span className="text-sky-800 dark:text-sky-400">
                ({formatBytes(activeSummary.cachedBytes)} en cache ·{' '}
                {formatPercentage(activeSummary.bandwidthCacheRate)})
              </span>
            </div>
          </div>
          <div>
            <div className="text-[11px] font-mono text-admin-text-muted">
              Temps CPU / Wall Time médian
            </div>
            <div className="text-xs font-mono text-admin-text font-semibold mt-0.5">
              {workerMetrics.cpuTimeP50Ms} ms CPU · {workerMetrics.wallTimeP50Ms} ms Wall
            </div>
          </div>
        </div>

        {data?.fetchedAt && (
          <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-admin-text-muted">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            <span>
              {data.cached ? 'Cache serveur (5 min)' : 'Données fraîches Cloudflare'} ·{' '}
              {new Date(data.fetchedAt).toLocaleTimeString('fr-FR')}
            </span>
          </div>
        )}
      </div>

      {/* Graphique d'évolution temporelle + Répartition par Code HTTP & Domaines */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Colonne gauche (7 cols) : Courbe / Histogramme chronologique (Invocations / Visites) */}
        <div className="lg:col-span-7 bg-admin-surface border border-admin-border rounded-2xl p-5 flex flex-col justify-between shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-sm font-bold text-admin-text">
                Évolution du trafic ({activePeriodMeta.shortLabel})
              </h2>
              <p className="text-xs font-mono text-admin-text-muted mt-0.5">
                {activePeriodMeta.subtitle} — Survolez une barre pour voir le détail
              </p>
            </div>
            <div className="inline-flex items-center bg-admin-muted border border-admin-border rounded-xl p-1">
              {(
                [
                  { id: 'requests', label: 'Visites & Cache' },
                  { id: 'uniques', label: 'Uniques' },
                  { id: 'invocations', label: 'Invocations' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setChartMode(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-colors cursor-pointer ${
                    chartMode === tab.id
                      ? 'bg-admin-accent text-white shadow-2xs'
                      : 'text-admin-text-secondary hover:text-admin-text'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {timeseries.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs font-mono text-admin-text-muted border border-dashed border-admin-border rounded-xl">
              {loading
                ? 'Chargement de l’historique temporel…'
                : 'Série temporelle agrégée sur la période sélectionnée'}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="h-48 flex items-end gap-1.5 pt-6 px-2 border-b border-admin-border bg-admin-muted/50 rounded-t-xl">
                {timeseries.map((pt, idx) => {
                  const primaryVal =
                    chartMode === 'uniques'
                      ? pt.uniques
                      : chartMode === 'invocations'
                      ? pt.invocations
                      : pt.requests;
                  const heightPct = Math.max(
                    4,
                    Math.min(100, Math.round((primaryVal / maxChartValue) * 100))
                  );
                  const cachePctOfBar =
                    chartMode === 'requests' && pt.requests > 0
                      ? Math.min(
                          100,
                          Math.round((pt.cachedRequests / pt.requests) * 100)
                        )
                      : 0;

                  return (
                    <div
                      key={`${pt.timestamp}-${idx}`}
                      className="group relative flex-1 h-full flex flex-col justify-end items-center"
                    >
                      {/* Tooltip au survol */}
                      <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-20 bg-[#140e0a] border border-admin-border-strong rounded-xl px-2.5 py-2 text-[11px] font-mono text-[#fffaf5] shadow-xl whitespace-nowrap">
                        <div className="font-bold text-orange-300 mb-0.5">
                          {pt.label || pt.timestamp}
                        </div>
                        <div>Visites : {formatNumber(pt.requests)}</div>
                        <div className="text-sky-300">
                          En cache : {formatNumber(pt.cachedRequests)}
                        </div>
                        <div className="text-emerald-300">
                          Uniques : {formatNumber(pt.uniques)}
                        </div>
                        <div className="text-amber-300">
                          Invocations : {formatNumber(pt.invocations)}
                        </div>
                      </div>

                      {/* Barre */}
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full max-w-[24px] rounded-t-md overflow-hidden transition-all flex flex-col justify-end ${
                          chartMode === 'uniques'
                            ? 'bg-emerald-600 dark:bg-emerald-500/85 group-hover:bg-emerald-500'
                            : chartMode === 'invocations'
                            ? 'bg-amber-600 dark:bg-amber-500/85 group-hover:bg-amber-500'
                            : 'bg-[#c2410c] dark:bg-orange-500/85 group-hover:bg-orange-500'
                        }`}
                      >
                        {chartMode === 'requests' && cachePctOfBar > 0 && (
                          <div
                            style={{ height: `${cachePctOfBar}%` }}
                            className="w-full bg-sky-500 dark:bg-sky-400/90"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Axe X (étiquettes début / milieu / fin) */}
              <div className="flex items-center justify-between text-[11px] font-mono text-admin-text-muted px-1">
                <span>{timeseries[0]?.label || ''}</span>
                {timeseries.length > 2 && (
                  <span>
                    {timeseries[Math.floor(timeseries.length / 2)]?.label || ''}
                  </span>
                )}
                <span>{timeseries[timeseries.length - 1]?.label || ''}</span>
              </div>

              {/* Légende */}
              <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-admin-text-secondary pt-1">
                {chartMode === 'requests' && (
                  <>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#c2410c] dark:bg-orange-500" />
                      Requêtes dynamiques (Origin / Worker)
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-sky-500 dark:bg-sky-400" />
                      Servies par le cache Cloudflare
                    </span>
                  </>
                )}
                {chartMode === 'uniques' && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 dark:bg-emerald-500" />
                    Visiteurs uniques par tranche
                  </span>
                )}
                {chartMode === 'invocations' && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-600 dark:bg-amber-500" />
                    Invocations Pages Functions / Worker
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Colonne droite (5 cols) : Codes de statut HTTP (2xx, 3xx, 4xx, 5xx) + Top Hostnames */}
        <div className="lg:col-span-5 space-y-5">
          {/* Asset requests by status code */}
          <div className="bg-admin-surface border border-admin-border rounded-2xl p-5 shadow-2xs">
            <h2 className="font-display text-sm font-bold text-admin-text mb-1">
              Requêtes par code de statut HTTP
            </h2>
            <p className="text-xs font-mono text-admin-text-muted mb-4">
              Répartition Edge (`2xx`, `3xx`, `4xx`, `5xx`) sur {activePeriodMeta.shortLabel}
            </p>

            {/* Légende chiffrée */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono mb-3.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 dark:bg-emerald-500" />
                <span className="text-admin-text-muted">2xx</span>
                <span className="font-bold text-admin-text tabular-nums">
                  {formatNumber(statusCodes.status2xx)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 dark:bg-sky-400" />
                <span className="text-admin-text-muted">3xx</span>
                <span className="font-bold text-admin-text tabular-nums">
                  {formatNumber(statusCodes.status3xx)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-admin-text-muted">4xx</span>
                <span className="font-bold text-admin-text tabular-nums">
                  {formatNumber(statusCodes.status4xx)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 dark:bg-rose-500" />
                <span className="text-admin-text-muted">5xx</span>
                <span className="font-bold text-admin-text tabular-nums">
                  {formatNumber(statusCodes.status5xx)}
                </span>
              </div>
            </div>

            {/* Barre segmentée */}
            <div className="h-3 w-full rounded-full bg-admin-muted border border-admin-border overflow-hidden flex">
              {statusCodes.status2xx > 0 && (
                <div
                  style={{
                    width: `${(statusCodes.status2xx / statusTotal) * 100}%`,
                  }}
                  className="bg-emerald-600 dark:bg-emerald-500 h-full"
                  title={`2xx: ${formatNumber(statusCodes.status2xx)}`}
                />
              )}
              {statusCodes.status3xx > 0 && (
                <div
                  style={{
                    width: `${(statusCodes.status3xx / statusTotal) * 100}%`,
                  }}
                  className="bg-sky-500 dark:bg-sky-400 h-full"
                  title={`3xx: ${formatNumber(statusCodes.status3xx)}`}
                />
              )}
              {statusCodes.status4xx > 0 && (
                <div
                  style={{
                    width: `${(statusCodes.status4xx / statusTotal) * 100}%`,
                  }}
                  className="bg-amber-500 h-full"
                  title={`4xx: ${formatNumber(statusCodes.status4xx)}`}
                />
              )}
              {statusCodes.status5xx > 0 && (
                <div
                  style={{
                    width: `${(statusCodes.status5xx / statusTotal) * 100}%`,
                  }}
                  className="bg-red-600 dark:bg-rose-500 h-full"
                  title={`5xx: ${formatNumber(statusCodes.status5xx)}`}
                />
              )}
            </div>

            {/* Codes HTTP détaillés */}
            {statusCodes.details && statusCodes.details.length > 0 && (
              <div className="mt-4 pt-3 border-t border-admin-border flex flex-wrap gap-2">
                {statusCodes.details.slice(0, 6).map((st) => {
                  const badgeColor =
                    st.code >= 500
                      ? 'bg-red-50 dark:bg-rose-500/15 text-red-900 dark:text-rose-300 border-red-300 dark:border-rose-500/30'
                      : st.code >= 400
                      ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-500/30'
                      : st.code >= 300
                      ? 'bg-sky-50 dark:bg-sky-500/15 text-sky-900 dark:text-sky-300 border-sky-300 dark:border-sky-500/30'
                      : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30';
                  return (
                    <span
                      key={st.code}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono ${badgeColor}`}
                    >
                      <span className="font-bold">HTTP {st.code}</span>
                      <span className="opacity-85">
                        {formatCompactNumber(st.requests)} ({st.percentage}%)
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top asset hostnames & Navigateurs */}
          <div className="bg-admin-surface border border-admin-border rounded-2xl p-5 shadow-2xs">
            <h2 className="font-display text-sm font-bold text-admin-text mb-3">
              Domaines actifs &amp; Navigateurs
            </h2>
            <div className="space-y-2.5">
              {topHostnames.map((h) => (
                <div key={h.hostname} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-semibold text-admin-text">{h.hostname}</span>
                    <span className="text-admin-text-secondary tabular-nums">
                      {formatCompactNumber(h.requests)} ({h.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-admin-muted border border-admin-border overflow-hidden">
                    <div
                      className="h-full bg-admin-accent rounded-full"
                      style={{ width: `${Math.min(100, h.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {browsers.length > 0 && (
              <div className="mt-4 pt-3 border-t border-admin-border">
                <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-admin-text-muted mb-2">
                  Top Navigateurs (Pages vues)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {browsers.slice(0, 5).map((br) => (
                    <span
                      key={br.browser}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-admin-muted border border-admin-border text-xs font-mono text-admin-text-secondary"
                    >
                      <span className="font-semibold text-admin-text">{br.browser}</span>
                      <span className="text-[11px] text-admin-accent font-bold">
                        {br.percentage}%
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sous-requêtes sortantes par hôte & Durée moyenne */}
      {subrequestHosts.length > 0 && (
        <div className="bg-admin-surface border border-admin-border rounded-2xl overflow-hidden shadow-2xs">
          <div className="px-5 py-4 border-b border-admin-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-bold text-admin-text">
                Sous-requêtes sortantes par hôte (Subrequests)
              </h2>
              <p className="text-xs font-mono text-admin-text-muted mt-0.5">
                Appels sortants des moteurs d’extraction vers les plateformes sociales et CDN médias ({activePeriodMeta.shortLabel})
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-admin-accent">
              {subrequestHosts.length} hôtes actifs
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-admin-border bg-admin-muted text-[11px] font-mono font-semibold uppercase tracking-wider text-admin-text-secondary">
                  <th className="py-3 pl-5 pr-3">Hôte (Host)</th>
                  <th className="py-3 px-3">Plateforme</th>
                  <th className="py-3 px-3">Requêtes par statut</th>
                  <th className="py-3 pl-3 pr-5 text-right">Durée moyenne (Duration)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border/70 text-sm">
                {subrequestHosts.map((sh) => (
                  <tr
                    key={sh.host}
                    className="hover:bg-admin-muted/60 transition-colors"
                  >
                    <td className="py-3 pl-5 pr-3 font-mono text-xs font-semibold text-admin-accent underline decoration-admin-accent/30">
                      {sh.host}
                    </td>
                    <td className="py-3 px-3 text-xs font-mono text-admin-text-secondary">
                      {sh.platform}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                        {sh.status2xx > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 text-[11px] font-bold">
                              2xx
                            </span>
                            <span className="text-admin-text font-semibold">
                              {formatNumber(sh.status2xx)}
                            </span>
                          </span>
                        )}
                        {sh.status3xx > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <span className="px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-500/20 text-sky-900 dark:text-sky-300 border border-sky-300 dark:border-sky-500/30 text-[11px] font-bold">
                              3xx
                            </span>
                            <span className="text-admin-text font-semibold">
                              {formatNumber(sh.status3xx)}
                            </span>
                          </span>
                        )}
                        {sh.status4xx > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 text-[11px] font-bold">
                              4xx
                            </span>
                            <span className="text-admin-text font-semibold">
                              {formatNumber(sh.status4xx)}
                            </span>
                          </span>
                        )}
                        {sh.status5xx > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <span className="px-1.5 py-0.5 rounded bg-red-50 dark:bg-rose-500/20 text-red-900 dark:text-rose-300 border border-red-300 dark:border-rose-500/30 text-[11px] font-bold">
                              5xx
                            </span>
                            <span className="text-admin-text font-semibold">
                              {formatNumber(sh.status5xx)}
                            </span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pl-3 pr-5 text-right font-mono text-xs font-bold text-admin-text tabular-nums">
                      {sh.avgDurationMs} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Carte Mondiale Interactive & Répartition par Continent */}
      <WorldMapVisualization
        countries={activeSummary.countries}
        periodLabel={activePeriodMeta.shortLabel}
        variant="admin"
        sourceLabel={sourceLabel}
        onSelectCountry={(iso) =>
          setCountrySearch((prev) => (prev.toUpperCase() === iso ? '' : iso))
        }
      />

      {/* Tableau trié par pays : Drapeau + Pays + Visites + Bande passante + % */}
      <div className="bg-admin-surface border border-admin-border rounded-2xl overflow-hidden shadow-2xs">
        <div className="px-5 py-4 border-b border-admin-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-bold text-admin-text">
              Distribution géographique par pays ({activePeriodMeta.shortLabel})
            </h2>
            <p className="text-xs font-mono text-admin-text-muted mt-0.5">
              Trié par nombre de visites décroissant — Drapeau, pays, visites, bande passante et part du trafic (%)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="search"
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
              placeholder="Filtrer un pays (ex: France, FR, Maroc)…"
              className="w-full sm:w-64 px-3 py-1.5 rounded-xl bg-admin-muted border border-admin-border-strong text-xs font-mono text-admin-text placeholder-admin-text-muted focus:outline-none focus:border-admin-accent"
            />
          </div>
        </div>

        {loading && !data ? (
          <div className="p-10 text-center space-y-3">
            <RefreshCw className="w-6 h-6 text-admin-accent animate-spin mx-auto" />
            <p className="text-xs font-mono text-admin-text-muted">
              Interrogation de l’API GraphQL Analytics de Cloudflare…
            </p>
          </div>
        ) : filteredCountries.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-mono text-admin-text-muted">
              {error
                ? 'Aucune donnée à afficher en raison de l’erreur ci-dessus.'
                : countrySearch
                ? `Aucun pays ne correspond à « ${countrySearch} ».`
                : 'Aucune visite enregistrée pour cette période.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-admin-border bg-admin-muted text-[11px] font-mono font-semibold uppercase tracking-wider text-admin-text-secondary">
                  <th className="py-3 pl-5 pr-2 w-12">#</th>
                  <th className="py-3 px-3">Pays</th>
                  <th className="py-3 px-4 text-right">Visites</th>
                  <th className="py-3 px-4 text-right hidden md:table-cell">
                    Bande passante
                  </th>
                  <th className="py-3 pl-4 pr-5 text-right w-52">Part (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border/70 text-sm">
                {filteredCountries.map((row, index) => {
                  const barWidth = Math.max(
                    2,
                    Math.min(100, Math.round(row.percentage))
                  );
                  return (
                    <tr
                      key={`${row.countryCode}-${index}`}
                      className="hover:bg-admin-muted/60 transition-colors"
                    >
                      <td className="py-3 pl-5 pr-2 text-xs font-mono text-admin-text-muted tabular-nums">
                        {index + 1}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="text-xl leading-none select-none"
                            role="img"
                            aria-label={row.countryName}
                          >
                            {row.flag}
                          </span>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-display font-semibold text-admin-text truncate">
                              {row.countryName}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-admin-muted border border-admin-border text-[10px] font-mono text-admin-text-secondary uppercase">
                              {row.countryCode}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-admin-text tabular-nums">
                        {formatNumber(row.requests)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-admin-text-secondary hidden md:table-cell tabular-nums">
                        {formatBytes(row.bytes)}
                      </td>
                      <td className="py-3 pl-4 pr-5">
                        <div className="flex items-center justify-end gap-3">
                          <div className="w-24 h-1.5 rounded-full bg-admin-muted border border-admin-border overflow-hidden hidden sm:block">
                            <div
                              className="h-full bg-admin-accent rounded-full"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs font-bold text-admin-accent w-14 text-right tabular-nums">
                            {formatPercentage(row.percentage)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
