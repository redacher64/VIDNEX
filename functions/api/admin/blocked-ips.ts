import { type AdminEnv } from '../../_lib/db.ts';
import {
  recordAuditLog,
  requirePermission,
  verifyCsrfAndJson,
} from '../../_lib/auth.ts';
import {
  getRejectedRequestsToday,
  listActiveBlockedIps,
  unblockIpAddress,
} from '../../_lib/security.ts';

export interface PagesContext {
  request: Request;
  env?: AdminEnv;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const env = context.env || {};
  const auth = await requirePermission(context.request, env, 'owner');
  if (!auth.ok) return auth.response;

  const nowMs = Date.now();
  const [items, rejectedToday] = await Promise.all([
    listActiveBlockedIps(env, nowMs),
    getRejectedRequestsToday(env, nowMs),
  ]);

  return new Response(
    JSON.stringify({
      ok: true,
      items,
      rejectedToday,
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

  let body: { ip_hash?: string; ipHash?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const ipHash = String(body.ip_hash || body.ipHash || '').trim();
  if (!ipHash) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Empreinte ip_hash manquante.' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  const nowMs = Date.now();
  await unblockIpAddress(env, ipHash);
  await recordAuditLog(
    env,
    auth.principal.login,
    'blocked_ip.unblock',
    ipHash.slice(0, 16),
    nowMs
  );

  const [items, rejectedToday] = await Promise.all([
    listActiveBlockedIps(env, nowMs),
    getRejectedRequestsToday(env, nowMs),
  ]);

  return new Response(
    JSON.stringify({
      ok: true,
      items,
      rejectedToday,
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
