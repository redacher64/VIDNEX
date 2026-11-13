-- Migration 0005 : Colonnes content_kind et engine_fn pour le journal d'erreurs (admin > Activité)
-- Non destructive : les anciennes lignes conservent NULL (affiché "—" dans l'interface)

ALTER TABLE request_log ADD COLUMN content_kind TEXT;
ALTER TABLE request_log ADD COLUMN engine_fn TEXT;
