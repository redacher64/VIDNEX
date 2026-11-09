/**
 * Gestionnaire Cloudflare D1 (`env.DB`) et utilitaires de confidentialité (Hachage IP SHA-256).
 * Inclut un adaptateur D1 SQL en mémoire pour le développement local / tests lorsque le binding
 * Cloudflare D1 n'est pas attaché, tout en permettant de simuler une panne D1 (`DB_DISABLED`).
 */

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta?: Record<string, unknown>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

export interface AdminEnv {
  DB?: D1Database | null;
  DB_DISABLED?: string;
  ADMIN_PASSWORD?: string;
  SESSION_SECRET?: string;
  IP_HASH_SALT?: string;
  IG_SESSION_ID?: string;
  IG_CSRF_TOKEN?: string;
  IG_COOKIES?: string;
  TIKWM_API_KEY?: string;
  TT_COOKIE?: string;
  [key: string]: unknown;
}

export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

/**
 * Extrait l'adresse IP brute de la requête avant hachage irréversible.
 */
export function getRawClientIp(request: Request): string {
  const cfIp = request.headers.get('CF-Connecting-IP');
  if (cfIp && cfIp.trim()) return cfIp.trim();

  const xff = request.headers.get('X-Forwarded-For');
  if (xff && xff.trim()) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }

  return '127.0.0.1';
}

/**
 * Hache une adresse IP avec SHA-256 et le sel secret `IP_HASH_SALT` via Web Crypto API.
 * Aucune adresse IP en clair n'est jamais stockée dans Cloudflare D1.
 */
export async function hashIpAddress(
  rawIp: string,
  salt = 'vidnex-default-privacy-salt'
): Promise<string> {
  const normalizedIp = (rawIp || '127.0.0.1').trim().toLowerCase();
  const input = `${salt}:${normalizedIp}`;
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

const bootstrappedDbs = new WeakSet<object>();

const D1_BOOTSTRAP_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `INSERT OR IGNORE INTO settings (key, value) VALUES ('maintenance', 'false'), ('platform_tiktok', 'true'), ('platform_instagram', 'true'), ('rate_limit_per_min', '30'), ('ads_enabled', 'true'), ('test_url_tiktok', ''), ('test_url_instagram', '')`,
  `CREATE TABLE IF NOT EXISTS request_log (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, platform TEXT NOT NULL, status TEXT NOT NULL, error_code TEXT, duration_ms INTEGER NOT NULL, ip_hash TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_request_log_ts ON request_log(ts)`,
  `CREATE TABLE IF NOT EXISTS engine_status (platform TEXT PRIMARY KEY, last_success_ts INTEGER, last_test_ts INTEGER, last_test_ok INTEGER, last_error_code TEXT)`,
  `INSERT OR IGNORE INTO engine_status (platform, last_success_ts, last_test_ts, last_test_ok, last_error_code) VALUES ('tiktok', NULL, NULL, NULL, NULL), ('instagram', NULL, NULL, NULL, NULL)`,
  `CREATE TABLE IF NOT EXISTS blocklist (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, value TEXT NOT NULL, created_ts INTEGER NOT NULL, UNIQUE(type, value))`,
  `CREATE TABLE IF NOT EXISTS rate_limits (ip_hash TEXT NOT NULL, window INTEGER NOT NULL, count INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (ip_hash, window))`,
  `CREATE TABLE IF NOT EXISTS login_attempts (ip_hash TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, window_start_ts INTEGER NOT NULL, blocked_until_ts INTEGER)`,
];

async function ensureSchemaOnError(rawDb: D1Database, err: unknown): Promise<boolean> {
  const msg = err instanceof Error ? err.message : String(err || '');
  if (!msg.toLowerCase().includes('no such table')) {
    return false;
  }
  if (bootstrappedDbs.has(rawDb)) {
    return false;
  }
  try {
    await rawDb.batch(D1_BOOTSTRAP_STATEMENTS.map((sql) => rawDb.prepare(sql)));
    bootstrappedDbs.add(rawDb);
    return true;
  } catch {
    return false;
  }
}

function wrapAutoBootstrapD1(rawDb: D1Database): D1Database {
  const wrapStmt = (sql: string, boundValues: unknown[] = []): D1PreparedStatement => {
    const createInner = () => {
      const stmt = rawDb.prepare(sql);
      return boundValues.length > 0 ? stmt.bind(...boundValues) : stmt;
    };
    return {
      bind(...values: unknown[]) {
        return wrapStmt(sql, values);
      },
      async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
        try {
          return await createInner().first<T>(colName);
        } catch (err) {
          if (await ensureSchemaOnError(rawDb, err)) {
            return await createInner().first<T>(colName);
          }
          throw err;
        }
      },
      async run(): Promise<D1Result> {
        try {
          return await createInner().run();
        } catch (err) {
          if (await ensureSchemaOnError(rawDb, err)) {
            return await createInner().run();
          }
          throw err;
        }
      },
      async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
        try {
          return await createInner().all<T>();
        } catch (err) {
          if (await ensureSchemaOnError(rawDb, err)) {
            return await createInner().all<T>();
          }
          throw err;
        }
      },
    };
  };

  return {
    prepare(query: string) {
      return wrapStmt(query, []);
    },
    batch<T = unknown>(statements: D1PreparedStatement[]) {
      return rawDb.batch<T>(statements);
    },
    exec(query: string) {
      return rawDb.exec(query);
    },
  };
}

/**
 * Retourne le binding D1 `env.DB` s'il est disponible et actif, ou `null` si D1 est coupé.
 */
export function getDb(env?: AdminEnv): D1Database | null {
  if (!env || env.DB_DISABLED === 'true' || env.DB === null) {
    return null;
  }
  if (env.DB && typeof env.DB.prepare === 'function') {
    return wrapAutoBootstrapD1(env.DB);
  }
  return null;
}

/**
 * Crée une base de données compatible Cloudflare D1 en mémoire (utilisée pour le serveur
 * de dev local Vite et les tests automatisés d'intégration).
 */
export function createMemoryD1Database(): D1Database {
  const settings = new Map<string, string>([
    ['maintenance', 'false'],
    ['platform_tiktok', 'true'],
    ['platform_instagram', 'true'],
    ['rate_limit_per_min', '30'],
    ['ads_enabled', 'true'],
    ['test_url_tiktok', ''],
    ['test_url_instagram', ''],
  ]);

  interface RequestLogRow {
    id: number;
    ts: number;
    platform: string;
    status: string;
    error_code: string | null;
    duration_ms: number;
    ip_hash: string;
  }

  interface EngineStatusRow {
    platform: string;
    last_success_ts: number | null;
    last_test_ts: number | null;
    last_test_ok: number | null;
    last_error_code: string | null;
  }

  interface BlocklistRow {
    id: number;
    type: 'ip_hash' | 'domain' | 'url';
    value: string;
    created_ts: number;
  }

  interface LoginAttemptRow {
    ip_hash: string;
    count: number;
    window_start_ts: number;
    blocked_until_ts: number | null;
  }

  let logSeq = 1;
  let blockSeq = 1;
  let requestLogs: RequestLogRow[] = [];
  const engineStatus = new Map<string, EngineStatusRow>([
    [
      'tiktok',
      {
        platform: 'tiktok',
        last_success_ts: null,
        last_test_ts: null,
        last_test_ok: null,
        last_error_code: null,
      },
    ],
    [
      'instagram',
      {
        platform: 'instagram',
        last_success_ts: null,
        last_test_ts: null,
        last_test_ok: null,
        last_error_code: null,
      },
    ],
  ]);
  let blocklist: BlocklistRow[] = [];
  const rateLimits = new Map<string, { ip_hash: string; window: number; count: number }>();
  const loginAttempts = new Map<string, LoginAttemptRow>();

  function buildStatement(sql: string, boundValues: unknown[] = []): D1PreparedStatement {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    const lower = normalized.toLowerCase();

    const execute = async (): Promise<unknown[]> => {
      // 1. SETTINGS
      if (lower.startsWith('select key, value from settings')) {
        return Array.from(settings.entries()).map(([key, value]) => ({ key, value }));
      }
      if (lower.startsWith('select value from settings where key =')) {
        const k = String(boundValues[0] || '');
        const val = settings.get(k);
        return val !== undefined ? [{ value: val }] : [];
      }
      if (lower.startsWith('insert into settings') || lower.startsWith('insert or replace into settings')) {
        const k = String(boundValues[0] || '');
        const v = String(boundValues[1] ?? '');
        settings.set(k, v);
        return [];
      }

      // 2. LOGIN_ATTEMPTS
      if (lower.startsWith('select ip_hash, count, window_start_ts, blocked_until_ts from login_attempts')) {
        const ipHash = String(boundValues[0] || '');
        const row = loginAttempts.get(ipHash);
        return row ? [{ ...row }] : [];
      }
      if (lower.startsWith('insert into login_attempts')) {
        const ipHash = String(boundValues[0] || '');
        const count = Number(boundValues[1] ?? 1);
        const windowStart = Number(boundValues[2] ?? Date.now());
        const blockedUntil =
          boundValues[3] !== null && boundValues[3] !== undefined
            ? Number(boundValues[3])
            : null;
        loginAttempts.set(ipHash, {
          ip_hash: ipHash,
          count,
          window_start_ts: windowStart,
          blocked_until_ts: blockedUntil,
        });
        return [];
      }
      if (lower.startsWith('delete from login_attempts where ip_hash =')) {
        const ipHash = String(boundValues[0] || '');
        loginAttempts.delete(ipHash);
        return [];
      }

      // 3. BLOCKLIST
      if (lower.startsWith('select id, type, value, created_ts from blocklist')) {
        return [...blocklist].sort((a, b) => b.created_ts - a.created_ts);
      }
      if (lower.startsWith('insert into blocklist') || lower.startsWith('insert or ignore into blocklist')) {
        const type = String(boundValues[0] || 'domain') as 'ip_hash' | 'domain' | 'url';
        const value = String(boundValues[1] || '').trim().toLowerCase();
        const created_ts = Number(boundValues[2] || Date.now());
        if (!blocklist.some((b) => b.type === type && b.value === value)) {
          blocklist.push({ id: blockSeq++, type, value, created_ts });
        }
        return [];
      }
      if (lower.startsWith('delete from blocklist where id =')) {
        const id = Number(boundValues[0]);
        blocklist = blocklist.filter((b) => b.id !== id);
        return [];
      }

      // 4. RATE_LIMITS
      if (lower.includes('into rate_limits')) {
        const ipHash = String(boundValues[0] || '');
        const win = Number(boundValues[1] || 0);
        const key = `${ipHash}:${win}`;
        const existing = rateLimits.get(key);
        const nextCount = existing ? existing.count + 1 : 1;
        rateLimits.set(key, { ip_hash: ipHash, window: win, count: nextCount });
        return [{ count: nextCount }];
      }
      if (lower.startsWith('select count from rate_limits where ip_hash =')) {
        const ipHash = String(boundValues[0] || '');
        const win = Number(boundValues[1] || 0);
        const existing = rateLimits.get(`${ipHash}:${win}`);
        return existing ? [{ count: existing.count }] : [];
      }
      if (lower.startsWith('delete from rate_limits where window <')) {
        const minWin = Number(boundValues[0] || 0);
        for (const [k, v] of rateLimits.entries()) {
          if (v.window < minWin) rateLimits.delete(k);
        }
        return [];
      }

      // 5. ENGINE_STATUS
      if (lower.startsWith('select platform, last_success_ts, last_test_ts, last_test_ok, last_error_code from engine_status')) {
        return Array.from(engineStatus.values());
      }
      if (lower.startsWith('insert into engine_status')) {
        const platform = String(boundValues[0] || '');
        const current = engineStatus.get(platform) || {
          platform,
          last_success_ts: null,
          last_test_ts: null,
          last_test_ok: null,
          last_error_code: null,
        };
        if (lower.includes('last_test_ts')) {
          const successTs = boundValues[1] ? Number(boundValues[1]) : current.last_success_ts;
          const testTs = Number(boundValues[2] || Date.now());
          const ok = Number(boundValues[3] ?? 0);
          const errCode = boundValues[4] ? String(boundValues[4]) : null;
          engineStatus.set(platform, {
            platform,
            last_success_ts: ok === 1 ? successTs || testTs : current.last_success_ts,
            last_test_ts: testTs,
            last_test_ok: ok,
            last_error_code: ok === 1 ? null : errCode,
          });
        } else {
          const successTs = boundValues[1] ? Number(boundValues[1]) : current.last_success_ts;
          const errCode = boundValues[2] ? String(boundValues[2]) : null;
          engineStatus.set(platform, {
            ...current,
            last_success_ts: successTs,
            last_error_code: errCode,
          });
        }
        return [];
      }

      // 6. REQUEST_LOG
      if (lower.startsWith('insert into request_log')) {
        const ts = Number(boundValues[0] || Date.now());
        const platform = String(boundValues[1] || 'unknown');
        const status = String(boundValues[2] || 'error');
        const error_code = boundValues[3] ? String(boundValues[3]) : null;
        const duration_ms = Number(boundValues[4] || 0);
        const ip_hash = String(boundValues[5] || '');
        requestLogs.push({
          id: logSeq++,
          ts,
          platform,
          status,
          error_code,
          duration_ms,
          ip_hash,
        });
        return [];
      }
      if (lower.startsWith('delete from request_log where ts <')) {
        const cutoff = Number(boundValues[0] || 0);
        requestLogs = requestLogs.filter((r) => r.ts >= cutoff);
        return [];
      }
      if (lower.startsWith('select count(*) as total from request_log')) {
        if (lower.includes('where ts >=')) {
          const since = Number(boundValues[0] || 0);
          return [{ total: requestLogs.filter((r) => r.ts >= since).length }];
        }
        return [{ total: requestLogs.length }];
      }
      if (lower.startsWith('select id, ts, platform, status, error_code, duration_ms, ip_hash from request_log')) {
        const limit = Number(boundValues[0] || 25);
        const offset = Number(boundValues[1] || 0);
        const sorted = [...requestLogs].sort((a, b) => b.ts - a.ts || b.id - a.id);
        return sorted.slice(offset, offset + limit);
      }
      if (lower.startsWith('select ts, platform, status, error_code, duration_ms from request_log where ts >=')) {
        const since = Number(boundValues[0] || 0);
        return requestLogs
          .filter((r) => r.ts >= since)
          .sort((a, b) => a.ts - b.ts);
      }

      return [];
    };

    return {
      bind(...values: unknown[]) {
        return buildStatement(sql, values);
      },
      async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
        const rows = await execute();
        if (!rows.length) return null;
        const firstRow = rows[0] as Record<string, unknown>;
        if (colName) {
          return (firstRow[colName] as T) ?? null;
        }
        return firstRow as T;
      },
      async run(): Promise<D1Result> {
        await execute();
        return { results: [], success: true };
      },
      async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
        const rows = (await execute()) as T[];
        return { results: rows, success: true };
      },
    };
  }

  return {
    prepare(query: string) {
      return buildStatement(query, []);
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const out: D1Result<T>[] = [];
      for (const stmt of statements) {
        out.push((await stmt.all()) as D1Result<T>);
      }
      return out;
    },
    async exec(): Promise<{ count: number; duration: number }> {
      return { count: 1, duration: 0 };
    },
  };
}
