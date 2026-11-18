import React, { useMemo, useState } from 'react';
import {
  Globe,
  TrendingUp,
  Users,
  BarChart3,
  CheckCircle2,
} from './AdminIcons';
import {
  buildD1VisitorsMapSummary,
  type VisitorsMapPeriod,
  type WorldRegionId,
  type D1StatsSeedInput,
  type ActivityHeatTier,
} from './visitorsMapLogic';

export {
  buildD1VisitorsMapSummary,
  type VisitorsMapPeriod,
  type WorldRegionId,
  type D1StatsSeedInput,
  type ActivityHeatTier,
};

export interface VisitorsMapProps {
  d1Stats?: D1StatsSeedInput | null;
  initialPeriod?: VisitorsMapPeriod;
}

const REGION_SVG_SHAPES: Array<{
  id: string;
  regionId: WorldRegionId;
  label: string;
  d: string;
}> = [
  {
    id: 'region-north-america',
    regionId: 'north_america',
    label: 'Amérique du Nord',
    d: 'M 65,65 L 185,55 L 295,62 L 338,110 L 308,165 L 265,212 L 222,222 L 178,195 L 135,148 L 78,115 Z',
  },
  {
    id: 'region-greenland',
    regionId: 'north_america',
    label: 'Groenland',
    d: 'M 335,32 L 420,28 L 435,68 L 385,95 L 340,78 Z',
  },
  {
    id: 'region-latin-america',
    regionId: 'latin_america',
    label: 'Amérique Latine',
    d: 'M 225,225 L 265,215 L 325,265 L 378,312 L 365,382 L 320,455 L 288,468 L 278,395 L 245,310 Z',
  },
  {
    id: 'region-europe',
    regionId: 'europe',
    label: 'Europe',
    d: 'M 465,68 L 545,55 L 625,62 L 642,135 L 585,165 L 542,175 L 495,172 L 468,148 L 458,108 Z',
  },
  {
    id: 'region-mena-africa',
    regionId: 'mena_africa',
    label: 'Afrique & Moyen-Orient',
    d: 'M 458,182 L 545,178 L 628,175 L 668,208 L 638,255 L 615,328 L 585,405 L 538,412 L 512,345 L 492,285 L 452,248 Z',
  },
  {
    id: 'region-asia',
    regionId: 'asia_pacific',
    label: 'Asie',
    d: 'M 628,62 L 785,58 L 912,82 L 925,145 L 875,215 L 822,262 L 758,255 L 705,242 L 668,205 L 638,142 Z',
  },
  {
    id: 'region-se-asia',
    regionId: 'asia_pacific',
    label: 'Asie du Sud-Est',
    d: 'M 775,268 L 865,265 L 895,312 L 835,328 L 778,308 Z',
  },
  {
    id: 'region-oceania',
    regionId: 'asia_pacific',
    label: 'Océanie',
    d: 'M 795,352 L 892,345 L 922,398 L 892,438 L 812,428 L 788,388 Z',
  },
];

function getHeatTierColors(tier: ActivityHeatTier, isSelected: boolean) {
  if (tier === 'hot') {
    return {
      fill: isSelected ? 'rgba(249, 115, 22, 0.45)' : 'rgba(249, 115, 22, 0.32)',
      stroke: isSelected ? '#fb923c' : '#f97316',
      dot: '#f97316',
      badge:
        'bg-orange-500/15 border-orange-500/40 text-orange-700 dark:text-orange-300',
      label: 'Activité Maximale',
    };
  }
  if (tier === 'high') {
    return {
      fill: isSelected ? 'rgba(245, 158, 11, 0.38)' : 'rgba(245, 158, 11, 0.25)',
      stroke: isSelected ? '#fbbf24' : '#f59e0b',
      dot: '#f59e0b',
      badge:
        'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300',
      label: 'Activité Élevée',
    };
  }
  if (tier === 'medium') {
    return {
      fill: isSelected ? 'rgba(16, 185, 129, 0.34)' : 'rgba(16, 185, 129, 0.2)',
      stroke: isSelected ? '#34d399' : '#10b981',
      dot: '#10b981',
      badge:
        'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300',
      label: 'Activité Modérée',
    };
  }
  return {
    fill: isSelected ? 'rgba(56, 189, 248, 0.28)' : 'rgba(51, 65, 85, 0.45)',
    stroke: isSelected ? '#38bdf8' : '#475569',
    dot: '#38bdf8',
    badge: 'bg-sky-500/15 border-sky-500/40 text-sky-800 dark:text-sky-300',
    label: 'Activité Standard',
  };
}

export const VisitorsMap: React.FC<VisitorsMapProps> = ({
  d1Stats,
  initialPeriod = '30d',
}) => {
  const [period, setPeriod] = useState<VisitorsMapPeriod>(initialPeriod);
  const [selectedRegionId, setSelectedRegionId] = useState<WorldRegionId | 'all'>('all');
  const [activeCountryCode, setActiveCountryCode] = useState<string | null>(null);

  const summary = useMemo(
    () => buildD1VisitorsMapSummary(period, d1Stats),
    [period, d1Stats]
  );

  const regionLookup = useMemo(() => {
    const map = new Map<WorldRegionId, (typeof summary.regions)[number]>();
    for (const r of summary.regions) {
      map.set(r.regionId, r);
    }
    return map;
  }, [summary.regions]);

  const filteredCountries = useMemo(() => {
    if (selectedRegionId === 'all') return summary.countries;
    return summary.countries.filter((c) => c.regionId === selectedRegionId);
  }, [summary.countries, selectedRegionId]);

  const activeCountry = useMemo(() => {
    if (activeCountryCode) {
      const found = summary.countries.find((c) => c.countryCode === activeCountryCode);
      if (found) return found;
    }
    return filteredCountries[0] || summary.mostActiveCountry;
  }, [activeCountryCode, filteredCountries, summary]);

  const activeRegion = useMemo(() => {
    if (selectedRegionId !== 'all') {
      return regionLookup.get(selectedRegionId) || summary.mostActiveRegion;
    }
    return summary.mostActiveRegion;
  }, [selectedRegionId, regionLookup, summary.mostActiveRegion]);

  return (
    <section
      aria-label="Carte mondiale des origines visiteurs D1"
      className="bg-admin-surface border border-admin-border rounded-2xl p-5 space-y-5 shadow-2xs"
    >
      {/* En-tête VisitorsMap */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-admin-accent-bg border border-admin-accent-border flex items-center justify-center text-admin-accent shrink-0 mt-0.5">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-sm sm:text-base font-bold text-admin-text">
                Carte Mondiale des Origines Visiteurs (D1 Analytics)
              </h3>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/40 text-orange-800 dark:text-orange-300">
                Région #1 : {summary.mostActiveRegion.shortName} ({summary.mostActiveRegion.sharePct}%)
              </span>
            </div>
            <p className="text-xs text-admin-text-muted font-mono">
              Visualisation SVG des origines géographiques et mise en évidence des régions à plus forte activité D1
            </p>
          </div>
        </div>

        {/* Sélecteur de période */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Période de la carte des visiteurs"
            className="inline-flex rounded-xl bg-admin-muted p-1 border border-admin-border"
          >
            {(
              [
                { id: 'today', label: 'Aujourd’hui' },
                { id: '7d', label: '7 jours' },
                { id: '30d', label: '30 jours' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPeriod(tab.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer ${
                  period === tab.id
                    ? 'bg-admin-accent text-white shadow-2xs'
                    : 'text-admin-text-secondary hover:text-admin-text'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bandeau KPI des régions les plus actives */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-admin-muted border border-admin-border space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-admin-text-secondary">
            <span>RÉGION LA PLUS ACTIVE</span>
            <TrendingUp className="w-3.5 h-3.5 text-admin-accent" />
          </div>
          <p className="font-display text-lg font-bold text-admin-text truncate">
            {summary.mostActiveRegion.shortName}
          </p>
          <p className="text-[11px] font-mono text-admin-text-muted">
            {summary.mostActiveRegion.visitors.toLocaleString('fr-FR')} visiteurs (
            {summary.mostActiveRegion.sharePct}%)
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-admin-muted border border-admin-border space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-admin-text-secondary">
            <span>PAYS D’ORIGINE #1</span>
            <span className="text-base leading-none">{summary.mostActiveCountry.flag}</span>
          </div>
          <p className="font-display text-lg font-bold text-admin-text truncate">
            {summary.mostActiveCountry.countryName} ({summary.mostActiveCountry.countryCode})
          </p>
          <p className="text-[11px] font-mono text-admin-text-muted">
            {summary.mostActiveCountry.visitors.toLocaleString('fr-FR')} vis. ·{' '}
            {summary.mostActiveCountry.sharePct}% du trafic
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-admin-muted border border-admin-border space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-admin-text-secondary">
            <span>VISITEURS TOTAUX (D1)</span>
            <Users className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
          </div>
          <p className="font-display text-lg font-bold text-admin-text tabular-nums">
            {summary.totalVisitors.toLocaleString('fr-FR')}
          </p>
          <p className="text-[11px] font-mono text-admin-text-muted">
            {summary.totalExtractions.toLocaleString('fr-FR')} extractions médias
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-admin-muted border border-admin-border space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-admin-text-secondary">
            <span>SUCCÈS GÉOGRAPHIQUE MOYEN</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
          </div>
          <p className="font-display text-lg font-bold text-emerald-800 dark:text-emerald-400 tabular-nums">
            {summary.globalSuccessRate}%
          </p>
          <p className="text-[11px] font-mono text-admin-text-muted">
            {summary.countries.length} pays actifs sur 5 régions
          </p>
        </div>
      </div>

      {/* Filtres rapides de région pour surligner une zone sur la carte SVG */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedRegionId('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold border transition-colors cursor-pointer ${
            selectedRegionId === 'all'
              ? 'bg-admin-accent text-white border-admin-accent'
              : 'bg-admin-muted text-admin-text-secondary border-admin-border hover:text-admin-text'
          }`}
        >
          Toutes les régions (5)
        </button>
        {summary.regions.map((reg) => {
          const active = selectedRegionId === reg.regionId;
          return (
            <button
              key={reg.regionId}
              type="button"
              onClick={() =>
                setSelectedRegionId((prev) => (prev === reg.regionId ? 'all' : reg.regionId))
              }
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                active
                  ? 'bg-admin-accent text-white border-admin-accent'
                  : 'bg-admin-muted text-admin-text-secondary border-admin-border hover:text-admin-text'
              }`}
            >
              <span>#{reg.rank}</span>
              <span>{reg.shortName}</span>
              <span className="opacity-80">({reg.sharePct}%)</span>
            </button>
          );
        })}
      </div>

      {/* Carte Mondiale SVG + Classement des Régions les plus actives */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Canvas SVG Carte Mondiale avec régions surlignées par intensité d'activité */}
        <div className="lg:col-span-8 rounded-2xl bg-[#0d131f] border border-admin-border p-3.5 flex flex-col justify-between text-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2 text-[11px] font-mono text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
              Zones thermiques D1 : les régions les plus actives sont illuminées en orange/ambre
            </span>
            <span>
              Cliquez sur un continent ou un pays pour inspecter
            </span>
          </div>

          <div className="relative w-full aspect-[2/1] min-h-[240px]">
            <svg
              viewBox="0 0 1000 500"
              className="w-full h-full select-none"
              role="img"
              aria-label="Carte mondiale SVG des origines de visiteurs et régions actives"
            >
              <defs>
                <radialGradient id="visitorsMapHotGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.9" />
                  <stop offset="55%" stopColor="#fb923c" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="visitorsMapHighGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.85" />
                  <stop offset="55%" stopColor="#fbbf24" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="visitorsMapNormalGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                  <stop offset="55%" stopColor="#34d399" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Grille géographique */}
              {[100, 200, 300, 400].map((y) => (
                <line
                  key={`grid-y-${y}`}
                  x1={0}
                  y1={y}
                  x2={1000}
                  y2={y}
                  stroke="#1e293b"
                  strokeWidth="0.8"
                  strokeDasharray="4 4"
                />
              ))}
              {[166, 333, 500, 666, 833].map((x) => (
                <line
                  key={`grid-x-${x}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={500}
                  stroke="#1e293b"
                  strokeWidth="0.8"
                  strokeDasharray="4 4"
                />
              ))}

              {/* Polygones des Régions colorés selon leur niveau d'activité (HeatTier) */}
              {REGION_SVG_SHAPES.map((shape) => {
                const regInfo = regionLookup.get(shape.regionId);
                const tier = regInfo?.heatTier || 'low';
                const isSelected =
                  selectedRegionId === 'all'
                    ? Boolean(regInfo?.isTopRegion)
                    : selectedRegionId === shape.regionId;
                const isDimmed =
                  selectedRegionId !== 'all' && selectedRegionId !== shape.regionId;
                const colors = getHeatTierColors(tier, isSelected);

                return (
                  <path
                    key={shape.id}
                    d={shape.d}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth={isSelected ? '2.2' : '1.4'}
                    opacity={isDimmed ? 0.35 : 1}
                    strokeLinejoin="round"
                    onClick={() =>
                      setSelectedRegionId((prev) =>
                        prev === shape.regionId ? 'all' : shape.regionId
                      )
                    }
                    className="cursor-pointer transition-all duration-300 hover:opacity-100"
                  >
                    <title>
                      {regInfo
                        ? `${regInfo.name} (#${regInfo.rank}) : ${regInfo.visitors.toLocaleString(
                            'fr-FR'
                          )} visiteurs (${regInfo.sharePct}%)`
                        : shape.label}
                    </title>
                  </path>
                );
              })}

              {/* Badges de région sur les centroïdes des 5 régions */}
              {summary.regions.map((reg) => {
                const isHighlighted =
                  selectedRegionId === 'all'
                    ? reg.rank <= 2
                    : selectedRegionId === reg.regionId;
                if (!isHighlighted) return null;
                return (
                  <g
                    key={`badge-${reg.regionId}`}
                    transform={`translate(${reg.centroidX}, ${reg.centroidY})`}
                    onClick={() =>
                      setSelectedRegionId((prev) =>
                        prev === reg.regionId ? 'all' : reg.regionId
                      )
                    }
                    className="cursor-pointer"
                  >
                    <rect
                      x="-46"
                      y="-24"
                      width="92"
                      height="16"
                      rx="4"
                      fill="#020617"
                      fillOpacity="0.9"
                      stroke={reg.isTopRegion ? '#f97316' : '#f59e0b'}
                      strokeWidth="1"
                    />
                    <text
                      textAnchor="middle"
                      y="-13"
                      fill={reg.isTopRegion ? '#fdba74' : '#fde68a'}
                      fontSize="8"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      #{reg.rank} {reg.shortName} {reg.sharePct}%
                    </text>
                  </g>
                );
              })}

              {/* Points d'origine des visiteurs par pays */}
              {filteredCountries.map((country, idx) => {
                const isSelected = activeCountry?.countryCode === country.countryCode;
                const radius = Math.max(5, Math.min(20, 5 + Math.sqrt(country.sharePct) * 2.6));
                const glowUrl =
                  country.heatTier === 'hot'
                    ? 'url(#visitorsMapHotGlow)'
                    : country.heatTier === 'high'
                    ? 'url(#visitorsMapHighGlow)'
                    : 'url(#visitorsMapNormalGlow)';
                const dotFill =
                  country.heatTier === 'hot'
                    ? '#f97316'
                    : country.heatTier === 'high'
                    ? '#f59e0b'
                    : '#10b981';

                return (
                  <g
                    key={country.countryCode}
                    transform={`translate(${country.svgX}, ${country.svgY})`}
                    onClick={() => setActiveCountryCode(country.countryCode)}
                    onMouseEnter={() => setActiveCountryCode(country.countryCode)}
                    className="cursor-pointer"
                  >
                    <circle
                      r={radius * 1.9}
                      fill={glowUrl}
                      opacity={isSelected ? 1 : 0.75}
                    />
                    {(isSelected || idx < 4) && (
                      <circle
                        r={radius + 3}
                        fill="none"
                        stroke={isSelected ? '#ffffff' : dotFill}
                        strokeWidth={isSelected ? '1.8' : '1.1'}
                      />
                    )}
                    <circle
                      r={Math.max(4, radius * 0.6)}
                      fill={dotFill}
                      stroke="#020617"
                      strokeWidth="1.2"
                    />
                    {(idx < 6 || isSelected) && (
                      <text
                        textAnchor="middle"
                        y={radius + 11}
                        fill="#f8fafc"
                        fontSize="7.5"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {country.countryCode} ({country.sharePct}%)
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Légende d'intensité thermique */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                Activité Maximale (#1)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Activité Élevée (#2)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Activité Modérée / Standard
              </span>
            </div>
            <span>
              Région active : {activeRegion.name}
            </span>
          </div>
        </div>

        {/* Colonne droite (4 cols) : Classement des Régions les plus actives + Pays inspecté */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-4">
          {/* Classement des Régions par activité */}
          <div className="p-4 rounded-xl bg-admin-muted border border-admin-border space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-admin-text-secondary">
                Régions les plus actives (D1)
              </h4>
              <BarChart3 className="w-3.5 h-3.5 text-admin-accent" />
            </div>

            <div className="space-y-2.5">
              {summary.regions.map((reg) => {
                const colors = getHeatTierColors(
                  reg.heatTier,
                  selectedRegionId === reg.regionId
                );
                return (
                  <button
                    key={reg.regionId}
                    type="button"
                    onClick={() =>
                      setSelectedRegionId((prev) =>
                        prev === reg.regionId ? 'all' : reg.regionId
                      )
                    }
                    className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                      selectedRegionId === reg.regionId
                        ? 'bg-admin-surface border-admin-accent shadow-2xs'
                        : 'bg-admin-surface/60 border-admin-border hover:border-admin-border-strong'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-mono">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${colors.badge}`}
                        >
                          #{reg.rank}
                        </span>
                        <span className="font-bold text-admin-text truncate">
                          {reg.shortName}
                        </span>
                      </div>
                      <span className="font-bold text-admin-text tabular-nums shrink-0">
                        {reg.visitors.toLocaleString('fr-FR')} vis. ({reg.sharePct}%)
                      </span>
                    </div>

                    <div className="mt-1.5 w-full h-1.5 rounded-full bg-admin-muted border border-admin-border overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          reg.heatTier === 'hot'
                            ? 'bg-orange-500'
                            : reg.heatTier === 'high'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(4, reg.sharePct))}%` }}
                      />
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-admin-text-muted">
                      <span>
                        Top : {reg.topCountryFlag} {reg.topCountry}
                      </span>
                      <span>
                        {reg.extractions.toLocaleString('fr-FR')} extr. · {reg.avgSuccessRate}% OK
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fiche du pays d'origine inspecté */}
          {activeCountry && (
            <div className="p-4 rounded-xl bg-admin-muted border border-admin-border space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-admin-text-muted">
                  Pays d’origine sélectionné
                </span>
                <span
                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                    getHeatTierColors(activeCountry.heatTier, true).badge
                  }`}
                >
                  {getHeatTierColors(activeCountry.heatTier, true).label}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl leading-none">{activeCountry.flag}</span>
                  <div>
                    <div className="font-display text-sm font-bold text-admin-text">
                      {activeCountry.countryName} ({activeCountry.countryCode})
                    </div>
                    <div className="text-[11px] font-mono text-admin-text-muted">
                      Moteur favori : {activeCountry.topPlatform}
                    </div>
                  </div>
                </div>
                <span className="font-display text-lg font-bold text-admin-accent tabular-nums">
                  {activeCountry.sharePct}%
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono text-xs">
                <div className="p-2 rounded-lg bg-admin-surface border border-admin-border">
                  <div className="text-[10px] text-admin-text-muted">Visiteurs</div>
                  <div className="font-bold text-admin-text tabular-nums">
                    {activeCountry.visitors.toLocaleString('fr-FR')}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-admin-surface border border-admin-border">
                  <div className="text-[10px] text-admin-text-muted">Extractions</div>
                  <div className="font-bold text-admin-text tabular-nums">
                    {activeCountry.extractions.toLocaleString('fr-FR')}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-admin-surface border border-admin-border">
                  <div className="text-[10px] text-admin-text-muted">Succès</div>
                  <div className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {activeCountry.successRate}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grille des principaux pays d'origine D1 */}
      <div className="p-4 rounded-xl bg-admin-muted border border-admin-border space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-display text-xs font-bold uppercase tracking-wider text-admin-text-secondary">
            Top Origines des Visiteurs par Pays ({filteredCountries.length} pays)
          </h4>
          <span className="text-[11px] font-mono text-admin-text-muted">
            Cliquez sur une carte pays pour la localiser sur la mappemonde
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {filteredCountries.slice(0, 8).map((c, idx) => {
            const isSelected = activeCountry?.countryCode === c.countryCode;
            return (
              <button
                key={c.countryCode}
                type="button"
                onClick={() => setActiveCountryCode(c.countryCode)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-admin-surface border-admin-accent shadow-2xs'
                    : 'bg-admin-surface/70 border-admin-border hover:border-admin-border-strong'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg leading-none">{c.flag}</span>
                    <span className="font-display text-xs font-bold text-admin-text truncate">
                      #{idx + 1} {c.countryName}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-admin-accent tabular-nums">
                    {c.sharePct}%
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-admin-text-muted">
                  <span>{c.visitors.toLocaleString('fr-FR')} vis.</span>
                  <span>{c.extractions.toLocaleString('fr-FR')} extr.</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
