import React from 'react';
import { formatNumberFr, formatSafePercent } from '../adminMetricsLogic';

export interface AudienceSourcesSectionProps {
  categories: ReadonlyArray<{
    category: string;
    label: string;
    visits: number;
  }>;
  topReferrerHosts: ReadonlyArray<{
    host: string;
    category: string;
    visits: number;
  }>;
  topEntryPages: ReadonlyArray<{
    page: string;
    visits: number;
  }>;
  periodLabel: string;
}

export const AudienceSourcesSection: React.FC<AudienceSourcesSectionProps> = ({
  categories,
  topReferrerHosts,
  topEntryPages,
  periodLabel,
}) => {
  const totalSources = categories.reduce((acc, c) => acc + Math.max(0, Number(c.visits || 0)), 0);
  const totalEntry = topEntryPages.reduce((acc, p) => acc + Math.max(0, Number(p.visits || 0)), 0);

  return (
    <section
      aria-label="Sources de trafic et pages d'entrée"
      className="grid grid-cols-1 md:grid-cols-2 gap-4"
    >
      {/* Left: Traffic sources */}
      <div className="bg-admin-surface border border-admin-border rounded-lg p-4 sm:p-5 space-y-3">
        <div>
          <h2 className="font-display text-sm font-bold text-admin-text">
            Sources de trafic (D1 · {periodLabel})
          </h2>
          <p className="text-xs text-admin-text-muted">
            Visiteurs humains classés par origine du référent
          </p>
        </div>

        {totalSources === 0 ? (
          <p className="text-xs text-admin-text-muted py-6 text-center">
            Aucune source enregistrée sur cette période.
          </p>
        ) : (
          <div className="space-y-2.5">
            {categories.map((cat) => {
              const barPct =
                totalSources > 0 && cat.visits > 0
                  ? Math.max(3, Math.round((cat.visits / totalSources) * 100))
                  : 0;
              return (
                <div key={cat.category} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-admin-text">{cat.label}</span>
                    <span className="font-mono tabular-nums text-admin-text-secondary">
                      <strong className="text-admin-text">{formatNumberFr(cat.visits)}</strong>
                      <span className="text-admin-text-muted ml-2">
                        {formatSafePercent(cat.visits, totalSources)}
                      </span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-admin-muted overflow-hidden">
                    <div
                      className="h-full bg-admin-accent rounded-full"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {topReferrerHosts.length > 0 && (
              <div className="pt-3 border-t border-admin-border space-y-1.5">
                <span className="text-xs font-semibold text-admin-text-secondary block">
                  Principaux référents
                </span>
                <ul className="divide-y divide-admin-border/60 text-xs">
                  {topReferrerHosts.slice(0, 6).map((ref) => (
                    <li
                      key={`${ref.category}-${ref.host}`}
                      className="py-1.5 flex items-center justify-between gap-2"
                    >
                      <span className="font-mono text-admin-text truncate">{ref.host}</span>
                      <span className="font-mono text-admin-text-secondary tabular-nums shrink-0">
                        {formatNumberFr(ref.visits)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Top entry pages */}
      <div className="bg-admin-surface border border-admin-border rounded-lg p-4 sm:p-5 space-y-3">
        <div>
          <h2 className="font-display text-sm font-bold text-admin-text">
            Pages d’entrée (D1 · {periodLabel})
          </h2>
          <p className="text-xs text-admin-text-muted">
            Premières pages consultées par les visiteurs humains
          </p>
        </div>

        {topEntryPages.length === 0 || totalEntry === 0 ? (
          <p className="text-xs text-admin-text-muted py-6 text-center">
            Aucune page d’entrée enregistrée sur cette période.
          </p>
        ) : (
          <ul className="divide-y divide-admin-border/60 text-xs">
            {topEntryPages.slice(0, 10).map((item) => (
              <li
                key={item.page}
                className="py-2 flex items-center justify-between gap-3"
              >
                <span className="font-mono text-admin-text truncate" title={item.page}>
                  {item.page || '/'}
                </span>
                <span className="font-mono tabular-nums text-admin-text-secondary shrink-0">
                  <strong className="text-admin-text">{formatNumberFr(item.visits)}</strong>
                  <span className="text-admin-text-muted ml-2">
                    {formatSafePercent(item.visits, totalEntry)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
