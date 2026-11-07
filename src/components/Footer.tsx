import React from 'react';
import { ALL_TOOL_CONFIGS, ToolSlug } from '../data/seoToolsConfig';
import {
  getLocalizedToolConfig,
  LanguageCode,
} from '../i18n/translations';
import { isPlatformSupported } from '../utils/urlDetector';
import { LegalDocType } from './LegalModal';

interface FooterProps {
  activeToolSlug: ToolSlug;
  onSelectTool: (slug: ToolSlug) => void;
  onOpenLegal: (doc: LegalDocType) => void;
  language: LanguageCode;
}

const LEGAL_LABELS: Record<
  LanguageCode,
  { terms: string; privacy: string; dmca: string }
> = {
  en: { terms: 'Terms', privacy: 'Privacy', dmca: 'DMCA' },
  fr: { terms: 'Conditions', privacy: 'Confidentialité', dmca: 'DMCA' },
  es: { terms: 'Términos', privacy: 'Privacidad', dmca: 'DMCA' },
  pt: { terms: 'Termos', privacy: 'Privacidade', dmca: 'DMCA' },
  ar: { terms: 'الشروط', privacy: 'الخصوصية', dmca: 'حقوق النشر' },
};

export const Footer: React.FC<FooterProps> = ({
  activeToolSlug,
  onSelectTool,
  onOpenLegal,
  language,
}) => {
  const t = LEGAL_LABELS[language] || LEGAL_LABELS.en;
  const supportedTools = ALL_TOOL_CONFIGS.filter((tool) =>
    isPlatformSupported(tool.platform)
  );

  const handleToolClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    slug: ToolSlug
  ) => {
    e.preventDefault();
    onSelectTool(slug);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="relative z-10 w-full border-t border-orange-200/80 dark:border-orange-900/50 bg-[#fffaf5] dark:bg-[#140e0a] shadow-[0_-4px_20px_rgba(234,88,12,0.03)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        {/* Quiet Internal SEO Tool Links (Active Platforms Only) */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 text-xs">
          {supportedTools.map((rawTool) => {
            const tool = getLocalizedToolConfig(rawTool, language);
            const isActive = activeToolSlug === tool.slug;
            return (
              <a
                key={tool.slug}
                href={`?tool=${tool.slug}`}
                onClick={(e) => handleToolClick(e, tool.slug)}
                className={`transition-colors ${
                  isActive
                    ? 'text-orange-600 dark:text-amber-400 font-bold'
                    : 'text-[#6c4e40] dark:text-orange-200/70 hover:text-orange-600 dark:hover:text-amber-400 font-medium'
                }`}
              >
                {tool.h1}
              </a>
            );
          })}
        </div>

        {/* Bottom Bar: Brand & Legal Modal Links */}
        <div className="pt-5 border-t border-orange-200/60 dark:border-orange-900/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6c4e40] dark:text-orange-200/70">
          <span dir="ltr" className="font-medium">
            © {new Date().getFullYear()} VIDNEX — Universal Public Media Resolver
          </span>

          <div className="flex items-center gap-5 font-medium">
            <button
              type="button"
              onClick={() => onOpenLegal('terms')}
              className="hover:text-orange-600 dark:hover:text-amber-400 transition-colors"
            >
              {t.terms}
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal('privacy')}
              className="hover:text-orange-600 dark:hover:text-amber-400 transition-colors"
            >
              {t.privacy}
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal('dmca')}
              className="hover:text-orange-600 dark:hover:text-amber-400 transition-colors"
            >
              {t.dmca}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};