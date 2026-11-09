-- =============================================================================
-- VIDNEX — Migration Initiale Cloudflare D1 (0001_init.sql)
-- Stockage 100 % gratuit, zéro IP en clair (SHA-256 + sel), zéro URL média loggée.
-- Note : Aucun formulaire de contact n'existant sur le site, la table `messages`
-- est volontairement omise conformément au cahier des charges.
-- =============================================================================

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Valeurs par défaut initiales
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('maintenance', 'false'),
  ('platform_tiktok', 'true'),
  ('platform_instagram', 'true'),
  ('platform_x', 'true'),
  ('platform_facebook', 'true'),
  ('rate_limit_per_min', '30'),
  ('ads_enabled', 'true'),
  ('test_url_tiktok', ''),
  ('test_url_instagram', ''),
  ('test_url_x', ''),
  ('test_url_facebook', '');

CREATE TABLE IF NOT EXISTS request_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  platform TEXT NOT NULL,
  status TEXT NOT NULL,
  error_code TEXT,
  duration_ms INTEGER NOT NULL,
  ip_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_request_log_ts ON request_log(ts DESC);
CREATE INDEX IF NOT EXISTS idx_request_log_platform_ts ON request_log(platform, ts DESC);

CREATE TABLE IF NOT EXISTS engine_status (
  platform TEXT PRIMARY KEY,
  last_success_ts INTEGER,
  last_test_ts INTEGER,
  last_test_ok INTEGER,
  last_error_code TEXT
);

INSERT OR IGNORE INTO engine_status (platform, last_success_ts, last_test_ts, last_test_ok, last_error_code) VALUES
  ('tiktok', NULL, NULL, NULL, NULL),
  ('instagram', NULL, NULL, NULL, NULL),
  ('x', NULL, NULL, NULL, NULL),
  ('facebook', NULL, NULL, NULL, NULL);

CREATE TABLE IF NOT EXISTS blocklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('ip_hash', 'domain', 'url')),
  value TEXT NOT NULL,
  created_ts INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_blocklist_type_val ON blocklist(type, value);

CREATE TABLE IF NOT EXISTS rate_limits (
  ip_hash TEXT NOT NULL,
  window INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (ip_hash, window)
);

CREATE TABLE IF NOT EXISTS login_attempts (
  ip_hash TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start_ts INTEGER NOT NULL,
  blocked_until_ts INTEGER
);
