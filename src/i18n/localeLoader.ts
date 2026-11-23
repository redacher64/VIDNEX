import {
  isLegalPageKey,
  isToolPageKey,
  type LegalPageKey,
  type PageKey,
  type PlatformPageKey,
  type SupportedLocale,
  type ToolPageKey,
} from './config.ts';
import type {
  LegalPageContent,
  LocaleBundle,
  ToolPageContent,
} from './types.ts';
import frBundleJson from './locales/fr.json' with { type: 'json' };

const frBundle = frBundleJson as unknown as LocaleBundle;

export type LegalLocaleBundle = Record<LegalPageKey, LegalPageContent>;

export type LocaleBundleScope =
  | 'full'
  | 'blog'
  | 'blog_article'
  | 'tools_hub'
  | 'split_image'
  | 'video_to_mp3'
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

/**
 * Separate on-demand cache for per-tool long-form SEO content (`src/i18n/tools/{locale}/{toolKey}.json`).
 * Each of the 70 pages (home + 5 platforms + split_image across 10 locales) is code-split into its own
 * lazy chunk so `window.__VIDNEX_LOCALE_BUNDLE__` and the initial JS load NEVER ship other tools' text.
 */
const toolContentCache = new Map<
  SupportedLocale,
  Partial<Record<ToolPageKey, ToolPageContent>>
>();

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
    ...(raw.toolContent ? { toolContent: raw.toolContent } : {}),
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

  // Always hydrate any pre-rendered single-tool doc (including for 'fr')
  if (preloaded.toolContent && typeof preloaded.toolContent === 'object') {
    const existingTools = toolContentCache.get(preloaded.locale) || {};
    toolContentCache.set(preloaded.locale, {
      ...existingTools,
      ...preloaded.toolContent,
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
 * In Node.js environments (SSR / unit tests), read a single per-tool JSON file from disk
 * (`src/i18n/tools/{locale}/{toolKey}.json`) without bundling it into the main client entry.
 */
function tryLoadNodeToolJson(
  locale: SupportedLocale,
  toolKey: ToolPageKey
): ToolPageContent | null {
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
        'tools',
        locale,
        `${toolKey}.json`
      );
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(
          fs.readFileSync(filePath, 'utf8')
        ) as ToolPageContent;
        const existing = toolContentCache.get(locale) || {};
        toolContentCache.set(locale, { ...existing, [toolKey]: parsed });
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
    if (bundle.toolContent) {
      toolContentCache.set(bundle.locale, {
        ...(toolContentCache.get(bundle.locale) || {}),
        ...bundle.toolContent,
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

/**
 * Used by the static pre-render script (SSR) or unit tests to register a single tool page's content synchronously.
 */
export function registerPreloadedToolContent(
  locale: SupportedLocale,
  toolKey: ToolPageKey,
  content: ToolPageContent
): void {
  if (locale && toolKey && content) {
    const existing = toolContentCache.get(locale) || {};
    toolContentCache.set(locale, { ...existing, [toolKey]: content });
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

export function hasToolContentSync(
  locale: SupportedLocale,
  toolKey: ToolPageKey
): boolean {
  registerWindowPreloadedBundle();
  const cached = toolContentCache.get(locale);
  if (cached && cached[toolKey]) {
    return true;
  }
  const bundle = bundleCache.get(locale);
  return Boolean(bundle?.toolContent?.[toolKey]);
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
 * Returns the requested per-tool content document synchronously if already preloaded or cached
 * (auto-loading from disk in Node.js SSR / unit tests). Returns null in the browser while
 * the lazy tool chunk is still loading.
 */
export function getToolContentSync(
  locale: SupportedLocale,
  toolKey: ToolPageKey
): ToolPageContent | null {
  registerWindowPreloadedBundle();
  const cached = toolContentCache.get(locale)?.[toolKey];
  if (cached) {
    return cached;
  }
  const fromBundle = bundleCache.get(locale)?.toolContent?.[toolKey];
  if (fromBundle) {
    return fromBundle;
  }
  const nodeTool = tryLoadNodeToolJson(locale, toolKey);
  if (nodeTool) {
    return nodeTool;
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
 * Static map of dynamic importers for all 70 per-tool JSON chunks (10 locales × 7 tool/home pages).
 * Guarantees Vite emits 70 tiny independent chunks and loads ONLY the active page's chunk on demand.
 */
const TOOL_CONTENT_IMPORTERS: Record<
  `${SupportedLocale}:${ToolPageKey}`,
  () => Promise<{ default: unknown }>
> = {
  'fr:home': () => import('./tools/fr/home.json'),
  'fr:tiktok': () => import('./tools/fr/tiktok.json'),
  'fr:instagram': () => import('./tools/fr/instagram.json'),
  'fr:x': () => import('./tools/fr/x.json'),
  'fr:facebook': () => import('./tools/fr/facebook.json'),
  'fr:linkedin': () => import('./tools/fr/linkedin.json'),
  'fr:split_image': () => import('./tools/fr/split_image.json'),
  'fr:video_to_mp3': () => import('./tools/fr/video_to_mp3.json'),

  'en:home': () => import('./tools/en/home.json'),
  'en:tiktok': () => import('./tools/en/tiktok.json'),
  'en:instagram': () => import('./tools/en/instagram.json'),
  'en:x': () => import('./tools/en/x.json'),
  'en:facebook': () => import('./tools/en/facebook.json'),
  'en:linkedin': () => import('./tools/en/linkedin.json'),
  'en:split_image': () => import('./tools/en/split_image.json'),
  'en:video_to_mp3': () => import('./tools/en/video_to_mp3.json'),

  'es:home': () => import('./tools/es/home.json'),
  'es:tiktok': () => import('./tools/es/tiktok.json'),
  'es:instagram': () => import('./tools/es/instagram.json'),
  'es:x': () => import('./tools/es/x.json'),
  'es:facebook': () => import('./tools/es/facebook.json'),
  'es:linkedin': () => import('./tools/es/linkedin.json'),
  'es:split_image': () => import('./tools/es/split_image.json'),
  'es:video_to_mp3': () => import('./tools/es/video_to_mp3.json'),

  'pt:home': () => import('./tools/pt/home.json'),
  'pt:tiktok': () => import('./tools/pt/tiktok.json'),
  'pt:instagram': () => import('./tools/pt/instagram.json'),
  'pt:x': () => import('./tools/pt/x.json'),
  'pt:facebook': () => import('./tools/pt/facebook.json'),
  'pt:linkedin': () => import('./tools/pt/linkedin.json'),
  'pt:split_image': () => import('./tools/pt/split_image.json'),
  'pt:video_to_mp3': () => import('./tools/pt/video_to_mp3.json'),

  'de:home': () => import('./tools/de/home.json'),
  'de:tiktok': () => import('./tools/de/tiktok.json'),
  'de:instagram': () => import('./tools/de/instagram.json'),
  'de:x': () => import('./tools/de/x.json'),
  'de:facebook': () => import('./tools/de/facebook.json'),
  'de:linkedin': () => import('./tools/de/linkedin.json'),
  'de:split_image': () => import('./tools/de/split_image.json'),
  'de:video_to_mp3': () => import('./tools/de/video_to_mp3.json'),

  'tr:home': () => import('./tools/tr/home.json'),
  'tr:tiktok': () => import('./tools/tr/tiktok.json'),
  'tr:instagram': () => import('./tools/tr/instagram.json'),
  'tr:x': () => import('./tools/tr/x.json'),
  'tr:facebook': () => import('./tools/tr/facebook.json'),
  'tr:linkedin': () => import('./tools/tr/linkedin.json'),
  'tr:split_image': () => import('./tools/tr/split_image.json'),
  'tr:video_to_mp3': () => import('./tools/tr/video_to_mp3.json'),

  'id:home': () => import('./tools/id/home.json'),
  'id:tiktok': () => import('./tools/id/tiktok.json'),
  'id:instagram': () => import('./tools/id/instagram.json'),
  'id:x': () => import('./tools/id/x.json'),
  'id:facebook': () => import('./tools/id/facebook.json'),
  'id:linkedin': () => import('./tools/id/linkedin.json'),
  'id:split_image': () => import('./tools/id/split_image.json'),
  'id:video_to_mp3': () => import('./tools/id/video_to_mp3.json'),

  'it:home': () => import('./tools/it/home.json'),
  'it:tiktok': () => import('./tools/it/tiktok.json'),
  'it:instagram': () => import('./tools/it/instagram.json'),
  'it:x': () => import('./tools/it/x.json'),
  'it:facebook': () => import('./tools/it/facebook.json'),
  'it:linkedin': () => import('./tools/it/linkedin.json'),
  'it:split_image': () => import('./tools/it/split_image.json'),
  'it:video_to_mp3': () => import('./tools/it/video_to_mp3.json'),

  'ru:home': () => import('./tools/ru/home.json'),
  'ru:tiktok': () => import('./tools/ru/tiktok.json'),
  'ru:instagram': () => import('./tools/ru/instagram.json'),
  'ru:x': () => import('./tools/ru/x.json'),
  'ru:facebook': () => import('./tools/ru/facebook.json'),
  'ru:linkedin': () => import('./tools/ru/linkedin.json'),
  'ru:split_image': () => import('./tools/ru/split_image.json'),
  'ru:video_to_mp3': () => import('./tools/ru/video_to_mp3.json'),

  'ar:home': () => import('./tools/ar/home.json'),
  'ar:tiktok': () => import('./tools/ar/tiktok.json'),
  'ar:instagram': () => import('./tools/ar/instagram.json'),
  'ar:x': () => import('./tools/ar/x.json'),
  'ar:facebook': () => import('./tools/ar/facebook.json'),
  'ar:linkedin': () => import('./tools/ar/linkedin.json'),
  'ar:split_image': () => import('./tools/ar/split_image.json'),
  'ar:video_to_mp3': () => import('./tools/ar/video_to_mp3.json'),
};

/**
 * Dynamically imports ONLY the requested `(locale, toolKey)` JSON chunk on demand.
 */
export async function loadToolContent(
  locale: SupportedLocale,
  toolKey: ToolPageKey
): Promise<ToolPageContent> {
  const existing = toolContentCache.get(locale)?.[toolKey];
  if (existing) {
    return existing;
  }

  const nodeLoaded = tryLoadNodeToolJson(locale, toolKey);
  if (nodeLoaded) {
    return nodeLoaded;
  }

  const loader =
    TOOL_CONTENT_IMPORTERS[`${locale}:${toolKey}`] ||
    TOOL_CONTENT_IMPORTERS[`en:${toolKey}`];
  const mod = await loader();
  const content = mod.default as ToolPageContent;
  registerPreloadedToolContent(locale, toolKey, content);
  return content;
}

/**
 * Strips heavy editorial/howToSteps/faqs fields from a platform or home metadata object
 * so `window.__VIDNEX_LOCALE_BUNDLE__` never leaks long-form content outside `toolContent[activePageKey]`.
 */
function stripLongFormFields<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const {
    editorial: _editorial,
    howToSteps: _howToSteps,
    faqs: _faqs,
    ...rest
  } = obj;
  void _editorial;
  void _howToSteps;
  void _faqs;
  return rest as Partial<T>;
}

/**
 * Builds a minimal, page-scoped LocaleBundle payload for inline HTML injection
 * (`window.__VIDNEX_LOCALE_BUNDLE__`) so each pre-rendered page only ships the
 * strings it actually renders:
 * - Tool/home routes embed ONLY `toolContent: { [pageKey]: doc }` and ZERO other tools' long-form text.
 * - Legal routes embed ONLY `legal: { [pageKey]: doc }` and ZERO toolContent.
 * - Blog routes embed ZERO legal and ZERO toolContent.
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

  if (pageKey === 'tools_hub') {
    const hubPlatforms = {} as Record<string, unknown>;
    for (const pKey of PLATFORM_KEYS) {
      hubPlatforms[pKey] = {
        slug: bundle.platforms[pKey].slug,
        shortLabel: bundle.platforms[pKey].shortLabel,
        breadcrumbLabel: bundle.platforms[pKey].breadcrumbLabel,
        h1: bundle.platforms[pKey].h1,
        subtitle: bundle.platforms[pKey].subtitle,
      };
    }
    return {
      locale: bundle.locale,
      __scope: 'tools_hub',
      ui: {
        nav: minimalNav,
        sections: {
          breadcrumbHome: bundle.ui.sections.breadcrumbHome,
          platformsHeading: bundle.ui.sections.platformsHeading,
          openToolCta: bundle.ui.sections.openToolCta,
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
      platforms: hubPlatforms as unknown as LocaleBundle['platforms'],
    };
  }

  if (pageKey === 'split_image' || pageKey === 'video_to_mp3') {
    const activeToolDoc = getToolContentSync(bundle.locale, pageKey);
    return {
      locale: bundle.locale,
      __scope: pageKey,
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
          openToolCta: bundle.ui.sections.openToolCta,
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
      ...(activeToolDoc
        ? {
            toolContent: {
              [pageKey]: activeToolDoc,
            },
          }
        : {}),
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
    const activeToolDoc = getToolContentSync(bundle.locale, pageKey);
    const platformsSummary = {} as Record<string, unknown>;
    for (const pKey of PLATFORM_KEYS) {
      if (pageKey === pKey) {
        platformsSummary[pKey] = stripLongFormFields(
          bundle.platforms[pKey] as unknown as Record<string, unknown>
        );
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
          ? (stripLongFormFields(
              bundle.home as unknown as Record<string, unknown>
            ) as unknown as LocaleBundle['home'])
          : ({
              specs: bundle.home.specs,
              ogImageAlt: bundle.home.ogImageAlt,
            } as unknown as LocaleBundle['home']),
      platforms: platformsSummary as unknown as LocaleBundle['platforms'],
      ...(activeToolDoc
        ? {
            toolContent: {
              [pageKey]: activeToolDoc,
            },
          }
        : {}),
    };
  }

  const {
    legal: _omittedLegal,
    toolContent: _omittedTool,
    ...withoutHeavy
  } = bundle;
  void _omittedLegal;
  void _omittedTool;
  return {
    ...withoutHeavy,
    __scope: 'full',
  };
}

export function hasLocaleBundleSync(locale: SupportedLocale): boolean {
  registerWindowPreloadedBundle();
  return bundleCache.has(locale);
}

/**
 * Checks whether the locale strings (and legal/tool page document, if applicable) required
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

  if (isToolPageKey(pageKey)) {
    return hasToolContentSync(locale, pageKey);
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
