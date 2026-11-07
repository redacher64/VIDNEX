import React, { useEffect } from 'react';
import {
  ENABLE_ADS,
  ADSENSE_CLIENT_ID,
  IS_ADSENSE_CONFIGURED,
} from '../config/appConfig';
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

const AD_LABELS_BY_LANG: Record<
  LanguageCode,
  {
    sponsored: string;
    demoBadge: string;
    leaderboardTitle: string;
    rectangleTitle: string;
    skyscraperTitle: string;
    columnTitle: string;
    setupHint: string;
  }
> = {
  en: {
    sponsored: 'Sponsored · AdSense',
    demoBadge: 'DEMO MODE',
    leaderboardTitle: 'Horizontal Banner Ad (728 × 90)',
    rectangleTitle: 'Rectangle Display Ad (300 × 250)',
    skyscraperTitle: 'Side Column Ad (160 × 600)',
    columnTitle: 'Vertical Column Ad (300 × 600)',
    setupHint: 'Set your Google AdSense Client ID to display live ads',
  },
  fr: {
    sponsored: 'Sponsorisé · AdSense',
    demoBadge: 'MODE DÉMO',
    leaderboardTitle: 'Bannière Publicitaire Horizontale (728 × 90)',
    rectangleTitle: 'Pavé Publicitaire (300 × 250)',
    skyscraperTitle: 'Colonne Publicitaire Latérale (160 × 600)',
    columnTitle: 'Colonne Publicitaire Verticale (300 × 600)',
    setupHint: 'Configurez votre ID Google AdSense pour afficher de vraies annonces',
  },
  es: {
    sponsored: 'Patrocinado · AdSense',
    demoBadge: 'MODO DEMO',
    leaderboardTitle: 'Banner Publicitario Horizontal (728 × 90)',
    rectangleTitle: 'Anuncio Rectangular (300 × 250)',
    skyscraperTitle: 'Columna Publicitaria Lateral (160 × 600)',
    columnTitle: 'Columna Publicitaria Vertical (300 × 600)',
    setupHint: 'Configura tu ID de Google AdSense para mostrar anuncios reales',
  },
  pt: {
    sponsored: 'Patrocinado · AdSense',
    demoBadge: 'MODO DEMO',
    leaderboardTitle: 'Banner Publicitário Horizontal (728 × 90)',
    rectangleTitle: 'Anúncio Retangular (300 × 250)',
    skyscraperTitle: 'Coluna Publicitária Lateral (160 × 600)',
    columnTitle: 'Coluna Publicitária Vertical (300 × 600)',
    setupHint: 'Configure seu ID do Google AdSense para exibir anúncios reais',
  },
  ar: {
    sponsored: 'إعلان ممول · AdSense',
    demoBadge: 'وضع تجريبي',
    leaderboardTitle: 'بانر إعلاني أفقي (728 × 90)',
    rectangleTitle: 'إعلان مستطيل (300 × 250)',
    skyscraperTitle: 'عمود إعلاني جانبي (160 × 600)',
    columnTitle: 'عمود إعلاني رأسي (300 × 600)',
    setupHint: 'أضف معرف Google AdSense الخاص بك لتفعيل الإعلانات الحقيقية',
  },
};

export const AdSlot: React.FC<AdSlotProps> = ({
  slotId,
  format,
  language = 'fr',
  className = '',
}) => {
  useEffect(() => {
    if (!ENABLE_ADS || !IS_ADSENSE_CONFIGURED || typeof window === 'undefined') {
      return;
    }

    const scriptId = 'vidnex-adsense-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
        ADSENSE_CLIENT_ID
      )}`;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }

    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle.push({});
    } catch {
      // Ignore AdSense push errors if blocked by browser adblocker
    }
  }, [slotId]);

  if (!ENABLE_ADS) {
    return null;
  }

  const labels = AD_LABELS_BY_LANG[language] || AD_LABELS_BY_LANG.fr;

  const isLeaderboard = format === 'leaderboard';
  const isSkyscraper = format === 'skyscraper';
  const isColumn = format === 'column';

  const dimensionsLabel = isLeaderboard
    ? '728 × 90'
    : isSkyscraper
    ? '160 × 600'
    : isColumn
    ? '300 × 600'
    : '300 × 250';

  const formatTitle = isLeaderboard
    ? labels.leaderboardTitle
    : isSkyscraper
    ? labels.skyscraperTitle
    : isColumn
    ? labels.columnTitle
    : labels.rectangleTitle;

  const wrapperClass = isSkyscraper
    ? `w-[180px] shrink-0 ${className}`
    : isColumn
    ? `w-full max-w-[320px] mx-auto ${className}`
    : isLeaderboard
    ? `w-full max-w-4xl mx-auto px-4 sm:px-6 my-5 ${className}`
    : `w-full max-w-2xl mx-auto px-4 sm:px-6 my-6 ${className}`;

  const boxHeightClass = isLeaderboard
    ? 'min-h-[96px] py-3 px-4'
    : isSkyscraper
    ? 'min-h-[440px] py-5 px-3'
    : isColumn
    ? 'min-h-[480px] py-6 px-4'
    : 'min-h-[250px] py-5 px-4';

  const headerLabel = isSkyscraper
    ? labels.sponsored.split('·')[0].trim()
    : labels.sponsored;

  return (
    <aside aria-label="Advertisement" className={wrapperClass}>
      <div className="bg-white/95 dark:bg-[#1c140e]/95 border border-orange-200/80 dark:border-orange-900/60 rounded-2xl p-3 shadow-sm">
        <div className="flex items-center justify-between gap-1.5 pb-2 mb-2 border-b border-orange-100 dark:border-orange-900/40">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-orange-800/75 dark:text-orange-200/70 whitespace-nowrap">
            {headerLabel}
          </span>
          <span
            dir="ltr"
            className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-orange-100/90 dark:bg-orange-950/90 text-orange-700 dark:text-amber-400 shrink-0 whitespace-nowrap"
          >
            {IS_ADSENSE_CONFIGURED ? dimensionsLabel : labels.demoBadge}
          </span>
        </div>

        {/* Strict Reserved Dimensions for Zero Cumulative Layout Shift (CLS = 0) */}
        {IS_ADSENSE_CONFIGURED ? (
          <div
            className={`w-full flex items-center justify-center bg-orange-50/40 dark:bg-[#231710] rounded-xl overflow-hidden ${boxHeightClass}`}
          >
            <ins
              className="adsbygoogle"
              style={{ display: 'block', width: '100%' }}
              data-ad-client={ADSENSE_CLIENT_ID}
              data-ad-slot={slotId}
              data-ad-format={
                isLeaderboard
                  ? 'horizontal'
                  : isSkyscraper || isColumn
                  ? 'vertical'
                  : 'rectangle'
              }
              data-full-width-responsive="true"
            />
          </div>
        ) : (
          <div
            className={`w-full flex flex-col items-center justify-center text-center bg-gradient-to-br from-orange-50/70 via-amber-50/40 to-orange-100/40 dark:from-[#231710] dark:via-[#1c140e] dark:to-[#2a1b12] rounded-xl border border-dashed border-orange-300/90 dark:border-orange-800/70 overflow-hidden ${boxHeightClass}`}
            data-ad-client={ADSENSE_CLIENT_ID}
            data-ad-slot={slotId}
            data-ad-format={
              isLeaderboard
                ? 'horizontal'
                : isSkyscraper || isColumn
                ? 'vertical'
                : 'rectangle'
            }
          >
            <div className="w-8 h-8 rounded-lg bg-orange-500/15 dark:bg-amber-500/15 border border-orange-400/40 dark:border-amber-500/30 flex items-center justify-center text-orange-600 dark:text-amber-400 font-mono text-xs font-bold mb-2.5 shrink-0">
              Ad
            </div>

            <p className="font-display text-xs sm:text-[13px] font-bold text-[#1f130b] dark:text-[#fffaf5] leading-snug">
              {formatTitle}
            </p>

            <span
              dir="ltr"
              className="mt-1.5 font-mono text-[11px] font-semibold text-orange-700 dark:text-amber-400"
            >
              {dimensionsLabel}
            </span>

            <span
              dir="ltr"
              className="mt-0.5 font-mono text-[10px] text-orange-800/60 dark:text-orange-200/50 break-all"
            >
              #{slotId}
            </span>

            <p className="mt-2.5 text-[10px] text-[#6c4e40] dark:text-orange-200/65 max-w-[240px] leading-relaxed break-words">
              {labels.setupHint}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};
