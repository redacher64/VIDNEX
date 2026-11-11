import React, { useEffect, useState } from 'react';
import {
  ADSENSE_CLIENT_ID,
  IS_ADSENSE_CONFIGURED,
} from '../config/appConfig';
import {
  ensureAdSenseScriptLoaded,
  isAdSenseDemoMode,
  isAdSenseEnabled,
  subscribePublicConfig,
} from '../services/adsenseService';
import { LanguageCode } from '../i18n/translations';

export type AdSlotFormat =
  | 'leaderboard'
  | 'rectangle'
  | 'skyscraper'
  | 'column';

interface AdSlotProps {
  slotId: string;
  format: AdSlotFormat;
  language?: LanguageCode;
  className?: string;
}

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
}) => {
  const [adsEnabled, setAdsEnabled] = useState<boolean>(() => isAdSenseEnabled());

  useEffect(() => {
    setAdsEnabled(isAdSenseEnabled());
    return subscribePublicConfig(() => {
      setAdsEnabled(isAdSenseEnabled());
    });
  }, []);

  const canRenderLiveAd = adsEnabled && IS_ADSENSE_CONFIGURED;
  const canRenderDevDemo = adsEnabled && !IS_ADSENSE_CONFIGURED && isAdSenseDemoMode();

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

  // ÉTAPE 1: Zero ad slots or reserved space in production/prerender unless real AdSense ID + ads_enabled are active
  if (!canRenderLiveAd && !canRenderDevDemo) {
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

  const sponsoredLabel =
    SPONSORED_LABEL_BY_LANG[language] || SPONSORED_LABEL_BY_LANG.fr!;

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
