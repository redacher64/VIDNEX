/**
 * Privacy-first Blog Analytics & Conversion Tracking for VIDNEX Editorial System.
 * Tracks article views, organic entrances, reading completion, internal downloader tool clicks,
 * language switches, and blog search queries without cookies or PII.
 */

export type BlogAnalyticsEventType =
  | 'blog_article_view'
  | 'blog_hub_view'
  | 'blog_tool_cta_click'
  | 'blog_language_switch'
  | 'blog_category_filter'
  | 'blog_search_query'
  | 'blog_faq_expand'
  | 'blog_related_article_click';

export interface BlogAnalyticsEvent {
  type: BlogAnalyticsEventType;
  timestamp: string;
  locale: string;
  articleId?: string;
  slug?: string;
  targetPath?: string;
  category?: string;
  query?: string;
}

const sessionEvents: BlogAnalyticsEvent[] = [];

function dispatchBlogEvent(event: BlogAnalyticsEvent): void {
  sessionEvents.push(event);
  if (sessionEvents.length > 200) {
    sessionEvents.shift();
  }

  if (typeof window !== 'undefined') {
    const win = window as unknown as {
      gtag?: (
        command: string,
        eventName: string,
        params?: Record<string, unknown>
      ) => void;
      plausible?: (
        eventName: string,
        options?: { props?: Record<string, unknown> }
      ) => void;
    };

    if (typeof win.gtag === 'function') {
      win.gtag('event', event.type, {
        locale: event.locale,
        article_id: event.articleId,
        slug: event.slug,
        target_path: event.targetPath,
        category: event.category,
      });
    }

    if (typeof win.plausible === 'function') {
      win.plausible(event.type, {
        props: {
          locale: event.locale,
          articleId: event.articleId,
          slug: event.slug,
          targetPath: event.targetPath,
          category: event.category,
        },
      });
    }
  }
}

export function trackBlogHubView(locale: string, category?: string): void {
  dispatchBlogEvent({
    type: 'blog_hub_view',
    timestamp: new Date().toISOString(),
    locale,
    category: category || 'all',
  });
}

export function trackBlogArticleView(
  locale: string,
  articleId: string,
  slug: string,
  category: string
): void {
  dispatchBlogEvent({
    type: 'blog_article_view',
    timestamp: new Date().toISOString(),
    locale,
    articleId,
    slug,
    category,
  });
}

export function trackBlogToolCtaClick(
  locale: string,
  articleId: string,
  targetPath: string
): void {
  dispatchBlogEvent({
    type: 'blog_tool_cta_click',
    timestamp: new Date().toISOString(),
    locale,
    articleId,
    targetPath,
  });
}

export function trackBlogLanguageSwitch(
  fromLocale: string,
  toLocale: string,
  targetPath: string,
  articleId?: string
): void {
  dispatchBlogEvent({
    type: 'blog_language_switch',
    timestamp: new Date().toISOString(),
    locale: `${fromLocale}->${toLocale}`,
    articleId,
    targetPath,
  });
}

export function trackBlogCategoryFilter(
  locale: string,
  category: string
): void {
  dispatchBlogEvent({
    type: 'blog_category_filter',
    timestamp: new Date().toISOString(),
    locale,
    category,
  });
}

export function trackBlogSearchQuery(locale: string, query: string): void {
  if (!query.trim()) return;
  dispatchBlogEvent({
    type: 'blog_search_query',
    timestamp: new Date().toISOString(),
    locale,
    query: query.trim().slice(0, 80),
  });
}

export function trackBlogFaqExpand(
  locale: string,
  articleId: string,
  questionIndex: number
): void {
  dispatchBlogEvent({
    type: 'blog_faq_expand',
    timestamp: new Date().toISOString(),
    locale,
    articleId,
    category: `faq_${questionIndex}`,
  });
}

export function trackBlogRelatedClick(
  locale: string,
  sourceArticleId: string,
  targetPath: string
): void {
  dispatchBlogEvent({
    type: 'blog_related_article_click',
    timestamp: new Date().toISOString(),
    locale,
    articleId: sourceArticleId,
    targetPath,
  });
}

export function getBlogAnalyticsHistory(): readonly BlogAnalyticsEvent[] {
  return sessionEvents;
}
