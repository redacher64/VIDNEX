import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ArrowRight, ChevronDown, ChevronUp } from '../AdminIcons';
import type { ActionRequiredItem, AdminNavigationTarget } from '../adminMetricsLogic';

export interface ActionRequiredPanelProps {
  items: readonly ActionRequiredItem[];
  onNavigate: (target: AdminNavigationTarget) => void;
}

const DEFAULT_VISIBLE_ALERTS = 3;

export const ActionRequiredPanel: React.FC<ActionRequiredPanelProps> = ({
  items,
  onNavigate,
}) => {
  const [expanded, setExpanded] = useState(false);
  const hasMore = items.length > DEFAULT_VISIBLE_ALERTS;
  const visibleItems = expanded ? items : items.slice(0, DEFAULT_VISIBLE_ALERTS);

  return (
    <section
      aria-label="Actions à traiter"
      className="bg-admin-surface border border-admin-border rounded-lg p-4 sm:p-5 flex flex-col gap-3 h-full"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold text-admin-text">
          À traiter <span className="font-normal text-admin-text-muted">(30j)</span>
        </h2>
        <span
          className={`text-xs font-mono font-semibold px-2 py-0.5 rounded border tabular-nums ${
            items.length > 0
              ? 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-800/60 text-red-800 dark:text-red-300'
              : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
          }`}
        >
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6 px-3 rounded-md border border-dashed border-admin-border">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mb-2" />
          <p className="text-xs font-semibold text-admin-text">
            Aucune alerte critique
          </p>
          <p className="text-xs text-admin-text-muted mt-1">
            Tous les moteurs actifs sont au-dessus de 50 % et en ligne.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <ul className="space-y-2">
            {visibleItems.map((item) => {
              const isCritical = item.severity === 'critical';
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.target)}
                    className="w-full text-left p-3 rounded-md border border-admin-border hover:border-admin-border-strong hover:bg-admin-hover/50 transition-colors cursor-pointer flex items-start justify-between gap-2.5"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <AlertTriangle
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          isCritical
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-admin-text break-words">
                          {item.title}
                        </p>
                        <p className="text-xs text-admin-text-muted mt-0.5 break-words">
                          {item.detail}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-admin-accent shrink-0 inline-flex items-center gap-1 mt-0.5">
                      <span>{item.ctaLabel}</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {hasMore && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((prev) => !prev)}
              className="self-start inline-flex items-center gap-1 text-xs font-semibold text-admin-accent hover:underline cursor-pointer pt-1"
            >
              <span>
                {expanded ? 'Réduire' : `Voir tout (${items.length})`}
              </span>
              {expanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      )}
    </section>
  );
};
