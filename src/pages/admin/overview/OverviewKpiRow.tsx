import React from 'react';
import {
  Activity,
  CheckCircle2,
  Users,
  AlertTriangle,
  ArrowRight,
} from '../AdminIcons';
import {
  formatNumberFr,
  formatSafePercent,
  formatDeltaPercent,
  type AdminNavigationTarget,
  type AdminOverviewPeriod,
} from '../adminMetricsLogic';

export interface OverviewKpiRowProps {
  period: AdminOverviewPeriod;
  extractionsTotal: number;
  extractionsSuccess: number;
  extractionsError: number;
  previousExtractionsTotal: number | null;
  previousSuccessRate: number | null;
  humanVisits: number;
  botVisits: number;
  loading: boolean;
  onNavigate: (target: AdminNavigationTarget) => void;
}

export const OverviewKpiRow: React.FC<OverviewKpiRowProps> = ({
  period,
  extractionsTotal,
  extractionsSuccess,
  extractionsError,
  previousExtractionsTotal,
  previousSuccessRate,
  humanVisits,
  botVisits,
  loading,
  onNavigate,
}) => {
  const periodLabel =
    period === 'today' ? "Aujourd'hui" : period === '7d' ? '7 derniers jours' : '30 derniers jours';

  const extractionsDelta =
    previousExtractionsTotal !== null
      ? formatDeltaPercent(extractionsTotal, previousExtractionsTotal)
      : null;

  const currentSuccessRate =
    extractionsTotal > 0 ? (extractionsSuccess / extractionsTotal) * 100 : null;
  const successRateDelta =
    currentSuccessRate !== null && previousSuccessRate !== null
      ? Math.round((currentSuccessRate - previousSuccessRate) * 10) / 10
      : null;

  const successRateDisplay = formatSafePercent(extractionsSuccess, extractionsTotal);
  const errorRateDisplay = formatSafePercent(extractionsError, extractionsTotal);
  const totalVisits = humanVisits + botVisits;
  const humanShareDisplay = formatSafePercent(humanVisits, totalVisits);

  const successColorClass =
    currentSuccessRate === null
      ? 'text-admin-text-muted'
      : currentSuccessRate >= 85
      ? 'text-emerald-700 dark:text-emerald-400'
      : currentSuccessRate >= 50
      ? 'text-amber-700 dark:text-amber-400'
      : 'text-red-700 dark:text-red-400';

  return (
    <section
      aria-label="Indicateurs clés"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5"
    >
      {/* 1. Extractions */}
      <button
        type="button"
        onClick={() => onNavigate({ tab: 'extractions', subTab: 'plateformes' })}
        className="group text-left bg-admin-surface border border-admin-border hover:border-admin-border-strong rounded-lg p-4 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-admin-accent/40"
      >
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-admin-text-secondary">
          <span>Extractions</span>
          <Activity className="w-4 h-4 text-admin-text-muted group-hover:text-admin-accent transition-colors" />
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span className="font-mono text-2xl font-bold text-admin-text tabular-nums">
            {loading && extractionsTotal === 0 ? '—' : formatNumberFr(extractionsTotal)}
          </span>
          {extractionsDelta ? (
            <span
              className={`text-xs font-mono font-semibold tabular-nums ${
                extractionsDelta.direction === 'up'
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : extractionsDelta.direction === 'down'
                  ? 'text-red-700 dark:text-red-400'
                  : 'text-admin-text-muted'
              }`}
            >
              {extractionsDelta.label} vs hier
            </span>
          ) : (
            <span className="text-xs text-admin-text-muted">{periodLabel}</span>
          )}
        </div>
        <div className="mt-2.5 pt-2 border-t border-admin-border/70 flex items-center justify-between text-xs text-admin-text-muted">
          <span>Voir par plateforme</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </button>

      {/* 2. Taux de succès */}
      <button
        type="button"
        onClick={() => onNavigate({ tab: 'extractions', subTab: 'entonnoir' })}
        className="group text-left bg-admin-surface border border-admin-border hover:border-admin-border-strong rounded-lg p-4 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-admin-accent/40"
      >
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-admin-text-secondary">
          <span>Taux de succès</span>
          <CheckCircle2 className="w-4 h-4 text-admin-text-muted group-hover:text-admin-accent transition-colors" />
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span className={`font-mono text-2xl font-bold tabular-nums ${successColorClass}`}>
            {successRateDisplay}
          </span>
          {successRateDelta !== null ? (
            <span
              className={`text-xs font-mono font-semibold tabular-nums ${
                successRateDelta > 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : successRateDelta < 0
                  ? 'text-red-700 dark:text-red-400'
                  : 'text-admin-text-muted'
              }`}
            >
              {successRateDelta > 0 ? '+' : ''}
              {successRateDelta.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} pts
            </span>
          ) : (
            <span className="text-xs text-admin-text-muted tabular-nums">
              {extractionsTotal > 0 ? `${formatNumberFr(extractionsSuccess)} OK` : 'Aucune req.'}
            </span>
          )}
        </div>
        <div className="mt-2.5 pt-2 border-t border-admin-border/70 flex items-center justify-between text-xs text-admin-text-muted">
          <span>Entonnoir complet</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </button>

      {/* 3. Visiteurs humains */}
      <button
        type="button"
        onClick={() => onNavigate({ tab: 'visitors' })}
        className="group text-left bg-admin-surface border border-admin-border hover:border-admin-border-strong rounded-lg p-4 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-admin-accent/40"
      >
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-admin-text-secondary">
          <span>Visiteurs humains</span>
          <Users className="w-4 h-4 text-admin-text-muted group-hover:text-admin-accent transition-colors" />
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span className="font-mono text-2xl font-bold text-admin-text tabular-nums">
            {loading && humanVisits === 0 ? '—' : formatNumberFr(humanVisits)}
          </span>
          <span className="text-xs font-mono text-admin-text-muted tabular-nums">
            {totalVisits > 0 ? `${humanShareDisplay} humains` : 'D1 vérifiés'}
          </span>
        </div>
        <div className="mt-2.5 pt-2 border-t border-admin-border/70 flex items-center justify-between text-xs text-admin-text-muted">
          <span>Ouvrir l’audience</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </button>

      {/* 4. Erreurs */}
      <button
        type="button"
        onClick={() => onNavigate({ tab: 'extractions', subTab: 'erreurs' })}
        className="group text-left bg-admin-surface border border-admin-border hover:border-admin-border-strong rounded-lg p-4 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-admin-accent/40"
      >
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-admin-text-secondary">
          <span>Erreurs</span>
          <AlertTriangle
            className={`w-4 h-4 transition-colors ${
              extractionsError > 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-admin-text-muted group-hover:text-admin-accent'
            }`}
          />
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span
            className={`font-mono text-2xl font-bold tabular-nums ${
              extractionsError > 0
                ? 'text-red-700 dark:text-red-400'
                : 'text-admin-text'
            }`}
          >
            {loading && extractionsError === 0 ? '—' : formatNumberFr(extractionsError)}
          </span>
          <span className="text-xs font-mono text-admin-text-muted tabular-nums">
            {extractionsTotal > 0 ? `${errorRateDisplay} d’échec` : '—'}
          </span>
        </div>
        <div className="mt-2.5 pt-2 border-t border-admin-border/70 flex items-center justify-between text-xs text-admin-text-muted">
          <span>Explorer les erreurs</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </button>
    </section>
  );
};
