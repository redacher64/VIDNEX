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
      <div className="bg-white dark:bg-[#121215] border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-zinc-800">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            Sponsored Unit
          </span>
          <span
            dir="ltr"
            className="text-[11px] text-slate-400 dark:text-zinc-500"
          >
            #{slotId}
          </span>
        </div>

        {/* Strict Reserved Dimensions for Zero Cumulative Layout Shift (CLS = 0) */}
        <div
          className={`w-full flex items-center justify-center bg-slate-50 dark:bg-zinc-900 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 overflow-hidden ${
            isLeaderboard ? 'min-h-[90px]' : 'min-h-[250px]'
          }`}
          data-ad-client={ADSENSE_CLIENT_ID}
          data-ad-slot={slotId}
          data-ad-format={isLeaderboard ? 'horizontal' : 'rectangle'}
          data-full-width-responsive="true"
        >
          <span className="text-xs text-slate-400 dark:text-zinc-500">
            {isLeaderboard
              ? 'Leaderboard Advertisement (728×90)'
              : 'Medium Rectangle Advertisement (300×250)'}
          </span>
        </div>
      </div>
    </aside>
  );
};
