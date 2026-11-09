import { type AdminEnv } from '../_lib/db.ts';
import { getSystemSettings } from '../_lib/settings.ts';

export interface PagesContext {
  request: Request;
  env?: AdminEnv;
}

/**
 * GET /api/public-config
 * Returns non-sensitive runtime toggles for the public frontend:
 * - maintenance mode
 * - enabled platforms (tiktok, instagram)
 * - ads_enabled flag
 * Cached briefly (15s browser, 30s edge) and resilient to D1 downtime.
 */
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const env = context.env || {};
  const settings = await getSystemSettings(env);

  return new Response(
    JSON.stringify({
      ok: true,
      maintenance: settings.maintenance,
      platforms: {
        tiktok: settings.platform_tiktok,
        instagram: settings.platform_instagram,
        x: settings.platform_x,
        facebook: settings.platform_facebook,
      },
      ads_enabled: settings.ads_enabled,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=15, s-maxage=30, stale-while-revalidate=60',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
