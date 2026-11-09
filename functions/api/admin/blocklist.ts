import { type AdminEnv, getDb } from '../../_lib/db.ts';
import { verifyCsrfAndJson } from '../../_lib/auth.ts';
import { listBlocklistEntries } from '../../_lib/settings.ts';

export interface PagesContext {
  request: Request;
  env?: AdminEnv;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const items = await listBlocklistEntries(context.env || {});
  return new Response(
    JSON.stringify({
      ok: true,
      items,
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

  const db = getDb(env);
  if (!db) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Base D1 non disponible.' }),
      { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  let body: { type?: string; value?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const type = body.type;
  const value = (body.value || '').trim().toLowerCase();

  if (type !== 'ip_hash' && type !== 'domain' && type !== 'url') {
    return new Response(
      JSON.stringify({ ok: false, message: 'Type invalide (ip_hash, domain ou url requis).' }),
      { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  if (!value) {
    return new Response(
      JSON.stringify({ ok: false, message: 'La valeur à bloquer ne peut pas être vide.' }),
      { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  const nowMs = Date.now();
  await db
    .prepare('INSERT INTO blocklist (type, value, created_ts) VALUES (?, ?, ?)')
    .bind(type, value, nowMs)
    .run();

  const items = await listBlocklistEntries(env);
  return new Response(
    JSON.stringify({
      ok: true,
      items,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    }
  );
}

export async function onRequestDelete(context: PagesContext): Promise<Response> {
  const { request, env = {} } = context;

  const csrf = verifyCsrfAndJson(request);
  if (!csrf.ok) {
    return new Response(JSON.stringify({ ok: false, message: csrf.error }), {
      status: 403,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const db = getDb(env);
  if (!db) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Base D1 non disponible.' }),
      { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  let body: { id?: number } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const id = Number(body.id);
  if (!Number.isFinite(id) || id <= 0) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Identifiant invalide.' }),
      { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  await db.prepare('DELETE FROM blocklist WHERE id = ?').bind(id).run();
  const items = await listBlocklistEntries(env);

  return new Response(
    JSON.stringify({
      ok: true,
      items,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    }
  );
}
