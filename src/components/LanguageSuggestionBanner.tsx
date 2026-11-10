import React, { useEffect, useState } from 'react';
import {
  getLocalizedPagePath,
  isSupportedLocale,
  LOCALES_CONFIG,
  type PageKey,
  type SupportedLocale,
} from '../i18n/config.ts';
import { loadLocaleBundle } from '../i18n/localeLoader.ts';
import type { LocaleBundle } from '../i18n/types.ts';

const DISMISS_STORAGE_KEY = 'vidnex_lang_banner_dismissed';

interface LanguageSuggestionBannerProps {
  currentLocale: SupportedLocale;
  pageKey: PageKey;
  onSelectLocale: (locale: SupportedLocale) => void;
}

/**
 * Client-only language suggestion banner (ÉTAPE 4):
 * - NEVER rendered during static pre-rendering (SSR), so Googlebot never sees it.
 * - NEVER performs automatic redirect based on IP or Accept-Language.
 * - Detects browser language on mount; if different from currentLocale and not dismissed in localStorage,
 *   offers a discreet link to the equivalent page in the user's browser language.
 */
export const LanguageSuggestionBanner: React.FC<
  LanguageSuggestionBannerProps
> = ({ currentLocale, pageKey, onSelectLocale }) => {
  const [suggestedLocale, setSuggestedLocale] =
    useState<SupportedLocale | null>(null);
  const [suggestedBundle, setSuggestedBundle] = useState<LocaleBundle | null>(
    null
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const dismissed = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (dismissed === '1') return;

      const userSaved = localStorage.getItem('vidnex_lang');
      if (userSaved && isSupportedLocale(userSaved)) {
        // User already explicitly chose a language
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
        loadLocaleBundle(matched)
          .then((b) => setSuggestedBundle(b))
          .catch(() => {});
      } else {
        setSuggestedLocale(null);
        setSuggestedBundle(null);
      }
    } catch {
      // Ignore storage access errors in strict privacy mode
    }
  }, [currentLocale]);

  if (
    !suggestedLocale ||
    !suggestedBundle ||
    suggestedBundle.locale !== suggestedLocale
  ) {
    return null;
  }

  const targetMeta = LOCALES_CONFIG[suggestedLocale];
  const targetHref = getLocalizedPagePath(suggestedLocale, pageKey);
  const bannerText = suggestedBundle.ui.banner;

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
      className="relative z-40 w-full bg-orange-100/90 dark:bg-[#231710] border-b border-orange-200/80 dark:border-orange-900/60 px-4 py-2 text-xs text-[#1f130b] dark:text-[#fffaf5]"
    >
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-[#6c4e40] dark:text-orange-200/85">
            {bannerText.suggestText}
          </span>
          <a
            href={targetHref}
            onClick={(e) => {
              e.preventDefault();
              onSelectLocale(suggestedLocale);
              setSuggestedLocale(null);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold transition-colors shadow-sm"
          >
            <span>{bannerText.switchCta}</span>
            <span className="font-mono text-[10px] opacity-85">
              ({targetMeta.nativeName})
            </span>
          </a>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label={bannerText.dismissAria}
          className="px-2 py-1 rounded-lg text-[#6c4e40] dark:text-orange-200/75 hover:bg-orange-200/60 dark:hover:bg-orange-950/60 font-mono text-xs font-bold transition-colors"
        >
          ×
        </button>
      </div>
    </div>
  );
};
