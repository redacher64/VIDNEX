export type GeoRegionKey = 'all' | 'europe' | 'africa_mena' | 'americas' | 'asia_oceania';

export type GeoMetricMode = 'requests' | 'bytes' | 'threats';

export interface CountryGeoMetadata {
  code: string;
  nameFr: string;
  lat: number;
  lon: number;
  region: Exclude<GeoRegionKey, 'all'>;
}

export interface GeoInputCountryRow {
  countryCode: string;
  countryName?: string;
  flag?: string;
  requests: number;
  percentage?: number;
  bytes?: number;
  threats?: number;
}

export interface EnrichedMapCountryPoint {
  countryCode: string;
  countryName: string;
  flag: string;
  region: Exclude<GeoRegionKey, 'all'>;
  regionLabel: string;
  lat: number;
  lon: number;
  /** SVG X coordinate on a 1000x500 viewBox */
  svgX: number;
  /** SVG Y coordinate on a 1000x500 viewBox */
  svgY: number;
  requests: number;
  percentage: number;
  bytes: number;
  threats: number;
  avgBytesPerRequest: number;
  radius: number;
  intensity: number;
}

export interface RegionTrafficSummary {
  region: Exclude<GeoRegionKey, 'all'>;
  label: string;
  requests: number;
  bytes: number;
  threats: number;
  countryCount: number;
  percentage: number;
}

export interface ExtendedVisitorMetrics {
  availabilityRatePct: number;
  originRequests: number;
  originRatePct: number;
  savedBytes: number;
  originBytes: number;
  avgBytesPerRequest: number;
  requestsPerUniqueVisitor: number;
  pageViewsPerUniqueVisitor: number;
  subrequestsPerInvocation: number;
  threatRatePct: number;
  topCountrySharePct: number;
  top3ConcentrationPct: number;
}

export const REGION_LABELS: Record<Exclude<GeoRegionKey, 'all'>, string> = {
  europe: 'Europe',
  africa_mena: 'Afrique & Moyen-Orient',
  americas: 'Amériques',
  asia_oceania: 'Asie & Océanie',
};

export const COUNTRY_GEO_DATABASE: Record<string, CountryGeoMetadata> = {
  FR: { code: 'FR', nameFr: 'France', lat: 46.6, lon: 2.2, region: 'europe' },
  BE: { code: 'BE', nameFr: 'Belgique', lat: 50.8, lon: 4.4, region: 'europe' },
  CH: { code: 'CH', nameFr: 'Suisse', lat: 46.8, lon: 8.2, region: 'europe' },
  DE: { code: 'DE', nameFr: 'Allemagne', lat: 51.2, lon: 10.4, region: 'europe' },
  ES: { code: 'ES', nameFr: 'Espagne', lat: 40.4, lon: -3.7, region: 'europe' },
  IT: { code: 'IT', nameFr: 'Italie', lat: 42.5, lon: 12.5, region: 'europe' },
  GB: { code: 'GB', nameFr: 'Royaume-Uni', lat: 54.0, lon: -2.0, region: 'europe' },
  PT: { code: 'PT', nameFr: 'Portugal', lat: 39.4, lon: -8.2, region: 'europe' },
  NL: { code: 'NL', nameFr: 'Pays-Bas', lat: 52.3, lon: 5.3, region: 'europe' },
  LU: { code: 'LU', nameFr: 'Luxembourg', lat: 49.8, lon: 6.1, region: 'europe' },
  IE: { code: 'IE', nameFr: 'Irlande', lat: 53.3, lon: -8.0, region: 'europe' },
  PL: { code: 'PL', nameFr: 'Pologne', lat: 52.0, lon: 19.1, region: 'europe' },
  SE: { code: 'SE', nameFr: 'Suède', lat: 60.1, lon: 18.6, region: 'europe' },
  NO: { code: 'NO', nameFr: 'Norvège', lat: 60.5, lon: 8.5, region: 'europe' },
  DK: { code: 'DK', nameFr: 'Danemark', lat: 56.2, lon: 9.5, region: 'europe' },
  FI: { code: 'FI', nameFr: 'Finlande', lat: 61.9, lon: 25.7, region: 'europe' },
  AT: { code: 'AT', nameFr: 'Autriche', lat: 47.5, lon: 14.5, region: 'europe' },
  GR: { code: 'GR', nameFr: 'Grèce', lat: 39.1, lon: 21.8, region: 'europe' },
  RO: { code: 'RO', nameFr: 'Roumanie', lat: 45.9, lon: 24.9, region: 'europe' },
  CZ: { code: 'CZ', nameFr: 'Tchéquie', lat: 49.8, lon: 15.5, region: 'europe' },
  HU: { code: 'HU', nameFr: 'Hongrie', lat: 47.2, lon: 19.5, region: 'europe' },
  UA: { code: 'UA', nameFr: 'Ukraine', lat: 48.4, lon: 31.2, region: 'europe' },
  RU: { code: 'RU', nameFr: 'Russie', lat: 55.8, lon: 37.6, region: 'europe' },

  // Afrique & Moyen-Orient
  MA: { code: 'MA', nameFr: 'Maroc', lat: 31.8, lon: -7.1, region: 'africa_mena' },
  DZ: { code: 'DZ', nameFr: 'Algérie', lat: 28.0, lon: 1.7, region: 'africa_mena' },
  TN: { code: 'TN', nameFr: 'Tunisie', lat: 33.9, lon: 9.5, region: 'africa_mena' },
  SN: { code: 'SN', nameFr: 'Sénégal', lat: 14.5, lon: -14.5, region: 'africa_mena' },
  CI: { code: 'CI', nameFr: 'Côte d’Ivoire', lat: 7.5, lon: -5.5, region: 'africa_mena' },
  CM: { code: 'CM', nameFr: 'Cameroun', lat: 7.4, lon: 12.4, region: 'africa_mena' },
  NG: { code: 'NG', nameFr: 'Nigeria', lat: 9.1, lon: 8.7, region: 'africa_mena' },
  EG: { code: 'EG', nameFr: 'Égypte', lat: 26.8, lon: 30.8, region: 'africa_mena' },
  ZA: { code: 'ZA', nameFr: 'Afrique du Sud', lat: -30.6, lon: 22.9, region: 'africa_mena' },
  KE: { code: 'KE', nameFr: 'Kenya', lat: -0.02, lon: 37.9, region: 'africa_mena' },
  GH: { code: 'GH', nameFr: 'Ghana', lat: 7.9, lon: -1.0, region: 'africa_mena' },
  MG: { code: 'MG', nameFr: 'Madagascar', lat: -18.8, lon: 46.9, region: 'africa_mena' },
  ML: { code: 'ML', nameFr: 'Mali', lat: 17.6, lon: -4.0, region: 'africa_mena' },
  BF: { code: 'BF', nameFr: 'Burkina Faso', lat: 12.2, lon: -1.6, region: 'africa_mena' },
  NE: { code: 'NE', nameFr: 'Niger', lat: 17.6, lon: 8.1, region: 'africa_mena' },
  TG: { code: 'TG', nameFr: 'Togo', lat: 8.6, lon: 0.8, region: 'africa_mena' },
  BJ: { code: 'BJ', nameFr: 'Bénin', lat: 9.3, lon: 2.3, region: 'africa_mena' },
  GN: { code: 'GN', nameFr: 'Guinée', lat: 9.9, lon: -9.7, region: 'africa_mena' },
  CD: { code: 'CD', nameFr: 'RD Congo', lat: -4.0, lon: 21.8, region: 'africa_mena' },
  CG: { code: 'CG', nameFr: 'Congo', lat: -0.2, lon: 15.8, region: 'africa_mena' },
  GA: { code: 'GA', nameFr: 'Gabon', lat: -0.8, lon: 11.6, region: 'africa_mena' },
  MU: { code: 'MU', nameFr: 'Maurice', lat: -20.3, lon: 57.6, region: 'africa_mena' },
  RE: { code: 'RE', nameFr: 'La Réunion', lat: -21.1, lon: 55.5, region: 'africa_mena' },
  TR: { code: 'TR', nameFr: 'Turquie', lat: 38.9, lon: 35.2, region: 'africa_mena' },
  SA: { code: 'SA', nameFr: 'Arabie saoudite', lat: 23.9, lon: 45.1, region: 'africa_mena' },
  AE: { code: 'AE', nameFr: 'Émirats arabes unis', lat: 23.4, lon: 53.8, region: 'africa_mena' },
  QA: { code: 'QA', nameFr: 'Qatar', lat: 25.3, lon: 51.2, region: 'africa_mena' },
  KW: { code: 'KW', nameFr: 'Koweït', lat: 29.3, lon: 47.5, region: 'africa_mena' },
  LB: { code: 'LB', nameFr: 'Liban', lat: 33.9, lon: 35.9, region: 'africa_mena' },
  IL: { code: 'IL', nameFr: 'Israël', lat: 31.0, lon: 34.9, region: 'africa_mena' },

  // Amériques
  US: { code: 'US', nameFr: 'États-Unis', lat: 38.0, lon: -97.0, region: 'americas' },
  CA: { code: 'CA', nameFr: 'Canada', lat: 56.1, lon: -106.3, region: 'americas' },
  MX: { code: 'MX', nameFr: 'Mexique', lat: 23.6, lon: -102.5, region: 'americas' },
  BR: { code: 'BR', nameFr: 'Brésil', lat: -14.2, lon: -51.9, region: 'americas' },
  AR: { code: 'AR', nameFr: 'Argentine', lat: -38.4, lon: -63.6, region: 'americas' },
  CO: { code: 'CO', nameFr: 'Colombie', lat: 4.6, lon: -74.3, region: 'americas' },
  CL: { code: 'CL', nameFr: 'Chili', lat: -35.7, lon: -71.5, region: 'americas' },
  PE: { code: 'PE', nameFr: 'Pérou', lat: -9.2, lon: -75.0, region: 'americas' },
  VE: { code: 'VE', nameFr: 'Venezuela', lat: 6.4, lon: -66.6, region: 'americas' },
  HT: { code: 'HT', nameFr: 'Haïti', lat: 19.0, lon: -72.3, region: 'americas' },
  GP: { code: 'GP', nameFr: 'Guadeloupe', lat: 16.2, lon: -61.6, region: 'americas' },
  MQ: { code: 'MQ', nameFr: 'Martinique', lat: 14.6, lon: -61.0, region: 'americas' },
  GF: { code: 'GF', nameFr: 'Guyane française', lat: 3.9, lon: -53.1, region: 'americas' },

  // Asie & Océanie
  IN: { code: 'IN', nameFr: 'Inde', lat: 20.6, lon: 78.9, region: 'asia_oceania' },
  ID: { code: 'ID', nameFr: 'Indonésie', lat: -0.8, lon: 113.9, region: 'asia_oceania' },
  JP: { code: 'JP', nameFr: 'Japon', lat: 36.2, lon: 138.2, region: 'asia_oceania' },
  KR: { code: 'KR', nameFr: 'Corée du Sud', lat: 35.9, lon: 127.8, region: 'asia_oceania' },
  CN: { code: 'CN', nameFr: 'Chine', lat: 35.9, lon: 104.2, region: 'asia_oceania' },
  VN: { code: 'VN', nameFr: 'Viêt Nam', lat: 14.1, lon: 108.3, region: 'asia_oceania' },
  TH: { code: 'TH', nameFr: 'Thaïlande', lat: 15.9, lon: 100.9, region: 'asia_oceania' },
  MY: { code: 'MY', nameFr: 'Malaisie', lat: 4.2, lon: 101.9, region: 'asia_oceania' },
  PH: { code: 'PH', nameFr: 'Philippines', lat: 12.9, lon: 121.8, region: 'asia_oceania' },
  SG: { code: 'SG', nameFr: 'Singapour', lat: 1.35, lon: 103.8, region: 'asia_oceania' },
  PK: { code: 'PK', nameFr: 'Pakistan', lat: 30.4, lon: 69.3, region: 'asia_oceania' },
  BD: { code: 'BD', nameFr: 'Bangladesh', lat: 23.7, lon: 90.4, region: 'asia_oceania' },
  AU: { code: 'AU', nameFr: 'Australie', lat: -25.3, lon: 133.8, region: 'asia_oceania' },
  NZ: { code: 'NZ', nameFr: 'Nouvelle-Zélande', lat: -40.9, lon: 174.9, region: 'asia_oceania' },
};

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function isoToEmojiFlag(code: string): string {
  const clean = (code || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(clean)) return '🌐';
  return String.fromCodePoint(
    clean.charCodeAt(0) + 127397,
    clean.charCodeAt(1) + 127397
  );
}

/**
 * Projects geographic (lat, lon) onto a 1000x500 SVG canvas.
 * Latitude range: +75 to -60 (trimmed polar caps for better continent focus).
 * Longitude range: -180 to +180.
 */
export function projectLatLonToSvg(lat: number, lon: number): { svgX: number; svgY: number } {
  const clampedLon = Math.max(-180, Math.min(180, lon));
  const clampedLat = Math.max(-60, Math.min(75, lat));
  const svgX = roundOneDecimal(((clampedLon + 180) / 360) * 1000);
  const svgY = roundOneDecimal(((75 - clampedLat) / 135) * 500);
  return { svgX, svgY };
}

/**
 * Deterministic fallback coordinates for any 2-letter ISO code not in COUNTRY_GEO_DATABASE.
 */
function fallbackMetadataForIso(code: string, providedName?: string): CountryGeoMetadata {
  const upper = (code || 'XX').toUpperCase();
  const c1 = upper.charCodeAt(0) || 65;
  const c2 = upper.charCodeAt(1) || 65;
  const lat = ((c1 * 17 + c2 * 7) % 90) - 35;
  const lon = ((c1 * 31 + c2 * 13) % 260) - 120;
  const region: Exclude<GeoRegionKey, 'all'> =
    lon < -30 ? 'americas' : lon > 60 ? 'asia_oceania' : lat > 35 ? 'europe' : 'africa_mena';
  return {
    code: upper,
    nameFr: providedName || upper,
    lat,
    lon,
    region,
  };
}

export function computeGeoMapAnalytics(
  countries: GeoInputCountryRow[] | undefined | null,
  mode: GeoMetricMode = 'requests'
): {
  points: EnrichedMapCountryPoint[];
  regions: RegionTrafficSummary[];
  totalRequests: number;
  totalBytes: number;
  totalThreats: number;
} {
  const rawList = Array.isArray(countries) ? countries : [];
  const totalRequests = rawList.reduce((acc, c) => acc + Math.max(0, Number(c.requests || 0)), 0);
  const totalBytes = rawList.reduce((acc, c) => acc + Math.max(0, Number(c.bytes || 0)), 0);
  const totalThreats = rawList.reduce((acc, c) => acc + Math.max(0, Number(c.threats || 0)), 0);

  const maxMetricValue = Math.max(
    1,
    ...rawList.map((c) =>
      mode === 'bytes'
        ? Math.max(0, Number(c.bytes || 0))
        : mode === 'threats'
        ? Math.max(0, Number(c.threats || 0))
        : Math.max(0, Number(c.requests || 0))
    )
  );

  const regionBuckets: Record<
    Exclude<GeoRegionKey, 'all'>,
    { requests: number; bytes: number; threats: number; countryCount: number }
  > = {
    europe: { requests: 0, bytes: 0, threats: 0, countryCount: 0 },
    africa_mena: { requests: 0, bytes: 0, threats: 0, countryCount: 0 },
    americas: { requests: 0, bytes: 0, threats: 0, countryCount: 0 },
    asia_oceania: { requests: 0, bytes: 0, threats: 0, countryCount: 0 },
  };

  const points: EnrichedMapCountryPoint[] = rawList
    .filter((c) => (c.requests || 0) > 0 || (c.bytes || 0) > 0 || (c.threats || 0) > 0)
    .map((row) => {
      const code = (row.countryCode || 'XX').trim().toUpperCase();
      const meta = COUNTRY_GEO_DATABASE[code] || fallbackMetadataForIso(code, row.countryName);
      const { svgX, svgY } = projectLatLonToSvg(meta.lat, meta.lon);
      const requests = Math.max(0, Number(row.requests || 0));
      const bytes = Math.max(0, Number(row.bytes || 0));
      const threats = Math.max(0, Number(row.threats || 0));
      const percentage =
        typeof row.percentage === 'number' && row.percentage > 0
          ? roundOneDecimal(row.percentage)
          : totalRequests > 0
          ? roundOneDecimal((requests / totalRequests) * 100)
          : 0;

      const metricValue =
        mode === 'bytes' ? bytes : mode === 'threats' ? threats : requests;
      const intensity = Math.min(1, Math.max(0.08, metricValue / maxMetricValue));
      // Logarithmic + linear blend so both #1 and mid-tier countries are clearly visible
      const radius = roundOneDecimal(5 + Math.sqrt(intensity) * 18);

      regionBuckets[meta.region].requests += requests;
      regionBuckets[meta.region].bytes += bytes;
      regionBuckets[meta.region].threats += threats;
      regionBuckets[meta.region].countryCount += 1;

      return {
        countryCode: code,
        countryName: row.countryName || meta.nameFr,
        flag: row.flag || isoToEmojiFlag(code),
        region: meta.region,
        regionLabel: REGION_LABELS[meta.region],
        lat: meta.lat,
        lon: meta.lon,
        svgX,
        svgY,
        requests,
        percentage,
        bytes,
        threats,
        avgBytesPerRequest: requests > 0 ? Math.round(bytes / requests) : 0,
        radius,
        intensity: roundOneDecimal(intensity * 100),
      };
    })
    .sort((a, b) => b.requests - a.requests);

  const regions: RegionTrafficSummary[] = (
    Object.keys(REGION_LABELS) as Array<Exclude<GeoRegionKey, 'all'>>
  )
    .map((key) => {
      const bucket = regionBuckets[key];
      return {
        region: key,
        label: REGION_LABELS[key],
        requests: bucket.requests,
        bytes: bucket.bytes,
        threats: bucket.threats,
        countryCount: bucket.countryCount,
        percentage:
          totalRequests > 0 ? roundOneDecimal((bucket.requests / totalRequests) * 100) : 0,
      };
    })
    .sort((a, b) => b.requests - a.requests);

  return {
    points,
    regions,
    totalRequests,
    totalBytes,
    totalThreats,
  };
}

export function computeExtendedVisitorMetrics(input: {
  totalRequests?: number;
  uniqueVisitors?: number;
  pageViews?: number;
  cachedRequests?: number;
  totalBytes?: number;
  cachedBytes?: number;
  threats?: number;
  statusCodes?: {
    status2xx?: number;
    status3xx?: number;
    status4xx?: number;
    status5xx?: number;
  };
  workerMetrics?: {
    invocations?: number;
    subrequests?: number;
  };
  countries?: Array<{ requests: number; percentage?: number }>;
}): ExtendedVisitorMetrics {
  const totalRequests = Math.max(0, Number(input.totalRequests || 0));
  const uniqueVisitors = Math.max(0, Number(input.uniqueVisitors || 0));
  const pageViews = Math.max(0, Number(input.pageViews || 0));
  const cachedRequests = Math.min(totalRequests, Math.max(0, Number(input.cachedRequests || 0)));
  const originRequests = Math.max(0, totalRequests - cachedRequests);
  const originRatePct =
    totalRequests > 0 ? roundOneDecimal((originRequests / totalRequests) * 100) : 0;

  const totalBytes = Math.max(0, Number(input.totalBytes || 0));
  const cachedBytes = Math.min(totalBytes, Math.max(0, Number(input.cachedBytes || 0)));
  const originBytes = Math.max(0, totalBytes - cachedBytes);
  const avgBytesPerRequest = totalRequests > 0 ? Math.round(totalBytes / totalRequests) : 0;

  const threats = Math.max(0, Number(input.threats || 0));
  const threatRatePct =
    totalRequests > 0 ? Math.round((threats / totalRequests) * 10000) / 100 : 0;

  const s2 = Math.max(0, Number(input.statusCodes?.status2xx || 0));
  const s3 = Math.max(0, Number(input.statusCodes?.status3xx || 0));
  const s4 = Math.max(0, Number(input.statusCodes?.status4xx || 0));
  const s5 = Math.max(0, Number(input.statusCodes?.status5xx || 0));
  const sTotal = s2 + s3 + s4 + s5;
  const availabilityRatePct =
    sTotal > 0 ? roundOneDecimal(((s2 + s3 + s4) / sTotal) * 100) : 100;

  const requestsPerUniqueVisitor =
    uniqueVisitors > 0 ? roundOneDecimal(totalRequests / uniqueVisitors) : 0;
  const pageViewsPerUniqueVisitor =
    uniqueVisitors > 0 ? roundOneDecimal(pageViews / uniqueVisitors) : 0;

  const invocations = Math.max(0, Number(input.workerMetrics?.invocations || 0));
  const subrequests = Math.max(0, Number(input.workerMetrics?.subrequests || 0));
  const subrequestsPerInvocation =
    invocations > 0 ? roundOneDecimal(subrequests / invocations) : 0;

  const countries = Array.isArray(input.countries) ? input.countries : [];
  const top1Req = countries[0]?.requests || 0;
  const top3Req = countries.slice(0, 3).reduce((acc, c) => acc + (c.requests || 0), 0);

  const topCountrySharePct =
    totalRequests > 0 ? roundOneDecimal((top1Req / totalRequests) * 100) : 0;
  const top3ConcentrationPct =
    totalRequests > 0 ? roundOneDecimal((top3Req / totalRequests) * 100) : 0;

  return {
    availabilityRatePct,
    originRequests,
    originRatePct,
    savedBytes: cachedBytes,
    originBytes,
    avgBytesPerRequest,
    requestsPerUniqueVisitor,
    pageViewsPerUniqueVisitor,
    subrequestsPerInvocation,
    threatRatePct,
    topCountrySharePct,
    top3ConcentrationPct,
  };
}
