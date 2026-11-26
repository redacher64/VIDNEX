import { getCountryFlag, getCountryNameFr } from './worldCountriesGeo.ts';

export type VisitorsMapPeriod = 'today' | '7d' | '30d';

export type ReferrerCategoryKey = 'search' | 'direct' | 'social' | 'other';

export interface D1VisitorOriginRecord {
  countryCode: string;
  countryName: string;
  flag: string;
  visitors: number;
  botVisits: number;
  extractions: number;
  extractSuccess: number;
  extractError: number;
  successRate: number | null;
  sharePct: number;
}

export interface VisitorSourceCategorySummary {
  category: ReferrerCategoryKey;
  label: string;
  visits: number;
  sharePct: number;
}

export interface TopReferrerHostSummary {
  host: string;
  category: ReferrerCategoryKey;
  visits: number;
}

export interface TopEntryPageSummary {
  page: string;
  visits: number;
  sharePct: number;
}

export interface VisitorsMapSummary {
  period: VisitorsMapPeriod;
  source: 'd1';
  humanVisits: number;
  botVisits: number;
  totalVisits: number;
  totalVisitors: number;
  totalExtractions: number;
  totalExtractSuccess: number;
  totalExtractError: number;
  globalSuccessRate: number;
  maxCountryVisitors: number;
  mostActiveCountry: D1VisitorOriginRecord | null;
  countries: D1VisitorOriginRecord[];
  sources: {
    categories: VisitorSourceCategorySummary[];
    topReferrerHosts: TopReferrerHostSummary[];
    topEntryPages: TopEntryPageSummary[];
  };
}

export interface D1GeoPeriodInput {
  period?: VisitorsMapPeriod;
  humanVisits?: number;
  botVisits?: number;
  totalVisits?: number;
  totalExtractions?: number;
  totalExtractSuccess?: number;
  totalExtractError?: number;
  globalSuccessRate?: number;
  countries?: Array<{
    countryCode: string;
    humanVisits?: number;
    botVisits?: number;
    extractions?: number;
    extractSuccess?: number;
    extractError?: number;
    successRate?: number | null;
    sharePct?: number;
  }>;
  sources?: {
    categories?: VisitorSourceCategorySummary[];
    topReferrerHosts?: TopReferrerHostSummary[];
    topEntryPages?: TopEntryPageSummary[];
  };
}

export interface D1StatsSeedInput {
  counts?: {
    today?: number;
    last7d?: number;
    last30d?: number;
  };
  funnel?: {
    extract_started?: number;
    extract_success?: number;
    extract_error?: number;
    extractSuccessRate?: number;
    globalConversionRate?: number;
  };
  geo?: {
    periods?: Partial<Record<VisitorsMapPeriod, D1GeoPeriodInput>>;
  };
}

const DEFAULT_SOURCE_CATEGORIES: VisitorSourceCategorySummary[] = [
  { category: 'search', label: 'Recherche', visits: 0, sharePct: 0 },
  { category: 'direct', label: 'Direct', visits: 0, sharePct: 0 },
  { category: 'social', label: 'Réseaux sociaux', visits: 0, sharePct: 0 },
  { category: 'other', label: 'Autres sites', visits: 0, sharePct: 0 },
];

/**
 * Single-hue sequential choropleth ramp (light → dark orange/terracotta).
 * Index 0 is unvisited land; indices 1..5 darken progressively as visitor count rises.
 */
export const CHOROPLETH_COLORS = [
  '#e7e0d8', // 0 visiteur
  '#fed7aa', // palier 1 (faible)
  '#fdba74', // palier 2
  '#fb923c', // palier 3
  '#ea580c', // palier 4
  '#9a3412', // palier 5 (maximum, le plus foncé)
] as const;

export function getChoroplethLevel(value: number, maxValue: number): 0 | 1 | 2 | 3 | 4 | 5 {
  const v = Math.max(0, Number(value) || 0);
  if (v <= 0 || maxValue <= 0) return 0;
  const ratio = Math.min(1, v / maxValue);
  if (ratio <= 0.15) return 1;
  if (ratio <= 0.35) return 2;
  if (ratio <= 0.6) return 3;
  if (ratio <= 0.85) return 4;
  return 5;
}

export function getChoroplethFill(value: number, maxValue: number): string {
  const level = getChoroplethLevel(value, maxValue);
  return CHOROPLETH_COLORS[level];
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Builds the world map & visitor sources summary strictly from real D1 data.
 * Never fabricates, estimates, or scales mock countries.
 */
export function buildD1VisitorsMapSummary(
  period: VisitorsMapPeriod = '30d',
  d1Stats?: D1StatsSeedInput | null
): VisitorsMapSummary {
  const periodData = d1Stats?.geo?.periods?.[period];

  const humanVisits = Math.max(0, Number(periodData?.humanVisits) || 0);
  const botVisits = Math.max(0, Number(periodData?.botVisits) || 0);
  const totalVisits = humanVisits + botVisits;

  const fallbackExtractions =
    period === 'today'
      ? Math.max(0, Number(d1Stats?.counts?.today) || 0)
      : period === '7d'
      ? Math.max(0, Number(d1Stats?.counts?.last7d) || 0)
      : Math.max(0, Number(d1Stats?.counts?.last30d) || 0);

  const totalExtractions =
    typeof periodData?.totalExtractions === 'number'
      ? Math.max(0, periodData.totalExtractions)
      : fallbackExtractions;

  const totalExtractSuccess = Math.max(0, Number(periodData?.totalExtractSuccess) || 0);
  const totalExtractError = Math.max(0, Number(periodData?.totalExtractError) || 0);

  const globalSuccessRate =
    typeof periodData?.globalSuccessRate === 'number'
      ? roundOneDecimal(periodData.globalSuccessRate)
      : totalExtractions > 0
      ? roundOneDecimal((totalExtractSuccess / totalExtractions) * 100)
      : 0;

  const rawCountries = Array.isArray(periodData?.countries) ? periodData!.countries : [];

  const countries: D1VisitorOriginRecord[] = rawCountries
    .map((row) => {
      const code = (row.countryCode || 'XX').trim().toUpperCase();
      const visitors = Math.max(0, Number(row.humanVisits) || 0);
      const bots = Math.max(0, Number(row.botVisits) || 0);
      const extractions = Math.max(0, Number(row.extractions) || 0);
      const extractSuccess = Math.max(0, Number(row.extractSuccess) || 0);
      const extractError = Math.max(0, Number(row.extractError) || 0);
      const successRate =
        row.successRate !== undefined && row.successRate !== null
          ? roundOneDecimal(Number(row.successRate))
          : extractions > 0
          ? roundOneDecimal((extractSuccess / extractions) * 100)
          : null;

      const shareDenom = humanVisits > 0 ? humanVisits : totalExtractions;
      const shareNum = humanVisits > 0 ? visitors : extractions;
      const sharePct =
        typeof row.sharePct === 'number'
          ? roundOneDecimal(row.sharePct)
          : shareDenom > 0
          ? roundOneDecimal((shareNum / shareDenom) * 100)
          : 0;

      return {
        countryCode: code,
        countryName: getCountryNameFr(code),
        flag: getCountryFlag(code),
        visitors,
        botVisits: bots,
        extractions,
        extractSuccess,
        extractError,
        successRate,
        sharePct,
      };
    })
    .filter((c) => c.visitors > 0 || c.extractions > 0)
    .sort(
      (a, b) =>
        b.visitors - a.visitors ||
        b.extractions - a.extractions ||
        a.countryCode.localeCompare(b.countryCode)
    );

  const maxCountryVisitors = countries.reduce(
    (max, c) => Math.max(max, c.visitors),
    0
  );

  const categories =
    Array.isArray(periodData?.sources?.categories) &&
    periodData!.sources!.categories.length === 4
      ? periodData!.sources!.categories.map((cat) => ({
          category: cat.category,
          label: cat.label,
          visits: Math.max(0, Number(cat.visits) || 0),
          sharePct: roundOneDecimal(Number(cat.sharePct) || 0),
        }))
      : DEFAULT_SOURCE_CATEGORIES.map((c) => ({ ...c }));

  const topReferrerHosts = Array.isArray(periodData?.sources?.topReferrerHosts)
    ? periodData!.sources!.topReferrerHosts.slice(0, 8).map((h) => ({
        host: String(h.host || ''),
        category: h.category,
        visits: Math.max(0, Number(h.visits) || 0),
      }))
    : [];

  const topEntryPages = Array.isArray(periodData?.sources?.topEntryPages)
    ? periodData!.sources!.topEntryPages.slice(0, 10).map((p) => ({
        page: String(p.page || '/'),
        visits: Math.max(0, Number(p.visits) || 0),
        sharePct: roundOneDecimal(Number(p.sharePct) || 0),
      }))
    : [];

  return {
    period,
    source: 'd1',
    humanVisits,
    botVisits,
    totalVisits,
    totalVisitors: humanVisits,
    totalExtractions,
    totalExtractSuccess,
    totalExtractError,
    globalSuccessRate,
    maxCountryVisitors,
    mostActiveCountry: countries[0] || null,
    countries,
    sources: {
      categories,
      topReferrerHosts,
      topEntryPages,
    },
  };
}
