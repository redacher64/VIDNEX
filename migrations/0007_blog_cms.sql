-- Migration 0007 : Gestion des articles du blog (Phase 1 : données, traductions, révisions et redirections 301)
-- Non destructive : crée uniquement les tables blog_articles, blog_translations, blog_revisions et blog_redirects.

CREATE TABLE IF NOT EXISTS blog_articles (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  tool_route TEXT,
  secondary_tool_route TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'published', 'trashed')),
  previous_status TEXT DEFAULT 'draft',
  trashed_at INTEGER,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  published_at TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blog_articles_status ON blog_articles(status);
CREATE INDEX IF NOT EXISTS idx_blog_articles_created_by ON blog_articles(created_by);
CREATE INDEX IF NOT EXISTS idx_blog_articles_trashed_at ON blog_articles(trashed_at);

CREATE TABLE IF NOT EXISTS blog_translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  excerpt TEXT NOT NULL DEFAULT '',
  meta_title TEXT NOT NULL DEFAULT '',
  meta_description TEXT NOT NULL DEFAULT '',
  primary_keyword TEXT NOT NULL DEFAULT '',
  secondary_keywords TEXT NOT NULL DEFAULT '[]',
  search_intent TEXT NOT NULL DEFAULT '',
  reading_time_minutes INTEGER NOT NULL DEFAULT 5,
  quick_answer TEXT,
  key_takeaways TEXT NOT NULL DEFAULT '[]',
  introduction TEXT NOT NULL DEFAULT '[]',
  table_of_contents TEXT NOT NULL DEFAULT '[]',
  content_sections TEXT NOT NULL DEFAULT '[]',
  faq TEXT NOT NULL DEFAULT '[]',
  cta_title TEXT,
  cta_description TEXT,
  cta_button_label TEXT,
  internal_links TEXT NOT NULL DEFAULT '[]',
  sources TEXT NOT NULL DEFAULT '[]',
  body_markdown TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'published', 'trashed')),
  updated_by TEXT NOT NULL DEFAULT 'admin',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(article_id, locale),
  UNIQUE(locale, slug),
  FOREIGN KEY (article_id) REFERENCES blog_articles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_blog_translations_article_id ON blog_translations(article_id);
CREATE INDEX IF NOT EXISTS idx_blog_translations_locale_slug ON blog_translations(locale, slug);
CREATE INDEX IF NOT EXISTS idx_blog_translations_status ON blog_translations(status);

CREATE TABLE IF NOT EXISTS blog_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  meta_title TEXT NOT NULL DEFAULT '',
  meta_description TEXT NOT NULL DEFAULT '',
  body_markdown TEXT NOT NULL DEFAULT '',
  snapshot_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  edited_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blog_revisions_article_locale_created
  ON blog_revisions(article_id, locale, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS blog_redirects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  locale TEXT NOT NULL,
  old_slug TEXT NOT NULL,
  new_slug TEXT NOT NULL,
  article_id TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 301,
  created_at INTEGER NOT NULL,
  UNIQUE(locale, old_slug)
);

CREATE INDEX IF NOT EXISTS idx_blog_redirects_locale_old_slug
  ON blog_redirects(locale, old_slug);
