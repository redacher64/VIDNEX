import {
  ENABLE_ADS,
  ADSENSE_CLIENT_ID,
  IS_ADSENSE_CONFIGURED,
} from '../config/appConfig';
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
};

let currentPublicConfig: PublicConfig = { ...DEFAULT_PUBLIC_CONFIG };
const listeners = new Set<(config: PublicConfig) => void>();

export function getPublicConfigSnapshot(): PublicConfig {
  return currentPublicConfig;
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
      };
      setRuntimePlatformStates(currentPublicConfig.platforms);
      notifyListeners();
    }
  } catch {
    // Non-blocking fallback
  }
  return currentPublicConfig;
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
