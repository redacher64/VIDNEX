import { type AdminEnv, getDb } from '../../_lib/db.ts';
import {
  ASSIGNABLE_PERMISSIONS,
  type D1UserRecord,
  MIN_USER_PASSWORD_LENGTH,
  ROLE_PRESETS,
  TEMP_PASSWORD_LENGTH,
  generateTemporaryPassword,
  hashPasswordPbkdf2,
  isOwnerLoginIdentifier,
  recordAuditLog,
  requirePermission,
  sanitizePermissions,
  verifyCsrfAndJson,
} from '../../_lib/auth.ts';

export interface PagesContext {
  request: Request;
  env?: AdminEnv;
}

interface AuditLogEntry {
  id: number;
  actor: string;
  action: string;
  target: string;
  created_at: number;
}

function serializeUserForAdmin(row: D1UserRecord) {
  return {
    id: Number(row.id),
    login: String(row.login),
    display_name: String(row.display_name || row.login),
    role_label: String(row.role_label || 'Membre'),
    must_change_password: Number(row.must_change_password) === 1,
    active: Number(row.active) === 1,
    permissions: sanitizePermissions(row.permissions),
    session_version: Number(row.session_version || 1),
    failed_attempts: Number(row.failed_attempts || 0),
    locked_until: row.locked_until ? Number(row.locked_until) : null,
    created_at: Number(row.created_at),
    last_login_at: row.last_login_at ? Number(row.last_login_at) : null,
  };
}

async function listUsersAndAudit(env: AdminEnv) {
  const db = getDb(env);
  if (!db) {
    return { users: [], auditLog: [] };
  }

  const [usersRes, auditRes] = await Promise.all([
    db
      .prepare(
        `SELECT id, login, display_name, role_label, must_change_password, active, permissions, session_version, failed_attempts, locked_until, created_at, last_login_at
         FROM users ORDER BY created_at DESC, id DESC`
      )
      .all<D1UserRecord>()
      .catch(() => ({ results: [] as D1UserRecord[] })),
    db
      .prepare(
        `SELECT id, actor, action, target, created_at
         FROM audit_log ORDER BY created_at DESC, id DESC LIMIT ?`
      )
      .bind(100)
      .all<AuditLogEntry>()
      .catch(() => ({ results: [] as AuditLogEntry[] })),
  ]);

  return {
    users: (usersRes.results || []).map(serializeUserForAdmin),
    auditLog: (auditRes.results || []).map((a) => ({
      id: Number(a.id),
      actor: String(a.actor),
      action: String(a.action),
      target: String(a.target),
      created_at: Number(a.created_at),
    })),
  };
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env = {} } = context;
  const auth = await requirePermission(request, env, 'owner');
  if (!auth.ok) return auth.response;

  const { users, auditLog } = await listUsersAndAudit(env);
  return new Response(
    JSON.stringify({
      ok: true,
      users,
      auditLog,
      assignablePermissions: [...ASSIGNABLE_PERMISSIONS],
      presets: Object.values(ROLE_PRESETS),
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
  const auth = await requirePermission(request, env, 'owner');
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

  let body: {
    action?:
      | 'create'
      | 'update_permissions'
      | 'reset_password'
      | 'toggle_active'
      | 'delete';
    id?: number;
    userId?: number;
    login?: string;
    display_name?: string;
    displayName?: string;
    role_label?: string;
    roleLabel?: string;
    permissions?: unknown;
    temporaryPassword?: string;
    active?: boolean;
  } = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const action = body.action || 'create';
  const actorLabel = 'Propriétaire (admin)';
  const nowMs = Date.now();

  // 1. CRÉATION D'UN COMPTE UTILISATEUR
  if (action === 'create') {
    const rawLogin = String(body.login || '').trim().toLowerCase();
    const displayName = String(
      body.display_name || body.displayName || ''
    ).trim();
    const roleLabel =
      String(body.role_label || body.roleLabel || 'Membre').trim() || 'Membre';
    const permissions = sanitizePermissions(body.permissions);

    if (!rawLogin || !/^[a-z0-9._-]{3,40}$/.test(rawLogin)) {
      return new Response(
        JSON.stringify({
          ok: false,
          errorCode: 'INVALID_LOGIN',
          message:
            'Identifiant invalide (3 à 40 caractères : lettres minuscules, chiffres, point, tiret ou underscore).',
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

    if (isOwnerLoginIdentifier(rawLogin, env)) {
      return new Response(
        JSON.stringify({
          ok: false,
          errorCode: 'RESERVED_LOGIN',
          message:
            'Cet identifiant est réservé au compte propriétaire principal.',
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

    if (!displayName || displayName.length < 2 || displayName.length > 80) {
      return new Response(
        JSON.stringify({
          ok: false,
          errorCode: 'INVALID_DISPLAY_NAME',
          message: 'Veuillez renseigner un nom affiché (2 à 80 caractères).',
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

    const existing = await db
      .prepare('SELECT id, login FROM users WHERE login = ?')
      .bind(rawLogin)
      .first<{ id: number; login: string }>();

    if (existing) {
      return new Response(
        JSON.stringify({
          ok: false,
          errorCode: 'DUPLICATE_LOGIN',
          message: `Un compte avec l'identifiant « ${rawLogin} » existe déjà.`,
        }),
        {
          status: 409,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    const customTempPassword =
      typeof body.temporaryPassword === 'string'
        ? body.temporaryPassword.trim()
        : '';
    if (
      customTempPassword &&
      customTempPassword.length < MIN_USER_PASSWORD_LENGTH
    ) {
      return new Response(
        JSON.stringify({
          ok: false,
          errorCode: 'PASSWORD_TOO_SHORT',
          message: `Le mot de passe temporaire doit contenir au moins ${MIN_USER_PASSWORD_LENGTH} caractères.`,
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

    const temporaryPassword =
      customTempPassword || generateTemporaryPassword(TEMP_PASSWORD_LENGTH);
    const passwordHash = await hashPasswordPbkdf2(temporaryPassword);

    await db
      .prepare(
        `INSERT INTO users (login, display_name, role_label, password_hash, must_change_password, active, permissions, session_version, failed_attempts, locked_until, created_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, NULL, ?, NULL)`
      )
      .bind(
        rawLogin,
        displayName,
        roleLabel.slice(0, 60),
        passwordHash,
        1,
        1,
        JSON.stringify(permissions),
        nowMs
      )
      .run();

    await recordAuditLog(
      env,
      actorLabel,
      'user.create',
      `${rawLogin} (${displayName} · rôle : ${roleLabel} · droits : ${permissions.join(', ') || 'aucun'})`,
      nowMs
    );

    const { users, auditLog } = await listUsersAndAudit(env);
    const createdUser = users.find((u) => u.login === rawLogin) || null;

    return new Response(
      JSON.stringify({
        ok: true,
        user: createdUser,
        temporaryPassword,
        users,
        auditLog,
      }),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  // Validation de l'identifiant cible pour les actions sur un compte existant
  const rawId = body.userId ?? body.id;
  if (
    rawId === undefined ||
    rawId === null ||
    String(rawId) === 'owner' ||
    String(rawId) === 'admin'
  ) {
    return new Response(
      JSON.stringify({
        ok: false,
        errorCode: 'CANNOT_MODIFY_OWNER',
        message:
          'Le compte propriétaire ne peut pas être désactivé, modifié ou supprimé.',
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

  const targetId = Number(rawId);
  if (!Number.isFinite(targetId) || targetId <= 0) {
    return new Response(
      JSON.stringify({
        ok: false,
        errorCode: 'INVALID_USER_ID',
        message: 'Identifiant utilisateur invalide.',
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

  const targetUser = await db
    .prepare(
      `SELECT id, login, display_name, role_label, must_change_password, active, permissions, session_version, failed_attempts, locked_until, created_at, last_login_at
       FROM users WHERE id = ?`
    )
    .bind(targetId)
    .first<D1UserRecord>();

  if (!targetUser) {
    return new Response(
      JSON.stringify({
        ok: false,
        errorCode: 'USER_NOT_FOUND',
        message: 'Compte utilisateur introuvable.',
      }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  // 2. MODIFICATION DES DROITS / RÔLE / NOM AFFICHÉ (incrémente session_version)
  if (action === 'update_permissions') {
    const nextPermissions = sanitizePermissions(body.permissions);
    const nextDisplayName =
      String(
        body.display_name || body.displayName || targetUser.display_name
      ).trim() || targetUser.display_name;
    const nextRoleLabel =
      String(
        body.role_label || body.roleLabel || targetUser.role_label
      ).trim() || targetUser.role_label;

    await db
      .prepare(
        'UPDATE users SET display_name = ?, role_label = ?, permissions = ?, session_version = session_version + 1 WHERE id = ?'
      )
      .bind(
        nextDisplayName.slice(0, 80),
        nextRoleLabel.slice(0, 60),
        JSON.stringify(nextPermissions),
        targetId
      )
      .run();

    await recordAuditLog(
      env,
      actorLabel,
      'user.update_permissions',
      `${targetUser.login} (rôle : ${nextRoleLabel} · droits : ${nextPermissions.join(', ') || 'aucun'})`,
      nowMs
    );

    const { users, auditLog } = await listUsersAndAudit(env);
    return new Response(
      JSON.stringify({
        ok: true,
        users,
        auditLog,
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

  // 3. RÉINITIALISATION DU MOT DE PASSE (incrémente session_version + must_change_password = 1)
  if (action === 'reset_password') {
    const customTemp =
      typeof body.temporaryPassword === 'string'
        ? body.temporaryPassword.trim()
        : '';
    if (customTemp && customTemp.length < MIN_USER_PASSWORD_LENGTH) {
      return new Response(
        JSON.stringify({
          ok: false,
          errorCode: 'PASSWORD_TOO_SHORT',
          message: `Le mot de passe temporaire doit contenir au moins ${MIN_USER_PASSWORD_LENGTH} caractères.`,
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

    const temporaryPassword =
      customTemp || generateTemporaryPassword(TEMP_PASSWORD_LENGTH);
    const passwordHash = await hashPasswordPbkdf2(temporaryPassword);

    await db
      .prepare(
        'UPDATE users SET password_hash = ?, must_change_password = ?, session_version = session_version + 1, failed_attempts = 0, locked_until = NULL WHERE id = ?'
      )
      .bind(passwordHash, 1, targetId)
      .run();

    await recordAuditLog(
      env,
      actorLabel,
      'user.reset_password',
      `Réinitialisation du mot de passe temporaire pour ${targetUser.login}`,
      nowMs
    );

    const { users, auditLog } = await listUsersAndAudit(env);
    return new Response(
      JSON.stringify({
        ok: true,
        temporaryPassword,
        users,
        auditLog,
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

  // 4. DÉSACTIVATION / RÉACTIVATION D'UN COMPTE (incrémente session_version)
  if (action === 'toggle_active') {
    const nextActive =
      typeof body.active === 'boolean'
        ? body.active
          ? 1
          : 0
        : Number(targetUser.active) === 1
        ? 0
        : 1;

    await db
      .prepare(
        'UPDATE users SET active = ?, session_version = session_version + 1 WHERE id = ?'
      )
      .bind(nextActive, targetId)
      .run();

    await recordAuditLog(
      env,
      actorLabel,
      nextActive === 1 ? 'user.reactivate' : 'user.deactivate',
      `${nextActive === 1 ? 'Réactivation' : 'Désactivation'} du compte ${targetUser.login}`,
      nowMs
    );

    const { users, auditLog } = await listUsersAndAudit(env);
    return new Response(
      JSON.stringify({
        ok: true,
        users,
        auditLog,
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

  // 5. SUPPRESSION D'UN COMPTE
  if (action === 'delete') {
    await db.prepare('DELETE FROM users WHERE id = ?').bind(targetId).run();

    await recordAuditLog(
      env,
      actorLabel,
      'user.delete',
      `Suppression définitive du compte ${targetUser.login} (${targetUser.display_name})`,
      nowMs
    );

    const { users, auditLog } = await listUsersAndAudit(env);
    return new Response(
      JSON.stringify({
        ok: true,
        users,
        auditLog,
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

  return new Response(
    JSON.stringify({
      ok: false,
      errorCode: 'UNKNOWN_ACTION',
      message: 'Action non reconnue.',
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

export async function onRequestDelete(context: PagesContext): Promise<Response> {
  const { request, env = {} } = context;
  const auth = await requirePermission(request, env, 'owner');
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

  let body: { id?: number; userId?: number } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const proxyReq = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({
      action: 'delete',
      id: body.userId ?? body.id,
    }),
  });
  return onRequestPost({ request: proxyReq, env });
}
