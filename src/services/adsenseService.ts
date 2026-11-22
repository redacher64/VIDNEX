import {
  ENABLE_ADS,
  ADSENSE_CLIENT_ID,
  IS_ADSENSE_CONFIGURED,
} from '../config/appConfig';
import {
  getAdsterraNativeBannerScriptUrl,
  getAdsterraSocialBarScriptUrl,
  isDesktopViewportForSocialBar,
} from '../config/adsterraConfig';
import { setRuntimePlatformStates } from '../utils/urlDetector';

export interface PublicConfig {
  maintenance: boolean;
  platforms: {
    tiktok: boolean;
    instagram: boolean;
    x: boolean;
    facebook: boolean;
    linkedin?: boolean;
  };
  ads_enabled: boolean;
  ads_adsterra_enabled: boolean;
  feature_stories?: boolean;
}

const DEFAULT_PUBLIC_CONFIG: PublicConfig = {
  maintenance: false,
  platforms: {
    tiktok: true,
    instagram: true,
    x: true,
    facebook: true,
    linkedin: true,
  },
  ads_enabled: ENABLE_ADS,
  ads_adsterra_enabled: true,
  feature_stories: false,
};

let currentPublicConfig: PublicConfig = { ...DEFAULT_PUBLIC_CONFIG };
const listeners = new Set<(config: PublicConfig) => void>();

export function getPublicConfigSnapshot(): PublicConfig {
  return currentPublicConfig;
}

export function isAdminRoutePath(pathname?: string): boolean {
  const path =
    typeof pathname === 'string'
      ? pathname
      : typeof window !== 'undefined'
      ? window.location.pathname
      : '';
  return /^\/admin(?:\/|$)/.test(path);
}

export function isAdSenseDemoMode(): boolean {
  return Boolean(
    typeof window !== 'undefined' &&
      import.meta.env?.DEV &&
      import.meta.env?.VITE_ADSENSE_DEMO === 'true'
  );
}

export function isAdSenseEnabled(): boolean {
  return Boolean(
    currentPublicConfig.ads_enabled &&
      ENABLE_ADS &&
      (IS_ADSENSE_CONFIGURED || isAdSenseDemoMode())
  );
}

export function isAdsterraEnabled(pathname?: string): boolean {
  if (isAdminRoutePath(pathname)) {
    return false;
  }
  return Boolean(currentPublicConfig.ads_adsterra_enabled);
}

export function subscribePublicConfig(
  listener: (config: PublicConfig) => void
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(): void {
  for (const l of listeners) {
    l(currentPublicConfig);
  }
}

export async function fetchPublicConfig(): Promise<PublicConfig> {
  try {
    const res = await fetch('/api/public-config', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return currentPublicConfig;
    const data = await res.json();
    if (data && typeof data === 'object') {
      currentPublicConfig = {
        maintenance: Boolean(data.maintenance),
        platforms: {
          tiktok: data.platforms?.tiktok !== false,
          instagram: data.platforms?.instagram !== false,
          x: data.platforms?.x !== false,
          facebook: data.platforms?.facebook !== false,
          linkedin: data.platforms?.linkedin !== false,
        },
        ads_enabled:
          typeof data.ads_enabled === 'boolean' ? data.ads_enabled : ENABLE_ADS,
        ads_adsterra_enabled:
          typeof data.ads_adsterra_enabled === 'boolean'
            ? data.ads_adsterra_enabled
            : true,
        feature_stories: Boolean(data.feature_stories),
      };
      setRuntimePlatformStates(currentPublicConfig.platforms);
      if (!currentPublicConfig.ads_adsterra_enabled && typeof document !== 'undefined') {
        document.getElementById('vidnex-adsterra-social-bar')?.remove();
        document.getElementById('vidnex-adsterra-native-banner')?.remove();
      }
      notifyListeners();
    }
  } catch {
    // Non-blocking fallback
  }
  return currentPublicConfig;
}

let deferredAdReady = false;
let deferredAdScheduled = false;
const deferredCallbacks = new Set<() => void>();

/**
 * Déclenche le chargement des publicités de manière différée
 * au premier scroll / interaction utilisateur OU lorsque le navigateur est idle.
 * Ne s'exécute jamais pendant le prérendu statique / SEO (Node.js).
 */
export function onDeferredAdReady(callback: () => void): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  if (deferredAdReady) {
    callback();
    return () => {};
  }

  deferredCallbacks.add(callback);

  if (!deferredAdScheduled) {
    deferredAdScheduled = true;
    const events = ['scroll', 'pointerdown', 'touchstart', 'keydown'] as const;

    const triggerAll = () => {
      if (deferredAdReady) return;
      deferredAdReady = true;
      events.forEach((evt) =>
        window.removeEventListener(evt, triggerAll, { capture: true })
      );
      for (const cb of deferredCallbacks) {
        try {
          cb();
        } catch {
          // Ignore individual callback errors
        }
      }
      deferredCallbacks.clear();
    };

    events.forEach((evt) =>
      window.addEventListener(evt, triggerAll, {
        once: true,
        passive: true,
        capture: true,
      })
    );

    const ric = (
      window as unknown as {
        requestIdleCallback?: (
          cb: () => void,
          opts?: { timeout: number }
        ) => void;
      }
    ).requestIdleCallback;
    if (typeof ric === 'function') {
      ric(() => triggerAll(), { timeout: 2500 });
    } else {
      setTimeout(triggerAll, 2000);
    }
  }

  return () => {
    deferredCallbacks.delete(callback);
  };
}

const ADSTERRA_SOCIAL_BAR_SCRIPT_ID = 'vidnex-adsterra-social-bar';
const ADSTERRA_NATIVE_BANNER_SCRIPT_ID = 'vidnex-adsterra-native-banner';

export { isDesktopViewportForSocialBar };

function injectAdsterraSocialBarNow(): void {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    !isAdsterraEnabled() ||
    !isDesktopViewportForSocialBar(window) ||
    document.getElementById(ADSTERRA_SOCIAL_BAR_SCRIPT_ID)
  ) {
    return;
  }
  const script = document.createElement('script');
  script.id = ADSTERRA_SOCIAL_BAR_SCRIPT_ID;
  script.type = 'text/javascript';
  script.async = true;
  script.setAttribute('data-cfasync', 'false');
  script.src = getAdsterraSocialBarScriptUrl();
  (document.body || document.head).appendChild(script);
}

/**
 * Injecte le script Adsterra Social Bar une seule fois globalement sur les pages publiques
 * uniquement sur desktop (>= 768px via matchMedia) après le déclenchement différé (idle ou 1er scroll).
 * Jamais chargé sur mobile (< 768px), sur /admin ni en prerender.
 */
export function ensureAdsterraSocialBarLoaded(): () => void {
  if (
    typeof window === 'undefined' ||
    !isAdsterraEnabled() ||
    !isDesktopViewportForSocialBar(window)
  ) {
    return () => {};
  }
  return onDeferredAdReady(() => {
    injectAdsterraSocialBarNow();
  });
}

/**
 * Injecte le script async Adsterra Native Banner une seule fois lorsque le conteneur est présent.
 */
export function ensureAdsterraNativeBannerLoaded(): void {
  if (
    typeof document === 'undefined' ||
    !isAdsterraEnabled() ||
    document.getElementById(ADSTERRA_NATIVE_BANNER_SCRIPT_ID)
  ) {
    return;
  }
  const script = document.createElement('script');
  script.id = ADSTERRA_NATIVE_BANNER_SCRIPT_ID;
  script.async = true;
  script.setAttribute('data-cfasync', 'false');
  script.src = getAdsterraNativeBannerScriptUrl();
  (document.body || document.head).appendChild(script);
}

let adsenseScheduled = false;

function injectAdSenseTagNow(): void {
  const scriptId = 'vidnex-adsense-script';
  if (typeof document === 'undefined' || document.getElementById(scriptId)) {
    return;
  }
  const script = document.createElement('script');
  script.id = scriptId;
  script.async = true;
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
    ADSENSE_CLIENT_ID
  )}`;
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
}

export function ensureAdSenseScriptLoaded(): void {
  if (
    typeof window === 'undefined' ||
    !isAdSenseEnabled() ||
    !IS_ADSENSE_CONFIGURED
  ) {
    return;
  }

  if (adsenseScheduled || document.getElementById('vidnex-adsense-script')) {
    return;
  }
  adsenseScheduled = true;

  const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
  let triggered = false;

  const triggerLoad = () => {
    if (triggered) return;
    triggered = true;
    events.forEach((evt) =>
      window.removeEventListener(evt, triggerLoad, { capture: true })
    );
    injectAdSenseTagNow();
  };

  events.forEach((evt) =>
    window.addEventListener(evt, triggerLoad, {
      once: true,
      passive: true,
      capture: true,
    })
  );

  const ric = (
    window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
    }
  ).requestIdleCallback;
  if (typeof ric === 'function') {
    ric(() => triggerLoad(), { timeout: 3500 });
  } else {
    setTimeout(triggerLoad, 3500);
  }
}
