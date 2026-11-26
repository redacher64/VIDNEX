import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import {
  computeDailyUsageSummary,
  type WidgetStatsInput,
  type WidgetDailyBucket,
  type WidgetHourlyBucket,
} from './dashboardWidgetLogic.ts';
import { getCountryNameFr } from './worldCountriesGeo.ts';

const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30);

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  instagram_profile: 'Profil Instagram',
  x: 'X (Twitter)',
  twitter: 'X (Twitter)',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  unknown: 'Inconnue',
};

const CATEGORY_LABELS: Record<string, string> = {
  search: 'Recherche',
  direct: 'Direct',
  social: 'Réseaux sociaux',
  other: 'Autres sites',
};

export interface ExcelCellSpec {
  type: 'string' | 'number' | 'date' | 'datetime' | 'time' | 'percent';
  value: string | number;
  numFmt?: string;
}

export type ExcelRowSpec = Array<ExcelCellSpec | string | number>;

export interface ExcelSheetSpec {
  name: string;
  rows: ExcelRowSpec[];
  boldRows: number[]; // 1-indexed row numbers to render bold with header fill
  autoFilterRef: string; // e.g. "A1:F31"
  minColWidths?: number[];
}

export interface AdminStatsWorkbookModel {
  filename: string;
  sheets: ExcelSheetSpec[];
}

function formatPlatformLabel(platform: string): string {
  const key = (platform || 'unknown').toLowerCase();
  return PLATFORM_LABELS[key] || platform || 'Inconnue';
}

function strCell(value: string): ExcelCellSpec {
  return { type: 'string', value };
}

function intCell(value: number): ExcelCellSpec {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  return { type: 'number', value: safe, numFmt: '#,##0' };
}

function decCell(value: number, numFmt = '0.0'): ExcelCellSpec {
  const safe = Number.isFinite(value) ? value : 0;
  return { type: 'number', value: safe, numFmt };
}

function pctCell(ratio: number): ExcelCellSpec {
  const safe = Number.isFinite(ratio) ? Math.max(0, ratio) : 0;
  return { type: 'percent', value: safe, numFmt: '0.0%' };
}

export function isoDayToExcelSerial(isoDay: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((isoDay || '').trim());
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const utcMs = Date.UTC(year, month - 1, day, 0, 0, 0);
  if (!Number.isFinite(utcMs)) return null;
  return (utcMs - EXCEL_EPOCH_UTC_MS) / 86_400_000;
}

export function timestampToExcelSerialUtc(tsMs: number): number | null {
  if (!Number.isFinite(tsMs) || tsMs <= 0) return null;
  return (tsMs - EXCEL_EPOCH_UTC_MS) / 86_400_000;
}

function dateCell(isoDay: string): ExcelCellSpec {
  const serial = isoDayToExcelSerial(isoDay);
  if (serial === null) return strCell(isoDay || 'Aucune donnée');
  return { type: 'date', value: serial, numFmt: 'yyyy-mm-dd' };
}

function dateTimeCell(tsMs: number): ExcelCellSpec {
  const serial = timestampToExcelSerialUtc(tsMs);
  if (serial === null) return strCell('—');
  return { type: 'datetime', value: serial, numFmt: 'yyyy-mm-dd hh:mm:ss' };
}

function timeHourCell(hour: number): ExcelCellSpec {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  return { type: 'time', value: h / 24, numFmt: 'hh:mm' };
}

/**
 * Converts a UTC hour (0..23) to Morocco local time (permanent UTC+1 / GMT+1).
 */
export function getMoroccoHourForUtc(_isoDay: string, utcHour: number): number {
  const h = ((Math.floor(utcHour) % 24) + 24) % 24;
  return (h + 1) % 24;
}

function colIndexToLetter(colIndexZeroBased: number): string {
  let n = colIndexZeroBased + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function makeRangeRef(lastColIndexZeroBased: number, lastRowOneBased: number): string {
  return `A1:${colIndexToLetter(lastColIndexZeroBased)}${Math.max(1, lastRowOneBased)}`;
}

function resolveDaily30(input: WidgetStatsInput | null | undefined): WidgetDailyBucket[] {
  const raw = Array.isArray(input?.daily) ? input!.daily : [];
  if (raw.length === 0) return [];
  return [...raw].sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * Builds the 7-sheet structured workbook model strictly from D1 data (always 30 full days).
 */
export function buildAdminStatsWorkbookData(
  input: WidgetStatsInput | null | undefined,
  nowDate?: Date
): AdminStatsWorkbookModel {
  const summary = computeDailyUsageSummary(input);
  const dateStamp =
    (summary.today.day && /^\d{4}-\d{2}-\d{2}$/.test(summary.today.day)
      ? summary.today.day
      : (nowDate || new Date()).toISOString().slice(0, 10));
  const filename = `vidnex-stats-${dateStamp}.xlsx`;

  const daily30 = resolveDaily30(input);
  const geo30 = input?.geo?.periods?.['30d'];
  const funnel = input?.funnel;
  const rawPlatforms = input?.platforms || {};

  // Compute 30-day Direct vs Tiers totals from D1 platforms payload
  let direct30 = 0;
  let tiers30 = 0;
  for (const st of Object.values(rawPlatforms)) {
    if (!st) continue;
    direct30 += Math.max(0, Number(st.stage?.direct ?? st.direct ?? 0));
    tiers30 += Math.max(0, Number(st.stage?.tiers ?? st.tiers ?? 0));
  }
  const stageTotal30 = direct30 + tiers30;
  const directShare30 = stageTotal30 > 0 ? direct30 / stageTotal30 : 0;
  const tiersShare30 = stageTotal30 > 0 ? tiers30 / stageTotal30 : 0;

  const humanVisits30 = Math.max(0, Number(geo30?.humanVisits ?? 0));
  const botVisits30 = Math.max(0, Number(geo30?.botVisits ?? 0));
  const totalVisits30 = humanVisits30 + botVisits30;
  const humanShare30 = totalVisits30 > 0 ? humanVisits30 / totalVisits30 : 0;

  const total30 = summary.last30d.total;
  const success30 = summary.last30d.success;
  const error30 = summary.last30d.error;
  const successRate30 = total30 > 0 ? success30 / total30 : 0;
  const avgHourly30 = total30 / (Math.max(1, daily30.length || 30) * 24);
  const topError = summary.topErrors[0];

  // =========================================================================
  // 1. Feuille "Résumé"
  // =========================================================================
  const resumeHeader: ExcelRowSpec = ['Indicateur', 'Valeur', 'Unité / Détail', 'Période'];
  const resumeRows: ExcelRowSpec[] = [resumeHeader];
  if (!input) {
    resumeRows.push(['Aucune donnée']);
  } else {
    resumeRows.push(
      ['Appels API', intCell(total30), 'requêtes', '30 derniers jours'],
      ['Succès', intCell(success30), 'extractions réussies', '30 derniers jours'],
      ['Échecs', intCell(error30), 'extractions en échec', '30 derniers jours'],
      ['Taux de succès', pctCell(successRate30), 'succès / appels', '30 derniers jours'],
      ['Pic journalier (volume)', intCell(summary.last30d.peakTotal), 'requêtes / jour', '30 derniers jours'],
      [
        'Pic journalier (date)',
        summary.last30d.peakDay ? dateCell(summary.last30d.peakDay) : strCell('Aucune donnée'),
        'UTC',
        '30 derniers jours',
      ],
      ['Vitesse horaire (actuelle)', decCell(summary.today.hourlyVelocity, '0.0'), 'req / heure', "Aujourd'hui (UTC)"],
      ['Vitesse horaire moyenne', decCell(avgHourly30, '0.00'), 'req / heure', '30 derniers jours'],
      ['Top erreur (code)', strCell(topError ? topError.code : 'Aucune erreur'), 'code erreur', '30 derniers jours'],
      ['Top erreur (occurrences)', intCell(topError ? topError.count : 0), 'échecs', '30 derniers jours'],
      ['Moteurs Direct', intCell(direct30), 'extractions directes', '30 derniers jours'],
      ['Moteurs Tiers', intCell(tiers30), 'extractions tiers', '30 derniers jours'],
      ['Part Direct', pctCell(directShare30), 'Direct / (Direct + Tiers)', '30 derniers jours'],
      ['Part Tiers', pctCell(tiersShare30), 'Tiers / (Direct + Tiers)', '30 derniers jours'],
      ['Visiteurs humains', intCell(humanVisits30), 'visites filtrées', '30 derniers jours'],
      ['Visiteurs bots', intCell(botVisits30), 'robots détectés', '30 derniers jours'],
      ['Total visites', intCell(totalVisits30), 'humains + bots', '30 derniers jours'],
      ['Part trafic humain', pctCell(humanShare30), 'humains / total visites', '30 derniers jours']
    );
  }
  const sheetResume: ExcelSheetSpec = {
    name: 'Résumé',
    rows: resumeRows,
    boldRows: [1],
    autoFilterRef: makeRangeRef(3, resumeRows.length),
    minColWidths: [28, 22, 26, 20],
  };

  // =========================================================================
  // 2. Feuille "Par jour" (toujours 30 jours complets)
  // =========================================================================
  const dailyHeader: ExcelRowSpec = [
    'Date',
    'Appels',
    'Succès',
    'Échecs',
    'Téléchargements',
    'Taux de succès (%)',
  ];
  const dailyRows: ExcelRowSpec[] = [dailyHeader];
  if (daily30.length === 0) {
    dailyRows.push(['Aucune donnée']);
  } else {
    for (const d of daily30) {
      const total = Math.max(0, Number(d.total || 0));
      const success = Math.max(0, Number(d.success || 0));
      const error = Math.max(0, Number(d.error || 0));
      const downloads = Math.max(0, Number(d.download_success || 0));
      const rate = total > 0 ? success / total : 0;
      dailyRows.push([
        dateCell(d.day),
        intCell(total),
        intCell(success),
        intCell(error),
        intCell(downloads),
        pctCell(rate),
      ]);
    }
  }
  const sheetDaily: ExcelSheetSpec = {
    name: 'Par jour',
    rows: dailyRows,
    boldRows: [1],
    autoFilterRef: makeRangeRef(5, dailyRows.length),
    minColWidths: [14, 12, 12, 12, 18, 18],
  };

  // =========================================================================
  // 3. Feuille "Par heure" (30 jours × 24h = 720 lignes, heures à 0 incluses)
  // =========================================================================
  const hourlyHeader: ExcelRowSpec = [
    'Date',
    'Heure UTC',
    'Heure Maroc',
    'Appels',
    'Succès',
    'Échecs',
    'Taux (%)',
  ];
  const hourlyRows: ExcelRowSpec[] = [hourlyHeader];
  const hourlyLookup = new Map<string, WidgetHourlyBucket>();
  if (Array.isArray(input?.hourly)) {
    for (const h of input!.hourly!) {
      if (!h?.day) continue;
      const hr = Math.max(0, Math.min(23, Math.floor(Number(h.hour) || 0)));
      hourlyLookup.set(`${h.day}::${hr}`, h);
    }
  }

  if (daily30.length === 0 && hourlyLookup.size === 0) {
    hourlyRows.push(['Aucune donnée']);
  } else {
    const daysToExpand =
      daily30.length > 0
        ? daily30.map((d) => d.day)
        : Array.from(new Set(Array.from(hourlyLookup.values()).map((h) => h.day))).sort();
    for (const day of daysToExpand) {
      for (let hour = 0; hour < 24; hour++) {
        const entry = hourlyLookup.get(`${day}::${hour}`);
        const success = Math.max(0, Number(entry?.success || 0));
        const error = Math.max(0, Number(entry?.error || 0));
        const total = Math.max(Number(entry?.total || 0), success + error);
        const rate = total > 0 ? success / total : 0;
        const moroccoHour = getMoroccoHourForUtc(day, hour);
        hourlyRows.push([
          dateCell(day),
          timeHourCell(hour),
          timeHourCell(moroccoHour),
          intCell(total),
          intCell(success),
          intCell(error),
          pctCell(rate),
        ]);
      }
    }
  }
  const sheetHourly: ExcelSheetSpec = {
    name: 'Par heure',
    rows: hourlyRows,
    boldRows: [1],
    autoFilterRef: makeRangeRef(6, hourlyRows.length),
    minColWidths: [14, 12, 13, 11, 11, 11, 12],
  };

  // =========================================================================
  // 4. Feuille "Erreurs" (error_code × plateforme × nombre + 20 derniers échecs)
  // =========================================================================
  const errorsHeader: ExcelRowSpec = ['Code erreur', 'Plateforme', 'Nombre'];
  const errorsRows: ExcelRowSpec[] = [errorsHeader];
  const errorsBoldRows: number[] = [1];

  const errByPlatform30 = Array.isArray(input?.errorsByPlatform?.['30d'])
    ? input!.errorsByPlatform!['30d']!
    : [];
  const recentFailures = Array.isArray(input?.recentFailures)
    ? input!.recentFailures!.slice(0, 20)
    : [];

  if (errByPlatform30.length === 0) {
    errorsRows.push(['Aucune donnée']);
  } else {
    for (const row of errByPlatform30) {
      errorsRows.push([
        strCell(row.error_code || 'UNKNOWN_ERROR'),
        strCell(formatPlatformLabel(row.platform)),
        intCell(Number(row.count || 0)),
      ]);
    }
  }
  const errorsAggLastRow = errorsRows.length;

  // Blank separator + 20 derniers échecs section
  errorsRows.push([]);
  const recentTitleRowNum = errorsRows.length + 1;
  errorsRows.push(['20 derniers échecs']);
  errorsBoldRows.push(recentTitleRowNum);

  const recentHeaderRowNum = errorsRows.length + 1;
  errorsRows.push(['Date (UTC)', 'Plateforme', 'Code erreur', 'Message', 'Domaine']);
  errorsBoldRows.push(recentHeaderRowNum);

  if (recentFailures.length === 0) {
    errorsRows.push(['Aucune donnée']);
  } else {
    for (const fail of recentFailures) {
      errorsRows.push([
        dateTimeCell(Number(fail.ts || 0)),
        strCell(formatPlatformLabel(fail.platform)),
        strCell(fail.error_code || 'UNKNOWN_ERROR'),
        strCell(fail.error_message || ''),
        strCell(fail.source_domain || ''),
      ]);
    }
  }

  const sheetErrors: ExcelSheetSpec = {
    name: 'Erreurs',
    rows: errorsRows,
    boldRows: errorsBoldRows,
    autoFilterRef: makeRangeRef(2, errorsAggLastRow),
    minColWidths: [24, 18, 22, 36, 22],
  };

  // =========================================================================
  // 5. Feuille "Pays" (pays, visiteurs, extractions, succès %)
  // =========================================================================
  const countriesHeader: ExcelRowSpec = ['Pays', 'Visiteurs', 'Extractions', 'Succès (%)'];
  const countriesRows: ExcelRowSpec[] = [countriesHeader];
  const countries30 = Array.isArray(geo30?.countries) ? geo30!.countries! : [];
  if (countries30.length === 0) {
    countriesRows.push(['Aucune donnée']);
  } else {
    for (const c of countries30) {
      const code = (c.countryCode || 'XX').toUpperCase();
      const label = `${getCountryNameFr(code)} (${code})`;
      const visitors = Math.max(0, Number(c.humanVisits || 0));
      const extractions = Math.max(0, Number(c.extractions || 0));
      const extractSuccess = Math.max(0, Number(c.extractSuccess || 0));
      const successRatio =
        extractions > 0
          ? extractSuccess / extractions
          : typeof c.successRate === 'number' && Number.isFinite(c.successRate)
          ? c.successRate / 100
          : 0;
      countriesRows.push([
        strCell(label),
        intCell(visitors),
        intCell(extractions),
        pctCell(successRatio),
      ]);
    }
  }
  const sheetCountries: ExcelSheetSpec = {
    name: 'Pays',
    rows: countriesRows,
    boldRows: [1],
    autoFilterRef: makeRangeRef(3, countriesRows.length),
    minColWidths: [26, 13, 14, 14],
  };

  // =========================================================================
  // 6. Feuille "Sources de trafic" (catégorie, référent, visiteurs + pages d'entrée)
  // =========================================================================
  const sourcesHeader: ExcelRowSpec = ['Catégorie', 'Référent', 'Visiteurs', 'Part (%)'];
  const sourcesRows: ExcelRowSpec[] = [sourcesHeader];
  const sourcesBoldRows: number[] = [1];

  const categories30 = Array.isArray(geo30?.sources?.categories)
    ? geo30!.sources!.categories!
    : [];
  const topHosts30 = Array.isArray(geo30?.sources?.topReferrerHosts)
    ? geo30!.sources!.topReferrerHosts!
    : [];
  const topEntryPages30 = Array.isArray(geo30?.sources?.topEntryPages)
    ? geo30!.sources!.topEntryPages!
    : [];

  const totalSourceVisits = categories30.reduce(
    (acc, cat) => acc + Math.max(0, Number(cat.visits || 0)),
    0
  );

  if (totalSourceVisits === 0 && topHosts30.length === 0) {
    sourcesRows.push(['Aucune donnée']);
  } else {
    const denom = totalSourceVisits > 0 ? totalSourceVisits : Math.max(1, humanVisits30);
    for (const cat of categories30) {
      const catVisits = Math.max(0, Number(cat.visits || 0));
      const catLabel = cat.label || CATEGORY_LABELS[cat.category] || cat.category;
      const matchingHosts = topHosts30.filter((h) => h.category === cat.category && h.visits > 0);
      let listedVisits = 0;

      for (const h of matchingHosts) {
        const v = Math.max(0, Number(h.visits || 0));
        listedVisits += v;
        sourcesRows.push([
          strCell(catLabel),
          strCell(h.host),
          intCell(v),
          pctCell(v / denom),
        ]);
      }

      const remainder = Math.max(0, catVisits - listedVisits);
      if (remainder > 0) {
        const fallbackRef =
          cat.category === 'direct' ? '(Accès direct)' : '(Autres référents)';
        sourcesRows.push([
          strCell(catLabel),
          strCell(fallbackRef),
          intCell(remainder),
          pctCell(remainder / denom),
        ]);
      }
    }
  }
  const sourcesAggLastRow = sourcesRows.length;

  // Blank separator + Pages d'entrée section
  sourcesRows.push([]);
  const entryTitleRowNum = sourcesRows.length + 1;
  sourcesRows.push(["Pages d'entrée (Top 10)"]);
  sourcesBoldRows.push(entryTitleRowNum);

  const entryHeaderRowNum = sourcesRows.length + 1;
  sourcesRows.push(["Page d'entrée", 'Visiteurs', 'Part (%)']);
  sourcesBoldRows.push(entryHeaderRowNum);

  if (topEntryPages30.length === 0) {
    sourcesRows.push(['Aucune donnée']);
  } else {
    const entryDenom = Math.max(
      1,
      humanVisits30 || topEntryPages30.reduce((acc, p) => acc + Number(p.visits || 0), 0)
    );
    for (const p of topEntryPages30) {
      const visits = Math.max(0, Number(p.visits || 0));
      sourcesRows.push([
        strCell(p.page || '/'),
        intCell(visits),
        pctCell(visits / entryDenom),
      ]);
    }
  }

  const sheetSources: ExcelSheetSpec = {
    name: 'Sources de trafic',
    rows: sourcesRows,
    boldRows: sourcesBoldRows,
    autoFilterRef: makeRangeRef(3, sourcesAggLastRow),
    minColWidths: [28, 26, 13, 13],
  };

  // =========================================================================
  // 7. Feuille "Funnel" (extract_started, extract_success, download_started, download_success + taux)
  // =========================================================================
  const funnelHeader: ExcelRowSpec = [
    'Étape',
    'Clé D1',
    'Volume',
    'Taux (%)',
    'Base de calcul',
  ];
  const funnelRows: ExcelRowSpec[] = [funnelHeader];

  if (!funnel) {
    funnelRows.push(['Aucune donnée']);
  } else {
    const extractStarted = Math.max(0, Number(funnel.extract_started || 0));
    const extractSuccess = Math.max(0, Number(funnel.extract_success || 0));
    const downloadStarted = Math.max(0, Number(funnel.download_started || 0));
    const downloadSuccess = Math.max(0, Number(funnel.download_success || 0));

    const extractSuccessRatio = extractStarted > 0 ? extractSuccess / extractStarted : 0;
    const downloadStartRatio = extractSuccess > 0 ? Math.min(1, downloadStarted / extractSuccess) : 0;
    const downloadCompletionRatio =
      downloadStarted > 0 ? Math.min(1, downloadSuccess / downloadStarted) : 0;
    const downloadConversionRatio =
      extractSuccess > 0 ? Math.min(1, downloadSuccess / extractSuccess) : 0;

    funnelRows.push(
      [
        '1. Extractions démarrées',
        'extract_started',
        intCell(extractStarted),
        pctCell(extractStarted > 0 ? 1 : 0),
        'Base (100%)',
      ],
      [
        '2. Extractions réussies',
        'extract_success',
        intCell(extractSuccess),
        pctCell(extractSuccessRatio),
        'extract_success / extract_started',
      ],
      [
        '3. Téléchargements lancés',
        'download_started',
        intCell(downloadStarted),
        pctCell(downloadStartRatio),
        'download_started / extract_success',
      ],
      [
        '4. Téléchargements terminés',
        'download_success',
        intCell(downloadSuccess),
        pctCell(downloadCompletionRatio),
        'download_success / download_started',
      ],
      [
        'Conversion globale',
        'global_conversion',
        intCell(extractSuccess),
        pctCell(extractSuccessRatio),
        'extract_success / extract_started',
      ],
      [
        'Conversion téléchargement',
        'download_conversion',
        intCell(downloadSuccess),
        pctCell(downloadConversionRatio),
        'download_success / extract_success',
      ]
    );
  }

  const sheetFunnel: ExcelSheetSpec = {
    name: 'Funnel',
    rows: funnelRows,
    boldRows: [1],
    autoFilterRef: makeRangeRef(4, funnelRows.length),
    minColWidths: [28, 22, 13, 13, 34],
  };

  return {
    filename,
    sheets: [
      sheetResume,
      sheetDaily,
      sheetHourly,
      sheetErrors,
      sheetCountries,
      sheetSources,
      sheetFunnel,
    ],
  };
}

function estimateDisplayWidth(cell: ExcelCellSpec | string | number | undefined): number {
  if (cell === undefined || cell === null) return 0;
  if (typeof cell === 'string') return cell.length;
  if (typeof cell === 'number') return String(cell).length;
  switch (cell.type) {
    case 'date':
      return 12; // yyyy-mm-dd
    case 'datetime':
      return 20; // yyyy-mm-dd hh:mm:ss
    case 'time':
      return 8; // hh:mm
    case 'percent':
      return 8; // 100.0%
    case 'number':
      return Math.max(6, String(Math.round(Number(cell.value) || 0)).length + 3);
    default:
      return String(cell.value ?? '').length;
  }
}

function computeColWidths(spec: ExcelSheetSpec): Array<{ wch: number }> {
  let maxCols = spec.minColWidths?.length || 0;
  for (const row of spec.rows) {
    if (row.length > maxCols) maxCols = row.length;
  }
  const widths: Array<{ wch: number }> = [];
  for (let c = 0; c < maxCols; c++) {
    let best = spec.minColWidths?.[c] ?? 12;
    for (const row of spec.rows) {
      const len = estimateDisplayWidth(row[c]);
      if (len + 3 > best) best = len + 3;
    }
    widths.push({ wch: Math.min(56, Math.max(10, best)) });
  }
  return widths;
}

/**
 * Post-processes the SheetJS-generated OOXML archive to add:
 * 1) Bold header font + light header fill in xl/styles.xml, applied to boldRows on each sheet.
 * 2) Frozen first row (<pane ySplit="1" topLeftCell="A2" state="frozen"/>) on every worksheet.
 */
export function applyExcelFormatting(
  xlsxBytes: Uint8Array,
  sheets: ExcelSheetSpec[]
): Uint8Array {
  const files = unzipSync(xlsxBytes);

  // 1. Add bold font + light header fill + header XF to xl/styles.xml
  const stylesKey = 'xl/styles.xml';
  let headerXfIndex: number | null = null;

  if (files[stylesKey]) {
    let stylesXml = strFromU8(files[stylesKey]);

    // Append bold font
    let boldFontId = 1;
    const fontsMatch = /<fonts\s+count="(\d+)">/.exec(stylesXml);
    if (fontsMatch) {
      boldFontId = Number.parseInt(fontsMatch[1], 10);
      stylesXml = stylesXml.replace(
        /<fonts\s+count="\d+">/,
        `<fonts count="${boldFontId + 1}">`
      );
      stylesXml = stylesXml.replace(
        '</fonts>',
        '<font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font></fonts>'
      );
    }

    // Append light slate header fill (#F1F5F9)
    let headerFillId = 2;
    const fillsMatch = /<fills\s+count="(\d+)">/.exec(stylesXml);
    if (fillsMatch) {
      headerFillId = Number.parseInt(fillsMatch[1], 10);
      stylesXml = stylesXml.replace(
        /<fills\s+count="\d+">/,
        `<fills count="${headerFillId + 1}">`
      );
      stylesXml = stylesXml.replace(
        '</fills>',
        '<fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill></fills>'
      );
    }

    // Append header cellXf
    const xfsMatch = /<cellXfs\s+count="(\d+)">/.exec(stylesXml);
    if (xfsMatch) {
      headerXfIndex = Number.parseInt(xfsMatch[1], 10);
      stylesXml = stylesXml.replace(
        /<cellXfs\s+count="\d+">/,
        `<cellXfs count="${headerXfIndex + 1}">`
      );
      stylesXml = stylesXml.replace(
        '</cellXfs>',
        `<xf numFmtId="0" fontId="${boldFontId}" fillId="${headerFillId}" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>`
      );
    }

    files[stylesKey] = strToU8(stylesXml);
  }

  // 2. Patch each worksheet XML: freeze row 1 + apply headerXfIndex to boldRows
  for (let i = 0; i < sheets.length; i++) {
    const sheetKey = `xl/worksheets/sheet${i + 1}.xml`;
    if (!files[sheetKey]) continue;

    let xml = strFromU8(files[sheetKey]);
    const tabSelectedAttr = i === 0 ? ' tabSelected="1"' : '';
    const frozenView = `<sheetView${tabSelectedAttr} workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView>`;

    if (/<sheetView\b[^>]*\/>/.test(xml)) {
      xml = xml.replace(/<sheetView\b[^>]*\/>/, frozenView);
    } else if (/<sheetViews>[\s\S]*?<\/sheetViews>/.test(xml)) {
      xml = xml.replace(
        /<sheetViews>[\s\S]*?<\/sheetViews>/,
        `<sheetViews>${frozenView}</sheetViews>`
      );
    } else if (/<dimension\b[^>]*\/>/.test(xml)) {
      xml = xml.replace(
        /(<dimension\b[^>]*\/>)/,
        `$1<sheetViews>${frozenView}</sheetViews>`
      );
    }

    if (headerXfIndex !== null && sheets[i].boldRows.length > 0) {
      for (const rowNum of sheets[i].boldRows) {
        const rowRegex = new RegExp(`(<row\\s+r="${rowNum}"[^>]*>)([\\s\\S]*?)(<\\/row>)`);
        xml = xml.replace(rowRegex, (_full, openTag: string, inner: string, closeTag: string) => {
          const styledInner = inner.replace(/<c\s+([^>]+)>/g, (_cFull, attrs: string) => {
            if (/\bs="\d+"/.test(attrs)) {
              return `<c ${attrs.replace(/\bs="\d+"/, `s="${headerXfIndex}"`)}>`;
            }
            return `<c ${attrs} s="${headerXfIndex}">`;
          });
          return `${openTag}${styledInner}${closeTag}`;
        });
      }
    }

    files[sheetKey] = strToU8(xml);
  }

  return zipSync(files, { level: 6 });
}

/**
 * Dynamically imports SheetJS (xlsx) on demand and generates a complete multi-sheet .xlsx buffer.
 */
export async function generateAdminStatsXlsxBuffer(
  input: WidgetStatsInput | null | undefined,
  nowDate?: Date
): Promise<{ filename: string; bytes: Uint8Array }> {
  const xlsxModule = await import('xlsx');
  const XLSX = ((xlsxModule as unknown as { default?: typeof xlsxModule }).default ||
    xlsxModule) as typeof xlsxModule;

  const model = buildAdminStatsWorkbookData(input, nowDate);
  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: 'VIDNEX — Statistiques D1 (30 jours)',
    Subject: 'Export multi-feuilles Admin VIDNEX',
    Author: 'VIDNEX',
    CreatedDate: nowDate || new Date(),
  };

  for (const sheetSpec of model.sheets) {
    const ws: Record<string, unknown> = {};
    let maxRow = 0;
    let maxCol = 0;

    for (let r = 0; r < sheetSpec.rows.length; r++) {
      const row = sheetSpec.rows[r];
      if (!row || row.length === 0) continue;
      if (r > maxRow) maxRow = r;
      for (let c = 0; c < row.length; c++) {
        const raw = row[c];
        if (raw === undefined || raw === null) continue;
        if (c > maxCol) maxCol = c;
        const addr = XLSX.utils.encode_cell({ r, c });

        if (typeof raw === 'string') {
          ws[addr] = { t: 's', v: raw };
        } else if (typeof raw === 'number') {
          ws[addr] = { t: 'n', v: Number.isFinite(raw) ? raw : 0 };
        } else if (raw.type === 'string') {
          ws[addr] = { t: 's', v: String(raw.value ?? '') };
        } else {
          // number, date, datetime, time, percent -> true Excel numeric cell with native numFmt
          const numVal = Number(raw.value);
          ws[addr] = {
            t: 'n',
            v: Number.isFinite(numVal) ? numVal : 0,
            ...(raw.numFmt ? { z: raw.numFmt } : {}),
          };
        }
      }
    }

    ws['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: maxRow, c: maxCol },
    });
    ws['!cols'] = computeColWidths(sheetSpec);
    ws['!autofilter'] = { ref: sheetSpec.autoFilterRef };

    XLSX.utils.book_append_sheet(
      workbook,
      ws as unknown as import('xlsx').WorkSheet,
      sheetSpec.name
    );
  }

  const rawArray = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    compression: true,
  }) as ArrayBuffer | Uint8Array;
  const rawBytes = rawArray instanceof Uint8Array ? rawArray : new Uint8Array(rawArray);
  const formattedBytes = applyExcelFormatting(rawBytes, model.sheets);

  return {
    filename: model.filename,
    bytes: formattedBytes,
  };
}

/**
 * Triggers a client-side download of vidnex-stats-YYYY-MM-DD.xlsx.
 */
export async function downloadAdminStatsExcel(
  input: WidgetStatsInput | null | undefined
): Promise<string> {
  const { filename, bytes } = await generateAdminStatsXlsxBuffer(input);
  const safeBuffer = new Uint8Array(bytes).buffer;
  const blob = new Blob([safeBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}
