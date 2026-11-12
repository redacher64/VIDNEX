import React from 'react';
import {
  getLocalizedPagePath,
  LEGAL_PAGE_KEYS,
  type LegalPageKey,
  PLATFORM_PAGE_KEYS,
  type PlatformPageKey,
  type SupportedLocale,
} from '../i18n/config.ts';
import { getLocaleBundleSync } from '../i18n/localeLoader.ts';
import { PlatformIcon } from './icons/PlatformIcons.tsx';

interface LegalPageViewProps {
  legalKey: LegalPageKey;
  locale: SupportedLocale;
  onNavigatePage: (pageKey: LegalPageKey | PlatformPageKey | 'home') => void;
}

export const LegalPageView: React.FC<LegalPageViewProps> = ({
  legalKey,
  locale,
  onNavigatePage,
}) => {
  const bundle = getLocaleBundleSync(locale);
  const fallbackEn = getLocaleBundleSync('en');
  const fallbackFr = getLocaleBundleSync('fr');

  const legalDoc =
    bundle.legal?.[legalKey] ||
    fallbackEn.legal?.[legalKey] ||
    fallbackFr.legal?.[legalKey];

  if (!legalDoc) {
    return null;
  }

  const homeHref = getLocalizedPagePath(locale, 'home');

  return (
    <section className="w-full py-10 sm:py-14 bg-[#fffaf5] dark:bg-[#140e0a]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Visible Breadcrumb with real <a href> links */}
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex flex-wrap items-center gap-2 text-xs font-mono text-[#6c4e40] dark:text-orange-200/75"
        >
          <a
            href={homeHref}
            onClick={(e) => {
              e.preventDefault();
              onNavigatePage('home');
            }}
            className="hover:text-orange-600 dark:hover:text-amber-400 font-semibold transition-colors"
          >
            {bundle.ui.sections.breadcrumbHome}
          </a>
          <span aria-hidden="true" className="opacity-60">
            /
          </span>
          <span
            aria-current="page"
            className="text-orange-700 dark:text-amber-400 font-bold"
          >
            {legalDoc.breadcrumbLabel}
          </span>
        </nav>

        {/* Legal Navigation Pills */}
        <div className="mb-8 flex flex-wrap items-center gap-2">
          {LEGAL_PAGE_KEYS.map((k) => {
            const isActive = k === legalKey;
            const href = getLocalizedPagePath(locale, k);
            const label = bundle.ui.footer[k];
            return (
              <a
                key={k}
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigatePage(k);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'bg-white dark:bg-[#1c140e] border border-orange-200/80 dark:border-orange-900/60 text-[#6c4e40] dark:text-orange-200/80 hover:border-orange-400'
                }`}
              >
                {label}
              </a>
            );
          })}
        </div>

        {/* Main Content Card */}
        <article className="bg-white/95 dark:bg-[#1c140e]/95 rounded-3xl border border-orange-200/90 dark:border-orange-900/60 p-6 sm:p-10 shadow-card-warm space-y-6">
          <header className="border-b border-orange-200/70 dark:border-orange-900/50 pb-6">
            <span className="inline-block font-mono text-[11px] font-bold uppercase tracking-wider text-orange-700 dark:text-amber-400 mb-2">
              VIDNEX · {legalDoc.updatedAt}
            </span>
            <h1 className="font-display text-2xl sm:text-4xl font-bold text-[#1f130b] dark:text-[#fffaf5]">
              {legalDoc.h1}
            </h1>
            <p className="mt-3 text-sm sm:text-base text-[#6c4e40] dark:text-orange-200/85 leading-relaxed">
              {legalDoc.intro}
            </p>
          </header>

          <div className="space-y-6">
            {legalDoc.sections.map((sec) => (
              <section key={sec.heading} className="space-y-3">
                <h2 className="font-display text-lg sm:text-xl font-bold text-[#1f130b] dark:text-[#fffaf5]">
                  {sec.heading}
                </h2>
                {sec.paragraphs.map((p, idx) => (
                  <p
                    key={idx}
                    className="text-sm sm:text-base text-[#6c4e40] dark:text-orange-200/80 leading-relaxed"
                  >
                    {p}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </article>

        {/* Internal Links to the 4 Platform Tools */}
        <div className="mt-10">
          <h2 className="font-display text-lg font-bold text-[#1f130b] dark:text-[#fffaf5] mb-4">
            {bundle.ui.footer.platformsTitle}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
                  className="p-4 rounded-2xl bg-white dark:bg-[#1c140e] border border-orange-200/80 dark:border-orange-900/60 hover:border-orange-500 transition-all flex items-center justify-between gap-2 group"
                >
                  <span className="flex items-center gap-2 font-display text-sm font-bold text-[#1f130b] dark:text-[#fffaf5]">
                    <span className="text-orange-600 dark:text-amber-400">
                      <PlatformIcon platform={pKey} className="w-4 h-4" />
                    </span>
                    <span>{pData.shortLabel}</span>
                  </span>
                  <span className="text-orange-600 dark:text-amber-400 font-mono text-xs font-bold rtl:rotate-180 transition-transform group-hover:translate-x-0.5">
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
