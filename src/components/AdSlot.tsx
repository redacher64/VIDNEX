import React from 'react';
import { ENABLE_ADS, ADSENSE_CLIENT_ID } from '../config/appConfig';

interface AdSlotProps {
  slotId: string;
  format: 'leaderboard' | 'rectangle';
  className?: string;
}

export const AdSlot: React.FC<AdSlotProps> = ({
  slotId,
  format,
  className = '',
}) => {
  // 100% Ad-Free at launch when ENABLE_ADS is false
  if (!ENABLE_ADS) {
    return null;
  }

  const isLeaderboard = format === 'leaderboard';

  return (
    <aside
      aria-label="Advertisement"
      className={`w-full max-w-2xl mx-auto px-4 sm:px-6 my-6 ${className}`}
    >
      <div className="bg-white/95 dark:bg-[#1c140e] border border-orange-200/80 dark:border-orange-900/60 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-orange-100 dark:border-orange-900/40">
          <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-orange-800/70 dark:text-orange-200/60">
            Sponsored Unit
          </span>
          <span
            dir="ltr"
            className="text-[11px] font-mono text-orange-800/70 dark:text-orange-200/60"
          >
            #{slotId}
          </span>
        </div>

        {/* Strict Reserved Dimensions for Zero Cumulative Layout Shift (CLS = 0) */}
        <div
          className={`w-full flex items-center justify-center bg-orange-50/50 dark:bg-[#231710] rounded-xl border border-dashed border-orange-200 dark:border-orange-900/50 overflow-hidden ${
            isLeaderboard ? 'min-h-[90px]' : 'min-h-[250px]'
          }`}
          data-ad-client={ADSENSE_CLIENT_ID}
          data-ad-slot={slotId}
          data-ad-format={isLeaderboard ? 'horizontal' : 'rectangle'}
          data-full-width-responsive="true"
        >
          <span className="text-xs font-mono text-orange-800/70 dark:text-orange-200/60">
            {isLeaderboard
              ? 'Leaderboard Advertisement (728×90)'
              : 'Medium Rectangle Advertisement (300×250)'}
          </span>
        </div>
      </div>
    </aside>
  );
};
