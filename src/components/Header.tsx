import React, { useState, useRef, useEffect } from 'react';
import { PlatformId } from '../utils/urlDetector';
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
}

export const PLATFORM_TABS: ToolTab[] = [
  { id: 'instagram', label: 'Instagram', isPrimary: true },
  { id: 'tiktok', label: 'TikTok', isPrimary: true },
  { id: 'youtube', label: 'YouTube', isPrimary: false },
  { id: 'twitter', label: 'X', isPrimary: false },
  { id: 'facebook', label: 'Facebook', isPrimary: false },
  { id: 'snapchat', label: 'Snapchat', isPrimary: false },
];

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
    <header className="sticky top-0 z-40 w-full bg-[#F8FAFC]/85 dark:bg-[#09090B]/85 backdrop-blur-md border-b border-slate-200/70 dark:border-zinc-800/70">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Minimalist VIDNEX Logo + Wordmark */}
        <a
          href="#top"
          dir="ltr"
          onClick={(e) => {
            e.preventDefault();
            onSelectPlatform('instagram');
          }}
          className="flex items-center gap-2.5 group focus:outline-none"
        >
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-sm shadow-orange-500/30 transition-transform duration-150 group-hover:scale-95">
            <VidnexLogoMark className="w-4 h-4" />
          </div>
          <span className="font-display font-bold text-base tracking-tight text-[#1f130b] dark:text-[#fffaf5]">
            VIDNEX
          </span>
        </a>

        {/* Center: Clean Pill Selector */}
        <nav
          aria-label="Platform Navigation"
          className="hidden sm:flex items-center bg-white/95 dark:bg-[#1c140e] p-1 rounded-full border border-orange-200/80 dark:border-orange-950/60 shadow-xs"
        >
          {primaryTabs.map((tab) => {
            const isActive = activePlatform === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectPlatform(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#09090B] shadow-2xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
                }`}
              >
                <PlatformIcon platform={tab.id} className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}

          {/* Subtle More ▾ Menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setMoreMenuOpen((prev) => !prev)}
              aria-expanded={moreMenuOpen}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeSecondary
                  ? 'bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#09090B] shadow-2xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
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
              <span className="text-[10px] leading-none opacity-70">▾</span>
            </button>

            {moreMenuOpen && (
              <div className="absolute end-0 mt-2 w-44 bg-white dark:bg-[#1c140e] rounded-2xl border border-orange-200/80 dark:border-orange-950/60 shadow-lg p-1.5 z-50">
                {secondaryTabs.map((tab) => {
                  const isActive = activePlatform === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        onSelectPlatform(tab.id);
                        setMoreMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-start transition-colors ${
                        isActive
                          ? 'bg-slate-100 dark:bg-zinc-800 text-[#0F172A] dark:text-[#FAFAFA] font-semibold'
                          : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/60 hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
                      }`}
                    >
                      <PlatformIcon platform={tab.id} className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Right: Minimal Language Pill + Theme Icon Button */}
        <div className="flex items-center gap-2">
          <div className="relative" ref={langDropdownRef}>
            <button
              type="button"
              onClick={() => setLangMenuOpen((prev) => !prev)}
              aria-expanded={langMenuOpen}
              aria-label={t.languageLabel}
              className="h-9 px-3 rounded-full flex items-center gap-1.5 bg-white dark:bg-[#1c140e] border border-orange-200/80 dark:border-orange-950/60 text-xs font-medium text-[#1f130b] dark:text-[#fffaf5] hover:border-orange-400 transition-colors"
            >
              <span>{currentLangOption.shortLabel}</span>
              <span className="text-slate-400 text-[10px]">▾</span>
            </button>

            {langMenuOpen && (
              <div className="absolute end-0 mt-2 w-40 bg-white dark:bg-[#1c140e] rounded-2xl border border-orange-200/80 dark:border-orange-950/60 shadow-lg p-1.5 z-50">
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
                          ? 'bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#09090B] font-semibold'
                          : 'text-[#0F172A] dark:text-[#FAFAFA] hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span>{langOpt.nativeName}</span>
                      <span className="text-[10px] opacity-60">
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
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-[#FAFAFA] transition-colors"
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

      {/* Mobile Compact Pill Bar */}
      <div className="flex sm:hidden overflow-x-auto px-4 pb-2.5 gap-1.5 no-scrollbar">
        {PLATFORM_TABS.map((tab) => {
          const isActive = activePlatform === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectPlatform(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#09090B]'
                  : 'bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800'
              }`}
            >
              <PlatformIcon platform={tab.id} className="w-3 h-3" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};