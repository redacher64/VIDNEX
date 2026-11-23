import React, { useState } from 'react';
import {
  getLocalizedPagePath,
  type PageKey,
  type PlatformPageKey,
  type SupportedLocale,
} from '../i18n/config.ts';
import { getLocaleBundleSync } from '../i18n/localeLoader.ts';
import {
  getLocalizedRegisteredTools,
  getToolsHubContent,
  type RegisteredToolCategory,
} from '../data/toolsRegistry.ts';
import { PlatformIcon } from './icons/PlatformIcons.tsx';
import { AdSlot } from './AdSlot.tsx';

interface ToolsHubViewProps {
  locale: SupportedLocale;
  onNavigatePage: (page: PageKey) => void;
}

type FilterOption = 'all' | RegisteredToolCategory;

export const ToolsHubView: React.FC<ToolsHubViewProps> = ({
  locale,
  onNavigatePage,
}) => {
  const hub = getToolsHubContent(locale);
  const bundle = getLocaleBundleSync(locale);
  const allTools = getLocalizedRegisteredTools(locale);
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');

  const homeHref = getLocalizedPagePath(locale, 'home');

  const filteredTools =
    activeFilter === 'all'
      ? allTools
      : allTools.filter((t) => t.entry.category === activeFilter);

  const browserTools = filteredTools.filter(
    (t) => t.entry.executionMode === 'browser_local'
  );
  const downloaderTools = filteredTools.filter(
    (t) => t.entry.executionMode === 'public_resolver'
  );

  const handleOpenTool = (
    e: React.MouseEvent<HTMLAnchorElement>,
    pageKey: PageKey
  ) => {
    e.preventDefault();
    onNavigatePage(pageKey);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="w-full">
      {/* Top AdSlot (above the hub, never overlapping cards or buttons) */}
      <div className="max-w-6xl mx-auto px-4 pt-3">
        <AdSlot
          slotId="vidnex-tools-hub-top-mobile"
          format="mobile-banner"
          language={locale}
        />
        <AdSlot
          slotId="vidnex-tools-hub-top-leaderboard"
          format="leaderboard"
          language={locale}
          hideOnMobile={true}
        />
      </div>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-14">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-xs font-mono text-[#7c4a2d] dark:text-[#d6b8a3] mb-4"
        >
          <a
            href={homeHref}
            onClick={(e) => handleOpenTool(e, 'home')}
            className="hover:text-[#c2410c] dark:hover:text-[#fb923c] transition-colors"
          >
            {bundle.ui.sections.breadcrumbHome}
          </a>
          <span aria-hidden="true">/</span>
          <span className="text-[#c2410c] dark:text-[#fb923c] font-semibold">
            {hub.breadcrumbLabel}
          </span>
        </nav>

        {/* Hub Hero */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/25 text-[#c2410c] dark:text-[#fb923c] font-mono text-[11px] font-bold tracking-wide mb-3">
            <span>{hub.badgeText}</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1f130b] dark:text-[#fffaf5] mb-2">
            {hub.h1}
          </h1>
          <p className="text-sm sm:text-base text-[#6e472b] dark:text-[#d6b8a3] max-w-3xl leading-relaxed">
            {hub.subtitle}
          </p>
        </div>

        {/* Category Filters */}
        <div
          role="tablist"
          aria-label={hub.breadcrumbLabel}
          className="flex flex-wrap gap-2 mb-8"
        >
          {(
            [
              { id: 'all', label: hub.filterAll },
              { id: 'video', label: hub.filterVideo },
              { id: 'image', label: hub.filterImage },
              { id: 'downloader', label: hub.filterDownloader },
            ] as const
          ).map((f) => {
            const selected = activeFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={selected}
                data-testid={`tools-filter-${f.id}`}
                onClick={() => setActiveFilter(f.id)}
                className={`px-4 py-2 rounded-xl font-mono text-xs font-bold border transition-all cursor-pointer ${
                  selected
                    ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white border-orange-600 shadow-sm'
                    : 'bg-white/90 dark:bg-[#1d140e]/90 border-orange-200/80 dark:border-orange-900/60 text-[#6e472b] dark:text-[#d6b8a3] hover:border-orange-400'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* 100% Browser-Local Creator Tools */}
        {browserTools.length > 0 && (
          <div className="mb-12">
            <div className="mb-5">
              <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#1f130b] dark:text-[#fffaf5]">
                {hub.browserToolsHeading}
              </h2>
              <p className="text-xs sm:text-sm text-[#6e472b] dark:text-[#d6b8a3] mt-1">
                {hub.browserToolsSubheading}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {browserTools.map((tool) => (
                <a
                  key={tool.entry.id}
                  href={tool.href}
                  data-testid={`hub-tool-${tool.entry.id}`}
                  onClick={(e) => handleOpenTool(e, tool.entry.pageKey)}
                  className="p-6 rounded-2xl bg-white/95 dark:bg-[#1d140e]/95 border border-orange-200/90 dark:border-orange-900/60 hover:border-orange-500 shadow-sm transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-bold">
                        {hub.localBadge}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {tool.entry.badges.map((b) => (
                          <span
                            key={b}
                            className="px-2 py-0.5 rounded-md bg-orange-500/10 text-[#c2410c] dark:text-[#fb923c] font-mono text-[10px] font-bold"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>

                    <h3 className="font-display text-lg sm:text-xl font-extrabold text-[#1f130b] dark:text-[#fffaf5] group-hover:text-orange-600 dark:group-hover:text-amber-400 transition-colors mb-2">
                      {tool.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#6e472b] dark:text-[#d6b8a3] leading-relaxed">
                      {tool.description}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-orange-100 dark:border-orange-900/40 flex items-center justify-between font-mono text-xs font-bold text-[#c2410c] dark:text-[#fb923c]">
                    <span>{hub.openToolCta}</span>
                    <span aria-hidden="true" className="rtl:rotate-180">
                      →
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Public Social Media Downloaders */}
        {downloaderTools.length > 0 && (
          <div className="mb-10">
            <div className="mb-5">
              <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#1f130b] dark:text-[#fffaf5]">
                {hub.downloadersHeading}
              </h2>
              <p className="text-xs sm:text-sm text-[#6e472b] dark:text-[#d6b8a3] mt-1">
                {hub.downloadersSubheading}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {downloaderTools.map((tool) => (
                <a
                  key={tool.entry.id}
                  href={tool.href}
                  data-testid={`hub-tool-${tool.entry.id}`}
                  onClick={(e) => handleOpenTool(e, tool.entry.pageKey)}
                  className="p-5 rounded-2xl bg-white/95 dark:bg-[#1d140e]/95 border border-orange-200/80 dark:border-orange-900/60 hover:border-orange-500 shadow-sm transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-[#c2410c] dark:text-[#fb923c]">
                        <PlatformIcon
                          platform={tool.entry.id as PlatformPageKey}
                          className="w-4 h-4"
                        />
                        <span>{tool.shortLabel}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-orange-500/10 text-[#7c4a2d] dark:text-[#d6b8a3] font-mono text-[10px] font-semibold">
                        {hub.publicBadge}
                      </span>
                    </div>

                    <h3 className="font-display text-base font-bold text-[#1f130b] dark:text-[#fffaf5] group-hover:text-orange-600 dark:group-hover:text-amber-400 transition-colors mb-1.5">
                      {tool.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#6e472b] dark:text-[#d6b8a3] leading-relaxed line-clamp-2">
                      {tool.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-2.5 border-t border-orange-100 dark:border-orange-900/40 flex items-center justify-between font-mono text-xs font-bold text-[#c2410c] dark:text-[#fb923c]">
                    <span>{hub.openToolCta}</span>
                    <span aria-hidden="true" className="rtl:rotate-180">
                      →
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Bottom AdSlot */}
        <div className="mt-10">
          <AdSlot
            slotId="vidnex-tools-hub-bottom-native"
            format="native"
            language={locale}
          />
        </div>
      </section>
    </div>
  );
};
