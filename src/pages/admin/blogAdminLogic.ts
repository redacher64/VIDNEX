import {
  BLOG_ARTICLES,
  type BlogArticle,
  type BlogCategoryId,
} from '../../data/blogArticles.ts';
import {
  validateBlogTranslationInput,
  type BlogValidationIssue,
  type BlogValidationWarning,
} from '../../utils/blogValidation.ts';
import type { AdminPermission, AdminUserProfile } from './Login.tsx';

export type AdminTab =
  | 'dashboard'
  | 'health'
  | 'controls'
  | 'activity'
  | 'blog'
  | 'users'
  | 'account';

export const BLOG_MODULE_ENABLED = true;

export const BLOG_ADMIN_PERMISSIONS: readonly AdminPermission[] = [
  'blog.write',
  'blog.edit_all',
  'blog.delete',
  'blog.publish',
];

export type AdminBlogStatusFilter = 'all' | 'published' | 'draft';

export interface AdminBlogTranslationSummary {
  locale: string;
  slug: string;
  title: string;
  status: 'published' | 'draft' | 'in_review' | 'trashed';
  readingTimeMinutes: number;
}

export interface AdminBlogArticleItem {
  id: string;
  category: string;
  status: 'published' | 'draft' | 'in_review' | 'trashed';
  publishedAt: string;
  updatedAt: string;
  authorName: string;
  primaryToolRoute?: string;
  inD1: boolean;
  translations: AdminBlogTranslationSummary[];
}

export function hasBlogPermission(
  user: Pick<AdminUserProfile, 'isOwner' | 'permissions'> | null,
  permission?: AdminPermission
): boolean {
  if (!user) return false;
  if (user.isOwner) return true;
  const perms = user.permissions || [];
  if (permission) {
    return perms.includes(permission);
  }
  return BLOG_ADMIN_PERMISSIONS.some((p) => perms.includes(p));
}

export function isTabAuthorizedForUser(
  tab: AdminTab,
  user: AdminUserProfile | null
): boolean {
  if (!user) return false;
  if (user.isOwner) return true;
  if (tab === 'account') return true;
  if (tab === 'controls' || tab === 'users') return false;
  if (tab === 'dashboard') return user.permissions.includes('dashboard.view');
  if (tab === 'health') return user.permissions.includes('health.view');
  if (tab === 'activity') return user.permissions.includes('activity.view');
  if (tab === 'blog') return hasBlogPermission(user);
  return false;
}

export function getFirstAuthorizedTabForUser(
  user: AdminUserProfile | null
): AdminTab {
  if (!user) return 'dashboard';
  if (user.isOwner) return 'dashboard';
  if (user.permissions.includes('dashboard.view')) return 'dashboard';
  if (user.permissions.includes('health.view')) return 'health';
  if (user.permissions.includes('activity.view')) return 'activity';
  if (hasBlogPermission(user)) return 'blog';
  return 'account';
}

export function buildUnifiedAdminBlogArticles(
  staticArticles: readonly BlogArticle[] = BLOG_ARTICLES,
  d1Articles: Array<{
    id: string;
    category: string;
    status: 'published' | 'draft' | 'in_review' | 'trashed';
    publishedAt?: string | null;
    updatedAt?: number;
    createdBy?: string;
    toolRoute?: string | null;
    translations?: Record<
      string,
      {
        locale: string;
        slug: string;
        title: string;
        status: 'published' | 'draft' | 'in_review' | 'trashed';
        readingTimeMinutes?: number;
      }
    >;
  }> = []
): AdminBlogArticleItem[] {
  const d1Map = new Map(d1Articles.map((a) => [a.id, a]));
  const result: AdminBlogArticleItem[] = [];
  const seenIds = new Set<string>();

  for (const staticArt of staticArticles) {
    seenIds.add(staticArt.id);
    const d1Art = d1Map.get(staticArt.id);
    const translations: AdminBlogTranslationSummary[] = [];
    const seenLocales = new Set<string>();

    for (const [loc, tr] of Object.entries(staticArt.translations)) {
      if (!tr) continue;
      seenLocales.add(loc);
      const d1Tr = d1Art?.translations?.[loc];
      translations.push({
        locale: loc,
        slug: d1Tr?.slug || tr.localizedSlug,
        title: d1Tr?.title || tr.title,
        status: d1Tr?.status || tr.translationStatus,
        readingTimeMinutes: d1Tr?.readingTimeMinutes || tr.readingTimeMinutes,
      });
    }

    if (d1Art?.translations) {
      for (const [loc, d1Tr] of Object.entries(d1Art.translations)) {
        if (seenLocales.has(loc) || !d1Tr) continue;
        translations.push({
          locale: loc,
          slug: d1Tr.slug,
          title: d1Tr.title,
          status: d1Tr.status,
          readingTimeMinutes: d1Tr.readingTimeMinutes || 5,
        });
      }
    }

    result.push({
      id: staticArt.id,
      category: d1Art?.category || staticArt.category,
      status: d1Art?.status || staticArt.status,
      publishedAt: d1Art?.publishedAt || staticArt.publishedAt,
      updatedAt: d1Art?.updatedAt
        ? new Date(d1Art.updatedAt).toISOString().slice(0, 10)
        : staticArt.updatedAt,
      authorName: staticArt.author.name,
      primaryToolRoute: d1Art?.toolRoute || staticArt.primaryToolRoute,
      inD1: Boolean(d1Art),
      translations,
    });
  }

  for (const d1Art of d1Articles) {
    if (seenIds.has(d1Art.id)) continue;
    const translations: AdminBlogTranslationSummary[] = Object.values(
      d1Art.translations || {}
    ).map((t) => ({
      locale: t.locale,
      slug: t.slug,
      title: t.title,
      status: t.status,
      readingTimeMinutes: t.readingTimeMinutes || 5,
    }));

    result.push({
      id: d1Art.id,
      category: d1Art.category,
      status: d1Art.status,
      publishedAt: d1Art.publishedAt || '—',
      updatedAt: d1Art.updatedAt
        ? new Date(d1Art.updatedAt).toISOString().slice(0, 10)
        : '—',
      authorName: d1Art.createdBy || 'VIDNEX Editorial',
      primaryToolRoute: d1Art.toolRoute || undefined,
      inD1: true,
      translations,
    });
  }

  return result;
}

export function filterAdminBlogArticles(
  articles: readonly AdminBlogArticleItem[],
  options: {
    statusFilter?: AdminBlogStatusFilter;
    categoryFilter?: string;
    searchQuery?: string;
  }
): AdminBlogArticleItem[] {
  const statusFilter = options.statusFilter || 'all';
  const categoryFilter = (options.categoryFilter || 'all').trim();
  const q = (options.searchQuery || '').trim().toLowerCase();

  return articles.filter((art) => {
    if (statusFilter === 'published' && art.status !== 'published') {
      return false;
    }
    if (statusFilter === 'draft' && art.status !== 'draft') {
      return false;
    }
    if (
      categoryFilter !== 'all' &&
      categoryFilter !== '' &&
      art.category !== categoryFilter
    ) {
      return false;
    }
    if (!q) return true;

    if (art.id.toLowerCase().includes(q)) return true;
    if (art.category.toLowerCase().includes(q)) return true;
    return art.translations.some(
      (tr) =>
        tr.title.toLowerCase().includes(q) || tr.slug.toLowerCase().includes(q)
    );
  });
}

export function canWriteBlogArticle(
  user: Pick<AdminUserProfile, 'isOwner' | 'permissions'> | null
): boolean {
  if (!user) return false;
  if (user.isOwner) return true;
  const perms = user.permissions || [];
  return perms.includes('blog.write') || perms.includes('blog.edit_all');
}

export function slugifyBlogIdentifier(input: string): string {
  const normalized = (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  const withoutYears = normalized
    .split('-')
    .filter((token) => !/^(?:202[4-9]|203[0-5])$/.test(token))
    .join('-');

  return withoutYears;
}

export interface BlogDraftEditorFormInput {
  articleId: string;
  category: BlogCategoryId;
  toolRoute?: string;
  locale: string;
  slug: string;
  title: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  primaryKeyword: string;
  bodyMarkdown: string;
  existingSlugsInLocale?: string[];
}

export function buildDraftCreatePayload(form: BlogDraftEditorFormInput): {
  valid: boolean;
  errors: BlogValidationIssue[];
  warnings: BlogValidationWarning[];
  wordCount: number;
  payload: {
    action: 'create';
    id: string;
    category: BlogCategoryId;
    toolRoute: string | null;
    status: 'draft';
    translations: Record<
      string,
      {
        locale: string;
        slug: string;
        title: string;
        excerpt: string;
        metaTitle: string;
        metaDescription: string;
        primaryKeyword: string;
        bodyMarkdown: string;
        status: 'draft';
      }
    >;
  };
} {
  const id = (form.articleId || '').trim().toLowerCase();
  const locale = (form.locale || 'fr').trim().toLowerCase();
  const slug = (form.slug || '').trim().toLowerCase();
  const title = (form.title || '').trim();
  const excerpt = (form.excerpt || '').trim();
  const metaTitle = (form.metaTitle || '').trim();
  const metaDescription = (form.metaDescription || '').trim();
  const primaryKeyword = (form.primaryKeyword || '').trim();
  const bodyMarkdown = (form.bodyMarkdown || '').trim();

  const validation = validateBlogTranslationInput({
    locale,
    slug,
    title,
    excerpt,
    metaTitle,
    metaDescription,
    bodyMarkdown,
    existingSlugsInLocale: form.existingSlugsInLocale || [],
  });

  const errors: BlogValidationIssue[] = [...validation.errors];
  if (!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    errors.unshift({
      code: 'INVALID_SLUG_FORMAT',
      field: 'id',
      message:
        "L'identifiant de l'article doit contenir uniquement des lettres latines minuscules, chiffres et tirets.",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: validation.warnings,
    wordCount: validation.parsedMarkdown?.wordCount || 0,
    payload: {
      action: 'create',
      id,
      category: form.category || 'tutorials',
      toolRoute: form.toolRoute ? form.toolRoute.trim() : null,
      status: 'draft',
      translations: {
        [locale]: {
          locale,
          slug,
          title,
          excerpt,
          metaTitle,
          metaDescription,
          primaryKeyword,
          bodyMarkdown,
          status: 'draft',
        },
      },
    },
  };
}

