import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminPageHeader } from '../AdminPageHeader';
import {
  buildPlatformTableRows,
  type AdminEngineStatusRow,
  type AdminPlatformKey,
  type AdminStatsData,
  type ExtractionsSubTab,
} from '../adminMetricsLogic';
import { PlatformsTable, type StoriesStatusSnapshot } from './PlatformsTable';
import { ErrorsLogPanel } from './ErrorsLogPanel';
import { FunnelSection } from './FunnelSection';

export interface ExtractionsViewProps {
  authorizedSubTabs: readonly ExtractionsSubTab[];
  activeSubTab: ExtractionsSubTab;
  onSelectSubTab: (subTab: ExtractionsSubTab) => void;
  isOwner: boolean;
  canViewStats: boolean;
  canViewHealth: boolean;
  canViewActivity: boolean;
  initialPlatformFilter?: string;
  initialErrorCodeFilter?: string;
}

const SUB_TAB_LABELS: Record<ExtractionsSubTab, string> = {
  plateformes: 'Plateformes',
  erreurs: 'Erreurs',
  entonnoir: 'Entonnoir',
};

export const ExtractionsView: React.FC<ExtractionsViewProps> = ({
  authorizedSubTabs,
  activeSubTab,
  onSelectSubTab,
  isOwner,
  canViewStats,
  canViewHealth,
  canViewActivity,
  initialPlatformFilter = '',
  initialErrorCodeFilter = '',
}) => {
  const [stats, setStats] = useState<AdminStatsData | null>(null);
  const [engines, setEngines] = useState<
    Partial<Record<AdminPlatformKey, AdminEngineStatusRow>>
  >({});
  const [igCookieConfigured, setIgCookieConfigured] = useState(false);
  const [storiesStatus, setStoriesStatus] = useState<StoriesStatusSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);

  const [errorFilterState, setErrorFilterState] = useState({
    platform: initialPlatformFilter,
    errorCode: initialErrorCodeFilter,
  });

  useEffect(() => {
    setErrorFilterState({
      platform: initialPlatformFilter,
      errorCode: initialErrorCodeFilter,
    });
  }, [initialPlatformFilter, initialErrorCodeFilter]);

  const resolvedSubTab = authorizedSubTabs.includes(activeSubTab)
    ? activeSubTab
    : authorizedSubTabs[0] || 'plateformes';

  const loadHealthOnly = useCallback(async () => {
    if (!canViewHealth) return;
    const res = await fetch('/api/admin/health', {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return;
    const json = await res.json().catch(() => null);
    if (json?.ok) {
      if (json.engines) setEngines(json.engines);
      setIgCookieConfigured(Boolean(json.instagramCookie?.configured));
      if (json.storiesStatus) setStoriesStatus(json.storiesStatus);
    }
  }, [canViewHealth]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const promises: Promise<void>[] = [];

      if (canViewStats) {
        promises.push(
          fetch('/api/admin/stats', { headers: { Accept: 'application/json' } })
            .then(async (res) => {
              const json = await res.json();
              if (!res.ok || !json.ok) {
                throw new Error(json.message || 'Erreur lors du chargement des statistiques.');
              }
              setStats(json);
            })
        );
      }

      if (canViewHealth) {
        promises.push(loadHealthOnly());
      }

      await Promise.all(promises);
      setFetchedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  }, [canViewStats, canViewHealth, loadHealthOnly]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExportExcel = async () => {
    if (exporting || !stats) return;
    setExporting(true);
    setError(null);
    try {
      const { downloadAdminStatsExcel } = await import('../excelExport');
      await downloadAdminStatsExcel(stats);
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

  const platformRows = useMemo(
    () => buildPlatformTableRows(stats, engines),
    [stats, engines]
  );

  const funnel = stats?.funnel || {
    extract_started: 0,
    extract_success: 0,
    extract_error: 0,
    download_started: 0,
    download_success: 0,
  };

  const stories = stats?.stories || {
    story_opened: 0,
    story_list_opened: 0,
    story_download: 0,
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Extractions"
        subtitle="Performance des moteurs, santé combinée, erreurs et entonnoir D1 (30j)"
        fetchedAt={fetchedAt}
        loading={loading}
        onRefresh={loadData}
        onExport={canViewStats ? handleExportExcel : undefined}
        exporting={exporting}
        exportDisabled={!stats || loading}
      />

      {/* Sub-tabs */}
      <div
        role="tablist"
        aria-label="Sous-sections Extractions"
        className="flex items-center gap-1 border-b border-admin-border overflow-x-auto no-scrollbar"
      >
        {authorizedSubTabs.map((subTab) => {
          const active = resolvedSubTab === subTab;
          return (
            <button
              key={subTab}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelectSubTab(subTab)}
              className={`relative px-3.5 py-2.5 text-xs font-display font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                active
                  ? 'text-orange-700 dark:text-orange-400'
                  : 'text-admin-text-secondary hover:text-admin-text'
              }`}
            >
              <span>{SUB_TAB_LABELS[subTab]}</span>
              {active && (
                <span
                  aria-hidden="true"
                  data-testid="extractions-subtab-indicator"
                  className="absolute inset-x-0 bottom-0 h-[2.5px] rounded-t-full bg-orange-600 dark:bg-orange-400"
                />
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800/70 text-red-900 dark:text-red-200 text-xs"
        >
          {error}
        </div>
      )}

      {resolvedSubTab === 'plateformes' && (
        <PlatformsTable
          rows={platformRows}
          readOnly={!isOwner}
          igCookieConfigured={igCookieConfigured}
          storiesStatus={storiesStatus}
          highlightedPlatform={initialPlatformFilter || null}
          onRefreshHealth={loadHealthOnly}
          onSelectError={
            authorizedSubTabs.includes('erreurs')
              ? (platform, code) => {
                  setErrorFilterState({ platform, errorCode: code });
                  onSelectSubTab('erreurs');
                }
              : undefined
          }
        />
      )}

      {resolvedSubTab === 'erreurs' && (
        <ErrorsLogPanel
          statsErrors={stats?.errors || []}
          errorsByPlatform30d={stats?.errorsByPlatform?.['30d'] || []}
          canViewActivity={canViewActivity}
          initialPlatformFilter={errorFilterState.platform}
          initialErrorCodeFilter={errorFilterState.errorCode}
        />
      )}

      {resolvedSubTab === 'entonnoir' && (
        <FunnelSection funnel={funnel} stories={stories} daily={stats?.daily} />
      )}
    </div>
  );
};
