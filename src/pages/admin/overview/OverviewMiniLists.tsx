import React from 'react';
import { ArrowRight } from '../AdminIcons';
import { getCountryNameFr } from '../worldCountriesGeo';
import {
  formatNumberFr,
  formatSafePercent,
  rankD1HumanCountries,
  type AdminNavigationTarget,
  type AdminOverviewPeriod,
  type PlatformTableRow,
} from '../adminMetricsLogic';

export interface OverviewCountryItem {
  countryCode: string;
  humanVisits: number;
  extractions: number;
}

export interface OverviewSourceItem {
  category: string;
  label: string;
  visits: number;
}

export interface OverviewMiniListsProps {
  platforms: readonly PlatformTableRow[];
  countries: readonly OverviewCountryItem[];
  sources: readonly OverviewSourceItem[];
  period?: AdminOverviewPeriod;
  periodLabel?: string;
  onNavigate: (target: AdminNavigationTarget) => void;
}

export const OverviewMiniLists: React.FC<OverviewMiniListsProps> = ({
  platforms,
  countries,
  sources,
  period,
  periodLabel,
  onNavigate,
}) => {
  const topPlatforms = [...platforms]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const rankedHumanCountries = rankD1HumanCountries(countries);
  const topCountries = rankedHumanCountries.slice(0, 5);
  const totalCountriesVol = rankedHumanCountries.reduce(
    (acc, c) => acc + c.humanVisits,
    0
  );
  const totalSourcesVol = sources.reduce((acc, s) => acc + Math.max(0, s.visits), 0);

  return (
    <section
      aria-label="Synthèse rapide par axe"
      className="grid grid-cols-1 md:grid-cols-3 gap-4"
    >
      {/* 1. Top plateformes (30j) */}
      <div className="bg-admin-surface border border-admin-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-bold text-admin-text">
            Top plateformes <span className="font-normal text-admin-text-muted">(30j)</span>
          </h2>
          <button
            type="button"
            onClick={() => onNavigate({ tab: 'extractions', subTab: 'plateformes' })}
            className="text-xs font-semibold text-admin-accent hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Détail</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {topPlatforms.every((p) => p.total === 0) ? (
          <p className="text-xs text-admin-text-muted py-4 text-center">
            Aucune extraction sur 30j.
          </p>
        ) : (
          <ul className="divide-y divide-admin-border/60">
            {topPlatforms.map((p) => (
              <li key={p.key}>
                <button
                  type="button"
                  onClick={() =>
                    onNavigate({
                      tab: 'extractions',
                      subTab: 'plateformes',
                      platform: p.key,
                    })
                  }
                  className="w-full py-2 flex items-center justify-between gap-2 text-xs hover:bg-admin-hover/50 rounded px-1 -mx-1 transition-colors cursor-pointer"
                >
                  <span className="font-medium text-admin-text truncate">{p.label}</span>
                  <span className="font-mono tabular-nums text-admin-text-secondary shrink-0">
                    <strong className="text-admin-text">{formatNumberFr(p.total)}</strong>
                    <span className="text-admin-text-muted ml-2">
                      {formatSafePercent(p.success, p.total)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 2. Top 5 pays (humains) */}
      <div className="bg-admin-surface border border-admin-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-bold text-admin-text">
            Top 5 pays (humains)
            {periodLabel && (
              <span className="font-normal text-admin-text-muted"> · {periodLabel}</span>
            )}
          </h2>
          <button
            type="button"
            onClick={() => onNavigate({ tab: 'visitors', period })}
            className="text-xs font-semibold text-admin-accent hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Audience</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {topCountries.length === 0 ? (
          <p className="text-xs text-admin-text-muted py-4 text-center">
            Aucune visite humaine enregistrée sur la période.
          </p>
        ) : (
          <ul className="divide-y divide-admin-border/60">
            {topCountries.map((c) => {
              const code = c.countryCode;
              const resolvedName = getCountryNameFr(code);
              const displayName =
                !resolvedName || resolvedName.toUpperCase() === code
                  ? code === 'XX'
                    ? 'Inconnu'
                    : code
                  : resolvedName;
              const vol = c.humanVisits;
              return (
                <li key={code}>
                  <button
                    type="button"
                    onClick={() => onNavigate({ tab: 'visitors', period })}
                    className="w-full py-2 flex items-center justify-between gap-2 text-xs hover:bg-admin-hover/50 rounded px-1 -mx-1 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center justify-center w-6 h-4 rounded bg-admin-muted border border-admin-border font-mono text-[10px] font-semibold text-admin-text-secondary shrink-0">
                        {code}
                      </span>
                      <span className="font-medium text-admin-text truncate">
                        {displayName}
                      </span>
                    </span>
                    <span className="font-mono tabular-nums text-admin-text-secondary shrink-0">
                      <strong className="text-admin-text">{formatNumberFr(vol)}</strong>
                      <span className="text-admin-text-muted ml-2">
                        {formatSafePercent(vol, totalCountriesVol)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 3. Sources de trafic */}
      <div className="bg-admin-surface border border-admin-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-bold text-admin-text">
            Sources de trafic
            {periodLabel && (
              <span className="font-normal text-admin-text-muted"> · {periodLabel}</span>
            )}
          </h2>
          <button
            type="button"
            onClick={() => onNavigate({ tab: 'visitors', period })}
            className="text-xs font-semibold text-admin-accent hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Détail</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {sources.length === 0 || totalSourcesVol === 0 ? (
          <p className="text-xs text-admin-text-muted py-4 text-center">
            Aucune visite enregistrée sur la période.
          </p>
        ) : (
          <ul className="divide-y divide-admin-border/60">
            {sources.map((src) => (
              <li key={src.category}>
                <button
                  type="button"
                  onClick={() => onNavigate({ tab: 'visitors' })}
                  className="w-full py-2 flex items-center justify-between gap-2 text-xs hover:bg-admin-hover/50 rounded px-1 -mx-1 transition-colors cursor-pointer"
                >
                  <span className="font-medium text-admin-text truncate">{src.label}</span>
                  <span className="font-mono tabular-nums text-admin-text-secondary shrink-0">
                    <strong className="text-admin-text">{formatNumberFr(src.visits)}</strong>
                    <span className="text-admin-text-muted ml-2">
                      {formatSafePercent(src.visits, totalSourcesVol)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
