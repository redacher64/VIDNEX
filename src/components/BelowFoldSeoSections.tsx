import React, { useState, useEffect } from 'react';
import { SeoToolConfig, ToolSlug } from '../data/seoToolsConfig';
import { LanguageCode, UI_TRANSLATIONS } from '../i18n/translations';
import { AdSlot } from './AdSlot';

interface BelowFoldSeoSectionsProps {
  activeTool: SeoToolConfig;
  onSelectTool: (slug: ToolSlug) => void;
  language: LanguageCode;
}

export const BelowFoldSeoSections: React.FC<BelowFoldSeoSectionsProps> = ({
  activeTool,
  language,
}) => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const t = UI_TRANSLATIONS[language].sections;

  useEffect(() => {
    setOpenFaqIndex(0);
  }, [activeTool.slug, language]);

  return (
    <div className="w-full">
      {/* 1. CLEAN 3-COLUMN "HOW IT WORKS" ROW */}
      <section aria-labelledby="howto-heading" className="w-full py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 id="howto-heading" className="sr-only">
            {t.howToHeading}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center sm:text-start">
            {activeTool.howToSteps.map((step, idx) => (
              <div key={step.number} className="space-y-2">
                <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/95 dark:bg-[#1c140e] border border-orange-200/80 dark:border-orange-950/60 text-xs font-semibold text-[#1f130b] dark:text-[#fffaf5]">
                  {idx + 1}
                </div>
                <h3 className="font-display text-sm font-semibold text-[#1f130b] dark:text-[#fffaf5]">
                  {step.title}
                </h3>
                <p className="text-xs text-[#6c4e40] dark:text-orange-200/70 leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DORMANT ZERO-CLS ADSENSE HOOK */}
      <AdSlot slotId="vidnex-pre-faq-rectangle" format="rectangle" />

      {/* 2. MINIMAL, CLEAN FAQ ACCORDION */}
      <section aria-labelledby="faq-heading" className="w-full py-12 pb-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h2
            id="faq-heading"
            className="font-display text-xl font-bold text-center text-[#1f130b] dark:text-[#fffaf5] mb-6"
          >
            {t.faqHeading}
          </h2>

          <div className="rounded-2xl border border-orange-200/80 dark:border-orange-950/60 bg-white/95 dark:bg-[#1c140e] divide-y divide-slate-200 dark:divide-zinc-800 overflow-hidden">
            {activeTool.faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={faq.question}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() =>
                      setOpenFaqIndex((prev) => (prev === idx ? null : idx))
                    }
                    className="w-full px-5 py-4 text-start flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <span className="text-sm font-medium text-[#1f130b] dark:text-[#fffaf5]">
                      {faq.question}
                    </span>
                    <span className="text-base text-slate-400 dark:text-zinc-500 shrink-0">
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-4 text-xs sm:text-sm text-[#6c4e40] dark:text-orange-200/70 leading-relaxed">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};