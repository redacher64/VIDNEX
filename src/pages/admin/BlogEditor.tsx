import React, { useMemo, useState } from 'react';
import {
  BLOG_CATEGORY_KEYS,
  type BlogCategoryId,
  type BlogCategoryKey,
  getBlogUiLabels,
} from '../../data/blogArticles';
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Save,
  ShieldAlert,
} from './AdminIcons';
import type { AdminUserProfile } from './Login';
import {
  type AdminBlogArticleItem,
  buildDraftCreatePayload,
  canWriteBlogArticle,
  slugifyBlogIdentifier,
} from './blogAdminLogic';

interface BlogEditorProps {
  user: AdminUserProfile;
  existingArticles: readonly AdminBlogArticleItem[];
  onCreated: (articleId: string) => Promise<void> | void;
  onCancel: () => void;
}

const SUPPORTED_EDITOR_LOCALES = [
  { code: 'fr', label: 'Français (FR)' },
  { code: 'en', label: 'English (EN)' },
  { code: 'ar', label: 'العربية (AR)' },
  { code: 'es', label: 'Español (ES)' },
  { code: 'de', label: 'Deutsch (DE)' },
] as const;

const TOOL_ROUTE_OPTIONS = [
  { value: '/telecharger-video-tiktok', label: 'Téléchargeur TikTok (/telecharger-video-tiktok)' },
  { value: '/telecharger-reel-instagram', label: 'Téléchargeur Reels Instagram (/telecharger-reel-instagram)' },
  { value: '/telecharger-video-x-twitter', label: 'Téléchargeur X / Twitter (/telecharger-video-x-twitter)' },
  { value: '/telecharger-video-facebook', label: 'Téléchargeur Facebook (/telecharger-video-facebook)' },
  { value: '/telecharger-photo-profil-linkedin', label: 'Photo de profil LinkedIn (/telecharger-photo-profil-linkedin)' },
] as const;

export const BlogEditor: React.FC<BlogEditorProps> = ({
  user,
  existingArticles,
  onCreated,
  onCancel,
}) => {
  const uiFr = getBlogUiLabels('fr');
  const canWrite = canWriteBlogArticle(user);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [articleId, setArticleId] = useState('');
  const [idManuallyEdited, setIdManuallyEdited] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const [locale, setLocale] = useState<string>('fr');
  const [category, setCategory] = useState<BlogCategoryId>('tiktok-guides');
  const [toolRoute, setToolRoute] = useState<string>(
    '/telecharger-video-tiktok'
  );
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [primaryKeyword, setPrimaryKeyword] = useState('');
  const [bodyMarkdown, setBodyMarkdown] = useState(
    '## Pourquoi vérifier le format avant le téléchargement\n\nExpliquez ici les étapes techniques pour récupérer un flux public en haute définition.\n\n- Vérifier que le lien est public\n- Privilégier le conteneur MP4 H.264 original\n\n:::conseil\nTestez toujours la lecture audio avant d’archiver votre fichier MP4.\n:::'
  );

  const [submitting, setSubmitting] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const existingSlugsInLocale = useMemo(() => {
    const list: string[] = [];
    for (const art of existingArticles) {
      for (const tr of art.translations) {
        if (tr.locale === locale) {
          list.push(tr.slug.toLowerCase());
        }
      }
    }
    return list;
  }, [existingArticles, locale]);

  const draftCheck = useMemo(
    () =>
      buildDraftCreatePayload({
        articleId,
        category,
        toolRoute,
        locale,
        slug,
        title,
        excerpt,
        metaTitle,
        metaDescription,
        primaryKeyword,
        bodyMarkdown,
        existingSlugsInLocale,
      }),
    [
      articleId,
      category,
      toolRoute,
      locale,
      slug,
      title,
      excerpt,
      metaTitle,
      metaDescription,
      primaryKeyword,
      bodyMarkdown,
      existingSlugsInLocale,
    ]
  );

  const handleTitleChange = (nextTitle: string) => {
    setTitle(nextTitle);
    const autoSlug = slugifyBlogIdentifier(nextTitle);
    if (!slugManuallyEdited) {
      setSlug(autoSlug);
    }
    if (!idManuallyEdited) {
      setArticleId(autoSlug);
    }
  };

  const handleInsertMarkdownSnippet = (snippet: string) => {
    setBodyMarkdown((prev) =>
      prev.trim() ? `${prev.trimEnd()}\n\n${snippet}\n` : `${snippet}\n`
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    setServerError(null);

    if (!canWrite) {
      setServerError(
        "Accès refusé : le droit blog.write ou blog.edit_all est requis pour créer un brouillon."
      );
      return;
    }

    if (!draftCheck.valid) {
      setServerError(
        draftCheck.errors[0]?.message ||
          'Veuillez corriger les champs signalés avant d’enregistrer le brouillon.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/blog', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(draftCheck.payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setServerError(
          data.message ||
            "Impossible d'enregistrer le brouillon dans la base D1."
        );
        return;
      }
      await onCreated(draftCheck.payload.id);
    } catch {
      setServerError(
        "Erreur réseau lors de l'enregistrement du brouillon dans D1."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!canWrite) {
    return (
      <div
        data-testid="admin-blog-editor-denied"
        className="bg-admin-surface border border-red-300 dark:border-red-800/70 rounded-2xl p-6 text-center space-y-3"
      >
        <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <h2 className="font-display text-base font-bold text-admin-text">
          Droit d’écriture requis
        </h2>
        <p className="text-xs font-mono text-admin-text-secondary max-w-md mx-auto">
          Votre compte ({user.login}) ne dispose pas des permissions{' '}
          <code>blog.write</code> ou <code>blog.edit_all</code> nécessaires pour
          créer un nouveau brouillon dans D1.
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-admin-muted hover:bg-admin-hover border border-admin-border-strong text-xs font-mono text-admin-text cursor-pointer"
        >
          Retourner à la liste des articles
        </button>
      </div>
    );
  }

  const metaTitleLen = [...metaTitle.trim()].length;
  const metaDescLen = [...metaDescription.trim()].length;

  return (
    <section
      aria-label="Éditeur de brouillon Blog D1"
      data-testid="admin-blog-editor"
      className="bg-admin-surface border border-admin-border rounded-2xl p-5 sm:p-6 space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-admin-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-admin-text-muted">
            <Edit3 className="w-3.5 h-3.5 text-[#c2410c]" />
            <span>Éditeur Blog D1</span>
            <span aria-hidden="true">·</span>
            <span>Statut cible : Brouillon (draft)</span>
            <span aria-hidden="true">·</span>
            <span>Auteur : {user.login}</span>
          </div>
          <h2 className="font-display text-lg font-bold text-admin-text">
            Nouveau brouillon d’article
          </h2>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-xl bg-admin-muted hover:bg-admin-hover border border-admin-border-strong text-xs font-mono text-admin-text cursor-pointer"
        >
          Annuler et fermer
        </button>
      </div>

      {serverError && (
        <div
          role="alert"
          data-testid="admin-blog-editor-error"
          className="rounded-xl p-3.5 bg-red-950/30 border border-red-700/60 text-xs font-mono text-red-300 flex items-center gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Ligne 1 : Titre H1 & Langue */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3 space-y-1.5">
            <label
              htmlFor="admin-blog-editor-title"
              className="block text-xs font-mono font-semibold text-admin-text"
            >
              Titre de l’article (H1) *
            </label>
            <input
              id="admin-blog-editor-title"
              type="text"
              required
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Ex. : Comment vérifier le débit binaire d’une vidéo TikTok"
              className="w-full px-3.5 py-2.5 rounded-xl bg-admin-muted border border-admin-border-strong text-xs font-mono text-admin-text placeholder:text-admin-text-muted focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="admin-blog-editor-locale"
              className="block text-xs font-mono font-semibold text-admin-text"
            >
              Langue du brouillon *
            </label>
            <select
              id="admin-blog-editor-locale"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-admin-muted border border-admin-border-strong text-xs font-mono text-admin-text focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
            >
              {SUPPORTED_EDITOR_LOCALES.map((loc) => (
                <option key={loc.code} value={loc.code}>
                  {loc.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Ligne 2 : Slug URL, Identifiant d'article, Catégorie & Outil cible */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="admin-blog-editor-slug"
              className="block text-xs font-mono font-semibold text-admin-text"
            >
              Slug URL (sans année) *
            </label>
            <input
              id="admin-blog-editor-slug"
              type="text"
              required
              value={slug}
              onChange={(e) => {
                setSlugManuallyEdited(true);
                setSlug(e.target.value.toLowerCase());
              }}
              placeholder="verifier-debit-binaire-video-tiktok"
              className="w-full px-3.5 py-2 rounded-xl bg-admin-muted border border-admin-border-strong text-xs font-mono text-admin-text placeholder:text-admin-text-muted focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="admin-blog-editor-id"
              className="block text-xs font-mono font-semibold text-admin-text"
            >
              Identifiant D1 (articleId) *
            </label>
            <input
              id="admin-blog-editor-id"
              type="text"
              required
              value={articleId}
              onChange={(e) => {
                setIdManuallyEdited(true);
                setArticleId(e.target.value.toLowerCase());
              }}
              placeholder="verifier-debit-binaire-video-tiktok"
              className="w-full px-3.5 py-2 rounded-xl bg-admin-muted border border-admin-border-strong text-xs font-mono text-admin-text placeholder:text-admin-text-muted focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="admin-blog-editor-category"
              className="block text-xs font-mono font-semibold text-admin-text"
            >
              Catégorie *
            </label>
            <select
              id="admin-blog-editor-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as BlogCategoryId)}
              className="w-full px-3.5 py-2 rounded-xl bg-admin-muted border border-admin-border-strong text-xs font-mono text-admin-text focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
            >
              {BLOG_CATEGORY_KEYS.map((catKey) => (
                <option key={catKey} value={catKey}>
                  {uiFr.categories[catKey as BlogCategoryKey] || catKey}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="admin-blog-editor-tool"
              className="block text-xs font-mono font-semibold text-admin-text"
            >
              Outil associé
            </label>
            <select
              id="admin-blog-editor-tool"
              value={toolRoute}
              onChange={(e) => setToolRoute(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-admin-muted border border-admin-border-strong text-xs font-mono text-admin-text focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
            >
              {TOOL_ROUTE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Ligne 3 : Meta Title & Mot-clé principal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <label
                htmlFor="admin-blog-editor-meta-title"
                className="font-semibold text-admin-text"
              >
                Meta Title SEO (max 60 car.) *
              </label>
              <span
                className={`tabular-nums ${
                  metaTitleLen > 0 && metaTitleLen <= 60
                    ? 'text-emerald-500'
                    : 'text-amber-500'
                }`}
              >
                {metaTitleLen} / 60
              </span>
            </div>
            <input
              id="admin-blog-editor-meta-title"
              type="text"
              required
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              placeholder="Débit binaire vidéo TikTok : Guide qualité MP4"
              className="w-full px-3.5 py-2 rounded-xl bg-admin-muted border border-admin-border-strong text-xs font-mono text-admin-text placeholder:text-admin-text-muted focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="admin-blog-editor-keyword"
              className="block text-xs font-mono font-semibold text-admin-text"
            >
              Mot-clé principal (primaryKeyword)
            </label>
            <input
              id="admin-blog-editor-keyword"
              type="text"
              value={primaryKeyword}
              onChange={(e) => setPrimaryKeyword(e.target.value)}
              placeholder="debit binaire video tiktok mp4"
              className="w-full px-3.5 py-2 rounded-xl bg-admin-muted border border-admin-border-strong text-xs font-mono text-admin-text placeholder:text-admin-text-muted focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
            />
          </div>
        </div>

        {/* Ligne 4 : Meta Description (90-150 car.) & Extrait */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <label
                htmlFor="admin-blog-editor-meta-desc"
                className="font-semibold text-admin-text"
              >
                Meta Description SEO (90 à 150 car.) *
              </label>
              <span
                className={`tabular-nums ${
                  metaDescLen >= 90 && metaDescLen <= 150
                    ? 'text-emerald-500'
                    : 'text-amber-500'
                }`}
              >
                {metaDescLen} / 150 (min 90)
              </span>
            </div>
            <textarea
              id="admin-blog-editor-meta-desc"
              rows={3}
              required
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              placeholder="Apprenez à analyser le débit binaire et la résolution d’une vidéo TikTok publique afin de sauvegarder un fichier MP4 net sans recompression."
              className="w-full px-3.5 py-2 rounded-xl bg-admin-muted border border-admin-border-strong text-xs font-mono text-admin-text placeholder:text-admin-text-muted focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="admin-blog-editor-excerpt"
              className="block text-xs font-mono font-semibold text-admin-text"
            >
              Extrait / Chapeau de l’article (excerpt) *
            </label>
            <textarea
              id="admin-blog-editor-excerpt"
              rows={3}
              required
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Résumé affiché sur les cartes de BlogIndexView et en introduction…"
              className="w-full px-3.5 py-2 rounded-xl bg-admin-muted border border-admin-border-strong text-xs font-mono text-admin-text placeholder:text-admin-text-muted focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
            />
          </div>
        </div>

        {/* Ligne 5 : Corps Markdown restreint */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="admin-blog-editor-body"
              className="text-xs font-mono font-semibold text-admin-text"
            >
              Corps de l’article (Markdown restreint : H2 ##, H3 ###, listes,
              tableaux, liens HTTPS, :::conseil) *
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  handleInsertMarkdownSnippet(
                    '## Nouvelle section technique\n\nDéveloppez votre explication ici.'
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-admin-muted hover:bg-admin-hover border border-admin-border text-[11px] font-mono text-admin-text cursor-pointer"
              >
                + H2
              </button>
              <button
                type="button"
                onClick={() =>
                  handleInsertMarkdownSnippet(
                    '### Sous-section détaillée\n\nPrécisez le comportement par appareil.'
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-admin-muted hover:bg-admin-hover border border-admin-border text-[11px] font-mono text-admin-text cursor-pointer"
              >
                + H3
              </button>
              <button
                type="button"
                onClick={() =>
                  handleInsertMarkdownSnippet(
                    ':::conseil\nAstuce technique importante à retenir.\n:::'
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-admin-muted hover:bg-admin-hover border border-admin-border text-[11px] font-mono text-admin-text cursor-pointer"
              >
                + Conseil
              </button>
              <span className="text-[11px] font-mono text-admin-text-muted tabular-nums ml-1">
                {draftCheck.wordCount} mots
              </span>
            </div>
          </div>

          <textarea
            id="admin-blog-editor-body"
            rows={9}
            required
            value={bodyMarkdown}
            onChange={(e) => setBodyMarkdown(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-admin-muted border border-admin-border-strong text-xs font-mono text-admin-text leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#c2410c]"
          />
        </div>

        {/* État de validation SEO en direct */}
        {(attemptedSubmit || title.trim().length > 0) && (
          <div className="rounded-xl bg-admin-muted/70 border border-admin-border p-3.5 space-y-2 text-xs font-mono">
            {draftCheck.valid ? (
              <div className="flex items-center gap-2 text-emerald-500 font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  Validation SEO et Markdown conforme — prêt à enregistrer en
                  brouillon dans D1.
                </span>
              </div>
            ) : (
              <div className="space-y-1 text-amber-500">
                <p className="font-semibold">
                  Critères requis avant enregistrement ({draftCheck.errors.length}) :
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-admin-text-secondary">
                  {draftCheck.errors.map((err, i) => (
                    <li key={`${err.code}-${i}`}>{err.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Boutons d'action */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-admin-border">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl bg-admin-muted hover:bg-admin-hover border border-admin-border-strong text-xs font-mono text-admin-text cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            data-testid="admin-blog-editor-submit"
            className="px-5 py-2.5 rounded-xl bg-[#c2410c] hover:bg-[#9a3412] text-white text-xs font-display font-semibold inline-flex items-center gap-2 shadow cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>
              {submitting
                ? 'Enregistrement dans D1…'
                : 'Enregistrer le brouillon dans D1'}
            </span>
          </button>
        </div>
      </form>
    </section>
  );
};
