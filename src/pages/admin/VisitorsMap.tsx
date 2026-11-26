import React, { useMemo, useState } from 'react';
import {
  Globe,
  Users,
  BarChart3,
  CheckCircle2,
  ShieldCheck,
} from './AdminIcons';
import {
  buildD1VisitorsMapSummary,
  CHOROPLETH_COLORS,
  getChoroplethFill,
  type VisitorsMapPeriod,
  type D1StatsSeedInput,
  type D1VisitorOriginRecord,
} from './visitorsMapLogic';
import {
  WORLD_COUNTRY_SHAPES,
  getCountryFlag,
  getCountryNameFr,
} from './worldCountriesGeo';

export {
  buildD1VisitorsMapSummary,
  type VisitorsMapPeriod,
  type D1StatsSeedInput,
};

export interface VisitorsMapProps {
  d1Stats?: D1StatsSeedInput | null;
  initialPeriod?: VisitorsMapPeriod;
  period?: VisitorsMapPeriod;
  onPeriodChange?: (period: VisitorsMapPeriod) => void;
}

interface HoveredCountryTooltip {
  code: string;
  nameFr: string;
  flag: string;
  visitors: number;
  extractions: number;
  successRate: number | null;
  xPct: number;
  yPct: number;
}

const PERIOD_LABELS: Record<VisitorsMapPeriod, string> = {
  today: 'Aujourd’hui',
  '7d': '7 jours',
  '30d': '30 jours',
};

function formatFrNumber(value: number): string {
  return Math.max(0, Number(value) || 0).toLocaleString('fr-FR');
}

export const VisitorsMap: React.FC<VisitorsMapProps> = ({
  d1Stats,
  initialPeriod = '30d',
  period: controlledPeriod,
  onPeriodChange,
}) => {
  const [internalPeriod, setInternalPeriod] = useState<VisitorsMapPeriod>(initialPeriod);
  const period = controlledPeriod ?? internalPeriod;
  const setPeriod = (next: VisitorsMapPeriod) => {
    if (onPeriodChange) {
      onPeriodChange(next);
    } else {
      setInternalPeriod(next);
    }
  };

  const [hoveredTooltip, setHoveredTooltip] = useState<HoveredCountryTooltip | null>(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);

  const summary = useMemo(
    () => buildD1VisitorsMapSummary(period, d1Stats),
    [period, d1Stats]
  );

  const countryByCode = useMemo(() => {
    const map = new Map<string, D1VisitorOriginRecord>();
    for (const c of summary.countries) {
      map.set(c.countryCode, c);
    }
    return map;
  }, [summary.countries]);

  // Choropleth coloring is driven by real human visitors (falls back to extractions only if 0 visits recorded)
  const useVisitsForColor = summary.humanVisits > 0;
  const maxChoroplethValue = useMemo(() => {
    if (useVisitsForColor) return summary.maxCountryVisitors;
    return summary.countries.reduce((max, c) => Math.max(max, c.extractions), 0);
  }, [useVisitsForColor, summary.maxCountryVisitors, summary.countries]);

  const handleShapePointer = (
    e: React.MouseEvent<SVGPathElement>,
    code: string,
    nameFr: string
  ) => {
    const svg = e.currentTarget.ownerSVGElement;
    let xPct = 50;
    let yPct = 30;
    if (svg) {
      const rect = svg.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        xPct = Math.min(82, Math.max(18, ((e.clientX - rect.left) / rect.width) * 100));
        yPct = Math.min(84, Math.max(12, ((e.clientY - rect.top) / rect.height) * 100));
      }
    }
    const stats = countryByCode.get(code);
    setHoveredTooltip({
      code,
      nameFr: stats?.countryName || nameFr || getCountryNameFr(code),
      flag: stats?.flag || getCountryFlag(code),
      visitors: stats?.visitors ?? 0,
      extractions: stats?.extractions ?? 0,
      successRate: stats?.successRate ?? null,
      xPct,
      yPct,
    });
  };

  const maxCountryRankValue = useMemo(() => {
    if (summary.countries.length === 0) return 1;
    return Math.max(
      1,
      ...summary.countries.map((c) => (useVisitsForColor ? c.visitors : c.extractions))
    );
  }, [summary.countries, useVisitsForColor]);

  return (
    <section
      aria-label="Carte mondiale et sources des visiteurs D1"
      className="bg-admin-surface border border-admin-border rounded-lg p-5 space-y-5 shadow-2xs"
    >
      {/* En-tête + Sélecteur de période unique */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-admin-accent-bg border border-admin-accent-border flex items-center justify-center text-admin-accent shrink-0 mt-0.5">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display text-sm sm:text-base font-bold text-admin-text">
              Carte Mondiale &amp; Visiteurs Réels (D1)
            </h3>
            <p className="text-xs text-admin-text-muted">
              Visites sans cookie (<span className="font-mono">page_visits</span>) et extractions par pays (
              <span className="font-mono">daily_country_metrics</span>) · {PERIOD_LABELS[period]}
            </p>
          </div>
        </div>

        <div
          role="group"
          aria-label="Période de la carte et des visiteurs"
          className="inline-flex rounded-lg p-1 border border-admin-border"
        >
          {(
            [
              { id: 'today', label: 'Aujourd’hui' },
              { id: '7d', label: '7j' },
              { id: '30d', label: '30j' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPeriod(tab.id)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                period === tab.id
                  ? 'bg-admin-accent text-white shadow-2xs'
                  : 'text-admin-text-secondary hover:text-admin-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4 KPI cohérents D1 : Humains, Bots, Extractions, Taux de succès */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg border border-admin-border space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-admin-text-secondary">
            <span>Visiteurs humains</span>
            <Users className="w-3.5 h-3.5 text-admin-text-muted" />
          </div>
          <p className="font-mono text-xl font-bold text-admin-text tabular-nums">
            {formatFrNumber(summary.humanVisits)}
          </p>
          <p className="text-xs text-admin-text-muted">
            {summary.mostActiveCountry
              ? `Top : ${summary.mostActiveCountry.flag} ${summary.mostActiveCountry.countryName}`
              : 'Aucune visite enregistrée'}
          </p>
        </div>

        <div className="p-3.5 rounded-lg border border-admin-border space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-admin-text-secondary">
            <span>Visites bots (filtrées)</span>
            <ShieldCheck className="w-3.5 h-3.5 text-admin-text-muted" />
          </div>
          <p className="font-mono text-xl font-bold text-admin-text-secondary tabular-nums">
            {formatFrNumber(summary.botVisits)}
          </p>
          <p className="text-xs text-admin-text-muted">
            Total brut : <span className="font-mono">{formatFrNumber(summary.totalVisits)}</span> (humains + bots)
          </p>
        </div>

        <div className="p-3.5 rounded-lg border border-admin-border space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-admin-text-secondary">
            <span>Extractions ({PERIOD_LABELS[period]})</span>
            <BarChart3 className="w-3.5 h-3.5 text-admin-text-muted" />
          </div>
          <p className="font-mono text-xl font-bold text-admin-text tabular-nums">
            {formatFrNumber(summary.totalExtractions)}
          </p>
          <p className="text-xs text-admin-text-muted">
            <span className="font-mono">{formatFrNumber(summary.totalExtractSuccess)}</span> OK ·{' '}
            <span className="font-mono">{formatFrNumber(summary.totalExtractError)}</span> échecs
          </p>
        </div>

        <div className="p-3.5 rounded-lg border border-admin-border space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-admin-text-secondary">
            <span>Taux de succès ({PERIOD_LABELS[period]})</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-admin-text-muted" />
          </div>
          <p
            className={`font-mono text-xl font-bold tabular-nums ${
              summary.totalExtractions === 0
                ? 'text-admin-text-muted'
                : summary.globalSuccessRate >= 80
                ? 'text-emerald-800 dark:text-emerald-400'
                : summary.globalSuccessRate >= 50
                ? 'text-amber-800 dark:text-amber-400'
                : 'text-red-800 dark:text-red-400'
            }`}
          >
            {summary.totalExtractions > 0 ? `${summary.globalSuccessRate}%` : '—'}
          </p>
          <p className="text-xs text-admin-text-muted">
            <span className="font-mono">{summary.countries.length}</span> pays actifs dans D1
          </p>
        </div>
      </div>

      {/* Carte Choroplèthe SVG embarquée (une seule couleur : plus il y a de visiteurs, plus c'est foncé) */}
      <div className="rounded-lg border border-admin-border bg-[#f6f1eb] dark:bg-[#ece4dc] p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5c4838]">
          <span className="font-semibold">
            Carte choroplèthe par pays ({useVisitsForColor ? 'visiteurs humains' : 'extractions D1'})
          </span>
          <span>Survolez un pays pour voir le détail</span>
        </div>

        <div className="relative w-full aspect-[2/1] min-h-[220px] select-none">
          <svg
            viewBox="0 0 1000 500"
            className="w-full h-full block"
            role="img"
            aria-label="Carte choroplèthe mondiale des visiteurs par pays"
            onMouseLeave={() => setHoveredTooltip(null)}
          >
            {/* Fond océan très léger */}
            <rect x="0" y="0" width="1000" height="500" fill="#f6f1eb" rx="6" />

            {/* Grille latitude/longitude discrète */}
            {[125, 250, 375].map((y) => (
              <line
                key={`lat-${y}`}
                x1="0"
                y1={y}
                x2="1000"
                y2={y}
                stroke="#e2d9cf"
                strokeWidth="0.6"
                strokeDasharray="3 4"
              />
            ))}

            {/* Polygones GeoJSON embarqués par pays */}
            {WORLD_COUNTRY_SHAPES.map((shape) => {
              const stats = countryByCode.get(shape.code);
              const value = useVisitsForColor
                ? stats?.visitors ?? 0
                : stats?.extractions ?? 0;
              const fill = getChoroplethFill(value, maxChoroplethValue);
              const isSelected = selectedCountryCode === shape.code;
              const isHovered = hoveredTooltip?.code === shape.code;

              return (
                <path
                  key={shape.code}
                  d={shape.d}
                  data-country={shape.code}
                  fill={fill}
                  stroke={isHovered || isSelected ? '#431407' : '#ffffff'}
                  strokeWidth={isHovered || isSelected ? 1.4 : 0.65}
                  strokeLinejoin="round"
                  onMouseEnter={(e) => handleShapePointer(e, shape.code, shape.nameFr)}
                  onMouseMove={(e) => handleShapePointer(e, shape.code, shape.nameFr)}
                  onClick={() =>
                    setSelectedCountryCode((prev) =>
                      prev === shape.code ? null : shape.code
                    )
                  }
                  className="cursor-pointer transition-colors duration-150"
                >
                  <title>
                    {`${shape.nameFr} (${shape.code}) — ${formatFrNumber(
                      stats?.visitors ?? 0
                    )} visiteurs, ${formatFrNumber(stats?.extractions ?? 0)} extractions`}
                  </title>
                </path>
              );
            })}
          </svg>

          {/* Tooltip au survol */}
          {hoveredTooltip && (
            <div
              role="tooltip"
              style={{
                left: `${hoveredTooltip.xPct}%`,
                top: `${hoveredTooltip.yPct}%`,
                transform:
                  hoveredTooltip.yPct < 36
                    ? 'translate(-50%, 16px)'
                    : 'translate(-50%, -115%)',
              }}
              className="pointer-events-none absolute z-20 min-w-[195px] rounded-lg border border-[#d6c8ba] bg-[#1c140f]/95 text-[#fffaf5] px-3 py-2 shadow-lg text-xs space-y-1"
            >
              <div className="flex items-center gap-1.5 font-display font-bold text-xs">
                <span>{hoveredTooltip.flag}</span>
                <span>{hoveredTooltip.nameFr}</span>
                <span className="font-mono text-[11px] text-[#d6b79c]">
                  ({hoveredTooltip.code})
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[11px] text-[#f3e4d7]">
                <span className="text-[#c8a98e] font-sans">Visiteurs :</span>
                <span className="text-right font-semibold tabular-nums">
                  {formatFrNumber(hoveredTooltip.visitors)}
                </span>
                <span className="text-[#c8a98e] font-sans">Extractions :</span>
                <span className="text-right font-semibold tabular-nums">
                  {formatFrNumber(hoveredTooltip.extractions)}
                </span>
                <span className="text-[#c8a98e] font-sans">Taux succès :</span>
                <span className="text-right font-semibold tabular-nums">
                  {hoveredTooltip.successRate !== null
                    ? `${hoveredTooltip.successRate}%`
                    : '—'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Légende simple (échelle monochrome) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#e0d6cb] text-xs text-[#5c4838]">
          <div className="flex items-center gap-2">
            <span>0</span>
            <div className="flex items-center gap-1" aria-label="Échelle choroplèthe des visiteurs">
              {CHOROPLETH_COLORS.map((hex, idx) => (
                <span
                  key={hex}
                  title={idx === 0 ? '0 visite' : `Palier ${idx}/5`}
                  className="w-5 h-3 rounded-xs border border-black/10 inline-block"
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
            <span className="font-mono font-semibold">
              {maxChoroplethValue > 0
                ? `${formatFrNumber(maxChoroplethValue)} max`
                : 'Aucune donnée'}
            </span>
          </div>
          <span className="text-[11px] text-[#7a6250]">
            GeoJSON embarqué · 0 requête externe · Source unique D1
          </span>
        </div>
      </div>

      {/* Classement des pays (drapeau + barre) sous la carte */}
      <div className="p-4 rounded-lg border border-admin-border space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-display text-xs font-bold text-admin-text-secondary">
            Classement des pays ({summary.countries.length} pays · {PERIOD_LABELS[period]})
          </h4>
          <span className="text-xs text-admin-text-muted">
            Visiteurs humains · Extractions · Taux de succès
          </span>
        </div>

        {summary.countries.length === 0 ? (
          <p className="text-xs text-admin-text-muted py-4 text-center">
            Aucune donnée géographique enregistrée dans D1 pour cette période.
          </p>
        ) : (
          <div className="space-y-2.5">
            {summary.countries.slice(0, 12).map((country, idx) => {
              const barValue = useVisitsForColor ? country.visitors : country.extractions;
              const widthPct = Math.max(
                4,
                Math.round((barValue / maxCountryRankValue) * 100)
              );
              const isSelected = selectedCountryCode === country.countryCode;

              return (
                <button
                  key={country.countryCode}
                  type="button"
                  onClick={() =>
                    setSelectedCountryCode((prev) =>
                      prev === country.countryCode ? null : country.countryCode
                    )
                  }
                  className={`w-full text-left p-2.5 rounded-md border transition-colors cursor-pointer space-y-1.5 ${
                    isSelected
                      ? 'border-admin-accent bg-admin-accent-bg/40'
                      : 'border-admin-border hover:border-admin-border-strong'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-admin-text-muted w-5 shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="text-base leading-none shrink-0">
                        {country.flag}
                      </span>
                      <span className="font-semibold text-admin-text truncate">
                        {country.countryName}
                      </span>
                      <span className="font-mono text-admin-text-muted text-[11px]">
                        {country.countryCode}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 font-mono text-xs tabular-nums">
                      <span className="font-bold text-admin-text">
                        {formatFrNumber(country.visitors)} vis.
                      </span>
                      <span className="text-admin-text-secondary">
                        {formatFrNumber(country.extractions)} extr.
                      </span>
                      <span
                        className={`font-semibold ${
                          country.successRate === null
                            ? 'text-admin-text-muted'
                            : country.successRate >= 80
                            ? 'text-emerald-800 dark:text-emerald-400'
                            : country.successRate >= 50
                            ? 'text-amber-800 dark:text-amber-400'
                            : 'text-red-800 dark:text-red-400'
                        }`}
                      >
                        {country.successRate !== null ? `${country.successRate}% OK` : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-admin-muted border border-admin-border overflow-hidden">
                    <div
                      className="h-full bg-orange-600 dark:bg-orange-500 rounded-full transition-all duration-300"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bloc "D'où viennent les visiteurs" : Catégories + Top 10 pages d'entrée */}
      <div className="p-4 rounded-lg border border-admin-border space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-display text-sm font-bold text-admin-text">
              D’où viennent les visiteurs ({PERIOD_LABELS[period]})
            </h4>
            <p className="text-xs text-admin-text-muted">
              Sources des visiteurs humains (hors bots) et top 10 des pages d’entrée
            </p>
          </div>
          <span className="text-xs font-mono text-admin-text-secondary tabular-nums">
            {formatFrNumber(summary.humanVisits)} humain(s) · {formatFrNumber(summary.botVisits)} bot(s)
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Répartition par catégorie (Recherche / Direct / Réseaux sociaux / Autres sites) */}
          <div className="lg:col-span-5 space-y-3">
            <h5 className="text-xs font-semibold text-admin-text-secondary">
              Sources de trafic
            </h5>
            <div className="space-y-2.5">
              {summary.sources.categories.map((cat) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-admin-text">{cat.label}</span>
                    <span className="font-mono tabular-nums text-admin-text-secondary">
                      <strong className="text-admin-text">{formatFrNumber(cat.visits)}</strong>{' '}
                      ({cat.sharePct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-admin-muted border border-admin-border overflow-hidden">
                    <div
                      className="h-full bg-orange-600 dark:bg-orange-500 rounded-full transition-all duration-300"
                      style={{
                        width: `${cat.visits > 0 ? Math.max(4, cat.sharePct) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {summary.sources.topReferrerHosts.length > 0 && (
              <div className="pt-2 border-t border-admin-border/70 space-y-1.5">
                <div className="text-xs font-semibold text-admin-text-secondary">
                  Domaines référents principaux
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {summary.sources.topReferrerHosts.map((ref) => (
                    <span
                      key={ref.host}
                      className="text-xs font-mono px-2 py-0.5 rounded-md bg-admin-muted border border-admin-border text-admin-text-secondary"
                    >
                      {ref.host} ({formatFrNumber(ref.visits)})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Top 10 pages d'entrée */}
          <div className="lg:col-span-7 space-y-2.5">
            <h5 className="text-xs font-semibold text-admin-text-secondary">
              Top 10 pages d’entrée
            </h5>
            {summary.sources.topEntryPages.length === 0 ? (
              <p className="text-xs text-admin-text-muted py-4 text-center border border-admin-border rounded-md">
                Aucune visite humaine enregistrée sur cette période.
              </p>
            ) : (
              <div className="overflow-x-auto border border-admin-border rounded-md">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-admin-border text-admin-text-muted bg-admin-muted/40">
                      <th className="py-2 px-2.5 font-semibold">#</th>
                      <th className="py-2 px-2.5 font-semibold">Page d’entrée</th>
                      <th className="py-2 px-2.5 text-right font-semibold">Visites</th>
                      <th className="py-2 px-2.5 text-right font-semibold">Part</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-admin-border/60 font-mono">
                    {summary.sources.topEntryPages.map((entry, idx) => (
                      <tr key={entry.page} className="hover:bg-admin-hover/40">
                        <td className="py-1.5 px-2.5 text-admin-text-muted">
                          {idx + 1}
                        </td>
                        <td className="py-1.5 px-2.5 text-admin-text break-all">
                          {entry.page}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-semibold text-admin-text tabular-nums">
                          {formatFrNumber(entry.visits)}
                        </td>
                        <td className="py-1.5 px-2.5 text-right text-admin-text-secondary tabular-nums">
                          {entry.sharePct}%
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
    </section>
  );
};
