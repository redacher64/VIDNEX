import { SITE_URL } from '../src/config/site.ts';
import { resolveBlogRedirectPath } from '../src/i18n/config.ts';
import { type AdminEnv } from './_lib/db.ts';
import {
  requirePermission,
  resolveAdminRoutePermission,
} from './_lib/auth.ts';

export interface MiddlewareContext {
  request: Request;
  env?: AdminEnv;
  next: () => Promise<Response>;
}

/**
 * Checks if the request hostname is a preview or secondary subdomain
 * (.pages.dev, .workers.dev, redacher64.vidnex.space, or any non-www subdomain of SITE_URL)
 * while SITE_URL is a custom production domain, to prevent duplicate indexing (ÉTAPE 5).
 */
export function isPreviewHostRequiringNoindex(
  requestHost: string,
  siteUrl: string = SITE_URL
): boolean {
  const cleanHost = (requestHost || '').split(':')[0].toLowerCase();
  if (!cleanHost) return false;

  let canonicalHost = 'vidnex.space';
  try {
    canonicalHost = new URL(siteUrl).hostname.toLowerCase();
  } catch {
    // Keep default canonical host
  }

  if (cleanHost === canonicalHost || cleanHost === `www.${canonicalHost}`) {
    return false;
  }

  if (
    cleanHost === 'redacher64.vidnex.space' ||
    cleanHost.endsWith(`.${canonicalHost}`) ||
    cleanHost.endsWith('.pages.dev') ||
    cleanHost.endsWith('.workers.dev')
  ) {
    return true;
  }

  return false;
}

/**
 * Cloudflare Pages / Worker Middleware:
 * - Redirects /en/blog and /en/blog/{slug} (plus legacy blog slugs) with HTTP 301 to /blog and /blog/{slug}.
 * - Protects all /api/admin/* routes (except /api/admin/login and OPTIONS) by verifying the signed HMAC session cookie,
 *   re-reading D1 user permissions/session_version, and enforcing `requirePermission` with default = deny (owner only).
 * - Adds X-Robots-Tag: noindex, nofollow on /admin, /api/*, and .pages.dev / .workers.dev preview domains.
 * - Passes all other public routes through with zero overhead.
 */
export async function onRequest(context: MiddlewareContext): Promise<Response> {
  const { request, env = {}, next } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  const blogRedirectTarget = resolveBlogRedirectPath(pathname);
  if (blogRedirectTarget) {
    return new Response(null, {
      status: 301,
      headers: {
        Location: `${url.origin}${blogRedirectTarget}${url.search}`,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  }

  const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/');
  const isAdminApi =
    pathname === '/api/admin' || pathname.startsWith('/api/admin/');
  const isAnyApi = pathname === '/api' || pathname.startsWith('/api/');
  const isPreviewHost = isPreviewHostRequiringNoindex(url.hostname, SITE_URL);

  // Enforce authentication and RBAC permissions on /api/admin/* (except /api/admin/login and preflight OPTIONS)
  if (
    isAdminApi &&
    pathname !== '/api/admin/login' &&
    request.method !== 'OPTIONS'
  ) {
    const routePerm = resolveAdminRoutePermission(pathname, request.method);
    const authResult = await requirePermission(request, env, routePerm.perm, {
      allowMustChangePassword: routePerm.allowMustChangePassword,
    });
    if (!authResult.ok) {
      return authResult.response;
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
