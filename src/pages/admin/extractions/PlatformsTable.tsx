import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Play,
  ShieldCheck,
  XCircle,
  Activity,
} from '../AdminIcons';
import { DEFAULT_ENGINE_TEST_URLS } from '../healthConfig';
import {
  formatDateTimeFr,
  formatNumberFr,
  formatSafeRateValue,
  getCombinedStatusMeta,
  sortPlatformTableRows,
  type AdminPlatformKey,
  type PlatformCombinedStatus,
  type PlatformSortKey,
  type PlatformTableRow,
} from '../adminMetricsLogic';

export interface StoriesProviderStatusItem {
  name: 'session' | 'relay' | 'paid' | 'mock';
  configured: boolean;
  callsLastHour: number;
  lastSuccessTs: number | null;
  lastFailureTs: number | null;
  lastErrorCode: string | null;
  lastHttpStatus: number | null;
}

export interface StoriesStatusSnapshot {
  enabled: boolean;
  activeProvider: 'session' | 'relay' | 'paid' | 'mock' | null;
  providerOrder: Array<'session' | 'relay' | 'paid'>;
  perIpHourlyLimit: number;
  globalHourlyCap: number;
  callsLastHour: number;
  listCallsLastHour: number;
  providers: StoriesProviderStatusItem[];
}

export interface PlatformsTableProps {
  rows: readonly PlatformTableRow[];
  readOnly: boolean;
  igCookieConfigured: boolean;
  storiesStatus: StoriesStatusSnapshot | null;
  highlightedPlatform?: string | null;
  onRefreshHealth: () => Promise<void>;
  onSelectError?: (platform: string, errorCode: string) => void;
}

function getStatusBadgeClasses(status: PlatformCombinedStatus): string {
  switch (status) {
    case 'ok':
      return 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-300';
    case 'degraded':
      return 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-300';
    case 'critical':
      return 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-700/60 text-red-900 dark:text-red-300';
    case 'idle':
      return 'bg-admin-muted border-admin-border text-admin-text-muted';
  }
}

export const PlatformsTable: React.FC<PlatformsTableProps> = ({
  rows,
  readOnly,
  igCookieConfigured,
  storiesStatus,
  highlightedPlatform,
  onRefreshHealth,
  onSelectError,
}) => {
  const [sortKey, setSortKey] = useState<PlatformSortKey>('total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedPlatform, setExpandedPlatform] = useState<AdminPlatformKey | null>(
    () => (highlightedPlatform as AdminPlatformKey) || null
  );
  const [urlDrafts, setUrlDrafts] = useState<Partial<Record<AdminPlatformKey, string>>>({});
  const [testingPlatform, setTestingPlatform] = useState<AdminPlatformKey | null>(null);
  const [testFeedback, setTestFeedback] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});

  const [showAdvancedDiag, setShowAdvancedDiag] = useState(false);
  const [cookieTesting, setCookieTesting] = useState(false);
  const [cookieResult, setCookieResult] = useState<{ valid: boolean; message: string } | null>(
    null
  );

  const sortedRows = useMemo(
    () => sortPlatformTableRows(rows, sortKey, sortDir),
    [rows, sortKey, sortDir]
  );

  const toggleSort = (key: PlatformSortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'label' || key === 'status' ? 'asc' : 'desc');
    }
  };

  const getUrlForPlatform = (row: PlatformTableRow): string => {
    const draft = urlDrafts[row.key];
    if (draft !== undefined) return draft;
    return row.testUrl || DEFAULT_ENGINE_TEST_URLS[row.key] || '';
  };

  const handleTestEngine = async (row: PlatformTableRow) => {
    const urlToTest = getUrlForPlatform(row).trim();
    if (!urlToTest) {
      setTestFeedback((prev) => ({
        ...prev,
        [row.key]: {
          ok: false,
          message: 'Saisissez une URL publique avant de lancer le test.',
        },
      }));
      return;
    }

    setTestingPlatform(row.key);
    setTestFeedback((prev) => {
      const next = { ...prev };
      delete next[row.key];
      return next;
    });

    try {
      const res = await fetch('/api/admin/health', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          action: 'test_engine',
          platform: row.key,
          url: urlToTest,
        }),
      });
      const json = await res.json();
      setTestFeedback((prev) => ({
        ...prev,
        [row.key]: {
          ok: Boolean(json.testOk),
          message: json.message || 'Test terminé.',
        },
      }));
      await onRefreshHealth();
    } catch {
      setTestFeedback((prev) => ({
        ...prev,
        [row.key]: {
          ok: false,
          message: 'Erreur réseau lors du test d’extraction.',
        },
      }));
    } finally {
      setTestingPlatform(null);
    }
  };

  const handleTestIgCookie = async () => {
    setCookieTesting(true);
    setCookieResult(null);
    try {
      const res = await fetch('/api/admin/health', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ action: 'test_ig_cookie' }),
      });
      const json = await res.json();
      setCookieResult({
        valid: Boolean(json.valid),
        message: json.message || 'Vérification terminée.',
      });
    } catch {
      setCookieResult({
        valid: false,
        message: 'Impossible de tester la session Instagram.',
      });
    } finally {
      setCookieTesting(false);
    }
  };

  const renderSortButton = (key: PlatformSortKey, label: string, alignRight = false) => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      className={`inline-flex items-center gap-1 font-semibold hover:text-admin-text transition-colors cursor-pointer ${
        alignRight ? 'justify-end ml-auto' : ''
      } ${sortKey === key ? 'text-admin-text' : 'text-admin-text-secondary'}`}
    >
      <span>{label}</span>
      <ArrowUpDown className="w-3 h-3 opacity-70" />
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-admin-border bg-admin-muted/60">
                <th className="py-3 pl-4 pr-3">{renderSortButton('label', 'Plateforme')}</th>
                <th className="py-3 px-3 text-right">
                  {renderSortButton('total', 'Req (30j)', true)}
                </th>
                <th className="py-3 px-3 text-right">
                  {renderSortButton('successRate', 'Succès %', true)}
                </th>
                <th className="py-3 px-3 text-right">
                  {renderSortButton('error', 'Échecs', true)}
                </th>
                <th className="py-3 px-3 text-admin-text-secondary font-semibold">
                  Top erreur
                </th>
                <th className="py-3 px-3">{renderSortButton('status', 'Statut')}</th>
                <th className="py-3 pl-3 pr-4 text-right text-admin-text-secondary font-semibold">
                  Test
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border/70">
              {sortedRows.map((row) => {
                const statusMeta = getCombinedStatusMeta(row.status);
                const isExpanded = expandedPlatform === row.key;
                const feedback = testFeedback[row.key];

                return (
                  <React.Fragment key={row.key}>
                    <tr
                      data-testid={`platform-row-${row.key}`}
                      className={`transition-colors ${
                        isExpanded
                          ? 'bg-admin-hover/50'
                          : 'hover:bg-admin-hover/35'
                      }`}
                    >
                      <td className="py-3 pl-4 pr-3">
                        <div className="font-display font-semibold text-admin-text">
                          {row.label}
                        </div>
                        <div className="text-[11px] text-admin-text-muted">
                          {row.engineSubtitle}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-semibold text-admin-text tabular-nums whitespace-nowrap">
                        {formatNumberFr(row.total)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                        <span
                          className={
                            row.successRate === null
                              ? 'text-admin-text-muted'
                              : row.successRate >= 85
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : row.successRate >= 50
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-red-700 dark:text-red-400'
                          }
                        >
                          {formatSafeRateValue(row.successRate, row.total)}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        <span
                          className={
                            row.error > 0
                              ? 'text-red-700 dark:text-red-400 font-semibold'
                              : 'text-admin-text-muted'
                          }
                        >
                          {formatNumberFr(row.error)}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-mono whitespace-nowrap">
                        {row.topError ? (
                          onSelectError ? (
                            <button
                              type="button"
                              onClick={() => onSelectError(row.key, row.topError!)}
                              className="text-amber-800 dark:text-amber-300 hover:underline font-semibold cursor-pointer"
                              title="Filtrer le journal sur cette erreur"
                            >
                              {row.topError}
                              {row.topErrorCount > 0 ? ` (${row.topErrorCount})` : ''}
                            </button>
                          ) : (
                            <span className="text-amber-800 dark:text-amber-300 font-semibold">
                              {row.topError}
                            </span>
                          )
                        ) : (
                          <span className="text-admin-text-muted">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold ${getStatusBadgeClasses(
                            row.status
                          )}`}
                        >
                          {statusMeta.label}
                        </span>
                      </td>

                      <td className="py-3 pl-3 pr-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-label={`Détails et test ${row.label}`}
                          onClick={() =>
                            setExpandedPlatform((prev) =>
                              prev === row.key ? null : row.key
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-admin-border-strong bg-admin-muted hover:bg-admin-hover text-xs font-medium text-admin-text cursor-pointer transition-colors"
                        >
                          <span>{readOnly ? 'Détail' : 'Tester'}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-admin-muted/30">
                        <td colSpan={7} className="p-4 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                            <div className="p-2.5 rounded-md border border-admin-border bg-admin-surface">
                              <span className="text-admin-text-muted block">
                                Dernière réussite
                              </span>
                              <span className="font-mono font-semibold text-admin-text">
                                {formatDateTimeFr(row.lastSuccessTs)}
                              </span>
                            </div>
                            <div className="p-2.5 rounded-md border border-admin-border bg-admin-surface">
                              <span className="text-admin-text-muted block">
                                Dernier test manuel
                              </span>
                              <span className="font-mono font-semibold text-admin-text">
                                {formatDateTimeFr(row.lastTestTs)}
                              </span>
                            </div>
                            <div className="p-2.5 rounded-md border border-admin-border bg-admin-surface">
                              <span className="text-admin-text-muted block">
                                Direct vs Tiers (7j)
                              </span>
                              <span className="font-mono font-semibold text-admin-text tabular-nums">
                                {row.direct7d + row.tiers7d > 0
                                  ? `${row.direct7d} direct · ${row.tiers7d} tiers (${formatSafeRateValue(
                                      row.thirdPartyRate7d,
                                      row.direct7d + row.tiers7d
                                    )})`
                                  : '—'}
                              </span>
                            </div>
                          </div>

                          {!readOnly && (
                            <div className="space-y-1.5">
                              <div className="flex flex-col md:flex-row gap-2">
                                <input
                                  type="url"
                                  aria-label={`URL de test ${row.label}`}
                                  value={getUrlForPlatform(row)}
                                  onChange={(e) =>
                                    setUrlDrafts((prev) => ({
                                      ...prev,
                                      [row.key]: e.target.value,
                                    }))
                                  }
                                  placeholder={`Collez une URL publique ${row.label}…`}
                                  className="flex-1 px-3 py-2 rounded-md bg-admin-surface border border-admin-border-strong text-xs font-mono text-admin-text placeholder-admin-text-muted focus:outline-none focus:border-admin-accent"
                                />
                                <button
                                  type="button"
                                  disabled={testingPlatform === row.key}
                                  onClick={() => handleTestEngine(row)}
                                  className="px-4 py-2 rounded-md bg-admin-accent hover:opacity-90 disabled:opacity-50 text-white font-display font-semibold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                  <span>
                                    {testingPlatform === row.key
                                      ? 'Test en cours…'
                                      : 'Tester maintenant'}
                                  </span>
                                </button>
                              </div>
                              <p className="text-[11px] text-admin-text-muted">
                                Test diagnostic uniquement — n’est pas comptabilisé dans les statistiques ni dans le journal d’erreurs.
                              </p>
                            </div>
                          )}

                          {feedback && (
                            <div
                              className={`p-2.5 rounded-md text-xs font-mono flex items-start gap-2 border ${
                                feedback.ok
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
                                  : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800/60 text-red-900 dark:text-red-200'
                              }`}
                            >
                              {feedback.ok ? (
                                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                              ) : (
                                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                              )}
                              <span>{feedback.message}</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-admin-border bg-admin-muted/30 text-[11px] text-admin-text-muted">
          Volumes &amp; échecs : compteurs agrégés <span className="font-mono">daily_metrics</span> (30j UTC) · Top erreur : journal détaillé <span className="font-mono">request_log</span> (30j UTC).
        </div>
      </div>

      {/* Collapsible Advanced Diagnostics (IG Cookie + Stories Providers) */}
      <div className="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
        <button
          type="button"
          aria-expanded={showAdvancedDiag}
          onClick={() => setShowAdvancedDiag((prev) => !prev)}
          className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-admin-hover/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2 text-xs font-display font-bold text-admin-text">
            <KeyRound className="w-4 h-4 text-admin-text-muted" />
            <span>Diagnostics avancés (Session Instagram &amp; Fournisseurs Stories)</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                igCookieConfigured
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-300'
                  : 'bg-admin-muted border-admin-border text-admin-text-muted'
              }`}
            >
              Cookie IG : {igCookieConfigured ? 'Défini' : 'Non défini'}
            </span>
            {showAdvancedDiag ? (
              <ChevronUp className="w-4 h-4 text-admin-text-muted" />
            ) : (
              <ChevronDown className="w-4 h-4 text-admin-text-muted" />
            )}
          </div>
        </button>

        {showAdvancedDiag && (
          <div className="p-4 border-t border-admin-border space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-admin-text">
                  Secret session Instagram (<code className="font-mono">IG_SESSION_ID</code> /{' '}
                  <code className="font-mono">IG_COOKIES</code>)
                </p>
                <p className="text-admin-text-muted mt-0.5">
                  Modifiable uniquement via Cloudflare Pages Secrets (jamais exposé par l’API).
                </p>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={handleTestIgCookie}
                  disabled={cookieTesting}
                  className="px-3 py-1.5 rounded-md bg-admin-muted hover:bg-admin-hover border border-admin-border-strong font-medium text-admin-text inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Activity className="w-3.5 h-3.5 text-admin-text-muted" />
                  <span>{cookieTesting ? 'Vérification…' : 'Tester la session IG'}</span>
                </button>
              )}
            </div>

            {cookieResult && (
              <div
                className={`p-2.5 rounded-md border flex items-center gap-2 ${
                  cookieResult.valid
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>{cookieResult.message}</span>
              </div>
            )}

            {storiesStatus && (
              <div className="pt-3 border-t border-admin-border space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-admin-text">
                    Fournisseurs Stories Instagram
                  </span>
                  <span className="font-mono text-admin-text-secondary">
                    {storiesStatus.enabled ? 'Actif' : 'Désactivé'} · Fournisseur :{' '}
                    <strong className="text-admin-text">
                      {storiesStatus.activeProvider || 'aucun'}
                    </strong>{' '}
                    · {storiesStatus.callsLastHour} / {storiesStatus.globalHourlyCap} appels/h
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {storiesStatus.providers.map((prov) => (
                    <div
                      key={prov.name}
                      className="p-3 rounded-md border border-admin-border bg-admin-muted/40 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-admin-text">{prov.name}</span>
                        <span className="text-[11px] text-admin-text-secondary">
                          {prov.configured ? 'Configuré' : 'Non configuré'}
                        </span>
                      </div>
                      <div className="text-admin-text-muted flex justify-between">
                        <span>Appels (1h)</span>
                        <span className="font-mono text-admin-text">{prov.callsLastHour}</span>
                      </div>
                      {prov.lastErrorCode && (
                        <div className="font-mono text-red-700 dark:text-red-300 truncate">
                          {prov.lastErrorCode}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
