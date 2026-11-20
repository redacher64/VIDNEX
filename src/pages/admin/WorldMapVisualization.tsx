import React, { useMemo, useState } from 'react';
import {
  Globe,
  BarChart3,
} from './AdminIcons';
import {
  computeGeoMapAnalytics,
  type GeoInputCountryRow,
  type GeoMetricMode,
  type GeoRegionKey,
  type EnrichedMapCountryPoint,
} from './worldMapLogic';

export interface WorldMapVisualizationProps {
  countries: GeoInputCountryRow[];
  periodLabel?: string;
  variant?: 'slate' | 'admin';
  sourceLabel?: string;
  onSelectCountry?: (countryCode: string) => void;
}

function formatNum(n: number | undefined | null): string {
  return Math.max(0, Number(n) || 0).toLocaleString('fr-FR');
}

function formatBytesShort(bytes: number | undefined | null): string {
  const b = Math.max(0, Number(bytes) || 0);
  if (b === 0) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
  const val = b / Math.pow(1024, i);
  return `${val.toLocaleString('fr-FR', {
    maximumFractionDigits: i >= 2 ? 2 : 0,
  })} ${units[i]}`;
}

/**
 * Stylized continent silhouettes projected onto the 1000x500 viewBox
 * matching projectLatLonToSvg (+75..-60 lat, -180..+180 lon).
 */
const CONTINENT_SILHOUETTES: Array<{
  id: string;
  region: Exclude<GeoRegionKey, 'all'>;
  name: string;
  d: string;
}> = [
  {
    id: 'north-america',
    region: 'americas',
    name: 'Amérique du Nord',
    d: 'M 65,65 L 185,55 L 295,62 L 338,110 L 308,165 L 265,212 L 245,248 L 210,235 L 178,195 L 135,148 L 78,115 Z',
  },
  {
    id: 'greenland',
    region: 'americas',
    name: 'Groenland',
    d: 'M 335,32 L 420,28 L 435,68 L 385,95 L 340,78 Z',
  },
  {
    id: 'south-america',
    region: 'americas',
    name: 'Amérique du Sud',
    d: 'M 262,258 L 325,265 L 378,312 L 365,382 L 320,455 L 288,468 L 278,395 L 252,320 Z',
  },
  {
    id: 'europe',
    region: 'europe',
    name: 'Europe',
    d: 'M 465,68 L 545,55 L 625,62 L 642,135 L 585,165 L 542,175 L 495,172 L 468,148 L 458,108 Z',
  },
  {
    id: 'africa-mena',
    region: 'africa_mena',
    name: 'Afrique & Moyen-Orient',
    d: 'M 458,182 L 545,178 L 628,175 L 668,208 L 638,255 L 615,328 L 585,405 L 538,412 L 512,345 L 492,285 L 452,248 Z',
  },
  {
    id: 'asia',
    region: 'asia_oceania',
    name: 'Asie',
    d: 'M 628,62 L 785,58 L 912,82 L 925,145 L 875,215 L 822,262 L 758,255 L 705,242 L 668,205 L 638,142 Z',
  },
  {
    id: 'southeast-asia',
    region: 'asia_oceania',
    name: 'Asie du Sud-Est',
    d: 'M 775,268 L 865,265 L 895,312 L 835,328 L 778,308 Z',
  },
  {
    id: 'oceania',
    region: 'asia_oceania',
    name: 'Océanie',
    d: 'M 795,352 L 892,345 L 922,398 L 892,438 L 812,428 L 788,388 Z',
  },
];

const REGION_VIEWBOX: Record<GeoRegionKey, string> = {
  all: '0 0 1000 500',
  europe: '420 40 260 165',
  africa_mena: '420 155 280 280',
  americas: '50 35 370 450',
  asia_oceania: '610 50 350 405',
};

export const WorldMapVisualization: React.FC<WorldMapVisualizationProps> = ({
  countries,
  periodLabel = '24h',
  sourceLabel: _sourceLabel = 'Cloudflare Edge & D1 Geo',
  onSelectCountry,
}) => {
  const [metricMode, setMetricMode] = useState<GeoMetricMode>('requests');
  const [selectedRegion, setSelectedRegion] = useState<GeoRegionKey>('all');
  const [activeCountryCode, setActiveCountryCode] = useState<string | null>(null);

  const analytics = useMemo(
    () => computeGeoMapAnalytics(countries, metricMode),
    [countries, metricMode]
  );

  const visiblePoints = useMemo(() => {
    if (selectedRegion === 'all') return analytics.points;
    return analytics.points.filter((p) => p.region === selectedRegion);
  }, [analytics.points, selectedRegion]);

  const highlightedPoint: EnrichedMapCountryPoint | null = useMemo(() => {
    if (activeCountryCode) {
      const found = analytics.points.find((p) => p.countryCode === activeCountryCode);
      if (found) return found;
    }
    return visiblePoints[0] || analytics.points[0] || null;
  }, [activeCountryCode, visiblePoints, analytics.points]);

  return (
    <div className="bg-admin-surface border border-admin-border text-admin-text rounded-lg p-5 space-y-5 shadow-2xs">
      {/* En-tête de la carte mondiale */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border bg-admin-accent-bg border-admin-accent-border text-admin-accent">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-sm sm:text-base font-bold text-admin-text">
                Carte Mondiale Interactive &amp; Télémétrie Géographique ({periodLabel})
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-md border border-admin-border text-admin-text-secondary">
                <span className="font-mono">{analytics.points.length}</span> pays actifs
              </span>
            </div>
            <p className="text-xs mt-0.5 text-admin-text-muted">
              Visualisation géospatiale du trafic Edge, de la bande passante et des menaces par pays et continent
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sélecteur de métrique sur la carte */}
          <div
            role="group"
            aria-label="Métrique de la carte"
            className="inline-flex rounded-lg p-1 border border-admin-border"
          >
            {(
              [
                { id: 'requests', label: 'Visites' },
                { id: 'bytes', label: 'Bande passante' },
                { id: 'threats', label: 'Menaces' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMetricMode(m.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  metricMode === m.id
                    ? 'bg-admin-accent text-white shadow-2xs'
                    : 'text-admin-text-secondary hover:text-admin-text'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Filtre de zoom régional */}
          <div
            role="group"
            aria-label="Zoom par région continentale"
            className="inline-flex flex-wrap rounded-lg p-1 border border-admin-border"
          >
            {(
              [
                { id: 'all', label: 'Monde' },
                { id: 'europe', label: 'Europe' },
                { id: 'africa_mena', label: 'Afrique & MENA' },
                { id: 'americas', label: 'Amériques' },
                { id: 'asia_oceania', label: 'Asie-Pacifique' },
              ] as const
            ).map((reg) => (
              <button
                key={reg.id}
                type="button"
                onClick={() => setSelectedRegion(reg.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  selectedRegion === reg.id
                    ? 'bg-admin-muted text-admin-text border border-admin-border-strong shadow-2xs'
                    : 'text-admin-text-muted hover:text-admin-text'
                }`}
              >
                {reg.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grille principale : Carte SVG (8 cols) + Inspecteur de Pays & Régions (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Canvas SVG Carte Mondiale (Fond cartographique obsidienne chaude VIDNEX) */}
        <div className="lg:col-span-8 rounded-lg border border-admin-border bg-[#16100c] p-3 relative overflow-hidden flex flex-col justify-between text-[#fffaf5]">
          <div className="flex items-center justify-between px-2 pt-1 pb-2 text-xs text-[#c89d7c]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              Projection géospatiale Cloudflare Edge · Cliquez sur un hub pays
            </span>
            <span><span className="font-mono">{visiblePoints.length}</span> point(s) affiché(s)</span>
          </div>

          <div className="relative w-full aspect-[2/1] min-h-[240px]">
            <svg
              viewBox={REGION_VIEWBOX[selectedRegion]}
              className="w-full h-full select-none transition-all duration-500"
              role="img"
              aria-label="Carte mondiale interactive du trafic par pays"
            >
              <defs>
                <radialGradient id="vidnexHubGlowRequests" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.9" />
                  <stop offset="55%" stopColor="#fb923c" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="vidnexHubGlowBytes" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.85" />
                  <stop offset="55%" stopColor="#34d399" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="vidnexHubGlowThreats" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.9" />
                  <stop offset="55%" stopColor="#fb7185" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Grille de latitude / longitude chaude */}
              {[100, 200, 300, 400].map((y) => (
                <line
                  key={`lat-${y}`}
                  x1={0}
                  y1={y}
                  x2={1000}
                  y2={y}
                  stroke="#2c1d13"
                  strokeWidth="0.8"
                  strokeDasharray="4 4"
                />
              ))}
              {[166, 333, 500, 666, 833].map((x) => (
                <line
                  key={`lon-${x}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={500}
                  stroke="#2c1d13"
                  strokeWidth="0.8"
                  strokeDasharray="4 4"
                />
              ))}

              {/* Équateur (lat 0 => y = 75/135 * 500 = 277.8) */}
              <line
                x1={0}
                y1={277.8}
                x2={1000}
                y2={277.8}
                stroke="#4d2c19"
                strokeWidth="1"
              />

              {/* Silhouettes des continents */}
              {CONTINENT_SILHOUETTES.map((cont) => {
                const isFocusedRegion =
                  selectedRegion === 'all' || selectedRegion === cont.region;
                return (
                  <path
                    key={cont.id}
                    d={cont.d}
                    fill={isFocusedRegion ? '#261911' : '#1b120c'}
                    stroke={isFocusedRegion ? '#5c351e' : '#352013'}
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    className="transition-colors duration-300"
                  />
                );
              })}

              {/* Lignes d'arc réseau entre le pays #1 et les autres hubs du top 6 */}
              {visiblePoints.length > 1 &&
                visiblePoints.slice(1, 7).map((target) => {
                  const origin = visiblePoints[0];
                  const midX = (origin.svgX + target.svgX) / 2;
                  const midY = Math.min(origin.svgY, target.svgY) - 28;
                  return (
                    <path
                      key={`arc-${origin.countryCode}-${target.countryCode}`}
                      d={`M ${origin.svgX},${origin.svgY} Q ${midX},${midY} ${target.svgX},${target.svgY}`}
                      fill="none"
                      stroke={
                        metricMode === 'bytes'
                          ? 'rgba(16, 185, 129, 0.35)'
                          : metricMode === 'threats'
                          ? 'rgba(244, 63, 94, 0.35)'
                          : 'rgba(249, 115, 22, 0.38)'
                      }
                      strokeWidth="1.2"
                      strokeDasharray="3 3"
                    />
                  );
                })}

              {/* Points / Bulles géographiques par pays */}
              {visiblePoints.map((pt, index) => {
                const isSelected = highlightedPoint?.countryCode === pt.countryCode;
                const isTop3 = index < 3;
                const glowId =
                  metricMode === 'bytes'
                    ? 'url(#vidnexHubGlowBytes)'
                    : metricMode === 'threats'
                    ? 'url(#vidnexHubGlowThreats)'
                    : 'url(#vidnexHubGlowRequests)';
                const dotColor =
                  metricMode === 'bytes'
                    ? '#10b981'
                    : metricMode === 'threats'
                    ? '#f43f5e'
                    : '#f97316';

                return (
                  <g
                    key={pt.countryCode}
                    transform={`translate(${pt.svgX}, ${pt.svgY})`}
                    onClick={() => {
                      setActiveCountryCode(pt.countryCode);
                      onSelectCountry?.(pt.countryCode);
                    }}
                    onMouseEnter={() => setActiveCountryCode(pt.countryCode)}
                    className="cursor-pointer group"
                  >
                    {/* Halo radial */}
                    <circle
                      r={pt.radius * 1.9}
                      fill={glowId}
                      opacity={isSelected ? 0.95 : 0.72}
                    />

                    {/* Anneau de sélection ou top 3 */}
                    {(isSelected || isTop3) && (
                      <circle
                        r={pt.radius + 3.5}
                        fill="none"
                        stroke={isSelected ? '#fffaf5' : dotColor}
                        strokeWidth={isSelected ? '1.8' : '1.1'}
                        strokeOpacity={isSelected ? 0.95 : 0.6}
                      />
                    )}

                    {/* Cercle principal proportionnel au trafic */}
                    <circle
                      r={Math.max(4, pt.radius * 0.65)}
                      fill={dotColor}
                      stroke="#140e0a"
                      strokeWidth="1.2"
                    />

                    {/* Étiquette ISO sur les 8 premiers pays ou le pays sélectionné */}
                    {(index < 8 || isSelected) && (
                      <g transform={`translate(0, ${-Math.max(7, pt.radius * 0.75) - 4})`}>
                        <rect
                          x="-20"
                          y="-11"
                          width="40"
                          height="13"
                          rx="3.5"
                          fill="var(--admin-surface-muted)"
                          fillOpacity="0.92"
                          stroke={isSelected ? '#fb923c' : '#5c351e'}
                          strokeWidth="0.9"
                        />
                        <text
                          textAnchor="middle"
                          y="-2"
                          fill="#fffaf5"
                          fontSize="7.5"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {pt.countryCode} {pt.percentage}%
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Légende de la carte */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-2 border-t border-[#2c1d13] text-xs text-[#c89d7c]">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                Hub actif (taille = volume)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 h-0.5 border-b border-dashed border-orange-400" />
                Flux principaux Top 6
              </span>
            </div>
            <span className="text-[#f3d5b5]">
              Total : <span className="font-mono">{formatNum(analytics.totalRequests)}</span> visites ·{' '}
              <span className="font-mono">{formatBytesShort(analytics.totalBytes)}</span>
            </span>
          </div>
        </div>

        {/* Colonne droite (4 cols) : Inspecteur du pays sélectionné + Répartition par Continent */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-4">
          {/* Fiche détaillée du pays sélectionné / survolé */}
          <div className="p-4 rounded-lg border border-admin-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-admin-text-secondary">
                Inspecteur Géographique
              </span>
              <span className="text-xs font-semibold text-admin-accent">
                {highlightedPoint ? highlightedPoint.regionLabel : 'Aucun pays'}
              </span>
            </div>

            {highlightedPoint ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-2xl leading-none">{highlightedPoint.flag}</span>
                    <div className="min-w-0">
                      <div className="font-display font-bold text-sm text-admin-text truncate">
                        {highlightedPoint.countryName}
                      </div>
                      <div className="text-xs font-mono text-admin-text-muted">
                        ISO {highlightedPoint.countryCode} · Lat {highlightedPoint.lat}° / Lon{' '}
                        {highlightedPoint.lon}°
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-admin-accent-bg border border-admin-accent-border text-admin-accent font-mono text-xs font-bold shrink-0">
                    {highlightedPoint.percentage}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
                  <div className="p-2.5 rounded-lg border border-admin-border">
                    <div className="text-xs text-admin-text-muted">Visites</div>
                    <div className="font-mono text-sm font-bold text-admin-text mt-0.5 tabular-nums">
                      {formatNum(highlightedPoint.requests)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-admin-border">
                    <div className="text-xs text-admin-text-muted">Bande passante</div>
                    <div className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 tabular-nums">
                      {formatBytesShort(highlightedPoint.bytes)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-admin-border">
                    <div className="text-xs text-admin-text-muted">Poids / req</div>
                    <div className="font-mono text-sm font-bold text-admin-text mt-0.5 tabular-nums">
                      {formatBytesShort(highlightedPoint.avgBytesPerRequest)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-admin-border">
                    <div className="text-xs text-admin-text-muted">Menaces WAF</div>
                    <div
                      className={`font-mono text-sm font-bold mt-0.5 tabular-nums ${
                        highlightedPoint.threats > 0
                          ? 'text-red-700 dark:text-rose-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {formatNum(highlightedPoint.threats)}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-admin-text-muted py-4 text-center">
                Aucune donnée géographique disponible sur cette période.
              </p>
            )}
          </div>

          {/* Répartition par Continent */}
          <div className="p-4 rounded-lg border border-admin-border space-y-3 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-admin-text-secondary">
                Répartition par Continent
              </span>
              <BarChart3 className="w-3.5 h-3.5 text-admin-text-muted" />
            </div>

            <div className="space-y-2.5">
              {analytics.regions.map((reg) => (
                <button
                  key={reg.region}
                  type="button"
                  onClick={() =>
                    setSelectedRegion((prev) => (prev === reg.region ? 'all' : reg.region))
                  }
                  className="w-full text-left space-y-1 group cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-admin-text group-hover:text-admin-accent transition-colors">
                      {reg.label}{' '}
                      <span className="text-xs text-admin-text-muted font-normal">
                        (<span className="font-mono">{reg.countryCount}</span> pays)
                      </span>
                    </span>
                    <span className="font-mono tabular-nums font-bold text-admin-text">
                      {formatNum(reg.requests)}{' '}
                      <span className="text-admin-accent">({reg.percentage}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full border border-admin-border overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-admin-accent to-amber-500 dark:from-orange-500 dark:to-amber-400 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(reg.requests > 0 ? 3 : 0, reg.percentage)
                        )}%`,
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
