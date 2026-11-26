/**
 * Pure analytics helpers for VIDNEX D1 telemetry:
 * - Bot User-Agent classification
 * - Referrer host extraction & categorization (search / direct / social / other)
 * - Entry page normalization (rejecting /admin, /api, static assets)
 * - Safe extraction link domain extraction (hostname only, no paths/tokens)
 * - Short error message sanitization
 * - Cloudflare country extraction (request.cf.country)
 */

export type ReferrerCategory = 'search' | 'direct' | 'social' | 'other';

const BOT_UA_PATTERN =
  /bot\b|crawler|spider|slurp|bingpreview|mediapartners-google|adsbot|apis-google|google-inspectiontool|storebot-google|googleother|facebookexternalhit|facebot|whatsapp|telegrambot|discordbot|linkedinbot|twitterbot|applebot|duckduckbot|yandex|baiduspider|sogou|exabot|ia_archiver|semrush|ahrefs|mj12bot|dotbot|petalbot|bytespider|gptbot|oai-searchbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|ccbot|amazonbot|applebot-extended|dataforseobot|barkrowler|blexbot|megaindex|seznambot|qwantify|naverbot|yeti|screaming frog|sitebulb|gtmetrix|pingdom|uptimerobot|statuscake|hetrixtools|datadog|newrelic|lighthouse|pagespeed|chrome-lighthouse|headlesschrome|phantomjs|puppeteer|playwright|selenium|webdriver|curl\/|wget\/|python-requests|python-urllib|aiohttp|httpx|go-http-client|java\/|okhttp|apache-httpclient|libwww-perl|php\/|guzzlehttp|ruby|axios\/|node-fetch|undici|postmanruntime|insomnia|k6\//i;

const OWN_HOSTS = new Set([
  'vidnex.space',
  'www.vidnex.space',
  'redacher64.vidnex.space',
  'localhost',
  '127.0.0.1',
]);

const SEARCH_ENGINE_DOMAINS = [
  'google.',
  'bing.com',
  'duckduckgo.com',
  'search.yahoo.',
  'yahoo.com',
  'yandex.',
  'baidu.com',
  'ecosia.org',
  'qwant.com',
  'search.brave.com',
  'startpage.com',
  'seznam.cz',
  'search.naver.com',
  'naver.com',
  'sogou.com',
  'so.com',
  'kagi.com',
  'perplexity.ai',
  'chatgpt.com',
  'aol.com',
  'ask.com',
  'swisscows.com',
  'mojeek.com',
];

const SOCIAL_DOMAINS = [
  'tiktok.com',
  'instagram.com',
  'facebook.com',
  'fb.com',
  'fb.me',
  'messenger.com',
  'x.com',
  'twitter.com',
  't.co',
  'youtube.com',
  'youtu.be',
  'reddit.com',
  'redd.it',
  'linkedin.com',
  'lnkd.in',
  'pinterest.',
  'pin.it',
  'snapchat.com',
  'threads.net',
  't.me',
  'telegram.org',
  'telegram.me',
  'wa.me',
  'whatsapp.com',
  'discord.com',
  'discord.gg',
  'vk.com',
  'quora.com',
  'tumblr.com',
  'bsky.app',
  'mastodon.social',
  'twitch.tv',
];

const STATIC_ASSET_EXT_RE =
  /\.(?:js|mjs|cjs|css|map|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|eot|otf|xml|txt|json|webmanifest|mp4|mp3|zip)$/i;

/**
 * Classifies whether a User-Agent string belongs to an automated bot/crawler/script.
 * Empty or missing User-Agent is treated as bot traffic.
 */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  const ua = String(userAgent || '').trim();
  if (!ua || ua.length < 8) return true;
  return BOT_UA_PATTERN.test(ua);
}

/**
 * Extracts a normalized lowercase hostname from a referrer URL, stripping leading `www.`.
 * Returns `null` if empty, invalid, non-HTTP(S), or matching one of our own domains.
 */
export function extractReferrerHost(
  referrer: string | null | undefined,
  extraOwnHosts: string[] = []
): string | null {
  const raw = String(referrer || '').trim();
  if (!raw || raw.length > 2048) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  let host = parsed.hostname.toLowerCase().replace(/\.+$/, '');
  if (!host || host.length > 120) return null;
  if (host.startsWith('www.')) {
    host = host.slice(4);
  }

  if (OWN_HOSTS.has(host) || OWN_HOSTS.has(`www.${host}`)) {
    return null;
  }
  if (host.endsWith('.vidnex.space') || host.endsWith('.pages.dev') || host.endsWith('.workers.dev')) {
    return null;
  }
  for (const own of extraOwnHosts) {
    const cleanOwn = String(own || '').trim().toLowerCase().replace(/^www\./, '');
    if (cleanOwn && host === cleanOwn) return null;
  }

  return host;
}

function hostMatchesPattern(host: string, pattern: string): boolean {
  if (pattern.endsWith('.')) {
    // Prefix TLD match such as "google." -> google.com, google.fr, maps.google.co.uk
    return host.startsWith(pattern) || host.includes(`.${pattern}`);
  }
  return host === pattern || host.endsWith(`.${pattern}`);
}

/**
 * Categorizes a normalized referrer host into:
 * - 'direct' (no external referrer)
 * - 'search' (search engines)
 * - 'social' (social networks & messaging apps)
 * - 'other'  (all other external websites)
 */
export function categorizeReferrerHost(
  host: string | null | undefined
): ReferrerCategory {
  const clean = String(host || '').trim().toLowerCase().replace(/^www\./, '');
  if (!clean) return 'direct';

  for (const pattern of SEARCH_ENGINE_DOMAINS) {
    if (hostMatchesPattern(clean, pattern)) return 'search';
  }
  for (const pattern of SOCIAL_DOMAINS) {
    if (hostMatchesPattern(clean, pattern)) return 'social';
  }
  return 'other';
}

/**
 * Normalizes a landing/entry page path.
 * Strips query string & hash, removes trailing slash (except "/"),
 * and returns `null` for /admin, /api, or static asset paths.
 */
export function normalizeEntryPage(rawPath: string | null | undefined): string | null {
  let input = String(rawPath || '').trim();
  if (!input) return '/';

  // If full URL was passed, extract only pathname
  if (/^https?:\/\//i.test(input)) {
    try {
      input = new URL(input).pathname;
    } catch {
      return null;
    }
  }

  // Strip query string and fragment
  input = input.split('?')[0].split('#')[0].trim();
  if (!input.startsWith('/')) {
    input = `/${input}`;
  }

  // Collapse duplicate slashes & strip trailing slash (except root)
  input = input.replace(/\/{2,}/g, '/');
  if (input.length > 1 && input.endsWith('/')) {
    input = input.slice(0, -1);
  }

  const lower = input.toLowerCase();
  if (
    lower === '/admin' ||
    lower.startsWith('/admin/') ||
    lower === '/api' ||
    lower.startsWith('/api/') ||
    lower.startsWith('/.well-known') ||
    lower.startsWith('/assets/') ||
    lower.startsWith('/og/') ||
    STATIC_ASSET_EXT_RE.test(lower)
  ) {
    return null;
  }

  // Allow safe URL path characters only, cap length at 160 chars
  const sanitized = input.replace(/[\x00-\x1f\x7f<>"]/g, '').slice(0, 160);
  return sanitized || '/';
}

/**
 * Extracts only the lowercase hostname of a user-submitted link for error diagnostics.
 * Never retains paths, usernames, query strings, or tokens.
 */
export function extractSafeDomain(rawUrl: string | null | undefined): string | null {
  const raw = String(rawUrl || '').trim();
  if (!raw) return null;

  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase().replace(/\.+$/, '');
    if (!host || !host.includes('.') || host.length > 120) return null;
    if (!/^[a-z0-9.-]+$/.test(host)) return null;
    return host;
  } catch {
    return null;
  }
}

/**
 * Produces a concise, privacy-safe error message (strips URLs, newlines, trims to 200 chars).
 */
export function sanitizeShortErrorMessage(
  rawMessage: string | null | undefined,
  maxLength = 200
): string | null {
  const raw = String(rawMessage || '').trim();
  if (!raw) return null;
  const cleaned = raw
    .replace(/https?:\/\/\S+/gi, '[lien]')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!cleaned) return null;
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

/**
 * Reads the ISO-3166-1 alpha-2 country code from Cloudflare's `request.cf.country`
 * (or `CF-IPCountry` header), falling back to `'XX'`.
 */
export function extractRequestCountry(request: Request): string {
  const cfCountry = (request as Request & { cf?: { country?: unknown } }).cf?.country;
  const raw =
    (typeof cfCountry === 'string' && cfCountry.trim()) ||
    request.headers.get('CF-IPCountry') ||
    request.headers.get('cf-ipcountry') ||
    '';
  const clean = raw.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(clean) && clean !== 'T1') {
    return clean;
  }
  return 'XX';
}
