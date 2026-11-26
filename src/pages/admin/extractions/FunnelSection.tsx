import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from '../AdminIcons';
import type { WidgetDailyBucket } from '../dashboardWidgetLogic';
import {
  buildDailyChartSeries,
  formatNumberFr,
  formatSafePercent,
} from '../adminMetricsLogic';

export interface FunnelSectionProps {
  funnel: {
    extract_started: number;
    extract_success: number;
    extract_error: number;
    download_started: number;
    download_success: number;
  };
  stories: {
    story_opened: number;
    story_list_opened: number;
    story_download: number;
  };
  daily: readonly WidgetDailyBucket[] | undefined;
}

export const FunnelSection: React.FC<FunnelSectionProps> = ({
  funnel,
  stories,
  daily,
}) => {
  const [heatmapOpen, setHeatmapOpen] = useState(false);

  const heatmapSeries = useMemo(() => buildDailyChartSeries(daily, '30d'), [daily]);

  const maxDownloadVol = Math.max(1, funnel.download_started, funnel.download_success);

  const steps: Array<{
    index: string;
    label: string;
    key: string;
    value: number;
    rateLabel: string | null;
    barPct: number;
    accent: string;
  }> = [
    {
      index: '1',
      label: 'Extractions démarrées',
      key: 'extract_started',
      value: funnel.extract_started,
      rateLabel: funnel.extract_started > 0 ? 'Base 100 %' : '—',
      barPct: funnel.extract_started > 0 ? 100 : 0,
      accent: 'text-admin-text',
    },
    {
      index: '2',
      label: 'Extractions réussies',
      key: 'extract_success',
      value: funnel.extract_success,
      rateLabel: formatSafePercent(funnel.extract_success, funnel.extract_started),
      barPct:
        funnel.extract_started > 0
          ? Math.min(100, Math.round((funnel.extract_success / funnel.extract_started) * 100))
          : 0,
      accent: 'text-emerald-700 dark:text-emerald-400',
    },
    {
      index: '3',
      label: 'Fichiers téléchargés',
      key: 'download_started',
      value: funnel.download_started,
      rateLabel: null,
      barPct:
        funnel.download_started > 0
          ? Math.min(100, Math.round((funnel.download_started / maxDownloadVol) * 100))
          : 0,
      accent: 'text-admin-text',
    },
    {
      index: '4',
      label: 'Fichiers terminés',
      key: 'download_success',
      value: funnel.download_success,
      rateLabel: null,
      barPct:
        funnel.download_success > 0
          ? Math.min(100, Math.round((funnel.download_success / maxDownloadVol) * 100))
          : 0,
      accent: 'text-emerald-700 dark:text-emerald-400',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Compact Horizontal Funnel */}
      <section
        aria-label="Entonnoir Extraction vers Téléchargement"
        className="bg-admin-surface border border-admin-border rounded-lg p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-bold text-admin-text">
              Entonnoir Extraction → Fichiers (30j)
            </h2>
            <p className="text-xs text-admin-text-muted">
              Compteurs agrégés daily_metrics (30j UTC) · étapes 3 et 4 en volume brut de fichiers (carrousels inclus)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded border border-admin-border bg-admin-muted text-admin-text tabular-nums">
              Conversion extraction : {formatSafePercent(funnel.extract_success, funnel.extract_started)}
            </span>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded border border-admin-border bg-admin-muted text-admin-text-secondary tabular-nums">
              Échecs agrégés : {formatNumberFr(funnel.extract_error)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {steps.map((step) => (
            <div
              key={step.key}
              className="p-3.5 rounded-md border border-admin-border space-y-2"
            >
              <div className="flex items-center justify-between gap-2 text-xs text-admin-text-secondary">
                <span className="font-medium truncate">
                  {step.index}. {step.label}
                </span>
                {step.rateLabel !== null && (
                  <span className="font-mono font-semibold text-admin-text-muted tabular-nums shrink-0">
                    {step.rateLabel}
                  </span>
                )}
              </div>
              <div className={`font-mono text-2xl font-bold tabular-nums ${step.accent}`}>
                {formatNumberFr(step.value)}
              </div>
              <div className="w-full h-1.5 rounded-full bg-admin-muted overflow-hidden">
                <div
                  className="h-full bg-admin-accent rounded-full transition-all"
                  style={{ width: `${step.barPct}%` }}
                />
              </div>
              <div className="text-[11px] font-mono text-admin-text-muted">{step.key}</div>
            </div>
          ))}
        </div>

        {/* Stories Counters */}
        <div className="pt-4 border-t border-admin-border grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-md border border-admin-border flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-admin-text-secondary">
                Stories ouvertes (30j)
              </div>
              <div className="text-[11px] font-mono text-admin-text-muted">story_opened</div>
            </div>
            <span className="font-mono text-xl font-bold text-admin-text tabular-nums">
              {formatNumberFr(stories.story_opened)}
            </span>
          </div>

          <div className="p-3 rounded-md border border-admin-border flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-admin-text-secondary">
                Listes de stories (30j)
              </div>
              <div className="text-[11px] font-mono text-admin-text-muted">
                story_list_opened
              </div>
            </div>
            <span className="font-mono text-xl font-bold text-admin-text tabular-nums">
              {formatNumberFr(stories.story_list_opened)}
            </span>
          </div>

          <div className="p-3 rounded-md border border-admin-border flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-admin-text-secondary">
                Stories téléchargées (30j)
              </div>
              <div className="text-[11px] font-mono text-admin-text-muted">story_download</div>
            </div>
            <span className="font-mono text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {formatNumberFr(stories.story_download)}
            </span>
          </div>
        </div>
      </section>

      {/* Collapsible 30-day Heatmap (collapsed by default) */}
      <section className="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
        <button
          type="button"
          aria-expanded={heatmapOpen}
          onClick={() => setHeatmapOpen((prev) => !prev)}
          className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-admin-hover/40 transition-colors cursor-pointer"
        >
          <div>
            <h2 className="font-display text-sm font-bold text-admin-text">
              Heatmap 30 jours (UTC)
            </h2>
            <p className="text-xs text-admin-text-muted">
              Intensité journalière et taux de succès sur les 30 derniers jours
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-admin-text-secondary">
            <span>{heatmapOpen ? 'Masquer' : 'Afficher'}</span>
            {heatmapOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </span>
        </button>

        {heatmapOpen && (
          <div className="p-4 border-t border-admin-border space-y-3">
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
              {heatmapSeries.points.map((d) => {
                const ratio =
                  heatmapSeries.maxTotal > 0 ? d.total / heatmapSeries.maxTotal : 0;
                const cellClass =
                  d.total === 0
                    ? 'bg-admin-muted/40 border-admin-border text-admin-text-muted'
                    : d.successRate !== null && d.successRate < 50
                    ? 'bg-red-500/25 border-red-500/50 text-red-900 dark:text-red-200'
                    : ratio >= 0.65
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : ratio >= 0.3
                    ? 'bg-emerald-500/45 border-emerald-500/60 text-emerald-950 dark:text-emerald-100'
                    : 'bg-emerald-500/20 border-emerald-500/35 text-emerald-900 dark:text-emerald-200';

                return (
                  <div
                    key={d.day}
                    title={`${d.day} : ${d.total} req (${d.success} OK, ${d.error} err · ${formatSafePercent(
                      d.success,
                      d.total
                    )})`}
                    className={`p-2 rounded border text-center font-mono ${cellClass}`}
                  >
                    <div className="text-[10px] opacity-80">{d.shortLabel}</div>
                    <div className="text-xs font-bold tabular-nums">{d.total}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
