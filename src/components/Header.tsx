import React, { useState, useRef, useEffect } from 'react';
import { PlatformId, isPlatformSupported } from '../utils/urlDetector.ts';
import { PlatformIcon, VidnexLogoMark } from './icons/PlatformIcons.tsx';
import {
  getLocalizedPagePath,
  LOCALES_CONFIG,
  type PageKey,
  type PlatformPageKey,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '../i18n/config.ts';
import { getLocaleBundleSync } from '../i18n/localeLoader.ts';

export interface ToolTab {
  id: PlatformId;
  label: string;
  isPrimary: boolean;
  supported: boolean;
}

export const PLATFORM_TABS: ToolTab[] = [
  { id: 'tiktok', label: 'TikTok', isPrimary: true, supported: true },
  { id: 'instagram', label: 'Instagram', isPrimary: true, supported: true },
  { id: 'x', label: 'X (Twitter)', isPrimary: true, supported: true },
  { id: 'facebook', label: 'Facebook', isPrimary: true, supported: true },
  { id: 'youtube', label: 'YouTube', isPrimary: false, supported: false },
  { id: 'snapchat', label: 'Snapchat', isPrimary: false, supported: false },
];

interface HeaderProps {
  activePageKey: PageKey | 'not_found';
  activePlatform: PlatformId;
  onNavigatePage: (pageKey: PageKey) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  language: SupportedLocale;
  onSelectLanguage: (lang: SupportedLocale) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activePageKey,
  activePlatform,
  onNavigatePage,
  theme,
  onToggleTheme,
  language,
  onSelectLanguage,
}) => {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  const bundle = getLocaleBundleSync(language);
  const navStrings = bundle.ui.nav;
  const currentLangMeta = LOCALES_CONFIG[language] || LOCALES_CONFIG.fr;

  const primaryTabs = PLATFORM_TABS.filter((tab) => tab.isPrimary);
  const secondaryTabs = PLATFORM_TABS.filter((tab) => !tab.isPrimary);

  const pageForLangSwitch: PageKey =
    activePageKey === 'not_found' ? 'home' : activePageKey;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      const inDesktopMore =
        dropdownRef.current && dropdownRef.current.contains(target);
      const inMobileMore =
        mobileDropdownRef.current && mobileDropdownRef.current.contains(target);
      if (!inDesktopMore && !inMobileMore) {
        setMoreMenuOpen(false);
      }
      if (
        langDropdownRef.current &&
        !langDropdownRef.current.contains(target)
      ) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, {
      passive: true,
    });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const homeHref = getLocalizedPagePath(language, 'home');

  return (
    <header className="sticky top-0 z-40 w-full bg-[#fffaf5]/90 dark:bg-[#140e0a]/90 backdrop-blur-xl border-b border-orange-200/60 dark:border-orange-900/50 shadow-[0_4px_24px_rgba(234,88,12,0.06)]">
      <div className="max-w-6xl mx-auto px-3.5 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
        {/* Brand Wordmark linking to localized Home */}
        <a
          href={homeHref}
          dir="ltr"
          onClick={(e) => {
            e.preventDefault();
            setMoreMenuOpen(false);
            setLangMenuOpen(false);
            onNavigatePage('home');
          }}
          className="flex items-center gap-2.5 shrink-0 group focus:outline-none"
        >
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-[0_2px_10px_rgba(234,88,12,0.35)] transition-transform duration-150 group-hover:scale-95">
            <VidnexLogoMark className="w-4 h-4" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight text-[#1f130b] dark:text-[#fffaf5] whitespace-nowrap">
            VIDNEX
          </span>
        </a>

        {/* Center (Desktop): Segmented Platform Navigation with real <a href> links */}
        <nav
          aria-label="Platform Navigation"
          className="hidden md:flex items-center gap-1 p-1 bg-orange-100/50 dark:bg-[#231710] rounded-xl border border-orange-200/70 dark:border-orange-900/50 shadow-inner"
        >
          {primaryTabs.map((tab) => {
            const pKey = tab.id as PlatformPageKey;
            const isActive =
              activePageKey === pKey ||
              (activePageKey === 'home' && activePlatform === tab.id);
            const supported = isPlatformSupported(tab.id);
            const href = getLocalizedPagePath(language, pKey);

            if (!supported) {
              return (
                <span
                  key={tab.id}
                  title={`${tab.label} — ${navStrings.soonBadge}`}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap opacity-55 cursor-not-allowed text-[#6c4e40] dark:text-orange-200/50"
                >
                  <PlatformIcon platform={tab.id} className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  <span className="px-1.5 py-0.5 rounded bg-orange-200/70 dark:bg-orange-950/80 text-[9px] font-mono uppercase tracking-wider text-orange-800 dark:text-amber-400">
                    {navStrings.soonBadge}
                  </span>
                </span>
              );
            }

            return (
              <a
                key={tab.id}
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  setMoreMenuOpen(false);
                  onNavigatePage(pKey);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-[0_2px_8px_rgba(234,88,12,0.35)]'
                    : 'text-[#6c4e40] dark:text-orange-200/75 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-100/60 dark:hover:bg-orange-950/50'
                }`}
              >
                <PlatformIcon platform={tab.id} className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </a>
            );
          })}

          {/* Subtle More Menu for upcoming platforms (YouTube, Snapchat) */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setMoreMenuOpen((prev) => !prev)}
              aria-expanded={moreMenuOpen}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                moreMenuOpen
                  ? 'bg-white dark:bg-[#2f2016] text-orange-600 dark:text-amber-400 shadow-sm'
                  : 'text-[#6c4e40] dark:text-orange-200/75 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-100/60 dark:hover:bg-orange-950/50'
              }`}
            >
              <span>{navStrings.morePlatforms}</span>
              <span
                className={`text-[10px] leading-none opacity-75 transition-transform duration-150 ${
                  moreMenuOpen ? 'rotate-180' : ''
                }`}
              >
                ▾
              </span>
            </button>

            {moreMenuOpen && (
              <div className="absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-52 bg-white/95 dark:bg-[#1c140e] backdrop-blur-xl rounded-2xl border border-orange-200/80 dark:border-orange-900/60 shadow-orange-glow p-1.5 z-50">
                {secondaryTabs.map((tab) => (
                  <div
                    key={tab.id}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold opacity-65 cursor-not-allowed text-[#6c4e40] dark:text-orange-200/60"
                  >
                    <span className="flex items-center gap-2">
                      <PlatformIcon platform={tab.id} className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950/80 text-[9px] font-mono uppercase tracking-wider text-orange-800 dark:text-amber-400">
                      {navStrings.soonBadge}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Right: 10-Language Selector with real <a href> links + Theme Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative" ref={langDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setLangMenuOpen((prev) => !prev);
                setMoreMenuOpen(false);
              }}
              aria-expanded={langMenuOpen}
              aria-label={navStrings.languageLabel}
              className="h-9 px-3 rounded-xl flex items-center gap-1.5 bg-orange-50/80 dark:bg-[#231710] border border-orange-200/80 dark:border-orange-900/60 font-mono text-xs font-semibold text-orange-950 dark:text-orange-100 hover:bg-orange-100 dark:hover:bg-orange-950/80 hover:border-orange-300 transition-colors cursor-pointer"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                className="w-3.5 h-3.5 text-orange-600 dark:text-amber-400"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>{currentLangMeta.shortLabel}</span>
              <span className="text-orange-600/70 dark:text-amber-400/70 text-[10px]">
                ▾
              </span>
            </button>

            <div
              className={
                langMenuOpen
                  ? 'absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-52 max-h-80 overflow-y-auto bg-white/95 dark:bg-[#1c140e] backdrop-blur-xl rounded-2xl border border-orange-200/80 dark:border-orange-900/60 shadow-orange-glow p-1.5 z-50'
                  : 'sr-only'
              }
            >
              {SUPPORTED_LOCALES.map((code) => {
                const langOpt = LOCALES_CONFIG[code];
                const isSelected = langOpt.code === language;
                const targetHref = getLocalizedPagePath(
                  langOpt.code,
                  pageForLangSwitch
                );
                return (
                  <a
                    key={langOpt.code}
                    href={targetHref}
                    lang={langOpt.code}
                    dir={langOpt.dir}
                    onClick={(e) => {
                      e.preventDefault();
                      onSelectLanguage(langOpt.code);
                      setLangMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white font-semibold shadow-sm'
                        : 'text-[#1f130b] dark:text-[#fffaf5] hover:bg-orange-50 dark:hover:bg-orange-950/50 hover:text-orange-600'
                    }`}
                  >
                    <span>{langOpt.nativeName}</span>
                    <span
                      dir="ltr"
                      className="font-mono text-[10px] opacity-75"
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
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-orange-50/80 dark:bg-[#231710] border border-orange-200/80 dark:border-orange-900/60 text-orange-600 dark:text-amber-400 hover:bg-orange-100 dark:hover:bg-orange-950/80 hover:border-orange-300 transition-colors cursor-pointer"
          >
            {theme === 'light' ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
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
        </div>
      </div>

      {/* Mobile & Tablet-Portrait Segmented Platform Navigation + "Plus" (YouTube, Snapchat) Menu */}
      <div
        className="relative md:hidden px-3 pb-2.5"
        ref={mobileDropdownRef}
      >
        <nav
          aria-label="Mobile Platform Navigation"
          className="flex items-center gap-1 p-1 bg-orange-100/60 dark:bg-[#231710] rounded-xl border border-orange-200/70 dark:border-orange-900/50 shadow-inner overflow-x-auto no-scrollbar"
        >
          {primaryTabs.map((tab) => {
            const pKey = tab.id as PlatformPageKey;
            const isActive =
              activePageKey === pKey ||
              (activePageKey === 'home' && activePlatform === tab.id);
            const supported = isPlatformSupported(tab.id);
            const href = getLocalizedPagePath(language, pKey);
            const mobileShortLabel = tab.id === 'x' ? 'X' : tab.label;

            return (
              <a
                key={tab.id}
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  setMoreMenuOpen(false);
                  if (supported) onNavigatePage(pKey);
                }}
                className={`flex-1 min-w-fit flex items-center justify-center gap-1 px-2 py-1.5 sm:px-2.5 sm:py-2 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all ${
                  !supported
                    ? 'opacity-50 pointer-events-none text-[#6c4e40] dark:text-orange-200/50'
                    : isActive
                    ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-[0_2px_8px_rgba(234,88,12,0.35)]'
                    : 'text-[#6c4e40] dark:text-orange-200/80 hover:text-orange-600 dark:hover:text-orange-400 active:bg-orange-200/50 dark:active:bg-orange-950/60'
                }`}
              >
                <PlatformIcon
                  platform={tab.id}
                  className="w-3.5 h-3.5 shrink-0"
                />
                <span className="sm:hidden">{mobileShortLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </a>
            );
          })}

          {/* Mobile "Plus" Button for upcoming platforms (YouTube, Snapchat) */}
          <button
            type="button"
            onClick={() => {
              setMoreMenuOpen((prev) => !prev);
              setLangMenuOpen(false);
            }}
            aria-expanded={moreMenuOpen}
            className={`flex-1 min-w-fit flex items-center justify-center gap-1 px-2 py-1.5 sm:px-2.5 sm:py-2 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              moreMenuOpen
                ? 'bg-white dark:bg-[#2f2016] text-orange-600 dark:text-amber-400 shadow-sm border border-orange-300/70 dark:border-orange-800/70'
                : 'text-[#6c4e40] dark:text-orange-200/80 hover:text-orange-600 dark:hover:text-orange-400 active:bg-orange-200/50 dark:active:bg-orange-950/60'
            }`}
          >
            <span>{navStrings.morePlatforms}</span>
            <span
              className={`text-[10px] leading-none opacity-80 transition-transform duration-150 ${
                moreMenuOpen ? 'rotate-180' : ''
              }`}
            >
              ▾
            </span>
          </button>
        </nav>

        {/* Mobile Dropdown Panel (rendered outside overflow-x-auto so it is never clipped) */}
        {moreMenuOpen && (
          <div className="absolute left-3 right-3 sm:left-auto sm:right-3 sm:w-64 top-full mt-1 bg-[#fffaf5] dark:bg-[#1c140e] rounded-2xl border border-orange-200 dark:border-orange-900/80 shadow-[0_12px_32px_rgba(234,88,12,0.2)] p-2 z-50">
            <div className="grid grid-cols-2 sm:grid-cols-1 gap-1.5">
              {secondaryTabs.map((tab) => (
                <div
                  key={tab.id}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-orange-50/80 dark:bg-[#241811] border border-orange-200/70 dark:border-orange-900/50 text-xs font-semibold opacity-80 cursor-not-allowed text-[#6c4e40] dark:text-orange-200/80"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <PlatformIcon
                      platform={tab.id}
                      className="w-3.5 h-3.5 shrink-0 text-orange-600 dark:text-amber-400"
                    />
                    <span className="truncate">{tab.label}</span>
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-orange-200/70 dark:bg-orange-950/90 text-[9px] font-mono uppercase tracking-wider text-orange-800 dark:text-amber-400 shrink-0">
                    {navStrings.soonBadge}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};