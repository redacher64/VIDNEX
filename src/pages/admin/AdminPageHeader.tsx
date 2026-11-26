import { Download, RefreshCw } from './AdminIcons';
import { formatTimeHHMM } from './adminMetricsLogic';

export interface PeriodSelectorOption<T extends string> {
  id: T;
  label: string;
}

export interface AdminPageHeaderProps<T extends string = string> {
  title: string;
  subtitle?: string;
  fetchedAt?: number | null;
  loading?: boolean;
  onRefresh?: () => void;
  onExport?: () => void;
  exporting?: boolean;
  exportDisabled?: boolean;
  periodOptions?: ReadonlyArray<PeriodSelectorOption<T>>;
  selectedPeriod?: T;
  onSelectPeriod?: (period: T) => void;
  periodAriaLabel?: string;
}

export function AdminPageHeader<T extends string = string>({
  title,
  subtitle,
  fetchedAt,
  loading = false,
  onRefresh,
  onExport,
  exporting = false,
  exportDisabled = false,
  periodOptions,
  selectedPeriod,
  onSelectPeriod,
  periodAriaLabel = 'Sélecteur de période',
}: AdminPageHeaderProps<T>) {
  const timeLabel = formatTimeHHMM(fetchedAt);

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-admin-border">
      <div className="min-w-0">
        <h1 className="font-display text-lg sm:text-xl font-bold text-admin-text tracking-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-admin-text-muted mt-0.5 truncate">{subtitle}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {periodOptions && periodOptions.length > 0 && selectedPeriod && onSelectPeriod && (
          <div
            role="group"
            aria-label={periodAriaLabel}
            className="inline-flex items-center rounded-md bg-admin-surface border border-admin-border p-0.5"
          >
            {periodOptions.map((opt) => {
              const active = selectedPeriod === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelectPeriod(opt.id)}
                  className={`px-2.5 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-admin-accent text-white'
                      : 'text-admin-text-secondary hover:text-admin-text hover:bg-admin-hover'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        {fetchedAt ? (
          <span
            className="text-xs font-mono text-admin-text-muted px-2 py-1 tabular-nums whitespace-nowrap"
            title="Heure de dernière synchronisation"
          >
            Données de {timeLabel}
          </span>
        ) : null}

        {onExport && (
          <button
            type="button"
            onClick={onExport}
            disabled={exporting || exportDisabled}
            className="px-3 py-1.5 rounded-md bg-admin-surface hover:bg-admin-hover border border-admin-border-strong text-xs font-semibold text-admin-text flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            title="Exporter le classeur Excel complet (30 jours, 7 feuilles)"
          >
            <Download className="w-3.5 h-3.5 text-admin-accent" />
            <span>{exporting ? 'Export…' : 'Export Excel'}</span>
          </button>
        )}

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-1.5 rounded-md bg-admin-surface hover:bg-admin-hover border border-admin-border-strong text-xs font-semibold text-admin-text flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-admin-text-muted ${loading ? 'animate-spin' : ''}`}
            />
            <span>Actualiser</span>
          </button>
        )}
      </div>
    </div>
  );
}
