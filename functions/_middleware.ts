import { SITE_URL } from '../src/config/site.ts';
import { type AdminEnv } from './_lib/db.ts';
import { isRequestAdminAuthenticated } from './_lib/auth.ts';

export interface MiddlewareContext {
  request: Request;
  env?: AdminEnv;
  next: () => Promise<Response>;
}

/**
 * Checks if the request hostname is a preview domain (.pages.dev or .workers.dev)
 * while SITE_URL is a custom production domain, to prevent duplicate indexing (ÉTAPE 5).
 */
export function isPreviewHostRequiringNoindex(
  requestHost: string,
  siteUrl: string = SITE_URL
): boolean {
  const cleanHost = (requestHost || '').split(':')[0].toLowerCase();
  if (!cleanHost) return false;

  const isPreviewDomain =
    cleanHost.endsWith('.pages.dev') || cleanHost.endsWith('.workers.dev');
  if (!isPreviewDomain) return false;

  try {
    const canonicalHost = new URL(siteUrl).hostname.toLowerCase();
    return cleanHost !== canonicalHost;
  } catch {
    return true;
  }
}

/**
 * Cloudflare Pages / Worker Middleware:
 * - Protects all /api/admin/* routes (except /api/admin/login and OPTIONS) by verifying the signed HMAC session cookie.
 * - Adds X-Robots-Tag: noindex, nofollow on /admin, /api/*, and .pages.dev / .workers.dev preview domains.
 * - Passes all other public routes through with zero overhead.
 */
export async function onRequest(context: MiddlewareContext): Promise<Response> {
  const { request, env = {}, next } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/');
  const isAdminApi =
    pathname === '/api/admin' || pathname.startsWith('/api/admin/');
  const isAnyApi = pathname === '/api' || pathname.startsWith('/api/');
  const isPreviewHost = isPreviewHostRequiringNoindex(url.hostname, SITE_URL);

  // Enforce authentication on /api/admin/* (except /api/admin/login and preflight OPTIONS)
  if (
    isAdminApi &&
    pathname !== '/api/admin/login' &&
    request.method !== 'OPTIONS'
  ) {
    const isAuthenticated = await isRequestAdminAuthenticated(request, env);
    if (!isAuthenticated) {
      return new Response(
        JSON.stringify({
          ok: false,
          errorCode: 'UNAUTHORIZED',
          message:
            'Session administrateur invalide ou expirée. Veuillez vous reconnecter.',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
          },
        }
      );
    }
  }

  const response = await next();

  const isOgAsset = pathname.startsWith('/og/');

  if (!isOgAsset && (isAdminPage || isAnyApi || isPreviewHost)) {
    const headers = new Headers(response.headers);
    headers.set('X-Robots-Tag', 'noindex, nofollow');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return response;
}
