// VIDNEX v0.2.0 - International SEO & Universal Media Downloader
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Header } from './components/Header.tsx';
import { HeroOmnibox } from './components/HeroOmnibox.tsx';
import { ResultDrawer } from './components/ResultDrawer.tsx';
import { BelowFoldSeoSections } from './components/BelowFoldSeoSections.tsx';
import { SeoSchemaInjector } from './components/SeoSchemaInjector.tsx';
import { LanguageSuggestionBanner } from './components/LanguageSuggestionBanner.tsx';
import { LegalPageView } from './components/LegalPageView.tsx';
import { NotFoundView } from './components/NotFoundView.tsx';
import { AdSlot } from './components/AdSlot.tsx';
import { Footer } from './components/Footer.tsx';
import {
  DetectedUrlInfo,
  PlatformId,
} from './utils/urlDetector.ts';
import {
  extractMediaFromUrl,
  MediaResult,
} from './services/extractorService.ts';
import {
  fetchPublicConfig,
  getPublicConfigSnapshot,
  PublicConfig,
  subscribePublicConfig,
} from './services/adsenseService.ts';
import {
  DEFAULT_LOCALE,
  getLocalizedPagePath,
  isLegalPageKey,
  isPlatformPageKey,
  LOCALES_CONFIG,
  type PageKey,
  type PlatformPageKey,
  type SupportedLocale,
} from './i18n/config.ts';
import {
  getLocaleBundleSync,
  hasLocaleBundleSync,
  loadLocaleBundle,
} from './i18n/localeLoader.ts';
import {
  handleLegacyQueryRedirect,
  isSupportedLanguage,
  parsePathname,
} from './utils/i18nRouting.ts';

const LazyAdminApp = React.lazy(() => import('./pages/admin/AdminApp.tsx'));

interface AppProps {
  initialPath?: string;
}

function resolveInitialRouteState(initialPath?: string): {
  lang: SupportedLocale;
  pageKey: PageKey | 'admin' | 'not_found';
} {
  if (initialPath) {
    const parsed = parsePathname(initialPath);
    return {
      lang: parsed.lang,
      pageKey: parsed.isAdmin ? 'admin' : parsed.pageKey,
    };
  }
  if (typeof window === 'undefined') {
    return { lang: DEFAULT_LOCALE, pageKey: 'home' };
  }
  const parsed = parsePathname(window.location.pathname);
  const params = new URLSearchParams(window.location.search);
  if (parsed.isAdmin || params.get('admin') === '1') {
    return { lang: DEFAULT_LOCALE, pageKey: 'admin' };
  }
  const urlLang = params.get('lang');
  if (urlLang && isSupportedLanguage(urlLang)) {
    return { lang: urlLang, pageKey: parsed.pageKey };
  }
  return { lang: parsed.lang, pageKey: parsed.pageKey };
}

export function App({ initialPath }: AppProps = {}) {
  const initialRoute = resolveInitialRouteState(initialPath);

  const [language, setLanguage] = useState<SupportedLocale>(initialRoute.lang);
  const [pageKey, setPageKey] = useState<PageKey | 'admin' | 'not_found'>(
    initialRoute.pageKey
  );
  const [, setLocaleRevision] = useState(0);

  const [publicConfig, setPublicConfig] = useState<PublicConfig>(
    getPublicConfigSnapshot
  );

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vidnex_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light';
  });

  // Extraction State Machine
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [mediaResult, setMediaResult] = useState<MediaResult | null>(null);
  const [lastRequest, setLastRequest] = useState<{
    url: string;
    detected: DetectedUrlInfo;
  } | null>(null);

  const isAdmin = pageKey === 'admin';
  const activePlatform: PlatformId = isPlatformPageKey(
    pageKey as PageKey
  )
    ? (pageKey as PlatformPageKey)
    : 'tiktok';

  // Ensure the active language chunk is loaded dynamically on the client only if not already cached
  useEffect(() => {
    if (hasLocaleBundleSync(language)) {
      return;
    }
    let cancelled = false;
    loadLocaleBundle(language)
      .then(() => {
        if (!cancelled) {
          setLocaleRevision((r) => r + 1);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [language]);

  useEffect(() => {
    if (isAdmin) return;
    fetchPublicConfig();
    return subscribePublicConfig((cfg) => {
      setPublicConfig({ ...cfg });
    });
  }, [isAdmin]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('vidnex_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    const langMeta = LOCALES_CONFIG[language] || LOCALES_CONFIG.fr;
    root.lang = langMeta.code;
    root.dir = langMeta.dir;
  }, [language]);

  useEffect(() => {
    const res = handleLegacyQueryRedirect();
    if (res.redirected) {
      const parsed = parsePathname(window.location.pathname);
      setLanguage(parsed.lang);
      setPageKey(parsed.isAdmin ? 'admin' : parsed.pageKey);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const parsed = parsePathname(window.location.pathname);
      setLanguage(parsed.lang);
      setPageKey(parsed.isAdmin ? 'admin' : parsed.pageKey);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigatePage = useCallback(
    (nextPage: PageKey) => {
      // If navigating to a legal page in a locale that points to /en/..., switch to 'en'
      let targetLocale = language;
      if (
        isLegalPageKey(nextPage) &&
        language !== 'fr' &&
        language !== 'en' &&
        language !== 'ar'
      ) {
        targetLocale = 'en';
        setLanguage('en');
      }
      setPageKey(nextPage);
      if (typeof window !== 'undefined') {
        const nextUrl = getLocalizedPagePath(targetLocale, nextPage);
        if (window.location.pathname !== nextUrl) {
          window.history.pushState(
            { pageKey: nextPage, language: targetLocale },
            '',
            nextUrl
          );
        }
      }
    },
    [language]
  );

  const handleSelectLanguage = useCallback(
    (nextLang: SupportedLocale) => {
      try {
        localStorage.setItem('vidnex_lang', nextLang);
      } catch {
        // ignore
      }
      const currentValidPage: PageKey =
        pageKey === 'admin' || pageKey === 'not_found' ? 'home' : pageKey;

      let effectivePage: PageKey = currentValidPage;
      let effectiveLang: SupportedLocale = nextLang;

      // If on a legal page and switching to a language without native legal page, point to /en/{legal}
      if (
        isLegalPageKey(currentValidPage) &&
        nextLang !== 'fr' &&
        nextLang !== 'en' &&
        nextLang !== 'ar'
      ) {
        effectivePage = 'home';
      }

      setLanguage(effectiveLang);
      setPageKey(effectivePage);

      if (typeof window !== 'undefined') {
        const nextUrl = getLocalizedPagePath(effectiveLang, effectivePage);
        if (window.location.pathname !== nextUrl) {
          window.history.pushState(
            { pageKey: effectivePage, language: effectiveLang },
            '',
            nextUrl
          );
        }
      }
    },
    [pageKey]
  );

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleSubmitUrl = useCallback(
    async (url: string, detected: DetectedUrlInfo) => {
      setLastRequest({ url, detected });
      setIsExtracting(true);
      setExtractionError(null);

      try {
        const result = await extractMediaFromUrl(url, detected, language);
        setMediaResult(result);
      } catch (err) {
        setMediaResult(null);
        setExtractionError(
          err instanceof Error
            ? err.message
            : getLocaleBundleSync(language).ui.errors.BLOCKED_BY_PLATFORM
        );
      } finally {
        setIsExtracting(false);
      }
    },
    [language]
  );

  const handleCloseDrawer = useCallback(() => {
    setIsExtracting(false);
    setExtractionError(null);
    setMediaResult(null);
  }, []);

  const handleRetryExtraction = () => {
    if (lastRequest) {
      handleSubmitUrl(lastRequest.url, lastRequest.detected);
    }
  };

  if (isAdmin) {
    return (
      <>
        <SeoSchemaInjector pageKey="admin" language="fr" />
        <Suspense
          fallback={
            <div className="min-h-[100dvh] flex items-center justify-center bg-[#140e0a] text-orange-200 font-mono text-xs">
              Chargement du panneau d’administration…
            </div>
          }
        >
          <LazyAdminApp />
        </Suspense>
      </>
    );
  }

  const bundle = getLocaleBundleSync(language);
  const currentLangMeta = LOCALES_CONFIG[language] || LOCALES_CONFIG.fr;
  const activeToolPageKey: 'home' | PlatformPageKey = isPlatformPageKey(
    pageKey as PageKey
  )
    ? (pageKey as PlatformPageKey)
    : 'home';

  return (
    <div
      dir={currentLangMeta.dir}
      className="relative min-h-[100dvh] flex flex-col bg-[#fffaf5] dark:bg-[#140e0a] text-[#1f130b] dark:text-[#fffaf5] transition-colors duration-150 overflow-x-hidden safe-area-root"
    >
      {/* Ambient Orange Depth Glows */}
      <div className="ambient-orange-glow absolute -top-24 left-1/2 -translate-x-1/2 w-[1040px] h-[520px] bg-gradient-to-b from-orange-500/20 via-amber-400/15 to-transparent rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute top-32 left-10 w-72 h-72 bg-orange-400/10 rounded-full blur-2xl pointer-events-none z-0" />
      <div className="absolute top-32 right-10 w-72 h-72 bg-amber-500/10 rounded-full blur-2xl pointer-events-none z-0" />

      <SeoSchemaInjector pageKey={pageKey} language={language} />

      {publicConfig.maintenance && (
        <div
          role="status"
          className="relative z-50 bg-amber-500 text-[#140e0a] px-4 py-2.5 text-center font-mono text-xs font-bold shadow-sm"
        >
          {bundle.ui.errors.MAINTENANCE}
        </div>
      )}

      {/* Client-only Language Suggestion Banner (never rendered during static pre-rendering) */}
      <LanguageSuggestionBanner
        currentLocale={language}
        pageKey={pageKey === 'not_found' ? 'home' : pageKey}
        onSelectLocale={handleSelectLanguage}
      />

      <Header
        activePageKey={pageKey}
        activePlatform={activePlatform}
        onNavigatePage={handleNavigatePage}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        language={language}
        onSelectLanguage={handleSelectLanguage}
      />

      <main className="flex-1 relative z-10">
        {pageKey === 'not_found' ? (
          <NotFoundView
            locale={language}
            onNavigatePage={(target) => handleNavigatePage(target)}
          />
        ) : isLegalPageKey(pageKey) ? (
          <LegalPageView
            legalKey={pageKey}
            locale={language}
            onNavigatePage={(target) => handleNavigatePage(target)}
          />
        ) : (
          <>
            <HeroOmnibox
              pageKey={activeToolPageKey}
              activePlatform={activePlatform}
              onNavigatePage={(target) => handleNavigatePage(target)}
              onSubmitUrl={handleSubmitUrl}
              onEscapeClear={handleCloseDrawer}
              isExtracting={isExtracting}
              language={language}
            />

            <ResultDrawer
              isLoading={isExtracting}
              error={extractionError}
              result={mediaResult}
              onClose={handleCloseDrawer}
              onRetry={handleRetryExtraction}
              language={language}
            />

            <AdSlot
              slotId="vidnex-post-result-leaderboard"
              format="leaderboard"
              language={language}
            />

            <BelowFoldSeoSections
              pageKey={activeToolPageKey}
              onNavigatePage={(target) => handleNavigatePage(target)}
              language={language}
            />
          </>
        )}
      </main>

      <Footer
        activePageKey={pageKey}
        onNavigatePage={handleNavigatePage}
        language={language}
        onSelectLanguage={handleSelectLanguage}
      />
    </div>
  );
}

export default App;