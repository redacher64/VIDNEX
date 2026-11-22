import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.ts';
import { detectUrl } from '../functions/_lib/detect.ts';
import { detectMediaUrl } from '../src/utils/urlDetector.ts';
import { createMemoryD1Database, type AdminEnv } from '../functions/_lib/db.ts';
import {
  resetRateLimitBuckets,
  resetD1RateLimitFallback,
} from '../functions/_lib/ratelimit.ts';
import {
  clearStoryMetadataCache,
  resetStoryProviderTelemetry,
  isMockProviderAllowed,
  mockStoryProvider,
  STORY_METADATA_CACHE_TTL_MS,
} from '../functions/_lib/instagramStories.ts';
import { STORIES_UNAVAILABLE_MESSAGE } from '../functions/_lib/normalize.ts';
import {
  STORY_MAX_SELECTION_ITEMS,
  STORY_MAX_SELECTION_TOTAL_BYTES,
  validateSelectionLimits,
} from '../src/utils/zipArchive.ts';
import {
  getLocalizedErrorMessage,
  mapExtractResponseToMediaResult,
} from '../src/services/extractorService.ts';
import { UI_TRANSLATIONS } from '../src/i18n/translations.ts';

const ALL_LOCALES = ['fr', 'en', 'ar', 'es', 'pt', 'de', 'tr', 'id', 'it', 'ru'] as const;

function makeDevEnv(db: ReturnType<typeof createMemoryD1Database>, extra: Partial<AdminEnv> = {}): AdminEnv {
  return {
    DB: db,
    ADMIN_PASSWORD: 'stories-admin-secret',
    SESSION_SECRET: 'stories-session-hmac-secret-2026',
    IP_HASH_SALT: 'stories-ip-salt-2026',
    VIDNEX_LOCAL_DEV: 'true',
    STORIES_ALLOW_MOCK: 'true',
    ...extra,
  };
}

async function setSetting(
  db: ReturnType<typeof createMemoryD1Database>,
  key: string,
  value: string
) {
  await db
    .prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    )
    .bind(key, value)
    .run();
}

async function enableStories(db: ReturnType<typeof createMemoryD1Database>) {
  await setSetting(db, 'feature_stories', 'true');
}

describe('Instagram Stories feature (providers, API, limits, admin, i18n)', () => {
  beforeEach(() => {
    resetRateLimitBuckets();
    resetD1RateLimitFallback();
    clearStoryMetadataCache();
    resetStoryProviderTelemetry();
  });

  it('detects /stories/{username}/{id}/ (with or without query params) as story and /stories/highlights/{id}/ as highlight', () => {
    const cases = [
      'https://www.instagram.com/stories/public_creator/9100000000000000001/',
      'https://instagram.com/stories/public_creator/9100000000000000001?utm_source=ig_story_item_share&igsh=abc123',
      'https://www.instagram.com/stories/public.user_99/1234567890123456789',
    ];
    for (const raw of cases) {
      const serverDet = detectUrl(raw);
      assert.equal(serverDet.isValid, true);
      assert.equal(serverDet.platform, 'instagram');
      assert.equal(serverDet.kind, 'story');

      const clientDet = detectMediaUrl(raw);
      assert.equal(clientDet.isValid, true);
      assert.equal(clientDet.platform, 'instagram');
      assert.equal(clientDet.mediaType, 'story');
    }

    const highlightUrls = [
      'https://www.instagram.com/stories/highlights/17895485201123456/',
      'https://instagram.com/stories/highlights/17895485201123456/?hl=fr',
    ];
    for (const raw of highlightUrls) {
      const serverDet = detectUrl(raw);
      assert.equal(serverDet.isValid, true);
      assert.equal(serverDet.platform, 'instagram');
      assert.equal(serverDet.kind, 'highlight');

      const clientDet = detectMediaUrl(raw);
      assert.equal(clientDet.isValid, true);
      assert.equal(clientDet.platform, 'instagram');
      assert.equal(clientDet.mediaType, 'highlight');
    }
  });

  it('never enables mock provider in production and defaults feature_stories to false', async () => {
    // Production host & CF_PAGES guard
    assert.equal(
      isMockProviderAllowed(
        { STORIES_ALLOW_MOCK: 'true', VIDNEX_LOCAL_DEV: 'true', CF_PAGES: '1' },
        new Request('http://localhost:3000/api/stories?username=public_creator')
      ),
      false
    );
    assert.equal(
      isMockProviderAllowed(
        { STORIES_ALLOW_MOCK: 'true', VIDNEX_LOCAL_DEV: 'true' },
        new Request('https://vidnex.space/api/stories?username=public_creator')
      ),
      false
    );
    assert.equal(
      isMockProviderAllowed(
        { STORIES_ALLOW_MOCK: 'true', VIDNEX_LOCAL_DEV: 'true' },
        new Request('http://localhost:3000/api/stories?username=public_creator')
      ),
      true
    );

    // feature_stories is disabled by default -> 503 + exact unavailable message
    const db = createMemoryD1Database();
    const env = makeDevEnv(db);
    const pubCfgRes = await worker.fetch(
      new Request('http://localhost:3000/api/public-config'),
      env
    );
    const pubCfgJson: any = await pubCfgRes.json();
    assert.equal(pubCfgJson.feature_stories, false);

    const extractRes = await worker.fetch(
      new Request(
        'http://localhost:3000/api/extract?url=https://www.instagram.com/stories/public_creator/9100000000000000001/'
      ),
      env
    );
    assert.equal(extractRes.status, 503);
    const extractJson: any = await extractRes.json();
    assert.equal(extractJson.error?.code, 'STORIES_UNAVAILABLE');
    assert.equal(extractJson.error?.message, STORIES_UNAVAILABLE_MESSAGE);

    const listRes = await worker.fetch(
      new Request('http://localhost:3000/api/stories?username=public_creator'),
      env
    );
    assert.equal(listRes.status, 503);
    const listJson: any = await listRes.json();
    assert.equal(listJson.error?.code, 'STORIES_UNAVAILABLE');
    assert.equal(listJson.error?.message, STORIES_UNAVAILABLE_MESSAGE);
  });

  it('fetches a single story via /api/extract with mock provider, returns /api/download URLs, and increments story_opened & story_download', async () => {
    const db = createMemoryD1Database();
    await enableStories(db);
    const env = makeDevEnv(db);

    const storyUrl =
      'https://www.instagram.com/stories/public_creator/3399000000000000002/?utm_source=ig_story_item_share';
    const res = await worker.fetch(
      new Request(
        `http://localhost:3000/api/extract?url=${encodeURIComponent(storyUrl)}`,
        { headers: { 'CF-Connecting-IP': '198.51.100.10' } }
      ),
      env
    );
    assert.equal(res.status, 200);
    const json: any = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.platform, 'instagram');
    assert.equal(json.type, 'video');
    assert.equal(json.storyMeta?.username, 'public_creator');
    assert.equal(json.storyMeta?.storyId, '3399000000000000002');
    assert.equal(json.storyMeta?.canListAll, true);
    assert.ok(json.storyMeta?.takenAt);
    assert.ok(json.storyMeta?.expiresAt);
    assert.ok(json.thumbnail.startsWith('/api/download?'));
    assert.ok(json.thumbnail.includes('inline=1'));
    assert.ok(json.items?.[0]?.url.startsWith('/api/download?'));
    assert.ok(json.items?.[0]?.url.includes('story=1'));

    // Frontend mapper keeps single-story view with storyMeta
    const mapped = mapExtractResponseToMediaResult(
      json,
      storyUrl,
      detectMediaUrl(storyUrl)
    );
    assert.equal(mapped.payloadType, 'video');
    if (mapped.payloadType === 'video') {
      assert.equal(mapped.storyMeta?.username, 'public_creator');
      assert.equal(mapped.storyMeta?.canListAll, true);
    }

    // Download proxy with story=1 increments story_download
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]), {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': '8',
        },
      })) as typeof fetch;
    try {
      const dlRes = await worker.fetch(
        new Request(`http://localhost:3000${json.items[0].url}`, {
          headers: { 'CF-Connecting-IP': '198.51.100.10' },
        }),
        env
      );
      assert.equal(dlRes.status, 200);
      await dlRes.arrayBuffer();
    } finally {
      globalThis.fetch = origFetch;
    }

    const metricsRows = await db
      .prepare('SELECT day, platform, event, count FROM daily_metrics')
      .all<{ day: string; platform: string; event: string; count: number }>();
    const map = new Map<string, number>();
    for (const r of metricsRows.results || []) {
      if (r.platform === 'instagram') {
        map.set(r.event, (map.get(r.event) || 0) + Number(r.count));
      }
    }
    assert.equal(map.get('story_opened'), 1);
    assert.equal(map.get('story_download'), 1);
  });

  it('lists multiple stories via /api/stories with 5-min metadata cache and preselects the requested story', async () => {
    const db = createMemoryD1Database();
    await enableStories(db);
    const env = makeDevEnv(db);

    const res1 = await worker.fetch(
      new Request(
        'http://localhost:3000/api/stories?username=public_creator&story_id=3399000000000000003',
        { headers: { 'CF-Connecting-IP': '198.51.100.20' } }
      ),
      env
    );
    assert.equal(res1.status, 200);
    const json1: any = await res1.json();
    assert.equal(json1.ok, true);
    assert.equal(json1.username, 'public_creator');
    assert.equal(json1.cached, false);
    assert.equal(json1.items.length, 4);
    assert.equal(json1.items[0].kind, 'photo');
    assert.equal(json1.items[1].kind, 'video');
    assert.equal(json1.items[2].id, '3399000000000000003');
    assert.equal(json1.items[2].selected, true);
    assert.equal(json1.items[0].selected, false);
    for (const item of json1.items) {
      assert.ok(item.id);
      assert.ok(item.kind === 'photo' || item.kind === 'video');
      assert.ok(item.url.startsWith('/api/download?'));
      assert.ok(item.url.includes('story=1'));
      assert.ok(item.thumbnail.startsWith('/api/download?'));
      assert.ok(item.thumbnail.includes('inline=1'));
      assert.ok(item.taken_at);
      assert.ok(item.expires_at);
    }

    // 2nd call within 5 minutes hits metadata cache
    assert.equal(STORY_METADATA_CACHE_TTL_MS, 5 * 60 * 1000);
    const res2 = await worker.fetch(
      new Request(
        'http://localhost:3000/api/stories?username=public_creator&story_id=3399000000000000001',
        { headers: { 'CF-Connecting-IP': '198.51.100.21' } }
      ),
      env
    );
    assert.equal(res2.status, 200);
    const json2: any = await res2.json();
    assert.equal(json2.ok, true);
    assert.equal(json2.cached, true);
    assert.equal(json2.items.length, 4);
    assert.equal(json2.items[0].selected, true);
    assert.equal(json2.items[2].selected, false);

    // story_list_opened metric incremented
    const metricsRows2 = await db
      .prepare('SELECT day, platform, event, count FROM daily_metrics')
      .all<{ day: string; platform: string; event: string; count: number }>();
    const listOpenedCount = (metricsRows2.results || [])
      .filter((r) => r.platform === 'instagram' && r.event === 'story_list_opened')
      .reduce((acc, r) => acc + Number(r.count), 0);
    assert.equal(listOpenedCount, 2);
  });

  it('returns distinct clear errors for private account, missing account, and account with no active stories', async () => {
    const db = createMemoryD1Database();
    await enableStories(db);
    const env = makeDevEnv(db);

    // Private account
    const privRes = await worker.fetch(
      new Request('http://localhost:3000/api/stories?username=private_account', {
        headers: { 'CF-Connecting-IP': '198.51.100.31' },
      }),
      env
    );
    assert.equal(privRes.status, 403);
    const privJson: any = await privRes.json();
    assert.equal(privJson.error?.code, 'STORY_ACCOUNT_PRIVATE');

    // Account not found
    const missingRes = await worker.fetch(
      new Request('http://localhost:3000/api/stories?username=missing_account', {
        headers: { 'CF-Connecting-IP': '198.51.100.32' },
      }),
      env
    );
    assert.equal(missingRes.status, 404);
    const missingJson: any = await missingRes.json();
    assert.equal(missingJson.error?.code, 'STORY_ACCOUNT_NOT_FOUND');

    // No active stories
    const emptyRes = await worker.fetch(
      new Request('http://localhost:3000/api/stories?username=empty_stories', {
        headers: { 'CF-Connecting-IP': '198.51.100.33' },
      }),
      env
    );
    assert.equal(emptyRes.status, 404);
    const emptyJson: any = await emptyRes.json();
    assert.equal(emptyJson.error?.code, 'STORY_NO_ACTIVE');

    // Single story URL for private account also returns 403 STORY_ACCOUNT_PRIVATE
    const privSingleRes = await worker.fetch(
      new Request(
        'http://localhost:3000/api/extract?url=https://www.instagram.com/stories/private_account/9999999999999999999/',
        { headers: { 'CF-Connecting-IP': '198.51.100.34' } }
      ),
      env
    );
    assert.equal(privSingleRes.status, 403);
    const privSingleJson: any = await privSingleRes.json();
    assert.equal(privSingleJson.error?.code, 'STORY_ACCOUNT_PRIVATE');
  });

  it('enforces per-hashed-IP hourly rate limit (5/hr default) AND global hourly cap on /api/stories', async () => {
    const db = createMemoryD1Database();
    await enableStories(db);
    const env = makeDevEnv(db);

    // 5 calls allowed for the same IP, 6th blocked with 429 + Retry-After
    for (let i = 1; i <= 5; i++) {
      const r = await worker.fetch(
        new Request('http://localhost:3000/api/stories?username=public_creator', {
          headers: { 'CF-Connecting-IP': '203.0.113.55' },
        }),
        env
      );
      assert.equal(r.status, 200, `Request #${i} should succeed`);
    }

    const sixth = await worker.fetch(
      new Request('http://localhost:3000/api/stories?username=public_creator', {
        headers: { 'CF-Connecting-IP': '203.0.113.55' },
      }),
      env
    );
    assert.equal(sixth.status, 429);
    assert.ok(Number(sixth.headers.get('Retry-After')) >= 1);
    const sixthJson: any = await sixth.json();
    assert.equal(sixthJson.error?.code, 'STORY_RATE_LIMITED');

    // Global hourly cap test (set cap = 2, clear cache between different accounts/IPs)
    const db2 = createMemoryD1Database();
    await enableStories(db2);
    await setSetting(db2, 'stories_global_hourly_cap', '2');
    const env2 = makeDevEnv(db2);

    const g1 = await worker.fetch(
      new Request('http://localhost:3000/api/stories?username=creator_alpha', {
        headers: { 'CF-Connecting-IP': '203.0.113.101' },
      }),
      env2
    );
    assert.equal(g1.status, 200);

    const g2 = await worker.fetch(
      new Request('http://localhost:3000/api/stories?username=creator_beta', {
        headers: { 'CF-Connecting-IP': '203.0.113.102' },
      }),
      env2
    );
    assert.equal(g2.status, 200);

    const g3 = await worker.fetch(
      new Request('http://localhost:3000/api/stories?username=creator_gamma', {
        headers: { 'CF-Connecting-IP': '203.0.113.103' },
      }),
      env2
    );
    assert.equal(g3.status, 429);
    const g3Json: any = await g3.json();
    assert.equal(g3Json.error?.code, 'STORY_RATE_LIMITED');
  });

  it('respects admin provider priority order, logs provider failures in request_log, and falls back to the next provider', async () => {
    const db = createMemoryD1Database();
    await enableStories(db);
    await setSetting(db, 'stories_provider_order', 'relay,paid,session');

    const env: AdminEnv = {
      DB: db,
      ADMIN_PASSWORD: 'stories-admin-secret',
      SESSION_SECRET: 'stories-session-hmac-secret-2026',
      IP_HASH_SALT: 'stories-ip-salt-2026',
      RELAY_URL: 'https://relay.internal.example',
      RELAY_TOKEN: 'relay-secret-never-exposed',
      STORIES_PAID_API_URL: 'https://paid-stories.example',
      STORIES_PAID_API_TOKEN: 'paid-secret-never-exposed',
    };

    const callOrder: string[] = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url.startsWith('https://relay.internal.example')) {
        callOrder.push('relay');
        const authHeader = new Headers(init?.headers).get('Authorization');
        assert.equal(authHeader, 'Bearer relay-secret-never-exposed');
        return new Response(JSON.stringify({ error: 'upstream_down' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.startsWith('https://paid-stories.example')) {
        callOrder.push('paid');
        const authHeader = new Headers(init?.headers).get('Authorization');
        assert.equal(authHeader, 'Bearer paid-secret-never-exposed');
        return new Response(
          JSON.stringify({
            username: 'creator_paid',
            items: [
              {
                id: '8888888888888888881',
                kind: 'photo',
                url: 'https://scontent.cdninstagram.com/v/story-paid-1.jpg',
                thumbnail: 'https://scontent.cdninstagram.com/v/story-paid-1-thumb.jpg',
                taken_at: '2026-04-01T10:00:00.000Z',
                expires_at: '2026-04-02T10:00:00.000Z',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    }) as typeof fetch;

    try {
      const res = await worker.fetch(
        new Request('https://vidnex.space/api/stories?username=creator_paid', {
          headers: { 'CF-Connecting-IP': '198.51.100.77' },
        }),
        env
      );
      assert.equal(res.status, 200);
      assert.deepEqual(callOrder, ['relay', 'paid']);
      const json: any = await res.json();
      assert.equal(json.ok, true);
      assert.equal(json.items.length, 1);

      // Ensure failed relay attempt was logged to request_log with content_kind='story', engine_stage='relay', http_status=502
      const logs = await db
        .prepare(
          'SELECT id, ts, platform, status, error_code, duration_ms, ip_hash, engine_stage, http_status, content_kind, engine_fn FROM request_log ORDER BY ts DESC, id DESC LIMIT ? OFFSET ?'
        )
        .bind(20, 0)
        .all<{
          content_kind: string | null;
          engine_stage: string | null;
          http_status: number | null;
          error_code: string | null;
        }>();
      const relayErr = (logs.results || []).find(
        (r) => r.content_kind === 'story' && r.engine_stage === 'relay'
      );
      assert.ok(relayErr, 'Relay failure must be logged in request_log');
      assert.equal(relayErr?.http_status, 502);

      // Now test total provider failure (all fail -> 503 STORIES_UNAVAILABLE)
      globalThis.fetch = (async () =>
        new Response('service unavailable', { status: 503 })) as typeof fetch;

      const failRes = await worker.fetch(
        new Request('https://vidnex.space/api/stories?username=provider_failure', {
          headers: { 'CF-Connecting-IP': '198.51.100.78' },
        }),
        env
      );
      assert.equal(failRes.status, 503);
      const failJson: any = await failRes.json();
      assert.equal(failJson.error?.code, 'STORIES_UNAVAILABLE');
      assert.equal(failJson.error?.message, STORIES_UNAVAILABLE_MESSAGE);

      // Mock provider failure path directly (with dev env)
      const mockFail = await mockStoryProvider.listStories(
        'provider_error',
        makeDevEnv(db)
      );
      assert.equal(mockFail.ok, false);
      assert.equal(mockFail.httpStatus, 502);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('supports Admin settings update, Admin health storiesStatus (zero secrets exposed), and Admin stats stories counters', async () => {
    const db = createMemoryD1Database();
    const env = makeDevEnv(db, {
      RELAY_URL: 'https://relay.example',
      RELAY_TOKEN: 'super-secret-relay-token',
      STORIES_PAID_API_URL: 'https://paid.example',
      STORIES_PAID_API_TOKEN: 'super-secret-paid-token',
    });

    // Login as owner via POST /api/admin/login
    const loginRes = await worker.fetch(
      new Request('http://localhost:3000/api/admin/login', {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:3000',
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ password: env.ADMIN_PASSWORD }),
      }),
      env
    );
    assert.equal(loginRes.status, 200);
    const setCookie = loginRes.headers.get('Set-Cookie') || '';
    const sessionCookie = setCookie.split(';')[0];
    assert.ok(sessionCookie.includes('vidnex_admin_session='));

    const adminHeaders = {
      Cookie: sessionCookie,
      Origin: 'http://localhost:3000',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    // Update Stories settings via POST /api/admin/settings
    const postSettings = await worker.fetch(
      new Request('http://localhost:3000/api/admin/settings', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          feature_stories: true,
          stories_provider_order: ['paid', 'relay', 'session'],
          stories_list_rate_limit_per_hour: 12,
          stories_global_hourly_cap: 500,
        }),
      }),
      env
    );
    assert.equal(postSettings.status, 200);
    const settingsJson: any = await postSettings.json();
    assert.equal(settingsJson.settings.feature_stories, true);
    assert.deepEqual(settingsJson.settings.stories_provider_order, [
      'paid',
      'relay',
      'session',
    ]);
    assert.equal(settingsJson.settings.stories_list_rate_limit_per_hour, 12);
    assert.equal(settingsJson.settings.stories_global_hourly_cap, 500);

    // Health endpoint exposes storiesStatus without any secret
    const healthRes = await worker.fetch(
      new Request('http://localhost:3000/api/admin/health', {
        headers: {
          Cookie: sessionCookie,
          Accept: 'application/json',
        },
      }),
      env
    );
    assert.equal(healthRes.status, 200);
    const healthText = await healthRes.text();
    assert.ok(!healthText.includes('super-secret-relay-token'));
    assert.ok(!healthText.includes('super-secret-paid-token'));
    const healthJson: any = JSON.parse(healthText);
    assert.equal(healthJson.storiesStatus?.enabled, true);
    assert.equal(healthJson.storiesStatus?.perIpHourlyLimit, 12);
    assert.equal(healthJson.storiesStatus?.globalHourlyCap, 500);
    assert.deepEqual(healthJson.storiesStatus?.providerOrder, [
      'paid',
      'relay',
      'session',
    ]);

    // Stats endpoint returns stories counters
    const statsRes = await worker.fetch(
      new Request('http://localhost:3000/api/admin/stats', {
        headers: {
          Cookie: sessionCookie,
          Accept: 'application/json',
        },
      }),
      env
    );
    assert.equal(statsRes.status, 200);
    const statsJson: any = await statsRes.json();
    assert.equal(typeof statsJson.stories?.story_opened, 'number');
    assert.equal(typeof statsJson.stories?.story_list_opened, 'number');
    assert.equal(typeof statsJson.stories?.story_download, 'number');
  });

  it('enforces Story ZIP selection limits (30 items / 150 MB) and provides 10-language UI & error translations', () => {
    assert.equal(STORY_MAX_SELECTION_ITEMS, 30);
    assert.equal(STORY_MAX_SELECTION_TOTAL_BYTES, 150 * 1024 * 1024);

    const storyLimits = {
      maxItems: STORY_MAX_SELECTION_ITEMS,
      maxBytes: STORY_MAX_SELECTION_TOTAL_BYTES,
    };
    assert.equal(
      validateSelectionLimits(30, 100 * 1024 * 1024, storyLimits).valid,
      true
    );
    assert.equal(
      validateSelectionLimits(31, 10 * 1024 * 1024, storyLimits).reason,
      'MAX_ITEMS_EXCEEDED'
    );
    assert.equal(
      validateSelectionLimits(5, 151 * 1024 * 1024, storyLimits).reason,
      'MAX_SIZE_EXCEEDED'
    );

    const storyErrorCodes = [
      'STORIES_UNAVAILABLE',
      'STORY_ACCOUNT_PRIVATE',
      'STORY_ACCOUNT_NOT_FOUND',
      'STORY_NO_ACTIVE',
      'STORY_RATE_LIMITED',
    ] as const;

    for (const loc of ALL_LOCALES) {
      const ui = UI_TRANSLATIONS[loc].drawer;
      assert.ok(ui.viewAllStoriesBtn.includes('{username}'), `${loc} viewAllStoriesBtn`);
      assert.ok(ui.storiesNotice24h.length > 20, `${loc} storiesNotice24h`);
      assert.ok(ui.storyLimitMaxItems.length > 10, `${loc} storyLimitMaxItems`);
      assert.ok(ui.storyLimitMaxSize.length > 10, `${loc} storyLimitMaxSize`);
      assert.ok(ui.backToSingleStory.length > 5, `${loc} backToSingleStory`);

      for (const code of storyErrorCodes) {
        const msg = getLocalizedErrorMessage(code, loc, {
          platform: 'instagram',
          isStory: true,
        });
        assert.ok(msg.length > 12, `${loc} ${code} must have localized message`);
      }
    }
  });
});
