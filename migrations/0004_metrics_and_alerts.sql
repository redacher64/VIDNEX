-- =============================================================================
-- VIDNEX — Migration 0004 Cloudflare D1 (0004_metrics_and_alerts.sql)
-- 1. Ajoute le réglage `download_limit_per_min` (défaut 60) dans `settings`.
-- 2. Crée la table `daily_metrics` (compteurs journaliers agrégés sans PII :
--    extract_started, extract_success, extract_error, download_started, download_success).
-- 3. Ajoute `consecutive_failures` et `alert_sent` dans `engine_status` pour
--    déclencher une alerte unique à 5 échecs consécutifs et une alerte de retour à la normale.
-- =============================================================================

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('download_limit_per_min', '60');

CREATE TABLE IF NOT EXISTS daily_metrics (
  day TEXT NOT NULL,
  platform TEXT NOT NULL,
  event TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, platform, event)
);

ALTER TABLE engine_status ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE engine_status ADD COLUMN alert_sent INTEGER NOT NULL DEFAULT 0;
