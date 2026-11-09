import { type AdminEnv, getDb, getRawClientIp, hashIpAddress } from '../../_lib/db.ts';
import {
  buildSessionSetCookieHeader,
  checkLoginBruteForce,
  clearLoginAttempts,
  constantTimeEqual,
  createSignedSessionToken,
  isRequestAdminAuthenticated,
  recordFailedLoginAttempt,
  verifyCsrfAndJson,
} from '../../_lib/auth.ts';

export interface PagesContext {
  request: Request;
  env?: AdminEnv;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env = {} } = context;
  const authenticated = await isRequestAdminAuthenticated(request, env);
  return new Response(
    JSON.stringify({
      ok: true,
      authenticated,
      dbConnected: Boolean(getDb(env)),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }
  );
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env = {} } = context;

  const csrf = verifyCsrfAndJson(request);
  if (!csrf.ok) {
    return new Response(JSON.stringify({ ok: false, message: csrf.error }), {
      status: 403,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const adminPassword = String(env.ADMIN_PASSWORD || '');
  const sessionSecret = String(env.SESSION_SECRET || '');
  if (!adminPassword || !sessionSecret) {
    return new Response(
      JSON.stringify({
        ok: false,
        message:
          'Secrets ADMIN_PASSWORD ou SESSION_SECRET non configurés dans Cloudflare. Consultez SETUP.md.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      }
    );
  }

  const db = getDb(env);
  const rawIp = getRawClientIp(request);
  const ipHash = await hashIpAddress(rawIp, env.IP_HASH_SALT);

  // Vérification anti-brute-force (5 échecs -> blocage 15 min)
  const bruteCheck = await checkLoginBruteForce(db, ipHash);
  if (bruteCheck.blocked) {
    const minutes = Math.ceil(bruteCheck.retryAfterSec / 60);
    return new Response(
      JSON.stringify({
        ok: false,
        errorCode: 'BRUTE_FORCE_LOCKED',
        retryAfterSec: bruteCheck.retryAfterSec,
        message: `Trop de tentatives échouées (5 max). Accès bloqué pendant ${minutes} min (${bruteCheck.retryAfterSec}s).`,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Retry-After': String(bruteCheck.retryAfterSec),
        },
      }
    );
  }

  let body: { password?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const suppliedPassword = typeof body.password === 'string' ? body.password : '';
  const isMatch = await constantTimeEqual(suppliedPassword, adminPassword);

  if (!isMatch) {
    const failState = await recordFailedLoginAttempt(env, ipHash);
    if (failState.blocked) {
      return new Response(
        JSON.stringify({
          ok: false,
          errorCode: 'BRUTE_FORCE_LOCKED',
          retryAfterSec: failState.retryAfterSec,
          message:
            '5 tentatives incorrectes atteintes. Connexion bloquée pendant 15 minutes.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'Retry-After': String(failState.retryAfterSec),
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: false,
        errorCode: 'INVALID_PASSWORD',
        remainingAttempts: failState.remainingAttempts,
        message: `Mot de passe invalide (${failState.remainingAttempts} essai(s) restant(s) avant blocage de 15 min).`,
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      }
    );
  }

  await clearLoginAttempts(env, ipHash);
  const token = await createSignedSessionToken(sessionSecret);
  const cookieHeader = buildSessionSetCookieHeader(token);

  return new Response(
    JSON.stringify({
      ok: true,
      authenticated: true,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Set-Cookie': cookieHeader,
      },
    }
  );
}
