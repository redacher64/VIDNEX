import { type AdminEnv, getDb } from '../../_lib/db.ts';
import { requirePermission } from '../../_lib/auth.ts';

export interface PagesContext {
  request: Request;
  env?: AdminEnv;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env = {} } = context;
  const auth = await requirePermission(request, env, 'activity.view');
  if (!auth.ok) return auth.response;

  const db = getDb(env);

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(5, parseInt(url.searchParams.get('limit') || '25', 10) || 25));
  const offset = (page - 1) * limit;
  const platformFilter = (url.searchParams.get('platform') || '').trim().toLowerCase();
  const errorCodeFilter = (
    url.searchParams.get('error_code') ||
    url.searchParams.get('errorCode') ||
    ''
  )
    .trim()
    .toUpperCase();

  if (!db) {
    return new Response(
      JSON.stringify({
        ok: true,
        page,
        limit,
        total: 0,
        totalPages: 1,
        items: [],
        filters: {
          platform: platformFilter || null,
          error_code: errorCodeFilter || null,
        },
        contactMessagesSupported: false,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      }
    );
  }

  try {
    const whereClauses: string[] = [];
    const filterBindings: unknown[] = [];

    if (platformFilter) {
      if (platformFilter === 'instagram') {
        whereClauses.push('platform IN (?, ?)');
        filterBindings.push('instagram', 'instagram_profile');
      } else {
        whereClauses.push('platform = ?');
        filterBindings.push(platformFilter);
      }
    }

    if (errorCodeFilter) {
      whereClauses.push('error_code = ?');
      filterBindings.push(errorCodeFilter);
    }

    const whereSql = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM request_log${whereSql}`);
    const countRow = await (filterBindings.length > 0
      ? countStmt.bind(...filterBindings)
      : countStmt
    ).first<{ total: number }>();

    const total = Number(countRow?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    let rows: Array<{
      id: number;
      ts: number;
      platform: string;
      status: string;
      error_code: string | null;
      duration_ms: number;
      ip_hash: string;
      engine_stage?: string | null;
      http_status?: number | null;
      content_kind?: string | null;
      engine_fn?: string | null;
    }> = [];

    const queryBindings = [...filterBindings, limit, offset];

    try {
      const res = await db
        .prepare(
          `SELECT id, ts, platform, status, error_code, duration_ms, ip_hash, engine_stage, http_status, content_kind, engine_fn FROM request_log${whereSql} ORDER BY ts DESC, id DESC LIMIT ? OFFSET ?`
        )
        .bind(...queryBindings)
        .all<{
          id: number;
          ts: number;
          platform: string;
          status: string;
          error_code: string | null;
          duration_ms: number;
          ip_hash: string;
          engine_stage?: string | null;
          http_status?: number | null;
          content_kind?: string | null;
          engine_fn?: string | null;
        }>();
      rows = res.results || [];
    } catch {
      try {
        const res8 = await db
          .prepare(
            `SELECT id, ts, platform, status, error_code, duration_ms, ip_hash, engine_stage, http_status FROM request_log${whereSql} ORDER BY ts DESC, id DESC LIMIT ? OFFSET ?`
          )
          .bind(...queryBindings)
          .all<{
            id: number;
            ts: number;
            platform: string;
            status: string;
            error_code: string | null;
            duration_ms: number;
            ip_hash: string;
            engine_stage?: string | null;
            http_status?: number | null;
          }>();
        rows = res8.results || [];
      } catch {
        const fallbackRes = await db
          .prepare(
            `SELECT id, ts, platform, status, error_code, duration_ms, ip_hash FROM request_log${whereSql} ORDER BY ts DESC, id DESC LIMIT ? OFFSET ?`
          )
          .bind(...queryBindings)
          .all<{
            id: number;
            ts: number;
            platform: string;
            status: string;
            error_code: string | null;
            duration_ms: number;
            ip_hash: string;
          }>();
        rows = fallbackRes.results || [];
      }
    }

    const items = rows.map((row) => {
      const truncatedIp = row.ip_hash ? row.ip_hash.trim().slice(0, 12) : '';
      return {
        id: row.id,
        ts: row.ts,
        platform: row.platform,
        status: row.status,
        content_kind: row.content_kind || null,
        engine_fn: row.engine_fn || null,
        engine_stage: row.engine_stage || null,
        http_status: row.http_status ?? null,
        error_code: row.error_code || null,
        duration_ms: row.duration_ms,
        ip_hash_short: truncatedIp || '—',
        ip_hash: truncatedIp,
      };
    });

    return new Response(
      JSON.stringify({
        ok: true,
        page,
        limit,
        total,
        totalPages,
        items,
        filters: {
          platform: platformFilter || null,
          error_code: errorCodeFilter || null,
        },
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
