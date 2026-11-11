/**
 * Journalisation asynchrone dans Cloudflare D1 (`request_log` et `engine_status`)
 * et purge opportuniste automatique des logs de plus de 30 jours.
 *
 * Règles strictes de confidentialité :
 * - Jamais d'adresse IP en clair (uniquement `ip_hash` SHA-256 salé).
 * - Jamais d'URL de vidéo ou de média stockée dans `request_log`.
 * - Jamais bloquant : si D1 est indisponible, les erreurs sont ignorées silencieusement.
 */

import { type AdminEnv, getDb } from './db.ts';

export const LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

export interface ExtractionLogEvent {
  platform: 'tiktok' | 'instagram' | 'instagram_profile' | 'x' | 'facebook' | 'unknown';
  status: 'success' | 'error';
  errorCode?: string | null;
  durationMs: number;
  ipHash: string;
  engineStage?: string | null;
  httpStatus?: number | null;
  ts?: number;
}

/**
 * Purge les entrées de `request_log` de plus de 30 jours et les anciennes fenêtres `rate_limits`.
 */
export async function purgeOldLogs(
  env?: AdminEnv,
  nowMs = Date.now()
): Promise<void> {
  const db = getDb(env);
  if (!db) return;

  try {
    const cutoffTs = nowMs - LOG_RETENTION_MS;
    const minWindow = Math.floor(nowMs / 60_000) - 5;
    await db
      .prepare('DELETE FROM request_log WHERE ts < ?')
      .bind(cutoffTs)
      .run();
    await db
      .prepare('DELETE FROM rate_limits WHERE window < ?')
      .bind(minWindow)
      .run();
  } catch {
    // Échec silencieux non-bloquant
  }
}

/**
 * Enregistre une requête d'extraction dans `request_log`, met à jour `engine_status`,
 * et déclenche une purge opportuniste sur ~1 % des requêtes.
 */
export async function logExtractionEvent(
  env: AdminEnv | undefined,
  event: ExtractionLogEvent
): Promise<void> {
  const db = getDb(env);
  if (!db) return;

  const ts = event.ts ?? Date.now();
  const durationMs = Math.max(0, Math.round(event.durationMs));
  const errorCode =
    event.status === 'success' ? null : event.errorCode || 'UNKNOWN_ERROR';
  const engineStage = event.engineStage
    ? String(event.engineStage).slice(0, 64)
    : null;
  const httpStatus =
    typeof event.httpStatus === 'number' && Number.isFinite(event.httpStatus)
      ? Math.round(event.httpStatus)
      : null;

  try {
    try {
      await db
        .prepare(
          `INSERT INTO request_log (ts, platform, status, error_code, duration_ms, ip_hash, engine_stage, http_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          ts,
          event.platform,
          event.status,
          errorCode,
          durationMs,
          event.ipHash,
          engineStage,
          httpStatus
        )
        .run();
    } catch {
      // Repli rétrocompatible si la migration 0002 n'a pas encore pu être appliquée
      await db
        .prepare(
          `INSERT INTO request_log (ts, platform, status, error_code, duration_ms, ip_hash)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(ts, event.platform, event.status, errorCode, durationMs, event.ipHash)
        .run();
    }

    if (
      event.platform === 'tiktok' ||
      event.platform === 'instagram' ||
      event.platform === 'instagram_profile' ||
      event.platform === 'x' ||
      event.platform === 'facebook'
    ) {
      if (event.status === 'success') {
        await db
          .prepare(
            `INSERT INTO engine_status (platform, last_success_ts, last_error_code)
             VALUES (?, ?, NULL)
             ON CONFLICT(platform) DO UPDATE SET
               last_success_ts = excluded.last_success_ts,
               last_error_code = NULL`
          )
          .bind(event.platform, ts)
          .run();
      } else {
        await db
          .prepare(
            `INSERT INTO engine_status (platform, last_success_ts, last_error_code)
             VALUES (?, NULL, ?)
             ON CONFLICT(platform) DO UPDATE SET
               last_error_code = excluded.last_error_code`
          )
          .bind(event.platform, errorCode)
          .run();
      }
    }

    // Purge opportuniste sur ~1 % des requêtes (Pages Functions n'ayant pas de cron)
    if (Math.random() < 0.01) {
      await purgeOldLogs(env, ts);
    }
  } catch {
    // Échec de log silencieux, jamais bloquant pour le visiteur
  }
}

/**
 * Enregistre le résultat d'un test actif (« Tester maintenant » depuis `/admin`) dans `engine_status`.
 */
export async function recordEngineHealthTest(
  env: AdminEnv,
  platform: 'tiktok' | 'instagram' | 'instagram_profile' | 'x' | 'facebook',
  ok: boolean,
  errorCode: string | null,
  nowMs = Date.now()
): Promise<void> {
  const db = getDb(env);
  if (!db) return;

  try {
    await db
      .prepare(
        `INSERT INTO engine_status (platform, last_success_ts, last_test_ts, last_test_ok, last_error_code)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(platform) DO UPDATE SET
           last_success_ts = CASE WHEN excluded.last_test_ok = 1 THEN excluded.last_test_ts ELSE engine_status.last_success_ts END,
           last_test_ts = excluded.last_test_ts,
           last_test_ok = excluded.last_test_ok,
           last_error_code = excluded.last_error_code`
      )
      .bind(
        platform,
        ok ? nowMs : null,
        nowMs,
        ok ? 1 : 0,
        ok ? null : errorCode || 'TEST_FAILED'
      )
      .run();
  } catch {
    // Ignorer
  }
}
