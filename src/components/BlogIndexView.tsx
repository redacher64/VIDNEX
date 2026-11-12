import React, { useState, useMemo, useEffect } from 'react';
import {
  BLOG_CATEGORY_KEYS,
  BLOG_HUB_LOCALES,
  BLOG_HUB_SEO,
  type BlogCategoryKey,
  type BlogLocale,
  getBlogHomePath,
  getBlogUiLabels,
  getPublishedArticlesForLocale,
  isBlogHubLocale,
} from '../data/blogArticles.ts';
import {
  getLocalizedPagePath,
  LOCALES_CONFIG,
  PLATFORM_PAGE_KEYS,
  type PageKey,
  type SupportedLocale,
} from '../i18n/config.ts';
import { getLocaleBundleSync } from '../i18n/localeLoader.ts';
import {
  trackBlogCategoryFilter,
  trackBlogHubView,
  trackBlogLanguageSwitch,
  trackBlogSearchQuery,
} from '../utils/blogAnalytics.ts';
import { BlogDiagramIllustration } from './BlogDiagramIllustration.tsx';
import { PlatformIcon } from './icons/PlatformIcons.tsx';

interface BlogIndexViewProps {
  locale: SupportedLocale;
  onNavigatePath: (path: string) => void;
  onNavigatePage: (pageKey: PageKey) => void;
}

const INITIAL_VISIBLE_COUNT = 6;

export const BlogIndexView: React.FC<BlogIndexViewProps> = ({
  locale,
  onNavigatePath,
  onNavigatePage,
}) => {
  const blogLocale: BlogLocale = isBlogHubLocale(locale) ? locale : 'en';
  const ui = getBlogUiLabels(blogLocale);
  const hubSeo = BLOG_HUB_SEO[blogLocale];
  const bundle = getLocaleBundleSync(blogLocale);

  const [selectedCategory, setSelectedCategory] = useState<
    BlogCategoryKey | 'all'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);

  const allArticles = useMemo(
    () => getPublishedArticlesForLocale(blogLocale),
    [blogLocale]
  );

  useEffect(() => {
    trackBlogHubView(blogLocale);
  }, [blogLocale]);

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allArticles.filter((item) => {
      if (
        selectedCategory !== 'all' &&
        item.article.category !== selectedCategory
      ) {
        return false;
      }
      if (!q) return true;
      const inTitle = item.translation.title.toLowerCase().includes(q);
      const inExcerpt = item.translation.excerpt.toLowerCase().includes(q);
      const inPrimaryKw = item.translation.primaryKeyword
        .toLowerCase()
        .includes(q);
      const inSecondaryKw = item.translation.secondaryKeywords.some((kw) =>
        kw.toLowerCase().includes(q)
      );
      return inTitle || inExcerpt || inPrimaryKw || inSecondaryKw;
    });
  }, [allArticles, selectedCategory, searchQuery]);

  const featuredEntry = useMemo(() => {
    if (selectedCategory !== 'all' || searchQuery.trim().length > 0) {
      return null;
    }
    return (
      allArticles.find((item) => item.article.featured) ||
      allArticles[0] ||
      null
    );
  }, [allArticles, selectedCategory, searchQuery]);

  const gridArticles = useMemo(() => {
    if (!featuredEntry) return filteredArticles;
    return filteredArticles.filter(
      (item) => item.article.id !== featuredEntry.article.id
    );
  }, [filteredArticles, featuredEntry]);

  const homeHref = getLocalizedPagePath(blogLocale, 'home');

  const handleArticleLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    path: string
  ) => {
    e.preventDefault();
    onNavigatePath(path);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCategoryChange = (cat: BlogCategoryKey | 'all') => {
    setSelectedCategory(cat);
    setVisibleCount(INITIAL_VISIBLE_COUNT);
    trackBlogCategoryFilter(blogLocale, cat);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setVisibleCount(INITIAL_VISIBLE_COUNT);
    if (val.trim().length >= 3) {
      trackBlogSearchQuery(blogLocale, val);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center justify-between flex-wrap gap-3 text-xs font-mono text-[#6c4e40] dark:text-orange-200/75"
      >
        <ol className="flex items-center gap-2">
          <li>
            <a
              href={homeHref}
              onClick={(e) => {
                e.preventDefault();
                onNavigatePage('home');
              }}
              className="hover:text-orange-600 dark:hover:text-amber-400 transition-colors"
            >
              {bundle.ui.sections.breadcrumbHome}
            </a>
          </li>
          <li aria-hidden="true">/</li>
          <li
            aria-current="page"
            className="text-[#1f130b] dark:text-[#fffaf5] font-semibold"
          >
            {hubSeo.breadcrumbLabel}
          </li>
        </ol>

        {/* Blog Editorial Language Editions Switcher (Strictly the 4 published blog hubs) */}
        <div
          className="flex items-center gap-1.5"
          aria-label={ui.availableLanguagesLabel}
        >
          <span className="text-[11px] uppercase tracking-wider text-[#6c4e40] dark:text-orange-200/70 mr-1">
            {ui.availableLanguagesLabel}:
          </span>
          {BLOG_HUB_LOCALES.map((locCode) => {
            const targetPath = getBlogHomePath(locCode);
            const isActive = locCode === blogLocale;
            const meta = LOCALES_CONFIG[locCode];
            return (
              <a
                key={locCode}
                href={targetPath}
                lang={locCode}
                onClick={(e) => {
                  e.preventDefault();
                  trackBlogLanguageSwitch(blogLocale, locCode, targetPath);
                  onNavigatePath(targetPath);
                }}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg font-mono text-xs transition-colors flex items-center ${
                  isActive
                    ? 'bg-orange-600 text-white font-bold'
                    : 'bg-orange-100/60 dark:bg-[#231710] text-[#6c4e40] dark:text-orange-200/80 hover:text-orange-600 dark:hover:text-amber-400 border border-orange-200/70 dark:border-orange-900/50'
                }`}
              >
                {meta.shortLabel}
              </a>
            );
          })}
        </div>
      </nav>

      {/* Editorial Hero Header */}
      <section className="border-b border-orange-200/80 dark:border-orange-900/50 pb-8 space-y-4">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-orange-700 dark:text-amber-400">
          {ui.editorialBadge} · {allArticles.length} {ui.showingCountLabel}
        </p>
        <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-[#1f130b] dark:text-[#fffaf5] leading-tight">
          {hubSeo.title}
        </h1>
        <p className="text-base sm:text-lg text-[#5a3f32] dark:text-orange-100/85 max-w-3xl leading-relaxed">
          {hubSeo.subtitle}
        </p>
      </section>

      {/* Search & Category Filter Controls */}
      <section
        aria-label="Blog Search and Category Filters"
        className="space-y-4"
      >
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <label htmlFor="vidnex-blog-search" className="sr-only">
              {ui.searchPlaceholder}
            </label>
            <input
              id="vidnex-blog-search"
              type="search"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder={ui.searchPlaceholder}
              className="w-full min-h-[44px] pl-10 pr-9 py-2.5 rounded-xl bg-white dark:bg-[#1c140e] border border-orange-200/90 dark:border-orange-900/60 text-sm text-[#1f130b] dark:text-[#fffaf5] placeholder:text-[#7c5c4c] dark:placeholder:text-orange-200/50 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
              className="w-4 h-4 text-orange-600 dark:text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label={ui.searchClearLabel}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-[#6c4e40] dark:text-orange-200 hover:text-orange-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Interactive Category Filter Bar */}
        <div
          role="group"
          aria-label="Categories"
          className="flex items-center gap-2 overflow-x-auto pb-1"
        >
          <button
            type="button"
            onClick={() => handleCategoryChange('all')}
            aria-pressed={selectedCategory === 'all'}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-sm'
                : 'bg-white/90 dark:bg-[#1c140e] border border-orange-200/80 dark:border-orange-900/60 text-[#5a3f32] dark:text-orange-200/85 hover:border-orange-400'
            }`}
          >
            {ui.allCategoriesLabel}
          </button>
          {BLOG_CATEGORY_KEYS.map((catKey) => {
            const isSelected = selectedCategory === catKey;
            return (
              <button
                key={catKey}
                type="button"
                onClick={() => handleCategoryChange(catKey)}
                aria-pressed={isSelected}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-sm'
                    : 'bg-white/90 dark:bg-[#1c140e] border border-orange-200/80 dark:border-orange-900/60 text-[#5a3f32] dark:text-orange-200/85 hover:border-orange-400'
                }`}
              >
                {ui.categories[catKey]}
              </button>
            );
          })}
        </div>
      </section>

      {/* Featured Article Spotlight */}
      {featuredEntry && (
        <section aria-label={ui.featuredLabel}>
          <article className="rounded-2xl bg-white/95 dark:bg-[#1c140e] border border-orange-200/90 dark:border-orange-900/60 shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-6 p-5 sm:p-7">
            <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                {/* Unboxed typographic metadata row with middle-dot separators */}
                <p className="font-mono text-xs text-orange-700 dark:text-amber-400 font-semibold">
                  {ui.featuredLabel} ·{' '}
                  {ui.categories[featuredEntry.article.category]} ·{' '}
                  <time dateTime={featuredEntry.article.updatedAt}>
                    {featuredEntry.article.updatedAt}
                  </time>{' '}
                  · {featuredEntry.translation.readingTimeMinutes}{' '}
                  {ui.minReadSuffix}
                </p>

                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#1f130b] dark:text-[#fffaf5] leading-snug">
                  <a
                    href={featuredEntry.canonicalPath}
                    onClick={(e) =>
                      handleArticleLinkClick(e, featuredEntry.canonicalPath)
                    }
                    className="hover:text-orange-600 dark:hover:text-amber-400 transition-colors"
                  >
                    {featuredEntry.translation.title}
                  </a>
                </h2>

                <p className="text-sm sm:text-base text-[#5a3f32] dark:text-orange-100/80 leading-relaxed">
                  {featuredEntry.translation.excerpt}
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between gap-4">
                <span className="font-mono text-xs text-[#6c4e40] dark:text-orange-200/70">
                  {featuredEntry.article.author.name}
                </span>
                <a
                  href={featuredEntry.canonicalPath}
                  onClick={(e) =>
                    handleArticleLinkClick(e, featuredEntry.canonicalPath)
                  }
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm hover:opacity-95 transition-opacity"
                >
                  <span>{ui.readArticleCta}</span>
                  <span aria-hidden="true">→</span>
                </a>
              </div>
            </div>

            <div className="lg:col-span-6 flex items-center">
              <a
                href={featuredEntry.canonicalPath}
                onClick={(e) =>
                  handleArticleLinkClick(e, featuredEntry.canonicalPath)
                }
                aria-label={featuredEntry.translation.title}
                className="w-full block focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-xl"
              >
                <BlogDiagramIllustration
                  illustration={featuredEntry.article.featuredImage}
                  locale={blogLocale}
                  compact
                />
              </a>
            </div>
          </article>
        </section>
      )}

      {/* Articles Grid */}
      <section aria-labelledby="blog-latest-heading" className="space-y-6">
        <div className="flex items-center justify-between border-b border-orange-200/70 dark:border-orange-900/50 pb-3">
          <h2
            id="blog-latest-heading"
            className="font-display text-lg sm:text-xl font-bold text-[#1f130b] dark:text-[#fffaf5]"
          >
            {ui.latestArticlesTitle}
          </h2>
          <span className="font-mono text-xs text-[#6c4e40] dark:text-orange-200/70">
            {filteredArticles.length} {ui.showingCountLabel}
          </span>
        </div>

        {filteredArticles.length === 0 ? (
          <div className="rounded-2xl bg-white/90 dark:bg-[#1c140e] border border-orange-200/80 dark:border-orange-900/50 p-8 text-center space-y-3">
            <h3 className="font-display text-base font-bold text-[#1f130b] dark:text-[#fffaf5]">
              {ui.noResultsTitle}
            </h3>
            <p className="text-sm text-[#5a3f32] dark:text-orange-100/80 max-w-lg mx-auto">
              {ui.noResultsBody}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gridArticles.map((item, idx) => {
              const isHiddenByLoadMore = idx >= visibleCount;
              return (
                <article
                  key={item.article.id}
                  className={`rounded-2xl bg-white/95 dark:bg-[#1c140e] border border-orange-200/80 dark:border-orange-900/60 p-5 flex flex-col justify-between space-y-4 transition-colors hover:border-orange-400 dark:hover:border-amber-500/60 ${
                    isHiddenByLoadMore ? 'hidden sm:flex' : 'flex'
                  }`}
                >
                  <div className="space-y-3">
                    <a
                      href={item.canonicalPath}
                      onClick={(e) =>
                        handleArticleLinkClick(e, item.canonicalPath)
                      }
                      aria-label={item.translation.title}
                      className="block"
                    >
                      <BlogDiagramIllustration
                        illustration={item.article.featuredImage}
                        locale={blogLocale}
                        compact
                      />
                    </a>

                    {/* Unboxed typographic metadata */}
                    <p className="font-mono text-[11px] text-orange-700 dark:text-amber-400 font-semibold">
                      {ui.categories[item.article.category]} ·{' '}
                      <time dateTime={item.article.updatedAt}>
                        {item.article.updatedAt}
                      </time>{' '}
                      · {item.translation.readingTimeMinutes} {ui.minReadSuffix}
                    </p>

                    <h3 className="font-display text-base sm:text-lg font-bold text-[#1f130b] dark:text-[#fffaf5] leading-snug">
                      <a
                        href={item.canonicalPath}
                        onClick={(e) =>
                          handleArticleLinkClick(e, item.canonicalPath)
                        }
                        className="hover:text-orange-600 dark:hover:text-amber-400 transition-colors"
                      >
                        {item.translation.title}
                      </a>
                    </h3>

                    <p className="text-sm text-[#5a3f32] dark:text-orange-100/80 leading-relaxed line-clamp-3">
                      {item.translation.excerpt}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-orange-100 dark:border-orange-950/70 flex items-center justify-between text-xs">
                    <span className="font-mono text-[#6c4e40] dark:text-orange-200/70 truncate">
                      {item.article.author.name}
                    </span>
                    <a
                      href={item.canonicalPath}
                      onClick={(e) =>
                        handleArticleLinkClick(e, item.canonicalPath)
                      }
                      className="font-semibold text-orange-700 dark:text-amber-400 hover:underline inline-flex items-center gap-1 shrink-0"
                    >
                      <span>{ui.readArticleCta}</span>
                      <span aria-hidden="true">→</span>
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {gridArticles.length > visibleCount && (
          <div className="sm:hidden flex justify-center pt-2">
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + 6)}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-orange-100/80 dark:bg-[#231710] border border-orange-200 dark:border-orange-900 text-xs font-bold text-orange-800 dark:text-amber-400 cursor-pointer"
            >
              {ui.loadMoreLabel}
            </button>
          </div>
        )}
      </section>

      {/* Contextual Internal Links to VIDNEX Public Media Downloaders */}
      <section
        aria-label={ui.toolCtaHeading}
        className="rounded-2xl bg-gradient-to-br from-orange-50/90 to-amber-50/60 dark:from-[#1c140e] dark:to-[#231710] border border-orange-200/90 dark:border-orange-900/60 p-6 sm:p-8 space-y-5"
      >
        <div className="space-y-1">
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#1f130b] dark:text-[#fffaf5]">
            {ui.toolCtaHeading}
          </h2>
          <p className="text-sm text-[#5a3f32] dark:text-orange-100/80">
            {bundle.home.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {PLATFORM_PAGE_KEYS.map((pKey) => {
            const pData = bundle.platforms[pKey];
            const href = getLocalizedPagePath(blogLocale, pKey);
            return (
              <a
                key={pKey}
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigatePage(pKey);
                  if (typeof window !== 'undefined') {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                className="min-h-[48px] px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#140e0a] border border-orange-200/80 dark:border-orange-900/60 hover:border-orange-500 text-xs font-semibold text-[#1f130b] dark:text-[#fffaf5] flex items-center gap-2 transition-colors"
              >
                <PlatformIcon
                  platform={pKey}
                  className="w-4 h-4 text-orange-600 dark:text-amber-400 shrink-0"
                />
                <span className="truncate">{pData.shortLabel}</span>
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
};
