/**
 * Client HTTP optimisé pour le scraping Cloudflare Pages Functions.
 * Intègre un User-Agent de navigateur récent, la gestion des timeouts et des cookies de session.
 */

export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  cookies?: Record<string, string>;
}

export interface FetchResult {
  response: Response;
  finalUrl: string;
  cookies: Record<string, string>;
  cookieString: string;
}

/**
 * Exécute un fetch avec gestion de timeout via AbortController et suivi des cookies Set-Cookie.
 */
export async function fetchWithContext(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const timeoutMs = options.timeoutMs ?? 10000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(options.headers || {});
  if (!headers.has('User-Agent')) {
    headers.set('User-Agent', BROWSER_USER_AGENT);
  }
  if (!headers.has('Accept')) {
    headers.set(
      'Accept',
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    );
  }
  if (!headers.has('Accept-Language')) {
    headers.set('Accept-Language', 'en-US,en;q=0.9,fr;q=0.8');
  }

  // Injecter les cookies existants si fournis
  const cookieJar: Record<string, string> = { ...(options.cookies || {}) };
  if (Object.keys(cookieJar).length > 0 && !headers.has('Cookie')) {
    const formatted = Object.entries(cookieJar)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    headers.set('Cookie', formatted);
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
      redirect: options.redirect || 'follow',
    });

    // Extraire les nouveaux cookies reçus
    const rawSetCookies =
      typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : [response.headers.get('set-cookie') || ''];

    for (const raw of rawSetCookies) {
      if (!raw) continue;
      const parts = raw.split(';');
      const [pair] = parts;
      if (pair && pair.includes('=')) {
        const [k, ...v] = pair.split('=');
        const key = k.trim();
        const val = v.join('=').trim();
        if (key && !key.toLowerCase().startsWith('path') && !key.toLowerCase().startsWith('domain')) {
          cookieJar[key] = val;
        }
      }
    }

    const cookieString = Object.entries(cookieJar)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');

    return {
      response,
      finalUrl: response.url || url,
      cookies: cookieJar,
      cookieString,
    };
  } finally {
    clearTimeout(timer);
  }
}
