import React, { useEffect, useMemo, useState } from 'react';
import {
  BLOG_ARTICLES,
  BLOG_CATEGORY_KEYS,
  type BlogCategoryKey,
  type BlogLocale,
  getBlogHomePath,
  getBlogUiLabels,
} from '../../data/blogArticles';
import type { PageKey, SupportedLocale } from '../../i18n/config';
import { BlogArticleView } from '../../components/BlogArticleView';
import { BlogIndexView } from '../../components/BlogIndexView';
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  FileText,
  Plus,
  RefreshCw,
} from './AdminIcons';
import { BlogEditor } from './BlogEditor';
import type { AdminUserProfile } from './Login';
import {
  BLOG_ADMIN_PERMISSIONS,
  type AdminBlogArticleItem,
  type AdminBlogStatusFilter,
  type AdminBlogTranslationSummary,
  buildUnifiedAdminBlogArticles,
  canWriteBlogArticle,
  filterAdminBlogArticles,
  hasBlogPermission,
} from './blogAdminLogic';

export {
  BLOG_ADMIN_PERMISSIONS,
  type AdminBlogArticleItem,
  type AdminBlogStatusFilter,
  type AdminBlogTranslationSummary,
  buildUnifiedAdminBlogArticles,
  filterAdminBlogArticles,
  hasBlogPermission,
};

interface BlogAdminProps {
  user: AdminUserProfile;
}

export const Blog: React.FC<BlogAdminProps> = ({ user }) => {
  const [d1Articles, setD1Articles] = useState<
     Parameters<typeof buildUnifiedAdminBlogArticles>[1]
  >([]);
  const [loadingD1, setLoadingD1] = useState(true);
  const [syncingD1, setSyncingD1] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [statusFilter, setStatusFilter] =
    useState<AdminBlogStatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Mode d'affichage : liste d'administration, éditeur de brouillon D1 ou aperçu interactif BlogIndexView
  const [viewMode, setViewMode] = useState<'list' | 'editor' | 'preview'>(
    'list'
  );
  const [previewLocale, setPreviewLocale] = useState<SupportedLocale>('en');
  const [previewArticleSlug, setPreviewArticleSlug] = useState<string | null>(
    null
  );

  const uiFr = getBlogUiLabels('fr');

  const canWrite = hasBlogPermission(user, 'blog.write');
  const canEditAll = hasBlogPermission(user, 'blog.edit_all');
  const canDelete = hasBlogPermission(user, 'blog.delete');
  const canPublish = hasBlogPermission(user, 'blog.publish');
  const canCreateDraft = canWriteBlogArticle(user);

  const loadD1BlogArticles = async () => {
    setLoadingD1(true);
    try {
      const res = await fetch('/api/admin/blog', {
        headers: { Accept: 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && Array.isArray(data.articles)) {
        setD1Articles(data.articles);
      }
    } catch {
      // Conservation du catalogue statique si D1 est hors ligne
    } finally {
      setLoadingD1(false);
    }
  };

  useEffect(() => {
    loadD1BlogArticles();
  }, []);

  const handleImportExistingToD1 = async () => {
    if (!user.isOwner || syncingD1) return;
    setSyncingD1(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/blog', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ action: 'import_existing' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setFeedback({
          type: 'success',
          message: `Synchronisation D1 terminée : ${data.importedArticles} article(s) et ${data.importedTranslations} traduction(s) importés (${data.skippedArticles} déjà présents).`,
        });
        await loadD1BlogArticles();
      } else {
        setFeedback({
          type: 'error',
          message:
            data.message || 'Impossible de synchroniser les articles avec D1.',
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'Erreur réseau lors de la synchronisation D1.',
      });
    } finally {
      setSyncingD1(false);
    }
  };

  const handleToggleArticleStatus = async (
    articleId: string,
    currentStatus: string
  ) => {
    if (!canPublish || togglingId) return;
    const nextAction = currentStatus === 'published' ? 'unpublish' : 'publish';
    setTogglingId(articleId);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/blog', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          action: nextAction,
          id: articleId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setFeedback({
          type: 'success',
          message: `Statut de l'article « ${articleId} » mis à jour : ${data.status === 'published' ? 'Publié' : 'Brouillon'}.`,
        });
        await loadD1BlogArticles();
      } else {
        setFeedback({
          type: 'error',
          message:
            data.message ||
            "Synchronisez d'abord le catalogue dans D1 avant de modifier le statut.",
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'Erreur réseau lors du changement de statut.',
      });
    } finally {
      setTogglingId(null);
    }
  };

  const allArticles = useMemo(
    () => buildUnifiedAdminBlogArticles(BLOG_ARTICLES, d1Articles),
    [d1Articles]
  );

  const filteredArticles = useMemo(
    () =>
      filterAdminBlogArticles(allArticles, {
        statusFilter,
        categoryFilter,
        searchQuery,
      }),
    [allArticles, statusFilter, categoryFilter, searchQuery]
  );

  const stats = useMemo(() => {
    let publishedCount = 0;
    let draftCount = 0;
    let publishedTranslationsCount = 0;
    let draftTranslationsCount = 0;

    for (const art of allArticles) {
      if (art.status === 'published') {
        publishedCount++;
      } else {
        draftCount++;
      }
      for (const tr of art.translations) {
        if (art.status === 'published' && tr.status === 'published') {
          publishedTranslationsCount++;
        } else {
          draftTranslationsCount++;
        }
      }
    }

    return {
      total: allArticles.length,
      publishedCount,
      draftCount,
      publishedTranslationsCount,
      draftTranslationsCount,
    };
  }, [allArticles]);

  const handleOpenIndexPreview = (
    targetLocale: SupportedLocale = 'en',
    targetSlug: string | null = null
  ) => {
    setPreviewLocale(targetLocale);
    setPreviewArticleSlug(targetSlug);
    setViewMode('preview');
  };

  const handlePreviewNavigatePath = (path: string) => {
    const clean = path.split('?')[0].split('#')[0];
    if (clean === '/fr/blog') {
      setPreviewLocale('fr');
      setPreviewArticleSlug(null);
      return;
    }
    if (clean === '/blog' || clean === '/en/blog') {
      setPreviewLocale('en');
      setPreviewArticleSlug(null);
      return;
    }
    const frMatch = clean.match(/^\/fr\/blog\/([^/]+)$/);
    if (frMatch) {
      setPreviewLocale('fr');
      setPreviewArticleSlug(frMatch[1]);
      return;
    }
    const enMatch = clean.match(/^\/(?:en\/)?blog\/([^/]+)$/);
    if (enMatch) {
      setPreviewLocale('en');
      setPreviewArticleSlug(enMatch[1]);
      return;
    }
  };

  const handlePreviewNavigatePage = (pageKey: PageKey) => {
    if (pageKey === 'blog') {
      setPreviewArticleSlug(null);
    }
  };

  const activePermissionsLabels: string[] = [];
  if (user.isOwner) {
    activePermissionsLabels.push('Propriétaire (accès complet)');
  } else {
    if (canWrite) activePermissionsLabels.push('blog.write');
    if (canEditAll) activePermissionsLabels.push('blog.edit_all');
    if (canDelete) activePermissionsLabels.push('blog.delete');
    if (canPublish) activePermissionsLabels.push('blog.publish');
  }

  return (
    <div className="space-y-6" data-testid="admin-blog-panel">
      {/* En-tête et actions principales */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-admin-border pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-admin-text-muted">
            <FileText className="w-4 h-4 text-[#c2410c]" />
            <span>CMS Éditorial Multilingue</span>
            <span aria-hidden="true">·</span>
            <span>Droits actifs : {activePermissionsLabels.join(' · ')}</span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-admin-text">
            Gestion du Blog ({stats.publishedCount} publiés · {stats.draftCount}{' '}
            brouillons)
          </h1>
          <p className="text-xs font-mono text-admin-text-secondary">
            Consultez les articles publiés et en brouillon, vérifiez les
            traductions par langue et prévisualisez le hub via BlogIndexView.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            role="group"
            aria-label="Mode d'affichage du blog"
            className="flex items-center gap-1 p-1 rounded-xl bg-admin-muted border border-admin-border-strong"
          >
            <button
              type="button"
              onClick={() => {
                setViewMode('list');
                setPreviewArticleSlug(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#c2410c] text-white shadow-sm'
                  : 'text-admin-text-secondary hover:text-admin-text'
              }`}
            >
              Articles ({allArticles.length})
            </button>
            <button
              type="button"
              data-testid="admin-blog-preview-toggle"
              onClick={() => handleOpenIndexPreview(previewLocale, null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'preview'
                  ? 'bg-[#c2410c] text-white shadow-sm'
                  : 'text-admin-text-secondary hover:text-admin-text'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Aperçu BlogIndexView</span>
            </button>
          </div>

          {canCreateDraft && (
            <button
              type="button"
              data-testid="admin-blog-open-editor"
              onClick={() => {
                setPreviewArticleSlug(null);
                setViewMode(viewMode === 'editor' ? 'list' : 'editor');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-display font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'editor'
                  ? 'bg-[#9a3412] text-white shadow'
                  : 'bg-[#c2410c] hover:bg-[#9a3412] text-white shadow'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nouvel article (Brouillon)</span>
            </button>
          )}

          {user.isOwner && (
            <button
              type="button"
              onClick={handleImportExistingToD1}
              disabled={syncingD1}
              className="px-3 py-2 rounded-xl bg-admin-surface hover:bg-admin-hover border border-admin-border-strong text-xs font-mono text-admin-text transition-colors cursor-pointer disabled:opacity-50"
            >
              {syncingD1 ? 'Synchronisation D1…' : 'Synchroniser D1'}
            </button>
          )}

          <button
            type="button"
            onClick={loadD1BlogArticles}
            disabled={loadingD1}
            aria-label="Actualiser la liste des articles"
            title="Actualiser la liste des articles"
            className="p-2 rounded-xl bg-admin-surface hover:bg-admin-hover border border-admin-border-strong text-admin-text transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${loadingD1 ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`rounded-xl p-3.5 text-xs font-mono border flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/30 border-emerald-700/50 text-emerald-300'
              : 'bg-red-950/30 border-red-700/50 text-red-300'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-admin-text-muted hover:text-admin-text cursor-pointer"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Synthèse statistique */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-admin-surface border border-admin-border rounded-xl p-4 space-y-1">
          <p className="text-[11px] font-mono text-admin-text-muted">
            Total articles
          </p>
          <p className="font-mono text-2xl font-bold text-admin-text tabular-nums">
            {stats.total}
          </p>
          <p className="text-[11px] font-mono text-admin-text-secondary">
            Catalogue éditorial complet
          </p>
        </div>

        <div className="bg-admin-surface border border-admin-border rounded-xl p-4 space-y-1">
          <p className="text-[11px] font-mono text-admin-text-muted">
            Articles publiés
          </p>
          <p className="font-mono text-2xl font-bold text-emerald-500 tabular-nums">
            {stats.publishedCount}
          </p>
          <p className="text-[11px] font-mono text-admin-text-secondary">
            Indexés dans sitemap.xml & llms.txt
          </p>
        </div>

        <div className="bg-admin-surface border border-admin-border rounded-xl p-4 space-y-1">
          <p className="text-[11px] font-mono text-admin-text-muted">
            Articles en brouillon
          </p>
          <p className="font-mono text-2xl font-bold text-amber-500 tabular-nums">
            {stats.draftCount}
          </p>
          <p className="text-[11px] font-mono text-admin-text-secondary">
            Non indexés publiquement
          </p>
        </div>

        <div className="bg-admin-surface border border-admin-border rounded-xl p-4 space-y-1">
          <p className="text-[11px] font-mono text-admin-text-muted">
            Traductions (Publiées / Brouillons)
          </p>
          <p className="font-mono text-2xl font-bold text-admin-text tabular-nums">
            {stats.publishedTranslationsCount}{' '}
            <span className="text-sm font-normal text-admin-text-muted">
              / {stats.draftTranslationsCount}
            </span>
          </p>
          <p className="text-[11px] font-mono text-admin-text-secondary">
            EN & FR publiées · AR, ES, DE en brouillon
          </p>
        </div>
      </div>

      {viewMode === 'editor' ? (
        <BlogEditor
          user={user}
          existingArticles={allArticles}
          onCreated={async (createdId) => {
            await loadD1BlogArticles();
            setViewMode('list');
            setFeedback({
              type: 'success',
              message: `Brouillon « ${createdId} » créé et enregistré dans la base D1.`,
            });
          }}
          onCancel={() => setViewMode('list')}
        />
      ) : viewMode === 'preview' ? (
        <section
          aria-label="Aperçu interactif BlogIndexView"
          data-testid="admin-blog-index-preview"
          className="bg-admin-surface border border-admin-border rounded-2xl overflow-hidden"
        >
          {/* Barre d'outils d'aperçu */}
          <div className="px-4 sm:px-6 py-3.5 bg-admin-muted border-b border-admin-border flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-display text-xs font-bold text-admin-text">
                Aperçu en direct :{' '}
                {previewArticleSlug ? 'BlogArticleView' : 'BlogIndexView'}
              </span>
              <span className="text-xs font-mono text-admin-text-muted">
                · Langue : {previewLocale.toUpperCase()}
              </span>
              {previewArticleSlug && (
                <button
                  type="button"
                  onClick={() => setPreviewArticleSlug(null)}
                  className="px-2.5 py-1 rounded-lg bg-admin-surface hover:bg-admin-hover border border-admin-border-strong text-xs font-mono text-admin-text cursor-pointer"
                >
                  ← Retour à BlogIndexView
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div
                role="group"
                aria-label="Langue de l'aperçu"
                className="flex items-center gap-1 p-1 rounded-lg bg-admin-surface border border-admin-border"
              >
                {(['en', 'fr'] as const).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => {
                      setPreviewLocale(loc);
                      setPreviewArticleSlug(null);
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-mono font-semibold cursor-pointer transition-colors ${
                      previewLocale === loc
                        ? 'bg-[#c2410c] text-white'
                        : 'text-admin-text-secondary hover:text-admin-text'
                    }`}
                  >
                    {loc.toUpperCase()} ({getBlogHomePath(loc as BlogLocale)})
                  </button>
                ))}
              </div>

              <a
                href={getBlogHomePath(previewLocale as BlogLocale)}
                className="px-3 py-1.5 rounded-lg bg-admin-surface hover:bg-admin-hover border border-admin-border-strong text-xs font-mono text-admin-text inline-flex items-center gap-1.5 transition-colors"
              >
                <span>Ouvrir {getBlogHomePath(previewLocale as BlogLocale)}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                onClick={() => {
                  setViewMode('list');
                  setPreviewArticleSlug(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-admin-surface hover:bg-admin-hover border border-admin-border-strong text-xs font-mono text-admin-text cursor-pointer"
              >
                Retour à la liste
              </button>
            </div>
          </div>

          {/* Rendu réel de BlogIndexView ou BlogArticleView */}
          <div className="bg-[#fffaf5] dark:bg-[#140e0a] text-[#1f130b] dark:text-[#fffaf5]">
            {previewArticleSlug ? (
              <BlogArticleView
                locale={previewLocale}
                blogSlug={previewArticleSlug}
                onNavigatePath={handlePreviewNavigatePath}
                onNavigatePage={handlePreviewNavigatePage}
              />
            ) : (
              <BlogIndexView
                locale={previewLocale}
                onNavigatePath={handlePreviewNavigatePath}
                onNavigatePage={handlePreviewNavigatePage}
              />
            )}
          </div>
        </section>
      ) : (
        /* Vue Liste des articles (publiés et brouillons) */
        <section className="space-y-4">
          {/* Barre de filtres */}
          <div className="bg-admin-surface border border-admin-border rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div
              role="group"
              aria-label="Filtrer par statut de publication"
              className="flex items-center gap-1 p-1 rounded-xl bg-admin-muted border border-admin-border"
            >
              {(
                [
                  { id: 'all', label: `Tous (${stats.total})` },
                  { id: 'published', label: `Publiés (${stats.publishedCount})` },
                  { id: 'draft', label: `Brouillons (${stats.draftCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  aria-pressed={statusFilter === tab.id}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-[#c2410c] text-white shadow-sm'
                      : 'text-admin-text-secondary hover:text-admin-text'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-xl">
              <label htmlFor="admin-blog-category-filter" className="sr-only">
                Filtrer par catégorie
              </label>
              <select
                id="admin-blog-category-filter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-admin-muted border border-admin-border-strong text-xs font-mono text-admin-text focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
              >
                <option value="all">Toutes les catégories</option>
                {BLOG_CATEGORY_KEYS.map((catKey) => (
                  <option key={catKey} value={catKey}>
                    {uiFr.categories[catKey as BlogCategoryKey] || catKey}
                  </option>
                ))}
              </select>

              <label htmlFor="admin-blog-search" className="sr-only">
                Rechercher un article
              </label>
              <input
                id="admin-blog-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrer par titre, slug ou ID…"
                className="flex-1 px-3.5 py-2 rounded-xl bg-admin-muted border border-admin-border-strong text-xs font-mono text-admin-text placeholder:text-admin-text-muted focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
              />
            </div>
          </div>

          {/* Liste des articles */}
          {filteredArticles.length === 0 ? (
            <div className="bg-admin-surface border border-admin-border rounded-2xl p-8 text-center space-y-2">
              <p className="font-display text-sm font-bold text-admin-text">
                Aucun article ne correspond aux filtres sélectionnés
              </p>
              <p className="text-xs font-mono text-admin-text-secondary">
                Essayez de réinitialiser le filtre de statut ou la recherche.
              </p>
            </div>
          ) : (
            <div className="space-y-3" data-testid="admin-blog-article-list">
              {filteredArticles.map((art) => {
                const primaryTr =
                  art.translations.find((t) => t.locale === 'fr') ||
                  art.translations.find((t) => t.locale === 'en') ||
                  art.translations[0];
                const enTr = art.translations.find((t) => t.locale === 'en');
                const frTr = art.translations.find((t) => t.locale === 'fr');
                const isPublished = art.status === 'published';
                const catLabel =
                  uiFr.categories[art.category as BlogCategoryKey] ||
                  art.category;

                return (
                  <article
                    key={art.id}
                    data-testid={`admin-blog-article-${art.id}`}
                    className="bg-admin-surface border border-admin-border rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:border-admin-border-strong transition-colors"
                  >
                    <div className="space-y-2 min-w-0 flex-1">
                      {/* Métadonnées typographiques sans pilules */}
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                        <span
                          className={
                            isPublished
                              ? 'text-emerald-500 font-bold'
                              : 'text-amber-500 font-bold'
                          }
                        >
                          {isPublished ? 'Publié' : 'Brouillon'}
                        </span>
                        <span aria-hidden="true" className="text-admin-text-muted">
                          ·
                        </span>
                        <span className="text-admin-text-secondary">
                          {catLabel}
                        </span>
                        <span aria-hidden="true" className="text-admin-text-muted">
                          ·
                        </span>
                        <span className="text-admin-text-muted tabular-nums">
                          Mis à jour le {art.updatedAt}
                        </span>
                        <span aria-hidden="true" className="text-admin-text-muted">
                          ·
                        </span>
                        <span className="text-admin-text-muted">
                          {art.authorName}
                        </span>
                        {art.inD1 && (
                          <>
                            <span
                              aria-hidden="true"
                              className="text-admin-text-muted"
                            >
                              ·
                            </span>
                            <span className="text-emerald-400 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>D1</span>
                            </span>
                          </>
                        )}
                      </div>

                      <h2 className="font-display text-base font-bold text-admin-text leading-snug">
                        {primaryTr ? primaryTr.title : art.id}
                      </h2>

                      <p className="text-[11px] font-mono text-admin-text-muted truncate">
                        ID : {art.id}
                        {art.primaryToolRoute
                          ? ` · Outil cible : ${art.primaryToolRoute}`
                          : ''}
                      </p>

                      {/* État des traductions par langue */}
                      <div className="pt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono">
                        <span className="text-admin-text-muted">
                          Traductions :
                        </span>
                        {art.translations.map((tr, idx) => {
                          const trPublished =
                            isPublished && tr.status === 'published';
                          return (
                            <React.Fragment key={tr.locale}>
                              {idx > 0 && (
                                <span
                                  aria-hidden="true"
                                  className="text-admin-text-muted"
                                >
                                  /
                                </span>
                              )}
                              <span
                                className={
                                  trPublished
                                    ? 'text-emerald-500 font-semibold'
                                    : 'text-admin-text-muted'
                                }
                                title={`${tr.locale.toUpperCase()} — ${tr.slug} (${tr.status})`}
                              >
                                {tr.locale.toUpperCase()}:{' '}
                                {tr.status === 'published'
                                  ? 'publié'
                                  : 'brouillon'}
                              </span>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>

                    {/* Actions et liens d'aperçu */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenIndexPreview(
                            frTr && frTr.status === 'published' ? 'fr' : 'en',
                            null
                          )
                        }
                        className="px-3 py-1.5 rounded-xl bg-admin-muted hover:bg-admin-hover border border-admin-border-strong text-xs font-mono text-admin-text inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#c2410c]" />
                        <span>Aperçu BlogIndexView</span>
                      </button>

                      {isPublished && enTr && enTr.status === 'published' && (
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenIndexPreview('en', enTr.slug)
                          }
                          className="px-3 py-1.5 rounded-xl bg-admin-muted hover:bg-admin-hover border border-admin-border-strong text-xs font-mono text-admin-text inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <span>Aperçu EN</span>
                        </button>
                      )}

                      {isPublished && frTr && frTr.status === 'published' && (
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenIndexPreview('fr', frTr.slug)
                          }
                          className="px-3 py-1.5 rounded-xl bg-admin-muted hover:bg-admin-hover border border-admin-border-strong text-xs font-mono text-admin-text inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <span>Aperçu FR</span>
                        </button>
                      )}

                      {isPublished && enTr && enTr.status === 'published' && (
                        <a
                          href={`/blog/${enTr.slug}`}
                          className="px-2.5 py-1.5 rounded-xl bg-admin-muted hover:bg-admin-hover border border-admin-border-strong text-xs font-mono text-admin-text inline-flex items-center gap-1 transition-colors"
                          title={`Ouvrir /blog/${enTr.slug}`}
                        >
                          <span>/blog</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      {canPublish && art.inD1 && (
                        <button
                          type="button"
                          disabled={togglingId === art.id}
                          onClick={() =>
                            handleToggleArticleStatus(art.id, art.status)
                          }
                          className="px-3 py-1.5 rounded-xl bg-[#c2410c] hover:bg-[#9a3412] text-white text-xs font-mono font-semibold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {togglingId === art.id
                            ? '…'
                            : isPublished
                              ? 'Passer en brouillon'
                              : 'Publier'}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
