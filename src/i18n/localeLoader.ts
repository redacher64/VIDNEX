import type { SupportedLocale } from './config.ts';
import type { LocaleBundle } from './types.ts';
import frBundleJson from './locales/fr.json' with { type: 'json' };

const frBundle = frBundleJson as unknown as LocaleBundle;

const bundleCache = new Map<SupportedLocale, LocaleBundle>([
  ['fr', frBundle],
]);

declare global {
  interface Window {
    __VIDNEX_LOCALE_BUNDLE__?: LocaleBundle;
  }
}

// Hydrate pre-injected locale bundle from static pre-rendered HTML if available
if (typeof window !== 'undefined' && window.__VIDNEX_LOCALE_BUNDLE__) {
  const preloaded = window.__VIDNEX_LOCALE_BUNDLE__;
  if (preloaded && preloaded.locale) {
    bundleCache.set(preloaded.locale, preloaded);
  }
}

/**
 * In Node.js environments (SSR / unit tests), we can read locale JSON files from disk
 * via Node's built-in process.getBuiltinModule without triggering browser JSON module
 * MIME-type conflicts in Vite dev server.
 */
function tryLoadNodeLocaleJson(locale: SupportedLocale): LocaleBundle | null {
  try {
    const proc = (
      globalThis as unknown as {
        process?: {
          versions?: { node?: string };
          cwd?: () => string;
          getBuiltinModule?: (id: string) => any;
        };
      }
    ).process;
    if (proc?.versions?.node && typeof proc.getBuiltinModule === 'function') {
      const fs = proc.getBuiltinModule('node:fs');
      const path = proc.getBuiltinModule('node:path');
      const filePath = path.join(
        proc.cwd ? proc.cwd() : '.',
        'src',
        'i18n',
        'locales',
        `${locale}.json`
      );
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(
          fs.readFileSync(filePath, 'utf8')
        ) as LocaleBundle;
        bundleCache.set(locale, parsed);
        return parsed;
      }
    }
  } catch {
    // Ignore in browser/edge environments
  }
  return null;
}

/**
 * Used by the static pre-render script (SSR) or unit tests to register a locale bundle synchronously.
 */
export function registerPreloadedLocale(bundle: LocaleBundle): void {
  if (bundle && bundle.locale) {
    bundleCache.set(bundle.locale, bundle);
  }
}

export function hasLocaleBundleSync(locale: SupportedLocale): boolean {
  if (typeof window !== 'undefined' && window.__VIDNEX_LOCALE_BUNDLE__) {
    const winBundle = window.__VIDNEX_LOCALE_BUNDLE__;
    if (winBundle && winBundle.locale && !bundleCache.has(winBundle.locale)) {
      bundleCache.set(winBundle.locale, winBundle);
    }
  }
  return bundleCache.has(locale);
}

/**
 * Returns the cached LocaleBundle synchronously if already loaded (or preloaded via SSR/window),
 * falling back to the French default bundle while the async chunk loads.
 */
export function getLocaleBundleSync(locale: SupportedLocale): LocaleBundle {
  if (hasLocaleBundleSync(locale)) {
    return bundleCache.get(locale)!;
  }
  const nodeLoaded = tryLoadNodeLocaleJson(locale);
  if (nodeLoaded) {
    return nodeLoaded;
  }
  return frBundle;
}

/**
 * Dynamically imports only the requested language JSON chunk (Vite code-splitting per language).
 * Note: Do NOT pass `{ with: { type: 'json' } }` on dynamic imports in Vite, because Vite
 * transforms JSON files into JS ES modules served with `Content-Type: text/javascript`.
 */
export async function loadLocaleBundle(
  locale: SupportedLocale
): Promise<LocaleBundle> {
  const cached = bundleCache.get(locale);
  if (cached) {
    return cached;
  }

  const nodeLoaded = tryLoadNodeLocaleJson(locale);
  if (nodeLoaded) {
    return nodeLoaded;
  }

  let mod: { default: unknown };
  switch (locale) {
    case 'fr':
      return frBundle;
    case 'en':
      mod = await import('./locales/en.json');
      break;
    case 'ar':
      mod = await import('./locales/ar.json');
      break;
    case 'es':
      mod = await import('./locales/es.json');
      break;
    case 'pt':
      mod = await import('./locales/pt.json');
      break;
    case 'de':
      mod = await import('./locales/de.json');
      break;
    case 'tr':
      mod = await import('./locales/tr.json');
      break;
    case 'id':
      mod = await import('./locales/id.json');
      break;
    case 'it':
      mod = await import('./locales/it.json');
      break;
    case 'ru':
      mod = await import('./locales/ru.json');
      break;
    default:
      return frBundle;
  }

  const bundle = mod.default as LocaleBundle;
  bundleCache.set(locale, bundle);
  return bundle;
}
