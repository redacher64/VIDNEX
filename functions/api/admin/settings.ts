import { type AdminEnv } from '../../_lib/db.ts';
import { verifyCsrfAndJson } from '../../_lib/auth.ts';
import { getSystemSettings, updateSystemSettings, type SystemSettings } from '../../_lib/settings.ts';

export interface PagesContext {
  request: Request;
  env?: AdminEnv;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const settings = await getSystemSettings(context.env || {});
  return new Response(
    JSON.stringify({
      ok: true,
      settings,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    }
  );
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env = {} } = context;

  const csrf = verifyCsrfAndJson(request);
  if (!csrf.ok) {
    return new Response(JSON.stringify({ ok: false, message: csrf.error }), {
      status: 403,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  let body: Partial<SystemSettings> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const updated = await updateSystemSettings(env, body);
  return new Response(
    JSON.stringify({
      ok: true,
      settings: updated,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    }
  );
}
