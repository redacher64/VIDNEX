import { type AdminEnv } from './_lib/db.ts';
import { isRequestAdminAuthenticated } from './_lib/auth.ts';

export interface MiddlewareContext {
  request: Request;
  env?: AdminEnv;
  next: () => Promise<Response>;
}

/**
 * Cloudflare Pages / Worker Middleware:
 * - Protects all /api/admin/* routes (except /api/admin/login and OPTIONS) by verifying the signed HMAC session cookie.
 * - Passes all other routes through with zero overhead.
 * - Adds X-Robots-Tag: noindex, nofollow on /admin and /api/admin/* responses.
 */
export async function onRequest(context: MiddlewareContext): Promise<Response> {
  const { request, env = {}, next } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/');
  const isAdminApi = pathname === '/api/admin' || pathname.startsWith('/api/admin/');

  // Fast path: public routes pass straight through with zero overhead
  if (!isAdminPage && !isAdminApi) {
    return next();
  }

  // Enforce authentication on /api/admin/* (except /api/admin/login and preflight OPTIONS)
  if (isAdminApi && pathname !== '/api/admin/login' && request.method !== 'OPTIONS') {
    const isAuthenticated = await isRequestAdminAuthenticated(request, env);
    if (!isAuthenticated) {
      return new Response(
        JSON.stringify({
          ok: false,
          errorCode: 'UNAUTHORIZED',
          message: 'Session administrateur invalide ou expirée. Veuillez vous reconnecter.',
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
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex, nofollow');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
