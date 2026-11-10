import React from 'react';
import {
  getLocalizedPagePath,
  PLATFORM_PAGE_KEYS,
  type PlatformPageKey,
  type SupportedLocale,
} from '../i18n/config.ts';
import { getLocaleBundleSync } from '../i18n/localeLoader.ts';
import { PlatformIcon } from './icons/PlatformIcons.tsx';

interface NotFoundViewProps {
  locale: SupportedLocale;
  onNavigatePage: (pageKey: PlatformPageKey | 'home') => void;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({
  locale,
  onNavigatePage,
}) => {
  const bundle = getLocaleBundleSync(locale);
  const nf = bundle.ui.notFound;
  const homeHref = getLocalizedPagePath(locale, 'home');

  return (
    <section className="w-full py-16 sm:py-24 bg-[#fffaf5] dark:bg-[#140e0a]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-100 dark:bg-orange-950/60 border border-orange-300 dark:border-orange-800 text-orange-600 dark:text-amber-400 font-mono text-xl font-bold mb-6">
          404
        </div>

        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#1f130b] dark:text-[#fffaf5]">
          {nf.heading}
        </h1>

        <p className="mt-4 text-base text-[#6c4e40] dark:text-orange-200/80 max-w-xl mx-auto leading-relaxed">
          {nf.description}
        </p>

        <div className="mt-8">
          <a
            href={homeHref}
            onClick={(e) => {
              e.preventDefault();
              onNavigatePage('home');
            }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-mono text-sm font-bold shadow-orange-sm transition-all"
          >
            <span>{nf.backHomeCta}</span>
            <span className="rtl:rotate-180">→</span>
          </a>
        </div>

        <div className="mt-12 pt-8 border-t border-orange-200/70 dark:border-orange-900/50 text-left">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-orange-800 dark:text-amber-400 text-center mb-5">
            {nf.tryPlatformsLabel}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {PLATFORM_PAGE_KEYS.map((pKey) => {
              const pData = bundle.platforms[pKey];
              const pHref = getLocalizedPagePath(locale, pKey);
              return (
                <a
                  key={pKey}
                  href={pHref}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigatePage(pKey);
                  }}
                  className="p-4 rounded-2xl bg-white dark:bg-[#1c140e] border border-orange-200/80 dark:border-orange-900/60 hover:border-orange-500 transition-all flex items-center justify-between gap-3 group shadow-sm"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-display text-sm font-bold text-[#1f130b] dark:text-[#fffaf5]">
                      <span className="text-orange-600 dark:text-amber-400">
                        <PlatformIcon platform={pKey} className="w-4 h-4" />
                      </span>
                      <span>{pData.shortLabel}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#6c4e40] dark:text-orange-200/70 truncate">
                      {pData.h1}
                    </p>
                  </div>
                  <span className="text-orange-600 dark:text-amber-400 font-mono text-sm font-bold rtl:rotate-180 shrink-0">
                    →
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
