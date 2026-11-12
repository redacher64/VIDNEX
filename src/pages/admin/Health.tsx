import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Play,
  KeyRound,
  ShieldCheck,
  Info,
} from './AdminIcons';

type HealthPlatformId =
  | 'tiktok'
  | 'instagram'
  | 'instagram_profile'
  | 'x'
  | 'facebook'
  | 'linkedin';

interface EngineRow {
  platform: HealthPlatformId;
  last_success_ts: number | null;
  last_test_ts: number | null;
  last_test_ok: number | null;
  last_error_code: string | null;
  test_url: string;
}

import {
  DEFAULT_ENGINE_TEST_URLS,
  DEFAULT_X_TEST_URL,
  getEngineStatusLabel,
} from './healthConfig.ts';

export { DEFAULT_ENGINE_TEST_URLS, DEFAULT_X_TEST_URL, getEngineStatusLabel };

export const Health: React.FC = () => {
  const [engines, setEngines] = useState<Record<HealthPlatformId, EngineRow>>({
    tiktok: {
      platform: 'tiktok',
      last_success_ts: null,
      last_test_ts: null,
      last_test_ok: 1,
      last_error_code: null,
      test_url: DEFAULT_ENGINE_TEST_URLS.tiktok,
    },
    instagram: {
      platform: 'instagram',
      last_success_ts: null,
      last_test_ts: null,
      last_test_ok: 1,
      last_error_code: null,
      test_url: DEFAULT_ENGINE_TEST_URLS.instagram,
    },
    instagram_profile: {
      platform: 'instagram_profile',
      last_success_ts: null,
      last_test_ts: null,
      last_test_ok: 1,
      last_error_code: null,
      test_url: '',
    },
    x: {
      platform: 'x',
      last_success_ts: null,
      last_test_ts: null,
      last_test_ok: 1,
      last_error_code: null,
      test_url: DEFAULT_X_TEST_URL,
    },
    facebook: {
      platform: 'facebook',
      last_success_ts: null,
      last_test_ts: null,
      last_test_ok: 1,
      last_error_code: null,
      test_url: '',
    },
    linkedin: {
      platform: 'linkedin',
      last_success_ts: null,
      last_test_ts: null,
      last_test_ok: 1,
      last_error_code: null,
      test_url: '',
    },
  });
  const [igCookieConfigured, setIgCookieConfigured] = useState(false);
  const [tiktokUrl, setTiktokUrl] = useState(DEFAULT_ENGINE_TEST_URLS.tiktok);
  const [instagramUrl, setInstagramUrl] = useState(DEFAULT_ENGINE_TEST_URLS.instagram);
  const [instagramProfileUrl, setInstagramProfileUrl] = useState('');
  const [xUrl, setXUrl] = useState(DEFAULT_X_TEST_URL);
  const [facebookUrl, setFacebookUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [testingPlatform, setTestingPlatform] = useState<HealthPlatformId | null>(null);
  const [testFeedback, setTestFeedback] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});
  const [cookieTesting, setCookieTesting] = useState(false);
  const [cookieProbeResult, setCookieProbeResult] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);

  const loadHealth = async () => {
    try {
      const res = await fetch('/api/admin/health', {
        headers: { Accept: 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setEngines((prev) => ({
          tiktok: data.engines?.tiktok
            ? {
                ...data.engines.tiktok,
                test_url: data.engines.tiktok.test_url || DEFAULT_ENGINE_TEST_URLS.tiktok,
              }
            : prev.tiktok,
          instagram: data.engines?.instagram
            ? {
                ...data.engines.instagram,
                test_url: data.engines.instagram.test_url || DEFAULT_ENGINE_TEST_URLS.instagram,
              }
            : prev.instagram,
          instagram_profile: data.engines?.instagram_profile
            ? {
                ...data.engines.instagram_profile,
                test_url: data.engines.instagram_profile.test_url || '',
              }
            : prev.instagram_profile,
          x: data.engines?.x
            ? {
                ...data.engines.x,
                test_url: data.engines.x.test_url || DEFAULT_X_TEST_URL,
              }
            : prev.x,
          facebook: data.engines?.facebook
            ? {
                ...data.engines.facebook,
                test_url: data.engines.facebook.test_url || '',
              }
            : prev.facebook,
          linkedin: data.engines?.linkedin
            ? {
                ...data.engines.linkedin,
                test_url: data.engines.linkedin.test_url || '',
              }
            : prev.linkedin,
        }));
        setIgCookieConfigured(Boolean(data.instagramCookie?.configured));
        if (data.engines?.tiktok?.test_url) {
          setTiktokUrl(data.engines.tiktok.test_url);
        }
        if (data.engines?.instagram?.test_url) {
          setInstagramUrl(data.engines.instagram.test_url);
        }
        if (
          typeof data.engines?.instagram_profile?.test_url === 'string' &&
          data.engines.instagram_profile.test_url
        ) {
          setInstagramProfileUrl(data.engines.instagram_profile.test_url);
        }
        if (data.engines?.x?.test_url) {
          setXUrl(data.engines.x.test_url);
        }
        if (typeof data.engines?.facebook?.test_url === 'string' && data.engines.facebook.test_url) {
          setFacebookUrl(data.engines.facebook.test_url);
        }
        if (typeof data.engines?.linkedin?.test_url === 'string' && data.engines.linkedin.test_url) {
          setLinkedinUrl(data.engines.linkedin.test_url);
        }
      }
    } catch {
      // Ignore error
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  const handleTestEngine = async (platform: HealthPlatformId) => {
    const rawUrl = (
      platform === 'tiktok'
        ? tiktokUrl
        : platform === 'instagram'
        ? instagramUrl
        : platform === 'instagram_profile'
        ? instagramProfileUrl
        : platform === 'x'
        ? xUrl
        : platform === 'linkedin'
        ? linkedinUrl
        : facebookUrl
    ).trim();
    const urlToTest =
      rawUrl ||
      engines[platform]?.test_url?.trim() ||
      DEFAULT_ENGINE_TEST_URLS[platform];
    if (!urlToTest) {
      setTestFeedback((prev) => ({
        ...prev,
        [platform]: {
          ok: false,
          message: 'Veuillez saisir une URL réelle avant de cliquer sur « Tester maintenant ».',
        },
      }));
      return;
    }

    setTestingPlatform(platform);
    setTestFeedback((prev) => {
      const next = { ...prev };
      delete next[platform];
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
          platform,
          url: urlToTest,
        }),
      });
      const data = await res.json();
      setTestFeedback((prev) => ({
        ...prev,
        [platform]: {
          ok: Boolean(data.testOk),
          message: data.message || 'Test terminé.',
        },
      }));
      await loadHealth();
    } catch {
      setTestFeedback((prev) => ({
        ...prev,
        [platform]: {
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
    setCookieProbeResult(null);
    try {
      const res = await fetch('/api/admin/health', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ action: 'test_ig_cookie' }),
      });
      const data = await res.json();
      setCookieProbeResult({
        valid: Boolean(data.valid),
        message: data.message || 'Test du cookie terminé.',
      });
    } catch {
      setCookieProbeResult({
        valid: false,
        message: 'Impossible de tester le cookie Instagram.',
      });
    } finally {
      setCookieTesting(false);
    }
  };

  const formatTs = (ts: number | null | undefined) => {
    if (!ts) return 'Jamais';
    const ms = ts < 10_000_000_000 ? ts * 1000 : ts;
    return new Date(ms).toLocaleString('fr-FR');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-white">
          Santé des moteurs d’extraction
        </h2>
        <p className="text-xs text-orange-200/65 font-mono">
          Vérification en direct sur l’URL saisie par l’administrateur (TikTok, Instagram, Profil Instagram, X, Facebook et LinkedIn)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {(
          [
            'tiktok',
            'instagram',
            'instagram_profile',
            'x',
            'facebook',
            'linkedin',
          ] as const
        ).map((platform) => {
          const info = engines[platform];
          const isHealthy = info?.last_test_ok !== 0;
          const statusLabel = getEngineStatusLabel(info?.last_test_ok);
          const inputValue =
            platform === 'tiktok'
              ? tiktokUrl
              : platform === 'instagram'
              ? instagramUrl
              : platform === 'instagram_profile'
              ? instagramProfileUrl
              : platform === 'x'
              ? xUrl
              : platform === 'linkedin'
              ? linkedinUrl
              : facebookUrl;
          const setInputValue =
            platform === 'tiktok'
              ? setTiktokUrl
              : platform === 'instagram'
              ? setInstagramUrl
              : platform === 'instagram_profile'
              ? setInstagramProfileUrl
              : platform === 'x'
              ? setXUrl
              : platform === 'linkedin'
              ? setLinkedinUrl
              : setFacebookUrl;
          const feedback = testFeedback[platform];
          const platformLabel =
            platform === 'tiktok'
              ? 'TikTok'
              : platform === 'instagram'
              ? 'Instagram'
              : platform === 'instagram_profile'
              ? 'Profil Instagram'
              : platform === 'x'
              ? 'X (Twitter)'
              : platform === 'linkedin'
              ? 'LinkedIn'
              : 'Facebook';
          const engineDesc =
            platform === 'tiktok'
              ? 'TikWM / HTML'
              : platform === 'instagram'
              ? 'Embed / GraphQL'
              : platform === 'instagram_profile'
              ? 'web_profile_info / OG / Polaris'
              : platform === 'x'
              ? 'Syndication twimg.com'
              : platform === 'linkedin'
              ? 'Photo de profil publique (og:image / JSON-LD)'
              : 'HTML / Mobile Multi-Niveaux';

          return (
            <div
              key={platform}
              data-testid={`health-row-${platform}`}
              data-platform={platform}
              className="bg-[#1c140e] border border-orange-900/50 rounded-2xl p-5 flex flex-col gap-4"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-3 h-3 rounded-full shrink-0 ${
                        isHealthy
                          ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)]'
                          : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.7)]'
                      }`}
                    />
                    <div className="min-w-0">
                      <h3 className="font-display text-base font-bold text-white truncate">
                        Moteur {platformLabel}
                      </h3>
                      <span className="text-[10px] font-mono text-orange-200/55 block truncate">
                        Plateforme: {platform} · {engineDesc}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-mono px-2.5 py-1 rounded-md border shrink-0 ${
                      isHealthy
                        ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                        : 'bg-red-950/60 border-red-700/60 text-red-300'
                    }`}
                  >
                    {statusLabel}
                    {!isHealthy && info?.last_error_code ? ` (${info.last_error_code})` : ''}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono bg-[#120c08] p-3.5 rounded-xl border border-orange-950/80">
                  <div>
                    <span className="text-orange-200/50 block text-[10px]">DERNIÈRE RÉUSSITE</span>
                    <span className="text-orange-100 font-medium">
                      {formatTs(info?.last_success_ts)}
                    </span>
                  </div>
                  <div>
                    <span className="text-orange-200/50 block text-[10px]">DERNIER TEST MANUEL</span>
                    <span className="text-orange-100 font-medium">
                      {formatTs(info?.last_test_ts)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <label className="block text-xs font-mono text-orange-200/75">
                  URL de test {platformLabel} (saisie admin)
                </label>
                <div className="flex flex-col gap-2">
                  <input
                    type="url"
                    aria-label={`URL de test ${platformLabel}`}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={`Collez une URL ${platformLabel} publique à tester…`}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#120c08] border border-orange-900/70 text-xs text-white placeholder-orange-200/35 font-mono focus:outline-none focus:border-orange-500"
                  />
                  <button
                    type="button"
                    aria-label={`Tester maintenant ${platformLabel}`}
                    onClick={() => handleTestEngine(platform)}
                    disabled={testingPlatform === platform}
                    className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-white font-display font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>
                      {testingPlatform === platform ? 'Test en cours…' : 'Tester maintenant'}
                    </span>
                  </button>
                </div>

                {feedback && (
                  <div
                    className={`p-3 rounded-xl text-xs font-mono flex items-start gap-2 border ${
                      feedback.ok
                        ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                        : 'bg-red-950/40 border-red-800/60 text-red-200'
                    }`}
                  >
                    {feedback.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    )}
                    <span>{feedback.message}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Statut du cookie Instagram */}
      <div className="bg-[#1c140e] border border-orange-900/50 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-white">
                Statut du secret Cookie Instagram (IG_SESSION_ID / IG_COOKIES)
              </h3>
              <p className="text-xs text-orange-200/65 font-mono">
                La valeur du secret n’est jamais exposée ni renvoyée par l’API
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span
              className={`text-xs font-mono px-3 py-1 rounded-md border ${
                igCookieConfigured
                  ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                  : 'bg-amber-950/60 border-amber-700/60 text-amber-300'
              }`}
            >
              {igCookieConfigured ? 'DÉFINI' : 'NON DÉFINI'}
            </span>

            <button
              type="button"
              onClick={handleTestIgCookie}
              disabled={cookieTesting}
              className="px-3.5 py-2 rounded-xl bg-[#241811] hover:bg-[#2f2016] border border-orange-800/60 text-xs font-mono text-orange-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5 text-orange-400" />
              <span>{cookieTesting ? 'Vérification…' : 'Tester la session IG'}</span>
            </button>
          </div>
        </div>

        {cookieProbeResult && (
          <div
            className={`p-3 rounded-xl text-xs font-mono flex items-center gap-2 border ${
              cookieProbeResult.valid
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                : 'bg-amber-950/40 border-amber-800/60 text-amber-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{cookieProbeResult.message}</span>
          </div>
        )}

        <div className="p-3.5 rounded-xl bg-[#120c08] border border-orange-950/80 text-xs text-orange-200/75 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Note de sécurité Cloudflare :</strong> Une Pages Function / Worker ne peut pas
            modifier ses propres secrets d’environnement au runtime. Pour ajouter ou renouveler{' '}
            <code className="font-mono text-orange-300">IG_SESSION_ID</code> ou{' '}
            <code className="font-mono text-orange-300">IG_COOKIES</code>, modifiez-le dans le{' '}
            <strong>Dashboard Cloudflare</strong> (Pages / Workers &gt; Settings &gt; Variables and
            Secrets) ou via <code className="font-mono text-orange-300">wrangler pages secret put IG_SESSION_ID</code>.
          </p>
        </div>
      </div>
    </div>
  );
};
