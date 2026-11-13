import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Copy, Check, Info } from './AdminIcons';

interface ActivityRow {
  id: number;
  ts: number;
  platform: string;
  status: string;
  content_kind?: string | null;
  engine_fn?: string | null;
  engine_stage?: string | null;
  http_status?: number | null;
  error_code: string | null;
  duration_ms: number;
  ip_hash_short: string;
  ip_hash: string;
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

const ERROR_CODE_FILTER_OPTIONS = [
  { value: '', label: 'Tous les codes erreur' },
  { value: 'BLOCKED_BY_PLATFORM', label: 'BLOCKED_BY_PLATFORM' },
  { value: 'PRIVATE_OR_LOGIN_REQUIRED', label: 'PRIVATE_OR_LOGIN_REQUIRED' },
  { value: 'NOT_FOUND', label: 'NOT_FOUND' },
  { value: 'TIMEOUT', label: 'TIMEOUT' },
  { value: 'RATE_LIMITED', label: 'RATE_LIMITED' },
  { value: 'UNSUPPORTED_URL', label: 'UNSUPPORTED_URL' },
  { value: 'NO_VIDEO', label: 'NO_VIDEO' },
  { value: 'AGE_RESTRICTED', label: 'AGE_RESTRICTED' },
  { value: 'STORY_EXPIRED', label: 'STORY_EXPIRED' },
  { value: 'PLATFORM_DISABLED', label: 'PLATFORM_DISABLED' },
  { value: 'BLOCKED', label: 'BLOCKED' },
];

export const Activity: React.FC = () => {
  const [items, setItems] = useState<ActivityRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState('');
  const [errorCodeFilter, setErrorCodeFilter] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const loadActivity = async (
    targetPage = page,
    targetPlatform = platformFilter,
    targetErrorCode = errorCodeFilter
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: '20',
      });
      if (targetPlatform) params.set('platform', targetPlatform);
      if (targetErrorCode) params.set('error_code', targetErrorCode);

      const res = await fetch(`/api/admin/activity?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setItems(data.items || []);
        setPage(data.page || 1);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivity(page, platformFilter, errorCodeFilter);
  }, [page, platformFilter, errorCodeFilter]);

  const handleCopyRowJson = (row: ActivityRow) => {
    const normalizedTs = row.ts < 10_000_000_000 ? row.ts * 1000 : row.ts;
    const jsonPayload = {
      id: row.id,
      ts: row.ts,
      date: new Date(normalizedTs).toISOString(),
      platform: row.platform,
      content_kind: row.content_kind || null,
      engine_fn: row.engine_fn || null,
      engine_stage: row.engine_stage || null,
      http_status: row.http_status ?? null,
      error_code: row.error_code || null,
      duration_ms: row.duration_ms,
      ip_hash: row.ip_hash || null,
    };
    navigator.clipboard?.writeText(JSON.stringify(jsonPayload));
    setCopiedId(row.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const formatPlatformLabel = (platform: string): string => {
    if (platform === 'x') return 'X (Twitter)';
    if (platform === 'facebook') return 'Facebook';
    if (platform === 'linkedin') return 'LinkedIn';
    if (platform === 'instagram_profile') return 'Profil Instagram';
    if (platform === 'instagram') return 'Instagram';
    if (platform === 'tiktok') return 'TikTok';
    return platform || '—';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-admin-text">
            Journal détaillé des erreurs (30j)
          </h2>
          <p className="text-xs text-admin-text-muted font-mono">
            Seules les erreurs sont journalisées ici (IP hachée salée tronquée conservée 30 jours, jamais en clair — aucune URL stockée)
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
            className="px-3 py-2 rounded-xl bg-admin-muted border border-admin-border-strong text-xs font-mono text-admin-text focus:outline-none focus:border-orange-600"
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
            className="px-3 py-2 rounded-xl bg-admin-muted border border-admin-border-strong text-xs font-mono text-admin-text focus:outline-none focus:border-orange-600"
          >
            {ERROR_CODE_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => loadActivity(page, platformFilter, errorCodeFilter)}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-admin-muted hover:bg-admin-hover border border-admin-border-strong text-xs font-mono font-medium text-admin-text flex items-center gap-2 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-admin-accent ${loading ? 'animate-spin' : ''}`} />
            <span>Actualiser ({total})</span>
          </button>
        </div>
      </div>

      <div className="bg-admin-surface border border-admin-border rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-admin-border bg-admin-muted text-[11px] font-mono font-semibold uppercase text-admin-text-secondary">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Plateforme</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Fonction</th>
                <th className="py-3 px-4">Niveau</th>
                <th className="py-3 px-4">HTTP</th>
                <th className="py-3 px-4">Code erreur</th>
                <th className="py-3 px-4">Durée</th>
                <th className="py-3 px-4">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border text-xs font-mono">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-admin-text-muted">
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

                  return (
                    <tr key={row.id} className="hover:bg-admin-hover/60 transition-colors">
                      <td className="py-3 px-4 text-admin-text-secondary whitespace-nowrap">
                        {new Date(row.ts < 10_000_000_000 ? row.ts * 1000 : row.ts).toLocaleString('fr-FR')}
                      </td>
                      <td className="py-3 px-4 text-admin-text font-semibold whitespace-nowrap">
                        {formatPlatformLabel(row.platform)}
                      </td>
                      <td className="py-3 px-4 text-admin-text-secondary whitespace-nowrap">
                        {row.content_kind || '—'}
                      </td>
                      <td className="py-3 px-4 text-admin-text-secondary whitespace-nowrap">
                        {row.engine_fn || '—'}
                      </td>
                      <td className="py-3 px-4 text-admin-text-secondary whitespace-nowrap">
                        {row.engine_stage || '—'}
                      </td>
                      <td className="py-3 px-4 tabular-nums whitespace-nowrap">
                        {row.http_status != null ? (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                              row.http_status >= 200 && row.http_status < 300
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-300'
                                : row.http_status === 404
                                ? 'bg-stone-100 dark:bg-zinc-800 border-stone-300 dark:border-zinc-700 text-stone-800 dark:text-zinc-300'
                                : 'bg-amber-50 dark:bg-amber-950/70 border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-300'
                            }`}
                          >
                            {row.http_status}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-amber-900 dark:text-amber-300 whitespace-nowrap">
                        {row.error_code || '—'}
                      </td>
                      <td className="py-3 px-4 text-admin-text-secondary tabular-nums whitespace-nowrap">
                        {row.duration_ms != null ? `${row.duration_ms} ms` : '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-admin-text-muted">{displayIp}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyRowJson(row)}
                            className="px-2 py-1 rounded-lg bg-admin-muted hover:bg-admin-hover border border-admin-border-strong text-[11px] font-medium text-admin-text flex items-center gap-1 cursor-pointer transition-colors"
                            title="Copier le JSON de la ligne (sans URL)"
                          >
                            {copiedId === row.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                                <span className="text-emerald-800 dark:text-emerald-300">Copié</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-admin-accent" />
                                <span>Copier</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-admin-border bg-admin-muted flex items-center justify-between text-xs font-mono text-admin-text-secondary">
          <span>
            Page {page} sur {totalPages} ({total} entrées)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1.5 rounded-lg bg-admin-surface hover:bg-admin-hover border border-admin-border-strong text-admin-text disabled:opacity-40 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Préc.</span>
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1.5 rounded-lg bg-admin-surface hover:bg-admin-hover border border-admin-border-strong text-admin-text disabled:opacity-40 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>Suiv.</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Note explicite sur l'absence de formulaire de contact */}
      <div className="p-4 rounded-2xl bg-admin-surface border border-admin-border text-xs text-admin-text-secondary font-mono flex items-start gap-2.5 shadow-2xs">
        <Info className="w-4 h-4 text-admin-accent shrink-0 mt-0.5" />
        <span>
          <strong>Messages de contact :</strong> Le site public VIDNEX ne comporte pas de formulaire
          de contact ; conformément au cahier des charges, la table <code className="text-admin-accent font-semibold">messages</code> a été
          ignorée afin de garder le schéma D1 minimaliste.
        </span>
      </div>
    </div>
  );
};
