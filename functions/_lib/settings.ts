/**
 * Gestion des paramètres système (`settings`) et de la liste de blocage (`blocklist`) dans Cloudflare D1.
 * Si D1 est indisponible, renvoie toujours des valeurs par défaut sûres sans jamais bloquer le site public.
 */

import { type AdminEnv, getDb } from './db.ts';

export interface SystemSettings {
  maintenance: boolean;
  platform_tiktok: boolean;
  platform_instagram: boolean;
  platform_x: boolean;
  rate_limit_per_min: number;
  ads_enabled: boolean;
  test_url_tiktok: string;
  test_url_instagram: string;
  test_url_x: string;
}

export interface BlocklistEntry {
  id: number;
  type: 'ip_hash' | 'domain' | 'url';
  value: string;
  created_ts: number;
}

export const DEFAULT_SETTINGS: SystemSettings = {
  maintenance: false,
  platform_tiktok: true,
  platform_instagram: true,
  platform_x: true,
  rate_limit_per_min: 30,
  ads_enabled: true,
  test_url_tiktok: '',
  test_url_instagram: '',
  test_url_x: '',
};

/**
 * Lit l'ensemble des paramètres système depuis la table D1 `settings`.
 * En cas d'indisponibilité de D1, retourne `DEFAULT_SETTINGS` de manière transparente.
 */
export async function getSystemSettings(env?: AdminEnv): Promise<SystemSettings> {
  const db = getDb(env);
  if (!db) {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const res = await db
      .prepare('SELECT key, value FROM settings')
      .all<{ key: string; value: string }>();

    const map = new Map<string, string>();
    for (const row of res.results || []) {
      if (row && typeof row.key === 'string') {
        map.set(row.key, String(row.value ?? ''));
      }
    }

    const rawRate = Number(map.get('rate_limit_per_min'));
    const rateLimit =
      Number.isFinite(rawRate) && rawRate >= 1 && rawRate <= 10_000
        ? Math.floor(rawRate)
        : DEFAULT_SETTINGS.rate_limit_per_min;

    return {
      maintenance: map.get('maintenance') === 'true',
      platform_tiktok: map.has('platform_tiktok')
        ? map.get('platform_tiktok') !== 'false'
        : true,
      platform_instagram: map.has('platform_instagram')
        ? map.get('platform_instagram') !== 'false'
        : true,
      platform_x: map.has('platform_x')
        ? map.get('platform_x') !== 'false'
        : true,
      rate_limit_per_min: rateLimit,
      ads_enabled: map.has('ads_enabled')
        ? map.get('ads_enabled') !== 'false'
        : true,
      test_url_tiktok: map.get('test_url_tiktok') ?? '',
      test_url_instagram: map.get('test_url_instagram') ?? '',
      test_url_x: map.get('test_url_x') ?? '',
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Met à jour un ou plusieurs paramètres dans la table D1 `settings`.
 */
export async function updateSystemSettings(
  env: AdminEnv,
  partial: Partial<SystemSettings>
): Promise<SystemSettings> {
  const db = getDb(env);
  if (!db) {
    throw new Error('Base de données Cloudflare D1 non connectée.');
  }

  const entries: Array<[string, string]> = [];
  if (typeof partial.maintenance === 'boolean') {
    entries.push(['maintenance', String(partial.maintenance)]);
  }
  if (typeof partial.platform_tiktok === 'boolean') {
    entries.push(['platform_tiktok', String(partial.platform_tiktok)]);
  }
  if (typeof partial.platform_instagram === 'boolean') {
    entries.push(['platform_instagram', String(partial.platform_instagram)]);
  }
  if (typeof partial.platform_x === 'boolean') {
    entries.push(['platform_x', String(partial.platform_x)]);
  }
  if (typeof partial.rate_limit_per_min === 'number') {
    const clamped = Math.max(1, Math.min(5000, Math.floor(partial.rate_limit_per_min)));
    entries.push(['rate_limit_per_min', String(clamped)]);
  }
  if (typeof partial.ads_enabled === 'boolean') {
    entries.push(['ads_enabled', String(partial.ads_enabled)]);
  }
  if (typeof partial.test_url_tiktok === 'string') {
    entries.push(['test_url_tiktok', partial.test_url_tiktok.trim()]);
  }
  if (typeof partial.test_url_instagram === 'string') {
    entries.push(['test_url_instagram', partial.test_url_instagram.trim()]);
  }
  if (typeof partial.test_url_x === 'string') {
    entries.push(['test_url_x', partial.test_url_x.trim()]);
  }

  for (const [key, value] of entries) {
    await db
      .prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .bind(key, value)
      .run();
  }

  return getSystemSettings(env);
}

/**
 * Récupère toutes les entrées de la table `blocklist`.
 */
export async function listBlocklistEntries(
  env?: AdminEnv
): Promise<BlocklistEntry[]> {
  const db = getDb(env);
  if (!db) return [];

  try {
    const res = await db
      .prepare(
        'SELECT id, type, value, created_ts FROM blocklist ORDER BY created_ts DESC'
      )
      .all<BlocklistEntry>();
    return res.results || [];
  } catch {
    return [];
  }
}

/**
 * Vérifie si une requête d'extraction correspond à une entrée de la `blocklist`
 * (`ip_hash`, `domain`, ou `url`). Silencieux si D1 est indisponible.
 */
export async function isRequestBlocked(
  env: AdminEnv | undefined,
  ipHash: string,
  targetUrl: string
): Promise<boolean> {
  const entries = await listBlocklistEntries(env);
  if (!entries.length) return false;

  const cleanUrl = targetUrl.trim().toLowerCase().replace(/\/+$/, '');
  let hostname = '';
  try {
    const parsed = new URL(
      targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`
    );
    hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    hostname = '';
  }

  for (const item of entries) {
    const val = String(item.value || '')
      .trim()
      .toLowerCase()
      .replace(/\/+$/, '');
    if (!val) continue;

    if (item.type === 'ip_hash' && val === ipHash.toLowerCase()) {
      return true;
    }
    if (item.type === 'domain' && hostname) {
      const cleanDomain = val.replace(/^www\./, '');
      if (hostname === cleanDomain || hostname.endsWith(`.${cleanDomain}`)) {
        return true;
      }
    }
    if (item.type === 'url') {
      if (cleanUrl === val || cleanUrl.includes(val)) {
        return true;
      }
    }
  }

  return false;
}
