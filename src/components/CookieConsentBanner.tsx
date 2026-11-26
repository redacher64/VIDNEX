import React, { useEffect, useState } from 'react';
import {
  getLocalizedPagePath,
  LOCALES_CONFIG,
  type PageKey,
  type SupportedLocale,
} from '../i18n/config.ts';
import { isAdminRoutePath } from '../services/adsenseService.ts';
import {
  getCookieConsentCopy,
  getCookieConsentSnapshot,
  saveCookieConsent,
  subscribeCookieConsent,
  subscribeOpenCookiePreferences,
  type CookieConsentState,
} from '../utils/cookieConsent.ts';

interface CookieConsentBannerProps {
  language: SupportedLocale;
  onNavigatePage: (pageKey: PageKey) => void;
}

/**
 * Bandeau de consentement cookies client-only (jamais rendu en prerender ni sur /admin).
 * - 3 actions : Tout accepter, Tout refuser, Personnaliser (Essentiels, Statistiques, Publicité).
 * - Compact en bas d'écran pour ne jamais masquer le champ de téléchargement sur mobile (CLS = 0).
 * - Peut être rouvert à tout moment via le lien « Cookies » du footer.
 */
export const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({
  language,
  onNavigatePage,
}) => {
  const [mounted, setMounted] = useState(false);
  const [consent, setConsent] = useState<CookieConsentState | null>(null);
  const [showCustomize, setShowCustomize] = useState(false);
  const [draftAnalytics, setDraftAnalytics] = useState(false);
  const [draftAdvertising, setDraftAdvertising] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || isAdminRoutePath()) {
      return;
    }
    const existing = getCookieConsentSnapshot();
    setConsent(existing);
    setDraftAnalytics(Boolean(existing?.analytics));
    setDraftAdvertising(Boolean(existing?.advertising));
    setMounted(true);

    const unsubConsent = subscribeCookieConsent((next) => {
      setConsent(next);
      if (next) {
        setDraftAnalytics(next.analytics);
        setDraftAdvertising(next.advertising);
      }
    });

    const unsubOpen = subscribeOpenCookiePreferences(() => {
      const current = getCookieConsentSnapshot();
      setDraftAnalytics(Boolean(current?.analytics));
      setDraftAdvertising(Boolean(current?.advertising));
      setShowCustomize(true);
    });

    return () => {
      unsubConsent();
      unsubOpen();
    };
  }, []);

  useEffect(() => {
    if (!showCustomize || typeof window === 'undefined') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCustomize(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCustomize]);

  // Jamais rendu dans le prerender ni sur /admin
  if (!mounted || typeof window === 'undefined' || isAdminRoutePath()) {
    return null;
  }

  const copy = getCookieConsentCopy(language);
  const dir = (LOCALES_CONFIG[language] || LOCALES_CONFIG.fr).dir;
  const privacyHref = getLocalizedPagePath(language, 'privacy');

  const handleAcceptAll = () => {
    saveCookieConsent({ analytics: true, advertising: true });
    setShowCustomize(false);
  };

  const handleRejectAll = () => {
    saveCookieConsent({ analytics: false, advertising: false });
    setShowCustomize(false);
  };

  const handleSaveCustom = () => {
    saveCookieConsent({
      analytics: draftAnalytics,
      advertising: draftAdvertising,
    });
    setShowCustomize(false);
  };

  const handleOpenCustomize = () => {
    const current = getCookieConsentSnapshot();
    setDraftAnalytics(Boolean(current?.analytics));
    setDraftAdvertising(Boolean(current?.advertising));
    setShowCustomize(true);
  };

  const handlePrivacyClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setShowCustomize(false);
    onNavigatePage('privacy');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Modale de personnalisation (3 catégories)
  if (showCustomize) {
    return (
      <div
        dir={dir}
        data-cookie-modal="true"
        className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowCustomize(false);
          }
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="vidnex-cookie-prefs-title"
          className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1c140e] border border-orange-200/90 dark:border-orange-900/70 shadow-2xl p-4 sm:p-5 text-[#1f130b] dark:text-[#fffaf5] space-y-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="vidnex-cookie-prefs-title"
                className="font-display text-base font-bold text-[#1f130b] dark:text-[#fffaf5]"
              >
                {copy.modalTitle}
              </h2>
              <p className="mt-1 text-xs text-[#6c4e40] dark:text-orange-200/80 leading-relaxed">
                {copy.modalDescription}{' '}
                <a
                  href={privacyHref}
                  onClick={handlePrivacyClick}
                  className="font-semibold text-orange-700 dark:text-amber-400 underline underline-offset-2 hover:text-orange-600"
                >
                  {copy.privacyLinkLabel}
                </a>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCustomize(false)}
              aria-label={copy.closeLabel}
              className="shrink-0 w-9 h-9 rounded-xl border border-orange-200/80 dark:border-orange-900/60 text-[#6c4e40] dark:text-orange-200 hover:bg-orange-50 dark:hover:bg-orange-950/60 flex items-center justify-center font-mono text-base font-bold cursor-pointer"
            >
              ×
            </button>
          </div>

          <div className="space-y-2.5">
            {/* 1. Essentiels (toujours actif) */}
            <div className="p-3 rounded-xl border border-orange-200/70 dark:border-orange-900/50 bg-orange-50/40 dark:bg-[#231710]/70 flex items-start justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-bold text-[#1f130b] dark:text-[#fffaf5]">
                  {copy.categories.essential.title}
                </p>
                <p className="text-[11px] text-[#6c4e40] dark:text-orange-200/75 leading-snug">
                  {copy.categories.essential.description}
                </p>
              </div>
              <span className="shrink-0 text-[10px] font-semibold px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300 whitespace-nowrap">
                {copy.alwaysActive}
              </span>
            </div>

            {/* 2. Statistiques */}
            <div className="p-3 rounded-xl border border-orange-200/70 dark:border-orange-900/50 flex items-start justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-bold text-[#1f130b] dark:text-[#fffaf5]">
                  {copy.categories.analytics.title}
                </p>
                <p className="text-[11px] text-[#6c4e40] dark:text-orange-200/75 leading-snug">
                  {copy.categories.analytics.description}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={draftAnalytics}
                aria-label={copy.categories.analytics.title}
                data-testid="cookie-toggle-analytics"
                onClick={() => setDraftAnalytics((v) => !v)}
                className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  draftAnalytics
                    ? 'bg-orange-600'
                    : 'bg-orange-200/90 dark:bg-orange-950 border border-orange-300 dark:border-orange-800'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                    draftAnalytics
                      ? dir === 'rtl'
                        ? '-translate-x-6'
                        : 'translate-x-6'
                      : dir === 'rtl'
                      ? '-translate-x-1'
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* 3. Publicité */}
            <div className="p-3 rounded-xl border border-orange-200/70 dark:border-orange-900/50 flex items-start justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-bold text-[#1f130b] dark:text-[#fffaf5]">
                  {copy.categories.advertising.title}
                </p>
                <p className="text-[11px] text-[#6c4e40] dark:text-orange-200/75 leading-snug">
                  {copy.categories.advertising.description}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={draftAdvertising}
                aria-label={copy.categories.advertising.title}
                data-testid="cookie-toggle-advertising"
                onClick={() => setDraftAdvertising((v) => !v)}
                className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  draftAdvertising
                    ? 'bg-orange-600'
                    : 'bg-orange-200/90 dark:bg-orange-950 border border-orange-300 dark:border-orange-800'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                    draftAdvertising
                      ? dir === 'rtl'
                        ? '-translate-x-6'
                        : 'translate-x-6'
                      : dir === 'rtl'
                      ? '-translate-x-1'
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-orange-200/60 dark:border-orange-900/50 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              data-testid="cookie-modal-reject-all"
              onClick={handleRejectAll}
              className="px-3 py-2 rounded-xl border border-orange-300/90 dark:border-orange-800 text-xs font-semibold text-[#573d31] dark:text-orange-200 hover:bg-orange-50 dark:hover:bg-orange-950/60 transition-colors cursor-pointer"
            >
              {copy.rejectAll}
            </button>
            <button
              type="button"
              data-testid="cookie-modal-accept-all"
              onClick={handleAcceptAll}
              className="px-3 py-2 rounded-xl border border-orange-300/90 dark:border-orange-800 text-xs font-semibold text-[#573d31] dark:text-orange-200 hover:bg-orange-50 dark:hover:bg-orange-950/60 transition-colors cursor-pointer"
            >
              {copy.acceptAll}
            </button>
            <button
              type="button"
              data-testid="cookie-save-choices"
              onClick={handleSaveCustom}
              className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
            >
              {copy.saveChoices}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Si un choix a déjà été enregistré, le bandeau reste masqué (modifiable via le footer)
  if (consent !== null) {
    return null;
  }

  // Bandeau compact en bas d'écran (ne masque jamais le champ de téléchargement sur mobile)
  return (
    <div
      role="region"
      aria-label={copy.bannerAriaLabel}
      dir={dir}
      data-cookie-banner="true"
      className="fixed bottom-0 inset-x-0 z-50 pointer-events-none px-2.5 sm:px-5 pb-[max(0.625rem,env(safe-area-inset-bottom,0px))]"
    >
      <div className="pointer-events-auto max-w-4xl mx-auto rounded-2xl bg-white/95 dark:bg-[#1c140e]/95 backdrop-blur-md border border-orange-300/80 dark:border-orange-800/80 shadow-2xl px-3.5 py-2.5 sm:px-5 sm:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-4">
        <p className="text-[11px] sm:text-xs text-[#4a342a] dark:text-orange-100/90 leading-snug">
          {copy.bannerText}{' '}
          <a
            href={privacyHref}
            onClick={handlePrivacyClick}
            className="font-semibold text-orange-700 dark:text-amber-400 underline underline-offset-2 hover:text-orange-600 whitespace-nowrap"
          >
            {copy.privacyLinkLabel}
          </a>
        </p>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            data-testid="cookie-customize"
            onClick={handleOpenCustomize}
            className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-orange-200 dark:border-orange-800/80 text-[11px] sm:text-xs font-semibold text-[#6c4e40] dark:text-orange-200 hover:bg-orange-50 dark:hover:bg-orange-950/60 transition-colors cursor-pointer whitespace-nowrap"
          >
            {copy.customize}
          </button>
          <button
            type="button"
            data-testid="cookie-reject-all"
            onClick={handleRejectAll}
            className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-orange-300 dark:border-orange-700 text-[11px] sm:text-xs font-semibold text-[#1f130b] dark:text-[#fffaf5] hover:bg-orange-50 dark:hover:bg-orange-950/60 transition-colors cursor-pointer whitespace-nowrap"
          >
            {copy.rejectAll}
          </button>
          <button
            type="button"
            data-testid="cookie-accept-all"
            onClick={handleAcceptAll}
            className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-[11px] sm:text-xs font-bold shadow-sm transition-colors cursor-pointer whitespace-nowrap"
          >
            {copy.acceptAll}
          </button>
        </div>
      </div>
    </div>
  );
};
