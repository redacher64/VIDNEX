import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy } from '../AdminIcons';
import type { ErrorByPlatformEntry } from '../dashboardWidgetLogic';
import {
  extractDynamicErrorCodes,
  formatDateTimeFr,
  formatNumberFr,
  formatPlatformDisplayName,
  formatSafePercent,
  getVisibleErrorLogColumns,
  type ErrorLogRow,
} from '../adminMetricsLogic';

export interface ErrorsLogPanelProps {
  statsErrors: ReadonlyArray<{ code: string; count: number }>;
  errorsByPlatform30d: ReadonlyArray<ErrorByPlatformEntry>;
  canViewActivity: boolean;
  initialPlatformFilter?: string;
  initialErrorCodeFilter?: string;
}

const PLATFORM_FILTER_OPTIONS = [
  { value: '', label: 'Toutes les plateformes' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'instagram_profile', label: 'Profil Instagram' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
];

export const ErrorsLogPanel: React.FC<ErrorsLogPanelProps> = ({
  statsErrors,
  errorsByPlatform30d,
  canViewActivity,
  initialPlatformFilter = '',
  initialErrorCodeFilter = '',
}) => {
  const [items, setItems] = useState<ErrorLogRow[]>([]);
  const [observedCodes, setObservedCodes] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(canViewActivity);
  const [platformFilter, setPlatformFilter] = useState(initialPlatformFilter);
  const [errorCodeFilter, setErrorCodeFilter] = useState(initialErrorCodeFilter);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    setPlatformFilter(initialPlatformFilter);
    setErrorCodeFilter(initialErrorCodeFilter);
    setPage(1);
  }, [initialPlatformFilter, initialErrorCodeFilter]);

  const loadActivity = useCallback(
    async (targetPage: number, targetPlatform: string, targetCode: string) => {
      if (!canViewActivity) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          limit: '20',
          status: 'error',
          days: '30',
        });
        if (targetPlatform) params.set('platform', targetPlatform);
        if (targetCode) params.set('error_code', targetCode);

        const res = await fetch(`/api/admin/activity?${params.toString()}`, {
          headers: { Accept: 'application/json' },
        });
        const json = await res.json();
        if (res.ok && json.ok) {
          const fetchedItems: ErrorLogRow[] = Array.isArray(json.items) ? json.items : [];
          setItems(fetchedItems);
          setPage(json.page || 1);
          setTotalPages(json.totalPages || 1);
          setTotal(json.total || 0);
          setObservedCodes((prev) => {
            const set = new Set(prev);
            for (const row of fetchedItems) {
              if (row.error_code) set.add(row.error_code);
            }
            return Array.from(set);
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [canViewActivity]
  );

  useEffect(() => {
    loadActivity(page, platformFilter, errorCodeFilter);
  }, [loadActivity, page, platformFilter, errorCodeFilter]);

  const dynamicErrorCodes = useMemo(() => {
    const base = extractDynamicErrorCodes({
      statsErrors,
      errorsByPlatform: errorsByPlatform30d,
      activityItems: items,
    });
    const merged = new Set([...base, ...observedCodes]);
    if (errorCodeFilter) merged.add(errorCodeFilter);
    return Array.from(merged);
  }, [statsErrors, errorsByPlatform30d, items, observedCodes, errorCodeFilter]);

  const visibleCols = useMemo(() => getVisibleErrorLogColumns(items), [items]);

  // Build clickable 30j error breakdown rows (top 12 displayed, denominator sums all 30j rows)
  const allBreakdownRows = useMemo(() => {
    if (errorsByPlatform30d.length > 0) {
      return [...errorsByPlatform30d].sort((a, b) => b.count - a.count);
    }
    return statsErrors.map((e) => ({
      error_code: e.code,
      platform: '',
      count: e.count,
    }));
  }, [errorsByPlatform30d, statsErrors]);

  const breakdownRows = useMemo(() => allBreakdownRows.slice(0, 12), [allBreakdownRows]);

  const totalBreakdownErrors = useMemo(
    () => allBreakdownRows.reduce((acc, r) => acc + Math.max(0, Number(r.count || 0)), 0),
    [allBreakdownRows]
  );

  const handleClickBreakdown = (code: string, platform: string) => {
    const isSame = errorCodeFilter === code && platformFilter === platform;
    if (isSame) {
      setErrorCodeFilter('');
      setPlatformFilter('');
    } else {
      setErrorCodeFilter(code);
      setPlatformFilter(platform || '');
    }
    setPage(1);
  };

  const handleCopyRowJson = (row: ErrorLogRow) => {
    const normalizedTs = row.ts < 10_000_000_000 ? row.ts * 1000 : row.ts;
    const payload = {
      id: row.id,
      date: new Date(normalizedTs).toISOString(),
      platform: row.platform,
      content_kind: row.content_kind || null,
      engine_fn: row.engine_fn || null,
      engine_stage: row.engine_stage || null,
      http_status: row.http_status ?? null,
      error_code: row.error_code || null,
      source_domain: row.source_domain || null,
      error_message: row.error_message || null,
      duration_ms: row.duration_ms,
      ip_hash: row.ip_hash || null,
    };
    navigator.clipboard?.writeText(JSON.stringify(payload));
    setCopiedId(row.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const hasEngineColumn = visibleCols.engineFn || visibleCols.engineStage;
  const activeColCount =
    3 +
    (visibleCols.contentKind ? 1 : 0) +
    (hasEngineColumn ? 1 : 0) +
    (visibleCols.httpStatus ? 1 : 0) +
    (visibleCols.sourceDomain ? 1 : 0) +
    (visibleCols.errorMessage ? 1 : 0) +
    (visibleCols.duration ? 1 : 0) +
    (visibleCols.ip ? 1 : 0) +
    1;

  return (
    <div className="space-y-4">
      {/* 1. Répartition des erreurs 30j (clic = filtre immédiat) */}
      <section
        aria-label="Répartition des erreurs sur 30 jours"
        className="bg-admin-surface border border-admin-border rounded-lg p-4 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-bold text-admin-text">
              Répartition des erreurs (30j · {formatNumberFr(totalBreakdownErrors)})
            </h2>
            <p className="text-xs text-admin-text-muted">
              Journal détaillé request_log (erreurs 30j UTC) · cliquez sur une erreur pour filtrer
            </p>
          </div>
          {(errorCodeFilter || platformFilter) && (
            <button
              type="button"
              onClick={() => {
                setErrorCodeFilter('');
                setPlatformFilter('');
                setPage(1);
              }}
              className="px-2.5 py-1 rounded-md border border-admin-border-strong bg-admin-muted hover:bg-admin-hover text-xs font-semibold text-admin-text cursor-pointer"
            >
              Réinitialiser le filtre
            </button>
          )}
        </div>

        {breakdownRows.length === 0 ? (
          <p className="text-xs text-admin-text-muted py-4 text-center">
            Aucune erreur enregistrée sur les 30 derniers jours.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {breakdownRows.map((row) => {
              const isSelected =
                errorCodeFilter === row.error_code &&
                (platformFilter === row.platform || (!row.platform && !platformFilter));
              return (
                <button
                  key={`${row.error_code}-${row.platform || 'all'}`}
                  type="button"
                  onClick={() => handleClickBreakdown(row.error_code, row.platform)}
                  className={`text-left p-2.5 rounded-md border transition-colors cursor-pointer flex items-center justify-between gap-2 text-xs ${
                    isSelected
                      ? 'border-admin-accent bg-admin-accent-bg'
                      : 'border-admin-border hover:border-admin-border-strong hover:bg-admin-hover/40'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-mono font-semibold text-admin-text break-all">
                      {row.error_code}
                    </div>
                    {row.platform && (
                      <div className="text-[11px] text-admin-text-muted">
                        {formatPlatformDisplayName(row.platform)}
                      </div>
                    )}
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <div className="font-bold text-red-700 dark:text-red-400">
                      {formatNumberFr(row.count)}
                    </div>
                    <div className="text-[11px] text-admin-text-muted">
                      {formatSafePercent(row.count, totalBreakdownErrors)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. Journal filtrable */}
      {canViewActivity && (
        <section
          aria-label="Journal détaillé des erreurs"
          className="bg-admin-surface border border-admin-border rounded-lg overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-admin-border flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-sm font-bold text-admin-text">
                Journal des erreurs (30j · {formatNumberFr(total)})
              </h2>
              <p className="text-xs text-admin-text-muted">
                request_log (erreurs 30j UTC) · tests manuels « Tester » exclus · aucune URL stockée
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filtrer par plateforme"
                value={platformFilter}
                onChange={(e) => {
                  setPlatformFilter(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 rounded-md bg-admin-muted border border-admin-border-strong text-xs text-admin-text focus:outline-none focus:border-admin-accent"
              >
                {PLATFORM_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filtrer par code d'erreur"
                value={errorCodeFilter}
                onChange={(e) => {
                  setErrorCodeFilter(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 rounded-md bg-admin-muted border border-admin-border-strong text-xs font-mono text-admin-text focus:outline-none focus:border-admin-accent"
              >
                <option value="">
                  {dynamicErrorCodes.length > 0
                    ? `Tous les codes (${dynamicErrorCodes.length})`
                    : 'Aucun code enregistré'}
                </option>
                {dynamicErrorCodes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-admin-border bg-admin-muted/60 font-semibold text-admin-text-secondary">
                  <th className="py-2.5 px-2.5">Date</th>
                  <th className="py-2.5 px-2.5">Plateforme</th>
                  <th className="py-2.5 px-2.5">Code erreur</th>
                  {visibleCols.httpStatus && (
                    <th
                      className="py-2.5 px-2 whitespace-nowrap"
                      title="Statut HTTP renvoyé par la source ou l'API"
                    >
                      Code HTTP
                    </th>
                  )}
                  {visibleCols.contentKind && <th className="py-2.5 px-2">Type</th>}
                  {hasEngineColumn && <th className="py-2.5 px-2.5">Moteur</th>}
                  {visibleCols.sourceDomain && <th className="py-2.5 px-2.5">Domaine</th>}
                  {visibleCols.errorMessage && <th className="py-2.5 px-2.5">Message</th>}
                  {visibleCols.duration && <th className="py-2.5 px-2 text-right">Durée</th>}
                  {visibleCols.ip && <th className="py-2.5 px-2">IP</th>}
                  <th className="py-2.5 px-2.5 text-right">JSON</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border/70">
                {loading && items.length === 0 ? (
                  <tr>
                    <td colSpan={activeColCount} className="py-8 text-center text-admin-text-muted">
                      Chargement du journal…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={activeColCount} className="py-8 text-center text-admin-text-muted">
                      Aucune erreur enregistrée pour ces critères.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => {
                    const displayIp =
                      row.ip_hash_short && row.ip_hash_short !== 'anonyme'
                        ? row.ip_hash_short
                        : row.ip_hash
                        ? row.ip_hash.slice(0, 12)
                        : '—';
                    const engineSummary = [row.engine_fn, row.engine_stage]
                      .filter((v) => Boolean(v && String(v).trim()))
                      .join(' · ');

                    return (
                      <tr key={row.id} className="hover:bg-admin-hover/40 transition-colors">
                        <td className="py-2.5 px-2.5 font-mono text-admin-text-secondary whitespace-nowrap tabular-nums">
                          {formatDateTimeFr(row.ts)}
                        </td>
                        <td className="py-2.5 px-2.5 font-semibold text-admin-text whitespace-nowrap">
                          {formatPlatformDisplayName(row.platform)}
                        </td>
                        <td className="py-2.5 px-2.5 font-mono font-semibold text-amber-800 dark:text-amber-300 whitespace-nowrap">
                          {row.error_code || '—'}
                        </td>
                        {visibleCols.httpStatus && (
                          <td className="py-2.5 px-2 font-mono tabular-nums whitespace-nowrap">
                            {row.http_status != null ? row.http_status : '—'}
                          </td>
                        )}
                        {visibleCols.contentKind && (
                          <td className="py-2.5 px-2 font-mono text-admin-text-secondary whitespace-nowrap">
                            {row.content_kind || '—'}
                          </td>
                        )}
                        {hasEngineColumn && (
                          <td
                            className="py-2.5 px-2.5 font-mono text-admin-text-secondary max-w-[160px] truncate"
                            title={engineSummary || undefined}
                          >
                            {engineSummary || '—'}
                          </td>
                        )}
                        {visibleCols.sourceDomain && (
                          <td className="py-2.5 px-2.5 font-mono text-admin-text-secondary whitespace-nowrap">
                            {row.source_domain || '—'}
                          </td>
                        )}
                        {visibleCols.errorMessage && (
                          <td
                            className="py-2.5 px-2.5 text-admin-text-muted max-w-[175px] truncate"
                            title={row.error_message || undefined}
                          >
                            {row.error_message || '—'}
                          </td>
                        )}
                        {visibleCols.duration && (
                          <td className="py-2.5 px-2 text-right font-mono text-admin-text-secondary tabular-nums whitespace-nowrap">
                            {row.duration_ms != null ? `${row.duration_ms} ms` : '—'}
                          </td>
                        )}
                        {visibleCols.ip && (
                          <td className="py-2.5 px-2 font-mono text-admin-text-muted whitespace-nowrap">
                            {displayIp}
                          </td>
                        )}
                        <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleCopyRowJson(row)}
                            aria-label={`Copier le JSON de l'erreur ${row.id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-admin-border-strong bg-admin-muted hover:bg-admin-hover text-admin-text cursor-pointer"
                          >
                            {copiedId === row.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>Copié</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-admin-text-muted" />
                                <span>Copier</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-2.5 border-t border-admin-border flex items-center justify-between text-xs text-admin-text-secondary">
            <span className="tabular-nums">
              Page <span className="font-mono">{page}</span> /{' '}
              <span className="font-mono">{totalPages}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded border border-admin-border-strong bg-admin-muted hover:bg-admin-hover text-admin-text disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Préc.</span>
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded border border-admin-border-strong bg-admin-muted hover:bg-admin-hover text-admin-text disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Suiv.</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
