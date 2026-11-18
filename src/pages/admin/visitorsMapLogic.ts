export type VisitorsMapPeriod = 'today' | '7d' | '30d';

export type WorldRegionId =
  | 'europe'
  | 'mena_africa'
  | 'north_america'
  | 'latin_america'
  | 'asia_pacific';

export type ActivityHeatTier = 'hot' | 'high' | 'medium' | 'low';

export interface D1VisitorOriginRecord {
  countryCode: string;
  countryName: string;
  flag: string;
  regionId: WorldRegionId;
  lat: number;
  lon: number;
  svgX: number;
  svgY: number;
  visitors: number;
  extractions: number;
  successRate: number;
  topPlatform: 'TikTok' | 'Instagram' | 'X (Twitter)' | 'Facebook' | 'LinkedIn';
  sharePct: number;
  heatTier: ActivityHeatTier;
}

export interface WorldRegionActivity {
  regionId: WorldRegionId;
  name: string;
  shortName: string;
  visitors: number;
  extractions: number;
  sharePct: number;
  avgSuccessRate: number;
  countryCount: number;
  topCountry: string;
  topCountryFlag: string;
  rank: number;
  isTopRegion: boolean;
  heatTier: ActivityHeatTier;
  centroidX: number;
  centroidY: number;
}

export interface VisitorsMapSummary {
  period: VisitorsMapPeriod;
  source: 'd1-scaled-mock' | 'd1-default-mock';
  totalVisitors: number;
  totalExtractions: number;
  globalSuccessRate: number;
  mostActiveRegion: WorldRegionActivity;
  mostActiveCountry: D1VisitorOriginRecord;
  regions: WorldRegionActivity[];
  countries: D1VisitorOriginRecord[];
}

interface BaseMockOriginSeed {
  countryCode: string;
  countryName: string;
  flag: string;
  regionId: WorldRegionId;
  lat: number;
  lon: number;
  baseVisitors30d: number;
  baseExtractions30d: number;
  successRate: number;
  topPlatform: 'TikTok' | 'Instagram' | 'X (Twitter)' | 'Facebook' | 'LinkedIn';
}

export const WORLD_REGION_METADATA: Record<
  WorldRegionId,
  { name: string; shortName: string; centroidX: number; centroidY: number }
> = {
  europe: {
    name: 'Europe (Ouest & Centrale)',
    shortName: 'Europe',
    centroidX: 522,
    centroidY: 118,
  },
  mena_africa: {
    name: 'Afrique & Moyen-Orient (MENA)',
    shortName: 'Afrique & MENA',
    centroidX: 535,
    centroidY: 235,
  },
  north_america: {
    name: 'Amérique du Nord',
    shortName: 'Amérique du Nord',
    centroidX: 215,
    centroidY: 132,
  },
  latin_america: {
    name: 'Amérique Latine & Caraïbes',
    shortName: 'Amérique Latine',
    centroidX: 315,
    centroidY: 342,
  },
  asia_pacific: {
    name: 'Asie-Pacifique & Eurasie',
    shortName: 'Asie-Pacifique',
    centroidX: 785,
    centroidY: 210,
  },
};

export const D1_MOCK_ORIGIN_SEEDS: BaseMockOriginSeed[] = [
  {
    countryCode: 'FR',
    countryName: 'France',
    flag: '🇫🇷',
    regionId: 'europe',
    lat: 46.6,
    lon: 2.2,
    baseVisitors30d: 4820,
    baseExtractions30d: 9150,
    successRate: 96.4,
    topPlatform: 'TikTok',
  },
  {
    countryCode: 'MA',
    countryName: 'Maroc',
    flag: '🇲🇦',
    regionId: 'mena_africa',
    lat: 31.8,
    lon: -7.1,
    baseVisitors30d: 2640,
    baseExtractions30d: 5120,
    successRate: 95.1,
    topPlatform: 'Instagram',
  },
  {
    countryCode: 'US',
    countryName: 'États-Unis',
    flag: '🇺🇸',
    regionId: 'north_america',
    lat: 38.0,
    lon: -97.0,
    baseVisitors30d: 2390,
    baseExtractions30d: 4480,
    successRate: 94.8,
    topPlatform: 'TikTok',
  },
  {
    countryCode: 'DZ',
    countryName: 'Algérie',
    flag: '🇩🇿',
    regionId: 'mena_africa',
    lat: 28.0,
    lon: 1.7,
    baseVisitors30d: 1740,
    baseExtractions30d: 3310,
    successRate: 93.9,
    topPlatform: 'Facebook',
  },
  {
    countryCode: 'ES',
    countryName: 'Espagne',
    flag: '🇪🇸',
    regionId: 'europe',
    lat: 40.4,
    lon: -3.7,
    baseVisitors30d: 1580,
    baseExtractions30d: 2890,
    successRate: 95.7,
    topPlatform: 'Instagram',
  },
  {
    countryCode: 'BR',
    countryName: 'Brésil',
    flag: '🇧🇷',
    regionId: 'latin_america',
    lat: -14.2,
    lon: -51.9,
    baseVisitors30d: 1490,
    baseExtractions30d: 2760,
    successRate: 94.2,
    topPlatform: 'TikTok',
  },
  {
    countryCode: 'DE',
    countryName: 'Allemagne',
    flag: '🇩🇪',
    regionId: 'europe',
    lat: 51.2,
    lon: 10.4,
    baseVisitors30d: 1320,
    baseExtractions30d: 2410,
    successRate: 96.1,
    topPlatform: 'X (Twitter)',
  },
  {
    countryCode: 'CA',
    countryName: 'Canada',
    flag: '🇨🇦',
    regionId: 'north_america',
    lat: 54.0,
    lon: -105.0,
    baseVisitors30d: 1180,
    baseExtractions30d: 2190,
    successRate: 95.8,
    topPlatform: 'TikTok',
  },
  {
    countryCode: 'BE',
    countryName: 'Belgique',
    flag: '🇧🇪',
    regionId: 'europe',
    lat: 50.8,
    lon: 4.4,
    baseVisitors30d: 980,
    baseExtractions30d: 1840,
    successRate: 96.6,
    topPlatform: 'Instagram',
  },
  {
    countryCode: 'TN',
    countryName: 'Tunisie',
    flag: '🇹🇳',
    regionId: 'mena_africa',
    lat: 33.9,
    lon: 9.5,
    baseVisitors30d: 890,
    baseExtractions30d: 1670,
    successRate: 94.4,
    topPlatform: 'Facebook',
  },
  {
    countryCode: 'TR',
    countryName: 'Turquie',
    flag: '🇹🇷',
    regionId: 'mena_africa',
    lat: 38.9,
    lon: 35.2,
    baseVisitors30d: 840,
    baseExtractions30d: 1520,
    successRate: 92.8,
    topPlatform: 'Instagram',
  },
  {
    countryCode: 'ID',
    countryName: 'Indonésie',
    flag: '🇮🇩',
    regionId: 'asia_pacific',
    lat: -0.8,
    lon: 113.9,
    baseVisitors30d: 790,
    baseExtractions30d: 1480,
    successRate: 93.5,
    topPlatform: 'TikTok',
  },
  {
    countryCode: 'MX',
    countryName: 'Mexique',
    flag: '🇲🇽',
    regionId: 'latin_america',
    lat: 23.6,
    lon: -102.5,
    baseVisitors30d: 720,
    baseExtractions30d: 1310,
    successRate: 94.0,
    topPlatform: 'TikTok',
  },
  {
    countryCode: 'SN',
    countryName: 'Sénégal',
    flag: '🇸🇳',
    regionId: 'mena_africa',
    lat: 14.5,
    lon: -14.5,
    baseVisitors30d: 640,
    baseExtractions30d: 1190,
    successRate: 94.7,
    topPlatform: 'TikTok',
  },
  {
    countryCode: 'SA',
    countryName: 'Arabie saoudite',
    flag: '🇸🇦',
    regionId: 'mena_africa',
    lat: 23.9,
    lon: 45.1,
    baseVisitors30d: 590,
    baseExtractions30d: 1080,
    successRate: 93.2,
    topPlatform: 'X (Twitter)',
  },
  {
    countryCode: 'JP',
    countryName: 'Japon',
    flag: '🇯🇵',
    regionId: 'asia_pacific',
    lat: 36.2,
    lon: 138.2,
    baseVisitors30d: 510,
    baseExtractions30d: 940,
    successRate: 95.3,
    topPlatform: 'X (Twitter)',
  },
];

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function projectOriginToSvg(lat: number, lon: number): { svgX: number; svgY: number } {
  const clampedLon = Math.max(-180, Math.min(180, lon));
  const clampedLat = Math.max(-60, Math.min(75, lat));
  const svgX = roundOneDecimal(((clampedLon + 180) / 360) * 1000);
  const svgY = roundOneDecimal(((75 - clampedLat) / 135) * 500);
  return { svgX, svgY };
}

function resolveHeatTier(sharePct: number, rank: number): ActivityHeatTier {
  if (rank === 1 || sharePct >= 25) return 'hot';
  if (rank <= 2 || sharePct >= 14) return 'high';
  if (sharePct >= 6) return 'medium';
  return 'low';
}

export interface D1StatsSeedInput {
  counts?: {
    today?: number;
    last7d?: number;
    last30d?: number;
  };
  funnel?: {
    extractSuccessRate?: number;
  };
}

/**
 * Builds the D1 visitor origin & regional activity dataset for the SVG World Map.
 * Uses D1 database counts when available to scale the mock regional distribution,
 * or falls back to the baseline D1 mock dataset so the map always highlights active regions.
 */
export function buildD1VisitorsMapSummary(
  period: VisitorsMapPeriod = '30d',
  d1Stats?: D1StatsSeedInput | null
): VisitorsMapSummary {
  const periodFactor = period === 'today' ? 0.045 : period === '7d' ? 0.28 : 1;

  const baseSumExtractions = D1_MOCK_ORIGIN_SEEDS.reduce(
    (acc, s) => acc + Math.max(1, Math.round(s.baseExtractions30d * periodFactor)),
    0
  );

  const d1PeriodCount =
    period === 'today'
      ? Number(d1Stats?.counts?.today || 0)
      : period === '7d'
      ? Number(d1Stats?.counts?.last7d || 0)
      : Number(d1Stats?.counts?.last30d || 0);

  const hasD1Scale = d1PeriodCount > 0;
  const scaleMultiplier = hasD1Scale
    ? Math.max(0.25, d1PeriodCount / Math.max(1, baseSumExtractions))
    : 1;

  const rawCountries = D1_MOCK_ORIGIN_SEEDS.map((seed) => {
    const scaledExtractions = Math.max(
      1,
      Math.round(seed.baseExtractions30d * periodFactor * scaleMultiplier)
    );
    const scaledVisitors = Math.max(
      1,
      Math.round(seed.baseVisitors30d * periodFactor * scaleMultiplier)
    );
    const { svgX, svgY } = projectOriginToSvg(seed.lat, seed.lon);
    return {
      ...seed,
      svgX,
      svgY,
      visitors: scaledVisitors,
      extractions: scaledExtractions,
    };
  }).sort((a, b) => b.visitors - a.visitors);

  const totalVisitors = rawCountries.reduce((acc, c) => acc + c.visitors, 0);
  const totalExtractions = rawCountries.reduce((acc, c) => acc + c.extractions, 0);

  const countries: D1VisitorOriginRecord[] = rawCountries.map((c, idx) => {
    const sharePct =
      totalVisitors > 0 ? roundOneDecimal((c.visitors / totalVisitors) * 100) : 0;
    return {
      countryCode: c.countryCode,
      countryName: c.countryName,
      flag: c.flag,
      regionId: c.regionId,
      lat: c.lat,
      lon: c.lon,
      svgX: c.svgX,
      svgY: c.svgY,
      visitors: c.visitors,
      extractions: c.extractions,
      successRate: c.successRate,
      topPlatform: c.topPlatform,
      sharePct,
      heatTier: resolveHeatTier(sharePct, idx + 1),
    };
  });

  const regionIds = Object.keys(WORLD_REGION_METADATA) as WorldRegionId[];
  const unrankedRegions = regionIds
    .map((regionId) => {
      const meta = WORLD_REGION_METADATA[regionId];
      const memberCountries = countries.filter((c) => c.regionId === regionId);
      const visitors = memberCountries.reduce((acc, c) => acc + c.visitors, 0);
      const extractions = memberCountries.reduce((acc, c) => acc + c.extractions, 0);
      const weightedSuccess = memberCountries.reduce(
        (acc, c) => acc + c.successRate * c.extractions,
        0
      );
      const avgSuccessRate =
        extractions > 0 ? roundOneDecimal(weightedSuccess / extractions) : 95;
      const topMember = memberCountries[0];
      const sharePct =
        totalVisitors > 0 ? roundOneDecimal((visitors / totalVisitors) * 100) : 0;

      return {
        regionId,
        name: meta.name,
        shortName: meta.shortName,
        visitors,
        extractions,
        sharePct,
        avgSuccessRate,
        countryCount: memberCountries.length,
        topCountry: topMember?.countryName || '—',
        topCountryFlag: topMember?.flag || '🌐',
        centroidX: meta.centroidX,
        centroidY: meta.centroidY,
      };
    })
    .sort((a, b) => b.visitors - a.visitors);

  const regions: WorldRegionActivity[] = unrankedRegions.map((reg, index) => ({
    ...reg,
    rank: index + 1,
    isTopRegion: index === 0,
    heatTier: resolveHeatTier(reg.sharePct, index + 1),
  }));

  const weightedGlobalSuccess = countries.reduce(
    (acc, c) => acc + c.successRate * c.extractions,
    0
  );
  const globalSuccessRate =
    typeof d1Stats?.funnel?.extractSuccessRate === 'number' &&
    d1Stats.funnel.extractSuccessRate > 0
      ? roundOneDecimal(d1Stats.funnel.extractSuccessRate)
      : totalExtractions > 0
      ? roundOneDecimal(weightedGlobalSuccess / totalExtractions)
      : 95.2;

  return {
    period,
    source: hasD1Scale ? 'd1-scaled-mock' : 'd1-default-mock',
    totalVisitors,
    totalExtractions,
    globalSuccessRate,
    mostActiveRegion: regions[0],
    mostActiveCountry: countries[0],
    regions,
    countries,
  };
}
