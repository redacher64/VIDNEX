/**
 * Journalisation asynchrone dans Cloudflare D1 (`daily_metrics`, `request_log`, `engine_status`),
 * alertes webhook automatiques (`ALERT_WEBHOOK_URL`) et purge opportuniste des logs de plus de 30 jours.
 *
 * Règles strictes de confidentialité et d'économie d'écritures D1 :
 * - Aucun identifiant personnel stocké (`ip_hash` vide dans `request_log`, aucun identifiant dans `daily_metrics`).
 * - Les succès ne sont plus écrits ligne par ligne dans `request_log` : ils sont agrégés par jour, plateforme
 *   et événement dans `daily_metrics` (`extract_started`, `extract_success`, `extract_error`, `download_started`, `download_success`).
 * - Seules les erreurs détaillées (`error_code`, `engine_stage`, `http_status`) sont conservées dans `request_log`.
 * - À 5 échecs consécutifs d'un moteur, envoie UNE alerte via `ALERT_WEBHOOK_URL` (Discord ou Telegram), puis
 *   une alerte de retour à la normale dès le prochain succès.
 */

import { type AdminEnv, getDb } from './db.ts';

export const LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours
export const ALERT_CONSECUTIVE_FAILURES_THRESHOLD = 5;

export type MetricPlatform =
  | 'tiktok'
  | 'instagram'
  | 'instagram_profile'
  | 'x'
  | 'facebook'
  | 'linkedin'
  | 'unknown';

export type DailyMetricEvent =
  | 'extract_started'
  | 'extract_success'
  | 'extract_success_direct'
  | 'extract_success_tiers'
  | 'extract_error'
  | 'download_started'
  | 'download_success';

export interface ExtractionLogEvent {
  platform: MetricPlatform;
  status: 'success' | 'error';
  errorCode?: string | null;
  durationMs: number;
  ipHash?: string;
  stage?: 'direct' | 'tiers' | null;
  engineStage?: string | null;
  httpStatus?: number | null;
  ts?: number;
}

export function resolveExtractionStage(
  stage?: string | null,
  engineStage?: string | null
): 'direct' | 'tiers' {
  const s = (stage || '').trim().toLowerCase();
  if (s === 'tiers') return 'tiers';
  if (s === 'direct') return 'direct';
  const e = (engineStage || '').trim().toLowerCase();
  if (
    e === 'tiers' ||
    e.includes('tiers') ||
    e.includes('tikwm') ||
    e.includes('vxinstagram') ||
    e.includes('ddinstagram') ||
    e.includes('fallback')
  ) {
    return 'tiers';
  }
  return 'direct';
}

function sanitizeStageLabel(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = String(raw)
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[^a-zA-Z0-9_+:-]/g, '')
    .slice(0, 64);
  return cleaned || null;
}

const lastHealthyEngineSyncMs = new Map<string, number>();

export function resetEngineStatusCache(): void {
  lastHealthyEngineSyncMs.clear();
}

export function formatUtcDay(tsMs = Date.now()): string {
  return new Date(tsMs).toISOString().slice(0, 10);
}

/**
 * Incrémente un ou plusieurs compteurs agrégés dans `daily_metrics` en une seule requête SQL D1.
 */
export async function incrementDailyMetrics(
  env: AdminEnv | undefined,
  platform: string,
  events: DailyMetricEvent[],
  nowMs = Date.now()
): Promise<void> {
  if (!events.length) return;
  const db = getDb(env);
  if (!db) return;

  const day = formatUtcDay(nowMs);
  const safePlatform = (platform || 'unknown').trim().toLowerCase() || 'unknown';

  try {
    const placeholders = events.map(() => '(?, ?, ?, ?)').join(', ');
    const bindings: unknown[] = [];
    for (const ev of events) {
      bindings.push(day, safePlatform, ev, 1);
    }
    await db
      .prepare(
        `INSERT INTO daily_metrics (day, platform, event, count)
         VALUES ${placeholders}
         ON CONFLICT(day, platform, event) DO UPDATE SET count = daily_metrics.count + excluded.count`
      )
      .bind(...bindings)
      .run();
  } catch {
    // Échec silencieux non-bloquant
  }
}

/**
 * Envoie une notification d'alerte ou de retour à la normale via `ALERT_WEBHOOK_URL` (Discord ou Telegram).
 * Ne fait rien si le secret `ALERT_WEBHOOK_URL` est absent.
 */
export async function sendEngineAlertWebhook(
  env: AdminEnv | undefined,
  payload: {
    type: 'outage' | 'recovery';
    platform: string;
    consecutiveFailures: number;
    errorCode?: string | null;
    engineStage?: string | null;
    httpStatus?: number | null;
  }
): Promise<void> {
  const rawWebhook = env?.ALERT_WEBHOOK_URL?.trim();
  if (!rawWebhook) return;

  const message =
    payload.type === 'outage'
      ? `🚨 [VIDNEX] Alerte moteur ${payload.platform} : ${payload.consecutiveFailures} échecs consécutifs (code: ${payload.errorCode || 'UNKNOWN_ERROR'}${payload.engineStage ? `, étape: ${payload.engineStage}` : ''}${payload.httpStatus ? `, HTTP ${payload.httpStatus}` : ''}).`
      : `✅ [VIDNEX] Retour à la normale du moteur ${payload.platform} après ${payload.consecutiveFailures} échecs consécutifs.`;

  try {
    const parsedUrl = new URL(rawWebhook);
    let targetUrl = rawWebhook;
    let body: Record<string, unknown> = { content: message, text: message };

    if (parsedUrl.hostname.includes('api.telegram.org')) {
      const chatId = parsedUrl.searchParams.get('chat_id');
      if (chatId) {
        parsedUrl.searchParams.delete('chat_id');
        targetUrl = parsedUrl.toString();
        body = { chat_id: chatId, text: message };
      } else {
        body = { text: message };
      }
    } else if (
      parsedUrl.hostname.includes('discord.com') ||
      parsedUrl.hostname.includes('discordapp.com')
    ) {
      body = { content: message };
    }

    await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // Ne jamais faire échouer l'exécution si le webhook externe est injoignable
  }
}

/**
 * Purge les entrées de `request_log` et `daily_metrics` de plus de 30 jours et les anciennes fenêtres `rate_limits`.
 */
export async function purgeOldLogs(
  env?: AdminEnv,
  nowMs = Date.now()
): Promise<void> {
  const db = getDb(env);
  if (!db) return;

  try {
    const cutoffTs = nowMs - LOG_RETENTION_MS;
    const cutoffDay = formatUtcDay(cutoffTs);
    const minWindow = Math.floor(nowMs / 60_000) - 5;
    await db
      .prepare('DELETE FROM request_log WHERE ts < ?')
      .bind(cutoffTs)
      .run();
    await db
      .prepare('DELETE FROM daily_metrics WHERE day < ?')
      .bind(cutoffDay)
      .run();
    await db
      .prepare('DELETE FROM rate_limits WHERE window < ?')
      .bind(minWindow)
      .run();
  } catch {
    // Échec silencieux non-bloquant
  }
}

function isTrackedEnginePlatform(
  platform: string
): platform is 'tiktok' | 'instagram' | 'instagram_profile' | 'x' | 'facebook' | 'linkedin' {
  return (
    platform === 'tiktok' ||
    platform === 'instagram' ||
    platform === 'instagram_profile' ||
    platform === 'x' ||
    platform === 'facebook' ||
    platform === 'linkedin'
  );
}

/**
 * Enregistre une requête d'extraction :
 * - Compteurs agrégés dans `daily_metrics` (`extract_started` + `extract_success` (+ `extract_success_direct`/`extract_success_tiers`) ou `extract_error`).
 * - Journal détaillé dans `request_log` UNIQUEMENT pour les erreurs (sans aucun identifiant personnel ni URL).
 * - Suivi des échecs consécutifs dans `engine_status` et alerte webhook à 5 échecs consécutifs / retour à la normale.
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
  const engineStage = sanitizeStageLabel(event.engineStage || event.stage);
  const httpStatus =
    typeof event.httpStatus === 'number' && Number.isFinite(event.httpStatus)
      ? Math.round(event.httpStatus)
      : null;

  try {
    // 1. Compteurs journaliers agrégés (1 écriture multi-lignes D1)
    const metricEvents: DailyMetricEvent[] =
      event.status === 'success'
        ? ['extract_started', 'extract_success']
        : ['extract_started', 'extract_error'];

    if (
      event.status === 'success' &&
      (event.platform === 'tiktok' || event.platform === 'instagram')
    ) {
      const stage = resolveExtractionStage(event.stage, event.engineStage);
      metricEvents.push(
        stage === 'tiers' ? 'extract_success_tiers' : 'extract_success_direct'
      );
    }

    await incrementDailyMetrics(env, event.platform, metricEvents, ts);

    // 2. Journal détaillé UNIQUEMENT en cas d'erreur, sans aucun identifiant personnel ni URL (ip_hash = '')
    if (event.status === 'error') {
      try {
        await db
          .prepare(
            `INSERT INTO request_log (ts, platform, status, error_code, duration_ms, ip_hash, engine_stage, http_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            ts,
            event.platform,
            'error',
            errorCode,
            durationMs,
            '',
            engineStage,
            httpStatus
          )
          .run();
      } catch {
        await db
          .prepare(
            `INSERT INTO request_log (ts, platform, status, error_code, duration_ms, ip_hash)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(ts, event.platform, 'error', errorCode, durationMs, '')
          .run();
      }
    }

    // 3. Mise à jour de engine_status et gestion des alertes (5 échecs consécutifs / retour à la normale)
    if (isTrackedEnginePlatform(event.platform)) {
      if (event.status === 'success') {
        const lastSync = lastHealthyEngineSyncMs.get(event.platform) ?? 0;
        const existing = await db
          .prepare(
            'SELECT consecutive_failures, alert_sent FROM engine_status WHERE platform = ?'
          )
          .bind(event.platform)
          .first<{ consecutive_failures?: number; alert_sent?: number }>()
          .catch(() => null);

        const prevFailures = Number(existing?.consecutive_failures ?? 0);
        const prevAlertSent = Number(existing?.alert_sent ?? 0);

        // Économie d'écriture D1 : n'écrit dans engine_status en cas de succès que lors d'une reprise
        // après erreur ou au maximum une fois par minute.
        if (prevFailures > 0 || prevAlertSent > 0 || ts - lastSync >= 60_000) {
          await db
            .prepare(
              `INSERT INTO engine_status (platform, last_success_ts, last_error_code, consecutive_failures, alert_sent)
               VALUES (?, ?, NULL, 0, 0)
               ON CONFLICT(platform) DO UPDATE SET
                 last_success_ts = excluded.last_success_ts,
                 last_error_code = NULL,
                 consecutive_failures = 0,
                 alert_sent = 0`
            )
            .bind(event.platform, ts)
            .run();
          lastHealthyEngineSyncMs.set(event.platform, ts);
        }

        if (prevAlertSent === 1 || prevFailures >= ALERT_CONSECUTIVE_FAILURES_THRESHOLD) {
          await sendEngineAlertWebhook(env, {
            type: 'recovery',
            platform: event.platform,
            consecutiveFailures: prevFailures,
          });
        }
      } else {
        lastHealthyEngineSyncMs.delete(event.platform);
        const existing = await db
          .prepare(
            'SELECT last_success_ts, consecutive_failures, alert_sent FROM engine_status WHERE platform = ?'
          )
          .bind(event.platform)
          .first<{
            last_success_ts?: number | null;
            consecutive_failures?: number;
            alert_sent?: number;
          }>()
          .catch(() => null);

        const prevFailures = Number(existing?.consecutive_failures ?? 0);
        const prevAlertSent = Number(existing?.alert_sent ?? 0);
        const nextFailures = prevFailures + 1;
        const shouldSendAlert =
          nextFailures >= ALERT_CONSECUTIVE_FAILURES_THRESHOLD && prevAlertSent === 0;
        const nextAlertSent = shouldSendAlert ? 1 : prevAlertSent;

        await db
          .prepare(
            `INSERT INTO engine_status (platform, last_success_ts, last_error_code, consecutive_failures, alert_sent)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(platform) DO UPDATE SET
               last_error_code = excluded.last_error_code,
               consecutive_failures = excluded.consecutive_failures,
               alert_sent = excluded.alert_sent`
          )
          .bind(
            event.platform,
            existing?.last_success_ts ?? null,
            errorCode,
            nextFailures,
            nextAlertSent
          )
          .run();

        if (shouldSendAlert) {
          await sendEngineAlertWebhook(env, {
            type: 'outage',
            platform: event.platform,
            consecutiveFailures: nextFailures,
            errorCode,
            engineStage,
            httpStatus,
          });
        }
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
  platform: 'tiktok' | 'instagram' | 'instagram_profile' | 'x' | 'facebook' | 'linkedin',
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
           last_error_code = excluded.last_error_code,
           consecutive_failures = CASE WHEN excluded.last_test_ok = 1 THEN 0 ELSE engine_status.consecutive_failures END,
           alert_sent = CASE WHEN excluded.last_test_ok = 1 THEN 0 ELSE engine_status.alert_sent END`
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
