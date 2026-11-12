import React, { useState, useEffect } from 'react';
import {
  BLOG_HUB_SEO,
  type BlogInternalLink,
  type BlogLocale,
  getBlogHomePath,
  getBlogUiLabels,
  getPublishedArticleById,
  getPublishedArticleBySlug,
  getPublishedArticleTranslations,
  getRelatedArticlesForLocale,
  isBlogHubLocale,
} from '../data/blogArticles.ts';
import {
  getLocalizedPagePath,
  LOCALES_CONFIG,
  type PageKey,
  type SupportedLocale,
} from '../i18n/config.ts';
import { getLocaleBundleSync } from '../i18n/localeLoader.ts';
import {
  trackBlogArticleView,
  trackBlogFaqExpand,
  trackBlogLanguageSwitch,
  trackBlogRelatedClick,
  trackBlogToolCtaClick,
} from '../utils/blogAnalytics.ts';
import { BlogDiagramIllustration } from './BlogDiagramIllustration.tsx';

interface BlogArticleViewProps {
  locale: SupportedLocale;
  blogSlug: string;
  onNavigatePath: (path: string) => void;
  onNavigatePage: (pageKey: PageKey) => void;
}

export const BlogArticleView: React.FC<BlogArticleViewProps> = ({
  locale,
  blogSlug,
  onNavigatePath,
  onNavigatePage,
}) => {
  const blogLocale: BlogLocale = isBlogHubLocale(locale) ? locale : 'en';
  const resolved = getPublishedArticleBySlug(blogLocale, blogSlug);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  useEffect(() => {
    if (resolved) {
      trackBlogArticleView(
        blogLocale,
        resolved.article.id,
        resolved.translation.localizedSlug,
        resolved.article.category
      );
    }
  }, [blogLocale, resolved]);

  if (!resolved) {
    return null;
  }

  const { article, translation } = resolved;
  const ui = getBlogUiLabels(blogLocale);
  const hubSeo = BLOG_HUB_SEO[blogLocale];
  const bundle = getLocaleBundleSync(blogLocale);

  const homeHref = getLocalizedPagePath(blogLocale, 'home');
  const blogHubHref = getBlogHomePath(blogLocale);
  const availableTranslations = getPublishedArticleTranslations(article.id);
  const relatedArticles = getRelatedArticlesForLocale(article, blogLocale, 3);

  const resolveInternalLinkHref = (link: BlogInternalLink): string => {
    if (link.targetType === 'home') {
      return getLocalizedPagePath(blogLocale, 'home');
    }
    if (link.targetType === 'platform' && link.platformKey) {
      return getLocalizedPagePath(blogLocale, link.platformKey);
    }
    if (link.targetType === 'blog_article' && link.targetArticleId) {
      const targetArt = getPublishedArticleById(link.targetArticleId);
      if (targetArt) {
        const localTr = targetArt.translations[blogLocale];
        if (localTr && localTr.translationStatus === 'published') {
          return blogLocale === 'en'
            ? `/blog/${localTr.localizedSlug}`
            : `/${blogLocale}/blog/${localTr.localizedSlug}`;
        }
        const enTr = targetArt.translations.en;
        if (enTr && enTr.translationStatus === 'published') {
          return `/blog/${enTr.localizedSlug}`;
        }
      }
    }
    return blogHubHref;
  };

  const handleInternalClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
    isToolCta = false
  ) => {
    e.preventDefault();
    if (isToolCta) {
      trackBlogToolCtaClick(blogLocale, article.id, href);
    } else {
      trackBlogRelatedClick(blogLocale, article.id, href);
    }
    onNavigatePath(href);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <article className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
      {/* Breadcrumb Navigation + Available Article Translations */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center justify-between flex-wrap gap-3 text-xs font-mono text-[#6c4e40] dark:text-orange-200/75"
      >
        <ol className="flex items-center flex-wrap gap-2">
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
          <li>
            <a
              href={blogHubHref}
              onClick={(e) => handleInternalClick(e, blogHubHref)}
              className="hover:text-orange-600 dark:hover:text-amber-400 transition-colors"
            >
              {hubSeo.breadcrumbLabel}
            </a>
          </li>
          <li aria-hidden="true">/</li>
          <li
            aria-current="page"
            className="text-[#1f130b] dark:text-[#fffaf5] font-semibold truncate max-w-[260px] sm:max-w-md"
          >
            {translation.title}
          </li>
        </ol>

        {/* Language Switcher for Published Translations of THIS Article */}
        {availableTranslations.length > 1 && (
          <div
            className="flex items-center gap-1.5"
            aria-label={ui.availableLanguagesLabel}
          >
            <span className="text-[11px] uppercase tracking-wider text-[#6c4e40] dark:text-orange-200/70 mr-1">
              {ui.availableLanguagesLabel}:
            </span>
            {availableTranslations.map((item) => {
              const isCurrent = item.locale === blogLocale;
              const meta = LOCALES_CONFIG[item.locale];
              return (
                <a
                  key={item.locale}
                  href={item.canonicalPath}
                  lang={item.locale}
                  onClick={(e) => {
                    e.preventDefault();
                    trackBlogLanguageSwitch(
                      blogLocale,
                      item.locale,
                      item.canonicalPath,
                      article.id
                    );
                    onNavigatePath(item.canonicalPath);
                  }}
                  className={`min-h-[36px] px-2.5 py-1 rounded-lg font-mono text-xs transition-colors flex items-center ${
                    isCurrent
                      ? 'bg-orange-600 text-white font-bold'
                      : 'bg-orange-100/60 dark:bg-[#231710] text-[#6c4e40] dark:text-orange-200/80 hover:text-orange-600 dark:hover:text-amber-400 border border-orange-200/70 dark:border-orange-900/50'
                  }`}
                >
                  {meta.shortLabel}
                </a>
              );
            })}
          </div>
        )}
      </nav>

      {/* Article Header: Unboxed Typographic Metadata + Single H1 + Author & Dates */}
      <header className="border-b border-orange-200/80 dark:border-orange-900/50 pb-8 space-y-5">
        <p className="font-mono text-xs font-bold text-orange-700 dark:text-amber-400">
          {ui.categories[article.category]} · {ui.publishedOnLabel}{' '}
          <time dateTime={article.publishedAt}>{article.publishedAt}</time> ·{' '}
          {ui.updatedOnLabel}{' '}
          <time dateTime={article.updatedAt}>{article.updatedAt}</time> ·{' '}
          {translation.readingTimeMinutes} {ui.minReadSuffix}
        </p>

        <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-[#1f130b] dark:text-[#fffaf5] leading-tight max-w-4xl">
          {translation.title}
        </h1>

        {/* Author Attribution */}
        <div className="flex items-center gap-3 pt-1 text-xs font-mono text-[#6c4e40] dark:text-orange-200/80">
          <span>
            {ui.authorLabel}{' '}
            <strong className="text-[#1f130b] dark:text-[#fffaf5]">
              {article.author.name}
            </strong>{' '}
            ({article.author.role[blogLocale] || article.author.role.en})
          </span>
        </div>
      </header>

      {/* Main 70/30 Editorial Layout: Sticky Table of Contents + Long-Form Technical Prose */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* Sticky Table of Contents (30% Sidebar on Desktop, Top Card on Mobile) */}
        <aside
          aria-label={ui.tocTitle}
          className="lg:col-span-4 lg:sticky lg:top-20 rounded-2xl bg-white/95 dark:bg-[#1c140e] border border-orange-200/80 dark:border-orange-900/60 p-5 space-y-4 order-1 lg:order-2"
        >
          <h2 className="font-display text-xs font-bold uppercase tracking-wider text-orange-800 dark:text-amber-400">
            {ui.tocTitle}
          </h2>
          <ol className="space-y-2 text-xs sm:text-sm">
            {translation.tableOfContents.map((tocItem) => (
              <li key={tocItem.id}>
                <a
                  href={`#${tocItem.id}`}
                  className="text-[#5a3f32] dark:text-orange-100/85 hover:text-orange-600 dark:hover:text-amber-400 transition-colors block py-1 leading-snug"
                >
                  {tocItem.heading}
                </a>
              </li>
            ))}
          </ol>

          <div className="pt-3 border-t border-orange-200/60 dark:border-orange-900/50">
            <a
              href={blogHubHref}
              onClick={(e) => handleInternalClick(e, blogHubHref)}
              className="font-mono text-xs font-semibold text-orange-700 dark:text-amber-400 hover:underline inline-flex items-center gap-1.5"
            >
              <span aria-hidden="true">←</span>
              <span>{ui.backToBlogLabel}</span>
            </a>
          </div>
        </aside>

        {/* Primary Reading Column (70% Width on Desktop, Constrained Measure) */}
        <div className="lg:col-span-8 space-y-8 order-2 lg:order-1">
          {/* Introduction Lead */}
          <div className="space-y-4 text-base sm:text-lg text-[#3d291e] dark:text-orange-50/90 leading-relaxed max-w-[65ch]">
            {translation.introduction.map((para, idx) => (
              <p key={idx}>{para}</p>
            ))}
          </div>

          {/* Featured Technical Diagram with Figcaption */}
          <BlogDiagramIllustration
            illustration={article.featuredImage}
            locale={blogLocale}
          />

          {/* Structured Content Sections */}
          <div className="space-y-8 max-w-[65ch]">
            {translation.content.map((sec) => (
              <section
                key={sec.id}
                id={sec.id}
                className="scroll-mt-24 space-y-3.5"
              >
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#1f130b] dark:text-[#fffaf5] leading-snug">
                  {sec.heading}
                </h2>
                {sec.paragraphs.map((p, pIdx) => (
                  <p
                    key={pIdx}
                    className="text-base text-[#4a3327] dark:text-orange-100/85 leading-relaxed"
                  >
                    {p}
                  </p>
                ))}
                {sec.bullets && sec.bullets.length > 0 && (
                  <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base text-[#4a3327] dark:text-orange-100/85 leading-relaxed">
                    {sec.bullets.map((b, bIdx) => (
                      <li key={bIdx}>{b}</li>
                    ))}
                  </ul>
                )}
                {sec.technicalCallout && (
                  <div className="my-4 rounded-xl bg-orange-50/90 dark:bg-[#231710] border-l-4 border-orange-600 dark:border-amber-400 p-4 space-y-1">
                    <p className="font-mono text-xs font-bold uppercase tracking-wider text-orange-800 dark:text-amber-400">
                      {sec.technicalCallout.label}
                    </p>
                    <p className="text-sm text-[#3d291e] dark:text-orange-100/90 leading-relaxed">
                      {sec.technicalCallout.text}
                    </p>
                  </div>
                )}
              </section>
            ))}
          </div>

          {/* Contextual VIDNEX Tool & Internal Guide Links */}
          {translation.internalLinks.length > 0 && (
            <section
              aria-label={ui.toolCtaHeading}
              className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50/70 dark:from-[#1c140e] dark:to-[#241811] border border-orange-200 dark:border-orange-900/70 p-6 space-y-4"
            >
              <h2 className="font-display text-lg font-bold text-[#1f130b] dark:text-[#fffaf5]">
                {ui.toolCtaHeading}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {translation.internalLinks.map((link, idx) => {
                  const href = resolveInternalLinkHref(link);
                  const isTool =
                    link.targetType === 'platform' ||
                    link.targetType === 'home';
                  return (
                    <a
                      key={idx}
                      href={href}
                      onClick={(e) => handleInternalClick(e, href, isTool)}
                      className="rounded-xl bg-white dark:bg-[#140e0a] border border-orange-200/90 dark:border-orange-900/60 hover:border-orange-500 p-4 flex flex-col justify-between gap-2 transition-colors"
                    >
                      <div className="space-y-1">
                        <p className="font-display text-sm font-bold text-orange-700 dark:text-amber-400">
                          {link.label}
                        </p>
                        <p className="text-xs text-[#5a3f32] dark:text-orange-100/80 leading-relaxed">
                          {link.description}
                        </p>
                      </div>
                      <span className="font-mono text-xs font-semibold text-orange-600 dark:text-amber-400 inline-flex items-center gap-1">
                        <span>
                          {isTool ? ui.toolCtaButton : ui.readArticleCta}
                        </span>
                        <span aria-hidden="true">→</span>
                      </span>
                    </a>
                  );
                })}
              </div>
            </section>
          )}

          {/* Accessible FAQ Accordion */}
          {translation.faq.length > 0 && (
            <section
              aria-labelledby="blog-article-faq-heading"
              className="space-y-4 pt-2"
            >
              <h2
                id="blog-article-faq-heading"
                className="font-display text-xl sm:text-2xl font-bold text-[#1f130b] dark:text-[#fffaf5]"
              >
                {ui.faqSectionTitle}
              </h2>
              <div className="space-y-3">
                {translation.faq.map((faqItem, idx) => {
                  const isOpen = openFaqIndex === idx;
                  const answerId = `blog-faq-answer-${article.id}-${idx}`;
                  return (
                    <div
                      key={idx}
                      className="rounded-xl bg-white/95 dark:bg-[#1c140e] border border-orange-200/80 dark:border-orange-900/60 overflow-hidden"
                    >
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={answerId}
                        onClick={() => {
                          const next = isOpen ? null : idx;
                          setOpenFaqIndex(next);
                          if (next !== null) {
                            trackBlogFaqExpand(blogLocale, article.id, idx);
                          }
                        }}
                        className="w-full min-h-[48px] px-4 py-3.5 text-left flex items-center justify-between gap-3 font-display text-sm sm:text-base font-bold text-[#1f130b] dark:text-[#fffaf5] hover:bg-orange-50/50 dark:hover:bg-orange-950/30 transition-colors cursor-pointer"
                      >
                        <span>{faqItem.question}</span>
                        <span
                          aria-hidden="true"
                          className="font-mono text-orange-600 dark:text-amber-400 shrink-0"
                        >
                          {isOpen ? '−' : '+'}
                        </span>
                      </button>
                      <div
                        id={answerId}
                        role="region"
                        className={
                          isOpen
                            ? 'px-4 pb-4 text-sm text-[#4a3327] dark:text-orange-100/85 leading-relaxed border-t border-orange-100 dark:border-orange-950/60 pt-3'
                            : 'hidden'
                        }
                      >
                        {faqItem.answer}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Authoritative External Sources */}
          {translation.sources.length > 0 && (
            <section
              aria-labelledby="blog-article-sources-heading"
              className="border-t border-orange-200/70 dark:border-orange-900/50 pt-6 space-y-3"
            >
              <h2
                id="blog-article-sources-heading"
                className="font-mono text-xs font-bold uppercase tracking-wider text-[#6c4e40] dark:text-orange-200/75"
              >
                {ui.sourcesSectionTitle}
              </h2>
              <ul className="space-y-2 text-xs sm:text-sm">
                {translation.sources.map((src, sIdx) => (
                  <li key={sIdx}>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-700 dark:text-amber-400 hover:underline font-medium"
                    >
                      {src.title}
                    </a>{' '}
                    <span className="text-[#6c4e40] dark:text-orange-200/70 font-mono text-xs">
                      — {src.publisher}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {/* Related Articles Footer Section */}
      {relatedArticles.length > 0 && (
        <section
          aria-labelledby="blog-related-heading"
          className="border-t border-orange-200/80 dark:border-orange-900/50 pt-8 space-y-5"
        >
          <h2
            id="blog-related-heading"
            className="font-display text-lg sm:text-xl font-bold text-[#1f130b] dark:text-[#fffaf5]"
          >
            {ui.relatedArticlesTitle}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {relatedArticles.map((rel) => (
              <article
                key={rel.article.id}
                className="rounded-2xl bg-white/95 dark:bg-[#1c140e] border border-orange-200/80 dark:border-orange-900/60 p-5 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <p className="font-mono text-[11px] text-orange-700 dark:text-amber-400 font-semibold">
                    {ui.categories[rel.article.category]} ·{' '}
                    {rel.translation.readingTimeMinutes} {ui.minReadSuffix}
                  </p>
                  <h3 className="font-display text-base font-bold text-[#1f130b] dark:text-[#fffaf5] leading-snug">
                    <a
                      href={rel.canonicalPath}
                      onClick={(e) => handleInternalClick(e, rel.canonicalPath)}
                      className="hover:text-orange-600 dark:hover:text-amber-400 transition-colors"
                    >
                      {rel.translation.title}
                    </a>
                  </h3>
                  <p className="text-xs text-[#5a3f32] dark:text-orange-100/80 line-clamp-2 leading-relaxed">
                    {rel.translation.excerpt}
                  </p>
                </div>
                <a
                  href={rel.canonicalPath}
                  onClick={(e) => handleInternalClick(e, rel.canonicalPath)}
                  className="font-mono text-xs font-semibold text-orange-700 dark:text-amber-400 hover:underline inline-flex items-center gap-1 pt-2"
                >
                  <span>{ui.readArticleCta}</span>
                  <span aria-hidden="true">→</span>
                </a>
              </article>
            ))}
          </div>
        </section>
      )}
    </article>
  );
};
