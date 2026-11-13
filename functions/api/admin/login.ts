import { type AdminEnv, getDb, getRawClientIp, hashIpAddress } from '../../_lib/db.ts';
import {
  ASSIGNABLE_PERMISSIONS,
  type D1UserRecord,
  LOCKOUT_DURATION_MS,
  MAX_LOGIN_ATTEMPTS,
  buildSessionSetCookieHeader,
  checkLoginBruteForce,
  clearLoginAttempts,
  constantTimeEqual,
  createSignedSessionToken,
  getAuthenticatedPrincipal,
  getFirstAuthorizedTab,
  isOwnerLoginIdentifier,
  recordAuditLog,
  recordFailedLoginAttempt,
  sanitizePermissions,
  verifyCsrfAndJson,
  verifyPasswordPbkdf2,
} from '../../_lib/auth.ts';

export interface PagesContext {
  request: Request;
  env?: AdminEnv;
}

const DUMMY_PBKDF2_HASH =
  'pbkdf2_sha256$100000$00112233445566778899aabbccddeeff$0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env = {} } = context;
  const principal = await getAuthenticatedPrincipal(request, env);
  const authenticated = principal !== null;

  return new Response(
    JSON.stringify({
      ok: true,
      authenticated,
      dbConnected: Boolean(getDb(env)),
      user: principal
        ? {
            id: principal.userId,
            login: principal.login,
            displayName: principal.displayName,
            roleLabel: principal.roleLabel,
            isOwner: principal.isOwner,
            permissions: principal.permissions,
            mustChangePassword: principal.mustChangePassword,
            firstAuthorizedTab: getFirstAuthorizedTab(principal),
          }
        : null,
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
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  const adminPassword = String(env.ADMIN_PASSWORD || '');
  const sessionSecret = String(env.SESSION_SECRET || '');
  if (!adminPassword || !sessionSecret) {
    return new Response(
      JSON.stringify({
        ok: false,
        message:
          'Secrets ADMIN_PASSWORD ou SESSION_SECRET non configurés dans Cloudflare. Consultez README.md.',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  let body: { login?: string; password?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const hasExplicitLogin =
    typeof body.login === 'string' && body.login.trim().length > 0;
  const rawLogin = hasExplicitLogin ? body.login!.trim() : 'admin';
  const normalizedLogin = rawLogin.toLowerCase();
  const suppliedPassword =
    typeof body.password === 'string' ? body.password : '';

  const nowMs = Date.now();
  const db = getDb(env);
  const rawIp = getRawClientIp(request);
  const ipHash = await hashIpAddress(rawIp, env.IP_HASH_SALT);
  const loginKeyHash = `login:${await hashIpAddress(normalizedLogin, env.IP_HASH_SALT)}`;

  // 1. Vérification anti-brute-force par IP ET par identifiant (5 échecs -> blocage 15 min)
  const [ipBruteCheck, loginBruteCheck] = await Promise.all([
    checkLoginBruteForce(db, ipHash, nowMs),
    hasExplicitLogin
      ? checkLoginBruteForce(db, loginKeyHash, nowMs)
      : Promise.resolve({
          blocked: false,
          retryAfterSec: 0,
          remainingAttempts: MAX_LOGIN_ATTEMPTS,
        }),
  ]);

  if (ipBruteCheck.blocked || loginBruteCheck.blocked) {
    const retryAfterSec = Math.max(
      ipBruteCheck.retryAfterSec,
      loginBruteCheck.retryAfterSec,
      1
    );
    const minutes = Math.ceil(retryAfterSec / 60);
    return new Response(
      JSON.stringify({
        ok: false,
        errorCode: 'BRUTE_FORCE_LOCKED',
        retryAfterSec,
        message: `Trop de tentatives échouées (5 max). Accès bloqué pendant ${minutes} min (${retryAfterSec}s).`,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Retry-After': String(retryAfterSec),
        },
      }
    );
  }

  // 2. Cas A : Compte Propriétaire (ADMIN_PASSWORD)
  if (isOwnerLoginIdentifier(normalizedLogin, env)) {
    const isMatch = await constantTimeEqual(suppliedPassword, adminPassword);

    if (!isMatch) {
      const [ipFail, loginFail] = await Promise.all([
        recordFailedLoginAttempt(env, ipHash, nowMs),
        hasExplicitLogin
          ? recordFailedLoginAttempt(env, loginKeyHash, nowMs)
          : Promise.resolve({
              blocked: false,
              retryAfterSec: 0,
              remainingAttempts: MAX_LOGIN_ATTEMPTS,
            }),
      ]);
      await recordAuditLog(
        env,
        normalizedLogin,
        'login.failed',
        'Échec de connexion (compte propriétaire)',
        nowMs
      );

      if (ipFail.blocked || loginFail.blocked) {
        const retryAfterSec = Math.max(
          ipFail.retryAfterSec,
          loginFail.retryAfterSec,
          Math.ceil(LOCKOUT_DURATION_MS / 1000)
        );
        return new Response(
          JSON.stringify({
            ok: false,
            errorCode: 'BRUTE_FORCE_LOCKED',
            retryAfterSec,
            message:
              '5 tentatives incorrectes atteintes. Connexion bloquée pendant 15 minutes.',
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-store',
              'Retry-After': String(retryAfterSec),
            },
          }
        );
      }

      const remainingAttempts = Math.min(
        ipFail.remainingAttempts,
        loginFail.remainingAttempts
      );
      return new Response(
        JSON.stringify({
          ok: false,
          errorCode: 'INVALID_PASSWORD',
          remainingAttempts,
          message: 'Identifiant ou mot de passe incorrect.',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    await Promise.all([
      clearLoginAttempts(env, ipHash),
      clearLoginAttempts(env, loginKeyHash),
    ]);
    await recordAuditLog(
      env,
      'Propriétaire (admin)',
      'login.success',
      'Connexion propriétaire réussie',
      nowMs
    );

    const token = await createSignedSessionToken(sessionSecret, nowMs, {
      type: 'owner',
    });
    const cookieHeader = buildSessionSetCookieHeader(token);

    return new Response(
      JSON.stringify({
        ok: true,
        authenticated: true,
        user: {
          id: null,
          login: 'admin',
          displayName: 'Propriétaire',
          roleLabel: 'Propriétaire',
          isOwner: true,
          permissions: [...ASSIGNABLE_PERMISSIONS],
          mustChangePassword: false,
          firstAuthorizedTab: 'dashboard',
        },
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

  // 3. Cas B : Compte utilisateur individuel dans D1 (`users`)
  let userRow: D1UserRecord | null = null;
  if (db) {
    try {
      userRow = await db
        .prepare(
          `SELECT id, login, display_name, role_label, password_hash, must_change_password, active, permissions, session_version, failed_attempts, locked_until, created_at, last_login_at
           FROM users WHERE login = ?`
        )
        .bind(normalizedLogin)
        .first<D1UserRecord>();
    } catch {
      userRow = null;
    }
  }

  // Vérifier si le compte utilisateur est verrouillé dans `users.locked_until`
  if (userRow && userRow.locked_until && Number(userRow.locked_until) > nowMs) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((Number(userRow.locked_until) - nowMs) / 1000)
    );
    const minutes = Math.ceil(retryAfterSec / 60);
    return new Response(
      JSON.stringify({
        ok: false,
        errorCode: 'BRUTE_FORCE_LOCKED',
        retryAfterSec,
        message: `Trop de tentatives échouées (5 max). Accès bloqué pendant ${minutes} min (${retryAfterSec}s).`,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Retry-After': String(retryAfterSec),
        },
      }
    );
  }

  const hashToVerify = userRow?.password_hash || DUMMY_PBKDF2_HASH;
  const passwordValid = await verifyPasswordPbkdf2(
    suppliedPassword,
    hashToVerify
  );
  const isAccountActive = Boolean(userRow && Number(userRow.active) === 1);

  if (!userRow || !passwordValid || !isAccountActive) {
    const [ipFail, loginFail] = await Promise.all([
      recordFailedLoginAttempt(env, ipHash, nowMs),
      recordFailedLoginAttempt(env, loginKeyHash, nowMs),
    ]);

    let userLockedUntil: number | null = null;
    if (db && userRow) {
      const nextFailed = (Number(userRow.failed_attempts) || 0) + 1;
      userLockedUntil =
        nextFailed >= MAX_LOGIN_ATTEMPTS ? nowMs + LOCKOUT_DURATION_MS : null;
      await db
        .prepare(
          'UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?'
        )
        .bind(nextFailed, userLockedUntil, userRow.id)
        .run()
        .catch(() => {});
    }

    await recordAuditLog(
      env,
      normalizedLogin,
      userRow && !isAccountActive ? 'login.disabled_account' : 'login.failed',
      userRow
        ? `Échec de connexion (${userRow.login})`
        : `Échec de connexion (identifiant inconnu : ${normalizedLogin})`,
      nowMs
    );

    if (ipFail.blocked || loginFail.blocked || userLockedUntil) {
      const retryAfterSec = Math.max(
        ipFail.retryAfterSec,
        loginFail.retryAfterSec,
        Math.ceil(LOCKOUT_DURATION_MS / 1000)
      );
      return new Response(
        JSON.stringify({
          ok: false,
          errorCode: 'BRUTE_FORCE_LOCKED',
          retryAfterSec,
          message:
            '5 tentatives incorrectes atteintes. Connexion bloquée pendant 15 minutes.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'Retry-After': String(retryAfterSec),
          },
        }
      );
    }

    const remainingAttempts = Math.min(
      ipFail.remainingAttempts,
      loginFail.remainingAttempts
    );
    return new Response(
      JSON.stringify({
        ok: false,
        errorCode: 'INVALID_PASSWORD',
        remainingAttempts,
        message: 'Identifiant ou mot de passe incorrect.',
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  // Connexion utilisateur réussie
  await Promise.all([
    clearLoginAttempts(env, ipHash),
    clearLoginAttempts(env, loginKeyHash),
    db
      ? db
          .prepare(
            'UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = ? WHERE id = ?'
          )
          .bind(nowMs, userRow.id)
          .run()
          .catch(() => {})
      : Promise.resolve(),
  ]);

  await recordAuditLog(
    env,
    userRow.login,
    'login.success',
    `Connexion réussie (${userRow.display_name})`,
    nowMs
  );

  const permissions = sanitizePermissions(userRow.permissions);
  const mustChangePassword = Number(userRow.must_change_password) === 1;
  const sessionVersion = Number(userRow.session_version) || 1;

  const token = await createSignedSessionToken(sessionSecret, nowMs, {
    type: 'user',
    userId: Number(userRow.id),
    sessionVersion,
  });
  const cookieHeader = buildSessionSetCookieHeader(token);

  return new Response(
    JSON.stringify({
      ok: true,
      authenticated: true,
      user: {
        id: Number(userRow.id),
        login: userRow.login,
        displayName: userRow.display_name,
        roleLabel: userRow.role_label,
        isOwner: false,
        permissions,
        mustChangePassword,
        firstAuthorizedTab: getFirstAuthorizedTab({
          isOwner: false,
          permissions,
        }),
      },
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
