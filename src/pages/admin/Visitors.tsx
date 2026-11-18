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

  return (
    <div className="space-y-6">
      {/* Header + Sélecteur de période */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight">
                  Visiteurs &amp; Métriques Cloudflare
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" />
                  Production · vidnex.space
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Trafic Edge, taux de cache, invocations Worker, sous-requêtes, codes HTTP et distribution géographique (cache serveur 5 min)
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sélecteur de période 24h / 7j / 30j */}
          <div
            className="inline-flex items-center bg-slate-950/90 border border-slate-800 rounded-xl p-1"
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
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
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
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium transition-colors disabled:opacity-50"
            title="Actualiser les données"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* Message d'erreur clair si l'API échoue (aucun crash) */}
      {error && (
        <div
          role="alert"
          className="bg-rose-950/40 border border-rose-500/40 rounded-2xl p-5 text-rose-200"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-white">
                  Impossible de charger les statistiques Cloudflare
                </h2>
                {error.code && (
                  <span className="px-2 py-0.5 rounded-md bg-rose-900/60 border border-rose-500/30 text-[11px] font-mono text-rose-300">
                    {error.code}
                  </span>
                )}
              </div>
              <p className="text-xs text-rose-200/90 leading-relaxed">
                {error.message}
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={fetchVisitors}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-xs font-semibold text-white transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Réessayer
                </button>
                <span className="text-[11px] text-rose-300/80">
                  Secrets Pages requis :{' '}
                  <code className="font-mono">CF_API_TOKEN</code> (ou{' '}
                  <code className="font-mono">CF_API</code>) +{' '}
                  <code className="font-mono">CF_ZONE_ID</code> (ou{' '}
                  <code className="font-mono">CF_ACCOUNT_ID</code>)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Avertissement non bloquant en cas de quota GraphQL temporaire (affiche le cache ou le repli D1) */}
      {!error && data?.rateLimitedWarning && (
        <div className="bg-amber-950/35 border border-amber-500/40 rounded-2xl p-4 text-amber-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <p className="text-xs leading-relaxed">{data.rateLimitedWarning}</p>
          </div>
          <button
            type="button"
            onClick={fetchVisitors}
            disabled={loading}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-semibold text-white transition-colors"
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
                className={`text-left rounded-2xl p-4 border transition-all ${
                  isSelected
                    ? 'bg-indigo-950/30 border-indigo-500/50 ring-1 ring-indigo-500/30'
                    : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-300">
                    {opt.fullLabel}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {opt.shortLabel}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-[11px] text-slate-400">Visites</div>
                    <div className="text-base font-bold text-white font-mono mt-0.5">
                      {formatCompactNumber(summary?.totalRequests ?? 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Uniques</div>
                    <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                      {formatCompactNumber(summary?.uniqueVisitors ?? 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Cache Hit</div>
                    <div className="text-base font-bold text-sky-400 font-mono mt-0.5">
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
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Visites (Requêtes)</span>
            <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {loading && !data ? '—' : formatNumber(activeSummary.totalRequests)}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>Pages vues : {formatCompactNumber(activeSummary.pageViews)}</span>
            <span className="font-mono text-indigo-300">
              {activeSummary.requestsPerSecond ?? 0} req/s
            </span>
          </div>
        </div>

        {/* 2. Visiteurs uniques */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Visiteurs uniques</span>
            <Users className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400 font-mono">
            {loading && !data ? '—' : formatNumber(activeSummary.uniqueVisitors)}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>{activeSummary.countries.length} pays actifs</span>
            <span className="font-mono text-emerald-300">
              {activeSummary.uniqueVisitors > 0
                ? `${(
                    activeSummary.totalRequests / activeSummary.uniqueVisitors
                  ).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} req/vis.`
                : '0 req/vis.'}
            </span>
          </div>
        </div>

        {/* 3. Asset Cache Hit Rate */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Taux de cache Edge</span>
            <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-xl font-bold text-sky-400 font-mono">
            {loading && !data ? '—' : formatPercentage(activeSummary.cacheHitRate)}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>En cache : {formatCompactNumber(activeSummary.cachedRequests)}</span>
            <span className="font-mono text-sky-300">
              {formatBytes(activeSummary.totalBytes)}
            </span>
          </div>
        </div>

        {/* 4. Invocations Worker / Pages Functions */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Invocations Worker</span>
            <Activity className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {loading && !data ? '—' : formatNumber(workerMetrics.invocations)}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>Exécutions API</span>
            <span className="font-mono text-violet-300">100% trafic</span>
          </div>
        </div>

        {/* 5. Subrequests (Sous-requêtes sortantes) */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Sous-requêtes</span>
            <Globe className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-300 font-mono">
            {loading && !data ? '—' : formatNumber(workerMetrics.subrequests)}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>Moteurs sociaux</span>
            <span className="font-mono text-amber-300">
              {subrequestHosts.length} hôtes
            </span>
          </div>
        </div>

        {/* 6. Errors & Median CPU Time */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Erreurs &amp; CPU médian</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={`text-xl font-bold font-mono ${
                workerMetrics.errors > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {loading && !data ? '—' : formatNumber(workerMetrics.errors)}
            </span>
            <span className="text-xs font-mono text-slate-300">
              CPU {workerMetrics.cpuTimeP50Ms} ms
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>Taux d’erreur : {formatPercentage(workerMetrics.errorRate)}</span>
            <span className="font-mono text-slate-300">
              Menaces : {formatNumber(activeSummary.threats)}
            </span>
          </div>
        </div>
      </div>

      {/* Barre d'état du déploiement actif (Active deployment summary - comme dans la capture 2) */}
      <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <div className="text-[11px] text-slate-400">Période analysée</div>
            <div className="text-xs font-semibold text-white mt-0.5">
              {activePeriodMeta.fullLabel}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Trafic routé</div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-20 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-sky-500 rounded-full w-full" />
              </div>
              <span className="text-xs font-mono font-semibold text-white">100%</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Bande passante (Totale / Cache)</div>
            <div className="text-xs font-mono text-white mt-0.5">
              {formatBytes(activeSummary.totalBytes)}{' '}
              <span className="text-sky-400">
                ({formatBytes(activeSummary.cachedBytes)} en cache ·{' '}
                {formatPercentage(activeSummary.bandwidthCacheRate)})
              </span>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Temps CPU / Wall Time médian</div>
            <div className="text-xs font-mono text-white mt-0.5">
              {workerMetrics.cpuTimeP50Ms} ms CPU · {workerMetrics.wallTimeP50Ms} ms Wall
            </div>
          </div>
        </div>

        {data?.fetchedAt && (
          <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
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
        <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-white">
                Évolution du trafic ({activePeriodMeta.shortLabel})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {activePeriodMeta.subtitle} — Survolez une barre pour voir le détail
              </p>
            </div>
            <div className="inline-flex items-center bg-slate-950/90 border border-slate-800 rounded-xl p-1">
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
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    chartMode === tab.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {timeseries.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">
              {loading
                ? 'Chargement de l’historique temporel…'
                : ' Série temporelle agrégée sur la période sélectionnée'}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="h-48 flex items-end gap-1.5 pt-6 px-2 border-b border-slate-800/80">
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
                      <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-20 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-[11px] text-slate-200 shadow-xl whitespace-nowrap">
                        <div className="font-bold text-white mb-0.5">
                          {pt.label || pt.timestamp}
                        </div>
                        <div>Visites : {formatNumber(pt.requests)}</div>
                        <div className="text-sky-400">
                          En cache : {formatNumber(pt.cachedRequests)}
                        </div>
                        <div className="text-emerald-400">
                          Uniques : {formatNumber(pt.uniques)}
                        </div>
                        <div className="text-violet-300">
                          Invocations : {formatNumber(pt.invocations)}
                        </div>
                      </div>

                      {/* Barre */}
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full max-w-[24px] rounded-t-md overflow-hidden transition-all flex flex-col justify-end ${
                          chartMode === 'uniques'
                            ? 'bg-emerald-500/80 group-hover:bg-emerald-400'
                            : chartMode === 'invocations'
                            ? 'bg-pink-500/80 group-hover:bg-pink-400'
                            : 'bg-indigo-500/85 group-hover:bg-indigo-400'
                        }`}
                      >
                        {chartMode === 'requests' && cachePctOfBar > 0 && (
                          <div
                            style={{ height: `${cachePctOfBar}%` }}
                            className="w-full bg-sky-400/90"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Axe X (étiquettes début / milieu / fin) */}
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
                <span>{timeseries[0]?.label || ''}</span>
                {timeseries.length > 2 && (
                  <span>
                    {timeseries[Math.floor(timeseries.length / 2)]?.label || ''}
                  </span>
                )}
                <span>{timeseries[timeseries.length - 1]?.label || ''}</span>
              </div>

              {/* Légende */}
              <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
                {chartMode === 'requests' && (
                  <>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
                      Requêtes dynamiques (Origin / Worker)
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-sky-400" />
                      Servies par le cache Cloudflare
                    </span>
                  </>
                )}
                {chartMode === 'uniques' && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                    Visiteurs uniques par tranche
                  </span>
                )}
                {chartMode === 'invocations' && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-pink-500" />
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
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white mb-1">
              Requêtes par code de statut HTTP
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Répartition Edge (`2xx`, `3xx`, `4xx`, `5xx`) sur {activePeriodMeta.shortLabel}
            </p>

            {/* Légende chiffrée comme dans la capture 2 */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs mb-3.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-400">2xx</span>
                <span className="font-mono font-bold text-white">
                  {formatNumber(statusCodes.status2xx)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                <span className="text-slate-400">3xx</span>
                <span className="font-mono font-bold text-white">
                  {formatNumber(statusCodes.status3xx)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-slate-400">4xx</span>
                <span className="font-mono font-bold text-white">
                  {formatNumber(statusCodes.status4xx)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-slate-400">5xx</span>
                <span className="font-mono font-bold text-white">
                  {formatNumber(statusCodes.status5xx)}
                </span>
              </div>
            </div>

            {/* Barre segmentée */}
            <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden flex">
              {statusCodes.status2xx > 0 && (
                <div
                  style={{
                    width: `${(statusCodes.status2xx / statusTotal) * 100}%`,
                  }}
                  className="bg-emerald-500 h-full"
                  title={`2xx: ${formatNumber(statusCodes.status2xx)}`}
                />
              )}
              {statusCodes.status3xx > 0 && (
                <div
                  style={{
                    width: `${(statusCodes.status3xx / statusTotal) * 100}%`,
                  }}
                  className="bg-sky-400 h-full"
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
                  className="bg-rose-500 h-full"
                  title={`5xx: ${formatNumber(statusCodes.status5xx)}`}
                />
              )}
            </div>

            {/* Codes HTTP détaillés (ex: 200, 304, 301, 404...) */}
            {statusCodes.details && statusCodes.details.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-800/70 flex flex-wrap gap-2">
                {statusCodes.details.slice(0, 6).map((st) => {
                  const badgeColor =
                    st.code >= 500
                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      : st.code >= 400
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : st.code >= 300
                      ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
                  return (
                    <span
                      key={st.code}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono ${badgeColor}`}
                    >
                      <span className="font-bold">HTTP {st.code}</span>
                      <span className="opacity-80">
                        {formatCompactNumber(st.requests)} ({st.percentage}%)
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top asset hostnames & Navigateurs */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white mb-3">
              Domaines actifs &amp; Navigateurs
            </h2>
            <div className="space-y-2.5">
              {topHostnames.map((h) => (
                <div key={h.hostname} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-200">{h.hostname}</span>
                    <span className="font-mono text-slate-300">
                      {formatCompactNumber(h.requests)} ({h.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-sky-500 rounded-full"
                      style={{ width: `${Math.min(100, h.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {browsers.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-800/70">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Top Navigateurs (Pages vues)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {browsers.slice(0, 5).map((br) => (
                    <span
                      key={br.browser}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300"
                    >
                      <span className="font-medium text-white">{br.browser}</span>
                      <span className="font-mono text-[11px] text-slate-400">
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

      {/* Sous-requêtes sortantes par hôte & Durée moyenne (comme dans la capture 3 "Subrequests: Host, Requests, Request Duration") */}
      {subrequestHosts.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-white">
                Sous-requêtes sortantes par hôte (Subrequests)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Appels sortants des moteurs d’extraction vers les plateformes sociales et CDN médias ({activePeriodMeta.shortLabel})
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {subrequestHosts.length} hôtes actifs
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-950/40 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3 pl-5 pr-3">Hôte (Host)</th>
                  <th className="py-3 px-3">Plateforme</th>
                  <th className="py-3 px-3">Requêtes par statut</th>
                  <th className="py-3 pl-3 pr-5 text-right">Durée moyenne (Duration)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {subrequestHosts.map((sh) => (
                  <tr
                    key={sh.host}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 pl-5 pr-3 font-mono text-xs text-sky-400 underline decoration-sky-500/30">
                      {sh.host}
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-300">
                      {sh.platform}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                        {sh.status2xx > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                              2xx
                            </span>
                            <span className="text-white">
                              {formatNumber(sh.status2xx)}
                            </span>
                          </span>
                        )}
                        {sh.status3xx > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[11px] font-bold">
                              3xx
                            </span>
                            <span className="text-white">
                              {formatNumber(sh.status3xx)}
                            </span>
                          </span>
                        )}
                        {sh.status4xx > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold">
                              4xx
                            </span>
                            <span className="text-white">
                              {formatNumber(sh.status4xx)}
                            </span>
                          </span>
                        )}
                        {sh.status5xx > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold">
                              5xx
                            </span>
                            <span className="text-white">
                              {formatNumber(sh.status5xx)}
                            </span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pl-3 pr-5 text-right font-mono text-xs font-semibold text-white">
                      {sh.avgDurationMs} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tableau trié par pays : Drapeau + Pays + Visites + Bande passante + % (Request Distribution) */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">
              Distribution géographique par pays ({activePeriodMeta.shortLabel})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Trié par nombre de visites décroissant — Drapeau, pays, visites, bande passante et part du trafic (%)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="search"
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
              placeholder="Filtrer un pays (ex: France, FR, Maroc)…"
              className="w-full sm:w-64 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {loading && !data ? (
          <div className="p-10 text-center space-y-3">
            <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400">
              Interrogation de l’API GraphQL Analytics de Cloudflare…
            </p>
          </div>
        ) : filteredCountries.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-slate-400">
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
                <tr className="border-b border-slate-800/80 bg-slate-950/40 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3 pl-5 pr-2 w-12">#</th>
                  <th className="py-3 px-3">Pays</th>
                  <th className="py-3 px-4 text-right">Visites</th>
                  <th className="py-3 px-4 text-right hidden md:table-cell">
                    Bande passante
                  </th>
                  <th className="py-3 pl-4 pr-5 text-right w-52">Part (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {filteredCountries.map((row, index) => {
                  const barWidth = Math.max(
                    2,
                    Math.min(100, Math.round(row.percentage))
                  );
                  return (
                    <tr
                      key={`${row.countryCode}-${index}`}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 pl-5 pr-2 text-xs font-mono text-slate-500">
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
                            <span className="font-medium text-white truncate">
                              {row.countryName}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-800/90 border border-slate-700/70 text-[10px] font-mono text-slate-400 uppercase">
                              {row.countryCode}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-white">
                        {formatNumber(row.requests)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-400 hidden md:table-cell">
                        {formatBytes(row.bytes)}
                      </td>
                      <td className="py-3 pl-4 pr-5">
                        <div className="flex items-center justify-end gap-3">
                          <div className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden hidden sm:block">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs font-semibold text-indigo-300 w-14 text-right">
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
