import React, { useState, useRef, useEffect } from 'react';
import { PlatformId, isPlatformSupported } from '../utils/urlDetector.ts';
import { PlatformIcon, VidnexLogoMark } from './icons/PlatformIcons.tsx';
import {
  getBlogNavLabel,
  getLocalizedPagePath,
  LOCALES_CONFIG,
  type PageKey,
  PLATFORM_PAGE_KEYS,
  type PlatformPageKey,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '../i18n/config.ts';
import {
  BLOG_HUB_LOCALES,
  getBlogHomePath,
  getPublishedArticleBySlug,
  getPublishedArticleTranslations,
  isBlogHubLocale,
  type BlogLocale,
} from '../data/blogArticles.ts';
import { getLocaleBundleSync } from '../i18n/localeLoader.ts';
import { getSplitImageContent } from '../utils/splitImageLogic.ts';
import { getVideoToMp3Content } from '../utils/videoToMp3Logic.ts';
import { getToolsHubContent } from '../data/toolsRegistry.ts';

export interface ToolTab {
  id: PlatformPageKey;
  label: string;
}

export const PLATFORM_TABS: ToolTab[] = PLATFORM_PAGE_KEYS.map((id) => ({
  id,
  label:
    id === 'tiktok'
      ? 'TikTok'
      : id === 'instagram'
      ? 'Instagram'
      : id === 'x'
      ? 'X'
      : id === 'facebook'
      ? 'Facebook'
      : 'LinkedIn',
}));

interface HeaderProps {
  activePageKey: PageKey | 'blog_article' | 'not_found';
  activePlatform: PlatformId;
  blogSlug?: string | null;
  onNavigatePage: (pageKey: PageKey) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  language: SupportedLocale;
  onSelectLanguage: (lang: SupportedLocale) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activePageKey,
  activePlatform,
  blogSlug,
  onNavigatePage,
  theme,
  onToggleTheme,
  language,
  onSelectLanguage,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const toolsDropdownRef = useRef<HTMLDivElement>(null);

  const bundle = getLocaleBundleSync(language);
  const navStrings = bundle.ui.nav;
  const currentLangMeta = LOCALES_CONFIG[language] || LOCALES_CONFIG.fr;

  const pageForLangSwitch: PageKey =
    activePageKey === 'not_found'
      ? 'home'
      : activePageKey === 'blog_article'
      ? 'blog'
      : activePageKey;

  const availableLanguageOptions: Array<{
    code: SupportedLocale;
    href: string;
  }> = (() => {
    if (activePageKey === 'blog') {
      return BLOG_HUB_LOCALES.map((loc) => ({
        code: loc,
        href: getBlogHomePath(loc),
      }));
    }
    if (activePageKey === 'blog_article') {
      const blogLoc: BlogLocale = isBlogHubLocale(language) ? language : 'en';
      const resolved = blogSlug
        ? getPublishedArticleBySlug(blogLoc, blogSlug)
        : null;
      const translations = resolved
        ? getPublishedArticleTranslations(resolved.article.id)
        : [];
      if (translations.length > 0) {
        return translations.map((item) => ({
          code: item.locale,
          href: item.canonicalPath,
        }));
      }
      return BLOG_HUB_LOCALES.map((loc) => ({
        code: loc,
        href: getBlogHomePath(loc),
      }));
    }
    return SUPPORTED_LOCALES.map((code) => ({
      code,
      href: getLocalizedPagePath(code, pageForLangSwitch),
    }));
  })();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (headerRef.current && !headerRef.current.contains(target)) {
        setMobileMenuOpen(false);
      }
      if (
        langDropdownRef.current &&
        !langDropdownRef.current.contains(target)
      ) {
        setLangMenuOpen(false);
      }
      if (
        toolsDropdownRef.current &&
        !toolsDropdownRef.current.contains(target)
      ) {
        setToolsMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        setLangMenuOpen(false);
        setToolsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, {
      passive: true,
    });
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const homeHref = getLocalizedPagePath(language, 'home');
  const toolsHubHref = getLocalizedPagePath(language, 'tools_hub');
  const splitImageHref = getLocalizedPagePath(language, 'split_image');
  const videoToMp3Href = getLocalizedPagePath(language, 'video_to_mp3');
  const toolsHubCopy = getToolsHubContent(language);
  const splitImageCopy = getSplitImageContent(language);
  const videoToMp3Copy = getVideoToMp3Content(language);
  const isToolsSectionActive =
    activePageKey === 'tools_hub' ||
    activePageKey === 'split_image' ||
    activePageKey === 'video_to_mp3';
  const isSplitImageActive = activePageKey === 'split_image';
  const isVideoToMp3Active = activePageKey === 'video_to_mp3';
  const isToolsHubActive = activePageKey === 'tools_hub';
  const blogHref = getLocalizedPagePath(language, 'blog');
  const isBlogActive =
    activePageKey === 'blog' || activePageKey === 'blog_article';
  const visibleTabs = PLATFORM_TABS.filter((tab) => isPlatformSupported(tab.id));

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 w-full bg-[#fffaf5]/95 dark:bg-[#140e0a]/95 backdrop-blur-xl border-b border-orange-200/60 dark:border-orange-900/50 shadow-[0_2px_16px_rgba(234,88,12,0.05)] safe-area-header"
    >
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-[55px] flex items-center justify-between gap-1.5 sm:gap-2">
        {/* Brand Wordmark linking to localized Home (touch target >= 44x44px) */}
        <a
          href={homeHref}
          dir="ltr"
          onClick={(e) => {
            e.preventDefault();
            setMobileMenuOpen(false);
            setLangMenuOpen(false);
            onNavigatePage('home');
          }}
          className="min-h-[44px] px-1 flex items-center gap-2 shrink-0 group focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-xl"
        >
          <VidnexLogoMark className="w-8 h-8 rounded-lg transition-transform duration-150 group-hover:scale-95" />
          <span className="font-display font-bold text-base sm:text-lg tracking-tight text-[#1f130b] dark:text-[#fffaf5] whitespace-nowrap">
            VIDNEX
          </span>
        </a>

        {/* SINGLE Responsive Platform & Blog Navigation in the DOM (inline on md+, burger drawer on mobile) */}
        <nav
          id="vidnex-main-nav"
          aria-label="Platform Navigation"
          className={
            mobileMenuOpen
              ? 'absolute top-14 left-0 right-0 bg-[#fffaf5] dark:bg-[#1c140e] border-b border-orange-200 dark:border-orange-900/70 shadow-xl p-3 grid grid-cols-2 gap-2 md:static md:flex md:items-center md:gap-0.5 lg:gap-1 md:p-1 md:bg-orange-100/50 md:dark:bg-[#231710] md:rounded-xl md:border md:border-orange-200/70 md:dark:border-orange-900/50 md:shadow-inner z-50'
              : 'hidden md:flex items-center md:gap-0.5 lg:gap-1 p-1 bg-orange-100/50 dark:bg-[#231710] rounded-xl border border-orange-200/70 dark:border-orange-900/50 shadow-inner min-w-0'
          }
        >
          {visibleTabs.map((tab) => {
            const pKey = tab.id;
            const isActive =
              activePageKey === pKey ||
              (activePageKey === 'home' && activePlatform === tab.id);
            const href = getLocalizedPagePath(language, pKey);

            return (
              <a
                key={tab.id}
                href={href}
                data-testid={`nav-${tab.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  onNavigatePage(pKey);
                }}
                className={`min-h-[44px] md:min-h-[36px] px-3 md:px-2.5 lg:px-3.5 py-2 md:py-1.5 rounded-xl md:rounded-lg text-xs font-semibold whitespace-nowrap flex items-center justify-center md:justify-start gap-1.5 lg:gap-2 transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-[0_2px_8px_rgba(234,88,12,0.35)]'
                    : 'bg-orange-50/70 md:bg-transparent dark:bg-[#231710] md:dark:bg-transparent border border-orange-200/70 md:border-0 dark:border-orange-900/50 text-[#6c4e40] dark:text-orange-200/80 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-100/60 dark:hover:bg-orange-950/50'
                }`}
              >
                <PlatformIcon
                  platform={tab.id}
                  className="w-4 h-4 md:w-3.5 md:h-3.5 shrink-0"
                />
                <span>{tab.label}</span>
              </a>
            );
          })}

          {/* Tools Menu: Dropdown on desktop, direct links on mobile */}
          <div className="relative col-span-2 md:col-span-1" ref={toolsDropdownRef}>
            <button
              type="button"
              data-testid="nav-tools-dropdown"
              aria-expanded={toolsMenuOpen}
              aria-haspopup="menu"
              aria-controls="vidnex-tools-menu"
              onClick={() => {
                setToolsMenuOpen((prev) => !prev);
                setLangMenuOpen(false);
              }}
              className={`hidden md:flex min-h-[36px] px-2.5 lg:px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap items-center gap-1 transition-all cursor-pointer ${
                isToolsSectionActive
                  ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-[0_2px_8px_rgba(234,88,12,0.35)]'
                  : 'text-[#6c4e40] dark:text-orange-200/80 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-100/60 dark:hover:bg-orange-950/50'
              }`}
            >
              <span>{toolsHubCopy.navLabel}</span>
              <span
                aria-hidden="true"
                className={`text-[10px] transition-transform duration-150 ${
                  toolsMenuOpen ? 'rotate-180' : ''
                }`}
              >
                ▾
              </span>
            </button>

            <div
              id="vidnex-tools-menu"
              role="menu"
              aria-label={toolsHubCopy.navLabel}
              className={
                mobileMenuOpen
                  ? 'grid grid-cols-1 gap-1.5 md:hidden'
                  : toolsMenuOpen
                  ? 'hidden md:flex md:flex-col absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-64 bg-white dark:bg-[#1c140e] rounded-2xl border border-orange-200 dark:border-orange-900/80 shadow-2xl shadow-orange-950/15 dark:shadow-black/60 p-1.5 z-50 gap-1'
                  : 'sr-only'
              }
            >
              <a
                role="menuitem"
                href={videoToMp3Href}
                data-testid="nav-video-to-mp3"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  setToolsMenuOpen(false);
                  onNavigatePage('video_to_mp3');
                }}
                className={`min-h-[44px] md:min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-colors ${
                  isVideoToMp3Active
                    ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-sm'
                    : 'bg-orange-50/70 md:bg-transparent dark:bg-[#231710] md:dark:bg-transparent border border-orange-200/70 md:border-0 dark:border-orange-900/50 text-[#1f130b] dark:text-[#fffaf5] hover:bg-orange-50 dark:hover:bg-orange-950/50 hover:text-orange-600'
                }`}
              >
                <span>{videoToMp3Copy.navLabel}</span>
                <span className="font-mono text-[10px] opacity-80">MP3/WAV</span>
              </a>

              <a
                role="menuitem"
                href={splitImageHref}
                data-testid="nav-split-image"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  setToolsMenuOpen(false);
                  onNavigatePage('split_image');
                }}
                className={`min-h-[44px] md:min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-colors ${
                  isSplitImageActive
                    ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-sm'
                    : 'bg-orange-50/70 md:bg-transparent dark:bg-[#231710] md:dark:bg-transparent border border-orange-200/70 md:border-0 dark:border-orange-900/50 text-[#1f130b] dark:text-[#fffaf5] hover:bg-orange-50 dark:hover:bg-orange-950/50 hover:text-orange-600'
                }`}
              >
                <span>{splitImageCopy.breadcrumbLabel}</span>
                <span className="font-mono text-[10px] opacity-80">3×3</span>
              </a>

              <a
                role="menuitem"
                href={toolsHubHref}
                data-testid="nav-tools-hub"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  setToolsMenuOpen(false);
                  onNavigatePage('tools_hub');
                }}
                className={`min-h-[44px] md:min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between gap-2 border-t border-orange-200/60 dark:border-orange-900/50 transition-colors ${
                  isToolsHubActive
                    ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-sm'
                    : 'bg-orange-50/70 md:bg-transparent dark:bg-[#231710] md:dark:bg-transparent text-orange-700 dark:text-amber-400 hover:bg-orange-50 dark:hover:bg-orange-950/50'
                }`}
              >
                <span>{toolsHubCopy.allToolsLinkLabel}</span>
                <span aria-hidden="true" className="rtl:rotate-180">→</span>
              </a>
            </div>
          </div>

          <a
            href={blogHref}
            data-testid="nav-blog"
            onClick={(e) => {
              e.preventDefault();
              setMobileMenuOpen(false);
              onNavigatePage('blog');
            }}
            className={`min-h-[44px] md:min-h-[36px] px-3 md:px-2.5 lg:px-3.5 py-2 md:py-1.5 rounded-xl md:rounded-lg text-xs font-semibold whitespace-nowrap flex items-center justify-center md:justify-start gap-1.5 transition-all ${
              isBlogActive
                ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-[0_2px_8px_rgba(234,88,12,0.35)]'
                : 'bg-orange-50/70 md:bg-transparent dark:bg-[#231710] md:dark:bg-transparent border border-orange-200/70 md:border-0 dark:border-orange-900/50 text-[#6c4e40] dark:text-orange-200/80 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-100/60 dark:hover:bg-orange-950/50'
            }`}
          >
            <span>{getBlogNavLabel(language)}</span>
          </a>
        </nav>

        {/* Right Controls: 10-Language Selector + Theme Toggle + Mobile Burger Toggle (all >= 44x44px) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="relative" ref={langDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setLangMenuOpen((prev) => !prev);
                setMobileMenuOpen(false);
              }}
              aria-expanded={langMenuOpen}
              aria-haspopup="menu"
              aria-controls="vidnex-lang-menu"
              aria-label={`${navStrings.languageLabel} (${currentLangMeta.shortLabel})`}
              className="min-h-[44px] min-w-[44px] px-3 rounded-xl flex items-center justify-center gap-1.5 bg-orange-50/80 dark:bg-[#231710] border border-orange-200/80 dark:border-orange-900/60 font-mono text-xs font-semibold text-orange-950 dark:text-orange-100 hover:bg-orange-100 dark:hover:bg-orange-950/80 hover:border-orange-300 transition-colors cursor-pointer"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                aria-hidden="true"
                className="w-4 h-4 text-orange-600 dark:text-amber-400 shrink-0"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>{currentLangMeta.shortLabel}</span>
              <span
                aria-hidden="true"
                className={`text-orange-600/70 dark:text-amber-400/70 text-[10px] transition-transform duration-150 ${
                  langMenuOpen ? 'rotate-180' : ''
                }`}
              >
                ▾
              </span>
            </button>

            <div
              id="vidnex-lang-menu"
              role="menu"
              aria-label={navStrings.languageLabel}
              className={
                langMenuOpen
                  ? 'absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-56 max-h-[70dvh] overflow-y-auto bg-white dark:bg-[#1c140e] rounded-2xl border border-orange-200 dark:border-orange-900/80 shadow-2xl shadow-orange-950/15 dark:shadow-black/60 p-1.5 z-50'
                  : 'sr-only'
              }
            >
              {availableLanguageOptions.map(({ code, href: targetHref }) => {
                const langOpt = LOCALES_CONFIG[code];
                const isSelected = langOpt.code === language;
                return (
                  <a
                    key={langOpt.code}
                    role="menuitem"
                    href={targetHref}
                    lang={langOpt.code}
                    dir={langOpt.dir}
                    onClick={(e) => {
                      e.preventDefault();
                      onSelectLanguage(langOpt.code);
                      setLangMenuOpen(false);
                    }}
                    className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white font-semibold shadow-sm'
                        : 'text-[#1f130b] dark:text-[#fffaf5] hover:bg-orange-50 dark:hover:bg-orange-950/50 hover:text-orange-600'
                    }`}
                  >
                    <span>{langOpt.nativeName}</span>
                    <span
                      dir="ltr"
                      className="font-mono text-xs opacity-75"
                    >
                      {langOpt.shortLabel}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={
              theme === 'light'
                ? navStrings.switchToDark
                : navStrings.switchToLight
            }
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center bg-orange-50/80 dark:bg-[#231710] border border-orange-200/80 dark:border-orange-900/60 text-orange-600 dark:text-amber-400 hover:bg-orange-100 dark:hover:bg-orange-950/80 hover:border-orange-300 transition-colors cursor-pointer"
          >
            {theme === 'light' ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                aria-hidden="true"
                className="w-4 h-4"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                aria-hidden="true"
                className="w-4 h-4"
              >
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </button>

          {/* Mobile Menu Toggle Button (>= 44x44px) */}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen((prev) => !prev);
              setLangMenuOpen(false);
            }}
            aria-expanded={mobileMenuOpen}
            aria-controls="vidnex-main-nav"
            aria-label="Menu"
            className="md:hidden w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center bg-orange-50/80 dark:bg-[#231710] border border-orange-200/80 dark:border-orange-900/60 text-[#1f130b] dark:text-orange-100 hover:bg-orange-100 dark:hover:bg-orange-950/80 transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
                className="w-5 h-5"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
                className="w-5 h-5"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};