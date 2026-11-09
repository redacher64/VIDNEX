import { type AdminEnv } from '../../_lib/db.ts';
import { buildLogoutSetCookieHeader, verifyCsrfAndJson } from '../../_lib/auth.ts';

export interface PagesContext {
  request: Request;
  env?: AdminEnv;
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request } = context;

  const csrf = verifyCsrfAndJson(request);
  if (!csrf.ok) {
    return new Response(JSON.stringify({ ok: false, message: csrf.error }), {
      status: 403,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': buildLogoutSetCookieHeader(),
    },
  });
}
