/**
 * Vérification côté serveur Cloudflare Turnstile (`challenges.cloudflare.com/turnstile/v0/siteverify`).
 * - Clés strictement lues depuis les variables d'environnement (`TURNSTILE_SECRET`, `TURNSTILE_HOSTNAMES`).
 * - Politique fail-closed dès que `TURNSTILE_SECRET` est configuré.
 */

import { type AdminEnv, getRawClientIp } from './db.ts';

export interface TurnstileVerifyResult {
  ok: boolean;
  errorCode?: 'TURNSTILE_REQUIRED' | 'TURNSTILE_FAILED';
  message?: string;
}

interface SiteverifyPayload {
  success?: boolean;
  action?: string;
  hostname?: string;
  'error-codes'?: string[];
}

export function getTurnstileSecret(env?: AdminEnv): string {
  return String(env?.TURNSTILE_SECRET || env?.TURNSTILE_SECRET_KEY || '').trim();
}

export function getTurnstileSiteKey(env?: AdminEnv): string {
  return String(env?.TURNSTILE_SITE_KEY || env?.VITE_TURNSTILE_SITE_KEY || '').trim();
}

export function extractTurnstileTokenFromRequest(
  request: Request,
  body?: Record<string, unknown> | null
): string {
  const headerToken = request.headers.get('X-Turnstile-Token');
  if (headerToken && headerToken.trim()) {
    return headerToken.trim();
  }
  if (body && typeof body === 'object') {
    const cfToken = body['cf-turnstile-response'];
    if (typeof cfToken === 'string' && cfToken.trim()) {
      return cfToken.trim();
    }
    const altToken = body['turnstileToken'];
    if (typeof altToken === 'string' && altToken.trim()) {
      return altToken.trim();
    }
  }
  try {
    const url = new URL(request.url);
    const qp = url.searchParams.get('cf-turnstile-response') || url.searchParams.get('turnstileToken');
    if (qp && qp.trim()) {
      return qp.trim();
    }
  } catch {
    // Ignore invalid URL
  }
  return '';
}

export async function verifyTurnstileToken(
  request: Request,
  env: AdminEnv | undefined,
  token: string,
  expectedAction?: string
): Promise<TurnstileVerifyResult> {
  const secret = getTurnstileSecret(env);
  if (!secret) {
    return { ok: true };
  }

  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) {
    return {
      ok: false,
      errorCode: 'TURNSTILE_REQUIRED',
      message: 'Vérification anti-bot Turnstile requise.',
    };
  }

  const expectedHostnames = new Set(
    String(env?.TURNSTILE_HOSTNAMES || '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean)
  );

  const clientIp = getRawClientIp(request);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try {
      response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: controller.signal,
        body: new URLSearchParams({
          secret,
          response: token,
          remoteip: clientIp,
        }),
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      return {
        ok: false,
        errorCode: 'TURNSTILE_FAILED',
        message: 'Vérification anti-bot Turnstile échouée.',
      };
    }

    const result = (await response.json()) as SiteverifyPayload;
    if (!result || result.success !== true) {
      return {
        ok: false,
        errorCode: 'TURNSTILE_FAILED',
        message: 'Jeton Turnstile invalide ou expiré. Veuillez réessayer.',
      };
    }

    if (expectedAction && result.action && result.action !== expectedAction) {
      return {
        ok: false,
        errorCode: 'TURNSTILE_FAILED',
        message: 'Action Turnstile non concordante.',
      };
    }

    if (expectedHostnames.size > 0) {
      const respHost = String(result.hostname || '').trim().toLowerCase();
      if (!respHost || !expectedHostnames.has(respHost)) {
        return {
          ok: false,
          errorCode: 'TURNSTILE_FAILED',
          message: 'Domaine Turnstile non autorisé.',
        };
      }
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      errorCode: 'TURNSTILE_FAILED',
      message: 'Impossible de valider la vérification Turnstile.',
    };
  }
}
