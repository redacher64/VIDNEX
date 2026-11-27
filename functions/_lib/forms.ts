/**
 * Gestionnaire partagé pour les formulaires publics Contact et DMCA (`/api/contact`, `/api/dmca`).
 * Protections :
 * - Rejet des requêtes sans User-Agent ou avec User-Agent de bot connu
 * - Honeypot invisible : si rempli = rejet silencieux (HTTP 200 sans stockage)
 * - Rate limiting strict : max 3 soumissions / heure par IP hachée (429 + Retry-After)
 * - Auto-blocage 24h après 3 dépassements de limite en 1h
 * - Vérification Turnstile côté serveur avant tout enregistrement
 */

import {
  type AdminEnv,
  type ExecutionContextLike,
  getDb,
  getRawClientIp,
  hashIpAddress,
} from './db.ts';
import { createErrorResponse, optionsResponse } from './normalize.ts';
import { checkD1HourlyRateLimit } from './ratelimit.ts';
import {
  isBotOrMissingUserAgent,
  recordLimitExceedanceAndMaybeBlock,
  recordRejectedRequest,
} from './security.ts';
import {
  extractTurnstileTokenFromRequest,
  verifyTurnstileToken,
} from './turnstile.ts';

export type FormKind = 'contact' | 'dmca';

export const FORM_HOURLY_LIMIT = 3;

export interface FormPagesContext {
  request: Request;
  env?: AdminEnv;
  ctx?: ExecutionContextLike;
  waitUntil?: (promise: Promise<unknown>) => void;
}

function isValidEmail(email: string): boolean {
  if (!email || email.length > 160) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function isValidHttpUrl(raw: string): boolean {
  if (!raw || raw.length > 2048) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function handleFormSubmission(
  kind: FormKind,
  context: FormPagesContext
): Promise<Response> {
  const { request, env = {} } = context;
  const ctx: ExecutionContextLike | undefined =
    context.ctx ||
    (context.waitUntil ? { waitUntil: context.waitUntil } : undefined);

  if (request.method === 'OPTIONS') {
    return optionsResponse();
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // 1. Rejeter les requêtes sans User-Agent ou avec UA de bot connu
  if (isBotOrMissingUserAgent(request)) {
    await recordRejectedRequest(env, ctx);
    return createErrorResponse(
      'BLOCKED',
      'Requête refusée (User-Agent manquant ou automatisé).',
      403
    );
  }

  let body: Record<string, unknown> = {};
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    return createErrorResponse('UNSUPPORTED_URL', 'Corps JSON invalide.', 400);
  }

  // 2. Honeypot invisible : si rempli = rejet silencieux (HTTP 200 sans sauvegarde)
  const honeypotVal = String(
    body.website ?? body.company_url ?? body.hp ?? body.honeypot ?? ''
  ).trim();
  if (honeypotVal.length > 0) {
    await recordRejectedRequest(env, ctx);
    return new Response(
      JSON.stringify({ ok: true, submitted: true }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  const rawIp = getRawClientIp(request);
  const ipHash = await hashIpAddress(rawIp, env.IP_HASH_SALT);
  const nowMs = Date.now();

  // 3. Rate limit : max 3 soumissions / heure par IP
  const rate = await checkD1HourlyRateLimit(
    env,
    `form:${ipHash}`,
    FORM_HOURLY_LIMIT,
    nowMs
  );
  if (!rate.allowed) {
    await recordLimitExceedanceAndMaybeBlock(
      env,
      ipHash,
      `${kind}_rate_limit`,
      nowMs
    );
    await recordRejectedRequest(env, ctx, nowMs);
    return createErrorResponse(
      'RATE_LIMITED',
      `Limite atteinte (${FORM_HOURLY_LIMIT} envois par heure max). Réessayez dans ${rate.retryAfterSec}s.`,
      429,
      { 'Retry-After': String(rate.retryAfterSec) }
    );
  }

  // 4. Vérification Turnstile côté serveur
  const turnstileToken = extractTurnstileTokenFromRequest(request, body);
  const tsCheck = await verifyTurnstileToken(request, env, turnstileToken, kind);
  if (!tsCheck.ok) {
    await recordRejectedRequest(env, ctx, nowMs);
    return createErrorResponse(
      tsCheck.errorCode || 'TURNSTILE_FAILED',
      tsCheck.message || 'Vérification Turnstile échouée.',
      403
    );
  }

  // 5. Validation stricte des champs
  const name = String(body.name || '').trim().slice(0, 120);
  const email = String(body.email || '').trim().slice(0, 160);
  const subject = String(body.subject || '').trim().slice(0, 160) || null;
  const targetUrl = String(body.targetUrl ?? body.target_url ?? '')
    .trim()
    .slice(0, 2048);
  const message = String(body.message || '').trim().slice(0, 4000);

  if (name.length < 2) {
    return createErrorResponse(
      'UNSUPPORTED_URL',
      'Veuillez renseigner votre nom (2 caractères minimum).',
      400
    );
  }
  if (!isValidEmail(email)) {
    return createErrorResponse(
      'UNSUPPORTED_URL',
      'Adresse e-mail invalide.',
      400
    );
  }
  if (kind === 'dmca' && !isValidHttpUrl(targetUrl)) {
    return createErrorResponse(
      'UNSUPPORTED_URL',
      'Veuillez fournir l’URL HTTP(S) complète concernée par la demande DMCA.',
      400
    );
  }
  if (message.length < 10) {
    return createErrorResponse(
      'UNSUPPORTED_URL',
      'Le message doit contenir au moins 10 caractères.',
      400
    );
  }

  // 6. Enregistrement léger dans D1 (`form_submissions`) sans IP en clair
  const db = getDb(env);
  let insertedId: number | null = null;
  if (db) {
    try {
      const res = await db
        .prepare(
          `INSERT INTO form_submissions (kind, name, email, subject, target_url, message, ip_hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          kind,
          name,
          email,
          subject,
          kind === 'dmca' ? targetUrl : targetUrl || null,
          message,
          ipHash.slice(0, 16),
          nowMs
        )
        .first<{ id?: number }>()
        .catch(() => null);
      if (res && typeof res.id === 'number') {
        insertedId = res.id;
      }
    } catch {
      // Ne pas bloquer la confirmation si D1 est en lecture seule
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      submitted: true,
      kind,
      id: insertedId,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
