import React, { useState, useRef, useEffect } from 'react';
import { PlatformId, isPlatformSupported } from '../utils/urlDetector';
import { PlatformIcon, VidnexLogoMark } from './icons/PlatformIcons';
import {
  LanguageCode,
  SUPPORTED_LANGUAGES,
  UI_TRANSLATIONS,
} from '../i18n/translations';

export interface ToolTab {
  id: PlatformId;
  label: string;
  isPrimary: boolean;
  supported: boolean;
}

export const PLATFORM_TABS: ToolTab[] = [
  { id: 'instagram', label: 'Instagram', isPrimary: true, supported: true },
  { id: 'tiktok', label: 'TikTok', isPrimary: true, supported: true },
  { id: 'x', label: 'X (Twitter)', isPrimary: true, supported: true },
  { id: 'youtube', label: 'YouTube', isPrimary: true, supported: false },
  { id: 'facebook', label: 'Facebook', isPrimary: false, supported: false },
  { id: 'snapchat', label: 'Snapchat', isPrimary: false, supported: false },
];

const SOON_BADGE_BY_LANG: Record<LanguageCode, string> = {
  en: 'Soon',
  fr: 'Bientôt',
  es: 'Pronto',
  pt: 'Em breve',
  ar: 'قريباً',
};

interface HeaderProps {
  activePlatform: PlatformId;
  onSelectPlatform: (platform: PlatformId) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  language: LanguageCode;
  onSelectLanguage: (lang: LanguageCode) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activePlatform,
  onSelectPlatform,
  theme,
  onToggleTheme,
  language,
  onSelectLanguage,
}) => {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  const t = UI_TRANSLATIONS[language].header;
  const soonBadge = SOON_BADGE_BY_LANG[language] || 'Soon';
  const currentLangOption =
    SUPPORTED_LANGUAGES.find((l) => l.code === language) ||
    SUPPORTED_LANGUAGES[0];

  const primaryTabs = PLATFORM_TABS.filter((tab) => tab.isPrimary);
  const secondaryTabs = PLATFORM_TABS.filter((tab) => !tab.isPrimary);
  const activeSecondary = secondaryTabs.find(
    (tab) => tab.id === activePlatform
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setMoreMenuOpen(false);
      }
      if (
        langDropdownRef.current &&
        !langDropdownRef.current.contains(event.target as Node)
      ) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full bg-[#fffaf5]/85 dark:bg-[#140e0a]/85 backdrop-blur-xl border-b border-orange-200/60 dark:border-orange-900/50 shadow-[0_4px_24px_rgba(234,88,12,0.06)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: VIDNEX Brand Wordmark */}
        <a
          href="#top"
          dir="ltr"
          onClick={(e) => {
            e.preventDefault();
            onSelectPlatform('instagram');
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

        {/* Center: Warm Segmented Platform Bar */}
        <nav
          aria-label="Platform Navigation"
          className="hidden sm:flex items-center gap-1 p-1 bg-orange-100/50 dark:bg-[#231710] rounded-xl border border-orange-200/70 dark:border-orange-900/50 shadow-inner"
        >
          {primaryTabs.map((tab) => {
            const isActive = activePlatform === tab.id;
            const supported = isPlatformSupported(tab.id);
            return (
              <button
                key={tab.id}
                type="button"
                disabled={!supported}
                onClick={() => {
                  if (supported) onSelectPlatform(tab.id);
                }}
                title={!supported ? `${tab.label} — ${soonBadge}` : tab.label}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  !supported
                    ? 'opacity-55 cursor-not-allowed text-[#6c4e40] dark:text-orange-200/50'
                    : isActive
                    ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-[0_2px_8px_rgba(234,88,12,0.35)]'
                    : 'text-[#6c4e40] dark:text-orange-200/75 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-100/60 dark:hover:bg-orange-950/50'
                }`}
              >
                <PlatformIcon platform={tab.id} className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {!supported && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded bg-orange-200/70 dark:bg-orange-950/80 text-[9px] font-mono uppercase tracking-wider text-orange-800 dark:text-amber-400">
                    {soonBadge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Subtle More ▾ Menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setMoreMenuOpen((prev) => !prev)}
              aria-expanded={moreMenuOpen}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeSecondary
                  ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-[0_2px_8px_rgba(234,88,12,0.35)]'
                  : 'text-[#6c4e40] dark:text-orange-200/75 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-100/60 dark:hover:bg-orange-950/50'
              }`}
            >
              {activeSecondary ? (
                <>
                  <PlatformIcon
                    platform={activeSecondary.id}
                    className="w-3.5 h-3.5"
                  />
                  <span>{activeSecondary.label}</span>
                </>
              ) : (
                <span>{t.morePlatforms}</span>
              )}
              <span className="text-[10px] leading-none opacity-75">▾</span>
            </button>

            {moreMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white/95 dark:bg-[#1c140e] backdrop-blur-xl rounded-2xl border border-orange-200/80 dark:border-orange-900/60 shadow-orange-glow p-1.5 z-50">
                {secondaryTabs.map((tab) => {
                  const supported = isPlatformSupported(tab.id);
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      disabled={!supported}
                      onClick={() => {
                        if (supported) {
                          onSelectPlatform(tab.id);
                          setMoreMenuOpen(false);
                        }
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors ${
                        !supported
                          ? 'opacity-55 cursor-not-allowed text-[#6c4e40] dark:text-orange-200/50'
                          : 'text-[#6c4e40] dark:text-orange-200/80 hover:bg-orange-50 dark:hover:bg-orange-950/50 hover:text-orange-600 dark:hover:text-orange-400'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <PlatformIcon platform={tab.id} className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </span>
                      {!supported && (
                        <span className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950/80 text-[9px] font-mono uppercase tracking-wider text-orange-800 dark:text-amber-400">
                          {soonBadge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Right: Warm Language Selector + Theme Icon Button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative" ref={langDropdownRef}>
            <button
              type="button"
              onClick={() => setLangMenuOpen((prev) => !prev)}
              aria-expanded={langMenuOpen}
              aria-label={t.languageLabel}
              className="h-9 px-3 rounded-xl flex items-center gap-1.5 bg-orange-50/80 dark:bg-[#231710] border border-orange-200/80 dark:border-orange-900/60 font-mono text-xs font-semibold text-orange-950 dark:text-orange-100 hover:bg-orange-100 dark:hover:bg-orange-950/80 hover:border-orange-300 transition-colors"
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
              <span>{currentLangOption.shortLabel}</span>
              <span className="text-orange-600/70 dark:text-amber-400/70 text-[10px]">
                ▾
              </span>
            </button>

            {langMenuOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white/95 dark:bg-[#1c140e] backdrop-blur-xl rounded-2xl border border-orange-200/80 dark:border-orange-900/60 shadow-orange-glow p-1.5 z-50">
                {SUPPORTED_LANGUAGES.map((langOpt) => {
                  const isSelected = langOpt.code === language;
                  return (
                    <button
                      key={langOpt.code}
                      type="button"
                      onClick={() => {
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
                      <span className="font-mono text-[10px] opacity-75">
                        {langOpt.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={
              theme === 'light' ? t.switchThemeDark : t.switchThemeLight
            }
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-orange-50/80 dark:bg-[#231710] border border-orange-200/80 dark:border-orange-900/60 text-orange-600 dark:text-amber-400 hover:bg-orange-100 dark:hover:bg-orange-950/80 hover:border-orange-300 transition-colors"
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

      {/* Mobile Compact Bar */}
      <div className="flex sm:hidden overflow-x-auto px-4 pb-2.5 gap-1.5 no-scrollbar">
        {PLATFORM_TABS.map((tab) => {
          const isActive = activePlatform === tab.id;
          const supported = isPlatformSupported(tab.id);
          return (
            <button
              key={tab.id}
              type="button"
              disabled={!supported}
              onClick={() => {
                if (supported) onSelectPlatform(tab.id);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                !supported
                  ? 'opacity-50 cursor-not-allowed bg-white/60 dark:bg-[#231710]/60 text-[#6c4e40] dark:text-orange-200/50 border border-orange-200/50 dark:border-orange-900/40'
                  : isActive
                  ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-sm'
                  : 'bg-white/90 dark:bg-[#231710] text-[#6c4e40] dark:text-orange-200/75 border border-orange-200/80 dark:border-orange-900/50'
              }`}
            >
              <PlatformIcon platform={tab.id} className="w-3 h-3" />
              <span>{tab.label}</span>
              {!supported && (
                <span className="px-1 py-0.5 rounded bg-orange-100 dark:bg-orange-950 text-[9px] font-mono uppercase text-orange-800 dark:text-amber-400">
                  {soonBadge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};