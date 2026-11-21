import {
  isLegalPageKey,
  type LegalPageKey,
  type PageKey,
  type PlatformPageKey,
  type SupportedLocale,
} from './config.ts';
import type { LegalPageContent, LocaleBundle } from './types.ts';
import frBundleJson from './locales/fr.json' with { type: 'json' };

const frBundle = frBundleJson as unknown as LocaleBundle;

export type LegalLocaleBundle = Record<LegalPageKey, LegalPageContent>;

export type LocaleBundleScope =
  | 'full'
  | 'blog'
  | 'blog_article'
  | 'split_image'
  | 'home'
  | PlatformPageKey
  | LegalPageKey;

export interface ScopedLocaleBundle extends Partial<LocaleBundle> {
  locale: SupportedLocale;
  __scope?: LocaleBundleScope;
}

const PLATFORM_KEYS: readonly PlatformPageKey[] = [
  'tiktok',
  'instagram',
  'x',
  'facebook',
  'linkedin',
] as const;

const bundleCache = new Map<SupportedLocale, LocaleBundle>([
  ['fr', frBundle],
]);

const fullBundleLocales = new Set<SupportedLocale>(['fr']);
const bundleScopes = new Map<SupportedLocale, LocaleBundleScope>([
  ['fr', 'full'],
]);

/**
 * Separate on-demand cache for long-form legal / trust pages (`src/i18n/legal/{locale}.json`).
 * Keeping legal text out of `src/i18n/locales/*.json` guarantees zero legal bytes in the main
 * JS bundle and zero legal bytes in `window.__VIDNEX_LOCALE_BUNDLE__` on non-legal routes.
 */
const legalCache = new Map<
  SupportedLocale,
  Partial<Record<LegalPageKey, LegalPageContent>>
>();
const fullLegalLocales = new Set<SupportedLocale>();

declare global {
  interface Window {
    __VIDNEX_LOCALE_BUNDLE__?: LocaleBundle | ScopedLocaleBundle;
  }
}

/**
 * Merges a slim page-scoped preloaded bundle with safe structural defaults
 * so SPA transitions to another page type never throw while the full locale chunk loads.
 */
function hydrateScopedBundle(
  raw: LocaleBundle | ScopedLocaleBundle
): LocaleBundle {
  const scope = '__scope' in raw ? raw.__scope : undefined;
  if (!scope || scope === 'full') {
    return raw as LocaleBundle;
  }

  const rawUi = (raw.ui || {}) as Partial<LocaleBundle['ui']>;
  const rawHome = (raw.home || {}) as Partial<LocaleBundle['home']>;
  const rawPlatforms = (raw.platforms || {}) as Partial<
    Record<PlatformPageKey, Partial<LocaleBundle['platforms'][PlatformPageKey]>>
  >;

  const mergedPlatforms = {} as LocaleBundle['platforms'];
  for (const pKey of PLATFORM_KEYS) {
    mergedPlatforms[pKey] = {
      ...frBundle.platforms[pKey],
      ...(rawPlatforms[pKey] || {}),
    } as LocaleBundle['platforms'][PlatformPageKey];
  }

  return {
    locale: raw.locale,
    ui: {
      ...frBundle.ui,
      ...rawUi,
      nav: { ...frBundle.ui.nav, ...(rawUi.nav || {}) },
      omnibox: {
        ...frBundle.ui.omnibox,
        ...(rawUi.omnibox || {}),
        samples: {
          ...frBundle.ui.omnibox.samples,
          ...(rawUi.omnibox?.samples || {}),
        },
      },
      drawer: { ...frBundle.ui.drawer, ...(rawUi.drawer || {}) },
      sections: { ...frBundle.ui.sections, ...(rawUi.sections || {}) },
      footer: { ...frBundle.ui.footer, ...(rawUi.footer || {}) },
      banner: { ...frBundle.ui.banner, ...(rawUi.banner || {}) },
      share: { ...frBundle.ui.share, ...(rawUi.share || {}) },
      notFound: { ...frBundle.ui.notFound, ...(rawUi.notFound || {}) },
      errors: { ...frBundle.ui.errors, ...(rawUi.errors || {}) },
    },
    home: {
      ...frBundle.home,
      ...rawHome,
    },
    platforms: mergedPlatforms,
    ...(raw.legal ? { legal: raw.legal } : {}),
  };
}

function registerWindowPreloadedBundle(): void {
  if (typeof window === 'undefined' || !window.__VIDNEX_LOCALE_BUNDLE__) {
    return;
  }
  const preloaded = window.__VIDNEX_LOCALE_BUNDLE__ as ScopedLocaleBundle;
  if (!preloaded || !preloaded.locale) {
    return;
  }

  // Always hydrate any pre-rendered legal doc (including for 'fr' whose main bundle excludes legal)
  if (preloaded.legal && typeof preloaded.legal === 'object') {
    const existingLegal = legalCache.get(preloaded.locale) || {};
    legalCache.set(preloaded.locale, {
      ...existingLegal,
      ...preloaded.legal,
    });
  }

  if (fullBundleLocales.has(preloaded.locale)) {
    return;
  }
  const scope: LocaleBundleScope = preloaded.__scope || 'full';
  const existingScope = bundleScopes.get(preloaded.locale);
  if (
    existingScope &&
    existingScope === scope &&
    bundleCache.has(preloaded.locale)
  ) {
    return;
  }
  const hydrated = hydrateScopedBundle(preloaded);
  bundleCache.set(preloaded.locale, hydrated);
  bundleScopes.set(preloaded.locale, scope);
  if (scope === 'full') {
    fullBundleLocales.add(preloaded.locale);
  }
}

// Hydrate pre-injected locale bundle from static pre-rendered HTML if available
registerWindowPreloadedBundle();

/**
 * In Node.js environments (SSR / unit tests), we can read legal JSON files from disk
 * via Node's built-in process.getBuiltinModule without bundling them into the client entry.
 */
function tryLoadNodeLegalJson(
  locale: SupportedLocale
): LegalLocaleBundle | null {
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
        'legal',
        `${locale}.json`
      );
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(
          fs.readFileSync(filePath, 'utf8')
        ) as LegalLocaleBundle;
        legalCache.set(locale, parsed);
        fullLegalLocales.add(locale);
        return parsed;
      }
    }
  } catch {
    // Ignore in browser/edge environments
  }
  return null;
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
        fullBundleLocales.add(locale);
        bundleScopes.set(locale, 'full');
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
    fullBundleLocales.add(bundle.locale);
    bundleScopes.set(bundle.locale, 'full');
    if (bundle.legal) {
      legalCache.set(bundle.locale, {
        ...(legalCache.get(bundle.locale) || {}),
        ...bundle.legal,
      });
    }
  }
}

/**
 * Used by the static pre-render script (SSR) or unit tests to register a legal bundle synchronously.
 */
export function registerPreloadedLegalBundle(
  locale: SupportedLocale,
  legal: LegalLocaleBundle
): void {
  if (locale && legal) {
    legalCache.set(locale, legal);
    fullLegalLocales.add(locale);
  }
}

export function hasLegalDocSync(
  locale: SupportedLocale,
  legalKey: LegalPageKey
): boolean {
  registerWindowPreloadedBundle();
  const cached = legalCache.get(locale);
  if (cached && cached[legalKey]) {
    return true;
  }
  const bundle = bundleCache.get(locale);
  return Boolean(bundle?.legal?.[legalKey]);
}

/**
 * Returns the requested legal page document synchronously if already preloaded or cached
 * (auto-loading from disk in Node.js SSR / unit tests). Returns null in the browser while
 * the lazy legal chunk is still loading.
 */
export function getLegalDocSync(
  locale: SupportedLocale,
  legalKey: LegalPageKey
): LegalPageContent | null {
  registerWindowPreloadedBundle();
  const cached = legalCache.get(locale)?.[legalKey];
  if (cached) {
    return cached;
  }
  const fromBundle = bundleCache.get(locale)?.legal?.[legalKey];
  if (fromBundle) {
    return fromBundle;
  }
  const nodeLegal = tryLoadNodeLegalJson(locale);
  if (nodeLegal && nodeLegal[legalKey]) {
    return nodeLegal[legalKey];
  }
  return null;
}

/**
 * Dynamically imports only the requested language's legal JSON chunk (Vite code-splitting per language).
 * Only called when visiting a legal route (`about`, `privacy`, `terms`, `contact`, `dmca`).
 */
export async function loadLegalBundle(
  locale: SupportedLocale
): Promise<LegalLocaleBundle> {
  if (fullLegalLocales.has(locale) && legalCache.has(locale)) {
    return legalCache.get(locale) as LegalLocaleBundle;
  }

  const nodeLoaded = tryLoadNodeLegalJson(locale);
  if (nodeLoaded) {
    return nodeLoaded;
  }

  let mod: { default: unknown };
  switch (locale) {
    case 'fr':
      mod = await import('./legal/fr.json');
      break;
    case 'en':
      mod = await import('./legal/en.json');
      break;
    case 'ar':
      mod = await import('./legal/ar.json');
      break;
    case 'es':
      mod = await import('./legal/es.json');
      break;
    case 'pt':
      mod = await import('./legal/pt.json');
      break;
    case 'de':
      mod = await import('./legal/de.json');
      break;
    case 'tr':
      mod = await import('./legal/tr.json');
      break;
    case 'id':
      mod = await import('./legal/id.json');
      break;
    case 'it':
      mod = await import('./legal/it.json');
      break;
    case 'ru':
      mod = await import('./legal/ru.json');
      break;
    default:
      mod = await import('./legal/en.json');
      break;
  }

  const legal = mod.default as LegalLocaleBundle;
  legalCache.set(locale, legal);
  fullLegalLocales.add(locale);
  return legal;
}

/**
 * Builds a minimal, page-scoped LocaleBundle payload for inline HTML injection
 * (`window.__VIDNEX_LOCALE_BUNDLE__`) so each pre-rendered page only ships the
 * strings it actually renders (cutting ~95% of inline JSON on blog/legal/tool pages,
 * and NEVER shipping legal text on non-legal pages).
 */
export function buildScopedLocaleBundle(
  bundle: LocaleBundle,
  pageKey: PageKey | 'blog_article' | 'admin' | 'not_found'
): ScopedLocaleBundle {
  const minimalNav = {
    languageLabel: bundle.ui.nav.languageLabel,
    switchToDark: bundle.ui.nav.switchToDark,
    switchToLight: bundle.ui.nav.switchToLight,
  };

  const minimalPlatforms: Record<
    PlatformPageKey,
    { shortLabel: string; h1: string }
  > = {
    tiktok: {
      shortLabel: bundle.platforms.tiktok.shortLabel,
      h1: bundle.platforms.tiktok.h1,
    },
    instagram: {
      shortLabel: bundle.platforms.instagram.shortLabel,
      h1: bundle.platforms.instagram.h1,
    },
    x: {
      shortLabel: bundle.platforms.x.shortLabel,
      h1: bundle.platforms.x.h1,
    },
    facebook: {
      shortLabel: bundle.platforms.facebook.shortLabel,
      h1: bundle.platforms.facebook.h1,
    },
    linkedin: {
      shortLabel: bundle.platforms.linkedin.shortLabel,
      h1: bundle.platforms.linkedin.h1,
    },
  };

  if (pageKey === 'blog' || pageKey === 'blog_article') {
    return {
      locale: bundle.locale,
      __scope: pageKey,
      ui: {
        nav: minimalNav,
        sections: {
          breadcrumbHome: bundle.ui.sections.breadcrumbHome,
        },
        footer: bundle.ui.footer,
        errors: {
          MAINTENANCE: bundle.ui.errors.MAINTENANCE,
        },
      } as unknown as LocaleBundle['ui'],
      home: {
        subtitle: bundle.home.subtitle,
        specs: bundle.home.specs,
        ogImageAlt: bundle.home.ogImageAlt,
      } as unknown as LocaleBundle['home'],
      platforms: minimalPlatforms as unknown as LocaleBundle['platforms'],
    };
  }

  if (pageKey === 'split_image') {
    return {
      locale: bundle.locale,
      __scope: 'split_image',
      ui: {
        nav: minimalNav,
        sections: {
          breadcrumbHome: bundle.ui.sections.breadcrumbHome,
          workflowProtocol: bundle.ui.sections.workflowProtocol,
          howToHeading: bundle.ui.sections.howToHeading,
          readyStatus: bundle.ui.sections.readyStatus,
          knowledgeBase: bundle.ui.sections.knowledgeBase,
          faqHeading: bundle.ui.sections.faqHeading,
          platformsHeading: bundle.ui.sections.platformsHeading,
        },
        footer: bundle.ui.footer,
        errors: {
          MAINTENANCE: bundle.ui.errors.MAINTENANCE,
        },
      } as unknown as LocaleBundle['ui'],
      home: {
        specs: bundle.home.specs,
        ogImageAlt: bundle.home.ogImageAlt,
      } as unknown as LocaleBundle['home'],
      platforms: minimalPlatforms as unknown as LocaleBundle['platforms'],
    };
  }

  if (isLegalPageKey(pageKey)) {
    const legalEntry =
      getLegalDocSync(bundle.locale, pageKey) || bundle.legal?.[pageKey];
    return {
      locale: bundle.locale,
      __scope: pageKey,
      ui: {
        nav: minimalNav,
        sections: {
          breadcrumbHome: bundle.ui.sections.breadcrumbHome,
        },
        footer: bundle.ui.footer,
        errors: {
          MAINTENANCE: bundle.ui.errors.MAINTENANCE,
        },
      } as unknown as LocaleBundle['ui'],
      home: {
        specs: bundle.home.specs,
        ogImageAlt: bundle.home.ogImageAlt,
      } as unknown as LocaleBundle['home'],
      platforms: minimalPlatforms as unknown as LocaleBundle['platforms'],
      ...(legalEntry
        ? {
            legal: {
              [pageKey]: legalEntry,
            } as unknown as LocaleBundle['legal'],
          }
        : {}),
    };
  }

  if (
    pageKey === 'home' ||
    pageKey === 'tiktok' ||
    pageKey === 'instagram' ||
    pageKey === 'x' ||
    pageKey === 'facebook' ||
    pageKey === 'linkedin'
  ) {
    const platformsSummary = {} as Record<string, unknown>;
    for (const pKey of PLATFORM_KEYS) {
      if (pageKey === pKey) {
        platformsSummary[pKey] = bundle.platforms[pKey];
      } else {
        platformsSummary[pKey] = {
          slug: bundle.platforms[pKey].slug,
          shortLabel: bundle.platforms[pKey].shortLabel,
          breadcrumbLabel: bundle.platforms[pKey].breadcrumbLabel,
          h1: bundle.platforms[pKey].h1,
          subtitle: bundle.platforms[pKey].subtitle,
        };
      }
    }

    return {
      locale: bundle.locale,
      __scope: pageKey,
      ui: bundle.ui,
      home:
        pageKey === 'home'
          ? bundle.home
          : ({
              specs: bundle.home.specs,
              ogImageAlt: bundle.home.ogImageAlt,
            } as unknown as LocaleBundle['home']),
      platforms: platformsSummary as unknown as LocaleBundle['platforms'],
    };
  }

  const { legal: _omittedLegal, ...withoutLegal } = bundle;
  void _omittedLegal;
  return {
    ...withoutLegal,
    __scope: 'full',
  };
}

export function hasLocaleBundleSync(locale: SupportedLocale): boolean {
  registerWindowPreloadedBundle();
  return bundleCache.has(locale);
}

/**
 * Checks whether the locale strings (and legal page document, if applicable) required
 * for a specific page are already synchronously loaded.
 */
export function hasLocaleBundleForPageSync(
  locale: SupportedLocale,
  pageKey: PageKey | 'blog_article' | 'admin' | 'not_found'
): boolean {
  registerWindowPreloadedBundle();
  const hasUiForPage = (() => {
    if (fullBundleLocales.has(locale)) {
      return true;
    }
    const scope = bundleScopes.get(locale);
    if (!scope || !bundleCache.has(locale)) {
      return false;
    }
    if (scope === 'full') {
      return true;
    }
    if (
      (scope === 'blog' || scope === 'blog_article') &&
      (pageKey === 'blog' || pageKey === 'blog_article')
    ) {
      return true;
    }
    return scope === pageKey;
  })();

  if (!hasUiForPage) {
    return false;
  }

  if (isLegalPageKey(pageKey)) {
    return hasLegalDocSync(locale, pageKey);
  }

  return true;
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
  if (fullBundleLocales.has(locale) && bundleCache.has(locale)) {
    return bundleCache.get(locale)!;
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
  fullBundleLocales.add(locale);
  bundleScopes.set(locale, 'full');
  return bundle;
}
