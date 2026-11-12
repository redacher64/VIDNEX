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
  resetEngineStatusCache();
  const db = createMemoryD1Database();
  const env = { DB: db };
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

  // Log an error -> written to request_log with empty ip_hash
  await logExtractionEvent(env, {
    platform: 'tiktok',
    status: 'error',
    errorCode: 'TIMEOUT',
    engineStage: 'level1_tikwm',
    httpStatus: 504,
    durationMs: 8000,
    ipHash: 'should_not_be_stored',
    ts: nowMs + 2000,
  });

  // Verify request_log has ONLY 1 row (the error) and ip_hash is empty
  const logRows = await db
    .prepare('SELECT id, ts, platform, status, error_code, duration_ms, ip_hash, engine_stage, http_status FROM request_log LIMIT ? OFFSET ?')
    .bind(25, 0)
    .all<{ status: string; error_code: string; ip_hash: string; engine_stage: string; http_status: number }>();

  assert.equal(logRows.results.length, 1);
  assert.equal(logRows.results[0].status, 'error');
  assert.equal(logRows.results[0].error_code, 'TIMEOUT');
  assert.equal(logRows.results[0].engine_stage, 'level1_tikwm');
  assert.equal(logRows.results[0].http_status, 504);
  assert.equal(logRows.results[0].ip_hash, '');

  // Verify /api/admin/stats funnel and platform rates
  const statsRes = await adminStatsGet({
    request: new Request('https://vidnex.space/api/admin/stats'),
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
