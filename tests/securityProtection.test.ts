import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.ts';
import { createMemoryD1Database, type AdminEnv } from '../functions/_lib/db.ts';
import {
  resetD1RateLimitFallback,
  resetRateLimitBuckets,
} from '../functions/_lib/ratelimit.ts';
import {
  MAX_EXTRACT_URL_LENGTH,
  resetSecurityMemoryState,
} from '../functions/_lib/security.ts';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function makeEnv(
  db = createMemoryD1Database(),
  extra: Partial<AdminEnv> = {}
): AdminEnv {
  return {
    DB: db,
    ADMIN_PASSWORD: 'admin-test-password-2026',
    SESSION_SECRET: 'session-secret-test-2026',
    IP_HASH_SALT: 'security-test-salt-2026',
    ...extra,
  };
}

async function getOwnerCookie(env: AdminEnv): Promise<string> {
  const res = await worker.fetch(
    new Request('https://vidnex.space/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://vidnex.space',
        'CF-Connecting-IP': '198.51.100.250',
        'User-Agent': BROWSER_UA,
      },
      body: JSON.stringify({ password: env.ADMIN_PASSWORD }),
    }),
    env
  );
  assert.equal(res.status, 200);
  const setCookie = res.headers.get('Set-Cookie') || '';
  return setCookie.split(';')[0];
}

describe('VIDNEX Anti-Spam, Rate Limit, Turnstile, Filtering & Auto-Block Suite', () => {
  beforeEach(() => {
    resetRateLimitBuckets();
    resetD1RateLimitFallback();
    resetSecurityMemoryState();
  });

  it('1. Rate limiting /api/extract: enforces 10 req/min and 100 req/day with 429 + Retry-After', async () => {
    const db = createMemoryD1Database();
    const env = makeEnv(db);

    // 10 requests/min allowed (using unsupported URL after 10th? No, use invalid URL?
    // Wait: rate limit runs before URL whitelist, so 10 requests pass rate limit and hit 400; 11th hits 429!)
    for (let i = 0; i < 10; i++) {
      const r = await worker.fetch(
        new Request('https://vidnex.space/api/extract', {
          headers: {
            'CF-Connecting-IP': '203.0.113.10',
            'User-Agent': BROWSER_UA,
          },
        }),
        env
      );
      assert.equal(r.status, 400);
    }

    const eleventh = await worker.fetch(
      new Request('https://vidnex.space/api/extract', {
        headers: {
          'CF-Connecting-IP': '203.0.113.10',
          'User-Agent': BROWSER_UA,
        },
      }),
      env
    );
    assert.equal(eleventh.status, 429);
    assert.ok(Number(eleventh.headers.get('Retry-After')) >= 1);

    // Daily limit: raise per-min limit to 500 and verify default 100/day ceiling
    await db
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      )
      .bind('rate_limit_per_min', '500')
      .run();

    for (let i = 0; i < 100; i++) {
      const r = await worker.fetch(
        new Request('https://vidnex.space/api/extract', {
          headers: {
            'CF-Connecting-IP': '203.0.113.11',
            'User-Agent': BROWSER_UA,
          },
        }),
        env
      );
      assert.equal(r.status, 400, `Daily request #${i + 1} should not be rate limited`);
    }

    const dayOver = await worker.fetch(
      new Request('https://vidnex.space/api/extract', {
        headers: {
          'CF-Connecting-IP': '203.0.113.11',
          'User-Agent': BROWSER_UA,
        },
      }),
      env
    );
    assert.equal(dayOver.status, 429);
    assert.ok(Number(dayOver.headers.get('Retry-After')) >= 1);
  });

  it('2. Forms (/api/contact & /api/dmca): enforces 3 req/hour/IP + honeypot silent rejection', async () => {
    const db = createMemoryD1Database();
    const env = makeEnv(db);

    // Honeypot filled => silent 200 OK without storing in form_submissions or consuming quota
    const hpRes = await worker.fetch(
      new Request('https://vidnex.space/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '203.0.113.20',
          'User-Agent': BROWSER_UA,
        },
        body: JSON.stringify({
          name: 'Bot Spammer',
          email: 'bot@spam.example',
          message: 'Buy cheap watches now!',
          website: 'https://spam.example',
        }),
      }),
      env
    );
    assert.equal(hpRes.status, 200);
    const savedAfterHp = await db
      .prepare('SELECT id FROM form_submissions')
      .all<{ id: number }>();
    assert.equal(savedAfterHp.results.length, 0);

    // 3 legitimate form submissions succeed (2 contact + 1 dmca)
    for (let i = 1; i <= 2; i++) {
      const res = await worker.fetch(
        new Request('https://vidnex.space/api/contact', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '203.0.113.20',
            'User-Agent': BROWSER_UA,
          },
          body: JSON.stringify({
            name: 'Alice Martin',
            email: 'alice@example.com',
            subject: 'Question',
            message: `Message légitime numéro ${i} pour le support VIDNEX.`,
          }),
        }),
        env
      );
      assert.equal(res.status, 200);
    }

    const dmcaRes = await worker.fetch(
      new Request('https://vidnex.space/api/dmca', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '203.0.113.20',
          'User-Agent': BROWSER_UA,
        },
        body: JSON.stringify({
          name: 'Rights Holder',
          email: 'legal@creator.example',
          targetUrl: 'https://www.tiktok.com/@creator/video/7106594312292453675',
          message: 'Demande de blocage DMCA formelle pour mon contenu original.',
        }),
      }),
      env
    );
    assert.equal(dmcaRes.status, 200);

    const savedRows = await db
      .prepare('SELECT id, kind, ip_hash FROM form_submissions')
      .all<{ id: number; kind: string; ip_hash: string }>();
    assert.equal(savedRows.results.length, 3);

    // 4th submission within the hour => 429 + Retry-After
    const fourth = await worker.fetch(
      new Request('https://vidnex.space/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '203.0.113.20',
          'User-Agent': BROWSER_UA,
        },
        body: JSON.stringify({
          name: 'Alice Martin',
          email: 'alice@example.com',
          message: 'Quatrième envoi dans la même heure.',
        }),
      }),
      env
    );
    assert.equal(fourth.status, 429);
    assert.ok(Number(fourth.headers.get('Retry-After')) >= 1);
  });

  it('3. Turnstile temporary bypass by default + server-side verification when enabled', async () => {
    const db = createMemoryD1Database();

    // Default state (TURNSTILE_TEMPORARILY_DISABLED = true): hidden in public-config and bypassed server-side
    const disabledEnv = makeEnv(db, {
      TURNSTILE_SECRET: 'turnstile-test-secret-key',
      TURNSTILE_SITE_KEY: '0x4AAAAAAATestSiteKey',
      TURNSTILE_HOSTNAMES: 'vidnex.space',
    });
    const disabledCfgRes = await worker.fetch(
      new Request('https://vidnex.space/api/public-config'),
      disabledEnv
    );
    const disabledCfgJson: any = await disabledCfgRes.json();
    assert.equal(disabledCfgJson.turnstile_enabled, false);
    assert.equal(disabledCfgJson.turnstile_site_key, '');
    assert.equal(JSON.stringify(disabledCfgJson).includes('turnstile-test-secret-key'), false);

    const bypassContactRes = await worker.fetch(
      new Request('https://vidnex.space/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '203.0.113.29',
          'User-Agent': BROWSER_UA,
        },
        body: JSON.stringify({
          name: 'Bypass User',
          email: 'bypass@example.com',
          message: 'Temporary Turnstile bypass submission works cleanly.',
        }),
      }),
      disabledEnv
    );
    assert.equal(bypassContactRes.status, 200);

    // Re-enabled state (TURNSTILE_FORCE_ENABLE = 'true'): full fail-closed verification
    const env = makeEnv(db, {
      TURNSTILE_SECRET: 'turnstile-test-secret-key',
      TURNSTILE_SITE_KEY: '0x4AAAAAAATestSiteKey',
      TURNSTILE_HOSTNAMES: 'vidnex.space',
      TURNSTILE_FORCE_ENABLE: 'true',
    });

    // Public config exposes sitekey + flag, NEVER the secret
    const cfgRes = await worker.fetch(
      new Request('https://vidnex.space/api/public-config'),
      env
    );
    const cfgJson: any = await cfgRes.json();
    assert.equal(cfgJson.turnstile_enabled, true);
    assert.equal(cfgJson.turnstile_site_key, '0x4AAAAAAATestSiteKey');
    assert.equal(JSON.stringify(cfgJson).includes('turnstile-test-secret-key'), false);

    // Missing token on /api/extract => 403 TURNSTILE_REQUIRED
    const missingTokenRes = await worker.fetch(
      new Request(
        'https://vidnex.space/api/extract?url=https://www.tiktok.com/@tiktok/video/7106594312292453675',
        {
          headers: {
            'CF-Connecting-IP': '203.0.113.30',
            'User-Agent': BROWSER_UA,
          },
        }
      ),
      env
    );
    assert.equal(missingTokenRes.status, 403);
    const missingJson: any = await missingTokenRes.json();
    assert.equal(missingJson.error?.code, 'TURNSTILE_REQUIRED');

    const origFetch = globalThis.fetch;
    try {
      // Invalid token rejected by siteverify
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const u = typeof input === 'string' ? input : input.toString();
        if (u.includes('challenges.cloudflare.com/turnstile/v0/siteverify')) {
          return new Response(
            JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        throw new Error(`Unexpected upstream fetch: ${u}`);
      }) as typeof fetch;

      const invalidContactRes = await worker.fetch(
        new Request('https://vidnex.space/api/contact', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '203.0.113.31',
            'User-Agent': BROWSER_UA,
          },
          body: JSON.stringify({
            name: 'Bob',
            email: 'bob@example.com',
            message: 'Test Turnstile token invalid.',
            'cf-turnstile-response': 'bad-token',
          }),
        }),
        env
      );
      assert.equal(invalidContactRes.status, 403);

      // Network failure on siteverify => fail closed (403)
      globalThis.fetch = (async () => {
        throw new Error('siteverify unreachable');
      }) as typeof fetch;

      const netFailRes = await worker.fetch(
        new Request('https://vidnex.space/api/dmca', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '203.0.113.32',
            'User-Agent': BROWSER_UA,
          },
          body: JSON.stringify({
            name: 'Bob',
            email: 'bob@example.com',
            targetUrl: 'https://www.instagram.com/reel/C8x9kLmN2pQ/',
            message: 'Test Turnstile fail closed.',
            'cf-turnstile-response': 'some-token',
          }),
        }),
        env
      );
      assert.equal(netFailRes.status, 403);

      // Valid token => siteverify returns success + matching action + hostname
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const u = typeof input === 'string' ? input : input.toString();
        if (u.includes('challenges.cloudflare.com/turnstile/v0/siteverify')) {
          const params = new URLSearchParams(String(init?.body || ''));
          assert.equal(params.get('secret'), 'turnstile-test-secret-key');
          assert.equal(params.get('response'), 'valid-turnstile-token');
          return new Response(
            JSON.stringify({
              success: true,
              action: 'contact',
              hostname: 'vidnex.space',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        throw new Error(`Unexpected fetch: ${u}`);
      }) as typeof fetch;

      const validContactRes = await worker.fetch(
        new Request('https://vidnex.space/api/contact', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '203.0.113.33',
            'User-Agent': BROWSER_UA,
          },
          body: JSON.stringify({
            name: 'Valid User',
            email: 'valid@example.com',
            message: 'Valid Turnstile token test submission.',
            'cf-turnstile-response': 'valid-turnstile-token',
          }),
        }),
        env
      );
      assert.equal(validContactRes.status, 200);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('4. Request filtering: domain whitelist (400), URL max length (400), missing/bot UA (403), concurrency lock (429), and extraction timeout (504)', async () => {
    const db = createMemoryD1Database();
    const env = makeEnv(db, { EXTRACT_TIMEOUT_MS: '80' });

    // Missing User-Agent => 403
    const noUaRes = await worker.fetch(
      new Request(
        'https://vidnex.space/api/extract?url=https://www.tiktok.com/@tiktok/video/7106594312292453675',
        { headers: { 'CF-Connecting-IP': '203.0.113.40' } }
      ),
      env
    );
    assert.equal(noUaRes.status, 403);

    // Known bot User-Agent => 403
    for (const botUa of ['curl/8.4.0', 'python-requests/2.31.0', 'Googlebot/2.1']) {
      const botRes = await worker.fetch(
        new Request(
          'https://vidnex.space/api/extract?url=https://www.tiktok.com/@tiktok/video/7106594312292453675',
          {
            headers: {
              'CF-Connecting-IP': '203.0.113.41',
              'User-Agent': botUa,
            },
          }
        ),
        env
      );
      assert.equal(botRes.status, 403, `Bot UA ${botUa} should be rejected`);
    }

    // Unsupported domain => 400
    for (const badUrl of [
      'https://youtube.com/watch?v=dQw4w9WgXcQ',
      'https://evil.example.com/tiktok.com/@a/video/1',
      'http://127.0.0.1/admin',
      'javascript:alert(1)',
    ]) {
      const badRes = await worker.fetch(
        new Request(
          `https://vidnex.space/api/extract?url=${encodeURIComponent(badUrl)}`,
          {
            headers: {
              'CF-Connecting-IP': '203.0.113.42',
              'User-Agent': BROWSER_UA,
            },
          }
        ),
        env
      );
      assert.equal(badRes.status, 400, `URL ${badUrl} should return 400`);
    }

    // Overly long URL (> 2048 chars) => 400
    const longUrl = `https://www.tiktok.com/@user/video/7106594312292453675?pad=${'a'.repeat(MAX_EXTRACT_URL_LENGTH)}`;
    const longRes = await worker.fetch(
      new Request(
        `https://vidnex.space/api/extract?url=${encodeURIComponent(longUrl)}`,
        {
          headers: {
            'CF-Connecting-IP': '203.0.113.43',
            'User-Agent': BROWSER_UA,
          },
        }
      ),
      env
    );
    assert.equal(longRes.status, 400);

    // Concurrency lock (1 extraction at a time per IP) + max timeout (504)
    const origFetch = globalThis.fetch;
    let releaseSlowFetch!: () => void;
    try {
      globalThis.fetch = (() =>
        new Promise<Response>((resolve) => {
          releaseSlowFetch = () =>
            resolve(new Response('<html></html>', { status: 404 }));
        })) as typeof fetch;

      const firstInFlight = worker.fetch(
        new Request(
          'https://vidnex.space/api/extract?url=https://www.tiktok.com/@tiktok/video/7106594312292453675',
          {
            headers: {
              'CF-Connecting-IP': '203.0.113.44',
              'User-Agent': BROWSER_UA,
            },
          }
        ),
        env
      );

      // Give event loop a tick to enter extraction lock
      await new Promise((r) => setTimeout(r, 15));

      const concurrentRes = await worker.fetch(
        new Request(
          'https://vidnex.space/api/extract?url=https://www.tiktok.com/@tiktok/video/7106594312292453675',
          {
            headers: {
              'CF-Connecting-IP': '203.0.113.44',
              'User-Agent': BROWSER_UA,
            },
          }
        ),
        env
      );
      assert.equal(concurrentRes.status, 429);
      assert.ok(Number(concurrentRes.headers.get('Retry-After')) >= 1);

      const timedOutRes = await firstInFlight;
      assert.equal(timedOutRes.status, 504);
      const timedOutJson: any = await timedOutRes.json();
      assert.equal(timedOutJson.error?.code, 'TIMEOUT');
    } finally {
      if (releaseSlowFetch) releaseSlowFetch();
      globalThis.fetch = origFetch;
    }
  });

  it('5. Auto-block (3 limit exceedances in 1h -> 24h in blocked_ips), middleware first check, and Admin Controls unblock + rejected counter', async () => {
    const db = createMemoryD1Database();
    const env = makeEnv(db);
    const ownerCookie = await getOwnerCookie(env);

    // Lower per-min limit to 1 for quick deterministic testing
    await worker.fetch(
      new Request('https://vidnex.space/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://vidnex.space',
          Cookie: ownerCookie,
          'CF-Connecting-IP': '198.51.100.250',
        },
        body: JSON.stringify({ rate_limit_per_min: 1 }),
      }),
      env
    );

    const attackerIp = '203.0.113.99';
    // 1st request passes rate limit (returns 400 missing URL)
    const r0 = await worker.fetch(
      new Request('https://vidnex.space/api/extract', {
        headers: { 'CF-Connecting-IP': attackerIp, 'User-Agent': BROWSER_UA },
      }),
      env
    );
    assert.equal(r0.status, 400);

    // Exceed limit 3 times -> 429 each time, and 3rd exceedance writes to blocked_ips for 24h
    for (let v = 1; v <= 3; v++) {
      const r = await worker.fetch(
        new Request('https://vidnex.space/api/extract', {
          headers: { 'CF-Connecting-IP': attackerIp, 'User-Agent': BROWSER_UA },
        }),
        env
      );
      assert.equal(r.status, 429, `Violation #${v} should return 429`);
    }

    // Subsequent request on ANY route (even /api/health or /) is blocked FIRST in middleware (403 IP_BLOCKED)
    const blockedHealth = await worker.fetch(
      new Request('https://vidnex.space/api/health', {
        headers: { 'CF-Connecting-IP': attackerIp, 'User-Agent': BROWSER_UA },
      }),
      env
    );
    assert.equal(blockedHealth.status, 403);
    const blockedJson: any = await blockedHealth.json();
    assert.equal(blockedJson.error?.code, 'IP_BLOCKED');

    // Admin Contrôles GET /api/admin/blocked-ips lists blocked IP + rejectedToday > 0
    const adminListRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/blocked-ips', {
        headers: {
          Cookie: ownerCookie,
          'CF-Connecting-IP': '198.51.100.250',
        },
      }),
      env
    );
    assert.equal(adminListRes.status, 200);
    const adminListJson: any = await adminListRes.json();
    assert.equal(adminListJson.ok, true);
    assert.equal(adminListJson.items.length, 1);
    assert.ok(adminListJson.rejectedToday >= 4);
    const blockedIpHash = adminListJson.items[0].ip_hash;

    // Admin unblocks IP via DELETE /api/admin/blocked-ips
    const unblockRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/blocked-ips', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://vidnex.space',
          Cookie: ownerCookie,
          'CF-Connecting-IP': '198.51.100.250',
        },
        body: JSON.stringify({ ip_hash: blockedIpHash }),
      }),
      env
    );
    assert.equal(unblockRes.status, 200);
    const unblockJson: any = await unblockRes.json();
    assert.equal(unblockJson.items.length, 0);

    // Immediately after unblock, IP can reach /api/health again
    const afterUnblock = await worker.fetch(
      new Request('https://vidnex.space/api/health', {
        headers: { 'CF-Connecting-IP': attackerIp, 'User-Agent': BROWSER_UA },
      }),
      env
    );
    assert.equal(afterUnblock.status, 200);
  });
});
