// VIDNEX v0.1.1 - Cloudflare Universal Media Downloader
import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { HeroOmnibox } from './components/HeroOmnibox';
import { ResultDrawer } from './components/ResultDrawer';
import { BelowFoldSeoSections } from './components/BelowFoldSeoSections';
import { SeoSchemaInjector } from './components/SeoSchemaInjector';
import { AdSlot } from './components/AdSlot';
import { Footer } from './components/Footer';
import { LegalDocType, LegalModal } from './components/LegalModal';
import {
  DetectedUrlInfo,
  isPlatformSupported,
  PlatformId,
} from './utils/urlDetector';
import {
  extractMediaFromUrl,
  MediaResult,
} from './services/extractorService';
import {
  ALL_TOOL_CONFIGS,
  DEFAULT_TOOL_BY_PLATFORM,
  SEO_TOOLS_CONFIG,
  ToolSlug,
} from './data/seoToolsConfig';
import {
  getLocalizedToolConfig,
  LanguageCode,
  SUPPORTED_LANGUAGES,
} from './i18n/translations';

function resolveInitialToolFromLocation(): ToolSlug {
  if (typeof window === 'undefined') return 'instagram-reels';
  const params = new URLSearchParams(window.location.search);
  const toolParam = params.get('tool');
  if (toolParam) {
    const found = ALL_TOOL_CONFIGS.find(
      (t) => t.slug === toolParam && isPlatformSupported(t.platform)
    );
    if (found) return found.slug;
  }
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (hash) {
    const matchedHash = ALL_TOOL_CONFIGS.find(
      (t) =>
        (t.slug === hash || t.path.replace(/^\//, '') === hash) &&
        isPlatformSupported(t.platform)
    );
    if (matchedHash) return matchedHash.slug;
  }
  const cleanPath = window.location.pathname.replace(/\/+$/, '');
  const matched = ALL_TOOL_CONFIGS.find(
    (t) => t.path === cleanPath && isPlatformSupported(t.platform)
  );
  return matched ? matched.slug : 'instagram-reels';
}

function resolveInitialLanguage(): LanguageCode {
  if (typeof window === 'undefined') return 'en';
  const params = new URLSearchParams(window.location.search);
  const urlLang = params.get('lang') as LanguageCode | null;
  if (urlLang && SUPPORTED_LANGUAGES.some((l) => l.code === urlLang)) {
    return urlLang;
  }
  const saved = localStorage.getItem('vidnex_lang') as LanguageCode | null;
  if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
    return saved;
  }
  return 'en';
}

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vidnex_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light';
  });

  const [language, setLanguage] = useState<LanguageCode>(resolveInitialLanguage);

  const [activeToolSlug, setActiveToolSlug] = useState<ToolSlug>(
    resolveInitialToolFromLocation
  );

  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocType | null>(
    null
  );

  // Extraction State Machine
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [mediaResult, setMediaResult] = useState<MediaResult | null>(null);
  const [lastRequest, setLastRequest] = useState<{
    url: string;
    detected: DetectedUrlInfo;
  } | null>(null);

  const baseTool = SEO_TOOLS_CONFIG[activeToolSlug];
  const activeTool = getLocalizedToolConfig(baseTool, language);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('vidnex_theme', theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    const langMeta =
      SUPPORTED_LANGUAGES.find((l) => l.code === language) ||
      SUPPORTED_LANGUAGES[0];

    root.lang = langMeta.code;
    root.dir = langMeta.dir;
    localStorage.setItem('vidnex_lang', langMeta.code);
  }, [language]);

  useEffect(() => {
    const handlePopState = () => {
      setActiveToolSlug(resolveInitialToolFromLocation());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSelectTool = useCallback(
    (slug: ToolSlug) => {
      setActiveToolSlug(slug);
      const targetConfig = SEO_TOOLS_CONFIG[slug];
      if (typeof window !== 'undefined') {
        const isStaticOrDev =
          window.location.protocol === 'file:' ||
          window.location.port === '5500' ||
          window.location.hostname === '127.0.0.1' ||
          window.location.hostname === 'localhost' ||
          window.location.pathname.endsWith('.html') ||
          window.location.search.includes('tool=');

        const nextUrl = isStaticOrDev
          ? `?tool=${slug}${language === 'en' ? '' : `&lang=${language}`}`
          : `${targetConfig.path}${language === 'en' ? '' : `?lang=${language}`}`;

        if (window.location.pathname + window.location.search !== nextUrl) {
          window.history.pushState({ slug, language }, '', nextUrl);
        }
      }
    },
    [language]
  );

  const handleSelectLanguage = useCallback(
    (nextLang: LanguageCode) => {
      setLanguage(nextLang);
      if (typeof window !== 'undefined') {
        const isStaticOrDev =
          window.location.protocol === 'file:' ||
          window.location.port === '5500' ||
          window.location.hostname === '127.0.0.1' ||
          window.location.hostname === 'localhost' ||
          window.location.pathname.endsWith('.html') ||
          window.location.search.includes('tool=');

        const targetPath = SEO_TOOLS_CONFIG[activeToolSlug].path;
        const nextUrl = isStaticOrDev
          ? `?tool=${activeToolSlug}${nextLang === 'en' ? '' : `&lang=${nextLang}`}`
          : `${targetPath}${nextLang === 'en' ? '' : `?lang=${nextLang}`}`;

        window.history.replaceState(
          { slug: activeToolSlug, language: nextLang },
          '',
          nextUrl
        );
      }
    },
    [activeToolSlug]
  );

  const handleSelectPlatform = useCallback(
    (platform: PlatformId) => {
      const defaultSlug = DEFAULT_TOOL_BY_PLATFORM[platform];
      handleSelectTool(defaultSlug);
    },
    [handleSelectTool]
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
            : 'An unexpected error occurred during stream extraction.'
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

  return (
    <div className="relative min-h-screen flex flex-col bg-[#fffaf5] dark:bg-[#140e0a] text-[#1f130b] dark:text-[#fffaf5] transition-colors duration-150 overflow-x-hidden">
      {/* Ambient Orange Depth Glows */}
      <div className="ambient-orange-glow absolute -top-24 left-1/2 -translate-x-1/2 w-[1040px] h-[520px] bg-gradient-to-b from-orange-500/20 via-amber-400/15 to-transparent rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute top-32 left-10 w-72 h-72 bg-orange-400/10 rounded-full blur-2xl pointer-events-none z-0" />
      <div className="absolute top-32 right-10 w-72 h-72 bg-amber-500/10 rounded-full blur-2xl pointer-events-none z-0" />

      <SeoSchemaInjector tool={activeTool} language={language} />

      <Header
        activePlatform={activeTool.platform}
        onSelectPlatform={handleSelectPlatform}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        language={language}
        onSelectLanguage={handleSelectLanguage}
      />

      <main className="flex-1 relative z-10">
        <HeroOmnibox
          activeTool={activeTool}
          onSelectTool={handleSelectTool}
          onSelectPlatform={handleSelectPlatform}
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
          activeTool={activeTool}
          onSelectTool={handleSelectTool}
          language={language}
        />
      </main>

      <Footer
        activeToolSlug={activeToolSlug}
        onSelectTool={handleSelectTool}
        onOpenLegal={(doc) => setActiveLegalDoc(doc)}
        language={language}
      />

      <LegalModal
        activeDoc={activeLegalDoc}
        onSelectDoc={setActiveLegalDoc}
        onClose={() => setActiveLegalDoc(null)}
        language={language}
      />
    </div>
  );
}

export default App;