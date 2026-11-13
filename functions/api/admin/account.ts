import { type AdminEnv, getDb } from '../../_lib/db.ts';
import {
  type D1UserRecord,
  MIN_USER_PASSWORD_LENGTH,
  buildSessionSetCookieHeader,
  createSignedSessionToken,
  getFirstAuthorizedTab,
  hashPasswordPbkdf2,
  recordAuditLog,
  requirePermission,
  verifyCsrfAndJson,
  verifyPasswordPbkdf2,
} from '../../_lib/auth.ts';

export interface PagesContext {
  request: Request;
  env?: AdminEnv;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env = {} } = context;
  const auth = await requirePermission(request, env, 'authenticated', {
    allowMustChangePassword: true,
  });
  if (!auth.ok) return auth.response;

  const { principal } = auth;
  return new Response(
    JSON.stringify({
      ok: true,
      user: {
        id: principal.userId,
        login: principal.login,
        displayName: principal.displayName,
        roleLabel: principal.roleLabel,
        isOwner: principal.isOwner,
        permissions: principal.permissions,
        mustChangePassword: principal.mustChangePassword,
        firstAuthorizedTab: getFirstAuthorizedTab(principal),
      },
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
  const auth = await requirePermission(request, env, 'authenticated', {
    allowMustChangePassword: true,
  });
  if (!auth.ok) return auth.response;

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

  const { principal } = auth;
  if (principal.isOwner || !principal.userId) {
    return new Response(
      JSON.stringify({
        ok: false,
        errorCode: 'OWNER_PASSWORD_ENV',
        message:
          'Le mot de passe du compte propriétaire (ADMIN_PASSWORD) est défini via les secrets Cloudflare (wrangler pages secret put ADMIN_PASSWORD).',
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  const db = getDb(env);
  if (!db) {
    return new Response(
      JSON.stringify({
        ok: false,
        message: 'Base de données D1 non disponible.',
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  let body: { currentPassword?: string; newPassword?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const currentPassword =
    typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword =
    typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword) {
    return new Response(
      JSON.stringify({
        ok: false,
        errorCode: 'MISSING_CURRENT_PASSWORD',
        message: 'Veuillez saisir votre mot de passe actuel (ou temporaire).',
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  if (newPassword.length < MIN_USER_PASSWORD_LENGTH) {
    return new Response(
      JSON.stringify({
        ok: false,
        errorCode: 'PASSWORD_TOO_SHORT',
        message: `Le nouveau mot de passe doit contenir au moins ${MIN_USER_PASSWORD_LENGTH} caractères.`,
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  const userRow = await db
    .prepare(
      `SELECT id, login, display_name, role_label, password_hash, must_change_password, active, permissions, session_version
       FROM users WHERE id = ?`
    )
    .bind(principal.userId)
    .first<D1UserRecord>();

  if (!userRow || Number(userRow.active) !== 1 || !userRow.password_hash) {
    return new Response(
      JSON.stringify({
        ok: false,
        errorCode: 'UNAUTHORIZED',
        message: 'Compte introuvable ou désactivé.',
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

  const currentMatches = await verifyPasswordPbkdf2(
    currentPassword,
    userRow.password_hash
  );
  if (!currentMatches) {
    await recordAuditLog(
      env,
      principal.login,
      'account.password_change_failed',
      'Mot de passe actuel erroné lors du changement de mot de passe'
    );
    return new Response(
      JSON.stringify({
        ok: false,
        errorCode: 'INVALID_CURRENT_PASSWORD',
        message: 'Le mot de passe actuel est incorrect.',
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

  const sameAsCurrent =
    newPassword === currentPassword ||
    (await verifyPasswordPbkdf2(newPassword, userRow.password_hash));

  if (sameAsCurrent) {
    return new Response(
      JSON.stringify({
        ok: false,
        errorCode: 'PASSWORD_UNCHANGED',
        message:
          'Le nouveau mot de passe doit être différent du mot de passe temporaire ou actuel.',
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  const newHash = await hashPasswordPbkdf2(newPassword);
  await db
    .prepare(
      'UPDATE users SET password_hash = ?, must_change_password = ?, session_version = session_version + 1, failed_attempts = 0, locked_until = NULL WHERE id = ?'
    )
    .bind(newHash, 0, principal.userId)
    .run();

  const updatedRow = await db
    .prepare('SELECT session_version FROM users WHERE id = ?')
    .bind(principal.userId)
    .first<{ session_version: number }>();

  const nextSessionVersion =
    Number(updatedRow?.session_version) || principal.sessionVersion + 1;

  await recordAuditLog(
    env,
    principal.login,
    'account.password_changed',
    `Mot de passe modifié par l'utilisateur (${principal.login})`
  );

  const sessionSecret = String(env.SESSION_SECRET || '');
  const newToken = await createSignedSessionToken(sessionSecret, Date.now(), {
    type: 'user',
    userId: principal.userId,
    sessionVersion: nextSessionVersion,
  });
  const cookieHeader = buildSessionSetCookieHeader(newToken);

  return new Response(
    JSON.stringify({
      ok: true,
      message: 'Votre mot de passe a été mis à jour avec succès.',
      user: {
        id: principal.userId,
        login: principal.login,
        displayName: principal.displayName,
        roleLabel: principal.roleLabel,
        isOwner: false,
        permissions: principal.permissions,
        mustChangePassword: false,
        firstAuthorizedTab: getFirstAuthorizedTab(principal),
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
