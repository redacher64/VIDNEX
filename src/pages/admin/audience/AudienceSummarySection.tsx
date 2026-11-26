import React from 'react';
import {
  formatCompactNumberFr,
  formatNumberFr,
  formatSafePercent,
  formatSafeRateValue,
} from '../adminMetricsLogic';

export interface AudienceSummarySectionProps {
  periodShortLabel: string;
  loading: boolean;
  // Source 1: Humains vérifiés (D1)
  d1HumanVisits: number;
  d1BotVisits: number;
  d1Extractions: number;
  // Source 2: Trafic brut Cloudflare (bots inclus)
  cfTotalRequests: number;
  cfUniqueVisitors: number;
  cfPageViews: number;
  cfCacheHitRate: number;
}

export const AudienceSummarySection: React.FC<AudienceSummarySectionProps> = ({
  periodShortLabel,
  loading,
  d1HumanVisits,
  d1BotVisits,
  d1Extractions,
  cfTotalRequests,
  cfUniqueVisitors,
  cfPageViews,
  cfCacheHitRate,
}) => {
  const totalD1Visits = d1HumanVisits + d1BotVisits;

  return (
    <div className="space-y-4">
      {/* Source 1: Humains vérifiés (D1) */}
      <section aria-label="Humains vérifiés D1" className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xs font-bold uppercase tracking-wider text-admin-text-secondary">
            Humains vérifiés (D1)
          </h2>
          <span className="text-xs text-admin-text-muted">
            Balise sans cookie · période {periodShortLabel}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-admin-surface border border-admin-border rounded-lg p-4">
            <span className="text-xs font-medium text-admin-text-secondary block">
              Visiteurs humains
            </span>
            <span className="font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-1 block">
              {loading && d1HumanVisits === 0 ? '—' : formatNumberFr(d1HumanVisits)}
            </span>
          </div>

          <div className="bg-admin-surface border border-admin-border rounded-lg p-4">
            <span className="text-xs font-medium text-admin-text-secondary block">
              Bots filtrés
            </span>
            <span className="font-mono text-2xl font-bold text-admin-text tabular-nums mt-1 block">
              {loading && d1BotVisits === 0 ? '—' : formatNumberFr(d1BotVisits)}
            </span>
          </div>

          <div className="bg-admin-surface border border-admin-border rounded-lg p-4">
            <span className="text-xs font-medium text-admin-text-secondary block">
              Part humaine
            </span>
            <span className="font-mono text-2xl font-bold text-admin-text tabular-nums mt-1 block">
              {formatSafePercent(d1HumanVisits, totalD1Visits)}
            </span>
          </div>

          <div className="bg-admin-surface border border-admin-border rounded-lg p-4">
            <span className="text-xs font-medium text-admin-text-secondary block">
              Extractions associées
            </span>
            <span className="font-mono text-2xl font-bold text-admin-text tabular-nums mt-1 block">
              {loading && d1Extractions === 0 ? '—' : formatNumberFr(d1Extractions)}
            </span>
          </div>
        </div>
      </section>

      {/* Source 2: Trafic brut Cloudflare (bots inclus) */}
      <section aria-label="Trafic brut Cloudflare bots inclus" className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xs font-bold uppercase tracking-wider text-admin-text-secondary">
            Trafic brut Cloudflare (bots inclus)
          </h2>
          <span className="text-xs text-admin-text-muted">
            Edge HTTP · période {periodShortLabel}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-admin-surface border border-admin-border rounded-lg p-4">
            <span className="text-xs font-medium text-admin-text-secondary block">
              Requêtes Edge
            </span>
            <span className="font-mono text-2xl font-bold text-admin-text tabular-nums mt-1 block">
              {loading && cfTotalRequests === 0 ? '—' : formatCompactNumberFr(cfTotalRequests)}
            </span>
          </div>

          <div className="bg-admin-surface border border-admin-border rounded-lg p-4">
            <span className="text-xs font-medium text-admin-text-secondary block">
              IP uniques (CF)
            </span>
            <span className="font-mono text-2xl font-bold text-admin-text tabular-nums mt-1 block">
              {loading && cfUniqueVisitors === 0 ? '—' : formatCompactNumberFr(cfUniqueVisitors)}
            </span>
          </div>

          <div className="bg-admin-surface border border-admin-border rounded-lg p-4">
            <span className="text-xs font-medium text-admin-text-secondary block">
              Pages vues (CF)
            </span>
            <span className="font-mono text-2xl font-bold text-admin-text tabular-nums mt-1 block">
              {loading && cfPageViews === 0 ? '—' : formatCompactNumberFr(cfPageViews)}
            </span>
          </div>

          <div className="bg-admin-surface border border-admin-border rounded-lg p-4">
            <span className="text-xs font-medium text-admin-text-secondary block">
              Taux de cache Edge
            </span>
            <span className="font-mono text-2xl font-bold text-admin-text tabular-nums mt-1 block">
              {formatSafeRateValue(cfCacheHitRate, cfTotalRequests)}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};
