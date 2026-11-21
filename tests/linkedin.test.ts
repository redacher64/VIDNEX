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

// Offline CI guard: any unmocked external fetch rejects immediately instead of hitting the internet
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const u =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  throw new Error(`[Offline Test Guard] Unmocked network fetch attempted: ${u}`);
}) as typeof fetch;

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

test('parseLinkedInProfileHtml returns PHOTO_NOT_AVAILABLE on ghost/default avatar', () => {
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
  assert.equal(parsed.error?.code, 'PHOTO_NOT_AVAILABLE');
});

test('parseLinkedInProfileHtml returns LOGIN_WALL on authwall HTML without retry prompt', () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head><title>Sign Up | LinkedIn</title></head>
      <body><a href="/uas/login">Sign in</a> authwall</body>
    </html>
  `;

  const parsed = parseLinkedInProfileHtml(html, 'some-user');
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error?.code, 'LOGIN_WALL');
  assert.ok(
    !parsed.error?.message.toLowerCase().includes('réessayez'),
    'LOGIN_WALL message must not say réessayez'
  );
});

test('live extractLinkedIn on public profile handles LinkedIn response cleanly', async () => {
  const origFetch = globalThis.fetch;
  try {
    const validJpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      ...new Array(128).fill(0x55),
    ]);
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const u = typeof input === 'string' ? input : input.toString();
      if (u.includes('linkedin.com/in/satyanadella')) {
        return new Response(
          `<!doctype html><html><head><meta property="og:image" content="https://media.licdn.com/dms/image/v2/D5603AQG/profile-displayphoto-shrink_800_800/0/1700000000000?e=1750000000&amp;v=beta&amp;t=abc" /></head><body></body></html>`,
          { status: 200, headers: { 'Content-Type': 'text/html' } }
        );
      }
      if (u.includes('media.licdn.com')) {
        return new Response(validJpeg, {
          status: 200,
          headers: {
            'Content-Type': 'image/jpeg',
            'Content-Length': String(validJpeg.length),
          },
        });
      }
      return new Response('Not Found', { status: 404 });
    }) as typeof fetch;

    const res = await extractLinkedIn('satyanadella');
    assert.equal(res.ok, true);
    assert.equal(res.platform, 'linkedin');
    assert.equal(res.type, 'image');
    assert.equal(res.title, '@satyanadella');
  } finally {
    globalThis.fetch = origFetch;
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

test('AdminApp Blog tab & BlogEditor: authorizes blog.* permissions, validates draft payloads, saves draft to D1, and filters by status', async () => {
  const {
    BLOG_MODULE_ENABLED,
    isTabAuthorizedForUser,
    getFirstAuthorizedTabForUser,
    hasBlogPermission,
    canWriteBlogArticle,
    slugifyBlogIdentifier,
    buildDraftCreatePayload,
    buildUnifiedAdminBlogArticles,
    filterAdminBlogArticles,
  } = await import('../src/pages/admin/blogAdminLogic.ts');
  const { ADMIN_COOKIE_NAME, createSignedSessionToken } = await import(
    '../functions/_lib/auth.ts'
  );
  const {
    onRequestPost: adminBlogPost,
    onRequestGet: adminBlogGet,
  } = await import('../functions/api/admin/blog.ts');

  assert.equal(BLOG_MODULE_ENABLED, true);

  const writerUser = {
    id: 2,
    login: 'writer',
    displayName: 'Rédacteur',
    roleLabel: 'Rédacteur blog',
    isOwner: false,
    permissions: ['blog.write' as const],
    mustChangePassword: false,
  };
  const deleteOnlyUser = {
    id: 4,
    login: 'moderator',
    displayName: 'Modérateur',
    roleLabel: 'Modérateur',
    isOwner: false,
    permissions: ['blog.delete' as const],
    mustChangePassword: false,
  };
  const observerUser = {
    id: 3,
    login: 'observer',
    displayName: 'Observateur',
    roleLabel: 'Observateur',
    isOwner: false,
    permissions: ['dashboard.view' as const],
    mustChangePassword: false,
  };

  assert.equal(hasBlogPermission(writerUser), true);
  assert.equal(canWriteBlogArticle(writerUser), true);
  assert.equal(hasBlogPermission(deleteOnlyUser), true);
  assert.equal(canWriteBlogArticle(deleteOnlyUser), false);
  assert.equal(hasBlogPermission(observerUser), false);
  assert.equal(canWriteBlogArticle(observerUser), false);
  assert.equal(isTabAuthorizedForUser('blog', writerUser), true);
  assert.equal(getFirstAuthorizedTabForUser(writerUser), 'blog');
  assert.equal(isTabAuthorizedForUser('blog', observerUser), false);

  assert.equal(
    slugifyBlogIdentifier('Guide Vidéo TikTok 2026 : Qualité MP4 !'),
    'guide-video-tiktok-qualite-mp4'
  );

  const built = buildDraftCreatePayload({
    articleId: 'guide-video-tiktok-qualite-mp4',
    category: 'tiktok-guides',
    toolRoute: '/telecharger-video-tiktok',
    locale: 'fr',
    slug: 'guide-video-tiktok-qualite-mp4',
    title: 'Guide Vidéo TikTok : Qualité MP4',
    excerpt: 'Extrait technique sur la conservation du flux MP4 original.',
    metaTitle: 'Guide Vidéo TikTok : Qualité MP4 Originale',
    metaDescription:
      'Découvrez comment vérifier le débit binaire et la résolution d’une vidéo TikTok publique pour enregistrer un fichier MP4 net sans perte.',
    primaryKeyword: 'qualite mp4 tiktok',
    bodyMarkdown:
      '## Vérifier le conteneur MP4\n\nExpliquez comment analyser le flux vidéo H.264.\n\n- Contrôler la résolution 1080p\n- Vérifier la piste audio AAC',
  });

  assert.equal(built.valid, true, `Unexpected errors: ${JSON.stringify(built.errors)}`);
  assert.equal(built.payload.status, 'draft');
  assert.equal(built.payload.category, 'tiktok-guides');

  const db = createMemoryD1Database();
  const sessionSecret = 'test-blog-editor-hmac-secret-2026';
  const env = {
    DB: db,
    ADMIN_PASSWORD: 'owner-pwd',
    SESSION_SECRET: sessionSecret,
  };
  const ownerToken = await createSignedSessionToken(sessionSecret, Date.now(), {
    type: 'owner',
  });

  const postRes = await adminBlogPost({
    request: new Request('https://vidnex.space/api/admin/blog', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://vidnex.space',
        Cookie: `${ADMIN_COOKIE_NAME}=${ownerToken}`,
      },
      body: JSON.stringify(built.payload),
    }),
    env,
  });
  assert.equal(postRes.status, 201);
  const postJson: any = await postRes.json();
  assert.equal(postJson.ok, true);
  assert.equal(postJson.status, 'draft');

  const getRes = await adminBlogGet({
    request: new Request('https://vidnex.space/api/admin/blog', {
      method: 'GET',
      headers: { Cookie: `${ADMIN_COOKIE_NAME}=${ownerToken}` },
    }),
    env,
  });
  assert.equal(getRes.status, 200);
  const getJson: any = await getRes.json();

  const allArticles = buildUnifiedAdminBlogArticles(undefined, getJson.articles);
  const publishedOnly = filterAdminBlogArticles(allArticles, {
    statusFilter: 'published',
  });
  const draftsOnly = filterAdminBlogArticles(allArticles, {
    statusFilter: 'draft',
  });

  assert.ok(publishedOnly.length > 0, 'Should include published articles');
  assert.ok(
    draftsOnly.some((a) => a.id === 'guide-video-tiktok-qualite-mp4' && a.inD1),
    'Newly saved D1 draft article should appear in draft list'
  );
  assert.equal(publishedOnly.length + draftsOnly.length, allArticles.length);
});

test('Admin Visitors Analytics: owner-only RBAC, Cloudflare GraphQL country aggregation, 5-min cache, and zero token leak', async () => {
  const {
    onRequestGet: adminVisitorsGet,
    clearVisitorsCacheForTests,
  } = await import('../functions/api/admin/visitors.ts');
  const {
    createSignedSessionToken,
    ADMIN_COOKIE_NAME,
  } = await import('../functions/_lib/auth.ts');
  const { onRequestPost: adminUsersPost } = await import(
    '../functions/api/admin/users.ts'
  );
  const { isTabAuthorizedForUser } = await import(
    '../src/pages/admin/blogAdminLogic.ts'
  );

  clearVisitorsCacheForTests();

  // 1. UI tab authorization: owner only
  assert.equal(
    isTabAuthorizedForUser('visitors', { isOwner: true, permissions: ['*'] }),
    true
  );
  assert.equal(
    isTabAuthorizedForUser('visitors', {
      isOwner: false,
      permissions: ['blog.read', 'blog.write'],
    }),
    false
  );

  const db = createMemoryD1Database();
  const sessionSecret = 'test-visitors-hmac-secret-2026';
  const ownerCookie = `${ADMIN_COOKIE_NAME}=${await createSignedSessionToken(
    sessionSecret,
    Date.now(),
    { type: 'owner' }
  )}`;

  const createRes = await adminUsersPost({
    request: new Request('https://vidnex.space/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://vidnex.space',
        Cookie: ownerCookie,
      },
      body: JSON.stringify({
        action: 'create',
        login: 'editor_vis',
        display_name: 'Editor Visitors Test',
        role_label: 'Rédacteur blog',
        permissions: ['blog.read', 'blog.write'],
      }),
    }),
    env: {
      DB: db,
      ADMIN_PASSWORD: 'owner-pwd',
      SESSION_SECRET: sessionSecret,
    },
  });
  const createdUserJson: any = await createRes.json();
  const editorCookie = `${ADMIN_COOKIE_NAME}=${await createSignedSessionToken(
    sessionSecret,
    Date.now(),
    { type: 'user', userId: createdUserJson.user.id, sessionVersion: 1 }
  )}`;

  // 2. Non-owner is rejected with 403
  const forbiddenRes = await adminVisitorsGet({
    request: new Request('https://vidnex.space/api/admin/visitors', {
      method: 'GET',
      headers: { Cookie: editorCookie },
    }),
    env: {
      DB: db,
      ADMIN_PASSWORD: 'owner-pwd',
      SESSION_SECRET: sessionSecret,
      CF_API_TOKEN: 'cf-secret-token-never-expose',
      CF_ZONE_ID: 'zone-12345',
    },
  });
  assert.equal(forbiddenRes.status, 403);

  // 3. Missing secrets returns 503 CONFIG_MISSING with clear error message (no crash)
  const missingConfigRes = await adminVisitorsGet({
    request: new Request('https://vidnex.space/api/admin/visitors', {
      method: 'GET',
      headers: { Cookie: ownerCookie },
    }),
    env: {
      DB: db,
      ADMIN_PASSWORD: 'owner-pwd',
      SESSION_SECRET: sessionSecret,
    },
  });
  assert.equal(missingConfigRes.status, 503);
  const missingJson: any = await missingConfigRes.json();
  assert.equal(missingJson.ok, false);
  assert.equal(missingJson.errorCode, 'CONFIG_MISSING');

  // 4. Mock Cloudflare GraphQL call and verify aggregation, sorting, flags, percentages, and 5-min cache
  const originalFetch = globalThis.fetch;
  let graphqlCalls = 0;
  const secretToken = 'cf-secret-token-do-not-leak-999';

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    assert.equal(url, 'https://api.cloudflare.com/client/v4/graphql');
    const authHeader = (init?.headers as Record<string, string>)?.Authorization;
    assert.equal(authHeader, `Bearer ${secretToken}`);
    graphqlCalls += 1;

    return new Response(
      JSON.stringify({
        data: {
          viewer: {
            zones: [
              {
                period24h: [
                  {
                    dimensions: { datetime: '2026-11-18T10:00:00Z' },
                    sum: {
                      requests: 300,
                      cachedRequests: 180,
                      bytes: 1_500_000,
                      cachedBytes: 900_000,
                      pageViews: 240,
                      threats: 2,
                      countryMap: [
                        { clientCountryName: 'US', requests: 100, bytes: 500_000 },
                        { clientCountryName: 'FR', requests: 200, bytes: 1_000_000 },
                      ],
                      responseStatusMap: [
                        { edgeResponseStatus: 200, requests: 210 },
                        { edgeResponseStatus: 304, requests: 60 },
                        { edgeResponseStatus: 404, requests: 30 },
                      ],
                      browserMap: [
                        { uaBrowserFamily: 'Chrome', pageViews: 150 },
                        { uaBrowserFamily: 'Safari', pageViews: 90 },
                      ],
                    },
                    uniq: { uniques: 120 },
                  },
                  {
                    dimensions: { datetime: '2026-11-18T11:00:00Z' },
                    sum: {
                      requests: 100,
                      cachedRequests: 60,
                      bytes: 500_000,
                      cachedBytes: 300_000,
                      pageViews: 80,
                      threats: 0,
                      countryMap: [
                        { clientCountryName: 'FR', requests: 50, bytes: 250_000 },
                        { clientCountryName: 'MA', requests: 50, bytes: 250_000 },
                      ],
                      responseStatusMap: [
                        { edgeResponseStatus: 200, requests: 90 },
                        { edgeResponseStatus: 301, requests: 10 },
                      ],
                    },
                    uniq: { uniques: 40 },
                  },
                ],
                period7d: [
                  {
                    dimensions: { date: '2026-11-18' },
                    sum: {
                      requests: 2000,
                      cachedRequests: 1170,
                      bytes: 12_000_000,
                      cachedBytes: 7_000_000,
                      pageViews: 1600,
                      threats: 5,
                      countryMap: [
                        { clientCountryName: 'FR', requests: 1200 },
                        { clientCountryName: 'US', requests: 800 },
                      ],
                    },
                    uniq: { uniques: 950 },
                  },
                ],
                period30d: [
                  {
                    dimensions: { date: '2026-11-18' },
                    sum: {
                      requests: 8000,
                      cachedRequests: 4800,
                      bytes: 48_000_000,
                      cachedBytes: 28_000_000,
                      pageViews: 6200,
                      threats: 12,
                      countryMap: [
                        { clientCountryName: 'FR', requests: 5000 },
                        { clientCountryName: 'US', requests: 3000 },
                      ],
                    },
                    uniq: { uniques: 3400 },
                  },
                ],
              },
            ],
          },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  try {
    const envWithCf = {
      DB: db,
      ADMIN_PASSWORD: 'owner-pwd',
      SESSION_SECRET: sessionSecret,
      CF_API_TOKEN: secretToken,
      CF_ZONE_ID: 'vidnex-zone-id-001',
    };

    const res1 = await adminVisitorsGet({
      request: new Request('https://vidnex.space/api/admin/visitors', {
        method: 'GET',
        headers: { Cookie: ownerCookie },
      }),
      env: envWithCf,
    });
    assert.equal(res1.status, 200);
    const rawText1 = await res1.text();
    assert.ok(
      !rawText1.includes(secretToken),
      'CF_API_TOKEN must never appear in response payload'
    );

    const json1: any = JSON.parse(rawText1);
    assert.equal(json1.ok, true);
    assert.equal(json1.cached, false);
    assert.equal(graphqlCalls, 1);

    // Verify 24h totals, cache hit rate, status codes, timeseries & sorted countries
    const p24 = json1.periods['24h'];
    assert.equal(p24.totalRequests, 400);
    assert.equal(p24.uniqueVisitors, 160);
    assert.equal(p24.cachedRequests, 240);
    assert.equal(p24.cacheHitRate, 60);
    assert.equal(p24.totalBytes, 2_000_000);
    assert.equal(p24.cachedBytes, 1_200_000);
    assert.equal(p24.statusCodes.status2xx, 300);
    assert.equal(p24.statusCodes.status3xx, 70);
    assert.equal(p24.statusCodes.status4xx, 30);
    assert.equal(p24.timeseries.length, 2);
    assert.equal(p24.browsers[0].browser, 'Chrome');
    assert.equal(p24.countries.length, 3);
    assert.equal(p24.countries[0].countryCode, 'FR');
    assert.equal(p24.countries[0].flag, '🇫🇷');
    assert.equal(p24.countries[0].requests, 250);
    assert.equal(p24.countries[0].percentage, 62.5);
    assert.equal(p24.countries[1].countryCode, 'US');
    assert.equal(p24.countries[1].requests, 100);
    assert.equal(p24.countries[1].percentage, 25);
    assert.equal(p24.countries[2].countryCode, 'MA');
    assert.equal(p24.countries[2].requests, 50);
    assert.equal(p24.countries[2].percentage, 12.5);

    // Second request within 5 minutes must hit the server cache without calling fetch again
    const res2 = await adminVisitorsGet({
      request: new Request('https://vidnex.space/api/admin/visitors', {
        method: 'GET',
        headers: { Cookie: ownerCookie },
      }),
      env: envWithCf,
    });
    assert.equal(res2.status, 200);
    const json2: any = await res2.json();
    assert.equal(json2.ok, true);
    assert.equal(json2.cached, true);
    assert.equal(graphqlCalls, 1, 'Should serve from 5-min cache without calling Cloudflare again');
  } finally {
    globalThis.fetch = originalFetch;
    clearVisitorsCacheForTests();
  }
});

test('DashboardWidget computeDailyUsageSummary: summarizes daily D1 API usage, deltas, peak day, and extraction success rates', async () => {
  const { computeDailyUsageSummary } = await import(
    '../src/pages/admin/dashboardWidgetLogic.ts'
  );

  const summary = computeDailyUsageSummary({
    ok: true,
    dbConnected: true,
    counts: {
      today: 40,
      last7d: 140,
      last30d: 140,
    },
    funnel: {
      extract_started: 140,
      extract_success: 126,
      extract_error: 14,
      download_started: 110,
      download_success: 105,
      extractSuccessRate: 90,
      downloadConversionRate: 78.6,
      downloadCompletionRate: 95.5,
    },
    platforms: {
      tiktok: { total: 80, success: 76, error: 4, successRate: 95 },
      instagram: { total: 40, success: 32, error: 8, successRate: 80 },
      x: { total: 20, success: 18, error: 2, successRate: 90 },
    },
    daily: [
      { day: '2026-11-16', total: 50, success: 45, error: 5, download_success: 38 },
      { day: '2026-11-17', total: 50, success: 45, error: 5, download_success: 37 },
      { day: '2026-11-18', total: 40, success: 36, error: 4, download_success: 30 },
    ],
  });

  assert.equal(summary.dbConnected, true);
  assert.equal(summary.today.day, '2026-11-18');
  assert.equal(summary.today.total, 40);
  assert.equal(summary.today.success, 36);
  assert.equal(summary.today.error, 4);
  assert.equal(summary.today.successRate, 90);
  assert.equal(summary.today.downloads, 30);

  assert.equal(summary.yesterday.day, '2026-11-17');
  assert.equal(summary.yesterday.total, 50);
  assert.equal(summary.deltaTodayVsYesterdayPct, -20);

  assert.equal(summary.last7d.total, 140);
  assert.equal(summary.last7d.success, 126);
  assert.equal(summary.last7d.error, 14);
  assert.equal(summary.last7d.successRate, 90);
  assert.equal(summary.last7d.downloads, 105);
  assert.equal(summary.last7d.days[0].day, '2026-11-18');

  assert.equal(summary.last30d.peakDay, '2026-11-16');
  assert.equal(summary.last30d.peakTotal, 50);

  assert.equal(summary.platforms[0].key, 'tiktok');
  assert.equal(summary.platforms[0].total, 80);
  assert.equal(summary.platforms[0].successRate, 95);
  assert.equal(summary.platforms[1].key, 'instagram');
  assert.equal(summary.platforms[1].successRate, 80);

  const { buildDailyUsageCsv } = await import(
    '../src/pages/admin/dashboardWidgetLogic.ts'
  );
  const csv = buildDailyUsageCsv(summary.last7d.days);
  const lines = csv.split('\r\n');
  assert.equal(
    lines[0],
    'Date (UTC),Appels API,Succès,Échecs,Téléchargements,Taux de succès (%)'
  );
  assert.equal(lines[1], '2026-11-18,40,36,4,30,90');
  assert.equal(lines[2], '2026-11-17,50,45,5,37,90');
  assert.equal(lines[3], '2026-11-16,50,45,5,38,90');
});

test('worldMapLogic: projects lat/lon coordinates to SVG, aggregates regional continent traffic, and computes extended visitor metrics', async () => {
  const {
    projectLatLonToSvg,
    computeGeoMapAnalytics,
    computeExtendedVisitorMetrics,
  } = await import('../src/pages/admin/worldMapLogic.ts');

  const center = projectLatLonToSvg(0, 0);
  assert.equal(center.svgX, 500);
  assert.equal(center.svgY, 277.8);

  const geo = computeGeoMapAnalytics([
    { countryCode: 'FR', requests: 500, bytes: 2_500_000, threats: 1 },
    { countryCode: 'MA', requests: 300, bytes: 1_500_000, threats: 0 },
    { countryCode: 'US', requests: 200, bytes: 1_000_000, threats: 2 },
  ]);

  assert.equal(geo.totalRequests, 1000);
  assert.equal(geo.totalBytes, 5_000_000);
  assert.equal(geo.totalThreats, 3);
  assert.equal(geo.points.length, 3);
  assert.equal(geo.points[0].countryCode, 'FR');
  assert.equal(geo.points[0].region, 'europe');
  assert.equal(geo.points[0].percentage, 50);
  assert.equal(geo.points[1].countryCode, 'MA');
  assert.equal(geo.points[1].region, 'africa_mena');
  assert.equal(geo.points[1].percentage, 30);

  const europeRegion = geo.regions.find((r) => r.region === 'europe');
  assert.ok(europeRegion);
  assert.equal(europeRegion!.requests, 500);
  assert.equal(europeRegion!.percentage, 50);

  const ext = computeExtendedVisitorMetrics({
    totalRequests: 1000,
    uniqueVisitors: 250,
    pageViews: 800,
    cachedRequests: 600,
    totalBytes: 5_000_000,
    cachedBytes: 3_000_000,
    threats: 5,
    statusCodes: { status2xx: 900, status3xx: 80, status4xx: 15, status5xx: 5 },
    workerMetrics: { invocations: 400, subrequests: 600 },
    countries: [{ requests: 500 }, { requests: 300 }, { requests: 100 }, { requests: 100 }],
  });

  assert.equal(ext.originRequests, 400);
  assert.equal(ext.originRatePct, 40);
  assert.equal(ext.savedBytes, 3_000_000);
  assert.equal(ext.originBytes, 2_000_000);
  assert.equal(ext.avgBytesPerRequest, 5000);
  assert.equal(ext.requestsPerUniqueVisitor, 4);
  assert.equal(ext.pageViewsPerUniqueVisitor, 3.2);
  assert.equal(ext.subrequestsPerInvocation, 1.5);
  assert.equal(ext.availabilityRatePct, 99.5);
  assert.equal(ext.topCountrySharePct, 50);
  assert.equal(ext.top3ConcentrationPct, 90);
});

test('VisitorsMap buildD1VisitorsMapSummary: builds D1 mock visitor origins, ranks most active regions, and assigns heat tiers', async () => {
  const { buildD1VisitorsMapSummary } = await import(
    '../src/pages/admin/visitorsMapLogic.ts'
  );

  const default30d = buildD1VisitorsMapSummary('30d', null);
  assert.equal(default30d.source, 'd1-default-mock');
  assert.ok(default30d.totalVisitors > 0);
  assert.ok(default30d.totalExtractions > 0);
  assert.equal(default30d.regions.length, 5);
  assert.equal(default30d.mostActiveRegion.rank, 1);
  assert.equal(default30d.mostActiveRegion.isTopRegion, true);
  assert.equal(default30d.mostActiveRegion.heatTier, 'hot');
  assert.equal(default30d.mostActiveCountry.countryCode, 'FR');
  assert.equal(default30d.mostActiveCountry.heatTier, 'hot');

  // Verify scaling with D1 stats counts
  const scaled7d = buildD1VisitorsMapSummary('7d', {
    counts: { today: 200, last7d: 5000, last30d: 20000 },
    funnel: { extractSuccessRate: 97.2 },
  });
  assert.equal(scaled7d.source, 'd1-scaled-mock');
  assert.equal(scaled7d.globalSuccessRate, 97.2);
  assert.ok(scaled7d.regions[0].visitors >= scaled7d.regions[1].visitors);
});

test('LinkedIn direct flow: metadata priority (og:image -> twitter:image -> JSON-LD), magic-byte image validation, LOGIN_WALL without fallback candidates, structured anonymized failure logs, and error-code retry button visibility', async () => {
  const {
    extractTwitterImageFromHtml,
    detectImageMagicBytes,
    validateLinkedInImageUrl,
    LINKEDIN_FRENCH_ERROR_MESSAGES,
  } = await import('../functions/_lib/linkedin.ts');
  const { isAllowedMediaHost } = await import('../functions/_lib/allowlist.ts');
  const { getLocalizedErrorMessage, shouldShowRetryButton } = await import(
    '../src/services/extractorService.ts'
  );

  // 0. upload.wikimedia.org is removed from the media allowlist
  assert.equal(isAllowedMediaHost('upload.wikimedia.org'), false);
  assert.equal(isAllowedMediaHost('media.licdn.com'), true);

  // 1. Metadata priority: og:image -> twitter:image -> JSON-LD "image"
  const twitterImgUrl =
    'https://media.licdn.com/dms/image/v2/C4D03AQ/profile-displayphoto-shrink_200_200/0/1650000000000?e=1750000000&v=beta&t=tw_sig';
  const jsonLdImgUrl =
    'https://media.licdn.com/dms/image/v2/C4D03AQ/profile-displayphoto-shrink_200_200/0/1650000000000?e=1750000000&v=beta&t=ld_sig';
  const htmlWithTwitterAndJsonLd = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Claire Martin - Directrice | LinkedIn</title>
        <meta name="twitter:image" content="${twitterImgUrl}" />
        <script type="application/ld+json">
          {"@type":"Person","image":"${jsonLdImgUrl}"}
        </script>
      </head>
      <body>Profile</body>
    </html>
  `;
  assert.equal(extractTwitterImageFromHtml(htmlWithTwitterAndJsonLd), twitterImgUrl);
  const parsedTwitter = parseLinkedInProfileHtml(htmlWithTwitterAndJsonLd, 'claire-martin');
  assert.equal(parsedTwitter.ok, true);
  assert.equal(parsedTwitter.engineStage, 'twitter_image');
  assert.equal(parsedTwitter.items?.[0]?.url, twitterImgUrl);
  assert.equal(parsedTwitter.items?.[0]?.quality, 'Miniature');
  assert.equal(parsedTwitter.items?.[0]?.isThumbnail, true);

  // 2. Magic bytes validation: accepts JPEG/PNG/WebP/GIF and rejects HTML disguised as image
  const validJpegBytes = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ]);
  const validPngBytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0xc8, // width = 200
    0x00, 0x00, 0x00, 0xc8, // height = 200
  ]);
  const htmlDisguisedBytes = new TextEncoder().encode('<!DOCTYPE html><html><body>Login</body></html>');
  assert.equal(detectImageMagicBytes(validJpegBytes), 'jpg');
  assert.equal(detectImageMagicBytes(validPngBytes), 'png');
  assert.equal(detectImageMagicBytes(htmlDisguisedBytes), null);

  // 3. Remote image validation + LOGIN_WALL without fallback search + structured console.warn log without PII
  const origFetch = globalThis.fetch;
  const origWarn = console.warn;
  const capturedWarns: Array<unknown[]> = [];
  console.warn = (...args: unknown[]) => {
    capturedWarns.push(args);
  };

  try {
    // Case A: Upstream returns text/html or HTML magic bytes even with 200 -> INVALID_IMAGE
    globalThis.fetch = (async () => {
      return new Response('<!DOCTYPE html><html>Authwall</html>', {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg' },
      });
    }) as typeof fetch;

    const badImgCheck = await validateLinkedInImageUrl(
      'https://media.licdn.com/dms/image/v2/C4D03AQ/fake.jpg'
    );
    assert.equal(badImgCheck.ok, false);
    assert.equal(badImgCheck.errorCode, 'INVALID_IMAGE');

    // Case B: Upstream redirects to a valid 200x200 PNG image -> ok=true, qualityLabel='Miniature'
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const u = typeof input === 'string' ? input : input.toString();
      if (u.includes('redirect-start.jpg')) {
        return new Response(null, {
          status: 302,
          headers: {
            Location: 'https://media.licdn.com/dms/image/v2/C4D03AQ/final-thumb.png',
          },
        });
      }
      return new Response(validPngBytes, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': String(validPngBytes.byteLength),
        },
      });
    }) as typeof fetch;

    const goodImgCheck = await validateLinkedInImageUrl(
      'https://media.licdn.com/dms/image/v2/C4D03AQ/redirect-start.jpg'
    );
    assert.equal(goodImgCheck.ok, true);
    assert.equal(goodImgCheck.ext, 'png');
    assert.equal(goodImgCheck.width, 200);
    assert.equal(goodImgCheck.height, 200);
    assert.equal(goodImgCheck.isThumbnail, true);
    assert.equal(goodImgCheck.qualityLabel, 'Miniature');

    // Case C: LinkedIn returns status 999 (login wall) -> returns LOGIN_WALL directly without fallback search
    const fetchUrlsCalled: string[] = [];
    capturedWarns.length = 0;

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const u = typeof input === 'string' ? input : input.toString();
      fetchUrlsCalled.push(u);
      return new Response('<html>Request denied</html>', { status: 999 });
    }) as typeof fetch;

    const loginWallResult = await extractLinkedIn('marie-curie-123456', {
      bypassCache: true,
    });
    assert.equal(
      fetchUrlsCalled.length,
      1,
      'Must make only 1 profile fetch and never query Wikipedia/Wikimedia fallback'
    );
    assert.ok(
      !fetchUrlsCalled.some((u) => u.includes('wikipedia') || u.includes('wikimedia')),
      'No fallback search request may be made'
    );
    assert.equal(loginWallResult.ok, false);
    assert.equal(loginWallResult.error?.code, 'LOGIN_WALL');
    assert.equal(
      loginWallResult.error?.message,
      "LinkedIn bloque l'accès à cette photo pour le moment. Importez-la manuellement ci-dessous."
    );
    assert.equal(loginWallResult.items, undefined);

    // Verify structured console.warn log has ONLY { errorCode, stage, httpStatus, durationMs } and zero PII
    assert.equal(capturedWarns.length, 1);
    const [warnPrefix, warnPayload] = capturedWarns[0] as [
      string,
      Record<string, unknown>,
    ];
    assert.equal(warnPrefix, '[VIDNEX][LinkedIn] Extraction failed');
    assert.deepEqual(
      Object.keys(warnPayload).sort(),
      ['durationMs', 'errorCode', 'httpStatus', 'stage'],
      'Structured log must only contain errorCode, stage, httpStatus, durationMs'
    );
    assert.equal(warnPayload.errorCode, 'LOGIN_WALL');
    assert.equal(warnPayload.stage, 'authwall');
    assert.equal(warnPayload.httpStatus, 999);
    assert.equal(typeof warnPayload.durationMs, 'number');
    const serializedWarn = JSON.stringify(capturedWarns[0]);
    assert.ok(
      !serializedWarn.includes('marie-curie'),
      'Structured log must not contain profile slug or personal data'
    );
  } finally {
    globalThis.fetch = origFetch;
    console.warn = origWarn;
  }

  // 4. Verify LOGIN_WALL message across French and backend constants
  const expectedFrLoginWall =
    "LinkedIn bloque l'accès à cette photo pour le moment. Importez-la manuellement ci-dessous.";
  assert.equal(LINKEDIN_FRENCH_ERROR_MESSAGES.LOGIN_WALL, expectedFrLoginWall);
  assert.equal(
    getLocalizedErrorMessage('LOGIN_WALL', 'fr', {
      platform: 'linkedin',
      isProfile: true,
    }),
    expectedFrLoginWall
  );

  const errorCodes = [
    'LOGIN_WALL',
    'RATE_LIMITED',
    'PROFILE_NOT_FOUND',
    'PHOTO_NOT_AVAILABLE',
    'INVALID_IMAGE',
  ] as const;

  const frenchMessages = errorCodes.map((code) =>
    getLocalizedErrorMessage(code, 'fr', {
      platform: 'linkedin',
      isProfile: true,
    })
  );
  const uniqueMessages = new Set(frenchMessages);
  assert.equal(
    uniqueMessages.size,
    errorCodes.length,
    `Each of the 5 error codes must have a distinct French message: ${JSON.stringify(frenchMessages)}`
  );
  assert.ok(
    !frenchMessages[0].toLowerCase().includes('réessayez'),
    'LOGIN_WALL French message must not say "réessayez"'
  );
  assert.ok(
    !frenchMessages[0].toLowerCase().includes('résultats proposés'),
    'LOGIN_WALL French message must not mention "résultats proposés"'
  );

  // 5. Verify "Réessayer" button visibility by error code on LinkedIn
  const retryVisibleCodes = [
    'RATE_LIMITED',
    'TIMEOUT',
    'NETWORK_ERROR',
    'IMAGE_EXPIRED',
  ] as const;
  for (const code of retryVisibleCodes) {
    assert.equal(
      shouldShowRetryButton('linkedin', code),
      true,
      `Retry button must be visible for LinkedIn error code ${code}`
    );
  }

  const retryHiddenCodes = [
    'LOGIN_WALL',
    'PROFILE_NOT_FOUND',
    'PHOTO_NOT_AVAILABLE',
    'INVALID_IMAGE',
  ] as const;
  for (const code of retryHiddenCodes) {
    assert.equal(
      shouldShowRetryButton('linkedin', code),
      false,
      `Retry button must be hidden for LinkedIn error code ${code}`
    );
  }
});

test('Adsterra integration: verifies centralized config, srcdoc iframe atOptions builders, and independent ads_adsterra_enabled / ads_enabled switches', async () => {
  const {
    ADSTERRA_CONFIG,
    ADSTERRA_DOMAIN,
    buildAdsterraBannerSrcDoc,
    getAdsterraNativeBannerScriptUrl,
    getAdsterraSocialBarScriptUrl,
  } = await import('../src/config/adsterraConfig.ts');
  const { getSystemSettings, updateSystemSettings } = await import(
    '../functions/_lib/settings.ts'
  );
  const { onRequestGet: publicConfigGet } = await import(
    '../functions/api/public-config.ts'
  );

  // 1. Centralized domain & scripts
  assert.equal(ADSTERRA_DOMAIN, 'https://bellnewyork.org');
  assert.equal(
    getAdsterraSocialBarScriptUrl(),
    'https://bellnewyork.org/14/d0aaec22d250227f3813abba951b9e0a'
  );
  assert.equal(
    getAdsterraNativeBannerScriptUrl(),
    'https://bellnewyork.org/21/b6b738ed32552f1fb5a38165c5c7ee4a'
  );
  assert.equal(
    ADSTERRA_CONFIG.nativeBanner.containerId,
    'container-b6b738ed32552f1fb5a38165c5c7ee4a'
  );

  // 2. All 4 banner units & isolated srcdoc generation
  const expectedBanners = {
    '728x90': { key: '88fab04888526875ad70d3600cd20552', width: 728, height: 90 },
    '320x50': { key: 'be0d8adcee443989a07b21cca9731553', width: 320, height: 50 },
    '300x250': { key: '5c421075520bced3f83caf40d4bb3a71', width: 300, height: 250 },
    '160x600': { key: 'd64ffc8510f6f1d20e3d96b787b7ff34', width: 160, height: 600 },
  } as const;

  for (const [size, expected] of Object.entries(expectedBanners)) {
    const unit = ADSTERRA_CONFIG.banners[size as keyof typeof ADSTERRA_CONFIG.banners];
    assert.equal(unit.key, expected.key);
    assert.equal(unit.width, expected.width);
    assert.equal(unit.height, expected.height);
    assert.equal(unit.format, 'iframe');

    const srcDoc = buildAdsterraBannerSrcDoc(unit);
    assert.ok(srcDoc.includes(`"key":"${expected.key}"`));
    assert.ok(srcDoc.includes(`"format":"iframe"`));
    assert.ok(srcDoc.includes(`"height":${expected.height}`));
    assert.ok(srcDoc.includes(`"width":${expected.width}`));
    assert.ok(srcDoc.includes(`"params":{}`));
    assert.ok(
      srcDoc.includes(`https://bellnewyork.org/22/${expected.key}`),
      `srcDoc for ${size} must load /22/${expected.key}`
    );
  }

  // 3. Separate D1 switches: ads_adsterra_enabled and ads_enabled
  const db = createMemoryD1Database();
  const env = { DB: db };

  const initial = await getSystemSettings(env);
  assert.equal(initial.ads_adsterra_enabled, true);
  assert.equal(initial.ads_enabled, true);

  // Toggle ads_adsterra_enabled to false while keeping ads_enabled true
  const afterToggle = await updateSystemSettings(env, {
    ads_adsterra_enabled: false,
    ads_enabled: true,
  });
  assert.equal(afterToggle.ads_adsterra_enabled, false);
  assert.equal(afterToggle.ads_enabled, true);

  const pubRes = await publicConfigGet({
    request: new Request('https://vidnex.space/api/public-config'),
    env,
  });
  assert.equal(pubRes.status, 200);
  const pubJson: any = await pubRes.json();
  assert.equal(pubJson.ads_adsterra_enabled, false);
  assert.equal(pubJson.ads_enabled, true);

  // 4. Mobile (< 768px) vs Desktop (>= 768px) Social Bar matchMedia & 300x250 hero/mid resolution
  const {
    isDesktopViewportForSocialBar,
    resolveAdsterraBannerUnit,
  } = await import('../src/config/adsterraConfig.ts');

  const mobileWin = {
    matchMedia: (q: string) =>
      ({ matches: q === '(min-width: 768px)' ? false : false } as MediaQueryList),
  };
  const desktopWin = {
    matchMedia: (q: string) =>
      ({ matches: q === '(min-width: 768px)' ? true : false } as MediaQueryList),
  };

  assert.equal(isDesktopViewportForSocialBar(mobileWin), false);
  assert.equal(isDesktopViewportForSocialBar(desktopWin), true);

  const topMobileUnit = resolveAdsterraBannerUnit('mobile-banner', false);
  assert.equal(topMobileUnit.key, 'be0d8adcee443989a07b21cca9731553');
  assert.equal(topMobileUnit.width, 320);
  assert.equal(topMobileUnit.height, 50);

  const mobileLeaderboardUnit = resolveAdsterraBannerUnit('leaderboard', false);
  assert.equal(mobileLeaderboardUnit.key, '5c421075520bced3f83caf40d4bb3a71');
  assert.equal(mobileLeaderboardUnit.width, 300);
  assert.equal(mobileLeaderboardUnit.height, 250);

  const desktopLeaderboardUnit = resolveAdsterraBannerUnit('leaderboard', true);
  assert.equal(desktopLeaderboardUnit.key, '88fab04888526875ad70d3600cd20552');
  assert.equal(desktopLeaderboardUnit.width, 728);
  assert.equal(desktopLeaderboardUnit.height, 90);
});

test('LinkedIn Production 10-Scenario Suite: URL variants, embedded Voyager JSON resolution selection, WebP/JPEG dimensions, caching, IMAGE_EXPIRED, INVALID_IMAGE, RATE_LIMITED, and /api/download preview + download + Auto-Heal', async () => {
  const {
    parseLinkedInProfileHtml,
    parseImageDimensionsFromBytes,
    validateLinkedInImageUrl,
    extractLinkedIn,
    clearLinkedInCache,
    LINKEDIN_FRENCH_ERROR_MESSAGES,
  } = await import('../functions/_lib/linkedin.ts');
  const { onRequestPost: extractPost } = await import('../functions/api/extract.ts');
  const { onRequestGet: downloadGet } = await import('../functions/api/download.ts');
  const {
    mapExtractResponseToMediaResult,
    getLocalizedErrorMessage,
  } = await import('../src/services/extractorService.ts');

  const db = createMemoryD1Database();
  const env = { DB: db, IP_HASH_SALT: 'linkedin-10-scenarios-salt' };

  // Helper 800x800 JPEG binary with SOF2 progressive marker (0xFFC2)
  const jpeg800x800 = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xc2, 0x00, 0x0b, 0x08, 0x03, 0x20, 0x03, 0x20, 0x01, 0x01, 0x11, 0x00,
    0xff, 0xd9,
  ]);

  // Helper 800x800 WebP VP8X binary
  const webp800x800 = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x24, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50, // WEBP
    0x56, 0x50, 0x38, 0x58, // VP8X
    0x0a, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x1f, 0x03, 0x00, // width - 1 = 799 (0x031f) -> 800
    0x1f, 0x03, 0x00, // height - 1 = 799 (0x031f) -> 800
  ]);

  const parsedJpegDims = parseImageDimensionsFromBytes(jpeg800x800, 'jpg');
  assert.deepEqual(parsedJpegDims, { width: 800, height: 800 });

  const parsedWebpDims = parseImageDimensionsFromBytes(webp800x800, 'webp');
  assert.deepEqual(parsedWebpDims, { width: 800, height: 800 });

  // SCENARIO 1: Valid public LinkedIn profile URL normalization (mobile subdomains + locale subpaths)
  const validMobileAndLocaleUrls = [
    { url: 'https://m.linkedin.com/in/ada-lovelace', slug: 'ada-lovelace' },
    { url: 'https://mobile.linkedin.com/in/ada-lovelace/en', slug: 'ada-lovelace' },
    { url: 'https://fr.linkedin.com/in/ada-lovelace/fr/', slug: 'ada-lovelace' },
    { url: 'https://www.linkedin.com/in/ada-lovelace/en-us?trk=public', slug: 'ada-lovelace' },
  ];
  for (const item of validMobileAndLocaleUrls) {
    const b = detectUrl(item.url);
    assert.equal(b.isValid, true, `Backend should accept ${item.url}`);
    assert.equal(b.platform, 'linkedin');
    assert.equal(b.identifier, item.slug);
    assert.equal(b.cleanUrl, `https://www.linkedin.com/in/${item.slug}`);

    const f = detectMediaUrl(item.url);
    assert.equal(f.isValid, true, `Frontend should accept ${item.url}`);
    assert.equal(f.platform, 'linkedin');
    assert.equal(f.identifier, item.slug);
  }

  // SCENARIO 2: Profile with publicly available photo metadata (og:image 100x100 vs embedded Voyager 800x800)
  const htmlWithVoyagerUpgrade = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta property="og:image" content="https://media.licdn.com/dms/image/v2/D5603AQG/profile-displayphoto-shrink_100_100/0/1700000000000?e=2147483647&amp;v=beta&amp;t=small_sig" />
      </head>
      <body>
        <code>
          {"data":{"picture":{"rootUrl":"https://media.licdn.com/dms/image/v2/D5603AQG/profile-displayphoto-","artifacts":[{"width":100,"height":100,"fileIdentifyingUrlPathSegment":"shrink_100_100/0/1700000000000?e=2147483647&v=beta&t=small_sig"},{"width":800,"height":800,"fileIdentifyingUrlPathSegment":"shrink_800_800/0/1700000000000?e=2147483647&v=beta&t=hd_sig"}]}}}
        </code>
      </body>
    </html>
  `;
  const parsedUpgraded = parseLinkedInProfileHtml(htmlWithVoyagerUpgrade, 'ada-lovelace');
  assert.equal(parsedUpgraded.ok, true);
  assert.equal(
    parsedUpgraded.items?.[0]?.url,
    'https://media.licdn.com/dms/image/v2/D5603AQG/profile-displayphoto-shrink_800_800/0/1700000000000?e=2147483647&v=beta&t=hd_sig',
    'Should select the 800x800 artifact over the 100x100 og:image'
  );

  // SCENARIO 3: Profile returning a login wall -> LOGIN_WALL directly
  const origFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => {
      return new Response('<html><head><title>Sign In | LinkedIn</title></head><body>authwall</body></html>', {
        status: 999,
      });
    }) as typeof fetch;

    const loginWallRes = await extractLinkedIn('private-executive', {
      bypassCache: true,
    });
    assert.equal(loginWallRes.ok, false);
    assert.equal(loginWallRes.error?.code, 'LOGIN_WALL');

    // SCENARIO 4: Profile without a publicly accessible photo -> PHOTO_NOT_AVAILABLE
    const noPhotoHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Jean SansPhoto | LinkedIn</title></head>
        <body>
          <section class="top-card-layout">
            <h1 class="top-card-layout__title">Jean SansPhoto</h1>
          </section>
        </body>
      </html>
    `;
    const parsedNoPhoto = parseLinkedInProfileHtml(noPhotoHtml, 'jean-sansphoto');
    assert.equal(parsedNoPhoto.ok, false);
    assert.equal(parsedNoPhoto.error?.code, 'PHOTO_NOT_AVAILABLE');

    // Also verify 404 profile page -> PROFILE_NOT_FOUND
    const notFoundHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Profile Not Found | LinkedIn</title></head>
        <body><h1>This page doesn’t exist</h1></body>
      </html>
    `;
    const parsedNotFound = parseLinkedInProfileHtml(notFoundHtml, 'ghost-profile');
    assert.equal(parsedNotFound.ok, false);
    assert.equal(parsedNotFound.error?.code, 'PROFILE_NOT_FOUND');

    // SCENARIO 5: Invalid LinkedIn URL -> rejected by /api/extract with 400 UNSUPPORTED_URL
    const invalidExtractRes = await extractPost({
      request: new Request('https://vidnex.space/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://www.linkedin.com/company/openai' }),
      }),
      env,
    });
    assert.equal(invalidExtractRes.status, 400);
    const invalidExtractJson: any = await invalidExtractRes.json();
    assert.equal(invalidExtractJson.ok, false);
    assert.equal(invalidExtractJson.error.code, 'UNSUPPORTED_URL');

    // SCENARIO 6: Expired image URL -> IMAGE_EXPIRED (410)
    globalThis.fetch = (async () => {
      return new Response('Expired token', { status: 403 });
    }) as typeof fetch;

    const expiredCheck = await validateLinkedInImageUrl(
      'https://media.licdn.com/dms/image/v2/D5603AQG/profile-displayphoto-shrink_800_800/0/1700000000000?e=1600000000&v=beta&t=old'
    );
    assert.equal(expiredCheck.ok, false);
    assert.equal(expiredCheck.errorCode, 'IMAGE_EXPIRED');
    assert.equal(expiredCheck.httpStatus, 403);

    // SCENARIO 7: Invalid image response -> INVALID_IMAGE (422) on both /api/extract and /api/download
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const u = typeof input === 'string' ? input : input.toString();
      if (u.includes('linkedin.com/in/corrupt-photo')) {
        return new Response(
          `<!doctype html><html><head><meta property="og:image" content="https://media.licdn.com/dms/image/v2/D5603AQG/profile-displayphoto-shrink_800_800/0/1700000000000?e=2147483647&amp;v=beta&amp;t=corrupt" /></head><body></body></html>`,
          { status: 200, headers: { 'Content-Type': 'text/html' } }
        );
      }
      return new Response('<html>Error page disguised as image</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }) as typeof fetch;

    const invalidImageExtractRes = await extractPost({
      request: new Request('https://vidnex.space/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://www.linkedin.com/in/corrupt-photo' }),
      }),
      env,
    });
    assert.equal(invalidImageExtractRes.status, 422);
    const invalidImageExtractJson: any = await invalidImageExtractRes.json();
    assert.equal(invalidImageExtractJson.error.code, 'INVALID_IMAGE');

    const invalidImageDownloadRes = await downloadGet({
      request: new Request(
        'https://vidnex.space/api/download?url=' +
          encodeURIComponent(
            'https://media.licdn.com/dms/image/v2/D5603AQG/profile-displayphoto-shrink_800_800/0/1700000000000?e=2147483647&v=beta&t=corrupt'
          ) +
          '&ext=jpg&inline=1'
      ),
      env,
    });
    assert.equal(invalidImageDownloadRes.status, 422);

    // SCENARIO 8: Rate-limited response -> RATE_LIMITED (429)
    globalThis.fetch = (async () => {
      return new Response('Too Many Requests', { status: 429 });
    }) as typeof fetch;

    const rateLimitedRes = await extractLinkedIn('rate-limited-user', { bypassCache: true });
    assert.equal(rateLimitedRes.ok, false);
    assert.equal(rateLimitedRes.error?.code, 'RATE_LIMITED');

    // SCENARIO 9 & 10: Successful image extraction (with caching), preview (/api/download?inline=1), download (/api/download), and Auto-Heal on expired signed URL
    clearLinkedInCache();
    let profileFetchHits = 0;
    const freshImageUrl =
      'https://media.licdn.com/dms/image/v2/D5603AQG/profile-displayphoto-shrink_800_800/0/1700000000000?e=2147483647&v=beta&t=fresh_webp';

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const u = typeof input === 'string' ? input : input.toString();
      if (u.includes('linkedin.com/in/cached-founder')) {
        profileFetchHits += 1;
        return new Response(
          `<!doctype html><html><head><meta property="og:image" content="${freshImageUrl.replace(/&/g, '&amp;')}" /></head><body></body></html>`,
          { status: 200, headers: { 'Content-Type': 'text/html' } }
        );
      }
      if (u.includes('t=expired_token')) {
        return new Response('Forbidden Expired', { status: 403 });
      }
      if (u.includes('media.licdn.com')) {
        return new Response(webp800x800, {
          status: 200,
          headers: {
            'Content-Type': 'image/webp',
            'Content-Length': String(webp800x800.byteLength),
          },
        });
      }
      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const extractSuccessRes = await extractPost({
      request: new Request('https://vidnex.space/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://www.linkedin.com/in/cached-founder' }),
      }),
      env,
    });
    assert.equal(extractSuccessRes.status, 200);
    const extractSuccessJson: any = await extractSuccessRes.json();
    assert.equal(extractSuccessJson.ok, true);
    assert.equal(extractSuccessJson.platform, 'linkedin');
    assert.equal(extractSuccessJson.items[0].ext, 'webp');
    assert.equal(extractSuccessJson.items[0].quality, 'Standard');
    assert.equal(extractSuccessJson.items[0].width, 800);
    assert.equal(extractSuccessJson.items[0].height, 800);
    assert.ok(extractSuccessJson.thumbnail.includes('inline=1'));
    assert.ok(extractSuccessJson.thumbnail.includes('src='));
    assert.equal(profileFetchHits, 1);

    // Second call uses intelligent cache without hitting LinkedIn again
    const cachedSecondCall = await extractLinkedIn('cached-founder');
    assert.equal(cachedSecondCall.ok, true);
    assert.equal(profileFetchHits, 1, 'Second extraction should hit cache');

    // Frontend mapping preserves WEBP format and Standard quality
    const mappedUi = mapExtractResponseToMediaResult(
      extractSuccessJson,
      'https://www.linkedin.com/in/cached-founder',
      detectMediaUrl('https://www.linkedin.com/in/cached-founder', 'linkedin')
    );
    assert.equal(mappedUi.payloadType, 'profile_dp');
    if (mappedUi.payloadType === 'profile_dp') {
      assert.equal(mappedUi.format, 'WEBP');
      assert.equal(mappedUi.quality, 'Standard');
      assert.equal(mappedUi.dimensions, '800 × 800');
    }

    // Scenario 9: Successful inline preview (/api/download?inline=1)
    const previewRes = await downloadGet({
      request: new Request(`https://vidnex.space${extractSuccessJson.thumbnail}`),
      env,
    });
    assert.equal(previewRes.status, 200);
    assert.match(
      previewRes.headers.get('Content-Disposition') || '',
      /^inline; filename="linkedin_cached-founder_profile\.webp"/
    );
    assert.equal(previewRes.headers.get('Content-Type'), 'image/webp');
    const previewBytes = new Uint8Array(await previewRes.arrayBuffer());
    assert.equal(previewBytes.byteLength, webp800x800.byteLength);

    // Scenario 10: Successful attachment download (/api/download) + Auto-Heal when initial signed URL expired
    const expiredDownloadUrl =
      'https://vidnex.space/api/download?url=' +
      encodeURIComponent(
        'https://media.licdn.com/dms/image/v2/D5603AQG/profile-displayphoto-shrink_800_800/0/1700000000000?e=1600000000&v=beta&t=expired_token'
      ) +
      '&filename=linkedin_cached-founder_profile&ext=webp&src=' +
      encodeURIComponent('https://www.linkedin.com/in/cached-founder');

    const healedDownloadRes = await downloadGet({
      request: new Request(expiredDownloadUrl),
      env,
    });
    assert.equal(healedDownloadRes.status, 200, 'Auto-Heal should refresh expired signed URL and return 200');
    assert.match(
      healedDownloadRes.headers.get('Content-Disposition') || '',
      /^attachment; filename="linkedin_cached-founder_profile\.webp"/
    );
    const downloadedBytes = new Uint8Array(await healedDownloadRes.arrayBuffer());
    assert.equal(downloadedBytes.byteLength, webp800x800.byteLength);

    // Verify all 8 required LinkedIn error codes have localized messages
    const all8Codes = [
      'PROFILE_NOT_FOUND',
      'LOGIN_WALL',
      'RATE_LIMITED',
      'PHOTO_NOT_AVAILABLE',
      'INVALID_IMAGE',
      'IMAGE_EXPIRED',
      'TIMEOUT',
      'NETWORK_ERROR',
    ] as const;
    for (const code of all8Codes) {
      assert.ok(LINKEDIN_FRENCH_ERROR_MESSAGES[code], `Missing backend French message for ${code}`);
      const localized = getLocalizedErrorMessage(code, 'fr', {
        platform: 'linkedin',
        isProfile: true,
      });
      assert.ok(localized && localized.length > 10, `Missing frontend localized message for ${code}`);
    }
  } finally {
    globalThis.fetch = origFetch;
  }
});

