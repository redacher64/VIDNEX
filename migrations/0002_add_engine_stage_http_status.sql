-- =============================================================================
-- VIDNEX — Migration 0002 Cloudflare D1 (0002_add_engine_stage_http_status.sql)
-- Ajoute `engine_stage` (niveau du moteur ayant répondu) et `http_status`
-- (code HTTP amont observé) à `request_log` sans casser les données existantes.
-- Aucune URL de média, aucun cookie et aucune IP en clair ne sont stockés.
-- =============================================================================

ALTER TABLE request_log ADD COLUMN engine_stage TEXT;
ALTER TABLE request_log ADD COLUMN http_status INTEGER;

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('test_url_instagram_profile', '');

INSERT OR IGNORE INTO engine_status (platform, last_success_ts, last_test_ts, last_test_ok, last_error_code) VALUES
  ('instagram_profile', NULL, NULL, NULL, NULL);
