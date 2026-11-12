import {
  onRequestGet as extractGet,
  onRequestPost as extractPost,
  onRequestOptions as extractOptions,
  type Env as ExtractEnv,
} from './functions/api/extract.ts';
import {
  onRequestGet as downloadGet,
  onRequestOptions as downloadOptions,
} from './functions/api/download.ts';
import { onRequestGet as publicConfigGet } from './functions/api/public-config.ts';
import {
  onRequestGet as adminLoginGet,
  onRequestPost as adminLoginPost,
} from './functions/api/admin/login.ts';
import { onRequestPost as adminLogoutPost } from './functions/api/admin/logout.ts';
import { onRequestGet as adminStatsGet } from './functions/api/admin/stats.ts';
import {
  onRequestGet as adminHealthGet,
  onRequestPost as adminHealthPost,
} from './functions/api/admin/health.ts';
import {
  onRequestGet as adminSettingsGet,
  onRequestPost as adminSettingsPost,
} from './functions/api/admin/settings.ts';
import {
  onRequestGet as adminBlocklistGet,
  onRequestPost as adminBlocklistPost,
  onRequestDelete as adminBlocklistDelete,
} from './functions/api/admin/blocklist.ts';
import { onRequestGet as adminActivityGet } from './functions/api/admin/activity.ts';
import { onRequest as adminMiddleware } from './functions/_middleware.ts';
import type { ExecutionContextLike } from './functions/_lib/db.ts';

export interface WorkerEnv extends ExtractEnv {
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
  [key: string]: unknown;
}

async function routeInner(
  request: Request,
  env: WorkerEnv,
  ctx?: ExecutionContextLike
): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname === '/api/extract') {
    if (request.method === 'OPTIONS') return extractOptions();
    if (request.method === 'GET') {
      return extractGet({ request, env, ctx });
    }
    if (request.method === 'POST') {
      return extractPost({ request, env, ctx });
    }
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (pathname === '/api/download') {
    if (request.method === 'OPTIONS') return downloadOptions();
    if (request.method === 'GET' || request.method === 'HEAD') {
      return downloadGet({
        request,
        env: {
          IG_SESSION_ID: env.IG_SESSION_ID,
          IG_CSRF_TOKEN: env.IG_CSRF_TOKEN,
          IG_COOKIES: env.IG_COOKIES,
          TIKWM_API_KEY: env.TIKWM_API_KEY,
          TT_COOKIE: env.TT_COOKIE,
        },
      });
    }
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (pathname === '/api/public-config') {
    if (request.method === 'GET') {
      return publicConfigGet({ request, env });
    }
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (pathname === '/api/admin/login') {
    if (request.method === 'GET') return adminLoginGet({ request, env });
    if (request.method === 'POST') return adminLoginPost({ request, env });
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (pathname === '/api/admin/logout') {
    if (request.method === 'POST') return adminLogoutPost({ request, env });
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (pathname === '/api/admin/stats') {
    if (request.method === 'GET') return adminStatsGet({ request, env });
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (pathname === '/api/admin/health') {
    if (request.method === 'GET') return adminHealthGet({ request, env });
    if (request.method === 'POST') return adminHealthPost({ request, env });
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (pathname === '/api/admin/settings') {
    if (request.method === 'GET') return adminSettingsGet({ request, env });
    if (request.method === 'POST') return adminSettingsPost({ request, env });
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (pathname === '/api/admin/blocklist') {
    if (request.method === 'GET') return adminBlocklistGet({ request, env });
    if (request.method === 'POST') return adminBlocklistPost({ request, env });
    if (request.method === 'DELETE') return adminBlocklistDelete({ request, env });
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (pathname === '/api/admin/activity') {
    if (request.method === 'GET') return adminActivityGet({ request, env });
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (pathname === '/api/health') {
    return new Response(
      JSON.stringify({
        status: 'ok',
        platform: 'cloudflare-pages-functions',
        engines: ['tiktok_tikwm_and_html', 'instagram_embed_graphql_and_session'],
        igAccountConnected: Boolean(env.IG_SESSION_ID || env.IG_COOKIES),
        d1Connected: Boolean(env.DB),
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  if (pathname === '/llms.txt' && (request.method === 'GET' || request.method === 'HEAD')) {
    const { buildLlmsTxt } = await import('./src/i18n/config.ts');
    const { SITE_URL } = await import('./src/config/site.ts');
    return new Response(request.method === 'HEAD' ? null : buildLlmsTxt(SITE_URL), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  if (
    pathname === '/.well-known/ai-catalog.json' ||
    pathname === '/.well-known/ard.json' ||
    pathname.startsWith('/.well-known/')
  ) {
    return new Response(request.method === 'HEAD' ? null : 'Not Found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  // Static assets via Cloudflare Workers Static Assets binding
  if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || request.method !== 'GET') {
      if (pathname.startsWith('/og/') && pathname.endsWith('.jpg')) {
        const headers = new Headers(response.headers);
        headers.set('Content-Type', 'image/jpeg');
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      }
      if (pathname === '/sitemap.xml') {
        const headers = new Headers(response.headers);
        headers.set('Content-Type', 'application/xml; charset=utf-8');
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      }
      if (pathname === '/sitemap.css') {
        const headers = new Headers(response.headers);
        headers.set('Content-Type', 'text/css; charset=utf-8');
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      }
      if (pathname === '/robots.txt' || pathname === '/llms.txt') {
        const headers = new Headers(response.headers);
        headers.set('Content-Type', 'text/plain; charset=utf-8');
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      }
      return response;
    }

    const { parsePathname } = await import('./src/utils/i18nRouting.ts');
    const parsed = parsePathname(pathname);

    // Known SPA/Admin routes fall back to index.html with 200
    if (!parsed.isNotFound || parsed.isAdmin) {
      const fallbackUrl = new URL('/index.html', url.origin);
      const fallbackReq = new Request(fallbackUrl.toString(), request);
      const fallbackRes = await env.ASSETS.fetch(fallbackReq);
      if (fallbackRes.ok) {
        return new Response(fallbackRes.body, {
          status: 200,
          headers: fallbackRes.headers,
        });
      }
    }

    // Unknown route -> serve /404.html with true HTTP 404 status (no soft 404)
    const notFoundUrl = new URL('/404.html', url.origin);
    const notFoundReq = new Request(notFoundUrl.toString(), request);
    const notFoundRes = await env.ASSETS.fetch(notFoundReq);
    if (notFoundRes.ok) {
      const headers = new Headers(notFoundRes.headers);
      headers.set('X-Robots-Tag', 'noindex, nofollow');
      return new Response(notFoundRes.body, {
        status: 404,
        headers,
      });
    }

    return response;
  }

  return new Response('Not Found', { status: 404 });
}

export default {
  async fetch(
    request: Request,
    env: WorkerEnv = {},
    ctx?: ExecutionContextLike
  ): Promise<Response> {
    return adminMiddleware({
      request,
      env,
      next: () => routeInner(request, env, ctx),
    });
  },
};
