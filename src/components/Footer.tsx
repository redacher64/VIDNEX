import React from 'react';
import { ALL_TOOL_CONFIGS, ToolSlug } from '../data/seoToolsConfig';
import {
  getLocalizedToolConfig,
  LanguageCode,
} from '../i18n/translations';
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

  const handleToolClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    slug: ToolSlug
  ) => {
    e.preventDefault();
    onSelectTool(slug);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="w-full border-t border-orange-200/70 dark:border-orange-950/60 bg-[#fffaf5] dark:bg-[#140e0a]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        {/* Quiet Internal SEO Tool Links */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
          {ALL_TOOL_CONFIGS.map((rawTool) => {
            const tool = getLocalizedToolConfig(rawTool, language);
            const isActive = activeToolSlug === tool.slug;
            return (
              <a
                key={tool.slug}
                href={`?tool=${tool.slug}`}
                onClick={(e) => handleToolClick(e, tool.slug)}
                className={`transition-colors ${
                  isActive
                    ? 'text-orange-600 font-semibold font-semibold'
                    : 'text-[#6c4e40] dark:text-orange-200/70 hover:text-orange-600 dark:hover:text-orange-400'
                }`}
              >
                {tool.h1}
              </a>
            );
          })}
        </div>

        {/* Bottom Bar: Brand & Legal Modal Links */}
        <div className="pt-4 border-t border-orange-200/60 dark:border-orange-950/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6c4e40] dark:text-orange-200/70">
          <span dir="ltr">© {new Date().getFullYear()} VIDNEX</span>

          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => onOpenLegal('terms')}
              className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            >
              {t.terms}
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal('privacy')}
              className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            >
              {t.privacy}
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal('dmca')}
              className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            >
              {t.dmca}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};