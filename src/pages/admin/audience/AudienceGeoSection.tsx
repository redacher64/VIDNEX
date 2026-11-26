import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from '../AdminIcons';
import { WorldMapVisualization } from '../WorldMapVisualization';
import type { CountryVisitorsRow } from '../Visitors';
import {
  formatBytesFr,
  formatNumberFr,
  formatSafePercent,
  type AudienceGeoSource,
} from '../adminMetricsLogic';

export interface AudienceGeoSectionProps {
  countries: readonly CountryVisitorsRow[];
  periodLabel: string;
  sourceLabel: string;
  geoSource: AudienceGeoSource;
  onChangeGeoSource: (next: AudienceGeoSource) => void;
}

const GEO_SOURCE_OPTIONS: ReadonlyArray<{ id: AudienceGeoSource; label: string }> = [
  { id: 'd1_humans', label: 'Humains (D1)' },
  { id: 'cf_raw', label: 'Trafic brut (CF)' },
];

export const AudienceGeoSection: React.FC<AudienceGeoSectionProps> = ({
  countries,
  periodLabel,
  sourceLabel,
  geoSource,
  onChangeGeoSource,
}) => {
  const [showAll, setShowAll] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const sortedCountries = useMemo(
    () => [...countries].sort((a, b) => b.requests - a.requests),
    [countries]
  );

  const totalRequests = useMemo(
    () => sortedCountries.reduce((acc, c) => acc + Math.max(0, Number(c.requests || 0)), 0),
    [sortedCountries]
  );

  const top10 = sortedCountries.slice(0, 10);
  const maxTopRequests = top10[0]?.requests || 0;

  const filteredAll = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return sortedCountries;
    return sortedCountries.filter(
      (c) =>
        c.countryName.toLowerCase().includes(q) ||
        c.countryCode.toLowerCase().includes(q)
    );
  }, [sortedCountries, countrySearch]);

  const handleSelectCountryFromMap = (iso: string) => {
    setShowAll(true);
    setCountrySearch((prev) => (prev.toUpperCase() === iso ? '' : iso));
  };

  return (
    <section
      aria-label="Répartition géographique"
      className="bg-admin-surface border border-admin-border rounded-lg p-4 sm:p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-bold text-admin-text">
            Géographie ({periodLabel})
          </h2>
          <p className="text-xs text-admin-text-muted">{sourceLabel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Source de la répartition géographique"
            className="inline-flex items-center rounded-md border border-admin-border bg-admin-muted p-0.5"
          >
            {GEO_SOURCE_OPTIONS.map((opt) => {
              const active = geoSource === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChangeGeoSource(opt.id)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-admin-accent text-white'
                      : 'text-admin-text-secondary hover:text-admin-text'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <span className="text-xs font-mono text-admin-text-secondary tabular-nums whitespace-nowrap">
            {formatNumberFr(sortedCountries.length)} pays actifs
          </span>
        </div>
      </div>

      {/* Compact 2-column layout: Map left (max ~280px) + Top 10 countries right */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        <div className="md:col-span-7">
          <WorldMapVisualization
            countries={sortedCountries}
            periodLabel={periodLabel}
            compact={true}
            onSelectCountry={handleSelectCountryFromMap}
          />
        </div>

        <div className="md:col-span-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-admin-text-secondary pb-1 border-b border-admin-border">
            <span>
              {geoSource === 'd1_humans' ? 'Top 10 pays (humains)' : 'Top 10 pays (brut CF)'}
            </span>
            <span>Volume / Part</span>
          </div>

          {top10.length === 0 ? (
            <p className="text-xs text-admin-text-muted py-8 text-center">
              {geoSource === 'd1_humans'
                ? 'Aucune visite humaine D1 sur cette période.'
                : 'Aucune donnée Cloudflare brute sur cette période.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {top10.map((row) => {
                const code = (row.countryCode || 'XX').toUpperCase();
                const displayName =
                  !row.countryName || row.countryName.toUpperCase() === code
                    ? code === 'XX'
                      ? 'Inconnu'
                      : code
                    : row.countryName;
                const barWidth =
                  maxTopRequests > 0
                    ? Math.max(4, Math.round((row.requests / maxTopRequests) * 100))
                    : 0;
                return (
                  <li key={code} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="inline-flex items-center justify-center w-6 h-4 rounded bg-admin-muted border border-admin-border font-mono text-[10px] font-semibold text-admin-text-secondary shrink-0">
                          {code}
                        </span>
                        <span className="font-medium text-admin-text truncate">
                          {displayName}
                        </span>
                      </span>
                      <span className="font-mono tabular-nums shrink-0 text-admin-text">
                        <strong>{formatNumberFr(row.requests)}</strong>
                        <span className="text-admin-text-muted ml-1.5">
                          {formatSafePercent(row.requests, totalRequests)}
                        </span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-admin-muted overflow-hidden">
                      <div
                        className="h-full bg-admin-accent rounded-full"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Collapsible full countries table ("Voir tout") */}
      {sortedCountries.length > 0 && (
        <div className="pt-3 border-t border-admin-border space-y-3">
          <button
            type="button"
            aria-expanded={showAll}
            onClick={() => setShowAll((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-admin-accent hover:underline cursor-pointer"
          >
            <span>
              {showAll
                ? 'Masquer le tableau complet'
                : `Voir tout (${sortedCountries.length} pays)`}
            </span>
            {showAll ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showAll && (
            <div className="space-y-3">
              <input
                type="search"
                aria-label="Filtrer un pays"
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                placeholder="Filtrer par pays ou code ISO (ex: France, MA)…"
                className="w-full md:w-72 px-3 py-1.5 rounded-md bg-admin-muted border border-admin-border-strong text-xs text-admin-text placeholder-admin-text-muted focus:outline-none focus:border-admin-accent"
              />

              <div className="overflow-x-auto border border-admin-border rounded-md">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-admin-border bg-admin-muted/60 text-admin-text-secondary font-semibold">
                      <th className="py-2.5 pl-3 pr-2 w-10">#</th>
                      <th className="py-2.5 px-3">Pays</th>
                      <th className="py-2.5 px-3 text-right">Volume</th>
                      <th className="py-2.5 px-3 text-right hidden md:table-cell">
                        Bande passante
                      </th>
                      <th className="py-2.5 pl-3 pr-3 text-right">Part</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-admin-border/70">
                    {filteredAll.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-admin-text-muted">
                          Aucun pays ne correspond à « {countrySearch} ».
                        </td>
                      </tr>
                    ) : (
                      filteredAll.map((row, idx) => {
                        const code = (row.countryCode || 'XX').toUpperCase();
                        const displayName =
                          !row.countryName || row.countryName.toUpperCase() === code
                            ? code === 'XX'
                              ? 'Inconnu'
                              : code
                            : row.countryName;
                        return (
                        <tr key={code} className="hover:bg-admin-hover/40">
                          <td className="py-2 pl-3 pr-2 font-mono text-admin-text-muted tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3">
                            <span className="inline-flex items-center gap-2">
                              <span className="inline-flex items-center justify-center w-6 h-4 rounded bg-admin-muted border border-admin-border font-mono text-[10px] font-semibold text-admin-text-secondary shrink-0">
                                {code}
                              </span>
                              <span className="font-medium text-admin-text">
                                {displayName}
                              </span>
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-admin-text tabular-nums">
                            {formatNumberFr(row.requests)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-admin-text-secondary hidden md:table-cell tabular-nums">
                            {row.bytes ? formatBytesFr(row.bytes) : '—'}
                          </td>
                          <td className="py-2 pl-3 pr-3 text-right font-mono font-semibold text-admin-accent tabular-nums">
                            {formatSafePercent(row.requests, totalRequests)}
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
