-- =============================================================================
-- VIDNEX — Migration 0009 : Erreurs détaillées, Visites réelles & Geo D1
-- - Enrichit request_log : error_message (court), source_domain (host seul), country (ISO-2)
-- - Ajoute daily_country_metrics : extractions par jour et par pays (source unique D1)
-- - Ajoute page_visits : visites réelles sans cookie (pays, référent, catégorie, page d'entrée, is_bot)
-- =============================================================================

ALTER TABLE request_log ADD COLUMN error_message TEXT;
ALTER TABLE request_log ADD COLUMN source_domain TEXT;
ALTER TABLE request_log ADD COLUMN country TEXT;

CREATE INDEX IF NOT EXISTS idx_request_log_status_ts ON request_log(status, ts DESC);
CREATE INDEX IF NOT EXISTS idx_request_log_error_platform ON request_log(error_code, platform, ts DESC);

CREATE TABLE IF NOT EXISTS daily_country_metrics (
  day TEXT NOT NULL,
  country TEXT NOT NULL,
  extract_started INTEGER NOT NULL DEFAULT 0,
  extract_success INTEGER NOT NULL DEFAULT 0,
  extract_error INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, country)
);

CREATE INDEX IF NOT EXISTS idx_daily_country_metrics_day ON daily_country_metrics(day);

CREATE TABLE IF NOT EXISTS page_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  day TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'XX',
  referrer_host TEXT,
  referrer_category TEXT NOT NULL DEFAULT 'direct',
  entry_page TEXT NOT NULL DEFAULT '/',
  is_bot INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_page_visits_ts ON page_visits(ts DESC);
CREATE INDEX IF NOT EXISTS idx_page_visits_day_bot ON page_visits(day, is_bot);
CREATE INDEX IF NOT EXISTS idx_page_visits_day_country ON page_visits(day, country);
CREATE INDEX IF NOT EXISTS idx_page_visits_day_cat ON page_visits(day, referrer_category);
CREATE INDEX IF NOT EXISTS idx_page_visits_day_page ON page_visits(day, entry_page);
