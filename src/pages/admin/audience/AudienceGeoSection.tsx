import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from '../AdminIcons';
import { WorldMapVisualization } from '../WorldMapVisualization';
import type { CountryVisitorsRow } from '../Visitors';
import {
  formatBytesFr,
  formatNumberFr,
  formatSafePercent,
} from '../adminMetricsLogic';

export interface AudienceGeoSectionProps {
  countries: readonly CountryVisitorsRow[];
  periodLabel: string;
  sourceLabel: string;
}

export const AudienceGeoSection: React.FC<AudienceGeoSectionProps> = ({
  countries,
  periodLabel,
  sourceLabel,
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-sm font-bold text-admin-text">
            Géographie ({periodLabel})
          </h2>
          <p className="text-xs text-admin-text-muted">{sourceLabel}</p>
        </div>
        <span className="text-xs font-mono text-admin-text-secondary tabular-nums">
          {formatNumberFr(sortedCountries.length)} pays actifs
        </span>
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
            <span>Top 10 pays</span>
            <span>Volume / Part</span>
          </div>

          {top10.length === 0 ? (
            <p className="text-xs text-admin-text-muted py-8 text-center">
              Aucune donnée géographique sur cette période.
            </p>
          ) : (
            <ul className="space-y-2">
              {top10.map((row) => {
                const barWidth =
                  maxTopRequests > 0
                    ? Math.max(4, Math.round((row.requests / maxTopRequests) * 100))
                    : 0;
                return (
                  <li key={row.countryCode} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 min-w-0">
                        <span aria-hidden="true">{row.flag}</span>
                        <span className="font-medium text-admin-text truncate">
                          {row.countryName}
                        </span>
                        <span className="font-mono text-[11px] text-admin-text-muted">
                          {row.countryCode}
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
                      filteredAll.map((row, idx) => (
                        <tr key={row.countryCode} className="hover:bg-admin-hover/40">
                          <td className="py-2 pl-3 pr-2 font-mono text-admin-text-muted tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3">
                            <span className="inline-flex items-center gap-2">
                              <span aria-hidden="true">{row.flag}</span>
                              <span className="font-medium text-admin-text">
                                {row.countryName}
                              </span>
                              <span className="font-mono text-[11px] text-admin-text-muted">
                                {row.countryCode}
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
                      ))
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
