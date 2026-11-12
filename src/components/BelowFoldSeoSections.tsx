import React, { useState, useEffect } from 'react';
import {
  getLocalizedPagePath,
  PLATFORM_PAGE_KEYS,
  type PlatformPageKey,
  type SupportedLocale,
} from '../i18n/config.ts';
import { getLocaleBundleSync } from '../i18n/localeLoader.ts';
import { isPlatformSupported } from '../utils/urlDetector.ts';
import { AdSlot } from './AdSlot.tsx';
import { PlatformIcon } from './icons/PlatformIcons.tsx';

interface BelowFoldSeoSectionsProps {
  pageKey: 'home' | PlatformPageKey;
  onNavigatePage: (pageKey: 'home' | PlatformPageKey) => void;
  language: SupportedLocale;
}

export const BelowFoldSeoSections: React.FC<BelowFoldSeoSectionsProps> = ({
  pageKey,
  onNavigatePage,
  language,
}) => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const bundle = getLocaleBundleSync(language);
  const t = bundle.ui.sections;
  const pageContent =
    pageKey === 'home' ? bundle.home : bundle.platforms[pageKey];
  const editorial = pageContent.editorial;

  useEffect(() => {
    setOpenFaqIndex(0);
  }, [pageKey, language]);

  const handlePageSelect = (
    e: React.MouseEvent<HTMLAnchorElement>,
    target: 'home' | PlatformPageKey
  ) => {
    e.preventDefault();
    onNavigatePage(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="w-full">
      {/* 1. SPECS RIBBON */}
      <section className="w-full bg-gradient-to-r from-orange-50 via-white to-amber-50/60 dark:from-[#1c140e] dark:via-[#140e0a] dark:to-[#1c140e] border-b border-orange-200/60 dark:border-orange-900/40 shadow-sm py-5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 items-stretch">
          {t.bentoCards.map((card, idx) => (
            <div
              key={card.id}
              className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-orange-100/40 dark:bg-[#231710]/90 border border-orange-200/60 dark:border-orange-900/50"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center shrink-0 shadow-orange-sm font-mono text-xs font-bold">
                0{idx + 1}
              </div>
              <div className="min-w-0">
                <div className="font-mono text-[11px] text-orange-800/80 dark:text-amber-400/90 font-semibold uppercase tracking-wider">
                  {card.metric}
                </div>
                <div className="font-display text-sm leading-snug text-[#1f130b] dark:text-[#fffaf5] font-bold break-words">
                  {card.title}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. 3-STEP HOW IT WORKS BENTO GRID */}
      <section
        aria-labelledby="howto-heading"
        className="w-full py-10 sm:py-14 bg-[#fffaf5] dark:bg-[#140e0a]"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 sm:mb-10 gap-3">
            <div>
              <span className="font-mono text-[11px] text-orange-700 dark:text-amber-400 tracking-widest uppercase font-bold">
                {t.workflowProtocol}
              </span>
              <h2
                id="howto-heading"
                className="font-display text-2xl sm:text-3xl font-bold text-[#1f130b] dark:text-[#fffaf5] mt-1.5"
              >
                {t.howToHeading}
              </h2>
            </div>
            <p className="text-base text-[#6c4e40] dark:text-orange-200/80 max-w-md leading-relaxed">
              {pageContent.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            {pageContent.howToSteps.map((step, idx) => (
              <div
                key={step.number}
                className="bg-white/90 dark:bg-[#1c140e]/90 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-orange-200/90 dark:border-orange-900/60 shadow-card-warm flex flex-col justify-between hover:shadow-orange-glow hover:border-orange-400 transition-all duration-300 group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-xs font-bold text-white px-3 py-1 bg-gradient-to-r from-orange-600 to-amber-600 rounded-lg shadow-sm">
                      {t.stepOf} {step.number}
                    </span>
                    <span
                      dir="ltr"
                      className="font-mono text-xs text-orange-700 dark:text-amber-400 font-semibold"
                    >
                      0{idx + 1} / 03
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-[#1f130b] dark:text-[#fffaf5] mb-2">
                    {step.title}
                  </h3>
                  <p className="text-base text-[#6c4e40] dark:text-orange-200/80 leading-relaxed mb-5 break-words">
                    {step.description}
                  </p>
                </div>

                <div className="p-3.5 bg-orange-50/80 dark:bg-[#2a1b12] border border-orange-200/70 dark:border-orange-900/50 rounded-xl">
                  <div className="flex items-center justify-between font-mono text-[11px] text-orange-950 dark:text-orange-100 mb-2">
                    <span className="font-semibold uppercase tracking-wider text-orange-800 dark:text-amber-400 truncate pr-2">
                      {step.codeHint}
                    </span>
                    <span className="text-orange-700 dark:text-amber-400 font-bold shrink-0">
                      {t.readyStatus}
                    </span>
                  </div>
                  <div className="w-full bg-orange-200/70 dark:bg-orange-950 h-1.5 rounded-full overflow-hidden">
                    <div
                      style={{
                        width: idx === 0 ? '100%' : idx === 1 ? '96%' : '100%',
                      }}
                      className="bg-gradient-to-r from-orange-600 to-amber-500 h-full shadow-[0_0_8px_#ea580c]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. ORIGINAL EDITORIAL CONTENT SECTION (16px base text, comfortable line-height, zero horizontal scroll) */}
      <section
        aria-labelledby="editorial-heading"
        className="w-full py-10 sm:py-14 bg-white/75 dark:bg-[#18110c] border-t border-orange-200/60 dark:border-orange-900/40"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-4">
              <h2
                id="editorial-heading"
                className="font-display text-2xl sm:text-3xl font-bold text-[#1f130b] dark:text-[#fffaf5]"
              >
                {editorial.heading}
              </h2>
              <p className="text-base font-medium text-orange-800 dark:text-amber-400 leading-relaxed">
                {editorial.subheading}
              </p>
              {editorial.paragraphs.map((paragraph, idx) => (
                <p
                  key={idx}
                  className="text-base text-[#6c4e40] dark:text-orange-200/85 leading-relaxed break-words"
                >
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="lg:col-span-5 space-y-5">
              <div className="p-5 sm:p-6 rounded-2xl bg-[#fffaf5] dark:bg-[#1c140e] border border-orange-200/90 dark:border-orange-900/60 shadow-sm">
                <h3 className="font-display text-base sm:text-lg font-bold text-[#1f130b] dark:text-[#fffaf5] mb-3">
                  {editorial.formatsTitle}
                </h3>
                <ul className="space-y-2.5">
                  {editorial.formatsList.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 text-base text-[#6c4e40] dark:text-orange-200/85 leading-relaxed break-words"
                    >
                      <span className="mt-2 w-2 h-2 rounded-full bg-orange-600 dark:bg-amber-400 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-5 rounded-2xl bg-orange-50/80 dark:bg-[#231710] border border-orange-200/80 dark:border-orange-900/50">
                <h3 className="font-display text-base font-bold text-[#1f130b] dark:text-[#fffaf5] mb-1.5">
                  {editorial.limitsTitle}
                </h3>
                <p className="text-base text-[#6c4e40] dark:text-orange-200/80 leading-relaxed break-words">
                  {editorial.limitsText}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ZERO-CLS ADSENSE BANNER HOOK */}
      <AdSlot
        slotId="vidnex-pre-faq-rectangle"
        format="rectangle"
        language={language}
      />

      {/* 4. DEDICATED PLATFORM PAGES DIRECTORY WITH REAL <a href> LINKS */}
      <section className="w-full py-10 sm:py-14 bg-gradient-to-b from-orange-50/50 via-orange-100/30 to-orange-50/50 dark:from-[#1a110b] dark:via-[#140e0a] dark:to-[#1a110b] border-y border-orange-200/60 dark:border-orange-900/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-3">
            <div>
              <span className="font-mono text-[11px] text-orange-700 dark:text-amber-400 tracking-widest uppercase font-bold">
                VIDNEX
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1f130b] dark:text-[#fffaf5] mt-1.5">
                {t.platformsHeading}
              </h2>
            </div>
            <p className="text-base text-[#6c4e40] dark:text-orange-200/80 max-w-md leading-relaxed">
              {t.platformsSubheading}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLATFORM_PAGE_KEYS.map((pKey) => {
              const pInfo = bundle.platforms[pKey];
              const isCurrent = pageKey === pKey;
              const supported = isPlatformSupported(pKey);
              const href = getLocalizedPagePath(language, pKey);

              return (
                <a
                  key={pKey}
                  href={href}
                  onClick={(e) => {
                    if (supported) handlePageSelect(e, pKey);
                  }}
                  className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between group ${
                    !supported
                      ? 'bg-white/60 dark:bg-[#1c140e]/50 border-orange-200/50 dark:border-orange-900/30 opacity-60 pointer-events-none'
                      : isCurrent
                      ? 'bg-white dark:bg-[#231710] border-2 border-orange-500 shadow-orange-glow'
                      : 'bg-white/90 dark:bg-[#1c140e]/90 border-orange-200/80 dark:border-orange-900/60 shadow-card-warm hover:shadow-orange-glow hover:border-orange-400'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="inline-flex items-center gap-2 font-display text-base font-bold text-[#1f130b] dark:text-[#fffaf5]">
                        <span className="text-orange-600 dark:text-amber-400">
                          <PlatformIcon platform={pKey} className="w-4 h-4" />
                        </span>
                        <span>{pInfo.shortLabel}</span>
                      </span>
                      <span className="font-mono text-[10px] font-bold text-orange-700 dark:text-amber-400 uppercase">
                        MP4 HD
                      </span>
                    </div>
                    <h3 className="font-display text-base font-bold text-[#1f130b] dark:text-[#fffaf5] mb-1.5">
                      {pInfo.h1}
                    </h3>
                    <p className="text-sm text-[#6c4e40] dark:text-orange-200/80 line-clamp-2 leading-relaxed mb-4">
                      {pInfo.subtitle}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-orange-100 dark:border-orange-900/40 flex items-center justify-between font-mono text-xs text-orange-900/75 dark:text-orange-200/75">
                    <span>{t.openToolCta}</span>
                    <span className="text-orange-600 dark:text-amber-400 font-bold rtl:rotate-180">
                      →
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. EDITORIAL FAQ ACCORDION (ALL ANSWERS PRESENT IN DOM FOR STATIC SEO) */}
      <section
        aria-labelledby="faq-heading"
        className="w-full py-10 sm:py-14 pb-16 sm:pb-20 bg-[#fffaf5] dark:bg-[#140e0a]"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="mb-8 sm:mb-10">
            <span className="font-mono text-[11px] text-orange-700 dark:text-amber-400 tracking-widest uppercase font-bold">
              {t.knowledgeBase}
            </span>
            <h2
              id="faq-heading"
              className="font-display text-2xl sm:text-3xl font-bold text-[#1f130b] dark:text-[#fffaf5] mt-1.5"
            >
              {t.faqHeading}
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-3">
              {pageContent.faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={faq.question}
                    className="bg-white/95 dark:bg-[#1c140e]/95 rounded-2xl border border-orange-200/90 dark:border-orange-900/60 shadow-sm overflow-hidden transition-all"
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() =>
                        setOpenFaqIndex((prev) => (prev === idx ? null : idx))
                      }
                      className="w-full min-h-[52px] p-4 sm:p-5 text-start flex items-center justify-between gap-4 font-display text-base font-semibold text-[#1f130b] dark:text-[#fffaf5] hover:text-orange-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
                    >
                      <span>{faq.question}</span>
                      <span
                        className={`font-mono text-lg text-orange-600 dark:text-amber-400 shrink-0 transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      >
                        ▾
                      </span>
                    </button>

                    <div
                      className={
                        isOpen
                          ? 'px-4 sm:px-5 pb-5 pt-3 text-base text-[#6c4e40] dark:text-orange-200/80 leading-relaxed border-t border-orange-100 dark:border-orange-900/40 break-words'
                          : 'hidden'
                      }
                    >
                      {faq.answer}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden lg:block lg:col-span-4 lg:sticky lg:top-24">
              <AdSlot
                slotId="vidnex-faq-column-300x600"
                format="column"
                language={language}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};