import React from 'react';
import {
  getLocalizedPagePath,
  LEGAL_PAGE_KEYS,
  type LegalPageKey,
  LOCALES_CONFIG,
  type PageKey,
  PLATFORM_PAGE_KEYS,
  type PlatformPageKey,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '../i18n/config.ts';
import { getLocaleBundleSync } from '../i18n/localeLoader.ts';

interface FooterProps {
  activePageKey: PageKey | 'not_found';
  onNavigatePage: (pageKey: PageKey) => void;
  language: SupportedLocale;
  onSelectLanguage: (lang: SupportedLocale) => void;
}

export const Footer: React.FC<FooterProps> = ({
  activePageKey,
  onNavigatePage,
  language,
  onSelectLanguage,
}) => {
  const bundle = getLocaleBundleSync(language);
  const f = bundle.ui.footer;

  const pageForLangSwitch: PageKey =
    activePageKey === 'not_found' ? 'home' : activePageKey;

  const handlePageClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    target: PageKey
  ) => {
    e.preventDefault();
    onNavigatePage(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="relative z-10 w-full border-t border-orange-200/80 dark:border-orange-900/50 bg-[#fffaf5] dark:bg-[#140e0a] shadow-[0_-4px_20px_rgba(234,88,12,0.03)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* 3-Section Crawl Grid: Platforms, Legal Pages, and All 10 Languages */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-xs">
          {/* 1. Dedicated Platform Pages */}
          <div>
            <h2 className="font-display text-xs font-bold uppercase tracking-wider text-orange-800 dark:text-amber-400 mb-3">
              {f.platformsTitle}
            </h2>
            <ul className="space-y-2">
              {PLATFORM_PAGE_KEYS.map((pKey: PlatformPageKey) => {
                const pData = bundle.platforms[pKey];
                const href = getLocalizedPagePath(language, pKey);
                const isActive = activePageKey === pKey;
                return (
                  <li key={pKey}>
                    <a
                      href={href}
                      onClick={(e) => handlePageClick(e, pKey)}
                      className={`transition-colors ${
                        isActive
                          ? 'text-orange-600 dark:text-amber-400 font-bold'
                          : 'text-[#6c4e40] dark:text-orange-200/75 hover:text-orange-600 dark:hover:text-amber-400 font-medium'
                      }`}
                    >
                      {pData.h1}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* 2. Legal & Trust Pages (real <a href> links) */}
          <div>
            <h2 className="font-display text-xs font-bold uppercase tracking-wider text-orange-800 dark:text-amber-400 mb-3">
              {f.legalTitle}
            </h2>
            <ul className="space-y-2">
              {LEGAL_PAGE_KEYS.map((lKey: LegalPageKey) => {
                const href = getLocalizedPagePath(language, lKey);
                const isActive = activePageKey === lKey;
                return (
                  <li key={lKey}>
                    <a
                      href={href}
                      onClick={(e) => handlePageClick(e, lKey)}
                      className={`transition-colors ${
                        isActive
                          ? 'text-orange-600 dark:text-amber-400 font-bold'
                          : 'text-[#6c4e40] dark:text-orange-200/75 hover:text-orange-600 dark:hover:text-amber-400 font-medium'
                      }`}
                    >
                      {f[lKey]}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* 3. All 10 Languages with Native Names & real <a href> links */}
          <div>
            <h2 className="font-display text-xs font-bold uppercase tracking-wider text-orange-800 dark:text-amber-400 mb-3">
              {f.languagesTitle}
            </h2>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_LOCALES.map((code) => {
                const meta = LOCALES_CONFIG[code];
                const href = getLocalizedPagePath(code, pageForLangSwitch);
                const isCurrent = code === language;
                return (
                  <a
                    key={code}
                    href={href}
                    lang={meta.code}
                    dir={meta.dir}
                    onClick={(e) => {
                      e.preventDefault();
                      onSelectLanguage(code);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`px-2.5 py-1 rounded-lg border transition-colors ${
                      isCurrent
                        ? 'bg-orange-600 text-white border-orange-600 font-bold'
                        : 'bg-white dark:bg-[#1c140e] border-orange-200/80 dark:border-orange-900/60 text-[#6c4e40] dark:text-orange-200/80 hover:border-orange-400 font-medium'
                    }`}
                  >
                    {meta.nativeName}
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Copyright Bar */}
        <div className="pt-5 border-t border-orange-200/60 dark:border-orange-900/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6c4e40] dark:text-orange-200/70">
          <span className="font-medium">{f.copyrightNotice}</span>
        </div>
      </div>
    </footer>
  );
};