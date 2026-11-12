-- =============================================================================
-- VIDNEX — Migration 0003 Cloudflare D1 (0003_add_linkedin.sql)
-- Ajoute la plateforme "linkedin" (photo de profil publique uniquement) dans
-- `settings` et `engine_status`.
-- =============================================================================

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('platform_linkedin', 'true'),
  ('test_url_linkedin', '');

INSERT OR IGNORE INTO engine_status (platform, last_success_ts, last_test_ts, last_test_ok, last_error_code) VALUES
  ('linkedin', NULL, NULL, NULL, NULL);
