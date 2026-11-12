import React, { useEffect, useState } from 'react';
import {
  getLocalizedPagePath,
  isSupportedLocale,
  LOCALES_CONFIG,
  type PageKey,
  type SupportedLocale,
} from '../i18n/config.ts';

const DISMISS_STORAGE_KEY = 'vidnex_lang_banner_dismissed';

const BANNER_COPY: Record<
  SupportedLocale,
  { suggestText: string; switchCta: string; dismissAria: string }
> = {
  fr: {
    suggestText:
      'Cette page est également disponible dans la langue de votre navigateur :',
    switchCta: 'Afficher en Français',
    dismissAria: 'Fermer la suggestion de langue',
  },
  en: {
    suggestText: 'This page is also available in your browser language:',
    switchCta: 'Switch to English',
    dismissAria: 'Dismiss language suggestion',
  },
  ar: {
    suggestText: 'هذا الموقع متوفر أيضاً بلغتك:',
    switchCta: 'التبديل إلى العربية',
    dismissAria: 'إغلاق',
  },
  es: {
    suggestText: 'Este sitio también está disponible en tu idioma:',
    switchCta: 'Cambiar a Español',
    dismissAria: 'Cerrar',
  },
  pt: {
    suggestText: 'Este site também está disponível no seu idioma:',
    switchCta: 'Mudar para Português',
    dismissAria: 'Fechar',
  },
  de: {
    suggestText: 'Diese Website ist auch in Ihrer Sprache verfügbar:',
    switchCta: 'Zu Deutsch wechseln',
    dismissAria: 'Schließen',
  },
  tr: {
    suggestText: 'Bu site kendi dilinizde de kullanılabilir:',
    switchCta: 'Türkçe diline geç',
    dismissAria: 'Kapat',
  },
  id: {
    suggestText: 'Situs ini juga tersedia dalam bahasa Anda:',
    switchCta: 'Beralih ke Bahasa Indonesia',
    dismissAria: 'Tutup',
  },
  it: {
    suggestText: 'Questo sito è disponibile anche nella tua lingua:',
    switchCta: 'Passa a Italiano',
    dismissAria: 'Chiudi',
  },
  ru: {
    suggestText: 'Этот сайт также доступен на вашем языке:',
    switchCta: 'Переключить на Русский',
    dismissAria: 'Закрыть',
  },
};

interface LanguageSuggestionBannerProps {
  currentLocale: SupportedLocale;
  pageKey: PageKey;
  onSelectLocale: (locale: SupportedLocale) => void;
}

/**
 * Client-only language suggestion banner:
 * - Never rendered during static pre-rendering (SSR).
 * - Uses an embedded 10-language lookup table so it never fetches another locale's JS chunk (e.g., en.js on FR pages).
 * - Appears only after window load as a fixed bottom overlay with safe-area padding, causing zero layout shift (CLS = 0).
 */
export const LanguageSuggestionBanner: React.FC<
  LanguageSuggestionBannerProps
> = ({ currentLocale, pageKey, onSelectLocale }) => {
  const [suggestedLocale, setSuggestedLocale] =
    useState<SupportedLocale | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const evaluateLanguageSuggestion = () => {
      try {
        const dismissed = localStorage.getItem(DISMISS_STORAGE_KEY);
        if (dismissed === '1') return;

        const userSaved = localStorage.getItem('vidnex_lang');
        if (userSaved && isSupportedLocale(userSaved)) {
          return;
        }

        const rawLangs =
          navigator.languages && navigator.languages.length > 0
            ? navigator.languages
            : [navigator.language || ''];

        let matched: SupportedLocale | null = null;
        for (const raw of rawLangs) {
          const primary = raw.split('-')[0].toLowerCase();
          if (isSupportedLocale(primary)) {
            matched = primary;
            break;
          }
        }

        if (matched && matched !== currentLocale) {
          setSuggestedLocale(matched);
        } else {
          setSuggestedLocale(null);
        }
      } catch {
        // Ignore storage access errors in strict privacy mode
      }
    };

    if (document.readyState === 'complete') {
      evaluateLanguageSuggestion();
      return;
    }

    window.addEventListener('load', evaluateLanguageSuggestion, { once: true });
    return () => {
      window.removeEventListener('load', evaluateLanguageSuggestion);
    };
  }, [currentLocale]);

  if (!suggestedLocale) {
    return null;
  }

  const targetMeta = LOCALES_CONFIG[suggestedLocale];
  const targetHref = getLocalizedPagePath(suggestedLocale, pageKey);
  const bannerText = BANNER_COPY[suggestedLocale];

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    setSuggestedLocale(null);
  };

  return (
    <div
      role="region"
      aria-label="Language suggestion"
      dir={targetMeta.dir}
      className="fixed bottom-0 inset-x-0 z-50 pointer-events-none px-3 sm:px-6 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
    >
      <div className="pointer-events-auto max-w-xl mx-auto rounded-2xl bg-[#1f130b]/95 dark:bg-[#231710]/95 backdrop-blur-md border border-orange-500/40 shadow-2xl px-4 py-2.5 text-xs text-[#fffaf5] flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span className="font-medium text-orange-100">
            {bannerText.suggestText}
          </span>
          <a
            href={targetHref}
            onClick={(e) => {
              e.preventDefault();
              onSelectLocale(suggestedLocale);
              setSuggestedLocale(null);
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-orange-700 hover:bg-orange-800 text-white font-semibold transition-colors shadow-sm whitespace-nowrap"
          >
            <span>{bannerText.switchCta}</span>
            <span className="font-mono text-[10px] text-white">
              ({targetMeta.nativeName})
            </span>
          </a>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label={bannerText.dismissAria}
          className="shrink-0 w-11 h-11 min-w-[44px] min-h-[44px] -my-1 -me-1 flex items-center justify-center rounded-xl text-orange-200 hover:bg-orange-900/60 hover:text-white font-mono text-base font-bold transition-colors cursor-pointer"
        >
          ×
        </button>
      </div>
    </div>
  );
};

