// VIDNEX v0.2.0 - International SEO & Universal Media Downloader
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Header } from './components/Header.tsx';
import { HeroOmnibox } from './components/HeroOmnibox.tsx';
import { ResultDrawer } from './components/ResultDrawer.tsx';
import { BelowFoldSeoSections } from './components/BelowFoldSeoSections.tsx';
import { SeoSchemaInjector } from './components/SeoSchemaInjector.tsx';
import { LanguageSuggestionBanner } from './components/LanguageSuggestionBanner.tsx';
import { LegalPageView } from './components/LegalPageView.tsx';
import { BlogIndexView } from './components/BlogIndexView.tsx';
import { BlogArticleView } from './components/BlogArticleView.tsx';
import { SplitImageToolView } from './components/SplitImageToolView.tsx';
import { VideoToMp3ToolView } from './components/VideoToMp3ToolView.tsx';
import { ToolsHubView } from './components/ToolsHubView.tsx';
import { NotFoundView } from './components/NotFoundView.tsx';
import { AdSlot } from './components/AdSlot.tsx';
import { Footer } from './components/Footer.tsx';
import { CookieConsentBanner } from './components/CookieConsentBanner.tsx';
import {
  DetectedUrlInfo,
  PlatformId,
} from './utils/urlDetector.ts';
import {
  ExtractionError,
  extractMediaFromUrl,
  MediaResult,
} from './services/extractorService.ts';
import {
  ensureAdsterraSocialBarLoaded,
  fetchPublicConfig,
  getPublicConfigSnapshot,
  PublicConfig,
  subscribePublicConfig,
} from './services/adsenseService.ts';
import {
  getCookieConsentSnapshot,
  subscribeCookieConsent,
  type CookieConsentState,
} from './utils/cookieConsent.ts';
import {
  DEFAULT_LOCALE,
  getLocalizedPagePath,
  isLegalPageKey,
  isPlatformPageKey,
  isToolPageKey,
  LOCALES_CONFIG,
  type PageKey,
  type PlatformPageKey,
  type SupportedLocale,
} from './i18n/config.ts';
import {
  getPublishedArticleBySlug,
  getPublishedArticleTranslations,
  isBlogHubLocale,
  type BlogLocale,
} from './data/blogArticles.ts';
import {
  getLocaleBundleSync,
  hasLocaleBundleForPageSync,
  loadLegalBundle,
  loadLocaleBundle,
  loadToolContent,
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
  pageKey: PageKey | 'blog_article' | 'admin' | 'not_found';
  blogSlug: string | null;
} {
  if (initialPath) {
    const parsed = parsePathname(initialPath);
    return {
      lang: parsed.lang,
      pageKey: parsed.isAdmin ? 'admin' : parsed.pageKey,
      blogSlug: parsed.blogSlug || null,
    };
  }
  if (typeof window === 'undefined') {
    return { lang: DEFAULT_LOCALE, pageKey: 'home', blogSlug: null };
  }
  const parsed = parsePathname(window.location.pathname);
  const params = new URLSearchParams(window.location.search);
  if (parsed.isAdmin || params.get('admin') === '1') {
    return { lang: DEFAULT_LOCALE, pageKey: 'admin', blogSlug: null };
  }
  const urlLang = params.get('lang');
  if (urlLang && isSupportedLanguage(urlLang)) {
    return {
      lang: urlLang,
      pageKey: parsed.pageKey,
      blogSlug: parsed.blogSlug || null,
    };
  }
  return {
    lang: parsed.lang,
    pageKey: parsed.pageKey,
    blogSlug: parsed.blogSlug || null,
  };
}

export function App({ initialPath }: AppProps = {}) {
  const initialRoute = resolveInitialRouteState(initialPath);

  const [language, setLanguage] = useState<SupportedLocale>(initialRoute.lang);
  const [pageKey, setPageKey] = useState<
    PageKey | 'blog_article' | 'admin' | 'not_found'
  >(initialRoute.pageKey);
  const [blogSlug, setBlogSlug] = useState<string | null>(
    initialRoute.blogSlug
  );
  const [, setLocaleRevision] = useState(0);

  const [publicConfig, setPublicConfig] = useState<PublicConfig>(
    getPublicConfigSnapshot
  );
  const [cookieConsent, setCookieConsent] = useState<CookieConsentState | null>(
    () => (typeof window !== 'undefined' ? getCookieConsentSnapshot() : null)
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
  const [extractionErrorCode, setExtractionErrorCode] = useState<string | null>(
    null
  );
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

  // Ensure the active language chunk (and legal/tool chunk strictly for the current page) is loaded dynamically when missing
  useEffect(() => {
    if (hasLocaleBundleForPageSync(language, pageKey)) {
      return;
    }
    let cancelled = false;
    const tasks: Promise<unknown>[] = [loadLocaleBundle(language)];
    if (isLegalPageKey(pageKey)) {
      tasks.push(loadLegalBundle(language));
    }
    if (isToolPageKey(pageKey)) {
      tasks.push(loadToolContent(language, pageKey));
    }
    Promise.all(tasks)
      .then(() => {
        if (!cancelled) {
          setLocaleRevision((r) => r + 1);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [language, pageKey]);

  useEffect(() => {
    if (isAdmin) return;
    fetchPublicConfig();
    return subscribePublicConfig((cfg) => {
      setPublicConfig({ ...cfg });
    });
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin || typeof window === 'undefined') return;
    setCookieConsent(getCookieConsentSnapshot());
    return subscribeCookieConsent((next) => {
      setCookieConsent(next);
    });
  }, [isAdmin]);

  // Lightweight cookie-free visit beacon (only when user consented to statistics; never fires on /admin or SSR/prerender)
  useEffect(() => {
    if (
      isAdmin ||
      initialPath ||
      typeof window === 'undefined' ||
      !cookieConsent?.analytics
    ) {
      return;
    }
    const pathname = window.location.pathname || '/';
    if (pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/')) {
      return;
    }
    const win = window as Window & { __vidnexVisitSent?: boolean };
    if (win.__vidnexVisitSent) return;
    win.__vidnexVisitSent = true;

    const payload = JSON.stringify({
      path: pathname,
      referrer: typeof document !== 'undefined' ? document.referrer || '' : '',
    });

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([payload], { type: 'application/json' });
        if (navigator.sendBeacon('/api/visit', blob)) {
          return;
        }
      }
      fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
        credentials: 'omit',
      }).catch(() => {});
    } catch {
      // Never block or degrade UX
    }
  }, [isAdmin, initialPath, cookieConsent?.analytics]);

  useEffect(() => {
    if (
      isAdmin ||
      !publicConfig.ads_adsterra_enabled ||
      !cookieConsent?.advertising
    ) {
      return;
    }
    return ensureAdsterraSocialBarLoaded();
  }, [isAdmin, publicConfig.ads_adsterra_enabled, cookieConsent?.advertising]);

  useEffect(() => {
    if (isAdmin) return;
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
  }, [theme, isAdmin]);

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
      setBlogSlug(parsed.blogSlug || null);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const parsed = parsePathname(window.location.pathname);
      setLanguage(parsed.lang);
      setPageKey(parsed.isAdmin ? 'admin' : parsed.pageKey);
      setBlogSlug(parsed.blogSlug || null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigatePath = useCallback((path: string) => {
    const parsed = parsePathname(path);
    setLanguage(parsed.lang);
    setPageKey(parsed.isAdmin ? 'admin' : parsed.pageKey);
    setBlogSlug(parsed.blogSlug || null);
    if (typeof window !== 'undefined' && window.location.pathname !== path) {
      window.history.pushState(
        {
          pageKey: parsed.pageKey,
          language: parsed.lang,
          blogSlug: parsed.blogSlug || null,
        },
        '',
        path
      );
    }
  }, []);

  const handleNavigatePage = useCallback(
    (nextPage: PageKey) => {
      let targetLocale = language;
      if (nextPage === 'blog' && !isBlogHubLocale(language)) {
        targetLocale = 'en';
        setLanguage('en');
      }
      setPageKey(nextPage);
      setBlogSlug(null);
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

      // If currently reading a blog article, check if that article has a published translation in nextLang
      if (pageKey === 'blog_article' && blogSlug) {
        const currentBlogLoc: BlogLocale = isBlogHubLocale(language)
          ? language
          : 'en';
        const resolvedCurrent = getPublishedArticleBySlug(
          currentBlogLoc,
          blogSlug
        );
        if (resolvedCurrent) {
          const translations = getPublishedArticleTranslations(
            resolvedCurrent.article.id
          );
          const match = translations.find((t) => t.locale === nextLang);
          if (match) {
            handleNavigatePath(match.canonicalPath);
            return;
          }
        }
        // Otherwise if nextLang has a blog hub, go to its blog hub; otherwise go to nextLang home
        if (isBlogHubLocale(nextLang)) {
          handleNavigatePath(getLocalizedPagePath(nextLang, 'blog'));
          return;
        }
      }

      if (pageKey === 'blog') {
        if (isBlogHubLocale(nextLang)) {
          handleNavigatePath(getLocalizedPagePath(nextLang, 'blog'));
          return;
        }
        handleNavigatePath(getLocalizedPagePath(nextLang, 'home'));
        return;
      }

      const currentValidPage: PageKey =
        pageKey === 'admin' ||
        pageKey === 'not_found' ||
        pageKey === 'blog_article'
          ? 'home'
          : pageKey;

      const effectivePage: PageKey = currentValidPage;
      const effectiveLang: SupportedLocale = nextLang;

      setLanguage(effectiveLang);
      setPageKey(effectivePage);
      setBlogSlug(null);

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
    [pageKey, blogSlug, language, handleNavigatePath]
  );

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleSubmitUrl = useCallback(
    async (url: string, detected: DetectedUrlInfo) => {
      setLastRequest({ url, detected });
      setIsExtracting(true);
      setExtractionError(null);
      setExtractionErrorCode(null);

      try {
        const result = await extractMediaFromUrl(url, detected, language);
        setMediaResult(result);
      } catch (err) {
        setMediaResult(null);
        setExtractionErrorCode(
          err instanceof ExtractionError ? err.code : 'BLOCKED_BY_PLATFORM'
        );
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
    setExtractionErrorCode(null);
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
            <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 bg-admin-bg text-admin-text-muted text-xs">
              <div className="flex items-center gap-2">
                <picture className="inline-flex shrink-0">
                  <source srcSet="/logo.webp" type="image/webp" />
                  <img
                    src="/logo.png"
                    alt=""
                    width={32}
                    height={32}
                    decoding="async"
                    aria-hidden="true"
                    className="w-8 h-8 rounded-lg object-contain select-none"
                  />
                </picture>
                <span className="font-display font-bold text-base text-admin-text">
                  VIDNEX
                </span>
              </div>
              <span>Chargement du panneau d’administration…</span>
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

  const bannerPageKey: PageKey =
    pageKey === 'not_found'
      ? 'home'
      : pageKey === 'blog_article'
      ? 'blog'
      : pageKey;

  return (
    <div
      dir={currentLangMeta.dir}
      className="relative min-h-[100dvh] flex flex-col bg-[#fffaf5] dark:bg-[#140e0a] text-[#1f130b] dark:text-[#fffaf5] transition-colors duration-150 overflow-x-hidden safe-area-root"
    >
      {/* Ambient Orange Depth Glows */}
      <div className="ambient-orange-glow absolute -top-24 left-1/2 -translate-x-1/2 w-[1040px] h-[520px] bg-gradient-to-b from-orange-500/20 via-amber-400/15 to-transparent rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute top-32 left-10 w-72 h-72 bg-orange-400/10 rounded-full blur-2xl pointer-events-none z-0" />
      <div className="absolute top-32 right-10 w-72 h-72 bg-amber-500/10 rounded-full blur-2xl pointer-events-none z-0" />

      <SeoSchemaInjector
        pageKey={pageKey}
        language={language}
        blogSlug={blogSlug}
      />

      {publicConfig.maintenance && (
        <div
          role="status"
          className="relative z-50 bg-amber-500 text-[#140e0a] px-4 py-2.5 text-center font-mono text-xs font-bold shadow-sm"
        >
          {bundle.ui.errors.MAINTENANCE}
        </div>
      )}

      {/* Client-only Language Suggestion Banner (shown after cookie consent to avoid bottom-bar overlap) */}
      {cookieConsent !== null && (
        <LanguageSuggestionBanner
          currentLocale={language}
          pageKey={bannerPageKey}
          activePageKey={pageKey}
          blogSlug={blogSlug}
          onSelectLocale={handleSelectLanguage}
        />
      )}

      <Header
        activePageKey={pageKey}
        activePlatform={activePlatform}
        blogSlug={blogSlug}
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
        ) : pageKey === 'tools_hub' ? (
          <ToolsHubView
            locale={language}
            onNavigatePage={(target) => handleNavigatePage(target)}
          />
        ) : pageKey === 'split_image' ? (
          <SplitImageToolView
            locale={language}
            onNavigatePage={(target) => handleNavigatePage(target)}
            onNavigatePath={handleNavigatePath}
          />
        ) : pageKey === 'video_to_mp3' ? (
          <VideoToMp3ToolView
            locale={language}
            onNavigatePage={(target) => handleNavigatePage(target)}
            onNavigatePath={handleNavigatePath}
          />
        ) : pageKey === 'blog' ? (
          <BlogIndexView
            locale={language}
            onNavigatePath={handleNavigatePath}
            onNavigatePage={handleNavigatePage}
          />
        ) : pageKey === 'blog_article' && blogSlug ? (
          <BlogArticleView
            locale={language}
            blogSlug={blogSlug}
            onNavigatePath={handleNavigatePath}
            onNavigatePage={handleNavigatePage}
          />
        ) : isLegalPageKey(pageKey) ? (
          <LegalPageView
            legalKey={pageKey}
            locale={language}
            onNavigatePage={(target) => handleNavigatePage(target)}
            onNavigatePath={handleNavigatePath}
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

            <AdSlot
              slotId="vidnex-home-hero-leaderboard"
              format="leaderboard"
              language={language}
              hideOnMobile={Boolean(
                isExtracting || extractionError || mediaResult
              )}
            />

            <ResultDrawer
              isLoading={isExtracting}
              error={extractionError}
              errorCode={extractionErrorCode}
              result={mediaResult}
              onClose={handleCloseDrawer}
              onRetry={handleRetryExtraction}
              onOpenVideoToMp3={() => handleNavigatePage('video_to_mp3')}
              language={language}
              platform={lastRequest?.detected?.platform || activePlatform}
            />

            <BelowFoldSeoSections
              pageKey={activeToolPageKey}
              onNavigatePage={(target) => handleNavigatePage(target)}
              onNavigatePath={handleNavigatePath}
              language={language}
            />
          </>
        )}
      </main>

      <Footer
        activePageKey={pageKey}
        blogSlug={blogSlug}
        onNavigatePage={handleNavigatePage}
        language={language}
        onSelectLanguage={handleSelectLanguage}
      />

      {!isAdmin && !initialPath && (
        <CookieConsentBanner
          language={language}
          onNavigatePage={handleNavigatePage}
        />
      )}
    </div>
  );
}

export default App;