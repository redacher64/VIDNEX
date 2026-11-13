import { BLOG_ARTICLES, type BlogCategoryId } from '../../../src/data/blogArticles.ts';
import type {
  BlogContentSection,
  BlogFaqItem,
  BlogInternalLink,
  BlogSourceLink,
  BlogTocItem,
  Locale,
} from '../../../src/i18n/config.ts';
import {
  parseRestrictedBlogMarkdown,
  sectionsToRestrictedMarkdown,
  validateBlogTranslationInput,
  type BlogValidationIssue,
} from '../../../src/utils/blogValidation.ts';
import {
  BLOG_PERMISSIONS,
  recordAuditLog,
  requirePermission,
  verifyCsrfAndJson,
  type AdminPrincipal,
} from '../../_lib/auth.ts';
import {
  ensureD1Schema,
  getDb,
  type AdminEnv,
  type D1Database,
} from '../../_lib/db.ts';

export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours
export const MAX_REVISIONS_PER_TRANSLATION = 10;

export type BlogStatus = 'draft' | 'in_review' | 'published' | 'trashed';

const VALID_BLOG_STATUSES = new Set<BlogStatus>([
  'draft',
  'in_review',
  'published',
  'trashed',
]);

const VALID_CATEGORIES = new Set<BlogCategoryId>([
  'tutorials',
  'comparisons',
  'audio',
  'troubleshooting',
  'news',
]);

export interface D1BlogArticleRow {
  id: string;
  category: string;
  tool_route: string | null;
  secondary_tool_route: string | null;
  status: BlogStatus;
  previous_status: string | null;
  trashed_at: number | null;
  created_by: string;
  updated_by: string;
  published_at: string | null;
  created_at: number;
  updated_at: number;
}

export interface D1BlogTranslationRow {
  id: number;
  article_id: string;
  locale: string;
  slug: string;
  title: string;
  excerpt: string;
  meta_title: string;
  meta_description: string;
  primary_keyword: string;
  secondary_keywords: string;
  search_intent: string;
  reading_time_minutes: number;
  quick_answer: string | null;
  key_takeaways: string;
  introduction: string;
  table_of_contents: string;
  content_sections: string;
  faq: string;
  cta_title: string | null;
  cta_description: string | null;
  cta_button_label: string | null;
  internal_links: string;
  sources: string;
  body_markdown: string;
  status: BlogStatus;
  updated_by: string;
  created_at: number;
  updated_at: number;
}

export interface D1BlogRevisionRow {
  id: number;
  article_id: string;
  locale: string;
  slug: string;
  title: string;
  meta_title: string;
  meta_description: string;
  body_markdown: string;
  snapshot_json: string;
  status: BlogStatus;
  edited_by: string;
  created_at: number;
}

export interface D1BlogRedirectRow {
  id: number;
  locale: string;
  old_slug: string;
  new_slug: string;
  article_id: string;
  status_code: number;
  created_at: number;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function hasPublishPermission(principal: AdminPrincipal): boolean {
  return principal.isOwner || principal.permissions.includes('blog.publish');
}

function canEditArticle(
  principal: AdminPrincipal,
  articleCreatedBy: string
): boolean {
  if (principal.isOwner) return true;
  if (principal.permissions.includes('blog.edit_all')) return true;
  if (
    principal.permissions.includes('blog.write') &&
    articleCreatedBy.toLowerCase() === principal.login.toLowerCase()
  ) {
    return true;
  }
  return false;
}

/**
 * Hydrate une ligne `blog_translations` D1 vers la structure `BlogArticleTranslation`
 * attendue par le front (`BlogArticleView`) + métadonnées CMS (`bodyMarkdown`, `status`, dates).
 */
export function hydrateTranslationRow(row: D1BlogTranslationRow) {
  return {
    id: Number(row.id),
    articleId: String(row.article_id),
    locale: String(row.locale) as Locale,
    slug: String(row.slug),
    title: String(row.title),
    excerpt: String(row.excerpt),
    metaTitle: String(row.meta_title),
    metaDescription: String(row.meta_description),
    primaryKeyword: String(row.primary_keyword || ''),
    secondaryKeywords: safeJsonParse<string[]>(row.secondary_keywords, []),
    searchIntent: String(row.search_intent || ''),
    readingTimeMinutes: Number(row.reading_time_minutes) || 5,
    quickAnswer: row.quick_answer ? String(row.quick_answer) : undefined,
    keyTakeaways: safeJsonParse<string[]>(row.key_takeaways, []),
    introduction: safeJsonParse<string[]>(row.introduction, []),
    tableOfContents: safeJsonParse<BlogTocItem[]>(row.table_of_contents, []),
    sections: safeJsonParse<BlogContentSection[]>(row.content_sections, []),
    faq: safeJsonParse<BlogFaqItem[]>(row.faq, []),
    ctaTitle: row.cta_title ? String(row.cta_title) : undefined,
    ctaDescription: row.cta_description
      ? String(row.cta_description)
      : undefined,
    ctaButtonLabel: row.cta_button_label
      ? String(row.cta_button_label)
      : undefined,
    internalLinks: safeJsonParse<BlogInternalLink[]>(row.internal_links, []),
    sources: safeJsonParse<BlogSourceLink[]>(row.sources, []),
    bodyMarkdown: String(row.body_markdown || ''),
    status: (row.status || 'draft') as BlogStatus,
    updatedBy: String(row.updated_by || 'admin'),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

/**
 * Purge automatiquement les articles mis à la corbeille depuis plus de 30 jours.
 */
async function purgeExpiredTrashedArticles(
  db: D1Database,
  nowMs = Date.now()
): Promise<void> {
  const cutoff = nowMs - TRASH_RETENTION_MS;
  try {
    await db
      .prepare(
        `DELETE FROM blog_articles WHERE status = 'trashed' AND trashed_at IS NOT NULL AND trashed_at < ?`
      )
      .bind(cutoff)
      .run();
  } catch {
    // Non-bloquant
  }
}

/**
 * Enregistre une révision pour une traduction `(article_id, locale)` et ne conserve
 * que les 10 versions les plus récentes.
 */
async function recordTranslationRevision(
  db: D1Database,
  translation: {
    articleId: string;
    locale: string;
    slug: string;
    title: string;
    metaTitle: string;
    metaDescription: string;
    bodyMarkdown: string;
    snapshot: Record<string, unknown>;
    status: BlogStatus;
    editedBy: string;
  },
  nowMs = Date.now()
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO blog_revisions (
        article_id, locale, slug, title, meta_title, meta_description,
        body_markdown, snapshot_json, status, edited_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      translation.articleId,
      translation.locale,
      translation.slug,
      translation.title,
      translation.metaTitle,
      translation.metaDescription,
      translation.bodyMarkdown,
      JSON.stringify(translation.snapshot),
      translation.status,
      translation.editedBy,
      nowMs
    )
    .run();

  await db
    .prepare(
      `DELETE FROM blog_revisions WHERE article_id = ? AND locale = ? AND id NOT IN (
        SELECT id FROM blog_revisions WHERE article_id = ? AND locale = ?
        ORDER BY created_at DESC, id DESC LIMIT 10
      )`
    )
    .bind(
      translation.articleId,
      translation.locale,
      translation.articleId,
      translation.locale
    )
    .run();
}

/**
 * Enregistre une redirection 301 automatique lorsqu'un slug d'article publié est modifié,
 * et met à jour les chaînes de redirection existantes (`A -> B -> C` devient `A -> C`).
 */
async function recordSlugRedirect301(
  db: D1Database,
  env: AdminEnv,
  actor: string,
  params: {
    articleId: string;
    locale: string;
    oldSlug: string;
    newSlug: string;
  },
  nowMs = Date.now()
): Promise<void> {
  const oldSlug = params.oldSlug.trim().toLowerCase();
  const newSlug = params.newSlug.trim().toLowerCase();
  if (!oldSlug || !newSlug || oldSlug === newSlug) return;

  // Éviter toute boucle si le nouveau slug était lui-même une ancienne redirection
  await db
    .prepare(`DELETE FROM blog_redirects WHERE locale = ? AND old_slug = ?`)
    .bind(params.locale, newSlug)
    .run();

  // Mettre à jour les redirections en chaîne qui pointaient vers oldSlug
  await db
    .prepare(
      `UPDATE blog_redirects SET new_slug = ? WHERE locale = ? AND new_slug = ?`
    )
    .bind(newSlug, params.locale, oldSlug)
    .run();

  // Insérer ou mettre à jour la redirection 301 oldSlug -> newSlug
  await db
    .prepare(
      `INSERT INTO blog_redirects (locale, old_slug, new_slug, article_id, status_code, created_at)
       VALUES (?, ?, ?, ?, 301, ?)
       ON CONFLICT(locale, old_slug) DO UPDATE SET
         new_slug = excluded.new_slug,
         article_id = excluded.article_id,
         created_at = excluded.created_at`
    )
    .bind(params.locale, oldSlug, newSlug, params.articleId, nowMs)
    .run();

  await recordAuditLog(
    env,
    actor,
    'blog.redirect_301',
    `${params.locale}: ${oldSlug} -> ${newSlug}`,
    nowMs
  );
}

interface NormalizedTranslationPayload {
  locale: string;
  slug: string;
  title: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: string;
  readingTimeMinutes: number;
  quickAnswer: string | null;
  keyTakeaways: string[];
  introduction: string[];
  tableOfContents: BlogTocItem[];
  sections: BlogContentSection[];
  faq: BlogFaqItem[];
  ctaTitle: string | null;
  ctaDescription: string | null;
  ctaButtonLabel: string | null;
  internalLinks: BlogInternalLink[];
  sources: BlogSourceLink[];
  bodyMarkdown: string;
  status: BlogStatus;
  warnings: BlogValidationIssue[];
}

/**
 * Valide et normalise une traduction d'article (Markdown restreint -> sections + TOC,
 * unicité du slug par langue, longueurs SEO, liens HTTPS externes avec rel="noopener noreferrer").
 */
async function validateAndNormalizeTranslation(
  db: D1Database,
  articleId: string,
  rawLocale: string,
  rawInput: Record<string, unknown>,
  defaultStatus: BlogStatus
): Promise<
  | { ok: true; data: NormalizedTranslationPayload }
  | {
      ok: false;
      errors: BlogValidationIssue[];
      warnings: BlogValidationIssue[];
    }
> {
  const locale = String(rawLocale || rawInput.locale || '')
    .trim()
    .toLowerCase();
  const slug = String(rawInput.slug || '')
    .trim()
    .toLowerCase();
  const title = String(rawInput.title || '').trim();
  const excerpt = String(rawInput.excerpt || '').trim();
  const metaTitle = String(rawInput.metaTitle ?? rawInput.meta_title ?? '').trim();
  const metaDescription = String(
    rawInput.metaDescription ?? rawInput.meta_description ?? ''
  ).trim();
  const primaryKeyword = String(
    rawInput.primaryKeyword ?? rawInput.primary_keyword ?? ''
  ).trim();
  const searchIntent = String(
    rawInput.searchIntent ?? rawInput.search_intent ?? ''
  ).trim();
  const quickAnswerRaw =
    rawInput.quickAnswer ?? rawInput.quick_answer ?? null;
  const quickAnswer =
    typeof quickAnswerRaw === 'string' && quickAnswerRaw.trim()
      ? quickAnswerRaw.trim()
      : null;

  const secondaryKeywords = Array.isArray(rawInput.secondaryKeywords)
    ? rawInput.secondaryKeywords.map((s) => String(s).trim()).filter(Boolean)
    : Array.isArray(rawInput.secondary_keywords)
      ? rawInput.secondary_keywords.map((s) => String(s).trim()).filter(Boolean)
      : [];

  const keyTakeaways = Array.isArray(rawInput.keyTakeaways)
    ? rawInput.keyTakeaways.map((s) => String(s).trim()).filter(Boolean)
    : Array.isArray(rawInput.key_takeaways)
      ? rawInput.key_takeaways.map((s) => String(s).trim()).filter(Boolean)
      : [];

  const introduction = Array.isArray(rawInput.introduction)
    ? rawInput.introduction.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const faq: BlogFaqItem[] = Array.isArray(rawInput.faq)
    ? rawInput.faq
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const q = String(
            (item as Record<string, unknown>).question || ''
          ).trim();
          const a = String(
            (item as Record<string, unknown>).answer || ''
          ).trim();
          return q && a ? { question: q, answer: a } : null;
        })
        .filter((x): x is BlogFaqItem => x !== null)
    : [];

  const internalLinks: BlogInternalLink[] = Array.isArray(
    rawInput.internalLinks ?? rawInput.internal_links
  )
    ? (
        (rawInput.internalLinks ?? rawInput.internal_links) as Array<
          Record<string, unknown>
        >
      )
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const label = String(item.label || '').trim();
          const route = String(item.route || '').trim();
          if (!label || !route) return null;
          return {
            label,
            route: route as BlogInternalLink['route'],
            description: item.description
              ? String(item.description).trim()
              : undefined,
          };
        })
        .filter((x): x is BlogInternalLink => x !== null)
    : [];

  const sources: BlogSourceLink[] = Array.isArray(rawInput.sources)
    ? (rawInput.sources as Array<Record<string, unknown>>)
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const label = String(item.label || '').trim();
          const url = String(item.url || '').trim();
          if (!label || !url) return null;
          return {
            label,
            url,
            publisher: item.publisher
              ? String(item.publisher).trim()
              : undefined,
            rel: 'noopener noreferrer',
            target: '_blank',
          } as BlogSourceLink;
        })
        .filter((x): x is BlogSourceLink => x !== null)
    : [];

  let bodyMarkdown = String(
    rawInput.bodyMarkdown ?? rawInput.body_markdown ?? ''
  ).trim();
  if (!bodyMarkdown && Array.isArray(rawInput.sections)) {
    bodyMarkdown = sectionsToRestrictedMarkdown(
      rawInput.sections as BlogContentSection[]
    );
  }

  // Récupérer les slugs déjà utilisés dans cette langue par d'autres articles
  const existingRows = await db
    .prepare(
      `SELECT article_id, slug FROM blog_translations WHERE locale = ?`
    )
    .bind(locale)
    .all<{ article_id: string; slug: string }>();

  const existingSlugsInLocale = (existingRows.results || [])
    .filter((r) => String(r.article_id) !== articleId)
    .map((r) => String(r.slug).toLowerCase());

  const validation = validateBlogTranslationInput({
    locale,
    slug,
    title,
    excerpt,
    metaTitle,
    metaDescription,
    bodyMarkdown,
    quickAnswer: quickAnswer ?? undefined,
    keyTakeaways,
    introduction,
    faq,
    sources,
    existingSlugsInLocale,
  });

  if (!validation.valid || !validation.parsedBody) {
    return {
      ok: false,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  const requestedStatus = rawInput.status
    ? (String(rawInput.status).trim() as BlogStatus)
    : defaultStatus;
  const status: BlogStatus = VALID_BLOG_STATUSES.has(requestedStatus)
    ? requestedStatus
    : defaultStatus;

  const estimatedReadingTime =
    Number(rawInput.readingTimeMinutes ?? rawInput.reading_time_minutes) ||
    Math.max(1, Math.ceil(validation.parsedBody.wordCount / 200));

  return {
    ok: true,
    data: {
      locale,
      slug,
      title,
      excerpt,
      metaTitle,
      metaDescription,
      primaryKeyword,
      secondaryKeywords,
      searchIntent,
      readingTimeMinutes: estimatedReadingTime,
      quickAnswer,
      keyTakeaways,
      introduction,
      tableOfContents: validation.parsedBody.tableOfContents,
      sections: validation.parsedBody.sections,
      faq,
      ctaTitle:
        rawInput.ctaTitle != null || rawInput.cta_title != null
          ? String(rawInput.ctaTitle ?? rawInput.cta_title).trim() || null
          : null,
      ctaDescription:
        rawInput.ctaDescription != null || rawInput.cta_description != null
          ? String(rawInput.ctaDescription ?? rawInput.cta_description).trim() ||
            null
          : null,
      ctaButtonLabel:
        rawInput.ctaButtonLabel != null || rawInput.cta_button_label != null
          ? String(
              rawInput.ctaButtonLabel ?? rawInput.cta_button_label
            ).trim() || null
          : null,
      internalLinks,
      sources,
      bodyMarkdown,
      status,
      warnings: validation.warnings,
    },
  };
}

/**
 * Persiste une traduction validée dans `blog_translations`, gère la redirection 301
 * si le slug d'un article publié change, et enregistre une révision (max 10 par traduction).
 */
async function upsertValidatedTranslation(
  db: D1Database,
  env: AdminEnv,
  actor: string,
  article: D1BlogArticleRow,
  nextArticleStatus: BlogStatus,
  normalized: NormalizedTranslationPayload,
  nowMs = Date.now()
): Promise<void> {
  const existing = await db
    .prepare(
      `SELECT * FROM blog_translations WHERE article_id = ? AND locale = ?`
    )
    .bind(article.id, normalized.locale)
    .first<D1BlogTranslationRow>();

  const wasPublished =
    article.status === 'published' ||
    nextArticleStatus === 'published' ||
    existing?.status === 'published' ||
    normalized.status === 'published';

  if (existing) {
    const oldSlug = String(existing.slug).toLowerCase();
    const newSlug = normalized.slug.toLowerCase();

    await db
      .prepare(
        `UPDATE blog_translations SET
          slug = ?, title = ?, excerpt = ?, meta_title = ?, meta_description = ?,
          primary_keyword = ?, secondary_keywords = ?, search_intent = ?, reading_time_minutes = ?,
          quick_answer = ?, key_takeaways = ?, introduction = ?, table_of_contents = ?,
          content_sections = ?, faq = ?, cta_title = ?, cta_description = ?, cta_button_label = ?,
          internal_links = ?, sources = ?, body_markdown = ?, status = ?,
          updated_by = ?, updated_at = ?
        WHERE article_id = ? AND locale = ?`
      )
      .bind(
        normalized.slug,
        normalized.title,
        normalized.excerpt,
        normalized.metaTitle,
        normalized.metaDescription,
        normalized.primaryKeyword,
        JSON.stringify(normalized.secondaryKeywords),
        normalized.searchIntent,
        normalized.readingTimeMinutes,
        normalized.quickAnswer,
        JSON.stringify(normalized.keyTakeaways),
        JSON.stringify(normalized.introduction),
        JSON.stringify(normalized.tableOfContents),
        JSON.stringify(normalized.sections),
        JSON.stringify(normalized.faq),
        normalized.ctaTitle,
        normalized.ctaDescription,
        normalized.ctaButtonLabel,
        JSON.stringify(normalized.internalLinks),
        JSON.stringify(normalized.sources),
        normalized.bodyMarkdown,
        normalized.status,
        actor,
        nowMs,
        article.id,
        normalized.locale
      )
      .run();

    if (wasPublished && oldSlug !== newSlug) {
      await recordSlugRedirect301(
        db,
        env,
        actor,
        {
          articleId: article.id,
          locale: normalized.locale,
          oldSlug,
          newSlug,
        },
        nowMs
      );
    }
  } else {
    await db
      .prepare(
        `INSERT INTO blog_translations (
          article_id, locale, slug, title, excerpt, meta_title, meta_description,
          primary_keyword, secondary_keywords, search_intent, reading_time_minutes,
          quick_answer, key_takeaways, introduction, table_of_contents, content_sections,
          faq, cta_title, cta_description, cta_button_label, internal_links, sources,
          body_markdown, status, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        article.id,
        normalized.locale,
        normalized.slug,
        normalized.title,
        normalized.excerpt,
        normalized.metaTitle,
        normalized.metaDescription,
        normalized.primaryKeyword,
        JSON.stringify(normalized.secondaryKeywords),
        normalized.searchIntent,
        normalized.readingTimeMinutes,
        normalized.quickAnswer,
        JSON.stringify(normalized.keyTakeaways),
        JSON.stringify(normalized.introduction),
        JSON.stringify(normalized.tableOfContents),
        JSON.stringify(normalized.sections),
        JSON.stringify(normalized.faq),
        normalized.ctaTitle,
        normalized.ctaDescription,
        normalized.ctaButtonLabel,
        JSON.stringify(normalized.internalLinks),
        JSON.stringify(normalized.sources),
        normalized.bodyMarkdown,
        normalized.status,
        actor,
        nowMs,
        nowMs
      )
      .run();
  }

  await recordTranslationRevision(
    db,
    {
      articleId: article.id,
      locale: normalized.locale,
      slug: normalized.slug,
      title: normalized.title,
      metaTitle: normalized.metaTitle,
      metaDescription: normalized.metaDescription,
      bodyMarkdown: normalized.bodyMarkdown,
      snapshot: {
        slug: normalized.slug,
        title: normalized.title,
        excerpt: normalized.excerpt,
        metaTitle: normalized.metaTitle,
        metaDescription: normalized.metaDescription,
        primaryKeyword: normalized.primaryKeyword,
        secondaryKeywords: normalized.secondaryKeywords,
        searchIntent: normalized.searchIntent,
        readingTimeMinutes: normalized.readingTimeMinutes,
        quickAnswer: normalized.quickAnswer,
        keyTakeaways: normalized.keyTakeaways,
        introduction: normalized.introduction,
        tableOfContents: normalized.tableOfContents,
        sections: normalized.sections,
        faq: normalized.faq,
        ctaTitle: normalized.ctaTitle,
        ctaDescription: normalized.ctaDescription,
        ctaButtonLabel: normalized.ctaButtonLabel,
        internalLinks: normalized.internalLinks,
        sources: normalized.sources,
        bodyMarkdown: normalized.bodyMarkdown,
        status: normalized.status,
      },
      status: normalized.status,
      editedBy: actor,
    },
    nowMs
  );
}

/**
 * GET /api/admin/blog
 * - Nécessite au moins un droit `blog.*` (`blog.write`, `blog.edit_all`, `blog.delete`, `blog.publish`) ou le compte propriétaire.
 * - `?id=<articleId>` : retourne l'article détaillé, ses traductions, ses 10 dernières révisions par langue et ses redirections 301.
 * - Sans `id` : retourne la liste des articles, leurs traductions et la liste des redirections 301.
 */
export async function onRequestGet(context: {
  request: Request;
  env: AdminEnv;
}): Promise<Response> {
  const { request, env } = context;

  const auth = await requirePermission(request, env, BLOG_PERMISSIONS);
  if (!auth.ok) return auth.response;

  const db = getDb(env);
  if (!db) {
    return jsonResponse(
      { ok: false, errorCode: 'DB_UNAVAILABLE', message: 'Base D1 non configurée.' },
      503
    );
  }
  await ensureD1Schema(db);
  await purgeExpiredTrashedArticles(db);

  const url = new URL(request.url);
  const articleId = (url.searchParams.get('id') || '').trim();
  const localeFilter = (url.searchParams.get('locale') || '').trim().toLowerCase();

  if (articleId) {
    const article = await db
      .prepare(`SELECT * FROM blog_articles WHERE id = ?`)
      .bind(articleId)
      .first<D1BlogArticleRow>();

    if (!article) {
      return jsonResponse(
        { ok: false, errorCode: 'NOT_FOUND', message: 'Article introuvable.' },
        404
      );
    }

    const trRows = await db
      .prepare(`SELECT * FROM blog_translations WHERE article_id = ?`)
      .bind(articleId)
      .all<D1BlogTranslationRow>();

    const revRows = localeFilter
      ? await db
          .prepare(
            `SELECT * FROM blog_revisions WHERE article_id = ? AND locale = ? ORDER BY created_at DESC, id DESC LIMIT 10`
          )
          .bind(articleId, localeFilter)
          .all<D1BlogRevisionRow>()
      : await db
          .prepare(
            `SELECT * FROM blog_revisions WHERE article_id = ? ORDER BY created_at DESC, id DESC`
          )
          .bind(articleId)
          .all<D1BlogRevisionRow>();

    const allRedirects = await db
      .prepare(`SELECT * FROM blog_redirects`)
      .all<D1BlogRedirectRow>();

    const translations: Record<string, ReturnType<typeof hydrateTranslationRow>> = {};
    for (const row of trRows.results || []) {
      if (!localeFilter || row.locale === localeFilter) {
        translations[row.locale] = hydrateTranslationRow(row);
      }
    }

    const revisions = (revRows.results || []).map((r) => ({
      id: Number(r.id),
      articleId: String(r.article_id),
      locale: String(r.locale),
      slug: String(r.slug),
      title: String(r.title),
      metaTitle: String(r.meta_title),
      metaDescription: String(r.meta_description),
      bodyMarkdown: String(r.body_markdown),
      snapshot: safeJsonParse<Record<string, unknown>>(r.snapshot_json, {}),
      status: r.status as BlogStatus,
      editedBy: String(r.edited_by),
      createdAt: Number(r.created_at),
    }));

    const redirects = (allRedirects.results || [])
      .filter((r) => String(r.article_id) === articleId)
      .map((r) => ({
        id: Number(r.id),
        locale: String(r.locale),
        oldSlug: String(r.old_slug),
        newSlug: String(r.new_slug),
        articleId: String(r.article_id),
        statusCode: Number(r.status_code) || 301,
        createdAt: Number(r.created_at),
      }));

    return jsonResponse({
      ok: true,
      article: {
        id: String(article.id),
        category: String(article.category),
        toolRoute: article.tool_route,
        secondaryToolRoute: article.secondary_tool_route,
        status: article.status,
        previousStatus: article.previous_status,
        trashedAt: article.trashed_at,
        createdBy: String(article.created_by),
        updatedBy: String(article.updated_by),
        publishedAt: article.published_at,
        createdAt: Number(article.created_at),
        updatedAt: Number(article.updated_at),
        translations,
      },
      revisions,
      redirects,
    });
  }

  const [articlesRes, translationsRes, redirectsRes] = await Promise.all([
    db.prepare(`SELECT * FROM blog_articles`).all<D1BlogArticleRow>(),
    db.prepare(`SELECT * FROM blog_translations`).all<D1BlogTranslationRow>(),
    db.prepare(`SELECT * FROM blog_redirects`).all<D1BlogRedirectRow>(),
  ]);

  const translationsByArticle = new Map<
    string,
    Record<string, ReturnType<typeof hydrateTranslationRow>>
  >();
  for (const row of translationsRes.results || []) {
    if (localeFilter && row.locale !== localeFilter) continue;
    const map = translationsByArticle.get(row.article_id) || {};
    map[row.locale] = hydrateTranslationRow(row);
    translationsByArticle.set(row.article_id, map);
  }

  const statusFilter = (url.searchParams.get('status') || '').trim();
  const articles = (articlesRes.results || [])
    .filter((a) => (!statusFilter ? true : a.status === statusFilter))
    .map((a) => ({
      id: String(a.id),
      category: String(a.category),
      toolRoute: a.tool_route,
      secondaryToolRoute: a.secondary_tool_route,
      status: a.status,
      previousStatus: a.previous_status,
      trashedAt: a.trashed_at,
      createdBy: String(a.created_by),
      updatedBy: String(a.updated_by),
      publishedAt: a.published_at,
      createdAt: Number(a.created_at),
      updatedAt: Number(a.updated_at),
      translations: translationsByArticle.get(a.id) || {},
    }));

  const redirects = (redirectsRes.results || []).map((r) => ({
    id: Number(r.id),
    locale: String(r.locale),
    oldSlug: String(r.old_slug),
    newSlug: String(r.new_slug),
    articleId: String(r.article_id),
    statusCode: Number(r.status_code) || 301,
    createdAt: Number(r.created_at),
  }));

  return jsonResponse({
    ok: true,
    articles,
    redirects,
  });
}

/**
 * POST / PUT /api/admin/blog
 * Actions supportées :
 * - `create` : Création d'un article (`blog.write` ou `blog.edit_all` ou propriétaire)
 * - `update` : Modification d'un article (`blog.write` sur ses propres articles, `blog.edit_all` sur ceux d'autrui)
 * - `submit_review` : Passage en relecture `in_review` (`blog.write` sur ses propres articles, `blog.edit_all` sur ceux d'autrui)
 * - `trash` : Mise à la corbeille 30 j (`blog.delete` ou propriétaire)
 * - `restore` : Restauration depuis la corbeille (`blog.delete` ou propriétaire)
 * - `restore_revision` : Restauration d'une des 10 dernières révisions d'une traduction
 * - `publish` / `unpublish` : Publication / dépublication (`blog.publish` ou propriétaire exclusivement)
 * - `import_existing` : Import sans doublon de `src/data/blogArticles.ts` vers D1 (propriétaire exclusivement)
 */
export async function onRequestPost(context: {
  request: Request;
  env: AdminEnv;
}): Promise<Response> {
  const { request, env } = context;

  const csrf = verifyCsrfAndJson(request);
  if (!csrf.ok) {
    return jsonResponse(
      { ok: false, errorCode: 'CSRF_REJECTED', message: csrf.error },
      403
    );
  }

  const baseAuth = await requirePermission(request, env, BLOG_PERMISSIONS);
  if (!baseAuth.ok) return baseAuth.response;
  const principal = baseAuth.principal;

  const db = getDb(env);
  if (!db) {
    return jsonResponse(
      { ok: false, errorCode: 'DB_UNAVAILABLE', message: 'Base D1 non configurée.' },
      503
    );
  }
  await ensureD1Schema(db);
  await purgeExpiredTrashedArticles(db);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse(
      { ok: false, errorCode: 'INVALID_JSON', message: 'Corps JSON invalide.' },
      400
    );
  }

  const action = String(
    body.action || (request.method === 'PUT' ? 'update' : 'create')
  )
    .trim()
    .toLowerCase();
  const nowMs = Date.now();

  // ---------------------------------------------------------------------------
  // ACTION 1 : Importer les articles existants (réservé au propriétaire)
  // ---------------------------------------------------------------------------
  if (action === 'import_existing') {
    const ownerCheck = await requirePermission(request, env, 'owner');
    if (!ownerCheck.ok) return ownerCheck.response;

    let importedArticles = 0;
    let skippedArticles = 0;
    let importedTranslations = 0;
    let skippedTranslations = 0;

    for (const staticArticle of BLOG_ARTICLES) {
      const existingArt = await db
        .prepare(`SELECT * FROM blog_articles WHERE id = ?`)
        .bind(staticArticle.id)
        .first<D1BlogArticleRow>();

      if (!existingArt) {
        await db
          .prepare(
            `INSERT INTO blog_articles (
              id, category, tool_route, secondary_tool_route, status,
              previous_status, trashed_at, created_by, updated_by,
              published_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'published', 'published', NULL, ?, ?, ?, ?, ?)`
          )
          .bind(
            staticArticle.id,
            staticArticle.category,
            staticArticle.toolRoute ?? null,
            staticArticle.secondaryToolRoute ?? null,
            principal.login,
            principal.login,
            staticArticle.publishedAt,
            nowMs,
            nowMs
          )
          .run();
        importedArticles++;
      } else {
        skippedArticles++;
      }

      for (const [locale, tr] of Object.entries(staticArticle.translations)) {
        const existingTr = await db
          .prepare(
            `SELECT * FROM blog_translations WHERE article_id = ? AND locale = ?`
          )
          .bind(staticArticle.id, locale)
          .first<D1BlogTranslationRow>();

        const existingSlug = await db
          .prepare(
            `SELECT * FROM blog_translations WHERE locale = ? AND slug = ?`
          )
          .bind(locale, tr.slug)
          .first<D1BlogTranslationRow>();

        if (existingTr || existingSlug) {
          skippedTranslations++;
          continue;
        }

        const bodyMarkdown = sectionsToRestrictedMarkdown(tr.sections);
        const parsedMd = parseRestrictedBlogMarkdown(bodyMarkdown);
        const sections =
          parsedMd.errors.length === 0 && parsedMd.sections.length > 0
            ? parsedMd.sections
            : tr.sections;
        const toc =
          parsedMd.errors.length === 0 && parsedMd.tableOfContents.length > 0
            ? parsedMd.tableOfContents
            : tr.tableOfContents;
        const sanitizedSources = (tr.sources || []).map((s) => ({
          ...s,
          rel: 'noopener noreferrer',
          target: '_blank',
        }));

        await db
          .prepare(
            `INSERT INTO blog_translations (
              article_id, locale, slug, title, excerpt, meta_title, meta_description,
              primary_keyword, secondary_keywords, search_intent, reading_time_minutes,
              quick_answer, key_takeaways, introduction, table_of_contents, content_sections,
              faq, cta_title, cta_description, cta_button_label, internal_links, sources,
              body_markdown, status, updated_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)`
          )
          .bind(
            staticArticle.id,
            locale,
            tr.slug,
            tr.title,
            tr.excerpt,
            tr.metaTitle,
            tr.metaDescription,
            tr.primaryKeyword,
            JSON.stringify(tr.secondaryKeywords || []),
            tr.searchIntent,
            tr.readingTimeMinutes,
            tr.quickAnswer ?? null,
            JSON.stringify(tr.keyTakeaways || []),
            JSON.stringify(tr.introduction || []),
            JSON.stringify(toc),
            JSON.stringify(sections),
            JSON.stringify(tr.faq || []),
            tr.ctaTitle ?? null,
            tr.ctaDescription ?? null,
            tr.ctaButtonLabel ?? null,
            JSON.stringify(tr.internalLinks || []),
            JSON.stringify(sanitizedSources),
            bodyMarkdown,
            principal.login,
            nowMs,
            nowMs
          )
          .run();

        await recordTranslationRevision(
          db,
          {
            articleId: staticArticle.id,
            locale,
            slug: tr.slug,
            title: tr.title,
            metaTitle: tr.metaTitle,
            metaDescription: tr.metaDescription,
            bodyMarkdown,
            snapshot: {
              slug: tr.slug,
              title: tr.title,
              excerpt: tr.excerpt,
              metaTitle: tr.metaTitle,
              metaDescription: tr.metaDescription,
              primaryKeyword: tr.primaryKeyword,
              secondaryKeywords: tr.secondaryKeywords || [],
              searchIntent: tr.searchIntent,
              readingTimeMinutes: tr.readingTimeMinutes,
              quickAnswer: tr.quickAnswer ?? null,
              keyTakeaways: tr.keyTakeaways || [],
              introduction: tr.introduction || [],
              tableOfContents: toc,
              sections,
              faq: tr.faq || [],
              ctaTitle: tr.ctaTitle ?? null,
              ctaDescription: tr.ctaDescription ?? null,
              ctaButtonLabel: tr.ctaButtonLabel ?? null,
              internalLinks: tr.internalLinks || [],
              sources: sanitizedSources,
              bodyMarkdown,
              status: 'published',
            },
            status: 'published',
            editedBy: principal.login,
          },
          nowMs
        );

        importedTranslations++;
      }
    }

    await recordAuditLog(
      env,
      principal.login,
      'blog.import_existing',
      `articles=${importedArticles}, translations=${importedTranslations}`,
      nowMs
    );

    return jsonResponse({
      ok: true,
      importedArticles,
      skippedArticles,
      importedTranslations,
      skippedTranslations,
    });
  }

  // ---------------------------------------------------------------------------
  // ACTION 2 : Création d'un article (`create`)
  // ---------------------------------------------------------------------------
  if (action === 'create') {
    const writeCheck = await requirePermission(request, env, [
      'blog.write',
      'blog.edit_all',
    ]);
    if (!writeCheck.ok) return writeCheck.response;

    const rawId = String(body.id || body.articleId || '')
      .trim()
      .toLowerCase();
    if (!rawId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawId)) {
      return jsonResponse(
        {
          ok: false,
          errorCode: 'INVALID_ARTICLE_ID',
          message:
            "L'identifiant de l'article doit être en lettres latines minuscules, chiffres et tirets.",
        },
        400
      );
    }

    const existing = await db
      .prepare(`SELECT * FROM blog_articles WHERE id = ?`)
      .bind(rawId)
      .first<D1BlogArticleRow>();
    if (existing) {
      return jsonResponse(
        {
          ok: false,
          errorCode: 'ARTICLE_ALREADY_EXISTS',
          message: 'Un article avec cet identifiant existe déjà.',
        },
        409
      );
    }

    const requestedStatus = body.status
      ? (String(body.status).trim() as BlogStatus)
      : 'draft';

    // Règle stricte : un compte sans blog.publish ne peut jamais passer un article en published
    if (requestedStatus === 'published' && !hasPublishPermission(principal)) {
      return jsonResponse(
        {
          ok: false,
          errorCode: 'FORBIDDEN',
          message:
            'Accès refusé : le droit blog.publish est requis pour publier un article.',
        },
        403
      );
    }

    const rawTranslations = (body.translations || {}) as Record<
      string,
      Record<string, unknown>
    >;
    if (body.translation && typeof body.translation === 'object') {
      const trObj = body.translation as Record<string, unknown>;
      const loc = String(trObj.locale || body.locale || 'fr')
        .trim()
        .toLowerCase();
      rawTranslations[loc] = trObj;
    }

    const localeEntries = Object.entries(rawTranslations);
    if (localeEntries.length === 0) {
      return jsonResponse(
        {
          ok: false,
          errorCode: 'MISSING_TRANSLATION',
          message: 'Au moins une traduction est requise pour créer un article.',
        },
        400
      );
    }

    const normalizedTranslations: NormalizedTranslationPayload[] = [];
    const allErrors: BlogValidationIssue[] = [];
    const allWarnings: BlogValidationIssue[] = [];

    for (const [loc, trInput] of localeEntries) {
      if (
        trInput &&
        trInput.status === 'published' &&
        !hasPublishPermission(principal)
      ) {
        return jsonResponse(
          {
            ok: false,
            errorCode: 'FORBIDDEN',
            message:
              'Accès refusé : le droit blog.publish est requis pour publier une traduction.',
          },
          403
        );
      }

      const norm = await validateAndNormalizeTranslation(
        db,
        rawId,
        loc,
        trInput || {},
        VALID_BLOG_STATUSES.has(requestedStatus) ? requestedStatus : 'draft'
      );
      if (!norm.ok) {
        allErrors.push(...norm.errors);
        allWarnings.push(...norm.warnings);
      } else {
        normalizedTranslations.push(norm.data);
        allWarnings.push(...norm.data.warnings);
      }
    }

    if (allErrors.length > 0) {
      return jsonResponse(
        {
          ok: false,
          errorCode: 'VALIDATION_ERROR',
          message: allErrors[0].message,
          errors: allErrors,
          warnings: allWarnings,
        },
        400
      );
    }

    const categoryRaw = String(body.category || 'tutorials').trim() as BlogCategoryId;
    const category: BlogCategoryId = VALID_CATEGORIES.has(categoryRaw)
      ? categoryRaw
      : 'tutorials';
    const status: BlogStatus = VALID_BLOG_STATUSES.has(requestedStatus)
      ? requestedStatus
      : 'draft';
    const publishedAt =
      status === 'published'
        ? String(body.publishedAt || new Date(nowMs).toISOString().slice(0, 10))
        : null;

    const articleRow: D1BlogArticleRow = {
      id: rawId,
      category,
      tool_route: body.toolRoute ? String(body.toolRoute).trim() : null,
      secondary_tool_route: body.secondaryToolRoute
        ? String(body.secondaryToolRoute).trim()
        : null,
      status,
      previous_status: status,
      trashed_at: null,
      created_by: principal.login,
      updated_by: principal.login,
      published_at: publishedAt,
      created_at: nowMs,
      updated_at: nowMs,
    };

    await db
      .prepare(
        `INSERT INTO blog_articles (
          id, category, tool_route, secondary_tool_route, status,
          previous_status, trashed_at, created_by, updated_by,
          published_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`
      )
      .bind(
        articleRow.id,
        articleRow.category,
        articleRow.tool_route,
        articleRow.secondary_tool_route,
        articleRow.status,
        articleRow.previous_status,
        articleRow.created_by,
        articleRow.updated_by,
        articleRow.published_at,
        articleRow.created_at,
        articleRow.updated_at
      )
      .run();

    for (const norm of normalizedTranslations) {
      await upsertValidatedTranslation(
        db,
        env,
        principal.login,
        articleRow,
        status,
        norm,
        nowMs
      );
    }

    await recordAuditLog(
      env,
      principal.login,
      'blog.create',
      `${rawId} (${status})`,
      nowMs
    );

    return jsonResponse(
      {
        ok: true,
        articleId: rawId,
        status,
        warnings: allWarnings,
      },
      201
    );
  }

  // Pour toutes les autres actions, un article existant est requis
  const articleId = String(body.id || body.articleId || '').trim();
  if (!articleId) {
    return jsonResponse(
      {
        ok: false,
        errorCode: 'MISSING_ARTICLE_ID',
        message: "Identifiant d'article manquant.",
      },
      400
    );
  }

  const existingArticle = await db
    .prepare(`SELECT * FROM blog_articles WHERE id = ?`)
    .bind(articleId)
    .first<D1BlogArticleRow>();

  if (!existingArticle) {
    return jsonResponse(
      { ok: false, errorCode: 'NOT_FOUND', message: 'Article introuvable.' },
      404
    );
  }

  // ---------------------------------------------------------------------------
  // ACTION 3 : Modification d'un article (`update`)
  // ---------------------------------------------------------------------------
  if (action === 'update') {
    if (!canEditArticle(principal, existingArticle.created_by)) {
      return jsonResponse(
        {
          ok: false,
          errorCode: 'FORBIDDEN',
          message:
            "Accès refusé : le droit blog.edit_all est requis pour modifier l'article d'un autre auteur.",
        },
        403
      );
    }

    const requestedStatus = body.status
      ? (String(body.status).trim() as BlogStatus)
      : undefined;

    if (requestedStatus === 'published' && !hasPublishPermission(principal)) {
      return jsonResponse(
        {
          ok: false,
          errorCode: 'FORBIDDEN',
          message:
            'Accès refusé : le droit blog.publish est requis pour publier un article.',
        },
        403
      );
    }

    // Un compte sans blog.publish ne peut jamais maintenir ou passer un article en published
    let nextStatus: BlogStatus =
      requestedStatus && VALID_BLOG_STATUSES.has(requestedStatus)
        ? requestedStatus
        : existingArticle.status;
    if (nextStatus === 'published' && !hasPublishPermission(principal)) {
      nextStatus = 'in_review';
    }

    const rawTranslations = (body.translations || {}) as Record<
      string,
      Record<string, unknown>
    >;
    if (body.translation && typeof body.translation === 'object') {
      const trObj = body.translation as Record<string, unknown>;
      const loc = String(trObj.locale || body.locale || 'fr')
        .trim()
        .toLowerCase();
      rawTranslations[loc] = trObj;
    }

    const normalizedTranslations: NormalizedTranslationPayload[] = [];
    const allErrors: BlogValidationIssue[] = [];
    const allWarnings: BlogValidationIssue[] = [];

    for (const [loc, trInput] of Object.entries(rawTranslations)) {
      if (
        trInput &&
        trInput.status === 'published' &&
        !hasPublishPermission(principal)
      ) {
        return jsonResponse(
          {
            ok: false,
            errorCode: 'FORBIDDEN',
            message:
              'Accès refusé : le droit blog.publish est requis pour publier une traduction.',
          },
          403
        );
      }

      const norm = await validateAndNormalizeTranslation(
        db,
        articleId,
        loc,
        trInput || {},
        nextStatus
      );
      if (!norm.ok) {
        allErrors.push(...norm.errors);
        allWarnings.push(...norm.warnings);
      } else {
        if (
          norm.data.status === 'published' &&
          !hasPublishPermission(principal)
        ) {
          norm.data.status = 'in_review';
        }
        normalizedTranslations.push(norm.data);
        allWarnings.push(...norm.data.warnings);
      }
    }

    if (allErrors.length > 0) {
      return jsonResponse(
        {
          ok: false,
          errorCode: 'VALIDATION_ERROR',
          message: allErrors[0].message,
          errors: allErrors,
          warnings: allWarnings,
        },
        400
      );
    }

    const nextCategory =
      body.category && VALID_CATEGORIES.has(String(body.category) as BlogCategoryId)
        ? String(body.category)
        : existingArticle.category;
    const nextToolRoute =
      body.toolRoute !== undefined
        ? body.toolRoute
          ? String(body.toolRoute).trim()
          : null
        : existingArticle.tool_route;
    const nextSecondaryToolRoute =
      body.secondaryToolRoute !== undefined
        ? body.secondaryToolRoute
          ? String(body.secondaryToolRoute).trim()
          : null
        : existingArticle.secondary_tool_route;
    const nextPublishedAt =
      nextStatus === 'published'
        ? existingArticle.published_at ||
          new Date(nowMs).toISOString().slice(0, 10)
        : existingArticle.published_at;

    await db
      .prepare(
        `UPDATE blog_articles SET
          category = ?, tool_route = ?, secondary_tool_route = ?,
          status = ?, previous_status = ?, trashed_at = ?,
          updated_by = ?, published_at = ?, updated_at = ?
        WHERE id = ?`
      )
      .bind(
        nextCategory,
        nextToolRoute,
        nextSecondaryToolRoute,
        nextStatus,
        nextStatus !== 'trashed'
          ? nextStatus
          : existingArticle.previous_status,
        nextStatus === 'trashed' ? nowMs : null,
        principal.login,
        nextPublishedAt,
        nowMs,
        articleId
      )
      .run();

    for (const norm of normalizedTranslations) {
      await upsertValidatedTranslation(
        db,
        env,
        principal.login,
        existingArticle,
        nextStatus,
        norm,
        nowMs
      );
    }

    await recordAuditLog(
      env,
      principal.login,
      'blog.update',
      `${articleId} (${nextStatus})`,
      nowMs
    );

    return jsonResponse({
      ok: true,
      articleId,
      status: nextStatus,
      warnings: allWarnings,
    });
  }

  // ---------------------------------------------------------------------------
  // ACTION 4 : Soumission en relecture (`submit_review` -> `in_review`)
  // ---------------------------------------------------------------------------
  if (action === 'submit_review') {
    if (!canEditArticle(principal, existingArticle.created_by)) {
      return jsonResponse(
        {
          ok: false,
          errorCode: 'FORBIDDEN',
          message: 'Accès refusé.',
        },
        403
      );
    }

    await db
      .prepare(
        `UPDATE blog_articles SET status = ?, previous_status = ?, trashed_at = ?, updated_by = ?, published_at = ?, updated_at = ? WHERE id = ?`
      )
      .bind(
        'in_review',
        'in_review',
        null,
        principal.login,
        existingArticle.published_at,
        nowMs,
        articleId
      )
      .run();

    if (body.locale) {
      await db
        .prepare(
          `UPDATE blog_translations SET status = ?, updated_by = ?, updated_at = ? WHERE article_id = ? AND locale = ?`
        )
        .bind(
          'in_review',
          principal.login,
          nowMs,
          articleId,
          String(body.locale).trim().toLowerCase()
        )
        .run();
    } else {
      await db
        .prepare(
          `UPDATE blog_translations SET status = ?, updated_by = ?, updated_at = ? WHERE article_id = ?`
        )
        .bind('in_review', principal.login, nowMs, articleId)
        .run();
    }

    await recordAuditLog(
      env,
      principal.login,
      'blog.submit_review',
      articleId,
      nowMs
    );

    return jsonResponse({
      ok: true,
      articleId,
      status: 'in_review',
    });
  }

  // ---------------------------------------------------------------------------
  // ACTION 5 : Mise à la corbeille / restauration 30 j (`trash` / `restore`)
  // ---------------------------------------------------------------------------
  if (action === 'trash') {
    const delCheck = await requirePermission(request, env, 'blog.delete');
    if (!delCheck.ok) return delCheck.response;

    const prevStatus =
      existingArticle.status !== 'trashed'
        ? existingArticle.status
        : existingArticle.previous_status || 'draft';

    await db
      .prepare(
        `UPDATE blog_articles SET status = ?, previous_status = ?, trashed_at = ?, updated_by = ?, published_at = ?, updated_at = ? WHERE id = ?`
      )
      .bind(
        'trashed',
        prevStatus,
        nowMs,
        principal.login,
        existingArticle.published_at,
        nowMs,
        articleId
      )
      .run();

    await db
      .prepare(
        `UPDATE blog_translations SET status = ?, updated_by = ?, updated_at = ? WHERE article_id = ?`
      )
      .bind('trashed', principal.login, nowMs, articleId)
      .run();

    await recordAuditLog(env, principal.login, 'blog.trash', articleId, nowMs);

    return jsonResponse({
      ok: true,
      articleId,
      status: 'trashed',
      trashedAt: nowMs,
      retentionExpiresAt: nowMs + TRASH_RETENTION_MS,
    });
  }

  if (action === 'restore') {
    const delCheck = await requirePermission(request, env, 'blog.delete');
    if (!delCheck.ok) return delCheck.response;

    if (
      body.status === 'published' &&
      !hasPublishPermission(principal)
    ) {
      return jsonResponse(
        {
          ok: false,
          errorCode: 'FORBIDDEN',
          message:
            'Accès refusé : le droit blog.publish est requis pour restaurer directement en statut publié.',
        },
        403
      );
    }

    let restoredStatus: BlogStatus =
      (existingArticle.previous_status as BlogStatus) || 'draft';
    if (restoredStatus === 'trashed') restoredStatus = 'draft';
    if (restoredStatus === 'published' && !hasPublishPermission(principal)) {
      restoredStatus = 'draft';
    }

    await db
      .prepare(
        `UPDATE blog_articles SET status = ?, previous_status = ?, trashed_at = ?, updated_by = ?, published_at = ?, updated_at = ? WHERE id = ?`
      )
      .bind(
        restoredStatus,
        restoredStatus,
        null,
        principal.login,
        existingArticle.published_at,
        nowMs,
        articleId
      )
      .run();

    await db
      .prepare(
        `UPDATE blog_translations SET status = ?, updated_by = ?, updated_at = ? WHERE article_id = ?`
      )
      .bind(restoredStatus, principal.login, nowMs, articleId)
      .run();

    await recordAuditLog(
      env,
      principal.login,
      'blog.restore',
      `${articleId} (${restoredStatus})`,
      nowMs
    );

    return jsonResponse({
      ok: true,
      articleId,
      status: restoredStatus,
    });
  }

  // ---------------------------------------------------------------------------
  // ACTION 6 : Restauration d'une révision (`restore_revision`)
  // ---------------------------------------------------------------------------
  if (action === 'restore_revision') {
    if (!canEditArticle(principal, existingArticle.created_by)) {
      return jsonResponse(
        {
          ok: false,
          errorCode: 'FORBIDDEN',
          message: 'Accès refusé.',
        },
        403
      );
    }

    const revisionId = Number(body.revisionId);
    if (!Number.isFinite(revisionId) || revisionId <= 0) {
      return jsonResponse(
        {
          ok: false,
          errorCode: 'INVALID_REVISION_ID',
          message: 'Identifiant de révision invalide.',
        },
        400
      );
    }

    const revRow = await db
      .prepare(`SELECT * FROM blog_revisions WHERE id = ?`)
      .bind(revisionId)
      .first<D1BlogRevisionRow>();

    if (!revRow || String(revRow.article_id) !== articleId) {
      return jsonResponse(
        {
          ok: false,
          errorCode: 'REVISION_NOT_FOUND',
          message: 'Révision introuvable pour cet article.',
        },
        404
      );
    }

    const snapshot = safeJsonParse<Record<string, unknown>>(
      revRow.snapshot_json,
      {}
    );
    const targetStatus: BlogStatus =
      revRow.status === 'published' && !hasPublishPermission(principal)
        ? 'draft'
        : (revRow.status as BlogStatus) || 'draft';

    const norm = await validateAndNormalizeTranslation(
      db,
      articleId,
      revRow.locale,
      {
        ...snapshot,
        slug: revRow.slug,
        title: revRow.title,
        metaTitle: revRow.meta_title,
        metaDescription: revRow.meta_description,
        bodyMarkdown: revRow.body_markdown,
        status: targetStatus,
      },
      targetStatus
    );

    if (!norm.ok) {
      return jsonResponse(
        {
          ok: false,
          errorCode: 'VALIDATION_ERROR',
          message: norm.errors[0]?.message || 'Révision invalide.',
          errors: norm.errors,
        },
        400
      );
    }

    await upsertValidatedTranslation(
      db,
      env,
      principal.login,
      existingArticle,
      existingArticle.status === 'published' && !hasPublishPermission(principal)
        ? 'in_review'
        : existingArticle.status,
      norm.data,
      nowMs
    );

    await recordAuditLog(
      env,
      principal.login,
      'blog.restore_revision',
      `${articleId}/${revRow.locale}#${revisionId}`,
      nowMs
    );

    return jsonResponse({
      ok: true,
      articleId,
      locale: revRow.locale,
      restoredRevisionId: revisionId,
    });
  }

  // ---------------------------------------------------------------------------
  // ACTION 7 : Publication / Dépublication (`publish` / `unpublish`)
  // ---------------------------------------------------------------------------
  if (action === 'publish' || action === 'unpublish') {
    const pubCheck = await requirePermission(request, env, 'blog.publish');
    if (!pubCheck.ok) return pubCheck.response;

    const targetStatus: BlogStatus =
      action === 'publish' ? 'published' : 'draft';

    if (targetStatus === 'published') {
      const trs = await db
        .prepare(`SELECT * FROM blog_translations WHERE article_id = ?`)
        .bind(articleId)
        .all<D1BlogTranslationRow>();

      if (!trs.results || trs.results.length === 0) {
        return jsonResponse(
          {
            ok: false,
            errorCode: 'MISSING_TRANSLATION',
            message:
              'Impossible de publier un article sans aucune traduction valide.',
          },
          400
        );
      }
    }

    const publishedAt =
      targetStatus === 'published'
        ? existingArticle.published_at ||
          new Date(nowMs).toISOString().slice(0, 10)
        : existingArticle.published_at;

    await db
      .prepare(
        `UPDATE blog_articles SET status = ?, previous_status = ?, trashed_at = ?, updated_by = ?, published_at = ?, updated_at = ? WHERE id = ?`
      )
      .bind(
        targetStatus,
        targetStatus,
        null,
        principal.login,
        publishedAt,
        nowMs,
        articleId
      )
      .run();

    if (body.locale) {
      await db
        .prepare(
          `UPDATE blog_translations SET status = ?, updated_by = ?, updated_at = ? WHERE article_id = ? AND locale = ?`
        )
        .bind(
          targetStatus,
          principal.login,
          nowMs,
          articleId,
          String(body.locale).trim().toLowerCase()
        )
        .run();
    } else {
      await db
        .prepare(
          `UPDATE blog_translations SET status = ?, updated_by = ?, updated_at = ? WHERE article_id = ?`
        )
        .bind(targetStatus, principal.login, nowMs, articleId)
        .run();
    }

    await recordAuditLog(
      env,
      principal.login,
      action === 'publish' ? 'blog.publish' : 'blog.unpublish',
      articleId,
      nowMs
    );

    return jsonResponse({
      ok: true,
      articleId,
      status: targetStatus,
      publishedAt,
    });
  }

  return jsonResponse(
    {
      ok: false,
      errorCode: 'UNKNOWN_ACTION',
      message: `Action non prise en charge : ${action}`,
    },
    400
  );
}

export async function onRequestPut(context: {
  request: Request;
  env: AdminEnv;
}): Promise<Response> {
  return onRequestPost(context);
}

export async function onRequestDelete(context: {
  request: Request;
  env: AdminEnv;
}): Promise<Response> {
  const { request, env } = context;

  const csrf = verifyCsrfAndJson(request);
  if (!csrf.ok) {
    return jsonResponse(
      { ok: false, errorCode: 'CSRF_REJECTED', message: csrf.error },
      403
    );
  }

  const delCheck = await requirePermission(request, env, 'blog.delete');
  if (!delCheck.ok) return delCheck.response;

  const url = new URL(request.url);
  let articleId = (url.searchParams.get('id') || '').trim();
  if (!articleId) {
    try {
      const body = (await request.clone().json()) as Record<string, unknown>;
      articleId = String(body.id || body.articleId || '').trim();
    } catch {
      // Ignore
    }
  }

  const synthReq = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ action: 'trash', id: articleId }),
  });

  return onRequestPost({ request: synthReq, env });
}
