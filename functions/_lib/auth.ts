/**
 * Sécurité, Authentification & Contrôle d'accès par rôle (RBAC) Admin (`/admin` et `/api/admin/*`) :
 * - Compte propriétaire (`ADMIN_PASSWORD`) conservé avec tous les droits (comparaison en temps constant SHA-256).
 * - Comptes par personne stockés dans Cloudflare D1 (`users`) avec hachage PBKDF2-SHA256 via WebCrypto
 *   (sel aléatoire 128 bits + 100 000 itérations, maximum supporté par Cloudflare Workers).
 * - Session par cookie signé HMAC-SHA256 (`SESSION_SECRET`), expiration 12 h,
 *   drapeaux `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`.
 * - Relecture systématique des droits, du statut `active` et de `session_version` dans D1 à chaque requête.
 * - Fonction centrale `requirePermission(request, env, perm)` avec politique « défaut = refus » (réservé au propriétaire).
 * - Anti-brute-force par IP ET par identifiant (`login_attempts` + `users.failed_attempts`/`locked_until`) :
 *   blocage 15 min après 5 échecs.
 * - Protection CSRF sur toutes les routes mutatives : exige `Content-Type: application/json`
 *   et vérifie que l'en-tête `Origin` correspond à l'origine du site.
 */

import { type AdminEnv, type D1Database, getDb } from './db.ts';

export const ADMIN_COOKIE_NAME = 'vidnex_admin_session';
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 heures
export const MAX_LOGIN_ATTEMPTS = 5;
export const BRUTE_FORCE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
export const PBKDF2_MAX_WORKERS_ITERATIONS = 100_000;
export const MIN_USER_PASSWORD_LENGTH = 12;
export const TEMP_PASSWORD_LENGTH = 16;

/**
 * Indique si le module Blog est activé dans l'interface `/admin`.
 * Les permissions `blog.*` sont déjà enregistrées en base ; l'entrée de menu Blog
 * n'apparaît que lorsque le module blog existera.
 */
export const BLOG_MODULE_ENABLED = true;

/**
 * Liste stricte des 7 droits assignables aux comptes utilisateurs.
 */
export const ASSIGNABLE_PERMISSIONS = [
  'dashboard.view',
  'health.view',
  'activity.view',
  'blog.write',
  'blog.edit_all',
  'blog.delete',
  'blog.publish',
] as const;

export type AssignablePermission = (typeof ASSIGNABLE_PERMISSIONS)[number];

/**
 * Domaines réservés exclusivement au compte propriétaire (non assignables).
 */
export const OWNER_ONLY_RESOURCES = [
  'controls',
  'users',
  'settings',
  'services_tiers',
  'secrets',
  'audit_log',
] as const;

/**
 * Identifiants réservés au compte propriétaire (`ADMIN_PASSWORD`).
 */
export const RESERVED_OWNER_LOGINS = ['admin', 'owner', 'proprietaire'] as const;

export interface RolePreset {
  id: 'redacteur_blog' | 'editeur_blog' | 'observateur' | 'custom';
  label: string;
  permissions: AssignablePermission[];
}

export const ROLE_PRESETS: Record<
  'redacteur_blog' | 'editeur_blog' | 'observateur',
  RolePreset
> = {
  redacteur_blog: {
    id: 'redacteur_blog',
    label: 'Rédacteur blog',
    permissions: ['blog.write'],
  },
  editeur_blog: {
    id: 'editeur_blog',
    label: 'Éditeur blog',
    permissions: ['blog.write', 'blog.edit_all', 'blog.delete'],
  },
  observateur: {
    id: 'observateur',
    label: 'Observateur',
    permissions: ['dashboard.view', 'health.view', 'activity.view'],
  },
};

export interface AdminPrincipal {
  type: 'owner' | 'user';
  isOwner: boolean;
  userId: number | null;
  login: string;
  displayName: string;
  roleLabel: string;
  permissions: AssignablePermission[];
  mustChangePassword: boolean;
  active: boolean;
  sessionVersion: number;
}

export interface D1UserRecord {
  id: number;
  login: string;
  display_name: string;
  role_label: string;
  password_hash?: string;
  must_change_password: number;
  active: number;
  permissions: string;
  session_version: number;
  failed_attempts: number;
  locked_until: number | null;
  created_at: number;
  last_login_at: number | null;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array | null {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    return null;
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Filtre et valide une liste de permissions pour ne conserver que les droits assignables autorisés.
 */
export function sanitizePermissions(raw: unknown): AssignablePermission[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        list = parsed;
      }
    } catch {
      list = [];
    }
  }

  const allowedSet = new Set<string>(ASSIGNABLE_PERMISSIONS);
  const unique = new Set<AssignablePermission>();
  for (const item of list) {
    if (typeof item === 'string' && allowedSet.has(item)) {
      unique.add(item as AssignablePermission);
    }
  }
  return Array.from(unique);
}

/**
 * Vérifie si un identifiant correspond au compte propriétaire.
 */
export function isOwnerLoginIdentifier(login: string, env?: AdminEnv): boolean {
  const normalized = (login || '').trim().toLowerCase();
  if (!normalized) return false;
  const customOwnerLogin = String(env?.ADMIN_LOGIN || '').trim().toLowerCase();
  if (customOwnerLogin && normalized === customOwnerLogin) {
    return true;
  }
  return (RESERVED_OWNER_LOGINS as readonly string[]).includes(normalized);
}

/**
 * Comparaison en temps constant de deux chaînes via leurs condensats SHA-256 (32 octets fixes)
 * pour empêcher toute attaque temporelle (timing attack), même si les longueurs diffèrent.
 */
export async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const bytesA = new Uint8Array(hashA);
  const bytesB = new Uint8Array(hashB);
  let diff = a.length ^ b.length;
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i];
  }
  return diff === 0;
}

/**
 * Hache un mot de passe avec PBKDF2-SHA256 via WebCrypto, sel aléatoire de 16 octets
 * et 100 000 itérations (maximum supporté par Cloudflare Workers).
 * Format : `pbkdf2_sha256$<iterations>$<saltHex>$<hashHex>`
 */
export async function hashPasswordPbkdf2(
  password: string,
  iterations = PBKDF2_MAX_WORKERS_ITERATIONS
): Promise<string> {
  const safeIterations = Math.min(
    PBKDF2_MAX_WORKERS_ITERATIONS,
    Math.max(10_000, Math.floor(iterations))
  );
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: safeIterations,
    },
    keyMaterial,
    256
  );

  const saltHex = toHex(salt);
  const hashHex = toHex(new Uint8Array(derivedBits));
  return `pbkdf2_sha256$${safeIterations}$${saltHex}$${hashHex}`;
}

/**
 * Vérifie un mot de passe contre un hachage PBKDF2-SHA256 en temps constant.
 */
export async function verifyPasswordPbkdf2(
  password: string,
  storedHash: string
): Promise<boolean> {
  if (!password || !storedHash) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') {
    return false;
  }

  const iterations = parseInt(parts[1], 10);
  if (
    !Number.isFinite(iterations) ||
    iterations < 1_000 ||
    iterations > PBKDF2_MAX_WORKERS_ITERATIONS
  ) {
    return false;
  }

  const salt = fromHex(parts[2]);
  const expectedBytes = fromHex(parts[3]);
  if (!salt || !expectedBytes || expectedBytes.length !== 32) {
    return false;
  }

  try {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: salt as BufferSource,
        iterations,
      },
      keyMaterial,
      256
    );

    const actualBytes = new Uint8Array(derivedBits);
    if (actualBytes.length !== expectedBytes.length) return false;
    let diff = 0;
    for (let i = 0; i < actualBytes.length; i++) {
      diff |= actualBytes[i] ^ expectedBytes[i];
    }
    return diff === 0;
  } catch {
    return false;
  }
}

/**
 * Génère un mot de passe temporaire aléatoire robuste (16 caractères par défaut).
 */
export function generateTemporaryPassword(length = TEMP_PASSWORD_LENGTH): string {
  const safeLen = Math.max(12, Math.min(64, length));
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*+-=?';
  const all = upper + lower + digits + symbols;

  const rnd = new Uint32Array(safeLen);
  crypto.getRandomValues(rnd);

  const chars: string[] = [
    upper[rnd[0] % upper.length],
    lower[rnd[1] % lower.length],
    digits[rnd[2] % digits.length],
    symbols[rnd[3] % symbols.length],
  ];

  for (let i = 4; i < safeLen; i++) {
    chars.push(all[rnd[i] % all.length]);
  }

  // Mélange de Fisher-Yates avec octets aléatoires
  const shuffleRnd = new Uint32Array(safeLen);
  crypto.getRandomValues(shuffleRnd);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffleRnd[i] % (i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }

  return chars.join('');
}

async function computeHmacSha256Hex(
  payload: string,
  secret: string
): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(payload));
  return toHex(new Uint8Array(sig));
}

export interface SessionTokenSubject {
  type: 'owner' | 'user';
  userId?: number;
  sessionVersion?: number;
}

/**
 * Génère la valeur signée du cookie de session Admin :
 * - Propriétaire : `admin.<expTs>.<nonce>.<hmacHex>`
 * - Utilisateur D1 : `u2.<userId>.<sessionVersion>.<expTs>.<nonce>.<hmacHex>`
 */
export async function createSignedSessionToken(
  sessionSecret: string,
  nowMs = Date.now(),
  subject: SessionTokenSubject = { type: 'owner' }
): Promise<string> {
  const expTs = nowMs + SESSION_TTL_MS;
  const randomBytes = new Uint8Array(12);
  crypto.getRandomValues(randomBytes);
  const nonce = toHex(randomBytes);

  if (subject.type === 'user' && subject.userId && subject.userId > 0) {
    const ver = Math.max(1, Math.floor(subject.sessionVersion ?? 1));
    const payload = `u2.${subject.userId}.${ver}.${expTs}.${nonce}`;
    const signature = await computeHmacSha256Hex(payload, sessionSecret);
    return `${payload}.${signature}`;
  }

  const payload = `admin.${expTs}.${nonce}`;
  const signature = await computeHmacSha256Hex(payload, sessionSecret);
  return `${payload}.${signature}`;
}

export interface ParsedSessionToken {
  valid: boolean;
  type: 'owner' | 'user';
  userId: number | null;
  sessionVersion: number;
  expTs: number;
}

/**
 * Décode et vérifie la signature HMAC-SHA256 ainsi que l'expiration (12 h) d'un token de session.
 */
export async function parseAndVerifySessionToken(
  token: string,
  sessionSecret: string,
  nowMs = Date.now()
): Promise<ParsedSessionToken | null> {
  if (!token || !sessionSecret) return null;
  const parts = token.split('.');

  // Format propriétaire : admin.<expTs>.<nonce>.<sig>
  if (parts.length === 4) {
    const [role, expStr, nonce, providedSig] = parts;
    if (role !== 'admin' || !nonce || !providedSig) return null;
    const expTs = Number(expStr);
    if (!Number.isFinite(expTs) || nowMs > expTs) return null;

    const payload = `${role}.${expStr}.${nonce}`;
    const expectedSig = await computeHmacSha256Hex(payload, sessionSecret);
    const isOk = await constantTimeEqual(providedSig, expectedSig);
    if (!isOk) return null;

    return {
      valid: true,
      type: 'owner',
      userId: null,
      sessionVersion: 1,
      expTs,
    };
  }

  // Format utilisateur D1 : u2.<userId>.<sessionVersion>.<expTs>.<nonce>.<sig>
  if (parts.length === 6) {
    const [prefix, userIdStr, verStr, expStr, nonce, providedSig] = parts;
    if (prefix !== 'u2' || !nonce || !providedSig) return null;
    const userId = parseInt(userIdStr, 10);
    const sessionVersion = parseInt(verStr, 10);
    const expTs = Number(expStr);
    if (
      !Number.isFinite(userId) ||
      userId <= 0 ||
      !Number.isFinite(sessionVersion) ||
      sessionVersion < 1 ||
      !Number.isFinite(expTs) ||
      nowMs > expTs
    ) {
      return null;
    }

    const payload = `u2.${userIdStr}.${verStr}.${expStr}.${nonce}`;
    const expectedSig = await computeHmacSha256Hex(payload, sessionSecret);
    const isOk = await constantTimeEqual(providedSig, expectedSig);
    if (!isOk) return null;

    return {
      valid: true,
      type: 'user',
      userId,
      sessionVersion,
      expTs,
    };
  }

  return null;
}

/**
 * Vérifie l'intégrité HMAC-SHA256 et la date d'expiration (12 h) du token de session.
 */
export async function verifySignedSessionToken(
  token: string,
  sessionSecret: string,
  nowMs = Date.now()
): Promise<boolean> {
  const parsed = await parseAndVerifySessionToken(token, sessionSecret, nowMs);
  return Boolean(parsed?.valid);
}

/**
 * Extrait la valeur d'un cookie nommé depuis l'en-tête `Cookie`.
 */
export function parseCookieValue(
  cookieHeader: string | null,
  name: string
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx > 0) {
      const k = part.slice(0, eqIdx).trim();
      const v = part.slice(eqIdx + 1).trim();
      if (k === name) return v;
    }
  }
  return null;
}

/**
 * Construit l'en-tête `Set-Cookie` sécurisé (HttpOnly, Secure, SameSite=Strict, 12h).
 */
export function buildSessionSetCookieHeader(token: string): string {
  const maxAgeSec = Math.floor(SESSION_TTL_MS / 1000);
  return `${ADMIN_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAgeSec}`;
}

/**
 * Construit l'en-tête `Set-Cookie` de déconnexion immédiate.
 */
export function buildLogoutSetCookieHeader(): string {
  return `${ADMIN_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

/**
 * Résout l'identité complète de la session courante en relisant obligatoirement D1 pour les comptes `users`.
 * Si le compte a été désactivé (`active = 0`), supprimé ou que sa `session_version` a changé, retourne `null`.
 */
export async function getAuthenticatedPrincipal(
  request: Request,
  env: AdminEnv,
  nowMs = Date.now()
): Promise<AdminPrincipal | null> {
  const secret = String(env.SESSION_SECRET || '').trim();
  if (!secret) return null;
  const token = parseCookieValue(
    request.headers.get('Cookie'),
    ADMIN_COOKIE_NAME
  );
  if (!token) return null;

  const parsed = await parseAndVerifySessionToken(token, secret, nowMs);
  if (!parsed) return null;

  if (parsed.type === 'owner') {
    return {
      type: 'owner',
      isOwner: true,
      userId: null,
      login: 'admin',
      displayName: 'Propriétaire',
      roleLabel: 'Propriétaire',
      permissions: [...ASSIGNABLE_PERMISSIONS],
      mustChangePassword: false,
      active: true,
      sessionVersion: 1,
    };
  }

  const db = getDb(env);
  if (!db || !parsed.userId) return null;

  try {
    const row = await db
      .prepare(
        `SELECT id, login, display_name, role_label, must_change_password, active, permissions, session_version, failed_attempts, locked_until, created_at, last_login_at
         FROM users WHERE id = ?`
      )
      .bind(parsed.userId)
      .first<D1UserRecord>();

    if (!row) return null;
    if (Number(row.active) !== 1) return null;
    if (Number(row.session_version) !== parsed.sessionVersion) return null;

    return {
      type: 'user',
      isOwner: false,
      userId: Number(row.id),
      login: String(row.login),
      displayName: String(row.display_name || row.login),
      roleLabel: String(row.role_label || 'Membre'),
      permissions: sanitizePermissions(row.permissions),
      mustChangePassword: Number(row.must_change_password) === 1,
      active: true,
      sessionVersion: Number(row.session_version),
    };
  } catch {
    return null;
  }
}

/**
 * Vérifie si la requête possède une session Admin valide (propriétaire ou utilisateur D1 actif).
 */
export async function isRequestAdminAuthenticated(
  request: Request,
  env: AdminEnv
): Promise<boolean> {
  const principal = await getAuthenticatedPrincipal(request, env);
  return principal !== null;
}

export const BLOG_PERMISSIONS: readonly AssignablePermission[] = [
  'blog.write',
  'blog.edit_all',
  'blog.delete',
  'blog.publish',
];

export type DeclaredPermission =
  | AssignablePermission
  | readonly AssignablePermission[]
  | 'owner'
  | 'authenticated'
  | null
  | undefined;

export interface RequirePermissionOptions {
  allowMustChangePassword?: boolean;
}

export type RequirePermissionResult =
  | { ok: true; principal: AdminPrincipal }
  | { ok: false; status: 401 | 403; response: Response };

function buildJsonErrorResponse(
  status: 401 | 403,
  errorCode: 'UNAUTHORIZED' | 'FORBIDDEN' | 'MUST_CHANGE_PASSWORD',
  message: string
): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      errorCode,
      message,
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    }
  );
}

/**
 * Fonction centrale de contrôle d'accès appliquée à CHAQUE route `/api/admin/*`.
 * - Politique « défaut = refus » : si `perm` est omis, `null` ou `'owner'`, seul le compte
 *   propriétaire (`isOwner === true`) est autorisé. Tout autre compte reçoit un 403 propre.
 * - Les droits et `session_version` sont relus dans D1 à chaque requête.
 * - Si `must_change_password` est actif, bloque toutes les routes (403 `MUST_CHANGE_PASSWORD`)
 *   sauf `/api/admin/account` et `/api/admin/logout` (`allowMustChangePassword: true`).
 */
export async function requirePermission(
  request: Request,
  env: AdminEnv,
  perm?: DeclaredPermission,
  options?: RequirePermissionOptions
): Promise<RequirePermissionResult> {
  const principal = await getAuthenticatedPrincipal(request, env);
  if (!principal) {
    return {
      ok: false,
      status: 401,
      response: buildJsonErrorResponse(
        401,
        'UNAUTHORIZED',
        'Session administrateur invalide ou expirée. Veuillez vous reconnecter.'
      ),
    };
  }

  if (principal.mustChangePassword && !options?.allowMustChangePassword) {
    return {
      ok: false,
      status: 403,
      response: buildJsonErrorResponse(
        403,
        'MUST_CHANGE_PASSWORD',
        'Changement de mot de passe obligatoire avant d’accéder à l’administration.'
      ),
    };
  }

  if (principal.isOwner) {
    return { ok: true, principal };
  }

  if (perm === 'authenticated') {
    return { ok: true, principal };
  }

  // Défaut = refus : toute route sans droit assignable explicitement déclaré est réservée au propriétaire
  if (!perm || perm === 'owner') {
    return {
      ok: false,
      status: 403,
      response: buildJsonErrorResponse(403, 'FORBIDDEN', 'Accès refusé.'),
    };
  }

  if (Array.isArray(perm)) {
    const allowedList = perm as readonly AssignablePermission[];
    if (
      allowedList.length === 0 ||
      !allowedList.some((p) => principal.permissions.includes(p))
    ) {
      return {
        ok: false,
        status: 403,
        response: buildJsonErrorResponse(403, 'FORBIDDEN', 'Accès refusé.'),
      };
    }
    return { ok: true, principal };
  }

  if (!principal.permissions.includes(perm as AssignablePermission)) {
    return {
      ok: false,
      status: 403,
      response: buildJsonErrorResponse(403, 'FORBIDDEN', 'Accès refusé.'),
    };
  }

  return { ok: true, principal };
}

/**
 * Table centrale des droits requis par route `/api/admin/*`.
 * Toute route non listée ici tombe automatiquement en `perm: 'owner'` (défaut = refus pour les non-propriétaires).
 */
export function resolveAdminRoutePermission(
  pathname: string,
  method: string
): {
  perm: DeclaredPermission;
  allowMustChangePassword?: boolean;
} {
  const m = method.toUpperCase();
  if (pathname === '/api/admin/logout') {
    return { perm: 'authenticated', allowMustChangePassword: true };
  }
  if (pathname === '/api/admin/account') {
    return { perm: 'authenticated', allowMustChangePassword: true };
  }
  if (pathname === '/api/admin/stats' && m === 'GET') {
    return { perm: 'dashboard.view' };
  }
  if (pathname === '/api/admin/health' && m === 'GET') {
    return { perm: 'health.view' };
  }
  if (pathname === '/api/admin/activity' && m === 'GET') {
    return { perm: 'activity.view' };
  }
  if (pathname === '/api/admin/blog') {
    if (m === 'DELETE') {
      return { perm: 'blog.delete' };
    }
    return { perm: BLOG_PERMISSIONS };
  }
  // Toutes les autres routes (/api/admin/health POST, /api/admin/settings, /api/admin/blocklist,
  // /api/admin/users, ou toute route sans droit déclaré) sont réservées au propriétaire.
  return { perm: 'owner' };
}

/**
 * Détermine le premier onglet autorisé pour un utilisateur après connexion.
 */
export function getFirstAuthorizedTab(
  principal: Pick<AdminPrincipal, 'isOwner' | 'permissions'>
): 'dashboard' | 'health' | 'controls' | 'activity' | 'blog' | 'users' | 'account' {
  if (principal.isOwner) return 'dashboard';
  const perms = principal.permissions || [];
  if (perms.includes('dashboard.view')) return 'dashboard';
  if (perms.includes('health.view')) return 'health';
  if (perms.includes('activity.view')) return 'activity';
  if (BLOG_PERMISSIONS.some((p) => perms.includes(p))) return 'blog';
  return 'account';
}

/**
 * Enregistre une entrée dans le journal d'audit D1 (`audit_log`).
 * Aucun mot de passe ni donnée secrète ne doit jamais être passé à cette fonction.
 */
export async function recordAuditLog(
  env: AdminEnv,
  actor: string,
  action: string,
  target: string,
  nowMs = Date.now()
): Promise<void> {
  const db = getDb(env);
  if (!db) return;
  try {
    const safeActor = String(actor || 'inconnu').trim().slice(0, 64) || 'inconnu';
    const safeAction = String(action || 'action').trim().slice(0, 64) || 'action';
    const safeTarget = String(target || '—').trim().slice(0, 160) || '—';
    await db
      .prepare(
        'INSERT INTO audit_log (actor, action, target, created_at) VALUES (?, ?, ?, ?)'
      )
      .bind(safeActor, safeAction, safeTarget, nowMs)
      .run();
  } catch {
    // Journalisation non bloquante si D1 est indisponible
  }
}

/**
 * Vérifie la protection CSRF sur les requêtes qui modifient des données (`POST`, `PUT`, `DELETE`) :
 * 1. Exige `Content-Type: application/json`
 * 2. Vérifie que l'en-tête `Origin` correspond à l'origine de la requête.
 */
export function verifyCsrfAndJson(request: Request): {
  ok: boolean;
  error?: string;
} {
  const contentType = (request.headers.get('Content-Type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return {
      ok: false,
      error: 'En-tête Content-Type: application/json obligatoire.',
    };
  }

  const originHeader = request.headers.get('Origin');
  if (!originHeader) {
    return {
      ok: false,
      error: 'En-tête Origin manquant (protection CSRF).',
    };
  }

  try {
    const reqUrl = new URL(request.url);
    const originUrl = new URL(originHeader);
    if (originUrl.host !== reqUrl.host) {
      return {
        ok: false,
        error: 'Origine non autorisée (protection CSRF).',
      };
    }
  } catch {
    return {
      ok: false,
      error: 'En-tête Origin invalide.',
    };
  }

  return { ok: true };
}

export interface BruteForceStatus {
  blocked: boolean;
  retryAfterSec: number;
  remainingAttempts: number;
}

/**
 * Vérifie dans la table D1 `login_attempts` si la clé (IP hachée ou identifiant haché) est actuellement bloquée.
 */
export async function checkLoginBruteForce(
  db: D1Database | null,
  keyHash: string,
  nowMs = Date.now()
): Promise<BruteForceStatus> {
  if (!db) {
    return {
      blocked: false,
      retryAfterSec: 0,
      remainingAttempts: MAX_LOGIN_ATTEMPTS,
    };
  }

  try {
    const row = await db
      .prepare(
        'SELECT ip_hash, count, window_start_ts, blocked_until_ts FROM login_attempts WHERE ip_hash = ?'
      )
      .bind(keyHash)
      .first<{
        ip_hash: string;
        count: number;
        window_start_ts: number;
        blocked_until_ts: number | null;
      }>();

    if (!row) {
      return {
        blocked: false,
        retryAfterSec: 0,
        remainingAttempts: MAX_LOGIN_ATTEMPTS,
      };
    }

    if (row.blocked_until_ts && Number(row.blocked_until_ts) > nowMs) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((Number(row.blocked_until_ts) - nowMs) / 1000)
      );
      return {
        blocked: true,
        retryAfterSec,
        remainingAttempts: 0,
      };
    }

    // Si la fenêtre de 15 minutes ou le blocage est expiré, on repart à zéro
    if (nowMs - Number(row.window_start_ts) > BRUTE_FORCE_WINDOW_MS) {
      return {
        blocked: false,
        retryAfterSec: 0,
        remainingAttempts: MAX_LOGIN_ATTEMPTS,
      };
    }

    const used = Number(row.count) || 0;
    return {
      blocked: false,
      retryAfterSec: 0,
      remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - used),
    };
  } catch {
    return {
      blocked: false,
      retryAfterSec: 0,
      remainingAttempts: MAX_LOGIN_ATTEMPTS,
    };
  }
}

/**
 * Enregistre un échec de connexion dans `login_attempts` et active le blocage de 15 min au 5e échec.
 */
export async function recordFailedLoginAttempt(
  env: AdminEnv,
  keyHash: string,
  nowMs = Date.now()
): Promise<BruteForceStatus> {
  const db = getDb(env);
  if (!db) {
    return {
      blocked: false,
      retryAfterSec: 0,
      remainingAttempts: MAX_LOGIN_ATTEMPTS - 1,
    };
  }

  try {
    const existing = await db
      .prepare(
        'SELECT ip_hash, count, window_start_ts, blocked_until_ts FROM login_attempts WHERE ip_hash = ?'
      )
      .bind(keyHash)
      .first<{
        ip_hash: string;
        count: number;
        window_start_ts: number;
        blocked_until_ts: number | null;
      }>();

    let nextCount = 1;
    let windowStart = nowMs;

    if (
      existing &&
      nowMs - Number(existing.window_start_ts) <= BRUTE_FORCE_WINDOW_MS &&
      (!existing.blocked_until_ts || Number(existing.blocked_until_ts) <= nowMs)
    ) {
      nextCount = (Number(existing.count) || 0) + 1;
      windowStart = Number(existing.window_start_ts);
    }

    const blockedUntil =
      nextCount >= MAX_LOGIN_ATTEMPTS ? nowMs + LOCKOUT_DURATION_MS : null;

    await db
      .prepare(
        `INSERT INTO login_attempts (ip_hash, count, window_start_ts, blocked_until_ts)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(ip_hash) DO UPDATE SET
           count = excluded.count,
           window_start_ts = excluded.window_start_ts,
           blocked_until_ts = excluded.blocked_until_ts`
      )
      .bind(keyHash, nextCount, windowStart, blockedUntil)
      .run();

    if (blockedUntil) {
      return {
        blocked: true,
        retryAfterSec: Math.ceil(LOCKOUT_DURATION_MS / 1000),
        remainingAttempts: 0,
      };
    }

    return {
      blocked: false,
      retryAfterSec: 0,
      remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - nextCount),
    };
  } catch {
    return {
      blocked: false,
      retryAfterSec: 0,
      remainingAttempts: MAX_LOGIN_ATTEMPTS - 1,
    };
  }
}

/**
 * Réinitialise le compteur d'échecs après une connexion réussie.
 */
export async function clearLoginAttempts(
  env: AdminEnv,
  keyHash: string
): Promise<void> {
  const db = getDb(env);
  if (!db) return;
  try {
    await db
      .prepare('DELETE FROM login_attempts WHERE ip_hash = ?')
      .bind(keyHash)
      .run();
  } catch {
    // Ignorer si D1 est indisponible
  }
}
