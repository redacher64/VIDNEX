import React from 'react';
import {
  getBlogNavLabel,
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
import {
  BLOG_HUB_LOCALES,
  getBlogHomePath,
  getPublishedArticleBySlug,
  getPublishedArticleTranslations,
  isBlogHubLocale,
  type BlogLocale,
} from '../data/blogArticles.ts';
import { getLocaleBundleSync } from '../i18n/localeLoader.ts';
import { getSplitImageContent } from '../utils/splitImageLogic.ts';
import { getVideoToMp3Content } from '../utils/videoToMp3Logic.ts';
import { getToolsHubContent } from '../data/toolsRegistry.ts';
import {
  getCookieConsentCopy,
  openCookiePreferences,
} from '../utils/cookieConsent.ts';
import { PlatformIcon, VidnexLogoMark } from './icons/PlatformIcons.tsx';

interface FooterProps {
  activePageKey: PageKey | 'blog_article' | 'not_found';
  blogSlug?: string | null;
  onNavigatePage: (pageKey: PageKey) => void;
  language: SupportedLocale;
  onSelectLanguage: (lang: SupportedLocale) => void;
}

export const Footer: React.FC<FooterProps> = ({
  activePageKey,
  blogSlug,
  onNavigatePage,
  language,
  onSelectLanguage,
}) => {
  const bundle = getLocaleBundleSync(language);
  const f = bundle.ui.footer;
  const splitCopy = getSplitImageContent(language);
  const videoToMp3Copy = getVideoToMp3Content(language);
  const toolsHubCopy = getToolsHubContent(language);

  const pageForLangSwitch: PageKey =
    activePageKey === 'not_found'
      ? 'home'
      : activePageKey === 'blog_article'
      ? 'blog'
      : activePageKey;

  const availableLanguageOptions: Array<{
    code: SupportedLocale;
    href: string;
  }> = (() => {
    if (activePageKey === 'blog') {
      return BLOG_HUB_LOCALES.map((loc) => ({
        code: loc,
        href: getBlogHomePath(loc),
      }));
    }
    if (activePageKey === 'blog_article') {
      const blogLoc: BlogLocale = isBlogHubLocale(language) ? language : 'en';
      const resolved = blogSlug
        ? getPublishedArticleBySlug(blogLoc, blogSlug)
        : null;
      const translations = resolved
        ? getPublishedArticleTranslations(resolved.article.id)
        : [];
      if (translations.length > 0) {
        return translations.map((item) => ({
          code: item.locale,
          href: item.canonicalPath,
        }));
      }
      return BLOG_HUB_LOCALES.map((loc) => ({
        code: loc,
        href: getBlogHomePath(loc),
      }));
    }
    return SUPPORTED_LOCALES.map((code) => ({
      code,
      href: getLocalizedPagePath(code, pageForLangSwitch),
    }));
  })();

  const homeHref = getLocalizedPagePath(language, 'home');
  const toolsHubHref = getLocalizedPagePath(language, 'tools_hub');
  const isToolsHubActive = activePageKey === 'tools_hub';
  const videoToMp3Href = getLocalizedPagePath(language, 'video_to_mp3');
  const isVideoToMp3Active = activePageKey === 'video_to_mp3';
  const splitImageHref = getLocalizedPagePath(language, 'split_image');
  const isSplitImageActive = activePageKey === 'split_image';
  const blogHref = getLocalizedPagePath(language, 'blog');
  const isBlogActive =
    activePageKey === 'blog' || activePageKey === 'blog_article';

  const handlePageClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    target: PageKey
  ) => {
    e.preventDefault();
    onNavigatePage(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleScrollTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="relative z-10 w-full border-t border-orange-200/80 dark:border-orange-900/50 bg-gradient-to-b from-[#fffaf5] to-orange-50/40 dark:from-[#140e0a] dark:to-[#0f0a07] shadow-[0_-4px_24px_rgba(234,88,12,0.04)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-7 sm:py-10 space-y-7">
        {/* Top Brand & Specs Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-orange-200/60 dark:border-orange-900/40">
          <a
            href={homeHref}
            dir="ltr"
            onClick={(e) => handlePageClick(e, 'home')}
            className="min-h-[44px] inline-flex items-center gap-2.5 group focus:outline-none w-fit"
          >
            <VidnexLogoMark className="w-7 h-7 rounded-lg transition-transform duration-150 group-hover:scale-95" />
            <span className="font-display font-bold text-base tracking-tight text-[#1f130b] dark:text-[#fffaf5]">
              VIDNEX
            </span>
          </a>

          <p className="font-mono text-xs text-[#6c4e40] dark:text-orange-200/70 tracking-wide">
            {bundle.home.specs.map((s) => s.trim()).join(' · ')}
          </p>
        </div>

        {/* Main 3-Zone Responsive Grid: 2 columns side-by-side on mobile for Platforms & Legal, full 12-col on desktop */}
        <div className="grid grid-cols-2 md:grid-cols-12 gap-6 sm:gap-8 text-sm">
          {/* 1. Dedicated Platform Pages (Col 1 on mobile, 4 cols on desktop) */}
          <div className="col-span-1 md:col-span-4">
            <h2 className="font-display text-xs font-bold uppercase tracking-wider text-orange-800 dark:text-amber-400 mb-3">
              {f.platformsTitle}
            </h2>
            <ul className="space-y-1.5">
              {PLATFORM_PAGE_KEYS.map((pKey: PlatformPageKey) => {
                const pData = bundle.platforms[pKey];
                const href = getLocalizedPagePath(language, pKey);
                const isActive = activePageKey === pKey;
                return (
                  <li key={pKey}>
                    <a
                      href={href}
                      title={pData.h1}
                      onClick={(e) => handlePageClick(e, pKey)}
                      className={`min-h-[40px] inline-flex items-center gap-2 py-1 transition-colors ${
                        isActive
                          ? 'text-orange-600 dark:text-amber-400 font-bold'
                          : 'text-[#6c4e40] dark:text-orange-200/80 hover:text-orange-600 dark:hover:text-amber-400 font-medium'
                      }`}
                    >
                      <PlatformIcon
                        platform={pKey}
                        className="w-4 h-4 shrink-0 text-orange-600/80 dark:text-amber-400/80"
                      />
                      <span>{pData.shortLabel}</span>
                    </a>
                  </li>
                );
              })}
              <li>
                <a
                  href={toolsHubHref}
                  title={toolsHubCopy.h1}
                  data-testid="footer-tools-hub"
                  onClick={(e) => handlePageClick(e, 'tools_hub')}
                  className={`min-h-[40px] inline-flex items-center gap-2 py-1 transition-colors ${
                    isToolsHubActive
                      ? 'text-orange-600 dark:text-amber-400 font-bold'
                      : 'text-[#6c4e40] dark:text-orange-200/80 hover:text-orange-600 dark:hover:text-amber-400 font-medium'
                  }`}
                >
                  <span>{toolsHubCopy.allToolsLinkLabel}</span>
                </a>
              </li>
              <li>
                <a
                  href={videoToMp3Href}
                  title={videoToMp3Copy.h1}
                  data-testid="footer-video-to-mp3"
                  onClick={(e) => handlePageClick(e, 'video_to_mp3')}
                  className={`min-h-[40px] inline-flex items-center gap-2 py-1 transition-colors ${
                    isVideoToMp3Active
                      ? 'text-orange-600 dark:text-amber-400 font-bold'
                      : 'text-[#6c4e40] dark:text-orange-200/80 hover:text-orange-600 dark:hover:text-amber-400 font-medium'
                  }`}
                >
                  <span>{videoToMp3Copy.navLabel}</span>
                </a>
              </li>
              <li>
                <a
                  href={splitImageHref}
                  title={splitCopy.h1}
                  data-testid="footer-split-image"
                  onClick={(e) => handlePageClick(e, 'split_image')}
                  className={`min-h-[40px] inline-flex items-center gap-2 py-1 transition-colors ${
                    isSplitImageActive
                      ? 'text-orange-600 dark:text-amber-400 font-bold'
                      : 'text-[#6c4e40] dark:text-orange-200/80 hover:text-orange-600 dark:hover:text-amber-400 font-medium'
                  }`}
                >
                  <span>{splitCopy.navLabel} — {splitCopy.breadcrumbLabel}</span>
                </a>
              </li>
            </ul>
          </div>

          {/* 2. Legal, Editorial Blog & Trust Pages (Col 2 on mobile, 3 cols on desktop) */}
          <div className="col-span-1 md:col-span-3">
            <h2 className="font-display text-xs font-bold uppercase tracking-wider text-orange-800 dark:text-amber-400 mb-3">
              {f.legalTitle}
            </h2>
            <ul className="space-y-1.5" data-footer-legal="true">
              <li>
                <a
                  href={blogHref}
                  onClick={(e) => handlePageClick(e, 'blog')}
                  className={`min-h-[40px] inline-flex items-center py-1 transition-colors ${
                    isBlogActive
                      ? 'text-orange-600 dark:text-amber-400 font-bold'
                      : 'text-[#6c4e40] dark:text-orange-200/80 hover:text-orange-600 dark:hover:text-amber-400 font-medium'
                  }`}
                >
                  {getBlogNavLabel(language)}
                </a>
              </li>
              {LEGAL_PAGE_KEYS.map((lKey: LegalPageKey) => {
                const href = getLocalizedPagePath(language, lKey);
                const isActive = activePageKey === lKey;
                return (
                  <li key={lKey}>
                    <a
                      href={href}
                      onClick={(e) => handlePageClick(e, lKey)}
                      className={`min-h-[40px] inline-flex items-center py-1 transition-colors ${
                        isActive
                          ? 'text-orange-600 dark:text-amber-400 font-bold'
                          : 'text-[#6c4e40] dark:text-orange-200/80 hover:text-orange-600 dark:hover:text-amber-400 font-medium'
                      }`}
                    >
                      {f[lKey]}
                    </a>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  data-testid="footer-cookies-btn"
                  onClick={() => openCookiePreferences()}
                  className="min-h-[40px] inline-flex items-center py-1 transition-colors text-[#6c4e40] dark:text-orange-200/80 hover:text-orange-600 dark:hover:text-amber-400 font-medium cursor-pointer"
                >
                  {getCookieConsentCopy(language).footerLinkLabel}
                </button>
              </li>
            </ul>
          </div>

          {/* 3. All 10 Languages in a structured 2-col mobile / 2-col desktop grid (Full width on mobile, 5 cols on desktop) */}
          <div className="col-span-2 md:col-span-5 pt-2 md:pt-0 border-t md:border-t-0 border-orange-200/50 dark:border-orange-900/40">
            <h2 className="font-display text-xs font-bold uppercase tracking-wider text-orange-800 dark:text-amber-400 mb-3">
              {f.languagesTitle}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-2">
              {availableLanguageOptions.map(({ code, href }) => {
                const meta = LOCALES_CONFIG[code];
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
                    className={`min-h-[44px] px-3 py-2 rounded-xl border flex items-center justify-between gap-1.5 text-xs transition-colors ${
                      isCurrent
                        ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white border-orange-600 font-bold shadow-sm'
                        : 'bg-white/90 dark:bg-[#1c140e] border-orange-200/80 dark:border-orange-900/60 text-[#6c4e40] dark:text-orange-200/80 hover:border-orange-400 hover:text-orange-600 font-medium'
                    }`}
                  >
                    <span className="truncate">{meta.nativeName}</span>
                    <span
                      dir="ltr"
                      className={`font-mono text-[10px] shrink-0 ${
                        isCurrent
                          ? 'text-white/90'
                          : 'text-orange-700/70 dark:text-amber-400/70'
                      }`}
                    >
                      {meta.shortLabel}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Copyright & Back-to-Top Bar */}
        <div className="pt-4 border-t border-orange-200/60 dark:border-orange-900/40 flex items-center justify-between gap-4 text-xs text-[#6c4e40] dark:text-orange-200/70">
          <span className="font-medium leading-relaxed">
            {f.copyrightNotice}
          </span>
          <button
            type="button"
            onClick={handleScrollTop}
            aria-label="Back to top"
            className="shrink-0 w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-orange-100/70 dark:bg-[#231710] border border-orange-200/80 dark:border-orange-900/60 text-orange-700 dark:text-amber-400 hover:bg-orange-600 hover:text-white dark:hover:bg-orange-600 transition-colors flex items-center justify-center cursor-pointer font-mono text-sm font-bold"
          >
            ↑
          </button>
        </div>
      </div>
    </footer>
  );
};