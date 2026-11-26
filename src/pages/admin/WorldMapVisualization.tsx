import React, { useMemo, useState } from 'react';
import { Globe } from './AdminIcons';
import {
  computeGeoMapAnalytics,
  type GeoInputCountryRow,
  type EnrichedMapCountryPoint,
} from './worldMapLogic';
import {
  WORLD_COUNTRY_SHAPES,
  getCountryFlag,
  getCountryNameFr,
} from './worldCountriesGeo';
import { CHOROPLETH_COLORS, getChoroplethFill } from './visitorsMapLogic';

export interface WorldMapVisualizationProps {
  countries: GeoInputCountryRow[];
  periodLabel?: string;
  variant?: 'slate' | 'admin';
  sourceLabel?: string;
  compact?: boolean;
  onSelectCountry?: (countryCode: string) => void;
}

interface TooltipState {
  code: string;
  nameFr: string;
  flag: string;
  requests: number;
  percentage: number;
  xPct: number;
  yPct: number;
}

function formatNum(n: number | undefined | null): string {
  return Math.max(0, Number(n) || 0).toLocaleString('fr-FR');
}

export const WorldMapVisualization: React.FC<WorldMapVisualizationProps> = ({
  countries,
  periodLabel = '24h',
  compact = false,
  onSelectCountry,
}) => {
  const [hovered, setHovered] = useState<TooltipState | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const analytics = useMemo(
    () => computeGeoMapAnalytics(countries, 'requests'),
    [countries]
  );

  const byCode = useMemo(() => {
    const map = new Map<string, EnrichedMapCountryPoint>();
    for (const p of analytics.points) {
      map.set(p.countryCode, p);
    }
    return map;
  }, [analytics.points]);

  const maxRequests = useMemo(
    () => analytics.points.reduce((max, p) => Math.max(max, p.requests), 0),
    [analytics.points]
  );

  const handlePointer = (
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
    const pt = byCode.get(code);
    setHovered({
      code,
      nameFr: pt?.countryName || nameFr || getCountryNameFr(code),
      flag: pt?.flag || getCountryFlag(code),
      requests: pt?.requests ?? 0,
      percentage: pt?.percentage ?? 0,
      xPct,
      yPct,
    });
  };

  const mapCanvas = (
    <div className="rounded-lg border border-admin-border bg-[#f6f1eb] dark:bg-[#ece4dc] p-3 space-y-2.5">
      <div
        className={`relative w-full select-none ${
          compact ? 'h-[230px] sm:h-[260px] max-h-[280px]' : 'aspect-[2/1] min-h-[220px]'
        }`}
      >
        <svg
          viewBox="0 0 1000 500"
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full block"
          role="img"
          aria-label="Carte choroplèthe mondiale du trafic par pays"
          onMouseLeave={() => setHovered(null)}
        >
          <rect x="0" y="0" width="1000" height="500" fill="#f6f1eb" rx="6" />

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

          {WORLD_COUNTRY_SHAPES.map((shape) => {
            const pt = byCode.get(shape.code);
            const val = pt?.requests ?? 0;
            const fill = getChoroplethFill(val, maxRequests);
            const isSelected = selectedCode === shape.code;
            const isHovered = hovered?.code === shape.code;

            return (
              <path
                key={shape.code}
                d={shape.d}
                data-country={shape.code}
                fill={fill}
                stroke={isHovered || isSelected ? '#431407' : '#ffffff'}
                strokeWidth={isHovered || isSelected ? 1.4 : 0.65}
                strokeLinejoin="round"
                onMouseEnter={(e) => handlePointer(e, shape.code, shape.nameFr)}
                onMouseMove={(e) => handlePointer(e, shape.code, shape.nameFr)}
                onClick={() => {
                  setSelectedCode(shape.code);
                  onSelectCountry?.(shape.code);
                }}
                className="cursor-pointer transition-colors duration-150 focus:outline-none"
              >
                <title>{`${shape.nameFr} (${shape.code}) : ${formatNum(val)}`}</title>
              </path>
            );
          })}
        </svg>

        {hovered && (
          <div
            role="tooltip"
            style={{
              left: `${hovered.xPct}%`,
              top: `${hovered.yPct}%`,
              transform:
                hovered.yPct < 36
                  ? 'translate(-50%, 16px)'
                  : 'translate(-50%, -115%)',
            }}
            className="pointer-events-none absolute z-20 min-w-[170px] rounded-lg border border-[#d6c8ba] bg-[#1c140f]/95 text-[#fffaf5] px-3 py-2 shadow-lg text-xs space-y-1"
          >
            <div className="flex items-center gap-1.5 font-display font-bold">
              <span className="inline-flex items-center justify-center px-1.5 h-4 rounded bg-white/10 font-mono text-[10px] font-semibold text-[#f3d4b8]">
                {hovered.code}
              </span>
              <span>{hovered.nameFr}</span>
            </div>
            <div className="flex items-center justify-between font-mono text-[11px] text-[#f3e4d7]">
              <span className="text-[#c8a98e] font-sans">Volume :</span>
              <span className="font-semibold tabular-nums">
                {formatNum(hovered.requests)}{' '}
                {analytics.totalRequests > 0 ? `(${hovered.percentage} %)` : '(—)'}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#e0d6cb] text-xs text-[#5c4838]">
        <div className="flex items-center gap-2">
          <span>0</span>
          <div className="flex items-center gap-1">
            {CHOROPLETH_COLORS.map((hex) => (
              <span
                key={hex}
                className="w-4 h-2.5 rounded-xs border border-black/10 inline-block"
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
          <span className="font-mono font-semibold tabular-nums">
            {maxRequests > 0 ? `${formatNum(maxRequests)} max` : 'Aucune donnée'}
          </span>
        </div>
        <span className="text-[11px] text-[#7a6250] font-mono tabular-nums">
          {analytics.points.length} pays actifs
        </span>
      </div>
    </div>
  );

  if (compact) {
    return mapCanvas;
  }

  return (
    <div className="bg-admin-surface border border-admin-border text-admin-text rounded-lg p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border bg-admin-accent-bg border-admin-accent-border text-admin-accent">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display text-sm sm:text-base font-bold text-admin-text">
              Carte Mondiale Choroplèthe ({periodLabel})
            </h2>
            <p className="text-xs text-admin-text-muted">
              <span className="font-mono">{analytics.points.length}</span> pays actifs ·{' '}
              <span className="font-mono">{formatNum(analytics.totalRequests)}</span> visites/requêtes
            </p>
          </div>
        </div>
      </div>

      {mapCanvas}

      {analytics.points.length > 0 ? (
        <div className="space-y-2">
          {analytics.points.slice(0, 10).map((pt) => {
            const widthPct =
              maxRequests > 0 ? Math.max(4, Math.round((pt.requests / maxRequests) * 100)) : 0;
            return (
              <div key={pt.countryCode} className="space-y-1 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center justify-center w-6 h-4 rounded bg-admin-muted border border-admin-border font-mono text-[10px] font-semibold text-admin-text-secondary shrink-0">
                      {pt.countryCode}
                    </span>
                    <span className="font-semibold text-admin-text truncate">
                      {pt.countryName && pt.countryName.toUpperCase() !== pt.countryCode
                        ? pt.countryName
                        : pt.countryCode === 'XX'
                        ? 'Inconnu'
                        : pt.countryCode}
                    </span>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-admin-text">
                    {formatNum(pt.requests)}{' '}
                    <span className="text-admin-text-muted">({pt.percentage} %)</span>
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-admin-muted border border-admin-border overflow-hidden">
                  <div
                    className="h-full bg-orange-600 dark:bg-orange-500 rounded-full"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-admin-text-muted py-3 text-center">
          Aucune donnée géographique disponible sur cette période.
        </p>
      )}
    </div>
  );
};
