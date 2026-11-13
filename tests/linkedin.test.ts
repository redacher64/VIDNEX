import test from 'node:test';
import assert from 'node:assert/strict';
import { detectUrl } from '../functions/_lib/detect.ts';
import {
  detectMediaUrl,
  getDetectedUrlInfo,
  detectLinkedInUrl,
  normalizeLinkedInSlug,
  LINKEDIN_PROFILE_URL_REGEX,
} from '../src/utils/urlDetector.ts';
import { isAllowedMediaHost, isAllowedMediaUrl } from '../functions/_lib/allowlist.ts';
import { parseLinkedInProfileHtml, extractLinkedIn } from '../functions/_lib/linkedin.ts';
import { createMemoryD1Database } from '../functions/_lib/db.ts';
import {
  checkD1DownloadRateLimit,
  resetRateLimitBuckets,
} from '../functions/_lib/ratelimit.ts';
import {
  logExtractionEvent,
  incrementDailyMetrics,
  resetEngineStatusCache,
} from '../functions/_lib/logger.ts';
import { updateSystemSettings } from '../functions/_lib/settings.ts';
import { onRequestGet as adminStatsGet } from '../functions/api/admin/stats.ts';

test('detectUrl and detectMediaUrl accept linkedin.com/in/{slug} and country subdomains', () => {
  const validCases = [
    { url: 'https://www.linkedin.com/in/satyanadella', expectedSlug: 'satyanadella' },
    { url: 'https://linkedin.com/in/Satya-Nadella_123/', expectedSlug: 'satya-nadella_123' },
    { url: 'https://fr.linkedin.com/in/jean-dupont?trk=public_profile', expectedSlug: 'jean-dupont' },
    { url: 'https://uk.linkedin.com/in/john-doe-99/', expectedSlug: 'john-doe-99' },
  ];

  for (const { url, expectedSlug } of validCases) {
    assert.equal(LINKEDIN_PROFILE_URL_REGEX.test(url), true, `Regex should match ${url}`);
    const backend = detectUrl(url);
    assert.equal(backend.isValid, true, `Backend should accept ${url}`);
    assert.equal(backend.platform, 'linkedin');
    assert.equal(backend.identifier, expectedSlug);

    const direct = detectLinkedInUrl(url);
    assert.equal(direct?.isValid, true, `detectLinkedInUrl should accept ${url}`);
    assert.equal(direct?.identifier, expectedSlug);
    assert.equal(normalizeLinkedInSlug(expectedSlug), expectedSlug);

    const frontend = detectMediaUrl(url);
    assert.equal(frontend.isValid, true, `Frontend should accept ${url}`);
    assert.equal(frontend.platform, 'linkedin');
    assert.equal(frontend.identifier, expectedSlug);

    const info = getDetectedUrlInfo(url);
    assert.equal(info.isValid, true, `getDetectedUrlInfo should accept ${url}`);
    assert.equal(info.platform, 'linkedin');
    assert.equal(info.identifier, expectedSlug);
  }
});

test('detectUrl and detectMediaUrl reject unsupported LinkedIn URLs', () => {
  const invalidUrls = [
    'https://www.linkedin.com/company/microsoft',
    'https://www.linkedin.com/posts/satyanadella_ai-cloud-activity-123456789-abcd',
    'https://www.linkedin.com/feed/update/urn:li:activity:123456789/',
    'https://www.linkedin.com/in/satyanadella/recent-activity/all/',
    'https://www.linkedin.com/jobs/view/123456',
    'https://www.linkedin.com/pulse/some-article',
    'https://www.linkedin.com/',
  ];

  for (const url of invalidUrls) {
    const backend = detectUrl(url);
    assert.equal(backend.isValid, false, `Backend should reject ${url}`);

    const frontend = detectMediaUrl(url);
    assert.equal(frontend.isValid, false, `Frontend should reject ${url}`);
  }
});

test('allowlist accepts media.licdn.com and rejects bare linkedin.com or static.licdn.com', () => {
  assert.equal(isAllowedMediaHost('media.licdn.com'), true);
  assert.equal(isAllowedMediaHost('dms.media.licdn.com'), true);
  assert.equal(
    isAllowedMediaUrl('https://media.licdn.com/dms/image/v2/D5603AQE/profile-displayphoto-shrink_800_800/0/1700000000000?e=1750000000&v=beta&t=abc123XYZ'),
    true
  );

  assert.equal(isAllowedMediaHost('linkedin.com'), false);
  assert.equal(isAllowedMediaHost('www.linkedin.com'), false);
  assert.equal(isAllowedMediaHost('licdn.com'), false);
  assert.equal(isAllowedMediaHost('static.licdn.com'), false);
});

test('parseLinkedInProfileHtml extracts signed og:image as-is and sets title=@slug only', () => {
  const signedUrl = 'https://media.licdn.com/dms/image/v2/D5603AQE/profile-displayphoto-shrink_800_800/0/1700000000000?e=1750000000&amp;v=beta&amp;t=sig_123';
  const expectedUrl = 'https://media.licdn.com/dms/image/v2/D5603AQE/profile-displayphoto-shrink_800_800/0/1700000000000?e=1750000000&v=beta&t=sig_123';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Jane Doe - CEO at Example | LinkedIn</title>
        <meta property="og:title" content="Jane Doe - CEO at Example | LinkedIn" />
        <meta property="og:image" content="${signedUrl}" />
      </head>
      <body>Profile content</body>
    </html>
  `;

  const parsed = parseLinkedInProfileHtml(html, 'jane-doe');
  assert.equal(parsed.ok, true);
  assert.equal(parsed.type, 'image');
  assert.equal(parsed.title, '@jane-doe');
  assert.equal(parsed.author?.full_name, undefined);
  assert.equal(parsed.items?.[0]?.url, expectedUrl);
});

test('parseLinkedInProfileHtml falls back to JSON-LD Person image', () => {
  const signedUrl = 'https://media.licdn.com/dms/image/v2/C4D03AQ/profile-displayphoto-shrink_800_800/0/1650000000000?e=1750000000&v=beta&t=jsonld_sig';
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "http://schema.org",
            "@type": "ProfilePage",
            "mainEntity": {
              "@type": "Person",
              "name": "Should Not Be Extracted",
              "jobTitle": "Should Not Be Extracted",
              "image": {
                "@type": "ImageObject",
                "contentUrl": "${signedUrl}"
              }
            }
          }
        </script>
      </head>
      <body>Profile content</body>
    </html>
  `;

  const parsed = parseLinkedInProfileHtml(html, 'john-smith');
  assert.equal(parsed.ok, true);
  assert.equal(parsed.type, 'image');
  assert.equal(parsed.title, '@john-smith');
  assert.equal(parsed.items?.[0]?.url, signedUrl);
});

test('parseLinkedInProfileHtml returns PRIVATE_OR_LOGIN_REQUIRED on ghost/default avatar', () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta property="og:image" content="https://static.licdn.com/aero-v1/sc/h/244xhbkr7g40x6bsu4gi6q4ry" />
      </head>
      <body>Public profile without photo</body>
    </html>
  `;

  const parsed = parseLinkedInProfileHtml(html, 'no-photo-user');
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error?.code, 'PRIVATE_OR_LOGIN_REQUIRED');
});

test('parseLinkedInProfileHtml returns BLOCKED_BY_PLATFORM on authwall HTML', () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head><title>Sign Up | LinkedIn</title></head>
      <body><a href="/uas/login">Sign in</a> authwall</body>
    </html>
  `;

  const parsed = parseLinkedInProfileHtml(html, 'some-user');
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error?.code, 'BLOCKED_BY_PLATFORM');
});

test('live extractLinkedIn on public profile handles LinkedIn response cleanly', async () => {
  const res = await extractLinkedIn('satyanadella');
  assert.ok(
    res.ok || ['BLOCKED_BY_PLATFORM', 'PRIVATE_OR_LOGIN_REQUIRED', 'NOT_FOUND', 'TIMEOUT'].includes(res.error?.code || ''),
    `Unexpected result: ${JSON.stringify(res)}`
  );
  if (res.ok) {
    assert.equal(res.platform, 'linkedin');
    assert.equal(res.type, 'image');
    assert.equal(res.title, '@satyanadella');
  }
});

test('/api/download rate limit counts once per file per minute (Range included) and respects download_limit_per_min', async () => {
  resetRateLimitBuckets();
  const db = createMemoryD1Database();
  const env = { DB: db, IP_HASH_SALT: 'test-salt' };
  await updateSystemSettings(env, { download_limit_per_min: 2 });

  const nowMs = 1_700_000_000_000;
  const ipHash = 'hashed_ip_1';
  const fileA = 'https://video.twimg.com/ext_tw_video/1/pu/vid/720x1280/a.mp4';
  const fileB = 'https://video.twimg.com/ext_tw_video/2/pu/vid/720x1280/b.mp4';
  const fileC = 'https://video.twimg.com/ext_tw_video/3/pu/vid/720x1280/c.mp4';

  // First request for fileA -> count = 1, firstRequestForFile = true
  const r1 = await checkD1DownloadRateLimit(env, ipHash, fileA, 2, nowMs);
  assert.equal(r1.allowed, true);
  assert.equal(r1.count, 1);
  assert.equal(r1.firstRequestForFile, true);

  // Subsequent Range requests for fileA in the same minute -> still count = 1, firstRequestForFile = false
  const r1Range1 = await checkD1DownloadRateLimit(env, ipHash, fileA, 2, nowMs + 500);
  const r1Range2 = await checkD1DownloadRateLimit(env, ipHash, fileA, 2, nowMs + 1200);
  assert.equal(r1Range1.allowed, true);
  assert.equal(r1Range1.count, 1);
  assert.equal(r1Range1.firstRequestForFile, false);
  assert.equal(r1Range2.allowed, true);
  assert.equal(r1Range2.count, 1);
  assert.equal(r1Range2.firstRequestForFile, false);

  // Second distinct file fileB -> count = 2, allowed = true
  const r2 = await checkD1DownloadRateLimit(env, ipHash, fileB, 2, nowMs + 2000);
  assert.equal(r2.allowed, true);
  assert.equal(r2.count, 2);
  assert.equal(r2.firstRequestForFile, true);

  // Third distinct file fileC in the same minute -> count = 3 > 2, allowed = false (429 + Retry-After > 0)
  const r3 = await checkD1DownloadRateLimit(env, ipHash, fileC, 2, nowMs + 3000);
  assert.equal(r3.allowed, false);
  assert.equal(r3.count, 3);
  assert.ok(r3.retryAfterSec > 0);
});

test('daily_metrics aggregates successes without personal identifiers, logs only errors in request_log, and reduces D1 writes', async () => {
  const { createSignedSessionToken } = await import('../functions/_lib/auth.ts');
  resetEngineStatusCache();
  const db = createMemoryD1Database();
  const sessionSecret = 'test-session-secret-metrics';
  const ownerToken = await createSignedSessionToken(sessionSecret);
  const ownerCookie = `vidnex_admin_session=${ownerToken}`;
  const env = { DB: db, SESSION_SECRET: sessionSecret };
  const nowMs = Date.now();

  db.resetWriteCount?.();

  // First successful extraction of the minute: writes daily_metrics (1) + engine_status (1) = 2 writes
  await logExtractionEvent(env, {
    platform: 'tiktok',
    status: 'success',
    durationMs: 210,
    ipHash: 'should_not_be_stored',
    ts: nowMs,
  });
  const writesFirstSuccess = db.getWriteCount?.() ?? 0;
  assert.equal(writesFirstSuccess, 2);

  // Subsequent successful extraction within the same minute: writes ONLY daily_metrics (1 write, 0 request_log rows)
  db.resetWriteCount?.();
  await logExtractionEvent(env, {
    platform: 'tiktok',
    status: 'success',
    durationMs: 185,
    ipHash: 'should_not_be_stored',
    ts: nowMs + 1000,
  });
  const writesSteadySuccess = db.getWriteCount?.() ?? 0;
  assert.equal(writesSteadySuccess, 1);

  // Record a download started & completed
  await incrementDailyMetrics(env, 'tiktok', ['download_started'], nowMs);
  await incrementDailyMetrics(env, 'tiktok', ['download_success'], nowMs);

  // Log an error -> written to request_log with truncated salted ip_hash and null http_status on TIMEOUT
  await logExtractionEvent(env, {
    platform: 'tiktok',
    status: 'error',
    errorCode: 'TIMEOUT',
    engineStage: 'tiers:tikwm',
    httpStatus: 504,
    contentKind: 'video',
    engineFn: 'tiktok.video',
    durationMs: 8000,
    ipHash: 'abcdef1234567890abcdef1234567890',
    ts: nowMs + 2000,
  });

  // Verify request_log has ONLY 1 row (the error), truncated ip_hash (12 chars), and null http_status on TIMEOUT
  const logRows = await db
    .prepare('SELECT id, ts, platform, status, error_code, duration_ms, ip_hash, engine_stage, http_status, content_kind, engine_fn FROM request_log LIMIT ? OFFSET ?')
    .bind(25, 0)
    .all<{
      status: string;
      error_code: string;
      ip_hash: string;
      engine_stage: string;
      http_status: number | null;
      content_kind: string;
      engine_fn: string;
    }>();

  assert.equal(logRows.results.length, 1);
  assert.equal(logRows.results[0].status, 'error');
  assert.equal(logRows.results[0].error_code, 'TIMEOUT');
  assert.equal(logRows.results[0].engine_stage, 'tiers:tikwm');
  assert.equal(logRows.results[0].http_status, null);
  assert.equal(logRows.results[0].content_kind, 'video');
  assert.equal(logRows.results[0].engine_fn, 'tiktok.video');
  assert.equal(logRows.results[0].ip_hash, 'abcdef123456');

  // Verify /api/admin/stats funnel and platform rates
  const statsRes = await adminStatsGet({
    request: new Request('https://vidnex.space/api/admin/stats', {
      headers: { Cookie: ownerCookie },
    }),
    env,
  });
  const statsJson = (await statsRes.json()) as {
    ok: boolean;
    funnel: {
      extract_started: number;
      extract_success: number;
      extract_error: number;
      download_started: number;
      download_success: number;
    };
    platforms: {
      tiktok: {
        total: number;
        success: number;
        error: number;
        successRate: number;
        download_started: number;
        download_success: number;
      };
    };
  };

  assert.equal(statsJson.ok, true);
  assert.equal(statsJson.funnel.extract_started, 3);
  assert.equal(statsJson.funnel.extract_success, 2);
  assert.equal(statsJson.funnel.extract_error, 1);
  assert.equal(statsJson.funnel.download_started, 1);
  assert.equal(statsJson.funnel.download_success, 1);
  assert.equal(statsJson.platforms.tiktok.total, 3);
  assert.equal(statsJson.platforms.tiktok.success, 2);
  assert.equal(statsJson.platforms.tiktok.error, 1);
  assert.equal(statsJson.platforms.tiktok.successRate, 66.7);
});

test('ALERT_WEBHOOK_URL sends ONE alert at 5 consecutive failures, recovery alert on next success, and nothing when absent', async () => {
  resetEngineStatusCache();
  const db = createMemoryD1Database();
  const webhookCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const origFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = typeof input === 'string' ? input : input.toString();
    const parsedBody = init?.body ? JSON.parse(String(init.body)) : {};
    webhookCalls.push({ url: urlStr, body: parsedBody });
    return new Response('ok', { status: 200 });
  }) as typeof fetch;

  try {
    // 1. Without ALERT_WEBHOOK_URL -> 5 failures send 0 webhooks
    const envNoWebhook = { DB: db };
    for (let i = 0; i < 5; i++) {
      await logExtractionEvent(envNoWebhook, {
        platform: 'x',
        status: 'error',
        errorCode: 'BLOCKED_BY_PLATFORM',
        durationMs: 400,
      });
    }
    assert.equal(webhookCalls.length, 0);

    // 2. With ALERT_WEBHOOK_URL -> 5 consecutive failures on instagram send 1 outage alert
    const envWithWebhook = {
      DB: db,
      ALERT_WEBHOOK_URL: 'https://discord.com/api/webhooks/123456/token',
    };
    for (let i = 1; i <= 4; i++) {
      await logExtractionEvent(envWithWebhook, {
        platform: 'instagram',
        status: 'error',
        errorCode: 'BLOCKED_BY_PLATFORM',
        engineStage: 'graphql',
        httpStatus: 429,
        durationMs: 300,
      });
    }
    assert.equal(webhookCalls.length, 0, 'Should not alert before 5th failure');

    // 5th failure -> triggers 1 alert
    await logExtractionEvent(envWithWebhook, {
      platform: 'instagram',
      status: 'error',
      errorCode: 'BLOCKED_BY_PLATFORM',
      engineStage: 'graphql',
      httpStatus: 429,
      durationMs: 300,
    });
    assert.equal(webhookCalls.length, 1, 'Should send 1 outage alert on 5th failure');
    assert.match(String(webhookCalls[0].body.content), /5 échecs consécutifs/);

    // 6th failure -> should NOT send duplicate alert
    await logExtractionEvent(envWithWebhook, {
      platform: 'instagram',
      status: 'error',
      errorCode: 'BLOCKED_BY_PLATFORM',
      durationMs: 300,
    });
    assert.equal(webhookCalls.length, 1, 'Should not send duplicate alert on 6th failure');

    // Recovery on next success -> sends 1 recovery alert
    await logExtractionEvent(envWithWebhook, {
      platform: 'instagram',
      status: 'success',
      durationMs: 250,
    });
    assert.equal(webhookCalls.length, 2, 'Should send recovery alert on next success');
    assert.match(String(webhookCalls[1].body.content), /Retour à la normale/);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('Admin Activity logs 1 failure per platform (5 platforms) with all columns populated (content_kind, engine_fn, engine_stage, http_status, error_code, duration_ms, salted ip_hash) and supports filters', async () => {
  const { onRequestPost: extractPost } = await import('../functions/api/extract.ts');
  const { onRequestGet: activityGet } = await import('../functions/api/admin/activity.ts');
  const { createSignedSessionToken } = await import('../functions/_lib/auth.ts');

  const db = createMemoryD1Database();
  const sessionSecret = 'vidnex-test-session-secret-activity';
  const ownerToken = await createSignedSessionToken(sessionSecret);
  const ownerCookie = `vidnex_admin_session=${ownerToken}`;
  const env = {
    DB: db,
    IP_HASH_SALT: 'vidnex-test-salt-2026',
    SESSION_SECRET: sessionSecret,
  };

  const origFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const u = typeof input === 'string' ? input : input.toString();
    if (u.includes('tikwm.com')) {
      return new Response(JSON.stringify({ code: -1, msg: 'Video not found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (u.includes('tiktok.com')) {
      return new Response('<html>Not found</html>', { status: 404 });
    }
    if (u.includes('instagram.com/graphql/query')) {
      return new Response(JSON.stringify({ data: { xdt_shortcode_media: null } }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (u.includes('instagram.com') || u.includes('vxinstagram.com')) {
      return new Response('<html>Login required</html>', { status: 403 });
    }
    if (u.includes('syndication.twimg.com')) {
      return new Response('Not Found', { status: 404 });
    }
    if (u.includes('facebook.com')) {
      return new Response('<html>login/checkpoint</html>', { status: 200 });
    }
    if (u.includes('linkedin.com')) {
      return new Response('<html><body><a href="/authwall">Sign in</a></body></html>', { status: 200 });
    }
    return new Response('Not found', { status: 404 });
  }) as typeof fetch;

  const pendingLogs: Promise<unknown>[] = [];
  const ctx = {
    waitUntil(p: Promise<unknown>) {
      pendingLogs.push(p);
    },
  };

  try {
    const testCases = [
      {
        platform: 'tiktok',
        url: 'https://www.tiktok.com/@creator/photo/7123456789012345678',
        expectedKind: 'photo',
        expectedFn: 'tiktok.photo',
        expectedStage: 'direct',
        expectedHttp: 404,
      },
      {
        platform: 'instagram',
        url: 'https://www.instagram.com/reel/C9abcDEF123/',
        expectedKind: 'reel',
        expectedFn: 'instagram.reel',
        expectedStage: 'embed',
        expectedHttp: 403,
      },
      {
        platform: 'x',
        url: 'https://x.com/user/status/1899999999999999999',
        expectedKind: 'video',
        expectedFn: 'x.syndication',
        expectedStage: 'syndication',
        expectedHttp: 404,
      },
      {
        platform: 'facebook',
        url: 'https://www.facebook.com/reel/987654321098765',
        expectedKind: 'reel',
        expectedFn: 'facebook.reel',
        expectedStage: 'embed',
        expectedHttp: 200,
      },
      {
        platform: 'linkedin',
        url: 'https://www.linkedin.com/in/jean-dupont-test',
        expectedKind: 'profile',
        expectedFn: 'linkedin.profile',
        expectedStage: 'authwall',
        expectedHttp: 200,
      },
    ];

    for (const tc of testCases) {
      const res = await extractPost({
        request: new Request('https://vidnex.space/api/extract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '203.0.113.42',
          },
          body: JSON.stringify({ url: tc.url }),
        }),
        env,
        ctx,
      });
      assert.notEqual(res.status, 200, `Expected failure for ${tc.platform}`);
    }

    await Promise.all(pendingLogs);

    const actRes = await activityGet({
      request: new Request('https://vidnex.space/api/admin/activity?page=1&limit=25', {
        headers: { Cookie: ownerCookie },
      }),
      env,
    });
    assert.equal(actRes.status, 200);
    const actData = (await actRes.json()) as {
      ok: boolean;
      total: number;
      items: Array<{
        id: number;
        ts: number;
        platform: string;
        content_kind: string | null;
        engine_fn: string | null;
        engine_stage: string | null;
        http_status: number | null;
        error_code: string | null;
        duration_ms: number;
        ip_hash_short: string;
        ip_hash: string;
      }>;
    };

    assert.equal(actData.ok, true);
    assert.equal(actData.total, 5);

    for (const tc of testCases) {
      const row = actData.items.find((r) => r.platform === tc.platform);
      assert.ok(row, `Missing log row for ${tc.platform}`);
      assert.equal(row.content_kind, tc.expectedKind, `content_kind mismatch on ${tc.platform}`);
      assert.equal(row.engine_fn, tc.expectedFn, `engine_fn mismatch on ${tc.platform}`);
      assert.equal(row.engine_stage, tc.expectedStage, `engine_stage mismatch on ${tc.platform}`);
      assert.equal(row.http_status, tc.expectedHttp, `http_status mismatch on ${tc.platform}`);
      assert.ok(row.error_code && row.error_code.length > 0, `error_code missing on ${tc.platform}`);
      assert.equal(typeof row.duration_ms, 'number');
      assert.equal(row.ip_hash.length, 12, `ip_hash should be 12 hex chars on ${tc.platform}`);
      assert.equal(row.ip_hash_short, row.ip_hash);
      assert.notEqual(row.ip_hash_short, 'anonyme');
      assert.ok(!JSON.stringify(row).includes(tc.url), 'Log row must never contain the URL');
    }

    // Verify filtering by platform and by error_code
    const filteredPlatformRes = await activityGet({
      request: new Request('https://vidnex.space/api/admin/activity?page=1&limit=25&platform=linkedin', {
        headers: { Cookie: ownerCookie },
      }),
      env,
    });
    const filteredPlatformData = (await filteredPlatformRes.json()) as { total: number; items: Array<{ platform: string }> };
    assert.equal(filteredPlatformData.total, 1);
    assert.equal(filteredPlatformData.items[0].platform, 'linkedin');

    const filteredErrorRes = await activityGet({
      request: new Request('https://vidnex.space/api/admin/activity?page=1&limit=25&error_code=NOT_FOUND', {
        headers: { Cookie: ownerCookie },
      }),
      env,
    });
    const filteredErrorData = (await filteredErrorRes.json()) as { total: number; items: Array<{ error_code: string }> };
    assert.ok(filteredErrorData.total >= 2);
    assert.ok(filteredErrorData.items.every((it) => it.error_code === 'NOT_FOUND'));

    // Verify legacy row (pre-0005 migration with null content_kind, null engine_fn, empty ip_hash) returns '—' for ip_hash_short
    await db
      .prepare('INSERT INTO request_log (ts, platform, status, error_code, duration_ms, ip_hash) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(Date.now() + 5000, 'tiktok', 'error', 'NOT_FOUND', 120, '')
      .run();
    const legacyRes = await activityGet({
      request: new Request('https://vidnex.space/api/admin/activity?page=1&limit=25&platform=tiktok', {
        headers: { Cookie: ownerCookie },
      }),
      env,
    });
    const legacyData = (await legacyRes.json()) as {
      items: Array<{ content_kind: string | null; engine_fn: string | null; ip_hash_short: string }>;
    };
    const legacyRow = legacyData.items[0];
    assert.equal(legacyRow.content_kind, null);
    assert.equal(legacyRow.engine_fn, null);
    assert.equal(legacyRow.ip_hash_short, '—');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('adminTheme: resolves initial theme from localStorage or prefers-color-scheme and applies DOM classes', async () => {
  const {
    ADMIN_THEME_STORAGE_KEY,
    resolveInitialAdminTheme,
    applyAdminThemeToDocument,
  } = await import('../src/pages/admin/adminTheme.ts');

  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  };

  // 1. System preference fallback when localStorage is empty
  assert.equal(resolveInitialAdminTheme(mockStorage, () => true), 'dark');
  assert.equal(resolveInitialAdminTheme(mockStorage, () => false), 'light');

  // 2. Stored preference takes precedence over system preference
  mockStorage.setItem(ADMIN_THEME_STORAGE_KEY, 'light');
  assert.equal(resolveInitialAdminTheme(mockStorage, () => true), 'light');
  mockStorage.setItem(ADMIN_THEME_STORAGE_KEY, 'dark');
  assert.equal(resolveInitialAdminTheme(mockStorage, () => false), 'dark');

  // 3. DOM class and data-admin-theme application + persistence
  const classes = new Set<string>(['dark']);
  const attrs = new Map<string, string>();
  const mockDoc = {
    documentElement: {
      classList: {
        add: (...tokens: string[]) => tokens.forEach((t) => classes.add(t)),
        remove: (...tokens: string[]) => tokens.forEach((t) => classes.delete(t)),
      },
      setAttribute: (name: string, value: string) => attrs.set(name, value),
    },
  };

  applyAdminThemeToDocument('light', mockDoc, mockStorage, true);
  assert.equal(classes.has('light'), true);
  assert.equal(classes.has('dark'), false);
  assert.equal(attrs.get('data-admin-theme'), 'light');
  assert.equal(mockStorage.getItem(ADMIN_THEME_STORAGE_KEY), 'light');

  applyAdminThemeToDocument('dark', mockDoc, mockStorage, true);
  assert.equal(classes.has('dark'), true);
  assert.equal(classes.has('light'), false);
  assert.equal(attrs.get('data-admin-theme'), 'dark');
  assert.equal(mockStorage.getItem(ADMIN_THEME_STORAGE_KEY), 'dark');
});

test('Admin RBAC & Security: owner retains full access, first-login mandatory password change, 403 per route without permission, default-deny on undeclared route, session invalidation on deactivate/reset/permission change', async () => {
  const workerMod = await import('../worker.ts');
  const worker = workerMod.default;
  const { onRequest: adminMiddleware } = await import('../functions/_middleware.ts');
  const { requirePermission } = await import('../functions/_lib/auth.ts');

  const db = createMemoryD1Database();
  const env = {
    DB: db,
    ADMIN_PASSWORD: 'owner-master-password-2026',
    SESSION_SECRET: 'hmac-secret-rbac-test-2026',
    IP_HASH_SALT: 'salt-rbac-test-2026',
  };

  // 1. Owner login works and retains full access to all /api/admin/* routes
  const ownerLoginRes = await worker.fetch(
    new Request('https://vidnex.space/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://vidnex.space',
        'CF-Connecting-IP': '192.0.2.10',
      },
      body: JSON.stringify({
        login: 'admin',
        password: 'owner-master-password-2026',
      }),
    }),
    env
  );
  assert.equal(ownerLoginRes.status, 200);
  const ownerLoginJson: any = await ownerLoginRes.json();
  assert.equal(ownerLoginJson.user.isOwner, true);
  const ownerCookie = (ownerLoginRes.headers.get('Set-Cookie') || '').split(';')[0];
  assert.ok(ownerCookie.startsWith('vidnex_admin_session='));

  for (const path of [
    '/api/admin/stats',
    '/api/admin/health',
    '/api/admin/settings',
    '/api/admin/blocklist',
    '/api/admin/activity',
    '/api/admin/users',
    '/api/admin/account',
  ]) {
    const res = await worker.fetch(
      new Request(`https://vidnex.space${path}`, {
        headers: { Cookie: ownerCookie },
      }),
      env
    );
    assert.equal(res.status, 200, `Owner should have 200 on ${path}`);
  }

  // Owner cannot deactivate or delete themselves
  const selfDeactivateRes = await worker.fetch(
    new Request('https://vidnex.space/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://vidnex.space',
        Cookie: ownerCookie,
      },
      body: JSON.stringify({ action: 'toggle_active', userId: 'owner' }),
    }),
    env
  );
  assert.equal(selfDeactivateRes.status, 400);

  // 2. Owner creates a "Rédacteur blog" user (only `blog.write` permission, no dashboard/health/activity/controls/users)
  const createUserRes = await worker.fetch(
    new Request('https://vidnex.space/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://vidnex.space',
        Cookie: ownerCookie,
      },
      body: JSON.stringify({
        action: 'create',
        login: 'redacteur1',
        display_name: 'Alice Rédactrice',
        role_label: 'Rédacteur blog',
        permissions: ['blog.write', 'controls', 'users', 'settings'], // non-assignable permissions must be stripped!
      }),
    }),
    env
  );
  assert.equal(createUserRes.status, 201);
  const createUserJson: any = await createUserRes.json();
  assert.equal(createUserJson.ok, true);
  assert.equal(typeof createUserJson.temporaryPassword, 'string');
  assert.equal(createUserJson.temporaryPassword.length, 16);
  assert.deepEqual(createUserJson.user.permissions, ['blog.write']);
  assert.equal(createUserJson.user.password_hash, undefined, 'Password hash must never be returned');

  const tempPassword = createUserJson.temporaryPassword;
  const userId = createUserJson.user.id;

  // 3. First login with temporary password -> mustChangePassword = true
  const userFirstLoginRes = await worker.fetch(
    new Request('https://vidnex.space/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://vidnex.space',
        'CF-Connecting-IP': '192.0.2.20',
      },
      body: JSON.stringify({
        login: 'redacteur1',
        password: tempPassword,
      }),
    }),
    env
  );
  assert.equal(userFirstLoginRes.status, 200);
  const firstLoginData: any = await userFirstLoginRes.json();
  assert.equal(firstLoginData.user.mustChangePassword, true);
  assert.equal(firstLoginData.user.isOwner, false);
  const firstCookie = (userFirstLoginRes.headers.get('Set-Cookie') || '').split(';')[0];

  // While mustChangePassword is true, any protected route returns 403 MUST_CHANGE_PASSWORD
  const blockedBeforeChangeRes = await worker.fetch(
    new Request('https://vidnex.space/api/admin/stats', {
      headers: { Cookie: firstCookie },
    }),
    env
  );
  assert.equal(blockedBeforeChangeRes.status, 403);
  const blockedBeforeChangeJson: any = await blockedBeforeChangeRes.json();
  assert.equal(blockedBeforeChangeJson.errorCode, 'MUST_CHANGE_PASSWORD');

  // Attempting to set a password < 12 chars or identical to temporary password fails with 400
  const shortPwdRes = await worker.fetch(
    new Request('https://vidnex.space/api/admin/account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://vidnex.space',
        Cookie: firstCookie,
      },
      body: JSON.stringify({
        currentPassword: tempPassword,
        newPassword: 'short123',
      }),
    }),
    env
  );
  assert.equal(shortPwdRes.status, 400);

  const samePwdRes = await worker.fetch(
    new Request('https://vidnex.space/api/admin/account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://vidnex.space',
        Cookie: firstCookie,
      },
      body: JSON.stringify({
        currentPassword: tempPassword,
        newPassword: tempPassword,
      }),
    }),
    env
  );
  assert.equal(samePwdRes.status, 400);

  // Valid password change (>= 12 chars, different from temporary) succeeds and issues new session cookie
  const newPermanentPassword = 'NouveauMotDePasseSecurise2026!';
  const changePwdRes = await worker.fetch(
    new Request('https://vidnex.space/api/admin/account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://vidnex.space',
        Cookie: firstCookie,
      },
      body: JSON.stringify({
        currentPassword: tempPassword,
        newPassword: newPermanentPassword,
      }),
    }),
    env
  );
  assert.equal(changePwdRes.status, 200);
  const changePwdJson: any = await changePwdRes.json();
  assert.equal(changePwdJson.user.mustChangePassword, false);
  const activeUserCookie = (changePwdRes.headers.get('Set-Cookie') || '').split(';')[0];

  // Old cookie (session_version 1) is immediately invalidated (401)
  const oldCookieRes = await worker.fetch(
    new Request('https://vidnex.space/api/admin/account', {
      headers: { Cookie: firstCookie },
    }),
    env
  );
  assert.equal(oldCookieRes.status, 401);

  // 4. User without permission (`redacteur1` has only `blog.write`) gets 403 FORBIDDEN on every protected route
  for (const [method, path] of [
    ['GET', '/api/admin/stats'],
    ['GET', '/api/admin/health'],
    ['POST', '/api/admin/health'],
    ['GET', '/api/admin/activity'],
    ['GET', '/api/admin/settings'],
    ['POST', '/api/admin/settings'],
    ['GET', '/api/admin/blocklist'],
    ['POST', '/api/admin/blocklist'],
    ['DELETE', '/api/admin/blocklist'],
    ['GET', '/api/admin/users'],
    ['POST', '/api/admin/users'],
  ] as const) {
    const res = await worker.fetch(
      new Request(`https://vidnex.space${path}`, {
        method,
        headers: {
          Cookie: activeUserCookie,
          'Content-Type': 'application/json',
          Origin: 'https://vidnex.space',
        },
        body: method === 'GET' ? undefined : JSON.stringify({}),
      }),
      env
    );
    assert.equal(res.status, 403, `Expected 403 FORBIDDEN for ${method} ${path}`);
    const errBody: any = await res.json();
    assert.equal(errBody.errorCode, 'FORBIDDEN');
    assert.equal(errBody.message, 'Accès refusé.');
  }

  // 5. Default = deny: any route without a declared permission is denied (403) for non-owners and allowed for owner
  const undeclaredNonOwnerRes = await adminMiddleware({
    request: new Request('https://vidnex.space/api/admin/undeclared-future-route', {
      headers: { Cookie: activeUserCookie },
    }),
    env,
    next: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
  });
  assert.equal(undeclaredNonOwnerRes.status, 403);

  const directDefaultDeny = await requirePermission(
    new Request('https://vidnex.space/api/admin/custom', {
      headers: { Cookie: activeUserCookie },
    }),
    env
  );
  assert.equal(directDefaultDeny.ok, false);
  if (!directDefaultDeny.ok) {
    assert.equal(directDefaultDeny.status, 403);
  }

  const undeclaredOwnerRes = await adminMiddleware({
    request: new Request('https://vidnex.space/api/admin/undeclared-future-route', {
      headers: { Cookie: ownerCookie },
    }),
    env,
    next: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
  });
  assert.equal(undeclaredOwnerRes.status, 200);

  // 6. Updating permissions increments session_version (invalidating previous session) and grants new rights upon re-login
  const updatePermsRes = await worker.fetch(
    new Request('https://vidnex.space/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://vidnex.space',
        Cookie: ownerCookie,
      },
      body: JSON.stringify({
        action: 'update_permissions',
        userId,
        role_label: 'Observateur',
        permissions: ['dashboard.view', 'health.view'],
      }),
    }),
    env
  );
  assert.equal(updatePermsRes.status, 200);

  // Previous session is immediately invalidated (401) because session_version was incremented
  const afterPermUpdateOldCookieRes = await worker.fetch(
    new Request('https://vidnex.space/api/admin/stats', {
      headers: { Cookie: activeUserCookie },
    }),
    env
  );
  assert.equal(afterPermUpdateOldCookieRes.status, 401);

  // Re-login gets new permissions: GET /api/admin/stats (200) and GET /api/admin/health (200), but POST /api/admin/health (403) and GET /api/admin/activity (403)
  const reloginRes = await worker.fetch(
    new Request('https://vidnex.space/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://vidnex.space',
        'CF-Connecting-IP': '192.0.2.21',
      },
      body: JSON.stringify({
        login: 'redacteur1',
        password: newPermanentPassword,
      }),
    }),
    env
  );
  assert.equal(reloginRes.status, 200);
  const reloginCookie = (reloginRes.headers.get('Set-Cookie') || '').split(';')[0];

  const obsStatsRes = await worker.fetch(
    new Request('https://vidnex.space/api/admin/stats', {
      headers: { Cookie: reloginCookie },
    }),
    env
  );
  assert.equal(obsStatsRes.status, 200);

  const obsHealthGetRes = await worker.fetch(
    new Request('https://vidnex.space/api/admin/health', {
      headers: { Cookie: reloginCookie },
    }),
    env
  );
  assert.equal(obsHealthGetRes.status, 200);

  const obsHealthPostRes = await worker.fetch(
    new Request('https://vidnex.space/api/admin/health', {
      method: 'POST',
      headers: {
        Cookie: reloginCookie,
        'Content-Type': 'application/json',
        Origin: 'https://vidnex.space',
      },
      body: JSON.stringify({ action: 'test_ig_cookie' }),
    }),
    env
  );
  assert.equal(obsHealthPostRes.status, 403);

  const obsActivityRes = await worker.fetch(
    new Request('https://vidnex.space/api/admin/activity', {
      headers: { Cookie: reloginCookie },
    }),
    env
  );
  assert.equal(obsActivityRes.status, 403);

  // 7. Deactivating the account immediately invalidates its session (401) and blocks login
  const deactivateRes = await worker.fetch(
    new Request('https://vidnex.space/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://vidnex.space',
        Cookie: ownerCookie,
      },
      body: JSON.stringify({
        action: 'toggle_active',
        userId,
        active: false,
      }),
    }),
    env
  );
  assert.equal(deactivateRes.status, 200);

  const deactivatedSessionRes = await worker.fetch(
    new Request('https://vidnex.space/api/admin/stats', {
      headers: { Cookie: reloginCookie },
    }),
    env
  );
  assert.equal(deactivatedSessionRes.status, 401);

  const deactivatedLoginRes = await worker.fetch(
    new Request('https://vidnex.space/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://vidnex.space',
        'CF-Connecting-IP': '192.0.2.22',
      },
      body: JSON.stringify({
        login: 'redacteur1',
        password: newPermanentPassword,
      }),
    }),
    env
  );
  assert.equal(deactivatedLoginRes.status, 401);
  const deactivatedLoginJson: any = await deactivatedLoginRes.json();
  assert.equal(deactivatedLoginJson.message, 'Identifiant ou mot de passe incorrect.');
});


