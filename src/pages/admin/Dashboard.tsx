import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  computeDailyUsageSummary,
  buildDailyUsageCsv,
} from './dashboardWidgetLogic';
import { VisitorsMap, type VisitorsMapProps } from './VisitorsMap';
import { AdminPageHeader } from './AdminPageHeader';
import {
  buildActionRequiredItems,
  buildPlatformTableRows,
  type AdminEngineStatusRow,
  type AdminNavigationTarget,
  type AdminOverviewPeriod,
  type AdminPlatformKey,
  type AdminStatsData,
} from './adminMetricsLogic';
import { OverviewKpiRow } from './overview/OverviewKpiRow';
import { DailySuccessChart } from './overview/DailySuccessChart';
import { ActionRequiredPanel } from './overview/ActionRequiredPanel';
import { OverviewMiniLists } from './overview/OverviewMiniLists';

export { VisitorsMap, type VisitorsMapProps, buildDailyUsageCsv };

export interface DashboardProps {
  onNavigate?: (target: AdminNavigationTarget) => void;
  onNavigateTab?: (tab: 'health' | 'activity' | 'controls' | 'visitors') => void;
  canViewHealth?: boolean;
}

const OVERVIEW_PERIOD_OPTIONS = [
  { id: 'today', label: "Aujourd'hui" },
  { id: '7d', label: '7j' },
  { id: '30d', label: '30j' },
] as const;

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigate,
  onNavigateTab,
  canViewHealth = true,
}) => {
  const [data, setData] = useState<AdminStatsData | null>(null);
  const [engines, setEngines] = useState<
    Partial<Record<AdminPlatformKey, AdminEngineStatusRow>>
  >({});
  const [period, setPeriod] = useState<AdminOverviewPeriod>('7d');
  const [chartRange, setChartRange] = useState<'7d' | '30d'>('7d');
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const requests: Promise<Response>[] = [
        fetch('/api/admin/stats', { headers: { Accept: 'application/json' } }),
      ];
      if (canViewHealth) {
        requests.push(
          fetch('/api/admin/health', { headers: { Accept: 'application/json' } })
        );
      }

      const [statsRes, healthRes] = await Promise.all(requests);
      const statsJson = await statsRes.json();
      if (!statsRes.ok || !statsJson.ok) {
        throw new Error(statsJson.message || 'Erreur lors du chargement des métriques.');
      }
      setData(statsJson);
      setFetchedAt(Date.now());

      if (healthRes && healthRes.ok) {
        const healthJson = await healthRes.json().catch(() => null);
        if (healthJson?.ok && healthJson.engines) {
          setEngines(healthJson.engines);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  }, [canViewHealth]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleExportExcel = async () => {
    if (exporting || !data) return;
    setExporting(true);
    setError(null);
    try {
      const { downloadAdminStatsExcel } = await import('./excelExport');
      await downloadAdminStatsExcel(data);
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

  const handleNavigate = (target: AdminNavigationTarget) => {
    if (onNavigate) {
      onNavigate(target);
      return;
    }
    if (onNavigateTab) {
      if (target.tab === 'visitors') onNavigateTab('visitors');
      else if (target.tab === 'controls') onNavigateTab('controls');
      else if (target.subTab === 'erreurs') onNavigateTab('activity');
      else onNavigateTab('health');
    }
  };

  const summary = useMemo(() => computeDailyUsageSummary(data), [data]);

  const periodMetrics = useMemo(() => {
    if (period === 'today') {
      return {
        total: summary.today.total,
        success: summary.today.success,
        error: summary.today.error,
        previousTotal: summary.yesterday.total,
        previousSuccessRate:
          summary.yesterday.total > 0 ? summary.yesterday.successRate : null,
      };
    }
    if (period === '7d') {
      return {
        total: summary.last7d.total,
        success: summary.last7d.success,
        error: summary.last7d.error,
        previousTotal: null,
        previousSuccessRate: null,
      };
    }
    return {
      total: summary.last30d.total,
      success: summary.last30d.success,
      error: summary.last30d.error,
      previousTotal: null,
      previousSuccessRate: null,
    };
  }, [period, summary]);

  const geoPeriod = data?.geo?.periods?.[period];
  const humanVisits = Math.max(0, Number(geoPeriod?.humanVisits || 0));
  const botVisits = Math.max(0, Number(geoPeriod?.botVisits || 0));

  const platformRows = useMemo(
    () => buildPlatformTableRows(data, engines),
    [data, engines]
  );

  const actionItems = useMemo(
    () => buildActionRequiredItems(data, engines),
    [data, engines]
  );

  const miniCountries = useMemo(
    () =>
      (geoPeriod?.countries || []).map((c) => ({
        countryCode: c.countryCode,
        humanVisits: Number(c.humanVisits || 0),
        extractions: Number(c.extractions || 0),
      })),
    [geoPeriod?.countries]
  );

  const miniSources = useMemo(
    () =>
      (geoPeriod?.sources?.categories || []).map((s) => ({
        category: s.category,
        label: s.label,
        visits: Number(s.visits || 0),
      })),
    [geoPeriod?.sources?.categories]
  );

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Vue d'ensemble"
        subtitle="Synthèse opérationnelle en temps réel · Cloudflare D1"
        fetchedAt={fetchedAt}
        loading={loading}
        onRefresh={loadStats}
        onExport={handleExportExcel}
        exporting={exporting}
        exportDisabled={!data || loading}
        periodOptions={OVERVIEW_PERIOD_OPTIONS}
        selectedPeriod={period}
        onSelectPeriod={(next) => {
          setPeriod(next);
          if (next === '30d') setChartRange('30d');
          else if (next === '7d') setChartRange('7d');
        }}
        periodAriaLabel="Période de la vue d'ensemble"
      />

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800/70 text-red-900 dark:text-red-200 text-xs"
        >
          {error}
        </div>
      )}

      {/* 4 KPI cards with click-to-detail */}
      <OverviewKpiRow
        period={period}
        extractionsTotal={periodMetrics.total}
        extractionsSuccess={periodMetrics.success}
        extractionsError={periodMetrics.error}
        previousExtractionsTotal={periodMetrics.previousTotal}
        previousSuccessRate={periodMetrics.previousSuccessRate}
        humanVisits={humanVisits}
        botVisits={botVisits}
        loading={loading}
        onNavigate={handleNavigate}
      />

      {/* Daily chart (7j/30j) + Automatic "À traiter" panel */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-8">
          <DailySuccessChart
            daily={data?.daily}
            range={chartRange}
            onChangeRange={setChartRange}
          />
        </div>
        <div className="md:col-span-4">
          <ActionRequiredPanel items={actionItems} onNavigate={handleNavigate} />
        </div>
      </div>

      {/* 3 Mini-lists: Top plateformes, Top 5 pays, Sources de trafic */}
      <OverviewMiniLists
        platforms={platformRows}
        countries={miniCountries}
        sources={miniSources}
        onNavigate={handleNavigate}
      />
    </div>
  );
};

export const DashboardWidget = Dashboard;
export type DashboardWidgetProps = DashboardProps;

