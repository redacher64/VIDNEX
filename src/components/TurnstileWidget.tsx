import React, { useEffect, useRef } from 'react';

interface TurnstileInstance {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      theme?: 'light' | 'dark' | 'auto';
      callback?: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
    }
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileInstance;
  }
}

const TURNSTILE_SCRIPT_ID = 'vidnex-cf-turnstile-script';
const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function ensureTurnstileScriptLoaded(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve();
  }
  if (window.turnstile) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const existing = document.getElementById(
      TURNSTILE_SCRIPT_ID
    ) as HTMLScriptElement | null;
    if (existing) {
      if (window.turnstile) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => resolve(), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => resolve(), { once: true });
    document.head.appendChild(script);
  });
}

interface TurnstileWidgetProps {
  siteKey: string;
  action: string;
  theme?: 'light' | 'dark' | 'auto';
  resetKey?: number;
  onTokenChange: (token: string | null) => void;
  className?: string;
}

export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  siteKey,
  action,
  theme = 'auto',
  resetKey = 0,
  onTokenChange,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  onTokenChangeRef.current = onTokenChange;

  useEffect(() => {
    const cleanKey = (siteKey || '').trim();
    if (!cleanKey || typeof window === 'undefined') {
      onTokenChangeRef.current(null);
      return;
    }

    let cancelled = false;

    ensureTurnstileScriptLoaded().then(() => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      try {
        if (widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: cleanKey,
          action,
          theme,
          callback: (token: string) => {
            onTokenChangeRef.current(token || null);
          },
          'expired-callback': () => {
            onTokenChangeRef.current(null);
          },
          'error-callback': () => {
            onTokenChangeRef.current(null);
          },
        });
      } catch {
        onTokenChangeRef.current(null);
      }
    });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Ignore
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, action, theme]);

  useEffect(() => {
    if (resetKey <= 0) return;
    onTokenChangeRef.current(null);
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {
        // Ignore
      }
    }
  }, [resetKey]);

  if (!(siteKey || '').trim()) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      data-turnstile-action={action}
      className={`min-h-[65px] flex items-center justify-center ${className}`}
    />
  );
};
