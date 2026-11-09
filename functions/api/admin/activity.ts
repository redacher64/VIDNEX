import { type AdminEnv, getDb } from '../../_lib/db.ts';

export interface PagesContext {
  request: Request;
  env?: AdminEnv;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env = {} } = context;
  const db = getDb(env);

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(5, parseInt(url.searchParams.get('limit') || '25', 10) || 25));
  const offset = (page - 1) * limit;

  if (!db) {
    return new Response(
      JSON.stringify({
        ok: true,
        page,
        limit,
        total: 0,
        totalPages: 1,
        items: [],
        contactMessagesSupported: false,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      }
    );
  }

  try {
    const countRow = await db
      .prepare('SELECT COUNT(*) as total FROM request_log')
      .first<{ total: number }>();

    const total = Number(countRow?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const res = await db
      .prepare(
        'SELECT id, ts, platform, status, error_code, duration_ms, ip_hash FROM request_log ORDER BY ts DESC, id DESC LIMIT ? OFFSET ?'
      )
      .bind(limit, offset)
      .all<{
        id: number;
        ts: number;
        platform: string;
        status: string;
        error_code: string | null;
        duration_ms: number;
        ip_hash: string;
      }>();

    const items = (res.results || []).map((row) => ({
      id: row.id,
      ts: row.ts,
      platform: row.platform,
      status: row.status,
      error_code: row.error_code,
      duration_ms: row.duration_ms,
      // Truncated SHA-256 IP hash for display, plus full hash so admin can copy it to blocklist if needed
      ip_hash_short: row.ip_hash ? `${row.ip_hash.slice(0, 12)}…` : 'anonyme',
      ip_hash: row.ip_hash,
    }));

    return new Response(
      JSON.stringify({
        ok: true,
        page,
        limit,
        total,
        totalPages,
        items,
        contactMessagesSupported: false,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        message: err instanceof Error ? err.message : 'Erreur lors du chargement du journal.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      }
    );
  }
}
