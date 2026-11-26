import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryD1Database } from '../functions/_lib/db.ts';
import { logExtractionEvent } from '../functions/_lib/logger.ts';
import {
  isBotUserAgent,
  extractReferrerHost,
  categorizeReferrerHost,
  normalizeEntryPage,
  extractSafeDomain,
  sanitizeShortErrorMessage,
  extractRequestCountry,
} from '../functions/_lib/visitAnalytics.ts';
import { onRequestPost as visitPost } from '../functions/api/visit.ts';
import { onRequestGet as statsGet } from '../functions/api/admin/stats.ts';
import { onRequestPost as loginPost } from '../functions/api/admin/login.ts';
import {
  WORLD_COUNTRIES_GEOJSON,
  WORLD_COUNTRY_SHAPES,
  projectGeoLonLat,
} from '../src/pages/admin/worldCountriesGeo.ts';
import {
  buildD1VisitorsMapSummary,
  getChoroplethLevel,
} from '../src/pages/admin/visitorsMapLogic.ts';

test('visitAnalytics pure helpers: bot detection, referrer categorization, entry page filtering, safe domain & error sanitization', () => {
  // Bot detection
  assert.equal(isBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'), true);
  assert.equal(isBotUserAgent('curl/8.4.0'), true);
  assert.equal(isBotUserAgent(''), true);
  assert.equal(
    isBotUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'),
    false
  );

  // Referrer extraction & categorization
  assert.equal(extractReferrerHost('https://www.google.fr/search?q=vidnex', ['vidnex.pro']), 'google.fr');
  assert.equal(extractReferrerHost('https://vidnex.pro/blog', ['vidnex.pro']), null);
  assert.equal(categorizeReferrerHost(null), 'direct');
  assert.equal(categorizeReferrerHost('google.fr'), 'search');
  assert.equal(categorizeReferrerHost('bing.com'), 'search');
  assert.equal(categorizeReferrerHost('t.co'), 'social');
  assert.equal(categorizeReferrerHost('www.reddit.com'), 'social');
  assert.equal(categorizeReferrerHost('news.ycombinator.com'), 'other');

  // Entry page normalization (rejects /admin, /api, static assets)
  assert.equal(normalizeEntryPage('/telecharger-video-tiktok?utm_source=google'), '/telecharger-video-tiktok');
  assert.equal(normalizeEntryPage('/'), '/');
  assert.equal(normalizeEntryPage('/admin'), null);
  assert.equal(normalizeEntryPage('/admin/stats'), null);
  assert.equal(normalizeEntryPage('/api/extract'), null);
  assert.equal(normalizeEntryPage('/assets/index.js'), null);

  // Safe domain extraction (hostname only, never path/query)
  assert.equal(extractSafeDomain('https://www.tiktok.com/@creator/video/123456?token=secret'), 'www.tiktok.com');
  assert.equal(extractSafeDomain('not-a-url'), null);

  // Error message sanitization
  assert.equal(
    sanitizeShortErrorMessage('  LinkedIn bloque\n   l’accès  pour le moment  '),
    'LinkedIn bloque l’accès pour le moment'
  );
  assert.equal(sanitizeShortErrorMessage('   '), null);

  // Country extraction from Cloudflare headers
  const reqWithHeader = new Request('https://vidnex.pro/api/visit', {
    headers: { 'CF-IPCountry': 'fr' },
  });
  assert.equal(extractRequestCountry(reqWithHeader), 'FR');
  const reqNoHeader = new Request('https://vidnex.pro/api/visit');
  assert.equal(extractRequestCountry(reqNoHeader), 'XX');
});

test('End-to-end D1 admin analytics: errors by platform, 20 recent failures, consistent counts, global conversion, real visits + bots + sources + top 10 entry pages', async () => {
  const db = createMemoryD1Database();
  const env = {
    DB: db,
    ADMIN_PASSWORD: 'test-secret-password-123',
    SESSION_SECRET: 'test-session-secret-xyz',
  };

  // 1. Authenticate as admin to get session cookie
  const loginRes = await loginPost({
    request: new Request('https://vidnex.pro/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://vidnex.pro',
      },
      body: JSON.stringify({ password: env.ADMIN_PASSWORD }),
    }),
    env,
  });
  assert.equal(loginRes.status, 200);
  const setCookie = loginRes.headers.get('Set-Cookie') || '';
  const cookieHeader = setCookie.split(';')[0];
  assert.ok(cookieHeader.includes('vidnex_admin_session='));

  // 2. Log real extractions (3 success + 5 failures across platforms & countries)
  await logExtractionEvent(env, {
    platform: 'tiktok',
    status: 'success',
    durationMs: 210,
    country: 'FR',
    sourceDomain: 'www.tiktok.com',
  });
  await logExtractionEvent(env, {
    platform: 'instagram',
    status: 'success',
    durationMs: 320,
    country: 'FR',
    sourceDomain: 'www.instagram.com',
  });
  await logExtractionEvent(env, {
    platform: 'facebook',
    status: 'success',
    durationMs: 410,
    country: 'MA',
    sourceDomain: 'www.facebook.com',
  });

  // Failures
  await logExtractionEvent(env, {
    platform: 'linkedin',
    status: 'error',
    errorCode: 'BLOCKED_BY_PLATFORM',
    httpStatus: 999,
    errorMessage: 'LinkedIn bloque l’accès à cette photo pour le moment.',
    sourceDomain: 'www.linkedin.com',
    country: 'FR',
    durationMs: 180,
  });
  await logExtractionEvent(env, {
    platform: 'linkedin',
    status: 'error',
    errorCode: 'BLOCKED_BY_PLATFORM',
    httpStatus: 403,
    errorMessage: 'Mur de connexion LinkedIn détecté.',
    sourceDomain: 'www.linkedin.com',
    country: 'MA',
    durationMs: 240,
  });
  await logExtractionEvent(env, {
    platform: 'instagram',
    status: 'error',
    errorCode: 'BLOCKED_BY_PLATFORM',
    httpStatus: 429,
    errorMessage: 'Rate limit Instagram atteint.',
    sourceDomain: 'www.instagram.com',
    country: 'US',
    durationMs: 510,
  });
  await logExtractionEvent(env, {
    platform: 'tiktok',
    status: 'error',
    errorCode: 'MEDIA_NOT_FOUND',
    httpStatus: 404,
    errorMessage: 'Vidéo supprimée ou privée.',
    sourceDomain: 'vm.tiktok.com',
    country: 'FR',
    durationMs: 190,
  });
  await logExtractionEvent(env, {
    platform: 'x',
    status: 'error',
    errorCode: 'TIMEOUT',
    httpStatus: 504,
    errorMessage: 'Délai dépassé sur syndication X.',
    sourceDomain: 'x.com',
    country: 'US',
    durationMs: 12000,
  });

  // 3. Fire real cookie-free visit beacons (humans + bots + /admin ignored)
  const fireVisit = async (opts: {
    path: string;
    referrer?: string;
    country: string;
    ua: string;
  }) => {
    const res = await visitPost({
      request: new Request('https://vidnex.pro/api/visit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-IPCountry': opts.country,
          'User-Agent': opts.ua,
        },
        body: JSON.stringify({ path: opts.path, referrer: opts.referrer || '' }),
      }),
      env,
    });
    assert.equal(res.status, 204);
  };

  const humanUa = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
  const botUa = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

  await fireVisit({ path: '/', referrer: 'https://www.google.fr/search?q=telecharger+tiktok', country: 'FR', ua: humanUa });
  await fireVisit({ path: '/telecharger-video-tiktok', referrer: 'https://www.google.com/', country: 'FR', ua: humanUa });
  await fireVisit({ path: '/telecharger-video-tiktok', referrer: '', country: 'MA', ua: humanUa });
  await fireVisit({ path: '/en/instagram-reels-downloader', referrer: 'https://t.co/abc', country: 'US', ua: humanUa });
  await fireVisit({ path: '/tools/split-image', referrer: 'https://someblog.example/article', country: 'FR', ua: humanUa });
  await fireVisit({ path: '/', referrer: '', country: 'DE', ua: botUa });
  await fireVisit({ path: '/telecharger-video-facebook', referrer: '', country: 'US', ua: botUa });
  // Must be ignored (admin route)
  await fireVisit({ path: '/admin', referrer: '', country: 'FR', ua: humanUa });

  // 4. Fetch /api/admin/stats
  const statsRes = await statsGet({
    request: new Request('https://vidnex.pro/api/admin/stats', {
      headers: { Cookie: cookieHeader },
    }),
    env,
  });
  assert.equal(statsRes.status, 200);
  const stats = (await statsRes.json()) as any;
  assert.equal(stats.ok, true);

  // Consistency check: total extractions = 8 everywhere (today = 7d = 30d = 8)
  assert.equal(stats.counts.today, 8);
  assert.equal(stats.counts.last7d, 8);
  assert.equal(stats.counts.last30d, 8);
  assert.equal(stats.funnel.extract_started, 8);
  assert.equal(stats.funnel.extract_success, 3);
  assert.equal(stats.funnel.extract_error, 5);
  // Global conversion = extract_success / extract_started = 3 / 8 = 37.5% (NOT 100%)
  assert.equal(stats.funnel.extractSuccessRate, 37.5);
  assert.equal(stats.funnel.globalConversionRate, 37.5);

  // Errors by platform table check
  const errToday = stats.errorsByPlatform.today;
  assert.ok(Array.isArray(errToday));
  const linkedinBlocked = errToday.find(
    (r: any) => r.error_code === 'BLOCKED_BY_PLATFORM' && r.platform === 'linkedin'
  );
  assert.equal(linkedinBlocked?.count, 2);
  const igBlocked = errToday.find(
    (r: any) => r.error_code === 'BLOCKED_BY_PLATFORM' && r.platform === 'instagram'
  );
  assert.equal(igBlocked?.count, 1);

  // Recent 20 failures check (full code, http_status, domain, short message)
  assert.equal(stats.recentFailures.length, 5);
  const linkedinFail = stats.recentFailures.find((f: any) => f.platform === 'linkedin');
  assert.equal(linkedinFail.error_code, 'BLOCKED_BY_PLATFORM');
  assert.equal(linkedinFail.source_domain, 'www.linkedin.com');
  assert.ok(linkedinFail.http_status === 403 || linkedinFail.http_status === 999);
  assert.ok(typeof linkedinFail.error_message === 'string' && linkedinFail.error_message.length > 0);

  // Geo consistency check (map extractions = 8, globalSuccessRate = 37.5, FR extractions = 4)
  const geoToday = stats.geo.periods.today;
  assert.equal(geoToday.humanVisits, 5);
  assert.equal(geoToday.botVisits, 2);
  assert.equal(geoToday.totalVisits, 7);
  assert.equal(geoToday.totalExtractions, 8);
  assert.equal(geoToday.globalSuccessRate, 37.5);

  const frGeo = geoToday.countries.find((c: any) => c.countryCode === 'FR');
  assert.equal(frGeo.humanVisits, 3);
  assert.equal(frGeo.extractions, 4);
  assert.equal(frGeo.extractSuccess, 2);
  assert.equal(frGeo.successRate, 50);

  // Sum of country extractions equals total D1 extractions (8)
  const sumCountryExtractions = geoToday.countries.reduce(
    (acc: number, c: any) => acc + c.extractions,
    0
  );
  assert.equal(sumCountryExtractions, stats.counts.today);

  // Visitor sources categories (human only: 2 search, 1 direct, 1 social, 1 other)
  const catMap = new Map(geoToday.sources.categories.map((c: any) => [c.category, c.visits]));
  assert.equal(catMap.get('search'), 2);
  assert.equal(catMap.get('direct'), 1);
  assert.equal(catMap.get('social'), 1);
  assert.equal(catMap.get('other'), 1);

  // Top entry pages (/admin excluded)
  const topPages = geoToday.sources.topEntryPages;
  assert.equal(topPages[0].page, '/telecharger-video-tiktok');
  assert.equal(topPages[0].visits, 2);
  assert.equal(topPages.some((p: any) => p.page.startsWith('/admin')), false);

  // Frontend summary helper stays 100% consistent with D1 payload
  const uiSummary = buildD1VisitorsMapSummary('today', stats);
  assert.equal(uiSummary.totalExtractions, stats.counts.today);
  assert.equal(uiSummary.humanVisits, 5);
  assert.equal(uiSummary.botVisits, 2);
  assert.equal(uiSummary.globalSuccessRate, 37.5);
  assert.equal(getChoroplethLevel(3, 3), 5);
  assert.equal(getChoroplethLevel(0, 3), 0);
});

test('Embedded World Countries GeoJSON: self-contained, valid polygons, and bounded SVG projection', () => {
  assert.equal(WORLD_COUNTRIES_GEOJSON.type, 'FeatureCollection');
  assert.ok(WORLD_COUNTRY_SHAPES.length >= 90);

  const codes = new Set(WORLD_COUNTRY_SHAPES.map((s) => s.code));
  for (const required of ['FR', 'US', 'MA', 'DZ', 'DE', 'GB', 'BR', 'JP', 'AU', 'IN']) {
    assert.ok(codes.has(required), `Missing country polygon for ${required}`);
  }

  for (const shape of WORLD_COUNTRY_SHAPES) {
    assert.ok(shape.d.startsWith('M'), `Invalid SVG path for ${shape.code}`);
    assert.ok(shape.d.endsWith('Z'), `Unclosed SVG path for ${shape.code}`);
    assert.ok(shape.centroidX >= 0 && shape.centroidX <= 1000);
    assert.ok(shape.centroidY >= 0 && shape.centroidY <= 500);
  }

  const [x0, y0] = projectGeoLonLat(0, 0);
  assert.equal(x0, 500);
  assert.ok(y0 > 200 && y0 < 350);
});

test('Multi-sheet Excel (.xlsx) export: 7 sheets, 30 full days, 720 hourly rows (UTC + Morocco), real types, bold headers, frozen top row, filters, and empty fallback', async () => {
  const { unzipSync, strFromU8 } = await import('fflate');
  const xlsxMod = await import('xlsx');
  const XLSX = ((xlsxMod as any).default || xlsxMod) as typeof xlsxMod;
  const {
    generateAdminStatsXlsxBuffer,
    getMoroccoHourForUtc,
    isoDayToExcelSerial,
  } = await import('../src/pages/admin/excelExport.ts');

  // Seed real D1 database across multiple hours & platforms
  const db = createMemoryD1Database();
  const env = {
    DB: db,
    ADMIN_PASSWORD: 'excel-test-password-123',
    SESSION_SECRET: 'excel-test-session-secret',
  };

  const loginRes = await loginPost({
    request: new Request('https://vidnex.pro/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://vidnex.pro',
      },
      body: JSON.stringify({ password: env.ADMIN_PASSWORD }),
    }),
    env,
  });
  const cookieHeader = (loginRes.headers.get('Set-Cookie') || '').split(';')[0];

  const todayIso = new Date().toISOString().slice(0, 10);
  const tsHour09 = Date.parse(`${todayIso}T09:15:00.000Z`);
  const tsHour14 = Date.parse(`${todayIso}T14:30:00.000Z`);

  await logExtractionEvent(env, {
    platform: 'tiktok',
    status: 'success',
    stage: 'direct',
    durationMs: 180,
    country: 'MA',
    ts: tsHour09,
  });
  await logExtractionEvent(env, {
    platform: 'instagram',
    status: 'success',
    stage: 'tiers',
    durationMs: 250,
    country: 'FR',
    ts: tsHour14,
  });
  await logExtractionEvent(env, {
    platform: 'linkedin',
    status: 'error',
    errorCode: 'BLOCKED_BY_PLATFORM',
    httpStatus: 999,
    errorMessage: 'LinkedIn bloque l’accès pour le moment.',
    sourceDomain: 'www.linkedin.com',
    country: 'FR',
    durationMs: 220,
    ts: tsHour14 + 1000,
  });

  await visitPost({
    request: new Request('https://vidnex.pro/api/visit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-IPCountry': 'MA',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        path: '/telecharger-video-tiktok',
        referrer: 'https://www.google.com/search?q=vidnex',
      }),
    }),
    env,
  });
  await visitPost({
    request: new Request('https://vidnex.pro/api/visit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-IPCountry': 'FR',
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
      },
      body: JSON.stringify({ path: '/', referrer: '' }),
    }),
    env,
  });

  const statsRes = await statsGet({
    request: new Request('https://vidnex.pro/api/admin/stats', {
      headers: { Cookie: cookieHeader },
    }),
    env,
  });
  assert.equal(statsRes.status, 200);
  const stats = (await statsRes.json()) as any;

  // Verify hourly buckets returned from D1
  assert.ok(Array.isArray(stats.hourly));
  const h09 = stats.hourly.find((h: any) => h.day === todayIso && h.hour === 9);
  const h14 = stats.hourly.find((h: any) => h.day === todayIso && h.hour === 14);
  assert.equal(h09?.success, 1);
  assert.equal(h09?.error, 0);
  assert.equal(h14?.success, 1);
  assert.equal(h14?.error, 1);
  assert.equal(h14?.total, 2);

  // Generate Excel file
  const { filename, bytes } = await generateAdminStatsXlsxBuffer(stats);
  assert.equal(filename, `vidnex-stats-${todayIso}.xlsx`);
  assert.ok(bytes.byteLength > 2000);

  // Re-open with SheetJS to verify workbook integrity & separate columns
  const wb = XLSX.read(bytes, { type: 'array', cellStyles: true });
  assert.deepEqual(wb.SheetNames, [
    'Résumé',
    'Par jour',
    'Par heure',
    'Erreurs',
    'Pays',
    'Sources de trafic',
    'Funnel',
  ]);

  // 1. Résumé
  const wsResume = wb.Sheets['Résumé'];
  assert.equal(wsResume['A1']?.v, 'Indicateur');
  assert.equal(wsResume['B2']?.t, 'n');
  assert.equal(wsResume['B2']?.v, 3); // 3 total calls
  assert.equal(wsResume['B5']?.t, 'n'); // Taux de succès as real numeric ratio
  assert.ok(Math.abs(Number(wsResume['B5']?.v) - 2 / 3) < 0.001);

  // 2. Par jour (always 30 full days, real Excel date serial + real numbers + percentage)
  const wsDaily = wb.Sheets['Par jour'];
  const dailyAoa = XLSX.utils.sheet_to_json(wsDaily, { header: 1 }) as unknown[][];
  assert.equal(dailyAoa.length, 31); // 1 header + 30 full days
  assert.equal(wsDaily['A2']?.t, 'n'); // real Excel date serial, not text
  assert.equal(wsDaily['A2']?.z, 'yyyy-mm-dd');
  assert.equal(wsDaily['A31']?.v, isoDayToExcelSerial(todayIso));
  assert.equal(wsDaily['B31']?.t, 'n');
  assert.equal(wsDaily['B31']?.v, 3);
  assert.equal(wsDaily['F31']?.t, 'n');
  assert.equal(wsDaily['F31']?.z, '0.0%');

  // 3. Par heure (30 days × 24 hours = 720 rows, including hours at 0, UTC + Morocco time)
  const wsHourly = wb.Sheets['Par heure'];
  const hourlyAoa = XLSX.utils.sheet_to_json(wsHourly, { header: 1 }) as unknown[][];
  assert.equal(hourlyAoa.length, 1 + 30 * 24); // 721 rows total
  // Find today's 14:00 UTC row (last day index = 29 -> 1-based row = 1 + 29*24 + 14 + 1 = 712)
  const row14 = 1 + 29 * 24 + 14 + 1;
  assert.equal(wsHourly[`A${row14}`]?.v, isoDayToExcelSerial(todayIso));
  assert.equal(wsHourly[`B${row14}`]?.t, 'n');
  assert.equal(wsHourly[`B${row14}`]?.z, 'hh:mm');
  assert.ok(Math.abs(Number(wsHourly[`B${row14}`]?.v) - 14 / 24) < 1e-6);
  const expectedMorocco14 = getMoroccoHourForUtc(todayIso, 14);
  assert.equal(expectedMorocco14, 15);
  assert.ok(Math.abs(Number(wsHourly[`C${row14}`]?.v) - expectedMorocco14 / 24) < 1e-6);
  assert.equal(wsHourly[`D${row14}`]?.v, 2); // 2 calls at 14h UTC
  assert.equal(wsHourly[`E${row14}`]?.v, 1); // 1 success
  assert.equal(wsHourly[`F${row14}`]?.v, 1); // 1 error
  assert.ok(Math.abs(Number(wsHourly[`G${row14}`]?.v) - 0.5) < 1e-6);
  // Hour with 0 calls exists too (00:00 UTC today)
  const row00 = 1 + 29 * 24 + 1;
  assert.equal(wsHourly[`D${row00}`]?.v, 0);

  // 4. Erreurs (full code + recent failures with real Excel datetime)
  const wsErrors = wb.Sheets['Erreurs'];
  assert.equal(wsErrors['A2']?.v, 'BLOCKED_BY_PLATFORM');
  assert.equal(wsErrors['B2']?.v, 'LinkedIn');
  assert.equal(wsErrors['C2']?.v, 1);
  // Recent failure row is at row 6 (row 1 header, row 2 agg, row 3 blank, row 4 title, row 5 header, row 6 data)
  assert.equal(wsErrors['A6']?.t, 'n');
  assert.equal(wsErrors['A6']?.z, 'yyyy-mm-dd hh:mm:ss');
  assert.equal(wsErrors['C6']?.v, 'BLOCKED_BY_PLATFORM');
  assert.equal(wsErrors['E6']?.v, 'www.linkedin.com');

  // 5. Pays
  const wsPays = wb.Sheets['Pays'];
  assert.equal(wsPays['A1']?.v, 'Pays');
  assert.ok(String(wsPays['A2']?.v || '').includes('(MA)'));
  assert.equal(wsPays['B2']?.v, 1);
  assert.equal(wsPays['C2']?.v, 1);
  assert.equal(wsPays['D2']?.v, 1);

  // 6. Sources de trafic
  const wsSources = wb.Sheets['Sources de trafic'];
  assert.equal(wsSources['A1']?.v, 'Catégorie');
  assert.equal(wsSources['A2']?.v, 'Recherche');
  assert.equal(wsSources['B2']?.v, 'google.com');
  assert.equal(wsSources['C2']?.v, 1);

  // 7. Funnel
  const wsFunnel = wb.Sheets['Funnel'];
  assert.equal(wsFunnel['B2']?.v, 'extract_started');
  assert.equal(wsFunnel['C2']?.v, 3);
  assert.equal(wsFunnel['B3']?.v, 'extract_success');
  assert.equal(wsFunnel['C3']?.v, 2);

  // Verify raw OOXML formatting: bold font in styles.xml + frozen pane + autoFilter + cols on all 7 sheets
  const unzipped = unzipSync(bytes);
  const stylesXml = strFromU8(unzipped['xl/styles.xml']);
  assert.ok(stylesXml.includes('<b/>'), 'xl/styles.xml must define a bold font');
  assert.ok(stylesXml.includes('applyFont="1"'), 'xl/styles.xml must define a bold header cellXf');

  for (let i = 1; i <= 7; i++) {
    const sheetXml = strFromU8(unzipped[`xl/worksheets/sheet${i}.xml`]);
    assert.ok(
      sheetXml.includes('ySplit="1"') && sheetXml.includes('state="frozen"'),
      `sheet${i}.xml must freeze row 1`
    );
    assert.ok(sheetXml.includes('<autoFilter '), `sheet${i}.xml must have active autoFilter`);
    assert.ok(sheetXml.includes('<cols>'), `sheet${i}.xml must define adjusted column widths`);
    assert.ok(/<row r="1"[^>]*>.*?s="\d+"/.test(sheetXml), `sheet${i}.xml row 1 must apply bold header style`);
  }

  // Empty dataset check: keeps headers + "Aucune donnée" row on every empty sheet
  const { bytes: emptyBytes } = await generateAdminStatsXlsxBuffer({
    ok: true,
    dbConnected: true,
    daily: [],
    hourly: [],
    errorsByPlatform: { today: [], '7d': [], '30d': [] },
    recentFailures: [],
    geo: {
      periods: {
        '30d': {
          humanVisits: 0,
          botVisits: 0,
          countries: [],
          sources: { categories: [], topReferrerHosts: [], topEntryPages: [] },
        },
      },
    },
  });
  const emptyWb = XLSX.read(emptyBytes, { type: 'array' });
  assert.equal(emptyWb.SheetNames.length, 7);
  for (const sheetName of ['Par jour', 'Par heure', 'Erreurs', 'Pays', 'Sources de trafic', 'Funnel']) {
    const s = emptyWb.Sheets[sheetName];
    assert.equal(s['A2']?.v, 'Aucune donnée', `Empty sheet "${sheetName}" must show "Aucune donnée"`);
  }
});

test('Cookie consent: versioned localStorage persistence, default opt-out gating, 10-language copy, and legal Privacy coverage', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { SUPPORTED_LOCALES } = await import('../src/i18n/config.ts');
  const {
    COOKIE_CONSENT_STORAGE_KEY,
    COOKIE_CONSENT_VERSION,
    COOKIE_CONSENT_COPY,
    parseCookieConsent,
    readCookieConsent,
    saveCookieConsent,
    hasAdvertisingConsent,
    hasAnalyticsConsent,
    subscribeCookieConsent,
    resetCookieConsentCacheForTests,
  } = await import('../src/utils/cookieConsent.ts');

  // 1. Versioned key & parser validation
  assert.equal(COOKIE_CONSENT_STORAGE_KEY, 'vidnex_cookie_consent_v1');
  assert.equal(COOKIE_CONSENT_VERSION, 1);
  assert.equal(parseCookieConsent(null), null);
  assert.equal(parseCookieConsent('not-json'), null);
  assert.equal(
    parseCookieConsent(JSON.stringify({ version: 99, essential: true, analytics: true, advertising: true })),
    null
  );
  assert.equal(
    parseCookieConsent(JSON.stringify({ version: 1, essential: true, analytics: 'yes', advertising: true })),
    null
  );

  const parsed = parseCookieConsent(
    JSON.stringify({
      version: 1,
      essential: true,
      analytics: false,
      advertising: true,
      updatedAt: '2026-11-26T12:00:00.000Z',
    })
  );
  assert.ok(parsed);
  assert.equal(parsed?.essential, true);
  assert.equal(parsed?.analytics, false);
  assert.equal(parsed?.advertising, true);

  // 2. Simulated browser window/localStorage lifecycle
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
  const originalWindow = (globalThis as any).window;
  (globalThis as any).window = { localStorage: mockLocalStorage };
  resetCookieConsentCacheForTests();

  try {
    // Default (no choice stored): advertising & analytics MUST be false (strict opt-in)
    assert.equal(readCookieConsent(), null);
    assert.equal(hasAdvertisingConsent(), false);
    assert.equal(hasAnalyticsConsent(), false);

    const events: Array<{ analytics: boolean; advertising: boolean } | null> = [];
    const unsub = subscribeCookieConsent((c) => {
      events.push(c ? { analytics: c.analytics, advertising: c.advertising } : null);
    });

    // Reject all
    saveCookieConsent({ analytics: false, advertising: false });
    assert.equal(hasAdvertisingConsent(), false);
    assert.equal(hasAnalyticsConsent(), false);
    assert.ok(store.has(COOKIE_CONSENT_STORAGE_KEY));

    // Customize: analytics only -> ads remain blocked
    saveCookieConsent({ analytics: true, advertising: false });
    assert.equal(hasAnalyticsConsent(), true);
    assert.equal(hasAdvertisingConsent(), false);

    // Accept all -> both enabled
    saveCookieConsent({ analytics: true, advertising: true });
    assert.equal(hasAnalyticsConsent(), true);
    assert.equal(hasAdvertisingConsent(), true);

    // Revoke advertising -> immediately false
    saveCookieConsent({ analytics: true, advertising: false });
    assert.equal(hasAdvertisingConsent(), false);

    unsub();
    assert.equal(events.length, 4);
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindow;
    }
    resetCookieConsentCacheForTests();
  }

  // 3. All 10 supported locales have complete cookie banner & modal translations
  for (const locale of SUPPORTED_LOCALES) {
    const copy = COOKIE_CONSENT_COPY[locale];
    assert.ok(copy, `Missing COOKIE_CONSENT_COPY for ${locale}`);
    assert.ok(copy.acceptAll.length > 0);
    assert.ok(copy.rejectAll.length > 0);
    assert.ok(copy.customize.length > 0);
    assert.ok(copy.saveChoices.length > 0);
    assert.ok(copy.footerLinkLabel.length > 0);
    assert.ok(copy.categories.essential.title.length > 0);
    assert.ok(copy.categories.analytics.title.length > 0);
    assert.ok(copy.categories.advertising.title.length > 0);

    // 4. All 10 legal Privacy JSON files document vidnex_cookie_consent_v1 & Adsterra
    const legalPath = path.resolve(process.cwd(), 'src/i18n/legal', `${locale}.json`);
    const legalData = JSON.parse(fs.readFileSync(legalPath, 'utf8'));
    const privacyText = (legalData.privacy?.sections || [])
      .flatMap((s: any) => [s.heading || '', ...(s.paragraphs || [])])
      .join('\n');
    assert.ok(
      privacyText.includes('vidnex_cookie_consent_v1'),
      `Privacy page for ${locale} must document vidnex_cookie_consent_v1`
    );
    assert.ok(
      privacyText.includes('Adsterra'),
      `Privacy page for ${locale} must describe Adsterra advertising partner`
    );
  }
});


