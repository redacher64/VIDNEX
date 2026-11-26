import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from '../AdminIcons';
import type {
  HostnameTrafficRow,
  StatusCodeBreakdown,
  SubrequestHostRow,
  VisitorsTimeseriesPoint,
  WorkerRuntimeMetrics,
} from '../Visitors';
import {
  formatBytesFr,
  formatCompactNumberFr,
  formatNumberFr,
  formatSafePercent,
} from '../adminMetricsLogic';

export interface AudienceTechnicalDetailsProps {
  periodLabel: string;
  totalRequests: number;
  totalBytes: number;
  cachedBytes: number;
  threats: number;
  workerMetrics: WorkerRuntimeMetrics;
  statusCodes: StatusCodeBreakdown;
  timeseries: readonly VisitorsTimeseriesPoint[];
  topHostnames: readonly HostnameTrafficRow[];
  subrequestHosts: readonly SubrequestHostRow[];
}

export const AudienceTechnicalDetails: React.FC<AudienceTechnicalDetailsProps> = ({
  periodLabel,
  totalRequests,
  totalBytes,
  cachedBytes,
  threats,
  workerMetrics,
  statusCodes,
  timeseries,
  topHostnames,
  subrequestHosts,
}) => {
  const [open, setOpen] = useState(false);
  const [chartMode, setChartMode] = useState<'requests' | 'uniques' | 'invocations'>('requests');

  const statusTotal =
    statusCodes.status2xx +
    statusCodes.status3xx +
    statusCodes.status4xx +
    statusCodes.status5xx +
    statusCodes.statusOther;

  const non5xxCount = Math.max(0, statusTotal - statusCodes.status5xx);

  const maxChartVal = useMemo(() => {
    let max = 1;
    for (const pt of timeseries) {
      const v =
        chartMode === 'uniques'
          ? pt.uniques
          : chartMode === 'invocations'
          ? pt.invocations
          : pt.requests;
      if (v > max) max = v;
    }
    return max;
  }, [timeseries, chartMode]);

  return (
    <section
      aria-label="Détails techniques Cloudflare"
      className="bg-admin-surface border border-admin-border rounded-lg overflow-hidden"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-admin-hover/40 transition-colors cursor-pointer"
      >
        <div>
          <h2 className="font-display text-sm font-bold text-admin-text">
            Détails techniques
          </h2>
          <p className="text-xs text-admin-text-muted">
            CPU Worker, invocations, sous-requêtes, bande passante, codes HTTP et domaines ({periodLabel})
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-admin-text-secondary shrink-0">
          <span>{open ? 'Replier' : 'Déplier'}</span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {open && (
        <div className="p-4 sm:p-5 border-t border-admin-border space-y-5">
          {/* Separated single-metric technical cards (never mixing 2 unrelated metrics) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-md border border-admin-border">
              <span className="text-xs text-admin-text-secondary block">Invocations Worker</span>
              <span className="font-mono text-lg font-bold text-admin-text tabular-nums">
                {formatNumberFr(workerMetrics.invocations)}
              </span>
            </div>

            <div className="p-3.5 rounded-md border border-admin-border">
              <span className="text-xs text-admin-text-secondary block">Erreurs Worker</span>
              <span
                className={`font-mono text-lg font-bold tabular-nums ${
                  workerMetrics.errors > 0
                    ? 'text-red-700 dark:text-red-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {formatNumberFr(workerMetrics.errors)}
              </span>
            </div>

            <div className="p-3.5 rounded-md border border-admin-border">
              <span className="text-xs text-admin-text-secondary block">CPU médian (P50)</span>
              <span className="font-mono text-lg font-bold text-admin-text tabular-nums">
                {workerMetrics.invocations > 0 ? `${workerMetrics.cpuTimeP50Ms} ms` : '—'}
              </span>
            </div>

            <div className="p-3.5 rounded-md border border-admin-border">
              <span className="text-xs text-admin-text-secondary block">CPU P99</span>
              <span className="font-mono text-lg font-bold text-admin-text tabular-nums">
                {workerMetrics.invocations > 0 ? `${workerMetrics.cpuTimeP99Ms} ms` : '—'}
              </span>
            </div>

            <div className="p-3.5 rounded-md border border-admin-border">
              <span className="text-xs text-admin-text-secondary block">Sous-requêtes</span>
              <span className="font-mono text-lg font-bold text-admin-text tabular-nums">
                {formatNumberFr(workerMetrics.subrequests)}
              </span>
            </div>

            <div className="p-3.5 rounded-md border border-admin-border">
              <span className="text-xs text-admin-text-secondary block">Bande passante</span>
              <span className="font-mono text-lg font-bold text-admin-text tabular-nums">
                {formatBytesFr(totalBytes)}
              </span>
              <span className="text-[11px] font-mono text-admin-text-muted block">
                Cache : {formatBytesFr(cachedBytes)} ({formatSafePercent(cachedBytes, totalBytes)})
              </span>
            </div>

            <div className="p-3.5 rounded-md border border-admin-border">
              <span className="text-xs text-admin-text-secondary block">Disponibilité HTTP</span>
              <span className="font-mono text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {formatSafePercent(non5xxCount, statusTotal)}
              </span>
            </div>

            <div className="p-3.5 rounded-md border border-admin-border">
              <span className="text-xs text-admin-text-secondary block">Menaces bloquées</span>
              <span className="font-mono text-lg font-bold text-admin-text tabular-nums">
                {formatNumberFr(threats)}
              </span>
              <span className="text-[11px] font-mono text-admin-text-muted block">
                {formatSafePercent(threats, totalRequests)} du trafic
              </span>
            </div>
          </div>

          {/* Timeseries + HTTP Status Codes + Domaines */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Timeseries */}
            <div className="md:col-span-7 p-4 rounded-md border border-admin-border space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-xs font-bold text-admin-text">
                  Évolution du trafic ({periodLabel})
                </h3>
                <div className="inline-flex rounded border border-admin-border bg-admin-muted p-0.5">
                  {(
                    [
                      { id: 'requests', label: 'Requêtes' },
                      { id: 'uniques', label: 'Uniques' },
                      { id: 'invocations', label: 'Worker' },
                    ] as const
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setChartMode(mode.id)}
                      className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer ${
                        chartMode === mode.id
                          ? 'bg-admin-accent text-white'
                          : 'text-admin-text-secondary hover:text-admin-text'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {timeseries.length === 0 ? (
                <div className="h-36 flex items-center justify-center text-xs text-admin-text-muted border border-dashed border-admin-border rounded">
                  Aucune série temporelle détaillée disponible.
                </div>
              ) : (
                <div className="space-y-2">
                  <svg
                    viewBox="0 0 560 140"
                    className="w-full h-36 block select-none"
                    role="img"
                    aria-label="Évolution du trafic Cloudflare"
                  >
                    {timeseries.map((pt, idx) => {
                      const val =
                        chartMode === 'uniques'
                          ? pt.uniques
                          : chartMode === 'invocations'
                          ? pt.invocations
                          : pt.requests;
                      const slot = 560 / Math.max(1, timeseries.length);
                      const bw = Math.max(4, Math.min(20, slot * 0.65));
                      const h = val > 0 ? Math.max(3, (val / maxChartVal) * 124) : 2;
                      const x = idx * slot + (slot - bw) / 2;
                      const y = 132 - h;
                      return (
                        <rect
                          key={`${pt.timestamp}-${idx}`}
                          x={x}
                          y={y}
                          width={bw}
                          height={h}
                          rx={2}
                          className={
                            val === 0
                              ? 'fill-current text-admin-border-strong opacity-50'
                              : chartMode === 'uniques'
                              ? 'fill-emerald-600 dark:fill-emerald-500'
                              : chartMode === 'invocations'
                              ? 'fill-amber-600 dark:fill-amber-500'
                              : 'fill-orange-600 dark:fill-orange-500'
                          }
                        >
                          <title>{`${pt.label || pt.timestamp} : ${formatNumberFr(val)}`}</title>
                        </rect>
                      );
                    })}
                  </svg>
                  <div className="flex items-center justify-between text-[11px] font-mono text-admin-text-muted">
                    <span>{timeseries[0]?.label || ''}</span>
                    <span>{timeseries[timeseries.length - 1]?.label || ''}</span>
                  </div>
                </div>
              )}
            </div>

            {/* HTTP Status + Domaines */}
            <div className="md:col-span-5 space-y-4">
              <div className="p-4 rounded-md border border-admin-border space-y-2.5">
                <h3 className="font-display text-xs font-bold text-admin-text">
                  Codes de statut HTTP
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-700 dark:text-emerald-400">2xx</span>
                    <span className="font-semibold text-admin-text tabular-nums">
                      {formatNumberFr(statusCodes.status2xx)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sky-700 dark:text-sky-400">3xx</span>
                    <span className="font-semibold text-admin-text tabular-nums">
                      {formatNumberFr(statusCodes.status3xx)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-amber-700 dark:text-amber-400">4xx</span>
                    <span className="font-semibold text-admin-text tabular-nums">
                      {formatNumberFr(statusCodes.status4xx)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-red-700 dark:text-red-400">5xx</span>
                    <span className="font-semibold text-admin-text tabular-nums">
                      {formatNumberFr(statusCodes.status5xx)}
                    </span>
                  </div>
                </div>
                {statusTotal > 0 && (
                  <div className="h-2 w-full rounded-full bg-admin-muted overflow-hidden flex">
                    {statusCodes.status2xx > 0 && (
                      <div
                        className="bg-emerald-600 h-full"
                        style={{ width: `${(statusCodes.status2xx / statusTotal) * 100}%` }}
                      />
                    )}
                    {statusCodes.status3xx > 0 && (
                      <div
                        className="bg-sky-500 h-full"
                        style={{ width: `${(statusCodes.status3xx / statusTotal) * 100}%` }}
                      />
                    )}
                    {statusCodes.status4xx > 0 && (
                      <div
                        className="bg-amber-500 h-full"
                        style={{ width: `${(statusCodes.status4xx / statusTotal) * 100}%` }}
                      />
                    )}
                    {statusCodes.status5xx > 0 && (
                      <div
                        className="bg-red-600 h-full"
                        style={{ width: `${(statusCodes.status5xx / statusTotal) * 100}%` }}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Renamed strictly to "Domaines" */}
              <div className="p-4 rounded-md border border-admin-border space-y-2">
                <h3 className="font-display text-xs font-bold text-admin-text">Domaines</h3>
                {topHostnames.length === 0 ? (
                  <p className="text-xs text-admin-text-muted">Aucun domaine actif.</p>
                ) : (
                  <ul className="space-y-1.5 text-xs font-mono">
                    {topHostnames.map((h) => (
                      <li key={h.hostname} className="flex items-center justify-between gap-2">
                        <span className="text-admin-text truncate">{h.hostname}</span>
                        <span className="text-admin-text-secondary tabular-nums shrink-0">
                          {formatCompactNumberFr(h.requests)} (
                          {formatSafePercent(h.requests, totalRequests)})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Subrequest hosts table */}
          {subrequestHosts.length > 0 && (
            <div className="border border-admin-border rounded-md overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-admin-border bg-admin-muted/40 flex items-center justify-between text-xs">
                <span className="font-display font-bold text-admin-text">
                  Sous-requêtes sortantes par hôte
                </span>
                <span className="font-mono text-admin-text-muted">
                  {subrequestHosts.length} hôtes
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-admin-border text-admin-text-secondary font-semibold">
                      <th className="py-2 px-3">Hôte</th>
                      <th className="py-2 px-3">Plateforme</th>
                      <th className="py-2 px-3 text-right">Requêtes</th>
                      <th className="py-2 px-3 text-right">Durée moy.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-admin-border/60 font-mono">
                    {subrequestHosts.map((sh) => (
                      <tr key={sh.host}>
                        <td className="py-2 px-3 text-admin-text">{sh.host}</td>
                        <td className="py-2 px-3 font-sans text-admin-text-secondary">
                          {sh.platform}
                        </td>
                        <td className="py-2 px-3 text-right text-admin-text tabular-nums">
                          {formatNumberFr(sh.requests)}
                        </td>
                        <td className="py-2 px-3 text-right text-admin-text-secondary tabular-nums">
                          {sh.avgDurationMs} ms
                        </td>
                      </tr>
                    ))}
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
