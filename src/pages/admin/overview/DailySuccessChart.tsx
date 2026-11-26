import React, { useMemo, useState } from 'react';
import type { WidgetDailyBucket } from '../dashboardWidgetLogic';
import {
  buildDailyChartSeries,
  formatNumberFr,
  formatSafePercent,
  type DailyChartPoint,
} from '../adminMetricsLogic';

export interface DailySuccessChartProps {
  daily: readonly WidgetDailyBucket[] | undefined;
  range: '7d' | '30d';
  onChangeRange: (next: '7d' | '30d') => void;
}

export const DailySuccessChart: React.FC<DailySuccessChartProps> = ({
  daily,
  range,
  onChangeRange,
}) => {
  const [hovered, setHovered] = useState<DailyChartPoint | null>(null);

  const series = useMemo(() => buildDailyChartSeries(daily, range), [daily, range]);
  const { points, maxTotal, totalCalls } = series;

  const svgWidth = 640;
  const svgHeight = 200;
  const padTop = 16;
  const padBottom = 26;
  const padLeft = 36;
  const padRight = 10;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;
  const yScaleMax = Math.max(1, maxTotal);
  const slotWidth = plotWidth / Math.max(1, points.length);
  const barWidth = Math.max(6, Math.min(28, slotWidth * 0.62));

  const yTicks = [0, Math.round(yScaleMax / 2), yScaleMax];

  return (
    <section
      aria-label="Historique quotidien succès et échecs"
      className="bg-admin-surface border border-admin-border rounded-lg p-4 sm:p-5 flex flex-col justify-between gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-bold text-admin-text">
            Succès / Échecs par jour
          </h2>
          <p className="text-xs text-admin-text-muted mt-0.5">
            {hovered ? (
              <span className="font-mono text-admin-text">
                {hovered.day} · {formatNumberFr(hovered.success)} OK ·{' '}
                {formatNumberFr(hovered.error)} échec(s) (
                {formatSafePercent(hovered.success, hovered.total)})
              </span>
            ) : (
              <span>
                Survolez une barre pour le détail quotidien ({range === '7d' ? '7j' : '30j'} UTC)
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-3 text-xs text-admin-text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 dark:bg-emerald-500" />
              Succès
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-red-600 dark:bg-red-500" />
              Échecs
            </span>
          </div>

          <div
            role="group"
            aria-label="Fenêtre du graphique"
            className="inline-flex items-center rounded-md border border-admin-border bg-admin-muted p-0.5"
          >
            {(
              [
                { id: '7d', label: '7j' },
                { id: '30d', label: '30j' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                aria-pressed={range === opt.id}
                onClick={() => onChangeRange(opt.id)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  range === opt.id
                    ? 'bg-admin-accent text-white'
                    : 'text-admin-text-secondary hover:text-admin-text'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Responsive SVG bar chart (immune to CSS flex % height collapse) */}
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-52 block select-none overflow-visible"
          role="img"
          aria-label={`Graphique quotidien des extractions sur ${range === '7d' ? '7' : '30'} jours`}
          onMouseLeave={() => setHovered(null)}
        >
          {/* Horizontal gridlines & Y ticks */}
          {yTicks.map((tick, idx) => {
            const y = padTop + plotHeight - (tick / yScaleMax) * plotHeight;
            return (
              <g key={`ytick-${idx}`}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  stroke="currentColor"
                  className="text-admin-border"
                  strokeDasharray={tick === 0 ? undefined : '3 4'}
                  strokeWidth={tick === 0 ? 1 : 0.8}
                />
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-current text-admin-text-muted font-mono text-[10px]"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Stacked bars */}
          {points.map((pt, i) => {
            const xCenter = padLeft + i * slotWidth + slotWidth / 2;
            const xBar = xCenter - barWidth / 2;
            const totalPx =
              pt.total > 0 ? Math.max(4, (pt.total / yScaleMax) * plotHeight) : 0;
            const successPx =
              pt.total > 0 ? (pt.success / pt.total) * totalPx : 0;
            const errorPx =
              pt.total > 0 ? Math.max(0, totalPx - successPx) : 0;

            const yBase = padTop + plotHeight;
            const ySuccess = yBase - successPx;
            const yError = ySuccess - errorPx;

            const showLabel =
              range === '7d' ||
              i === 0 ||
              i === points.length - 1 ||
              i % 5 === 0;

            const isHovered = hovered?.day === pt.day;

            return (
              <g
                key={pt.day}
                onMouseEnter={() => setHovered(pt)}
                className="cursor-pointer"
              >
                {/* Invisible hit column */}
                <rect
                  x={padLeft + i * slotWidth}
                  y={padTop}
                  width={slotWidth}
                  height={plotHeight + padBottom}
                  fill="transparent"
                />

                {isHovered && (
                  <rect
                    x={padLeft + i * slotWidth + 1}
                    y={padTop}
                    width={Math.max(2, slotWidth - 2)}
                    height={plotHeight}
                    rx={3}
                    fill="currentColor"
                    className="text-admin-hover opacity-60"
                  />
                )}

                {pt.total === 0 ? (
                  <rect
                    x={xBar}
                    y={yBase - 2}
                    width={barWidth}
                    height={2}
                    rx={1}
                    fill="currentColor"
                    className="text-admin-border-strong opacity-60"
                  />
                ) : (
                  <>
                    {successPx > 0 && (
                      <rect
                        x={xBar}
                        y={ySuccess}
                        width={barWidth}
                        height={successPx}
                        rx={errorPx === 0 ? 2 : 0}
                        className="fill-emerald-600 dark:fill-emerald-500"
                      />
                    )}
                    {errorPx > 0 && (
                      <rect
                        x={xBar}
                        y={yError}
                        width={barWidth}
                        height={errorPx}
                        rx={2}
                        className="fill-red-600 dark:fill-red-500"
                      />
                    )}
                  </>
                )}

                {showLabel && (
                  <text
                    x={xCenter}
                    y={svgHeight - 6}
                    textAnchor="middle"
                    className="fill-current text-admin-text-muted font-mono text-[10px]"
                  >
                    {pt.shortLabel}
                  </text>
                )}

                <title>{`${pt.day} : ${pt.total} req (${pt.success} OK, ${pt.error} échec)`}</title>
              </g>
            );
          })}
        </svg>

        {totalCalls === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="px-3 py-1.5 rounded-md bg-admin-surface/95 border border-admin-border text-xs text-admin-text-muted">
              Aucune extraction enregistrée sur cette fenêtre ({range === '7d' ? '7j' : '30j'})
            </span>
          </div>
        )}
      </div>
    </section>
  );
};
