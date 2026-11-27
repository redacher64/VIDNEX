-- =============================================================================
-- VIDNEX — Migration 0010 : Anti-spam, Auto-blocage (blocked_ips) & Formulaires
-- - Table blocked_ips : blocage automatique 24h après 3 dépassements de limite en 1h
-- - Table form_submissions : soumissions Contact & DMCA (sans IP en clair)
-- - Mise à jour des limites par défaut : 10 req/min et 100 req/jour sur /api/extract
-- =============================================================================

CREATE TABLE IF NOT EXISTS blocked_ips (
  ip_hash TEXT PRIMARY KEY,
  reason TEXT NOT NULL DEFAULT 'rate_limit',
  violations INTEGER NOT NULL DEFAULT 3,
  blocked_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_expires_at ON blocked_ips(expires_at);

CREATE TABLE IF NOT EXISTS form_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK(kind IN ('contact', 'dmca')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  target_url TEXT,
  message TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_created_at ON form_submissions(created_at DESC);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('rate_limit_per_day', '100');

UPDATE settings
SET value = '10'
WHERE key = 'rate_limit_per_min' AND value = '30';
