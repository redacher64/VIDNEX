import React, { useEffect, useState } from 'react';
import {
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  HeartPulse,
} from './AdminIcons';

interface DailyBucket {
  day: string;
  total: number;
  success: number;
  error: number;
}

interface PlatformStats {
  total: number;
  success: number;
  error: number;
  successRate: number;
}

interface EngineHealthSummary {
  platform:
    | 'tiktok'
    | 'instagram'
    | 'instagram_profile'
    | 'x'
    | 'facebook'
    | 'linkedin';
  last_success_ts: number | null;
  last_test_ts: number | null;
  last_test_ok: number | null;
  last_error_code: string | null;
}

interface StatsResponse {
  ok: boolean;
  dbConnected: boolean;
  counts: {
    today: number;
    last7d: number;
    last30d: number;
  };
  platforms: {
    tiktok: PlatformStats;
    instagram: PlatformStats;
    instagram_profile?: PlatformStats;
    x: PlatformStats;
    facebook: PlatformStats;
    linkedin?: PlatformStats;
  };
  errors: Array<{ code: string; count: number }>;
  daily: DailyBucket[];
}

interface DashboardProps {
  onNavigateTab?: (tab: 'dashboard' | 'health' | 'controls' | 'activity') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigateTab }) => {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [engines, setEngines] = useState<{
    tiktok: EngineHealthSummary;
    instagram: EngineHealthSummary;
    instagram_profile: EngineHealthSummary;
    x: EngineHealthSummary;
    facebook: EngineHealthSummary;
    linkedin: EngineHealthSummary;
  }>({
    tiktok: {
      platform: 'tiktok',
      last_success_ts: null,
      last_test_ts: null,
      last_test_ok: 1,
      last_error_code: null,
    },
    instagram: {
      platform: 'instagram',
      last_success_ts: null,
      last_test_ts: null,
      last_test_ok: 1,
      last_error_code: null,
    },
    instagram_profile: {
      platform: 'instagram_profile',
      last_success_ts: null,
      last_test_ts: null,
      last_test_ok: 1,
      last_error_code: null,
    },
    x: {
      platform: 'x',
      last_success_ts: null,
      last_test_ts: null,
      last_test_ok: 1,
      last_error_code: null,
    },
    facebook: {
      platform: 'facebook',
      last_success_ts: null,
      last_test_ts: null,
      last_test_ok: 1,
      last_error_code: null,
    },
    linkedin: {
      platform: 'linkedin',
      last_success_ts: null,
      last_test_ts: null,
      last_test_ok: 1,
      last_error_code: null,
    },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, healthRes] = await Promise.all([
        fetch('/api/admin/stats', { headers: { Accept: 'application/json' } }),
        fetch('/api/admin/health', { headers: { Accept: 'application/json' } }),
      ]);
      const json = await statsRes.json();
      if (!statsRes.ok || !json.ok) {
        throw new Error(json.message || 'Erreur lors du chargement des métriques.');
      }
      setData(json);

      if (healthRes.ok) {
        const healthJson = await healthRes.json().catch(() => null);
        if (healthJson?.ok && healthJson.engines) {
          setEngines((prev) => ({
            tiktok: healthJson.engines.tiktok || prev.tiktok,
            instagram: healthJson.engines.instagram || prev.instagram,
            instagram_profile:
              healthJson.engines.instagram_profile || prev.instagram_profile,
            x: healthJson.engines.x || prev.x,
            facebook: healthJson.engines.facebook || prev.facebook,
            linkedin: healthJson.engines.linkedin || prev.linkedin,
          }));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const counts = data?.counts || { today: 0, last7d: 0, last30d: 0 };
  const tiktok = data?.platforms.tiktok || { total: 0, success: 0, error: 0, successRate: 0 };
  const instagram = data?.platforms.instagram || { total: 0, success: 0, error: 0, successRate: 0 };
  const instagramProfileStats = data?.platforms.instagram_profile || {
    total: 0,
    success: 0,
    error: 0,
    successRate: 0,
  };
  const xStats = data?.platforms.x || { total: 0, success: 0, error: 0, successRate: 0 };
  const facebookStats = data?.platforms.facebook || { total: 0, success: 0, error: 0, successRate: 0 };
  const linkedinStats = data?.platforms.linkedin || { total: 0, success: 0, error: 0, successRate: 0 };
  const daily = data?.daily || [];
  const maxDaily = Math.max(1, ...daily.map((d) => d.total));
  const totalErrors = (data?.errors || []).reduce((acc, item) => acc + item.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-white">
            Vue d’ensemble & Télémétrie D1
          </h2>
          <p className="text-xs text-orange-200/65 font-mono">
            Purge automatique opportuniste des journaux de plus de 30 jours activée
          </p>
        </div>
        <button
          type="button"
          onClick={loadStats}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-[#241811] hover:bg-[#2f2016] border border-orange-800/60 text-xs font-mono text-orange-200 flex items-center gap-2 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/50 border border-red-800/70 text-red-200 text-xs">
          {error}
        </div>
      )}

      {/* KPI Cards: Aujourd'hui / 7 jours / 30 jours */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#1c140e] border border-orange-900/50 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-mono text-orange-300/70 mb-2">
            <span>EXTRACTIONS AUJOURD’HUI</span>
            <TrendingUp className="w-4 h-4 text-orange-400" />
          </div>
          <p className="font-display text-3xl font-bold text-white tabular-nums">
            {counts.today}
          </p>
          <p className="mt-1 text-[11px] text-orange-200/55 font-mono">
            Depuis 00:00 UTC
          </p>
        </div>

        <div className="bg-[#1c140e] border border-orange-900/50 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-mono text-orange-300/70 mb-2">
            <span>7 DERNIERS JOURS</span>
            <BarChart3 className="w-4 h-4 text-amber-400" />
          </div>
          <p className="font-display text-3xl font-bold text-white tabular-nums">
            {counts.last7d}
          </p>
          <p className="mt-1 text-[11px] text-orange-200/55 font-mono">
            Fenêtre glissante 168h
          </p>
        </div>

        <div className="bg-[#1c140e] border border-orange-900/50 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-mono text-orange-300/70 mb-2">
            <span>30 DERNIERS JOURS</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="font-display text-3xl font-bold text-white tabular-nums">
            {counts.last30d}
          </p>
          <p className="mt-1 text-[11px] text-orange-200/55 font-mono">
            Rétention maximale D1 (30j)
          </p>
        </div>
      </div>

      {/* Résumé Santé des moteurs */}
      <div className="bg-[#1c140e] border border-orange-900/50 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-orange-400" />
            <h3 className="font-display text-sm font-bold text-white">
              Santé des moteurs
            </h3>
          </div>
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('health')}
              className="text-xs font-mono text-orange-300 hover:text-orange-200 underline underline-offset-4 cursor-pointer"
            >
              Ouvrir les tests de santé →
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(
            [
              { key: 'tiktok', label: 'TikTok', sub: 'TikWM / HTML' },
              { key: 'instagram', label: 'Instagram', sub: 'Embed / GraphQL' },
              { key: 'instagram_profile', label: 'Profil Instagram', sub: 'Photo de profil' },
              { key: 'x', label: 'X (Twitter)', sub: 'Syndication twimg' },
              { key: 'facebook', label: 'Facebook', sub: 'HTML / Mobile' },
              { key: 'linkedin', label: 'LinkedIn', sub: 'Photo de profil publique' },
            ] as const
          ).map(({ key, label, sub }) => {
            const eng = engines[key];
            const isOk = eng?.last_test_ok !== 0;
            return (
              <div
                key={key}
                className="p-3.5 rounded-xl bg-[#120c08] border border-orange-950/80 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      isOk
                        ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                        : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]'
                    }`}
                  />
                  <div>
                    <span className="font-display text-xs font-bold text-white block">
                      {label}
                    </span>
                    <span className="font-mono text-[10px] text-orange-200/55 block">
                      {sub}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    isOk
                      ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                      : 'bg-red-950/60 border-red-700/60 text-red-300'
                  }`}
                >
                  {isOk ? 'En ligne' : `Hors ligne${eng?.last_error_code ? ` (${eng.last_error_code})` : ''}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Taux de succès et d'échec par plateforme */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { key: 'tiktok', label: 'TikTok (TikWM / HTML)', stats: tiktok },
          { key: 'instagram', label: 'Instagram (Reels / Posts)', stats: instagram },
          { key: 'instagram_profile', label: 'Profil Instagram (DP)', stats: instagramProfileStats },
          { key: 'x', label: 'X (Twitter) (Syndication)', stats: xStats },
          { key: 'facebook', label: 'Facebook (HTML / Mobile)', stats: facebookStats },
          { key: 'linkedin', label: 'LinkedIn (Photo de profil)', stats: linkedinStats },
        ].map(({ key, label, stats }) => {
          const failRate =
            stats.total > 0 ? Math.round((stats.error / stats.total) * 1000) / 10 : 0;
          return (
            <div
              key={key}
              className="bg-[#1c140e] border border-orange-900/50 rounded-2xl p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-white">{label}</h3>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-orange-950/80 border border-orange-800/60 text-orange-300 tabular-nums">
                  {stats.total} req (30j)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40">
                  <span className="text-[11px] font-mono text-emerald-300/80 block">
                    Taux de succès
                  </span>
                  <span className="font-display text-xl font-bold text-emerald-400 tabular-nums">
                    {stats.successRate}%
                  </span>
                  <span className="text-[11px] font-mono text-emerald-200/60 block">
                    {stats.success} réussie(s)
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-red-950/30 border border-red-800/40">
                  <span className="text-[11px] font-mono text-red-300/80 block">
                    Taux d’échec
                  </span>
                  <span className="font-display text-xl font-bold text-red-400 tabular-nums">
                    {failRate}%
                  </span>
                  <span className="text-[11px] font-mono text-red-200/60 block">
                    {stats.error} échec(s)
                  </span>
                </div>
              </div>

              {/* Barre de progression SVG/CSS */}
              <div className="w-full h-2.5 rounded-full bg-[#120c08] overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${stats.total > 0 ? stats.successRate : 0}%` }}
                />
                <div
                  className="bg-red-500 h-full transition-all duration-300"
                  style={{ width: `${stats.total > 0 ? failRate : 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Graphique SVG/CSS des 30 derniers jours */}
      <div className="bg-[#1c140e] border border-orange-900/50 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-display text-sm font-bold text-white">
              Historique des extractions (30 derniers jours)
            </h3>
            <p className="text-xs text-orange-200/60 font-mono">
              Graphique natif SVG/CSS sans dépendance externe (Succès vs Échecs par jour UTC)
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
              Succès
            </span>
            <span className="flex items-center gap-1.5 text-red-400">
              <span className="w-2.5 h-2.5 rounded-xs bg-red-500 inline-block" />
              Erreurs
            </span>
          </div>
        </div>

        <div className="h-48 pt-4 pb-2 px-2 bg-[#120c08] rounded-xl border border-orange-950/80 flex items-end gap-1 sm:gap-1.5">
          {daily.map((bucket) => {
            const totalHeightPct = Math.round((bucket.total / maxDaily) * 100);
            const successPct =
              bucket.total > 0 ? Math.round((bucket.success / bucket.total) * 100) : 0;
            const errorPct = 100 - successPct;

            return (
              <div
                key={bucket.day}
                className="flex-1 h-full flex flex-col justify-end items-center group relative"
                title={`${bucket.day} : ${bucket.total} total (${bucket.success} OK, ${bucket.error} err)`}
              >
                <div
                  className="w-full max-w-[18px] rounded-t bg-orange-950/40 overflow-hidden flex flex-col justify-end transition-all"
                  style={{ height: `${Math.max(bucket.total > 0 ? 8 : 2, totalHeightPct)}%` }}
                >
                  {bucket.total > 0 ? (
                    <>
                      <div
                        className="w-full bg-red-500/90"
                        style={{ height: `${errorPct}%` }}
                      />
                      <div
                        className="w-full bg-emerald-500/90"
                        style={{ height: `${successPct}%` }}
                      />
                    </>
                  ) : (
                    <div className="w-full h-[2px] bg-orange-900/40" />
                  )}
                </div>
                <span className="mt-1.5 text-[9px] font-mono text-orange-200/45 hidden lg:inline-block">
                  {bucket.day.slice(8, 10)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Répartition des codes d'erreur */}
      <div className="bg-[#1c140e] border border-orange-900/50 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="font-display text-sm font-bold text-white">
              Répartition des erreurs (30 jours)
            </h3>
          </div>
          <span className="text-xs font-mono text-orange-200/60 tabular-nums">
            Total erreurs : {totalErrors}
          </span>
        </div>

        {!data?.errors || data.errors.length === 0 ? (
          <p className="text-xs font-mono text-orange-200/50 py-4 text-center">
            Aucune erreur enregistrée sur les 30 derniers jours.
          </p>
        ) : (
          <div className="space-y-2.5">
            {data.errors.map((errItem) => {
              const pct =
                totalErrors > 0 ? Math.round((errItem.count / totalErrors) * 1000) / 10 : 0;
              return (
                <div key={errItem.code} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-orange-200 font-semibold">{errItem.code}</span>
                    <span className="text-orange-300/80 tabular-nums">
                      {errItem.count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#120c08] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-amber-500"
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
