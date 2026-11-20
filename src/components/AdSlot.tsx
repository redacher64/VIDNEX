import React, { useEffect, useState } from 'react';
import {
  ADSENSE_CLIENT_ID,
  IS_ADSENSE_CONFIGURED,
} from '../config/appConfig';
import {
  ADSTERRA_CONFIG,
  buildAdsterraBannerSrcDoc,
  resolveAdsterraBannerUnit,
  type AdsterraBannerUnit,
} from '../config/adsterraConfig';
import {
  ensureAdSenseScriptLoaded,
  ensureAdsterraNativeBannerLoaded,
  isAdminRoutePath,
  isAdSenseDemoMode,
  isAdSenseEnabled,
  isAdsterraEnabled,
  onDeferredAdReady,
  subscribePublicConfig,
} from '../services/adsenseService';
import { LanguageCode } from '../i18n/translations';

export type AdSlotFormat =
  | 'leaderboard'
  | 'rectangle'
  | 'skyscraper'
  | 'column'
  | 'native';

interface AdSlotProps {
  slotId: string;
  format: AdSlotFormat;
  language?: LanguageCode;
  className?: string;
  hideOnMobile?: boolean;
  hideOnDesktop?: boolean;
}

export { resolveAdsterraBannerUnit };

const SPONSORED_LABEL_BY_LANG: Partial<Record<LanguageCode, string>> = {
  fr: 'Sponsorisé',
  en: 'Sponsored',
  ar: 'إعلان',
  es: 'Patrocinado',
  pt: 'Patrocinado',
  de: 'Anzeige',
  tr: 'Sponsorlu',
  id: 'Bersponsor',
  it: 'Sponsorizzato',
  ru: 'Реклама',
};

export const AdSlot: React.FC<AdSlotProps> = ({
  slotId,
  format,
  language = 'fr',
  className = '',
  hideOnMobile = false,
  hideOnDesktop = false,
}) => {
  const isBrowser = typeof window !== 'undefined';
  const [adsEnabled, setAdsEnabled] = useState<boolean>(() => isAdSenseEnabled());
  const [adsterraEnabled, setAdsterraEnabled] = useState<boolean>(() =>
    isBrowser ? isAdsterraEnabled() : false
  );
  const [deferredReady, setDeferredReady] = useState<boolean>(false);
  const [isDesktopMd, setIsDesktopMd] = useState<boolean>(() =>
    isBrowser && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 768px)').matches
      : false
  );
  const [isDesktopXl, setIsDesktopXl] = useState<boolean>(() =>
    isBrowser && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 1280px)').matches
      : false
  );

  useEffect(() => {
    setAdsEnabled(isAdSenseEnabled());
    setAdsterraEnabled(isAdsterraEnabled());
    return subscribePublicConfig(() => {
      setAdsEnabled(isAdSenseEnabled());
      setAdsterraEnabled(isAdsterraEnabled());
    });
  }, []);

  useEffect(() => {
    if (!isBrowser || typeof window.matchMedia !== 'function') return;

    const mdQuery = window.matchMedia('(min-width: 768px)');
    const xlQuery = window.matchMedia('(min-width: 1280px)');

    const handleMdChange = (e: MediaQueryListEvent) => setIsDesktopMd(e.matches);
    const handleXlChange = (e: MediaQueryListEvent) => setIsDesktopXl(e.matches);

    setIsDesktopMd(mdQuery.matches);
    setIsDesktopXl(xlQuery.matches);

    mdQuery.addEventListener('change', handleMdChange);
    xlQuery.addEventListener('change', handleXlChange);
    return () => {
      mdQuery.removeEventListener('change', handleMdChange);
      xlQuery.removeEventListener('change', handleXlChange);
    };
  }, [isBrowser]);

  useEffect(() => {
    if (!isBrowser || !adsterraEnabled || isAdminRoutePath()) {
      return;
    }
    return onDeferredAdReady(() => {
      setDeferredReady(true);
    });
  }, [isBrowser, adsterraEnabled]);

  const isSuppressedOnMobile = hideOnMobile && !isDesktopMd;
  const isSuppressedOnDesktop = hideOnDesktop && isDesktopMd;
  const isSuppressedByViewport = isSuppressedOnMobile || isSuppressedOnDesktop;
  const canRenderLiveAd =
    adsEnabled && IS_ADSENSE_CONFIGURED && !isSuppressedByViewport;
  const canRenderDevDemo =
    adsEnabled &&
    !IS_ADSENSE_CONFIGURED &&
    isAdSenseDemoMode() &&
    !isSuppressedByViewport;
  const canRenderAdsterra =
    isBrowser &&
    !isAdminRoutePath() &&
    adsterraEnabled &&
    !isSuppressedByViewport &&
    format !== 'column' &&
    (format !== 'skyscraper' || isDesktopXl);

  useEffect(() => {
    if (!canRenderLiveAd || typeof window === 'undefined') {
      return;
    }

    ensureAdSenseScriptLoaded();

    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle.push({});
    } catch {
      // Ignore AdSense push errors if blocked by browser adblocker
    }
  }, [slotId, canRenderLiveAd]);

  useEffect(() => {
    if (canRenderAdsterra && deferredReady && format === 'native') {
      ensureAdsterraNativeBannerLoaded();
    }
  }, [canRenderAdsterra, deferredReady, format]);

  // Aucune pub dans le prerender/SEO, sur /admin, ni lorsque le slot est masqué sur le viewport courant
  if (!isBrowser || isAdminRoutePath() || isSuppressedByViewport) {
    return null;
  }

  const sponsoredLabel =
    SPONSORED_LABEL_BY_LANG[language] || SPONSORED_LABEL_BY_LANG.fr!;

  // Rendu Adsterra (quand ads_adsterra_enabled est actif)
  if (canRenderAdsterra) {
    if (format === 'native') {
      return (
        <aside
          aria-label="Advertisement"
          data-ad-provider="adsterra"
          data-ad-slot={slotId}
          className={`w-full max-w-6xl mx-auto px-4 sm:px-6 my-6 ${className}`}
        >
          <div className="bg-white/95 dark:bg-[#1c140e]/95 border border-orange-200/80 dark:border-orange-900/60 rounded-2xl p-3 sm:p-4 shadow-sm">
            <div className="flex items-center justify-between gap-1.5 pb-2 mb-2 border-b border-orange-100 dark:border-orange-900/40">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-orange-800/75 dark:text-orange-200/70 whitespace-nowrap">
                {sponsoredLabel}
              </span>
            </div>
            <div
              id={ADSTERRA_CONFIG.nativeBanner.containerId}
              className="w-full min-h-[120px]"
            />
          </div>
        </aside>
      );
    }

    const bannerUnit: AdsterraBannerUnit = resolveAdsterraBannerUnit(
      format,
      isDesktopMd
    );

    const adsterraWrapperClass =
      format === 'skyscraper'
        ? `hidden xl:block w-[176px] shrink-0 ${className}`
        : format === 'leaderboard'
        ? `w-full max-w-md md:max-w-4xl mx-auto px-3 sm:px-6 my-3 sm:my-4 flex justify-center ${className}`
        : `w-full max-w-md mx-auto px-3 sm:px-6 my-4 flex justify-center ${className}`;

    // Taille réservée fixe (CLS = 0) correspondant exactement à la bannière active (728x90 desktop OU 300x250 mobile centré, 300x250, 160x600)
    const reservedBoxClass =
      format === 'leaderboard'
        ? 'w-[300px] h-[250px] md:w-[728px] md:h-[90px] mx-auto'
        : format === 'skyscraper'
        ? 'w-[160px] h-[600px] mx-auto'
        : 'w-[300px] h-[250px] mx-auto';

    const srcDoc = deferredReady ? buildAdsterraBannerSrcDoc(bannerUnit) : undefined;

    return (
      <aside
        aria-label="Advertisement"
        data-ad-provider="adsterra"
        data-ad-slot={slotId}
        className={adsterraWrapperClass}
      >
        <div className="w-full bg-white/95 dark:bg-[#1c140e]/95 border border-orange-200/80 dark:border-orange-900/60 rounded-2xl p-2.5 shadow-sm flex flex-col items-center">
          <div className="w-full flex items-center justify-between gap-1.5 pb-1.5 mb-1.5 border-b border-orange-100 dark:border-orange-900/40">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-orange-800/75 dark:text-orange-200/70 whitespace-nowrap">
              {sponsoredLabel}
            </span>
          </div>

          <div
            className={`flex items-center justify-center bg-orange-50/40 dark:bg-[#231710] rounded-lg overflow-hidden shrink-0 max-w-full ${reservedBoxClass}`}
          >
            {deferredReady && srcDoc && (
              <iframe
                key={`${slotId}-${bannerUnit.key}`}
                title={`Adsterra-${slotId}`}
                srcDoc={srcDoc}
                width={bannerUnit.width}
                height={bannerUnit.height}
                scrolling="no"
                frameBorder={0}
                className="border-0 overflow-hidden block shrink-0"
              />
            )}
          </div>
        </div>
      </aside>
    );
  }

  // ÉTAPE 1: Zero ad slots or reserved space in production/prerender unless real AdSense ID + ads_enabled are active
  if ((!canRenderLiveAd && !canRenderDevDemo) || format === 'native') {
    return null;
  }

  const isLeaderboard = format === 'leaderboard';
  const isSkyscraper = format === 'skyscraper';
  const isColumn = format === 'column';

  // Never render 160x600 (skyscraper) or 300x600 (column) below 768px; max 2 responsive slots on mobile
  const wrapperClass = isSkyscraper
    ? `hidden xl:block w-[180px] shrink-0 ${className}`
    : isColumn
    ? `hidden md:block w-full max-w-[320px] mx-auto ${className}`
    : isLeaderboard
    ? `w-full max-w-4xl mx-auto px-4 sm:px-6 my-4 sm:my-5 ${className}`
    : `w-full max-w-2xl mx-auto px-4 sm:px-6 my-5 sm:my-6 ${className}`;

  const boxHeightClass = isLeaderboard
    ? 'min-h-[96px] py-2.5 px-3 sm:py-3 sm:px-4'
    : isSkyscraper
    ? 'min-h-[440px] py-5 px-3'
    : isColumn
    ? 'min-h-[480px] py-6 px-4'
    : 'min-h-[250px] py-4 px-3 sm:py-5 sm:px-4';

  return (
    <aside aria-label="Advertisement" className={wrapperClass}>
      <div className="bg-white/95 dark:bg-[#1c140e]/95 border border-orange-200/80 dark:border-orange-900/60 rounded-2xl p-3 shadow-sm">
        <div className="flex items-center justify-between gap-1.5 pb-2 mb-2 border-b border-orange-100 dark:border-orange-900/40">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-orange-800/75 dark:text-orange-200/70 whitespace-nowrap">
            {sponsoredLabel}
          </span>
        </div>

        <div
          className={`w-full flex items-center justify-center bg-orange-50/40 dark:bg-[#231710] rounded-xl overflow-hidden ${boxHeightClass}`}
        >
          {canRenderLiveAd ? (
            <ins
              className="adsbygoogle"
              style={{ display: 'block', width: '100%' }}
              data-ad-client={ADSENSE_CLIENT_ID}
              data-ad-slot={slotId}
              data-ad-format={
                isSkyscraper || isColumn
                  ? 'vertical'
                  : isLeaderboard
                  ? 'auto'
                  : 'rectangle'
              }
              data-full-width-responsive="true"
            />
          ) : (
            <div
              dir="ltr"
              className="font-mono text-xs text-orange-800/70 dark:text-orange-200/60"
            >
              AdSlot #{slotId}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
