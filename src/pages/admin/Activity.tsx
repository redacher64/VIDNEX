import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Copy, Check, Info } from './AdminIcons';

interface ActivityRow {
  id: number;
  ts: number;
  platform: string;
  status: string;
  error_code: string | null;
  engine_stage?: string | null;
  http_status?: number | null;
  duration_ms: number;
  ip_hash_short: string;
  ip_hash: string;
}

export const Activity: React.FC = () => {
  const [items, setItems] = useState<ActivityRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const loadActivity = async (targetPage = page) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/activity?page=${targetPage}&limit=20`, {
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
    loadActivity(page);
  }, [page]);

  const handleCopyHash = (id: number, hash: string) => {
    navigator.clipboard?.writeText(hash);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-white">
            Journal d’activité en temps réel
          </h2>
          <p className="text-xs text-orange-200/65 font-mono">
            Aucune URL de vidéo, aucun cookie ni adresse IP en clair n’est stocké (SHA-256 + IP_HASH_SALT)
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadActivity(page)}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-[#241811] hover:bg-[#2f2016] border border-orange-800/60 text-xs font-mono text-orange-200 flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualiser ({total})</span>
        </button>
      </div>

      <div className="bg-[#1c140e] border border-orange-900/50 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-orange-900/50 bg-[#140e0a] text-[11px] font-mono uppercase text-orange-300/75">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Plateforme</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4">Niveau (engine_stage)</th>
                <th className="py-3 px-4">HTTP</th>
                <th className="py-3 px-4">Code Erreur</th>
                <th className="py-3 px-4">Durée</th>
                <th className="py-3 px-4">IP Hachée (tronquée)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-950/60 text-xs font-mono">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-orange-200/50">
                    Aucune requête enregistrée pour le moment.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="hover:bg-orange-950/20">
                    <td className="py-3 px-4 text-orange-200/80 whitespace-nowrap">
                      {new Date(row.ts < 10_000_000_000 ? row.ts * 1000 : row.ts).toLocaleString('fr-FR')}
                    </td>
                    <td className="py-3 px-4 capitalize text-white font-semibold">
                      {row.platform === 'x'
                        ? 'X (Twitter)'
                        : row.platform === 'facebook'
                        ? 'Facebook'
                        : row.platform === 'instagram_profile'
                        ? 'Profil Instagram'
                        : row.platform}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                          row.status === 'success'
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                            : 'bg-red-950/80 text-red-300 border border-red-800/60'
                        }`}
                      >
                        {row.status === 'success' ? 'SUCCÈS' : 'ÉCHEC'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-orange-200/90 whitespace-nowrap">
                      {row.engine_stage || '—'}
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {row.http_status != null ? (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            row.http_status >= 200 && row.http_status < 300
                              ? 'bg-emerald-950/60 text-emerald-300'
                              : row.http_status === 404
                              ? 'bg-zinc-800 text-zinc-300'
                              : 'bg-amber-950/70 text-amber-300'
                          }`}
                        >
                          {row.http_status}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4 text-amber-300/90">
                      {row.error_code || '—'}
                    </td>
                    <td className="py-3 px-4 text-orange-200/80 tabular-nums">
                      {row.duration_ms} ms
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-orange-200/70">{row.ip_hash_short}</span>
                        {row.ip_hash && (
                          <button
                            type="button"
                            onClick={() => handleCopyHash(row.id, row.ip_hash)}
                            className="text-orange-400/70 hover:text-orange-300 p-1 cursor-pointer"
                            title="Copier le hash complet pour la liste de blocage"
                          >
                            {copiedId === row.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-orange-900/40 bg-[#140e0a] flex items-center justify-between text-xs font-mono text-orange-200/70">
          <span>
            Page {page} sur {totalPages} ({total} entrées)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1.5 rounded-lg bg-[#1c140e] border border-orange-900/60 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Préc.</span>
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1.5 rounded-lg bg-[#1c140e] border border-orange-900/60 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
            >
              <span>Suiv.</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Note explicite sur l'absence de formulaire de contact */}
      <div className="p-4 rounded-2xl bg-[#1c140e] border border-orange-900/40 text-xs text-orange-200/70 font-mono flex items-start gap-2.5">
        <Info className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
        <span>
          <strong>Messages de contact :</strong> Le site public VIDNEX ne comporte pas de formulaire
          de contact ; conformément au cahier des charges, la table <code>messages</code> a été
          ignorée afin de garder le schéma D1 minimaliste.
        </span>
      </div>
    </div>
  );
};
