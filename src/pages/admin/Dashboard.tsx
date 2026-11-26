import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Globe,
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  HeartPulse,
  ShieldCheck,
} from './AdminIcons';
import {
  computeDailyUsageSummary,
  buildDailyUsageCsv,
  type WidgetStatsInput,
} from './dashboardWidgetLogic';
import { WorldMapVisualization } from './WorldMapVisualization';
import type { GeoInputCountryRow } from './worldMapLogic';
import { VisitorsMap, type VisitorsMapProps } from './VisitorsMap';

export { VisitorsMap, type VisitorsMapProps, buildDailyUsageCsv };

export interface DashboardWidgetProps {
  data?: WidgetStatsInput | null;
  loading?: boolean;
  onRefresh?: () => void;
}

const PLATFORM_DISPLAY_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  instagram_profile: 'Profil Instagram',
  x: 'X (Twitter)',
  twitter: 'X (Twitter)',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  unknown: 'Inconnue',
};

function formatPlatformLabel(platform: string): string {
  const key = (platform || 'unknown').toLowerCase();
  return PLATFORM_DISPLAY_LABELS[key] || platform || 'Inconnue';
}

function formatUtcTimestamp(ts: number): string {
  if (!ts || !Number.isFinite(ts)) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

export const DashboardWidget: React.FC<DashboardWidgetProps> = ({
  data: externalData,
  loading: externalLoading,
  onRefresh,
}) => {
  const [internalData, setInternalData] = useState<WidgetStatsInput | null>(null);
  const [internalLoading, setInternalLoading] = useState<boolean>(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('today');
  const [viewMode, setViewMode] = useState<'both' | 'table' | 'chart' | 'map'>('both');
  const [exportingExcel, setExportingExcel] = useState<boolean>(false);

  const isControlled = externalData !== undefined;
  const activeData = isControlled ? externalData : internalData;
  const isLoading = isControlled ? Boolean(externalLoading) : internalLoading;

  const fetchD1Stats = async () => {
    setInternalLoading(true);
    setInternalError(null);
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { Accept: 'application/json' },
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || 'Impossible de charger les statistiques D1.');
      }
      setInternalData(json);
    } catch (err) {
      setInternalError(err instanceof Error ? err.message : 'Erreur réseau D1');
    } finally {
      setInternalLoading(false);
    }
  };

  useEffect(() => {
    if (!isControlled) {
      fetchD1Stats();
    }
  }, [isControlled]);

  const summary = computeDailyUsageSummary(activeData);

  const selectedMetrics =
    period === 'today'
      ? {
          label: `Aujourd’hui (${summary.today.day})`,
          total: summary.today.total,
          success: summary.today.success,
          error: summary.today.error,
          successRate: summary.today.successRate,
          avgOrSub:
            summary.deltaTodayVsYesterdayPct !== null
              ? `${summary.deltaTodayVsYesterdayPct >= 0 ? '+' : ''}${summary.deltaTodayVsYesterdayPct}% vs hier (${summary.yesterday.total})`
              : `Hier : ${summary.yesterday.total} req (${summary.yesterday.successRate}%)`,
          downloads: summary.today.downloads,
          downloadsStarted: summary.today.downloadsStarted,
          selectionsStarted: summary.today.selectionsStarted,
          selectionsDownloaded: summary.today.selectionsDownloaded,
        }
      : period === '7d'
      ? {
          label: '7 derniers jours (UTC)',
          total: summary.last7d.total,
          success: summary.last7d.success,
          error: summary.last7d.error,
          successRate: summary.last7d.successRate,
          avgOrSub: `Moyenne : ${summary.last7d.avgDaily} req / jour`,
          downloads: summary.last7d.downloads,
          downloadsStarted: summary.last7d.downloadsStarted,
          selectionsStarted: summary.last7d.selectionsStarted,
          selectionsDownloaded: summary.last7d.selectionsDownloaded,
        }
      : {
          label: '30 derniers jours (UTC)',
          total: summary.last30d.total,
          success: summary.last30d.success,
          error: summary.last30d.error,
          successRate: summary.last30d.successRate,
          avgOrSub: `Moyenne : ${summary.last30d.avgDaily} req / jour`,
          downloads: summary.last30d.downloads,
          downloadsStarted: summary.last30d.downloadsStarted,
          selectionsStarted: summary.last30d.selectionsStarted,
          selectionsDownloaded: summary.last30d.selectionsDownloaded,
        };

  // Strictly real D1 geographic data (zero synthetic or weighted fallback)
  const mapCountriesData: GeoInputCountryRow[] = useMemo(() => {
    const d1Countries = activeData?.geo?.periods?.[period]?.countries;
    if (!Array.isArray(d1Countries) || d1Countries.length === 0) {
      return [];
    }
    return d1Countries.map((c) => ({
      countryCode: c.countryCode,
      requests: Math.max(0, Number(c.humanVisits) || Number(c.extractions) || 0),
      percentage: Number(c.sharePct) || 0,
      bytes: 0,
      threats: 0,
    }));
  }, [activeData?.geo?.periods, period]);

  const errorsByPlatformRows = useMemo(() => {
    const byPeriod = activeData?.errorsByPlatform?.[period];
    return Array.isArray(byPeriod) ? byPeriod : [];
  }, [activeData?.errorsByPlatform, period]);

  const errorsByPlatform30dCount = activeData?.errorsByPlatform?.['30d']?.length || 0;
  const recentFailures = useMemo(() => {
    return Array.isArray(activeData?.recentFailures) ? activeData!.recentFailures!.slice(0, 20) : [];
  }, [activeData?.recentFailures]);

  const rateColorClass =
    selectedMetrics.successRate >= 85
      ? 'text-emerald-800 dark:text-emerald-400'
      : selectedMetrics.successRate >= 60
      ? 'text-amber-800 dark:text-amber-400'
      : selectedMetrics.total === 0
      ? 'text-admin-text-muted'
      : 'text-red-800 dark:text-red-400';

  const rateBadgeClass =
    selectedMetrics.successRate >= 85
      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-300'
      : selectedMetrics.successRate >= 60
      ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-300'
      : selectedMetrics.total === 0
      ? 'bg-admin-muted border-admin-border text-admin-text-muted'
      : 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-700/60 text-red-900 dark:text-red-300';

  const chronological7d = [...summary.last7d.days].reverse();
  const max7dTotal = Math.max(1, ...summary.last7d.days.map((d) => d.total));
  const daily30Raw = Array.isArray(activeData?.daily) ? activeData!.daily : [];
  const max30Total = Math.max(1, ...daily30Raw.map((d) => d.total || 0));

  const handleExportExcel = async () => {
    if (exportingExcel) return;
    setExportingExcel(true);
    setInternalError(null);
    try {
      const { downloadAdminStatsExcel } = await import('./excelExport');
      await downloadAdminStatsExcel(activeData);
    } catch (err) {
      setInternalError(
        err instanceof Error
          ? `Erreur lors de l’export Excel : ${err.message}`
          : 'Erreur lors de l’export Excel.'
      );
    } finally {
      setExportingExcel(false);
    }
  };

  return (
    <section
      aria-label="Résumé d'utilisation quotidienne de l'API et taux de succès D1"
      className="bg-admin-surface border border-admin-border rounded-lg p-5 space-y-5 shadow-2xs"
    >
      {/* En-tête du widget */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-admin-accent-bg border border-admin-accent-border flex items-center justify-center text-admin-accent shrink-0 mt-0.5">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-display text-sm sm:text-base font-bold text-admin-text">
                Synthèse API
              </h3>
              <span className="inline-flex items-center gap-1.5 text-xs text-admin-text-secondary">
                <span
                  className={`w-2 h-2 rounded-full ${
                    summary.dbConnected ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                <span>{summary.dbConnected ? 'D1 Connecté' : 'D1 Local / Mémoire'}</span>
              </span>
            </div>
            <p className="text-xs text-admin-text-muted">
              Usage quotidien des moteurs d’extraction, conversion téléchargements, heatmap 30j et carte mondiale
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Sélecteur de période du widget D1"
            className="inline-flex rounded-lg p-1 border border-admin-border"
          >
            {(
              [
                { id: 'today', label: 'Aujourd’hui' },
                { id: '7d', label: '7 jours' },
                { id: '30d', label: '30 jours' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPeriod(tab.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  period === tab.id
                    ? 'bg-admin-accent text-white shadow-2xs'
                    : 'text-admin-text-secondary hover:text-admin-text'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div
            role="group"
            aria-label="Mode de visualisation"
            className="inline-flex flex-wrap rounded-lg p-1 border border-admin-border"
          >
            {(
              [
                { id: 'both', label: 'Tableau + Graphique' },
                { id: 'table', label: 'Tableau' },
                { id: 'chart', label: 'Graphique & Heatmap' },
                { id: 'map', label: 'Carte Mondiale' },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setViewMode(mode.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  viewMode === mode.id
                    ? 'bg-admin-muted text-admin-text border border-admin-border-strong'
                    : 'text-admin-text-muted hover:text-admin-text'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isLoading || exportingExcel || !activeData}
            title="Exporter toutes les statistiques D1 (30 jours) au format Excel (.xlsx)"
            className="px-3 py-1.5 rounded-md bg-admin-muted hover:bg-admin-hover border border-admin-border-strong text-xs font-semibold text-admin-text transition-colors cursor-pointer disabled:opacity-50"
          >
            {exportingExcel ? 'Export…' : 'Export Excel'}
          </button>

          <button
            type="button"
            onClick={onRefresh || fetchD1Stats}
            disabled={isLoading}
            title="Rafraîchir les données D1"
            className="p-2 rounded-md bg-admin-muted hover:bg-admin-hover border border-admin-border-strong text-admin-text transition-colors cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-admin-text-muted ${isLoading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      {internalError && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800/70 text-red-900 dark:text-red-200 text-xs font-mono">
          {internalError}
        </div>
      )}

      {/* Ligne 1 : 4 cartes de synthèse principales pour la période sélectionnée */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-lg border border-admin-border space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-admin-text-secondary">
            <span>Appels API ({period === 'today' ? '24h UTC' : period})</span>
            <TrendingUp className="w-3.5 h-3.5 text-admin-text-muted" />
          </div>
          <p className="font-mono text-2xl font-bold text-admin-text tabular-nums">
            {selectedMetrics.total}
          </p>
          <p className="text-xs text-admin-text-muted truncate">
            {selectedMetrics.avgOrSub}
          </p>
        </div>

        <div className="p-4 rounded-lg border border-admin-border space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-admin-text-secondary">
            <span>Taux de succès</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-md border ${rateBadgeClass}`}>
              {selectedMetrics.total === 0
                ? 'Aucun flux'
                : selectedMetrics.successRate >= 85
                ? 'Optimal'
                : selectedMetrics.successRate >= 60
                ? 'Modéré'
                : 'Dégradé'}
            </span>
          </div>
          <p className={`font-mono text-2xl font-bold tabular-nums ${rateColorClass}`}>
            {selectedMetrics.successRate}%
          </p>
          <div className="w-full h-1.5 rounded-full border border-admin-border overflow-hidden">
            <div
              className="h-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, selectedMetrics.successRate))}%` }}
            />
          </div>
        </div>

        <div className="p-4 rounded-lg border border-admin-border space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-admin-text-secondary">
            <span>Succès / Échecs</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-admin-text-muted" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-emerald-800 dark:text-emerald-400 tabular-nums">
              {selectedMetrics.success}
            </span>
            <span className="text-xs font-mono text-admin-text-muted">/</span>
            <span className="font-mono text-lg font-bold text-red-800 dark:text-red-400 tabular-nums">
              {selectedMetrics.error} err
            </span>
          </div>
          <p className="text-xs text-admin-text-muted">
            <span className="font-mono">{selectedMetrics.downloads}</span> téléchargement(s) complet(s)
          </p>
        </div>

        <div className="p-4 rounded-lg border border-admin-border space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-admin-text-secondary">
            <span>Pic journalier (30j)</span>
            <BarChart3 className="w-3.5 h-3.5 text-admin-text-muted" />
          </div>
          <p className="font-mono text-2xl font-bold text-admin-text tabular-nums">
            {summary.last30d.peakTotal}
            <span className="text-xs font-normal text-admin-text-muted ml-1">req</span>
          </p>
          <p className="text-xs text-admin-text-muted">
            {summary.last30d.peakDay
              ? `Record : ${summary.last30d.peakDay} (${summary.last30d.activeDaysCount}j actifs)`
              : 'Aucun pic enregistré'}
          </p>
        </div>
      </div>

      {/* Ligne 2 : 4 nouvelles métriques opérationnelles D1 (Conversion DL, Sélections, Direct vs Tiers, Vélocité) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg border border-admin-border space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-admin-text-secondary">
            <span>Conversion téléchargement</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-mono font-bold">
              {summary.last30d.downloadCompletionRate}% complétés
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-lg font-bold text-admin-text tabular-nums">
              {summary.last30d.downloadConversionRate}%
            </span>
            <span className="text-xs font-mono text-admin-text-muted tabular-nums">
              {selectedMetrics.downloads}/{selectedMetrics.downloadsStarted || selectedMetrics.downloads} flux
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-admin-border space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-admin-text-secondary">
            <span>Carrousels &amp; Stories (ZIP)</span>
            <span className="text-admin-text-secondary font-mono font-bold">
              {summary.last30d.selectionConversionRate}% conv.
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-lg font-bold text-admin-text tabular-nums">
              {selectedMetrics.selectionsDownloaded}
              <span className="text-xs font-normal text-admin-text-muted ml-1">
                / {selectedMetrics.selectionsStarted} sélections
              </span>
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-admin-border space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-admin-text-secondary">
            <span>Moteurs Direct vs Tiers (7j)</span>
            <ShieldCheck className="w-3.5 h-3.5 text-admin-text-muted" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-lg font-bold text-emerald-800 dark:text-emerald-400 tabular-nums">
              {summary.last7d.directSharePct}% Direct
            </span>
            <span className="text-xs font-mono text-admin-text-muted tabular-nums">
              {summary.last7d.directExtractions} dir. / {summary.last7d.thirdPartyExtractions} tiers
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-admin-border space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-admin-text-secondary">
            <span>Vélocité horaire &amp; Top erreur</span>
            <Globe className="w-3.5 h-3.5 text-admin-text-muted" />
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
            <span className="font-mono text-lg font-bold text-admin-text tabular-nums shrink-0">
              {summary.today.hourlyVelocity} req/h
            </span>
            <span className="text-xs font-mono text-red-800 dark:text-red-300 break-all">
              {summary.topErrors[0]
                ? `${summary.topErrors[0].code} (${summary.topErrors[0].count})`
                : '0 erreur enregistrée'}
            </span>
          </div>
        </div>
      </div>

      {/* Performance d'aujourd'hui : Tableau Erreurs (error_code × plateforme × nombre) + 20 derniers échecs */}
      <div className="p-4 rounded-lg border border-admin-border space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0" />
            <div>
              <h4 className="font-display text-sm font-bold text-admin-text">
                Performance d’aujourd’hui — Erreurs ({selectedMetrics.label})
              </h4>
              <p className="text-xs text-admin-text-muted">
                Détail complet par code d’erreur et plateforme (<span className="font-mono">request_log</span> D1)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-admin-text-secondary">
            <span>
              {errorsByPlatformRows.reduce((acc, r) => acc + r.count, 0)} échec(s) sur la période
            </span>
            {period === 'today' && errorsByPlatformRows.length === 0 && errorsByPlatform30dCount > 0 && (
              <button
                type="button"
                onClick={() => setPeriod('30d')}
                className="font-sans px-2 py-0.5 rounded-md border border-admin-border-strong hover:bg-admin-hover text-admin-accent font-semibold cursor-pointer"
              >
                Voir 30j
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Tableau Erreurs (error_code × plateforme × nombre) */}
          <div className="space-y-2">
            <h5 className="text-xs font-semibold text-admin-text-secondary">
              Erreurs (error_code × plateforme × nombre)
            </h5>
            {errorsByPlatformRows.length === 0 ? (
              <p className="text-xs text-admin-text-muted py-4 text-center border border-admin-border rounded-md">
                Aucun échec enregistré sur cette période.
              </p>
            ) : (
              <div className="overflow-x-auto border border-admin-border rounded-md">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-admin-border bg-admin-muted/40 text-admin-text-muted">
                      <th className="py-2 px-3 font-semibold">Code erreur</th>
                      <th className="py-2 px-3 font-semibold">Plateforme</th>
                      <th className="py-2 px-3 text-right font-semibold">Nombre</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-admin-border/60">
                    {errorsByPlatformRows.map((row) => (
                      <tr
                        key={`${row.error_code}::${row.platform}`}
                        className="hover:bg-admin-hover/40"
                      >
                        <td className="py-2 px-3 font-mono font-semibold text-red-800 dark:text-red-300 whitespace-nowrap">
                          {row.error_code}
                        </td>
                        <td className="py-2 px-3 text-admin-text whitespace-nowrap">
                          {formatPlatformLabel(row.platform)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-admin-text tabular-nums">
                          {row.count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Liste des 20 derniers échecs */}
          <div className="space-y-2">
            <h5 className="text-xs font-semibold text-admin-text-secondary">
              20 derniers échecs enregistrés
            </h5>
            {recentFailures.length === 0 ? (
              <p className="text-xs text-admin-text-muted py-4 text-center border border-admin-border rounded-md">
                Aucun échec récent dans D1.
              </p>
            ) : (
              <div className="overflow-x-auto max-h-72 overflow-y-auto border border-admin-border rounded-md">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-admin-surface border-b border-admin-border text-admin-text-muted">
                    <tr>
                      <th className="py-2 px-2 font-semibold whitespace-nowrap">Date (UTC)</th>
                      <th className="py-2 px-2 font-semibold whitespace-nowrap">Plateforme</th>
                      <th className="py-2 px-2 font-semibold whitespace-nowrap">Code erreur</th>
                      <th className="py-2 px-2 font-semibold whitespace-nowrap">HTTP</th>
                      <th className="py-2 px-2 font-semibold whitespace-nowrap">Domaine</th>
                      <th className="py-2 px-2 font-semibold">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-admin-border/60">
                    {recentFailures.map((fail) => (
                      <tr key={fail.id || `${fail.ts}-${fail.error_code}`} className="hover:bg-admin-hover/40 align-top">
                        <td className="py-1.5 px-2 font-mono text-[11px] text-admin-text-muted whitespace-nowrap tabular-nums">
                          {formatUtcTimestamp(fail.ts)}
                        </td>
                        <td className="py-1.5 px-2 text-admin-text whitespace-nowrap">
                          {formatPlatformLabel(fail.platform)}
                        </td>
                        <td className="py-1.5 px-2 font-mono font-semibold text-red-800 dark:text-red-300 whitespace-nowrap">
                          {fail.error_code}
                        </td>
                        <td className="py-1.5 px-2 font-mono text-admin-text-secondary whitespace-nowrap tabular-nums">
                          {fail.http_status ?? '—'}
                        </td>
                        <td className="py-1.5 px-2 font-mono text-[11px] text-admin-text-secondary whitespace-nowrap">
                          {fail.source_domain || '—'}
                        </td>
                        <td className="py-1.5 px-2 text-admin-text-muted min-w-[160px] break-words">
                          {fail.error_message || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mode Carte Mondiale Interactive */}
      {viewMode === 'map' && (
        <WorldMapVisualization
          countries={mapCountriesData}
          periodLabel={period === 'today' ? 'Aujourd’hui' : period}
          variant="admin"
        />
      )}

      {/* Visualisation : Tableau de performance quotidienne & Graphique simple */}
      {viewMode !== 'map' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {viewMode !== 'chart' && (
            <div
              className={`${
                viewMode === 'both' ? 'lg:col-span-7' : 'lg:col-span-12'
              } p-4 rounded-lg border border-admin-border space-y-3 overflow-x-auto`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-display text-xs font-bold text-admin-text-secondary">
                  Tableau de performance quotidienne (7 derniers jours UTC)
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-admin-text-muted tabular-nums">
                    Total 7j : {summary.last7d.total} req ({summary.last7d.successRate}% OK)
                  </span>
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    disabled={isLoading || exportingExcel || !activeData}
                    title="Exporter toutes les statistiques D1 (30 jours) au format Excel (.xlsx)"
                    className="px-2.5 py-1 rounded-md hover:bg-admin-hover border border-admin-border-strong text-xs font-semibold text-admin-accent transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {exportingExcel ? 'Export…' : 'Export Excel'}
                  </button>
                </div>
              </div>

              {summary.last7d.days.length === 0 ? (
                <p className="text-xs text-admin-text-muted py-4 text-center">
                  Aucune donnée quotidienne disponible dans D1.
                </p>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-admin-border text-xs text-admin-text-muted">
                      <th className="py-2 pr-2 font-semibold">Date (UTC)</th>
                      <th className="py-2 px-2 text-right font-semibold">Appels API</th>
                      <th className="py-2 px-2 text-right font-semibold">Succès</th>
                      <th className="py-2 px-2 text-right font-semibold">Échecs</th>
                      <th className="py-2 px-2 text-right font-semibold hidden sm:table-cell">
                        Télécharg.
                      </th>
                      <th className="py-2 pl-2 text-right font-semibold">Taux de succès</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-admin-border/60 font-mono">
                    {summary.last7d.days.map((dayItem, idx) => {
                      const isToday = idx === 0;
                      return (
                        <tr key={dayItem.day} className="hover:bg-admin-hover/40 transition-colors">
                          <td className="py-2 pr-2 font-semibold text-admin-text tabular-nums">
                            <div className="flex items-center gap-1.5">
                              <span>{dayItem.day}</span>
                              {isToday && (
                                <span className="font-sans text-xs px-1.5 py-0.2 rounded-md bg-admin-accent-bg border border-admin-accent-border text-admin-accent font-semibold">
                                  Auj.
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-admin-text font-semibold">
                            {dayItem.total}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-emerald-800 dark:text-emerald-400">
                            {dayItem.success}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-red-800 dark:text-red-400">
                            {dayItem.error}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-admin-text-secondary hidden sm:table-cell">
                            {dayItem.download_success || 0}
                          </td>
                          <td className="py-2 pl-2 text-right tabular-nums">
                            <span
                              className={`inline-block text-xs font-bold px-2 py-0.5 rounded-md ${
                                dayItem.total === 0
                                  ? 'text-admin-text-muted'
                                  : dayItem.successRate >= 85
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400'
                                  : dayItem.successRate >= 60
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400'
                                  : 'bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-400'
                              }`}
                            >
                              {dayItem.total > 0 ? `${dayItem.successRate}%` : '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* Heatmap Calendrier 30 jours (Intensité & Taux de succès par jour) */}
              {daily30Raw.length > 0 && (
                <div className="pt-3 border-t border-admin-border/70 space-y-2">
                  <div className="flex items-center justify-between text-xs text-admin-text-secondary">
                    <span className="font-semibold">
                      Carte Thermique Quotidienne (Heatmap 30 jours UTC)
                    </span>
                    <span className="text-xs text-admin-text-muted">
                      Survolez une case pour le détail du jour
                    </span>
                  </div>
                  <div className="grid grid-cols-10 sm:grid-cols-15 gap-1.5">
                    {daily30Raw.map((d) => {
                      const ratio = d.total > 0 ? d.total / max30Total : 0;
                      const okRate = d.total > 0 ? Math.round((d.success / d.total) * 100) : 0;
                      const cellClass =
                        d.total === 0
                          ? 'border-admin-border text-admin-text-muted opacity-50'
                          : okRate < 60
                          ? 'bg-red-500/30 border-red-500/50 text-red-900 dark:text-red-200'
                          : ratio >= 0.65
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : ratio >= 0.3
                          ? 'bg-emerald-500/50 border-emerald-500/60 text-emerald-950 dark:text-emerald-100'
                          : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-900 dark:text-emerald-300';
                      return (
                        <div
                          key={d.day}
                          title={`${d.day} : ${d.total} req (${okRate}% succès)`}
                          className={`h-7 rounded-md border flex flex-col items-center justify-center text-xs font-mono font-bold tabular-nums transition-transform hover:scale-105 ${cellClass}`}
                        >
                          <span>{d.day.slice(8, 10)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {viewMode !== 'table' && (
            <div
              className={`${
                viewMode === 'both' ? 'lg:col-span-5' : 'lg:col-span-12'
              } p-4 rounded-lg border border-admin-border space-y-4 flex flex-col justify-between`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-display text-xs font-bold text-admin-text-secondary">
                    Graphique quotidien (7j) &amp; Fiabilité par moteur
                  </h4>
                  <BarChart3 className="w-3.5 h-3.5 text-admin-text-muted" />
                </div>

                {/* Graphique à barres quotidien (7 jours) */}
                <div className="h-28 pt-3 pb-1 px-2 rounded-lg border border-admin-border flex items-end gap-2">
                  {chronological7d.map((dayItem) => {
                    const barHeightPct =
                      dayItem.total > 0 ? Math.max(12, Math.round((dayItem.total / max7dTotal) * 100)) : 4;
                    const okRatio =
                      dayItem.total > 0 ? Math.round((dayItem.success / dayItem.total) * 100) : 0;
                    const errRatio = 100 - okRatio;
                    return (
                      <div
                        key={dayItem.day}
                        className="flex-1 h-full flex flex-col justify-end items-center"
                        title={`${dayItem.day} : ${dayItem.total} req (${dayItem.successRate}% succès)`}
                      >
                        <div
                          className="w-full max-w-[24px] rounded-t overflow-hidden flex flex-col justify-end bg-admin-muted"
                          style={{ height: `${barHeightPct}%` }}
                        >
                          {dayItem.total > 0 ? (
                            <>
                              <div
                                className="w-full bg-red-600 dark:bg-red-500"
                                style={{ height: `${errRatio}%` }}
                              />
                              <div
                                className="w-full bg-emerald-600 dark:bg-emerald-500"
                                style={{ height: `${okRatio}%` }}
                              />
                            </>
                          ) : (
                            <div className="w-full h-[2px] bg-admin-border-strong" />
                          )}
                        </div>
                        <span className="mt-1 text-[9px] font-mono text-admin-text-muted tabular-nums">
                          {dayItem.day.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Fiabilité par plateforme D1 */}
              <div className="space-y-2 pt-1">
                {summary.platforms.map((plat) => (
                  <div key={plat.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-admin-text truncate">
                        {plat.label}{' '}
                        <span className="text-xs font-mono text-admin-text-muted font-normal">
                          ({plat.sharePct}%)
                        </span>
                      </span>
                      <div className="flex items-center gap-2 font-mono tabular-nums shrink-0">
                        <span className="text-xs text-admin-text-muted">
                          {plat.success}/{plat.total} req
                        </span>
                        <span
                          className={`font-bold ${
                            plat.total === 0
                              ? 'text-admin-text-muted'
                              : plat.successRate >= 85
                              ? 'text-emerald-800 dark:text-emerald-400'
                              : plat.successRate >= 60
                              ? 'text-amber-800 dark:text-amber-400'
                              : 'text-red-800 dark:text-red-400'
                          }`}
                        >
                          {plat.total > 0 ? `${plat.successRate}%` : '—'}
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full border border-admin-border overflow-hidden flex">
                      <div
                        className="bg-emerald-600 dark:bg-emerald-500 h-full transition-all"
                        style={{ width: `${plat.total > 0 ? plat.successRate : 0}%` }}
                      />
                      <div
                        className="bg-red-600 dark:bg-red-500 h-full transition-all"
                        style={{ width: `${plat.total > 0 ? plat.failRate : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

interface DailyBucket {
  day: string;
  total: number;
  success: number;
  error: number;
  download_started?: number;
  download_success?: number;
}

interface PlatformStats {
  total: number;
  success: number;
  error: number;
  successRate: number;
  extract_started?: number;
  extract_success?: number;
  extract_error?: number;
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

interface FunnelStats {
  extract_started: number;
  extract_success: number;
  extract_error: number;
  download_started: number;
  download_success: number;
  extractSuccessRate: number;
  globalConversionRate?: number;
  downloadConversionRate: number;
  downloadCompletionRate: number;
}

interface EngineHealthSummary {
  platform:
    | 'tiktok'
    | 'instagram'
    | 'instagram_profile'
    | 'x'
    | 'facebook'
    | 'linkedin';
  last_success_ts: number | null;
  last_test_ts: number | null;
  last_test_ok: number | null;
  last_error_code: string | null;
}

interface StatsResponse extends WidgetStatsInput {
  ok: boolean;
  dbConnected: boolean;
  counts: {
    today: number;
    last7d: number;
    last30d: number;
  };
  funnel?: FunnelStats;
  platforms: {
    tiktok: PlatformStats;
    instagram: PlatformStats;
    instagram_profile?: PlatformStats;
    x: PlatformStats;
    facebook: PlatformStats;
    linkedin?: PlatformStats;
  };
  errors: Array<{ code: string; count: number }>;
  daily: DailyBucket[];
  stories?: {
    story_opened: number;
    story_list_opened: number;
    story_download: number;
  };
}

interface DashboardProps {
  onNavigateTab?: (tab: 'dashboard' | 'health' | 'controls' | 'activity') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigateTab }) => {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [engines, setEngines] = useState<{
    tiktok: EngineHealthSummary;
    instagram: EngineHealthSummary;
    instagram_profile: EngineHealthSummary;
    x: EngineHealthSummary;
    facebook: EngineHealthSummary;
    linkedin: EngineHealthSummary;
  }>({
    tiktok: {
      platform: 'tiktok',
      last_success_ts: null,
      last_test_ts: null,
      last_test_ok: 1,
      last_error_code: null,
    },
    instagram: {
      platform: 'instagram',
      last_success_ts: null,
      last_test_ts: null,
      last_test_ok: 1,
      last_error_code: null,
    },
    instagram_profile: {
      platform: 'instagram_profile',
      last_success_ts: null,
      last_test_ts: null,
      last_test_ok: 1,
      last_error_code: null,
    },
    x: {
      platform: 'x',
      last_success_ts: null,
      last_test_ts: null,
      last_test_ok: 1,
      last_error_code: null,
    },
    facebook: {
      platform: 'facebook',
      last_success_ts: null,
      last_test_ts: null,
      last_test_ok: 1,
      last_error_code: null,
    },
    linkedin: {
      platform: 'linkedin',
      last_success_ts: null,
      last_test_ts: null,
      last_test_ok: 1,
      last_error_code: null,
    },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, healthRes] = await Promise.all([
        fetch('/api/admin/stats', { headers: { Accept: 'application/json' } }),
        fetch('/api/admin/health', { headers: { Accept: 'application/json' } }),
      ]);
      const json = await statsRes.json();
      if (!statsRes.ok || !json.ok) {
        throw new Error(json.message || 'Erreur lors du chargement des métriques.');
      }
      setData(json);

      if (healthRes.ok) {
        const healthJson = await healthRes.json().catch(() => null);
        if (healthJson?.ok && healthJson.engines) {
          setEngines((prev) => ({
            tiktok: healthJson.engines.tiktok || prev.tiktok,
            instagram: healthJson.engines.instagram || prev.instagram,
            instagram_profile:
              healthJson.engines.instagram_profile || prev.instagram_profile,
            x: healthJson.engines.x || prev.x,
            facebook: healthJson.engines.facebook || prev.facebook,
            linkedin: healthJson.engines.linkedin || prev.linkedin,
          }));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const counts = data?.counts || { today: 0, last7d: 0, last30d: 0 };
  const funnel: FunnelStats = data?.funnel || {
    extract_started: counts.last30d,
    extract_success: 0,
    extract_error: 0,
    download_started: 0,
    download_success: 0,
    extractSuccessRate: 0,
    downloadConversionRate: 0,
    downloadCompletionRate: 0,
  };
  const tiktok = data?.platforms.tiktok || { total: 0, success: 0, error: 0, successRate: 0 };
  const instagram = data?.platforms.instagram || { total: 0, success: 0, error: 0, successRate: 0 };
  const instagramProfileStats = data?.platforms.instagram_profile || {
    total: 0,
    success: 0,
    error: 0,
    successRate: 0,
  };
  const xStats = data?.platforms.x || { total: 0, success: 0, error: 0, successRate: 0 };
  const facebookStats = data?.platforms.facebook || { total: 0, success: 0, error: 0, successRate: 0 };
  const linkedinStats = data?.platforms.linkedin || { total: 0, success: 0, error: 0, successRate: 0 };
  const daily = data?.daily || [];
  const maxDaily = Math.max(1, ...daily.map((d) => d.total));
  const totalErrors = (data?.errors || []).reduce((acc, item) => acc + item.count, 0);
  const storyCounters = data?.stories || {
    story_opened: 0,
    story_list_opened: 0,
    story_download: 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-admin-text">
            Vue d’ensemble & Télémétrie D1
          </h2>
          <p className="text-xs text-admin-text-muted">
            Compteurs agrégés <span className="font-mono">daily_metrics</span> (0 identifiant personnel) &amp; erreurs détaillées <span className="font-mono">request_log</span> (30j)
          </p>
        </div>
        <button
          type="button"
          onClick={loadStats}
          disabled={loading}
          className="px-3.5 py-2 rounded-md bg-admin-muted hover:bg-admin-hover border border-admin-border-strong text-xs font-medium text-admin-text flex items-center gap-2 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-admin-text-muted ${loading ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800/70 text-red-900 dark:text-red-200 text-xs">
          {error}
        </div>
      )}

      {/* KPI Cards: Aujourd'hui / 7 jours / 30 jours */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-admin-surface border border-admin-border rounded-lg p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-admin-text-secondary mb-2">
            <span>Extractions aujourd’hui</span>
            <TrendingUp className="w-4 h-4 text-admin-text-muted" />
          </div>
          <p className="font-mono text-3xl font-bold text-admin-text tabular-nums">
            {counts.today}
          </p>
          <p className="mt-1 text-xs text-admin-text-muted">
            Depuis 00:00 UTC
          </p>
        </div>

        <div className="bg-admin-surface border border-admin-border rounded-lg p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-admin-text-secondary mb-2">
            <span>7 derniers jours</span>
            <BarChart3 className="w-4 h-4 text-admin-text-muted" />
          </div>
          <p className="font-mono text-3xl font-bold text-admin-text tabular-nums">
            {counts.last7d}
          </p>
          <p className="mt-1 text-xs text-admin-text-muted">
            Fenêtre glissante 7j
          </p>
        </div>

        <div className="bg-admin-surface border border-admin-border rounded-lg p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-admin-text-secondary mb-2">
            <span>30 derniers jours</span>
            <CheckCircle2 className="w-4 h-4 text-admin-text-muted" />
          </div>
          <p className="font-mono text-3xl font-bold text-admin-text tabular-nums">
            {counts.last30d}
          </p>
          <p className="mt-1 text-xs text-admin-text-muted">
            Rétention maximale D1 (30j)
          </p>
        </div>
      </div>

      {/* Widget : Synthèse Quotidienne API & Taux d'Extraction D1 */}
      <DashboardWidget data={data} loading={loading} onRefresh={loadStats} />

      {/* Carte Mondiale SVG des Origines Visiteurs (D1) */}
      <VisitorsMap d1Stats={data} />

      {/* Entonnoir Extraction -> Téléchargement (30 jours) */}
      <div className="bg-admin-surface border border-admin-border rounded-lg p-5 space-y-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-sm font-bold text-admin-text">
              Entonnoir Extraction → Téléchargement (30 jours)
            </h3>
            <p className="text-xs text-admin-text-muted">
              Suivi agrégé sans identifiant : <span className="font-mono">extract_started → extract_success → download_started → download_success</span>
            </p>
          </div>
          <span
            title="extract_success / extract_started"
            className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/60 px-2.5 py-1 rounded-md tabular-nums"
          >
            Conversion globale (succès/démarrées) :{' '}
            <span className="font-mono">
              {funnel.globalConversionRate ?? funnel.extractSuccessRate}%
            </span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-lg border border-admin-border">
            <span className="text-xs font-medium text-admin-text-secondary block">
              1. Extractions démarrées
            </span>
            <span className="font-mono text-2xl font-bold text-admin-text tabular-nums">
              {funnel.extract_started}
            </span>
            <span className="text-xs text-admin-text-muted block">
              <span className="font-mono">extract_started</span> ({funnel.extract_error} échec(s))
            </span>
          </div>

          <div className="p-3.5 rounded-lg border border-admin-border">
            <span className="text-xs font-medium text-admin-text-secondary block">
              2. Extractions réussies
            </span>
            <span className="font-mono text-2xl font-bold text-emerald-800 dark:text-emerald-400 tabular-nums">
              {funnel.extract_success}
            </span>
            <span className="text-xs text-admin-text-muted block">
              <span className="font-mono">extract_success</span> ({funnel.extractSuccessRate}%)
            </span>
          </div>

          <div className="p-3.5 rounded-lg border border-admin-border">
            <span className="text-xs font-medium text-admin-text-secondary block">
              3. Téléchargements lancés
            </span>
            <span className="font-mono text-2xl font-bold text-admin-text tabular-nums">
              {funnel.download_started}
            </span>
            <span className="text-xs text-admin-text-muted block">
              <span className="font-mono">download_started</span> (1x / fichier / min)
            </span>
          </div>

          <div className="p-3.5 rounded-lg border border-admin-border">
            <span className="text-xs font-medium text-admin-text-secondary block">
              4. Flux terminés sans erreur
            </span>
            <span className="font-mono text-2xl font-bold text-emerald-800 dark:text-emerald-400 tabular-nums">
              {funnel.download_success}
            </span>
            <span className="text-xs text-admin-text-muted block">
              <span className="font-mono">download_success</span> ({funnel.downloadCompletionRate}% des flux)
            </span>
          </div>
        </div>

        {/* Compteurs agrégés Stories Instagram (30 jours, sans identifiant personnel) */}
        <div className="border-t border-admin-border pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg border border-admin-border">
            <span className="text-xs font-medium text-admin-text-secondary block">
              Stories ouvertes (30j)
            </span>
            <span className="font-mono text-xl font-bold text-admin-text tabular-nums">
              {storyCounters.story_opened}
            </span>
            <span className="text-xs text-admin-text-muted block font-mono">
              story_opened
            </span>
          </div>
          <div className="p-3 rounded-lg border border-admin-border">
            <span className="text-xs font-medium text-admin-text-secondary block">
              Listes de stories ouvertes (30j)
            </span>
            <span className="font-mono text-xl font-bold text-admin-text tabular-nums">
              {storyCounters.story_list_opened}
            </span>
            <span className="text-xs text-admin-text-muted block font-mono">
              story_list_opened
            </span>
          </div>
          <div className="p-3 rounded-lg border border-admin-border">
            <span className="text-xs font-medium text-admin-text-secondary block">
              Stories téléchargées (30j)
            </span>
            <span className="font-mono text-xl font-bold text-emerald-800 dark:text-emerald-400 tabular-nums">
              {storyCounters.story_download}
            </span>
            <span className="text-xs text-admin-text-muted block font-mono">
              story_download
            </span>
          </div>
        </div>
      </div>

      {/* Résumé Santé des moteurs */}
      <div className="bg-admin-surface border border-admin-border rounded-lg p-5 space-y-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <HeartPulse className="w-4 h-4 text-admin-text-muted" />
            <h3 className="font-display text-sm font-bold text-admin-text">
              Santé des moteurs
            </h3>
          </div>
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('health')}
              className="text-xs font-semibold text-admin-accent hover:underline underline-offset-4 cursor-pointer"
            >
              Ouvrir les tests de santé →
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(
            [
              { key: 'tiktok', label: 'TikTok', sub: 'TikWM / HTML' },
              { key: 'instagram', label: 'Instagram', sub: 'Embed / GraphQL' },
              { key: 'instagram_profile', label: 'Profil Instagram', sub: 'Photo de profil' },
              { key: 'x', label: 'X (Twitter)', sub: 'Syndication twimg' },
              { key: 'facebook', label: 'Facebook', sub: 'HTML / Mobile' },
              { key: 'linkedin', label: 'LinkedIn', sub: 'Photo de profil publique' },
            ] as const
          ).map(({ key, label, sub }) => {
            const eng = engines[key];
            const isOk = eng?.last_test_ok !== 0;
            return (
              <div
                key={key}
                className="p-3.5 rounded-lg border border-admin-border flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      isOk
                        ? 'bg-emerald-600 dark:bg-emerald-500'
                        : 'bg-red-600 dark:bg-red-500'
                    }`}
                  />
                  <div className="min-w-0">
                    <span className="font-display text-xs font-bold text-admin-text block truncate">
                      {label}
                    </span>
                    <span className="text-xs text-admin-text-muted block truncate">
                      {sub}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-md border shrink-0 ${
                    isOk
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-300'
                      : 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-700/60 text-red-900 dark:text-red-300'
                  }`}
                >
                  {isOk ? 'En ligne' : `Hors ligne${eng?.last_error_code ? ` (${eng.last_error_code})` : ''}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Taux de succès et d'échec par plateforme */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { key: 'tiktok', label: 'TikTok (TikWM / HTML)', stats: tiktok },
          { key: 'instagram', label: 'Instagram (Reels / Posts)', stats: instagram },
          { key: 'instagram_profile', label: 'Profil Instagram (DP)', stats: instagramProfileStats },
          { key: 'x', label: 'X (Twitter) (Syndication)', stats: xStats },
          { key: 'facebook', label: 'Facebook (HTML / Mobile)', stats: facebookStats },
          { key: 'linkedin', label: 'LinkedIn (Photo de profil)', stats: linkedinStats },
        ].map(({ key, label, stats }) => {
          const failRate =
            stats.total > 0 ? Math.round((stats.error / stats.total) * 1000) / 10 : 0;
          const dlStarted = stats.download_started ?? 0;
          const dlSuccess = stats.download_success ?? 0;
          return (
            <div
              key={key}
              className="bg-admin-surface border border-admin-border rounded-lg p-5 space-y-3 shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-sm font-bold text-admin-text truncate">{label}</h3>
                <span className="font-mono font-semibold text-xs px-2.5 py-0.5 rounded-md bg-admin-accent-bg border border-admin-accent-border text-admin-accent tabular-nums shrink-0">
                  {stats.total} req (30j)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-lg border border-admin-border">
                  <span className="text-xs font-medium text-admin-text-secondary block">
                    Taux de succès
                  </span>
                  <span className="font-mono text-xl font-bold text-emerald-800 dark:text-emerald-400 tabular-nums">
                    {stats.successRate}%
                  </span>
                  <span className="text-xs text-admin-text-muted block">
                    <span className="font-mono">{stats.success}</span> réussie(s)
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-admin-border">
                  <span className="text-xs font-medium text-admin-text-secondary block">
                    Taux d’échec
                  </span>
                  <span className="font-mono text-xl font-bold text-red-800 dark:text-red-400 tabular-nums">
                    {failRate}%
                  </span>
                  <span className="text-xs text-admin-text-muted block">
                    <span className="font-mono">{stats.error}</span> échec(s)
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-admin-text-secondary px-1">
                <span>Téléchargements : <span className="font-mono">{dlStarted}</span> lancés</span>
                <span className="font-semibold text-emerald-800 dark:text-emerald-300"><span className="font-mono">{dlSuccess}</span> terminés</span>
              </div>

              {(key === 'tiktok' || key === 'instagram') && (
                <div className="p-2.5 rounded-lg border border-admin-border space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-admin-text-secondary">
                    <span>Succès Direct (<code className="font-mono">stage: direct</code>) :</span>
                    <span className="text-emerald-800 dark:text-emerald-300 font-mono font-semibold tabular-nums">
                      {stats.stage?.direct ?? stats.direct ?? 0} (7j : {stats.stage?.direct7d ?? stats.direct7d ?? 0})
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-admin-text-secondary">
                    <span>Succès Tiers (<code className="font-mono">stage: tiers</code>) :</span>
                    <span className="text-amber-800 dark:text-amber-300 font-mono font-semibold tabular-nums">
                      {stats.stage?.tiers ?? stats.tiers ?? 0} (7j : {stats.stage?.tiers7d ?? stats.tiers7d ?? 0})
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-admin-border pt-1 text-admin-text">
                    <span>Part services tiers (7 jours) :</span>
                    <span className="font-mono font-bold tabular-nums">
                      {stats.stage?.thirdPartyRate7d ?? stats.thirdPartyRate7d ?? 0}%
                    </span>
                  </div>
                </div>
              )}

              {/* Barre de progression SVG/CSS */}
              <div className="w-full h-2.5 rounded-full border border-admin-border overflow-hidden flex">
                <div
                  className="bg-emerald-600 dark:bg-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${stats.total > 0 ? stats.successRate : 0}%` }}
                />
                <div
                  className="bg-red-600 dark:bg-red-500 h-full transition-all duration-300"
                  style={{ width: `${stats.total > 0 ? failRate : 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Graphique SVG/CSS des 30 derniers jours */}
      <div className="bg-admin-surface border border-admin-border rounded-lg p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-display text-sm font-bold text-admin-text">
              Historique des extractions (30 derniers jours)
            </h3>
            <p className="text-xs text-admin-text-muted">
              Graphique natif SVG/CSS sans dépendance externe (Succès vs Échecs par jour UTC)
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 dark:bg-emerald-500 inline-block" />
              Succès
            </span>
            <span className="flex items-center gap-1.5 text-red-800 dark:text-red-400">
              <span className="w-2.5 h-2.5 rounded-xs bg-red-600 dark:bg-red-500 inline-block" />
              Erreurs
            </span>
          </div>
        </div>

        <div className="h-48 pt-4 pb-2 px-2 rounded-lg border border-admin-border flex items-end gap-1 sm:gap-1.5">
          {daily.map((bucket) => {
            const totalHeightPct = Math.round((bucket.total / maxDaily) * 100);
            const successPct =
              bucket.total > 0 ? Math.round((bucket.success / bucket.total) * 100) : 0;
            const errorPct = 100 - successPct;

            return (
              <div
                key={bucket.day}
                className="flex-1 h-full flex flex-col justify-end items-center group relative"
                title={`${bucket.day} : ${bucket.total} total (${bucket.success} OK, ${bucket.error} err)`}
              >
                <div
                  className="w-full max-w-[18px] rounded-t bg-admin-hover overflow-hidden flex flex-col justify-end transition-all"
                  style={{ height: `${Math.max(bucket.total > 0 ? 8 : 2, totalHeightPct)}%` }}
                >
                  {bucket.total > 0 ? (
                    <>
                      <div
                        className="w-full bg-red-600 dark:bg-red-500/90"
                        style={{ height: `${errorPct}%` }}
                      />
                      <div
                        className="w-full bg-emerald-600 dark:bg-emerald-500/90"
                        style={{ height: `${successPct}%` }}
                      />
                    </>
                  ) : (
                    <div className="w-full h-[2px] bg-admin-border-strong" />
                  )}
                </div>
                <span className="mt-1.5 text-[9px] font-mono text-admin-text-muted hidden lg:inline-block">
                  {bucket.day.slice(8, 10)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Répartition des codes d'erreur */}
      <div className="bg-admin-surface border border-admin-border rounded-lg p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400" />
            <h3 className="font-display text-sm font-bold text-admin-text">
              Répartition des erreurs (30 jours)
            </h3>
          </div>
          <span className="text-xs text-admin-text-muted tabular-nums">
            Total erreurs : <span className="font-mono">{totalErrors}</span>
          </span>
        </div>

        {!data?.errors || data.errors.length === 0 ? (
          <p className="text-xs text-admin-text-muted py-4 text-center">
            Aucune erreur enregistrée sur les 30 derniers jours.
          </p>
        ) : (
          <div className="space-y-2.5">
            {data.errors.map((errItem) => {
              const pct =
                totalErrors > 0 ? Math.round((errItem.count / totalErrors) * 1000) / 10 : 0;
              return (
                <div key={errItem.code} className="space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                    <span className="text-admin-text font-semibold break-all">{errItem.code}</span>
                    <span className="text-admin-text-secondary tabular-nums shrink-0">
                      {errItem.count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-admin-muted border border-admin-border overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-admin-accent to-amber-600 dark:from-orange-500 dark:to-amber-500"
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
