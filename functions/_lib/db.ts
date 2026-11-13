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
  getWriteCount?: () => number;
  resetWriteCount?: () => void;
}

export interface AdminEnv {
  DB?: D1Database | null;
  DB_DISABLED?: string;
  ADMIN_PASSWORD?: string;
  ALERT_WEBHOOK_URL?: string;
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
const migratedColumnsDbs = new WeakSet<object>();
const migratedEngineColumnsDbs = new WeakSet<object>();

const D1_BOOTSTRAP_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `INSERT OR IGNORE INTO settings (key, value) VALUES ('maintenance', 'false'), ('allow_third_party', 'true'), ('platform_tiktok', 'true'), ('platform_instagram', 'true'), ('platform_x', 'true'), ('platform_facebook', 'true'), ('platform_linkedin', 'true'), ('rate_limit_per_min', '30'), ('download_limit_per_min', '60'), ('ads_enabled', 'true'), ('test_url_tiktok', ''), ('test_url_instagram', ''), ('test_url_instagram_profile', ''), ('test_url_x', ''), ('test_url_facebook', ''), ('test_url_linkedin', '')`,
  `CREATE TABLE IF NOT EXISTS request_log (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, platform TEXT NOT NULL, status TEXT NOT NULL, error_code TEXT, duration_ms INTEGER NOT NULL, ip_hash TEXT NOT NULL, engine_stage TEXT, http_status INTEGER, content_kind TEXT, engine_fn TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_request_log_ts ON request_log(ts)`,
  `CREATE TABLE IF NOT EXISTS daily_metrics (day TEXT NOT NULL, platform TEXT NOT NULL, event TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, platform, event))`,
  `CREATE TABLE IF NOT EXISTS engine_status (platform TEXT PRIMARY KEY, last_success_ts INTEGER, last_test_ts INTEGER, last_test_ok INTEGER, last_error_code TEXT, consecutive_failures INTEGER NOT NULL DEFAULT 0, alert_sent INTEGER NOT NULL DEFAULT 0)`,
  `INSERT OR IGNORE INTO engine_status (platform, last_success_ts, last_test_ts, last_test_ok, last_error_code, consecutive_failures, alert_sent) VALUES ('tiktok', NULL, NULL, NULL, NULL, 0, 0), ('instagram', NULL, NULL, NULL, NULL, 0, 0), ('instagram_profile', NULL, NULL, NULL, NULL, 0, 0), ('x', NULL, NULL, NULL, NULL, 0, 0), ('facebook', NULL, NULL, NULL, NULL, 0, 0), ('linkedin', NULL, NULL, NULL, NULL, 0, 0)`,
  `CREATE TABLE IF NOT EXISTS blocklist (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, value TEXT NOT NULL, created_ts INTEGER NOT NULL, UNIQUE(type, value))`,
  `CREATE TABLE IF NOT EXISTS rate_limits (ip_hash TEXT NOT NULL, window INTEGER NOT NULL, count INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (ip_hash, window))`,
  `CREATE TABLE IF NOT EXISTS login_attempts (ip_hash TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, window_start_ts INTEGER NOT NULL, blocked_until_ts INTEGER)`,
  `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, login TEXT NOT NULL UNIQUE COLLATE NOCASE, display_name TEXT NOT NULL, role_label TEXT NOT NULL DEFAULT 'Membre', password_hash TEXT NOT NULL, must_change_password INTEGER NOT NULL DEFAULT 1, active INTEGER NOT NULL DEFAULT 1, permissions TEXT NOT NULL DEFAULT '[]', session_version INTEGER NOT NULL DEFAULT 1, failed_attempts INTEGER NOT NULL DEFAULT 0, locked_until INTEGER, created_at INTEGER NOT NULL, last_login_at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS idx_users_login ON users(login)`,
  `CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS blog_articles (id TEXT PRIMARY KEY, category TEXT NOT NULL, tool_route TEXT, secondary_tool_route TEXT, status TEXT NOT NULL DEFAULT 'draft', previous_status TEXT DEFAULT 'draft', trashed_at INTEGER, created_by TEXT NOT NULL, updated_by TEXT NOT NULL, published_at TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_blog_articles_status ON blog_articles(status)`,
  `CREATE TABLE IF NOT EXISTS blog_translations (id INTEGER PRIMARY KEY AUTOINCREMENT, article_id TEXT NOT NULL, locale TEXT NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', excerpt TEXT NOT NULL DEFAULT '', meta_title TEXT NOT NULL DEFAULT '', meta_description TEXT NOT NULL DEFAULT '', primary_keyword TEXT NOT NULL DEFAULT '', secondary_keywords TEXT NOT NULL DEFAULT '[]', search_intent TEXT NOT NULL DEFAULT '', reading_time_minutes INTEGER NOT NULL DEFAULT 5, quick_answer TEXT, key_takeaways TEXT NOT NULL DEFAULT '[]', introduction TEXT NOT NULL DEFAULT '[]', table_of_contents TEXT NOT NULL DEFAULT '[]', content_sections TEXT NOT NULL DEFAULT '[]', faq TEXT NOT NULL DEFAULT '[]', cta_title TEXT, cta_description TEXT, cta_button_label TEXT, internal_links TEXT NOT NULL DEFAULT '[]', sources TEXT NOT NULL DEFAULT '[]', body_markdown TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', updated_by TEXT NOT NULL DEFAULT 'admin', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(article_id, locale), UNIQUE(locale, slug))`,
  `CREATE INDEX IF NOT EXISTS idx_blog_translations_article_id ON blog_translations(article_id)`,
  `CREATE INDEX IF NOT EXISTS idx_blog_translations_locale_slug ON blog_translations(locale, slug)`,
  `CREATE TABLE IF NOT EXISTS blog_revisions (id INTEGER PRIMARY KEY AUTOINCREMENT, article_id TEXT NOT NULL, locale TEXT NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', meta_title TEXT NOT NULL DEFAULT '', meta_description TEXT NOT NULL DEFAULT '', body_markdown TEXT NOT NULL DEFAULT '', snapshot_json TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'draft', edited_by TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_blog_revisions_article_locale_created ON blog_revisions(article_id, locale, created_at DESC, id DESC)`,
  `CREATE TABLE IF NOT EXISTS blog_redirects (id INTEGER PRIMARY KEY AUTOINCREMENT, locale TEXT NOT NULL, old_slug TEXT NOT NULL, new_slug TEXT NOT NULL, article_id TEXT NOT NULL, status_code INTEGER NOT NULL DEFAULT 301, created_at INTEGER NOT NULL, UNIQUE(locale, old_slug))`,
];

async function ensureSchemaOnError(rawDb: D1Database, err: unknown): Promise<boolean> {
  const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();
  if (
    msg.includes('no such column: engine_stage') ||
    msg.includes('no such column: http_status') ||
    msg.includes('no such column: content_kind') ||
    msg.includes('no such column: engine_fn')
  ) {
    if (migratedColumnsDbs.has(rawDb)) return false;
    try {
      await rawDb.prepare('ALTER TABLE request_log ADD COLUMN engine_stage TEXT').run().catch(() => {});
      await rawDb.prepare('ALTER TABLE request_log ADD COLUMN http_status INTEGER').run().catch(() => {});
      await rawDb.prepare('ALTER TABLE request_log ADD COLUMN content_kind TEXT').run().catch(() => {});
      await rawDb.prepare('ALTER TABLE request_log ADD COLUMN engine_fn TEXT').run().catch(() => {});
      migratedColumnsDbs.add(rawDb);
      return true;
    } catch {
      return false;
    }
  }
  if (msg.includes('no such column: consecutive_failures') || msg.includes('no such column: alert_sent')) {
    if (migratedEngineColumnsDbs.has(rawDb)) return false;
    try {
      await rawDb.prepare('ALTER TABLE engine_status ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0').run().catch(() => {});
      await rawDb.prepare('ALTER TABLE engine_status ADD COLUMN alert_sent INTEGER NOT NULL DEFAULT 0').run().catch(() => {});
      migratedEngineColumnsDbs.add(rawDb);
      return true;
    } catch {
      return false;
    }
  }
  if (!msg.includes('no such table')) {
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
    getWriteCount: rawDb.getWriteCount,
    resetWriteCount: rawDb.resetWriteCount,
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
    ['allow_third_party', 'true'],
    ['platform_tiktok', 'true'],
    ['platform_instagram', 'true'],
    ['platform_x', 'true'],
    ['platform_facebook', 'true'],
    ['platform_linkedin', 'true'],
    ['rate_limit_per_min', '30'],
    ['download_limit_per_min', '60'],
    ['ads_enabled', 'true'],
    ['test_url_tiktok', ''],
    ['test_url_instagram', ''],
    ['test_url_instagram_profile', ''],
    ['test_url_x', ''],
    ['test_url_facebook', ''],
    ['test_url_linkedin', ''],
  ]);

  interface RequestLogRow {
    id: number;
    ts: number;
    platform: string;
    status: string;
    error_code: string | null;
    duration_ms: number;
    ip_hash: string;
    engine_stage: string | null;
    http_status: number | null;
    content_kind?: string | null;
    engine_fn?: string | null;
  }

  interface DailyMetricRow {
    day: string;
    platform: string;
    event: string;
    count: number;
  }

  interface EngineStatusRow {
    platform: string;
    last_success_ts: number | null;
    last_test_ts: number | null;
    last_test_ok: number | null;
    last_error_code: string | null;
    consecutive_failures: number;
    alert_sent: number;
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

  interface UserRow {
    id: number;
    login: string;
    display_name: string;
    role_label: string;
    password_hash: string;
    must_change_password: number;
    active: number;
    permissions: string;
    session_version: number;
    failed_attempts: number;
    locked_until: number | null;
    created_at: number;
    last_login_at: number | null;
  }

  interface AuditLogRow {
    id: number;
    actor: string;
    action: string;
    target: string;
    created_at: number;
  }

  interface BlogArticleRow {
    id: string;
    category: string;
    tool_route: string | null;
    secondary_tool_route: string | null;
    status: string;
    previous_status: string | null;
    trashed_at: number | null;
    created_by: string;
    updated_by: string;
    published_at: string | null;
    created_at: number;
    updated_at: number;
  }

  interface BlogTranslationRow {
    id: number;
    article_id: string;
    locale: string;
    slug: string;
    title: string;
    excerpt: string;
    meta_title: string;
    meta_description: string;
    primary_keyword: string;
    secondary_keywords: string;
    search_intent: string;
    reading_time_minutes: number;
    quick_answer: string | null;
    key_takeaways: string;
    introduction: string;
    table_of_contents: string;
    content_sections: string;
    faq: string;
    cta_title: string | null;
    cta_description: string | null;
    cta_button_label: string | null;
    internal_links: string;
    sources: string;
    body_markdown: string;
    status: string;
    updated_by: string;
    created_at: number;
    updated_at: number;
  }

  interface BlogRevisionRow {
    id: number;
    article_id: string;
    locale: string;
    slug: string;
    title: string;
    meta_title: string;
    meta_description: string;
    body_markdown: string;
    snapshot_json: string;
    status: string;
    edited_by: string;
    created_at: number;
  }

  interface BlogRedirectRow {
    id: number;
    locale: string;
    old_slug: string;
    new_slug: string;
    article_id: string;
    status_code: number;
    created_at: number;
  }

  let logSeq = 1;
  let blockSeq = 1;
  let userSeq = 1;
  let auditSeq = 1;
  let blogTrSeq = 1;
  let blogRevSeq = 1;
  let blogRedirSeq = 1;
  let writeCount = 0;
  let requestLogs: RequestLogRow[] = [];
  const dailyMetrics = new Map<string, DailyMetricRow>();
  const engineStatus = new Map<string, EngineStatusRow>([
    [
      'tiktok',
      {
        platform: 'tiktok',
        last_success_ts: null,
        last_test_ts: null,
        last_test_ok: null,
        last_error_code: null,
        consecutive_failures: 0,
        alert_sent: 0,
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
        consecutive_failures: 0,
        alert_sent: 0,
      },
    ],
    [
      'instagram_profile',
      {
        platform: 'instagram_profile',
        last_success_ts: null,
        last_test_ts: null,
        last_test_ok: null,
        last_error_code: null,
        consecutive_failures: 0,
        alert_sent: 0,
      },
    ],
    [
      'x',
      {
        platform: 'x',
        last_success_ts: null,
        last_test_ts: null,
        last_test_ok: null,
        last_error_code: null,
        consecutive_failures: 0,
        alert_sent: 0,
      },
    ],
    [
      'facebook',
      {
        platform: 'facebook',
        last_success_ts: null,
        last_test_ts: null,
        last_test_ok: null,
        last_error_code: null,
        consecutive_failures: 0,
        alert_sent: 0,
      },
    ],
    [
      'linkedin',
      {
        platform: 'linkedin',
        last_success_ts: null,
        last_test_ts: null,
        last_test_ok: null,
        last_error_code: null,
        consecutive_failures: 0,
        alert_sent: 0,
      },
    ],
  ]);
  let blocklist: BlocklistRow[] = [];
  const rateLimits = new Map<string, { ip_hash: string; window: number; count: number }>();
  const loginAttempts = new Map<string, LoginAttemptRow>();
  let users: UserRow[] = [];
  let auditLogs: AuditLogRow[] = [];
  let blogArticles: BlogArticleRow[] = [];
  let blogTranslations: BlogTranslationRow[] = [];
  let blogRevisions: BlogRevisionRow[] = [];
  let blogRedirects: BlogRedirectRow[] = [];

  function buildStatement(sql: string, boundValues: unknown[] = []): D1PreparedStatement {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    const lower = normalized.toLowerCase();

    const execute = async (): Promise<unknown[]> => {
      if (
        lower.startsWith('insert ') ||
        lower.startsWith('update ') ||
        lower.startsWith('delete ')
      ) {
        writeCount += 1;
      }

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

      // 5. DAILY_METRICS
      if (lower.startsWith('insert into daily_metrics')) {
        for (let i = 0; i + 3 < boundValues.length; i += 4) {
          const day = String(boundValues[i] || '');
          const platform = String(boundValues[i + 1] || '');
          const event = String(boundValues[i + 2] || '');
          const delta = Number(boundValues[i + 3] ?? 1);
          const key = `${day}:${platform}:${event}`;
          const existing = dailyMetrics.get(key);
          dailyMetrics.set(key, {
            day,
            platform,
            event,
            count: (existing?.count ?? 0) + delta,
          });
        }
        return [];
      }
      if (lower.startsWith('select day, platform, event, count from daily_metrics')) {
        const rows = Array.from(dailyMetrics.values());
        if (lower.includes('where day >=')) {
          const minDay = String(boundValues[0] || '');
          return rows
            .filter((r) => r.day >= minDay)
            .sort((a, b) => a.day.localeCompare(b.day));
        }
        return rows.sort((a, b) => a.day.localeCompare(b.day));
      }
      if (lower.startsWith('delete from daily_metrics where day <')) {
        const cutoffDay = String(boundValues[0] || '');
        for (const [k, v] of dailyMetrics.entries()) {
          if (v.day < cutoffDay) dailyMetrics.delete(k);
        }
        return [];
      }

      // 6. ENGINE_STATUS
      if (lower.startsWith('select') && lower.includes('from engine_status')) {
        if (lower.includes('where platform =')) {
          const platform = String(boundValues[0] || '');
          const row = engineStatus.get(platform);
          return row ? [{ ...row }] : [];
        }
        return Array.from(engineStatus.values()).map((r) => ({ ...r }));
      }
      if (lower.startsWith('insert into engine_status')) {
        const platform = String(boundValues[0] || '');
        const current = engineStatus.get(platform) || {
          platform,
          last_success_ts: null,
          last_test_ts: null,
          last_test_ok: null,
          last_error_code: null,
          consecutive_failures: 0,
          alert_sent: 0,
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
            consecutive_failures: ok === 1 ? 0 : current.consecutive_failures,
            alert_sent: ok === 1 ? 0 : current.alert_sent,
          });
        } else if (lower.includes('consecutive_failures')) {
          const successTs = boundValues[1] ? Number(boundValues[1]) : current.last_success_ts;
          const errCode = boundValues[2] ? String(boundValues[2]) : null;
          const consecutiveFailures =
            boundValues[3] !== undefined && boundValues[3] !== null
              ? Number(boundValues[3])
              : current.consecutive_failures;
          const alertSent =
            boundValues[4] !== undefined && boundValues[4] !== null
              ? Number(boundValues[4])
              : current.alert_sent;
          engineStatus.set(platform, {
            ...current,
            last_success_ts: successTs,
            last_error_code: errCode,
            consecutive_failures: consecutiveFailures,
            alert_sent: alertSent,
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

      // 7. REQUEST_LOG
      if (lower.startsWith('insert into request_log')) {
        const ts = Number(boundValues[0] || Date.now());
        const platform = String(boundValues[1] || 'unknown');
        const status = String(boundValues[2] || 'error');
        const error_code = boundValues[3] ? String(boundValues[3]) : null;
        const duration_ms = Number(boundValues[4] || 0);
        const ip_hash = String(boundValues[5] || '');
        const engine_stage =
          boundValues[6] !== undefined && boundValues[6] !== null
            ? String(boundValues[6])
            : null;
        const http_status =
          boundValues[7] !== undefined && boundValues[7] !== null
            ? Number(boundValues[7])
            : null;
        const content_kind =
          boundValues[8] !== undefined && boundValues[8] !== null
            ? String(boundValues[8])
            : null;
        const engine_fn =
          boundValues[9] !== undefined && boundValues[9] !== null
            ? String(boundValues[9])
            : null;
        requestLogs.push({
          id: logSeq++,
          ts,
          platform,
          status,
          error_code,
          duration_ms,
          ip_hash,
          engine_stage,
          http_status,
          content_kind,
          engine_fn,
        });
        return [];
      }
      if (lower.startsWith('delete from request_log where ts <')) {
        const cutoff = Number(boundValues[0] || 0);
        requestLogs = requestLogs.filter((r) => r.ts >= cutoff);
        return [];
      }
      const filterRequestLogs = (bound: unknown[], hasLimitOffset: boolean): RequestLogRow[] => {
        const filterArgs = hasLimitOffset ? bound.slice(0, -2) : bound;
        let idx = 0;
        let filtered = [...requestLogs];
        if (lower.includes('where ts >=')) {
          const since = Number(filterArgs[idx++] || 0);
          filtered = filtered.filter((r) => r.ts >= since);
        }
        if (lower.includes('platform in (?, ?)')) {
          const p1 = String(filterArgs[idx++] || '').toLowerCase();
          const p2 = String(filterArgs[idx++] || '').toLowerCase();
          filtered = filtered.filter(
            (r) => r.platform.toLowerCase() === p1 || r.platform.toLowerCase() === p2
          );
        } else if (lower.includes('platform = ?')) {
          const p = String(filterArgs[idx++] || '').toLowerCase();
          filtered = filtered.filter((r) => r.platform.toLowerCase() === p);
        }
        if (lower.includes('error_code = ?')) {
          const ec = String(filterArgs[idx++] || '').toUpperCase();
          filtered = filtered.filter((r) => (r.error_code || '').toUpperCase() === ec);
        }
        return filtered;
      };
      if (lower.startsWith('select count(*) as total from request_log')) {
        const filtered = filterRequestLogs(boundValues, false);
        return [{ total: filtered.length }];
      }
      if (
        lower.startsWith('select id, ts, platform, status, error_code, duration_ms, ip_hash from request_log') ||
        lower.startsWith('select id, ts, platform, status, error_code, duration_ms, ip_hash, engine_stage, http_status from request_log') ||
        lower.startsWith('select id, ts, platform, status, error_code, duration_ms, ip_hash, engine_stage, http_status, content_kind, engine_fn from request_log')
      ) {
        const limit = Number(boundValues[boundValues.length - 2] || 25);
        const offset = Number(boundValues[boundValues.length - 1] || 0);
        const filtered = filterRequestLogs(boundValues, true);
        const sorted = filtered.sort((a, b) => b.ts - a.ts || b.id - a.id);
        return sorted.slice(offset, offset + limit);
      }
      if (lower.startsWith('select ts, platform, status, error_code, duration_ms from request_log where ts >=')) {
        const since = Number(boundValues[0] || 0);
        return requestLogs
          .filter((r) => r.ts >= since)
          .sort((a, b) => a.ts - b.ts);
      }

      // 8. USERS
      if (lower.includes('from users')) {
        if (lower.startsWith('select') && lower.includes('where login =')) {
          const targetLogin = String(boundValues[0] || '').trim().toLowerCase();
          const found = users.find((u) => u.login.toLowerCase() === targetLogin);
          return found ? [{ ...found }] : [];
        }
        if (lower.startsWith('select') && lower.includes('where id =')) {
          const targetId = Number(boundValues[0]);
          const found = users.find((u) => u.id === targetId);
          return found ? [{ ...found }] : [];
        }
        if (lower.startsWith('select')) {
          const includeHash = lower.includes('password_hash');
          return [...users]
            .sort((a, b) => b.created_at - a.created_at || b.id - a.id)
            .map((u) => {
              if (includeHash) return { ...u };
              const { password_hash: _unused, ...safeUser } = u;
              return safeUser;
            });
        }
      }
      if (lower.startsWith('insert into users')) {
        const login = String(boundValues[0] || '').trim();
        const display_name = String(boundValues[1] || '').trim();
        const role_label = String(boundValues[2] || 'Membre').trim();
        const password_hash = String(boundValues[3] || '');
        const must_change_password = Number(boundValues[4] ?? 1);
        const active = Number(boundValues[5] ?? 1);
        const permissions = String(boundValues[6] || '[]');
        const created_at = Number(boundValues[7] || Date.now());

        if (users.some((u) => u.login.toLowerCase() === login.toLowerCase())) {
          throw new Error('UNIQUE constraint failed: users.login');
        }

        const newRow: UserRow = {
          id: userSeq++,
          login,
          display_name,
          role_label,
          password_hash,
          must_change_password,
          active,
          permissions,
          session_version: 1,
          failed_attempts: 0,
          locked_until: null,
          created_at,
          last_login_at: null,
        };
        users.push(newRow);
        return [{ id: newRow.id }];
      }
      if (lower.startsWith('update users set')) {
        const targetId = Number(boundValues[boundValues.length - 1]);
        const idx = users.findIndex((u) => u.id === targetId);
        if (idx === -1) return [];
        const current = { ...users[idx] };

        if (lower.includes('set failed_attempts = 0, locked_until = null, last_login_at =')) {
          current.failed_attempts = 0;
          current.locked_until = null;
          current.last_login_at = Number(boundValues[0] || Date.now());
        } else if (lower.includes('set failed_attempts = ?, locked_until = ?')) {
          current.failed_attempts = Number(boundValues[0] || 0);
          current.locked_until =
            boundValues[1] !== null && boundValues[1] !== undefined
              ? Number(boundValues[1])
              : null;
        } else if (lower.includes('set display_name = ?, role_label = ?, permissions = ?')) {
          current.display_name = String(boundValues[0] || current.display_name);
          current.role_label = String(boundValues[1] || current.role_label);
          current.permissions = String(boundValues[2] || '[]');
          if (lower.includes('session_version = session_version + 1')) {
            current.session_version += 1;
          }
        } else if (lower.includes('set permissions = ?')) {
          current.permissions = String(boundValues[0] || '[]');
          if (lower.includes('session_version = session_version + 1')) {
            current.session_version += 1;
          }
        } else if (lower.includes('set password_hash = ?, must_change_password = ?')) {
          current.password_hash = String(boundValues[0] || current.password_hash);
          current.must_change_password = Number(boundValues[1] ?? 0);
          if (lower.includes('session_version = session_version + 1')) {
            current.session_version += 1;
          }
          current.failed_attempts = 0;
          current.locked_until = null;
        } else if (lower.includes('set active = ?')) {
          current.active = Number(boundValues[0] ?? 1);
          if (lower.includes('session_version = session_version + 1')) {
            current.session_version += 1;
          }
        }

        users[idx] = current;
        return [];
      }
      if (lower.startsWith('delete from users where id =')) {
        const targetId = Number(boundValues[0]);
        users = users.filter((u) => u.id !== targetId);
        return [];
      }

      // 9. AUDIT_LOG
      if (lower.startsWith('insert into audit_log')) {
        const actor = String(boundValues[0] || '');
        const action = String(boundValues[1] || '');
        const target = String(boundValues[2] || '');
        const created_at = Number(boundValues[3] || Date.now());
        auditLogs.push({
          id: auditSeq++,
          actor,
          action,
          target,
          created_at,
        });
        return [];
      }
      if (lower.startsWith('select') && lower.includes('from audit_log')) {
        const limit = boundValues.length > 0 ? Number(boundValues[0] || 100) : 100;
        return [...auditLogs]
          .sort((a, b) => b.created_at - a.created_at || b.id - a.id)
          .slice(0, limit);
      }

      // 10. BLOG_ARTICLES
      if (lower.startsWith('delete from blog_articles where status =')) {
        const cutoff = Number(boundValues[0] || 0);
        const expiredIds = new Set(
          blogArticles
            .filter(
              (a) =>
                a.status === 'trashed' &&
                a.trashed_at !== null &&
                a.trashed_at < cutoff
            )
            .map((a) => a.id)
        );
        if (expiredIds.size > 0) {
          blogArticles = blogArticles.filter((a) => !expiredIds.has(a.id));
          blogTranslations = blogTranslations.filter(
            (t) => !expiredIds.has(t.article_id)
          );
          blogRevisions = blogRevisions.filter(
            (r) => !expiredIds.has(r.article_id)
          );
        }
        return [];
      }
      if (lower.startsWith('select') && lower.includes('from blog_articles')) {
        if (lower.includes('where id =')) {
          const id = String(boundValues[0] || '');
          const found = blogArticles.find((a) => a.id === id);
          return found ? [{ ...found }] : [];
        }
        return [...blogArticles].sort((a, b) => b.updated_at - a.updated_at);
      }
      if (lower.startsWith('insert into blog_articles')) {
        const id = String(boundValues[0] || '');
        if (blogArticles.some((a) => a.id === id)) {
          throw new Error('UNIQUE constraint failed: blog_articles.id');
        }
        const row: BlogArticleRow = {
          id,
          category: String(boundValues[1] || 'tutorials'),
          tool_route: boundValues[2] != null ? String(boundValues[2]) : null,
          secondary_tool_route:
            boundValues[3] != null ? String(boundValues[3]) : null,
          status: String(boundValues[4] || 'draft'),
          previous_status:
            boundValues[5] != null ? String(boundValues[5]) : 'draft',
          trashed_at: boundValues[6] != null ? Number(boundValues[6]) : null,
          created_by: String(boundValues[7] || 'admin'),
          updated_by: String(boundValues[8] || 'admin'),
          published_at: boundValues[9] != null ? String(boundValues[9]) : null,
          created_at: Number(boundValues[10] || Date.now()),
          updated_at: Number(boundValues[11] || Date.now()),
        };
        blogArticles.push(row);
        return [{ ...row }];
      }
      if (lower.startsWith('update blog_articles set')) {
        const id = String(boundValues[boundValues.length - 1] || '');
        const idx = blogArticles.findIndex((a) => a.id === id);
        if (idx === -1) return [];
        const current = { ...blogArticles[idx] };
        if (lower.includes('set category = ?')) {
          current.category = String(boundValues[0] || current.category);
          current.tool_route =
            boundValues[1] != null ? String(boundValues[1]) : null;
          current.secondary_tool_route =
            boundValues[2] != null ? String(boundValues[2]) : null;
          current.status = String(boundValues[3] || current.status);
          current.previous_status =
            boundValues[4] != null ? String(boundValues[4]) : current.previous_status;
          current.trashed_at =
            boundValues[5] != null ? Number(boundValues[5]) : null;
          current.updated_by = String(boundValues[6] || current.updated_by);
          current.published_at =
            boundValues[7] != null ? String(boundValues[7]) : null;
          current.updated_at = Number(boundValues[8] || Date.now());
        } else if (lower.includes('set status = ?, previous_status = ?, trashed_at = ?, updated_by = ?, published_at = ?, updated_at = ?')) {
          current.status = String(boundValues[0] || current.status);
          current.previous_status =
            boundValues[1] != null ? String(boundValues[1]) : current.previous_status;
          current.trashed_at =
            boundValues[2] != null ? Number(boundValues[2]) : null;
          current.updated_by = String(boundValues[3] || current.updated_by);
          current.published_at =
            boundValues[4] != null ? String(boundValues[4]) : null;
          current.updated_at = Number(boundValues[5] || Date.now());
        }
        blogArticles[idx] = current;
        return [];
      }

      // 11. BLOG_TRANSLATIONS
      if (lower.startsWith('select') && lower.includes('from blog_translations')) {
        if (lower.includes('where article_id = ? and locale = ?')) {
          const artId = String(boundValues[0] || '');
          const loc = String(boundValues[1] || '');
          const found = blogTranslations.find(
            (t) => t.article_id === artId && t.locale === loc
          );
          return found ? [{ ...found }] : [];
        }
        if (lower.includes('where locale = ? and slug = ?')) {
          const loc = String(boundValues[0] || '');
          const slug = String(boundValues[1] || '').toLowerCase();
          const found = blogTranslations.find(
            (t) => t.locale === loc && t.slug.toLowerCase() === slug
          );
          return found ? [{ ...found }] : [];
        }
        if (lower.includes('where locale = ?')) {
          const loc = String(boundValues[0] || '');
          return blogTranslations
            .filter((t) => t.locale === loc)
            .map((t) => ({ ...t }));
        }
        if (lower.includes('where article_id = ?')) {
          const artId = String(boundValues[0] || '');
          return blogTranslations
            .filter((t) => t.article_id === artId)
            .sort((a, b) => a.locale.localeCompare(b.locale))
            .map((t) => ({ ...t }));
        }
        return [...blogTranslations]
          .sort((a, b) => b.updated_at - a.updated_at)
          .map((t) => ({ ...t }));
      }
      if (lower.startsWith('insert into blog_translations')) {
        const article_id = String(boundValues[0] || '');
        const locale = String(boundValues[1] || '');
        const slug = String(boundValues[2] || '');
        if (
          blogTranslations.some(
            (t) => t.article_id === article_id && t.locale === locale
          )
        ) {
          throw new Error(
            'UNIQUE constraint failed: blog_translations.article_id, blog_translations.locale'
          );
        }
        if (
          blogTranslations.some(
            (t) =>
              t.locale === locale && t.slug.toLowerCase() === slug.toLowerCase()
          )
        ) {
          throw new Error(
            'UNIQUE constraint failed: blog_translations.locale, blog_translations.slug'
          );
        }
        const row: BlogTranslationRow = {
          id: blogTrSeq++,
          article_id,
          locale,
          slug,
          title: String(boundValues[3] || ''),
          excerpt: String(boundValues[4] || ''),
          meta_title: String(boundValues[5] || ''),
          meta_description: String(boundValues[6] || ''),
          primary_keyword: String(boundValues[7] || ''),
          secondary_keywords: String(boundValues[8] || '[]'),
          search_intent: String(boundValues[9] || ''),
          reading_time_minutes: Number(boundValues[10] || 5),
          quick_answer:
            boundValues[11] != null ? String(boundValues[11]) : null,
          key_takeaways: String(boundValues[12] || '[]'),
          introduction: String(boundValues[13] || '[]'),
          table_of_contents: String(boundValues[14] || '[]'),
          content_sections: String(boundValues[15] || '[]'),
          faq: String(boundValues[16] || '[]'),
          cta_title: boundValues[17] != null ? String(boundValues[17]) : null,
          cta_description:
            boundValues[18] != null ? String(boundValues[18]) : null,
          cta_button_label:
            boundValues[19] != null ? String(boundValues[19]) : null,
          internal_links: String(boundValues[20] || '[]'),
          sources: String(boundValues[21] || '[]'),
          body_markdown: String(boundValues[22] || ''),
          status: String(boundValues[23] || 'draft'),
          updated_by: String(boundValues[24] || 'admin'),
          created_at: Number(boundValues[25] || Date.now()),
          updated_at: Number(boundValues[26] || Date.now()),
        };
        blogTranslations.push(row);
        return [{ ...row }];
      }
      if (lower.startsWith('update blog_translations set')) {
        if (lower.includes('set status = ?, updated_by = ?, updated_at = ? where article_id = ? and locale = ?')) {
          const status = String(boundValues[0] || 'draft');
          const updated_by = String(boundValues[1] || 'admin');
          const updated_at = Number(boundValues[2] || Date.now());
          const artId = String(boundValues[3] || '');
          const loc = String(boundValues[4] || '');
          blogTranslations = blogTranslations.map((t) =>
            t.article_id === artId && t.locale === loc
              ? { ...t, status, updated_by, updated_at }
              : t
          );
          return [];
        }
        if (lower.includes('set status = ?, updated_by = ?, updated_at = ? where article_id = ?')) {
          const status = String(boundValues[0] || 'draft');
          const updated_by = String(boundValues[1] || 'admin');
          const updated_at = Number(boundValues[2] || Date.now());
          const artId = String(boundValues[3] || '');
          blogTranslations = blogTranslations.map((t) =>
            t.article_id === artId ? { ...t, status, updated_by, updated_at } : t
          );
          return [];
        }
        const artId = String(boundValues[24] || '');
        const loc = String(boundValues[25] || '');
        const idx = blogTranslations.findIndex(
          (t) => t.article_id === artId && t.locale === loc
        );
        if (idx === -1) return [];
        const nextSlug = String(boundValues[0] || '');
        if (
          blogTranslations.some(
            (t, i) =>
              i !== idx &&
              t.locale === loc &&
              t.slug.toLowerCase() === nextSlug.toLowerCase()
          )
        ) {
          throw new Error(
            'UNIQUE constraint failed: blog_translations.locale, blog_translations.slug'
          );
        }
        blogTranslations[idx] = {
          ...blogTranslations[idx],
          slug: nextSlug,
          title: String(boundValues[1] || ''),
          excerpt: String(boundValues[2] || ''),
          meta_title: String(boundValues[3] || ''),
          meta_description: String(boundValues[4] || ''),
          primary_keyword: String(boundValues[5] || ''),
          secondary_keywords: String(boundValues[6] || '[]'),
          search_intent: String(boundValues[7] || ''),
          reading_time_minutes: Number(boundValues[8] || 5),
          quick_answer:
            boundValues[9] != null ? String(boundValues[9]) : null,
          key_takeaways: String(boundValues[10] || '[]'),
          introduction: String(boundValues[11] || '[]'),
          table_of_contents: String(boundValues[12] || '[]'),
          content_sections: String(boundValues[13] || '[]'),
          faq: String(boundValues[14] || '[]'),
          cta_title: boundValues[15] != null ? String(boundValues[15]) : null,
          cta_description:
            boundValues[16] != null ? String(boundValues[16]) : null,
          cta_button_label:
            boundValues[17] != null ? String(boundValues[17]) : null,
          internal_links: String(boundValues[18] || '[]'),
          sources: String(boundValues[19] || '[]'),
          body_markdown: String(boundValues[20] || ''),
          status: String(boundValues[21] || blogTranslations[idx].status),
          updated_by: String(boundValues[22] || 'admin'),
          updated_at: Number(boundValues[23] || Date.now()),
        };
        return [];
      }

      // 12. BLOG_REVISIONS (10 dernières versions par traduction)
      if (lower.startsWith('insert into blog_revisions')) {
        const row: BlogRevisionRow = {
          id: blogRevSeq++,
          article_id: String(boundValues[0] || ''),
          locale: String(boundValues[1] || ''),
          slug: String(boundValues[2] || ''),
          title: String(boundValues[3] || ''),
          meta_title: String(boundValues[4] || ''),
          meta_description: String(boundValues[5] || ''),
          body_markdown: String(boundValues[6] || ''),
          snapshot_json: String(boundValues[7] || '{}'),
          status: String(boundValues[8] || 'draft'),
          edited_by: String(boundValues[9] || 'admin'),
          created_at: Number(boundValues[10] || Date.now()),
        };
        blogRevisions.push(row);
        return [{ ...row }];
      }
      if (lower.startsWith('delete from blog_revisions where article_id = ? and locale = ?')) {
        const artId = String(boundValues[0] || '');
        const loc = String(boundValues[1] || '');
        const matching = blogRevisions
          .filter((r) => r.article_id === artId && r.locale === loc)
          .sort((a, b) => b.created_at - a.created_at || b.id - a.id);
        const keepIds = new Set(matching.slice(0, 10).map((r) => r.id));
        blogRevisions = blogRevisions.filter(
          (r) =>
            r.article_id !== artId ||
            r.locale !== loc ||
            keepIds.has(r.id)
        );
        return [];
      }
      if (lower.startsWith('select') && lower.includes('from blog_revisions')) {
        if (lower.includes('where id = ?')) {
          const revId = Number(boundValues[0]);
          const found = blogRevisions.find((r) => r.id === revId);
          return found ? [{ ...found }] : [];
        }
        if (lower.includes('where article_id = ? and locale = ?')) {
          const artId = String(boundValues[0] || '');
          const loc = String(boundValues[1] || '');
          return blogRevisions
            .filter((r) => r.article_id === artId && r.locale === loc)
            .sort((a, b) => b.created_at - a.created_at || b.id - a.id)
            .slice(0, 10)
            .map((r) => ({ ...r }));
        }
        if (lower.includes('where article_id = ?')) {
          const artId = String(boundValues[0] || '');
          return blogRevisions
            .filter((r) => r.article_id === artId)
            .sort((a, b) => b.created_at - a.created_at || b.id - a.id)
            .map((r) => ({ ...r }));
        }
        return [...blogRevisions].sort(
          (a, b) => b.created_at - a.created_at || b.id - a.id
        );
      }

      // 13. BLOG_REDIRECTS
      if (lower.startsWith('insert into blog_redirects')) {
        const locale = String(boundValues[0] || '');
        const old_slug = String(boundValues[1] || '');
        const new_slug = String(boundValues[2] || '');
        const article_id = String(boundValues[3] || '');
        const created_at = Number(boundValues[4] || Date.now());
        const existingIdx = blogRedirects.findIndex(
          (r) => r.locale === locale && r.old_slug === old_slug
        );
        if (existingIdx !== -1) {
          blogRedirects[existingIdx] = {
            ...blogRedirects[existingIdx],
            new_slug,
            article_id,
            created_at,
          };
        } else {
          blogRedirects.push({
            id: blogRedirSeq++,
            locale,
            old_slug,
            new_slug,
            article_id,
            status_code: 301,
            created_at,
          });
        }
        return [];
      }
      if (lower.startsWith('update blog_redirects set new_slug = ? where locale = ? and new_slug = ?')) {
        const nextSlug = String(boundValues[0] || '');
        const locale = String(boundValues[1] || '');
        const prevTarget = String(boundValues[2] || '');
        blogRedirects = blogRedirects.map((r) =>
          r.locale === locale && r.new_slug === prevTarget
            ? { ...r, new_slug: nextSlug }
            : r
        );
        return [];
      }
      if (lower.startsWith('delete from blog_redirects where locale = ? and old_slug = ?')) {
        const locale = String(boundValues[0] || '');
        const old_slug = String(boundValues[1] || '');
        blogRedirects = blogRedirects.filter(
          (r) => !(r.locale === locale && r.old_slug === old_slug)
        );
        return [];
      }
      if (lower.startsWith('select') && lower.includes('from blog_redirects')) {
        if (lower.includes('where locale = ? and old_slug = ?')) {
          const locale = String(boundValues[0] || '');
          const old_slug = String(boundValues[1] || '');
          const found = blogRedirects.find(
            (r) => r.locale === locale && r.old_slug === old_slug
          );
          return found ? [{ ...found }] : [];
        }
        return [...blogRedirects].sort(
          (a, b) => b.created_at - a.created_at || b.id - a.id
        );
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
    getWriteCount() {
      return writeCount;
    },
    resetWriteCount() {
      writeCount = 0;
    },
  };
}

