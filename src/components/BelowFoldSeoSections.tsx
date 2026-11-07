import React, { useState, useEffect } from 'react';
import {
  ALL_TOOL_CONFIGS,
  SeoToolConfig,
  ToolSlug,
} from '../data/seoToolsConfig';
import {
  getLocalizedToolConfig,
  LanguageCode,
  UI_TRANSLATIONS,
} from '../i18n/translations';
import { isPlatformSupported } from '../utils/urlDetector';
import { AdSlot } from './AdSlot';
import { PlatformIcon } from './icons/PlatformIcons';

const SOON_BADGE_BY_LANG: Record<LanguageCode, string> = {
  en: 'Soon',
  fr: 'Bientôt',
  es: 'Pronto',
  pt: 'Em breve',
  ar: 'قريباً',
};

interface BelowFoldSeoSectionsProps {
  activeTool: SeoToolConfig;
  onSelectTool: (slug: ToolSlug) => void;
  language: LanguageCode;
}

export const BelowFoldSeoSections: React.FC<BelowFoldSeoSectionsProps> = ({
  activeTool,
  onSelectTool,
  language,
}) => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const t = UI_TRANSLATIONS[language].sections;
  const soonBadge = SOON_BADGE_BY_LANG[language] || 'Soon';

  useEffect(() => {
    setOpenFaqIndex(0);
  }, [activeTool.slug, language]);

  const handleToolSelect = (slug: ToolSlug) => {
    onSelectTool(slug);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="w-full">
      {/* 1. LIVE PIPELINE TELEMETRY / SPECS RIBBON */}
      <section className="w-full bg-gradient-to-r from-orange-50 via-white to-amber-50/60 dark:from-[#1c140e] dark:via-[#140e0a] dark:to-[#1c140e] border-b border-orange-200/60 dark:border-orange-900/40 shadow-sm py-5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
          {t.bentoCards.map((card, idx) => (
            <div
              key={card.id}
              className="flex items-center gap-3.5 p-3 rounded-2xl bg-orange-100/40 dark:bg-[#231710]/90 border border-orange-200/60 dark:border-orange-900/50"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center shrink-0 shadow-orange-sm font-mono text-xs font-bold">
                0{idx + 1}
              </div>
              <div className="min-w-0">
                <div className="font-mono text-[11px] text-orange-800/80 dark:text-amber-400/90 font-semibold uppercase tracking-wider">
                  {card.metric}
                </div>
                <div className="font-display text-[13px] leading-snug text-[#1f130b] dark:text-[#fffaf5] font-bold">
                  {card.title}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. 3-COLUMN HOW IT WORKS BENTO GRID */}
      <section
        aria-labelledby="howto-heading"
        className="w-full py-16 bg-[#fffaf5] dark:bg-[#140e0a]"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
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
            <p className="text-sm text-[#6c4e40] dark:text-orange-200/75 max-w-md leading-relaxed">
              {activeTool.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {activeTool.howToSteps.map((step, idx) => (
              <div
                key={step.number}
                className="bg-white/90 dark:bg-[#1c140e]/90 backdrop-blur-md p-6 rounded-2xl border border-orange-200/90 dark:border-orange-900/60 shadow-card-warm flex flex-col justify-between hover:shadow-orange-glow hover:border-orange-400 transition-all duration-300 group"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <span className="font-mono text-xs font-bold text-white px-3 py-1 bg-gradient-to-r from-orange-600 to-amber-600 rounded-lg shadow-sm">
                      {t.stepOf} {step.number}
                    </span>
                    <span className="font-mono text-xs text-orange-600 dark:text-amber-400 font-semibold">
                      0{idx + 1} / 03
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-[#1f130b] dark:text-[#fffaf5] mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-[#6c4e40] dark:text-orange-200/75 leading-relaxed mb-6">
                    {step.description}
                  </p>
                </div>

                <div className="p-3.5 bg-orange-50/80 dark:bg-[#2a1b12] border border-orange-200/70 dark:border-orange-900/50 rounded-xl">
                  <div className="flex items-center justify-between font-mono text-[11px] text-orange-950 dark:text-orange-100 mb-2">
                    <span className="font-semibold uppercase tracking-wider text-orange-800 dark:text-amber-400 truncate pr-2">
                      {step.codeHint}
                    </span>
                    <span className="text-orange-600 dark:text-amber-400 font-bold shrink-0">
                      {t.readyStatus}
                    </span>
                  </div>
                  <div className="w-full bg-orange-200/70 dark:bg-orange-950 h-1.5 rounded-full overflow-hidden">
                    <div
                      style={{ width: idx === 0 ? '100%' : idx === 1 ? '96%' : '100%' }}
                      className="bg-gradient-to-r from-orange-600 to-amber-500 h-full shadow-[0_0_8px_#ea580c]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DORMANT ZERO-CLS ADSENSE HOOK */}
      <AdSlot slotId="vidnex-pre-faq-rectangle" format="rectangle" />

      {/* 3. PLATFORM COMPATIBILITY & DEDICATED TOOLS MATRIX */}
      <section className="w-full py-16 bg-gradient-to-b from-orange-50/50 via-orange-100/30 to-orange-50/50 dark:from-[#1a110b] dark:via-[#140e0a] dark:to-[#1a110b] border-y border-orange-200/60 dark:border-orange-900/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
            <div>
              <span className="font-mono text-[11px] text-orange-700 dark:text-amber-400 tracking-widest uppercase font-bold">
                {t.losslessPipeline}
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1f130b] dark:text-[#fffaf5] mt-1.5">
                {t.techMatrixHeading}
              </h2>
            </div>
            <span className="font-mono text-xs text-orange-900 dark:text-orange-200 font-semibold">
              {t.specializedEndpoints}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ALL_TOOL_CONFIGS.map((rawTool) => {
              const tool = getLocalizedToolConfig(rawTool, language);
              const isCurrent = tool.slug === activeTool.slug;
              const supported = isPlatformSupported(tool.platform);
              return (
                <button
                  key={tool.slug}
                  type="button"
                  disabled={!supported}
                  onClick={() => {
                    if (supported) handleToolSelect(tool.slug);
                  }}
                  className={`p-5 text-left rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                    !supported
                      ? 'bg-white/60 dark:bg-[#1c140e]/50 border-orange-200/50 dark:border-orange-900/30 opacity-60 cursor-not-allowed'
                      : isCurrent
                      ? 'bg-white dark:bg-[#231710] border-2 border-orange-500 shadow-orange-glow'
                      : 'bg-white/90 dark:bg-[#1c140e]/90 border-orange-200/80 dark:border-orange-900/60 shadow-card-warm hover:shadow-orange-glow hover:border-orange-400'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="inline-flex items-center gap-2 font-display text-base font-bold text-[#1f130b] dark:text-[#fffaf5]">
                        <span className="text-orange-600 dark:text-amber-400">
                          <PlatformIcon
                            platform={tool.platform}
                            className="w-4 h-4"
                          />
                        </span>
                        <span>{tool.shortLabel}</span>
                      </span>
                      {supported ? (
                        <span className="font-mono text-[10px] font-bold text-orange-700 dark:text-amber-400 uppercase">
                          {tool.specs[0]}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950 font-mono text-[10px] font-bold text-orange-800 dark:text-amber-400 uppercase">
                          {soonBadge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#6c4e40] dark:text-orange-200/75 line-clamp-2 leading-relaxed mb-4">
                      {tool.subtitle}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-orange-100 dark:border-orange-900/40 flex items-center justify-between font-mono text-[11px] text-orange-900/75 dark:text-orange-200/75">
                    <span>{tool.specs[1]}</span>
                    <span className="text-orange-600 dark:text-amber-400 font-bold">
                      {supported ? '→' : soonBadge}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. EDITORIAL FAQ ACCORDION */}
      <section
        aria-labelledby="faq-heading"
        className="w-full py-16 pb-20 bg-[#fffaf5] dark:bg-[#140e0a]"
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
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

          <div className="space-y-3">
            {activeTool.faqs.map((faq, idx) => {
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
                    className="w-full p-5 text-left flex items-center justify-between gap-4 font-display text-base font-semibold text-[#1f130b] dark:text-[#fffaf5] hover:text-orange-600 dark:hover:text-amber-400 transition-colors"
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

                  {isOpen && (
                    <div className="px-5 pb-5 pt-3 text-sm text-[#6c4e40] dark:text-orange-200/75 leading-relaxed border-t border-orange-100 dark:border-orange-900/40">
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