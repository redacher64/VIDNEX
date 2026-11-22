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

interface StoriesProviderStatusItem {
  name: 'session' | 'relay' | 'paid' | 'mock';
  configured: boolean;
  callsLastHour: number;
  lastSuccessTs: number | null;
  lastFailureTs: number | null;
  lastErrorCode: string | null;
  lastHttpStatus: number | null;
}

interface StoriesProviderEvent {
  ts: number;
  provider: 'session' | 'relay' | 'paid' | 'mock';
  action: 'getStory' | 'listStories';
  ok: boolean;
  errorCode: string | null;
  httpStatus: number | null;
}

interface StoriesStatusSnapshot {
  enabled: boolean;
  activeProvider: 'session' | 'relay' | 'paid' | 'mock' | null;
  providerOrder: Array<'session' | 'relay' | 'paid'>;
  perIpHourlyLimit: number;
  globalHourlyCap: number;
  callsLastHour: number;
  listCallsLastHour: number;
  providers: StoriesProviderStatusItem[];
  recentSuccesses: StoriesProviderEvent[];
  recentFailures: StoriesProviderEvent[];
}

import {
  DEFAULT_ENGINE_TEST_URLS,
  DEFAULT_X_TEST_URL,
  getEngineStatusLabel,
} from './healthConfig.ts';

export { DEFAULT_ENGINE_TEST_URLS, DEFAULT_X_TEST_URL, getEngineStatusLabel };

export interface HealthProps {
  readOnly?: boolean;
}

export const Health: React.FC<HealthProps> = ({ readOnly = false }) => {
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
  const [storiesStatus, setStoriesStatus] =
    useState<StoriesStatusSnapshot | null>(null);

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
        if (data.storiesStatus) {
          setStoriesStatus(data.storiesStatus);
        }
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
        <h2 className="font-display text-xl font-bold text-admin-text">
          Santé des moteurs d’extraction
        </h2>
        <p className="text-xs text-admin-text-muted">
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
              className="bg-admin-surface border border-admin-border rounded-lg p-5 flex flex-col gap-4 shadow-2xs"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-3 h-3 rounded-full shrink-0 ${
                        isHealthy
                          ? 'bg-emerald-600 dark:bg-emerald-500'
                          : 'bg-red-600 dark:bg-red-500'
                      }`}
                    />
                    <div className="min-w-0">
                      <h3 className="font-display text-base font-bold text-admin-text truncate">
                        Moteur {platformLabel}
                      </h3>
                      <span className="text-xs text-admin-text-muted block truncate">
                        Plateforme: <span className="font-mono">{platform}</span> · {engineDesc}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-md border shrink-0 ${
                      isHealthy
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-300'
                        : 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-700/60 text-red-900 dark:text-red-300'
                    }`}
                  >
                    {statusLabel}
                    {!isHealthy && info?.last_error_code ? ` (${info.last_error_code})` : ''}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs p-3.5 rounded-lg border border-admin-border">
                  <div>
                    <span className="text-admin-text-secondary block text-xs font-medium">Dernière réussite</span>
                    <span className="text-admin-text font-mono font-medium">
                      {formatTs(info?.last_success_ts)}
                    </span>
                  </div>
                  <div>
                    <span className="text-admin-text-secondary block text-xs font-medium">Dernier test manuel</span>
                    <span className="text-admin-text font-mono font-medium">
                      {formatTs(info?.last_test_ts)}
                    </span>
                  </div>
                </div>
              </div>

              {!readOnly && (
                <div className="space-y-2.5">
                  <label className="block text-xs font-medium text-admin-text-secondary">
                    URL de test {platformLabel} (saisie admin)
                  </label>
                  <div className="flex flex-col gap-2">
                    <input
                      type="url"
                      aria-label={`URL de test ${platformLabel}`}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder={`Collez une URL ${platformLabel} publique à tester…`}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-admin-muted border border-admin-border-strong text-xs text-admin-text placeholder-admin-text-muted/70 font-mono focus:outline-none focus:border-orange-600"
                    />
                    <button
                      type="button"
                      aria-label={`Tester maintenant ${platformLabel}`}
                      onClick={() => handleTestEngine(platform)}
                      disabled={testingPlatform === platform}
                      className="w-full px-4 py-2.5 rounded-md bg-admin-accent hover:opacity-90 disabled:opacity-50 text-white font-display font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>
                        {testingPlatform === platform ? 'Test en cours…' : 'Tester maintenant'}
                      </span>
                    </button>
                  </div>

                  {feedback && (
                    <div
                      className={`p-3 rounded-lg text-xs font-mono flex items-start gap-2 border ${
                        feedback.ok
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
                          : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800/60 text-red-900 dark:text-red-200'
                      }`}
                    >
                      {feedback.ok ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0 mt-0.5" />
                      )}
                      <span>{feedback.message}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Statut du cookie Instagram */}
      <div className="bg-admin-surface border border-admin-border rounded-lg p-5 space-y-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-admin-accent-bg border border-admin-accent-border flex items-center justify-center text-admin-accent">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-admin-text">
                Statut du secret Cookie Instagram (<code className="font-mono">IG_SESSION_ID</code> / <code className="font-mono">IG_COOKIES</code>)
              </h3>
              <p className="text-xs text-admin-text-muted">
                La valeur du secret n’est jamais exposée ni renvoyée par l’API
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-md border ${
                igCookieConfigured
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-300'
                  : 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-300'
              }`}
            >
              {igCookieConfigured ? 'DÉFINI' : 'NON DÉFINI'}
            </span>

            {!readOnly && (
              <button
                type="button"
                onClick={handleTestIgCookie}
                disabled={cookieTesting}
                className="px-3.5 py-2 rounded-md bg-admin-muted hover:bg-admin-hover border border-admin-border-strong text-xs font-medium text-admin-text flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Activity className="w-3.5 h-3.5 text-admin-text-muted" />
                <span>{cookieTesting ? 'Vérification…' : 'Tester la session IG'}</span>
              </button>
            )}
          </div>
        </div>

        {cookieProbeResult && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
              cookieProbeResult.valid
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{cookieProbeResult.message}</span>
          </div>
        )}

        <div className="p-3.5 rounded-lg border border-admin-border text-xs text-admin-text-secondary flex items-start gap-2.5">
          <Info className="w-4 h-4 text-admin-text-muted shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Note de sécurité Cloudflare :</strong> Une Pages Function / Worker ne peut pas
            modifier ses propres secrets d’environnement au runtime. Pour ajouter ou renouveler{' '}
            <code className="font-mono font-semibold text-admin-accent">IG_SESSION_ID</code> ou{' '}
            <code className="font-mono font-semibold text-admin-accent">IG_COOKIES</code>, modifiez-le dans le{' '}
            <strong>Dashboard Cloudflare</strong> (Pages / Workers &gt; Settings &gt; Variables and
            Secrets) ou via <code className="font-mono font-semibold text-admin-accent">wrangler pages secret put IG_SESSION_ID</code>.
          </p>
        </div>
      </div>

      {/* Statut des fournisseurs Stories Instagram */}
      {storiesStatus && (
        <div
          data-testid="stories-health-panel"
          className="bg-admin-surface border border-admin-border rounded-lg p-5 space-y-4 shadow-2xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-bold text-admin-text">
                État des fournisseurs Stories Instagram
              </h3>
              <p className="text-xs text-admin-text-muted">
                Fournisseur actif, configuration (sans aucun secret exposé), appels sur la dernière heure et derniers succès / échecs
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${
                  storiesStatus.enabled
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-300'
                    : 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-300'
                }`}
              >
                {storiesStatus.enabled ? 'Fonction active' : 'Désactivée'}
              </span>
              <span className="text-xs font-mono px-2.5 py-1 rounded-md border border-admin-border bg-admin-muted text-admin-text">
                Fournisseur actif :{' '}
                <strong>{storiesStatus.activeProvider || 'aucun'}</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-admin-border">
              <span className="text-admin-text-secondary block font-medium">
                Appels fournisseurs (heure en cours)
              </span>
              <span className="font-mono text-lg font-bold text-admin-text tabular-nums">
                {storiesStatus.callsLastHour}
              </span>
              <span className="text-admin-text-muted block">
                Listages /api/stories : {storiesStatus.listCallsLastHour} /{' '}
                {storiesStatus.globalHourlyCap} max
              </span>
            </div>

            <div className="p-3 rounded-lg border border-admin-border">
              <span className="text-admin-text-secondary block font-medium">
                Ordre de priorité configuré
              </span>
              <span className="font-mono text-sm font-bold text-admin-text block mt-1">
                {storiesStatus.providerOrder.join(' → ')}
              </span>
              <span className="text-admin-text-muted block">
                Limite par IP : {storiesStatus.perIpHourlyLimit} / h
              </span>
            </div>

            <div className="p-3 rounded-lg border border-admin-border">
              <span className="text-admin-text-secondary block font-medium">
                Succès / Échecs récents (mémoire + D1)
              </span>
              <div className="mt-1 flex items-baseline gap-2 font-mono">
                <span className="text-lg font-bold text-emerald-800 dark:text-emerald-400">
                  {storiesStatus.recentSuccesses.length} OK
                </span>
                <span className="text-admin-text-muted">/</span>
                <span className="text-lg font-bold text-red-800 dark:text-red-400">
                  {storiesStatus.recentFailures.length} err
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {storiesStatus.providers.map((prov) => (
              <div
                key={prov.name}
                className="p-3.5 rounded-lg border border-admin-border space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-admin-text">
                    {prov.name}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md border font-semibold ${
                      prov.configured
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-300'
                        : 'bg-admin-muted border-admin-border text-admin-text-muted'
                    }`}
                  >
                    {prov.configured ? 'Configuré' : 'Non configuré'}
                  </span>
                </div>
                <div className="space-y-1 text-admin-text-secondary">
                  <div className="flex justify-between">
                    <span>Appels (1 h) :</span>
                    <span className="font-mono text-admin-text">
                      {prov.callsLastHour}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Dernier succès :</span>
                    <span className="font-mono text-admin-text truncate">
                      {formatTs(prov.lastSuccessTs)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Dernier échec :</span>
                    <span className="font-mono text-admin-text truncate">
                      {formatTs(prov.lastFailureTs)}
                    </span>
                  </div>
                  {prov.lastErrorCode && (
                    <div className="text-red-800 dark:text-red-300 font-mono truncate">
                      {prov.lastErrorCode}
                      {prov.lastHttpStatus ? ` (HTTP ${prov.lastHttpStatus})` : ''}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {(storiesStatus.recentSuccesses.length > 0 ||
            storiesStatus.recentFailures.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-admin-border space-y-1.5">
                <span className="font-semibold text-admin-text-secondary block">
                  Derniers succès
                </span>
                {storiesStatus.recentSuccesses.length === 0 ? (
                  <p className="text-admin-text-muted">Aucun succès récent.</p>
                ) : (
                  <ul className="space-y-1 font-mono">
                    {storiesStatus.recentSuccesses.slice(0, 5).map((ev, i) => (
                      <li
                        key={`ok-${ev.ts}-${i}`}
                        className="flex items-center justify-between gap-2 text-emerald-900 dark:text-emerald-300"
                      >
                        <span>
                          {ev.provider} · {ev.action}
                        </span>
                        <span className="text-admin-text-muted">
                          {formatTs(ev.ts)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="p-3 rounded-lg border border-admin-border space-y-1.5">
                <span className="font-semibold text-admin-text-secondary block">
                  Derniers échecs
                </span>
                {storiesStatus.recentFailures.length === 0 ? (
                  <p className="text-admin-text-muted">Aucun échec récent.</p>
                ) : (
                  <ul className="space-y-1 font-mono">
                    {storiesStatus.recentFailures.slice(0, 5).map((ev, i) => (
                      <li
                        key={`err-${ev.ts}-${i}`}
                        className="flex items-center justify-between gap-2 text-red-900 dark:text-red-300"
                      >
                        <span className="truncate">
                          {ev.provider} · {ev.errorCode || 'ERR'}
                          {ev.httpStatus ? ` (${ev.httpStatus})` : ''}
                        </span>
                        <span className="text-admin-text-muted shrink-0">
                          {formatTs(ev.ts)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
