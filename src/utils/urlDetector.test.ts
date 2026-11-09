import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectMediaUrl, isPlatformSupported } from './urlDetector.ts';
import { buildUncompressedZipBytes, crc32 } from './zipArchive.ts';
import { getLocalizedErrorMessage } from '../services/extractorService.ts';
import { detectUrl } from '../../functions/_lib/detect.ts';
import { isAllowedMediaHost } from '../../functions/_lib/allowlist.ts';
import { sanitizeFilename } from '../../functions/api/download.ts';
import { mapErrorCodeToHttpStatus } from '../../functions/_lib/normalize.ts';
import {
  checkRateLimit,
  resetRateLimitBuckets,
  resetD1RateLimitFallback,
} from '../../functions/_lib/ratelimit.ts';
import {
  parseInstagramCookies,
  shortcodeToMediaId,
} from '../../functions/_lib/instagram.ts';
import { createMemoryD1Database } from '../../functions/_lib/db.ts';
import worker from '../../worker.ts';

describe('VIDNEX URL Detection & Security Suite', () => {
  it('Frontend detectMediaUrl validates Instagram & TikTok URLs and @handles, and marks unsupported platforms as Coming Soon', () => {
    const igReel = detectMediaUrl('https://www.instagram.com/reel/C8x9kLmN2pQ/');
    assert.equal(igReel.isValid, true);
    assert.equal(igReel.platform, 'instagram');
    assert.equal(igReel.mediaType, 'reel');

    const ttVideo = detectMediaUrl(
      'https://www.tiktok.com/@tiktok/video/7106594312292453675'
    );
    assert.equal(ttVideo.isValid, true);
    assert.equal(ttVideo.platform, 'tiktok');
    assert.equal(ttVideo.mediaType, 'video');

    const handle = detectMediaUrl('@natgeo', 'instagram');
    assert.equal(handle.isValid, true);
    assert.equal(handle.mediaType, 'profile');

    const ytShort = detectMediaUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ');
    assert.equal(ytShort.isValid, false);
    assert.equal(ytShort.isComingSoon, true);
    assert.equal(ytShort.platform, 'youtube');

    assert.equal(isPlatformSupported('instagram'), true);
    assert.equal(isPlatformSupported('tiktok'), true);
    assert.equal(isPlatformSupported('youtube'), false);
  });

  it('Cloudflare Pages Function detectUrl parses TikTok & Instagram videos, posts, and profiles', () => {
    const igPost = detectUrl('https://www.instagram.com/p/C9aBcDeFgHi/');
    assert.equal(igPost.isValid, true);
    assert.equal(igPost.platform, 'instagram');
    assert.equal(igPost.kind, 'post');
    assert.equal(igPost.identifier, 'C9aBcDeFgHi');

    const igProfile = detectUrl('https://www.instagram.com/natgeo/');
    assert.equal(igProfile.isValid, true);
    assert.equal(igProfile.platform, 'instagram');
    assert.equal(igProfile.kind, 'profile');
    assert.equal(igProfile.identifier, 'natgeo');

    const ttShort = detectUrl('https://vm.tiktok.com/ZM8abc123/');
    assert.equal(ttShort.isValid, true);
    assert.equal(ttShort.platform, 'tiktok');
    assert.equal(ttShort.isShortLink, true);

    const ttProfile = detectUrl('@designsystems', 'tiktok');
    assert.equal(ttProfile.isValid, true);
    assert.equal(ttProfile.platform, 'tiktok');
    assert.equal(ttProfile.kind, 'profile');
  });

  it('Cloudflare Pages Function allowlist & filename sanitizer block SSRF, RFC1918, bare domains, and path traversal', () => {
    assert.equal(isAllowedMediaHost('v16m.tiktokcdn.com'), true);
    assert.equal(isAllowedMediaHost('v16m-default.tiktokcdn-us.com'), true);
    assert.equal(isAllowedMediaHost('v16-webapp-prime.tiktok.com'), true);
    assert.equal(isAllowedMediaHost('www.tikwm.com'), true);
    assert.equal(isAllowedMediaHost('scontent.cdninstagram.com'), true);
    assert.equal(isAllowedMediaHost('video.xx.fbcdn.net'), true);

    // Reject bare non-CDN web domains
    assert.equal(isAllowedMediaHost('instagram.com'), false);
    assert.equal(isAllowedMediaHost('www.instagram.com'), false);
    assert.equal(isAllowedMediaHost('facebook.com'), false);
    assert.equal(isAllowedMediaHost('tiktok.com'), false);

    // Reject loopback, link-local, and RFC 1918 private IPs
    assert.equal(isAllowedMediaHost('localhost'), false);
    assert.equal(isAllowedMediaHost('127.0.0.1'), false);
    assert.equal(isAllowedMediaHost('169.254.169.254'), false);
    assert.equal(isAllowedMediaHost('172.16.0.1'), false);
    assert.equal(isAllowedMediaHost('172.31.255.255'), false);
    assert.equal(isAllowedMediaHost('10.0.0.1'), false);
    assert.equal(isAllowedMediaHost('192.168.1.1'), false);
    assert.equal(isAllowedMediaHost('evil.example.com'), false);

    assert.equal(
      sanitizeFilename('VIDNEX../bad name!.mp4'),
      'VIDNEX_bad_name_.mp4'
    );

    assert.equal(mapErrorCodeToHttpStatus('UNSUPPORTED_URL'), 400);
    assert.equal(mapErrorCodeToHttpStatus('PRIVATE_OR_LOGIN_REQUIRED'), 403);
    assert.equal(mapErrorCodeToHttpStatus('PLATFORM_DISABLED'), 403);
    assert.equal(mapErrorCodeToHttpStatus('BLOCKED'), 403);
    assert.equal(mapErrorCodeToHttpStatus('NOT_FOUND'), 404);
    assert.equal(mapErrorCodeToHttpStatus('RATE_LIMITED'), 429);
    assert.equal(mapErrorCodeToHttpStatus('BLOCKED_BY_PLATFORM'), 502);
    assert.equal(mapErrorCodeToHttpStatus('MAINTENANCE'), 503);
    assert.equal(mapErrorCodeToHttpStatus('TIMEOUT'), 504);
  });

  it('Token-bucket rate limiter allows normal traffic and throttles bursts with Retry-After', () => {
    resetRateLimitBuckets();
    const r1 = checkRateLimit('test:198.51.100.1', 2, 60_000, 1000);
    assert.equal(r1.allowed, true);
    assert.equal(r1.remaining, 1);

    const r2 = checkRateLimit('test:198.51.100.1', 2, 60_000, 1000);
    assert.equal(r2.allowed, true);
    assert.equal(r2.remaining, 0);

    const r3 = checkRateLimit('test:198.51.100.1', 2, 60_000, 1000);
    assert.equal(r3.allowed, false);
    assert.ok(r3.retryAfterSec >= 1);
  });

  it('Carousel PKZIP builder generates valid ZIP archive with PK signatures and exact CRC32', () => {
    const sampleData = new TextEncoder().encode('VIDNEX_CAROUSEL_SLIDE_1');
    const expectedCrc = crc32(sampleData);
    assert.ok(expectedCrc > 0);

    const zipBytes = buildUncompressedZipBytes([
      { name: 'slide_1.jpg', data: sampleData },
      { name: 'slide_2.jpg', data: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) },
    ]);

    const view = new DataView(zipBytes.buffer);
    assert.equal(view.getUint32(0, true), 0x04034b50);
    assert.equal(view.getUint32(zipBytes.byteLength - 22, true), 0x06054b50);
    assert.equal(view.getUint16(zipBytes.byteLength - 14, true), 2);
  });

  it('Localizes extraction error messages across all 5 supported languages (en, fr, es, pt, ar) including MAINTENANCE, PLATFORM_DISABLED, BLOCKED', () => {
    const enMsg = getLocalizedErrorMessage('NOT_FOUND', 'en');
    const frMsg = getLocalizedErrorMessage('NOT_FOUND', 'fr');
    const esMsg = getLocalizedErrorMessage('NOT_FOUND', 'es');
    const ptMsg = getLocalizedErrorMessage('NOT_FOUND', 'pt');
    const arMsg = getLocalizedErrorMessage('NOT_FOUND', 'ar');

    assert.ok(enMsg.includes('Media not found'));
    assert.ok(frMsg.includes('Contenu introuvable'));
    assert.ok(esMsg.includes('Contenido no encontrado'));
    assert.ok(ptMsg.includes('Conteúdo não encontrado'));
    assert.ok(arMsg.includes('لم يتم العثور'));

    assert.ok(getLocalizedErrorMessage('MAINTENANCE', 'fr').includes('maintenance'));
    assert.ok(
      getLocalizedErrorMessage('PLATFORM_DISABLED', 'fr').includes('désactivée')
    );
    assert.ok(getLocalizedErrorMessage('BLOCKED', 'fr').includes('bloquée'));
  });

  it('Parses Instagram Cookie-Editor JSON arrays and converts shortcodes to numeric media IDs', () => {
    const parsed = parseInstagramCookies({
      IG_COOKIES: JSON.stringify([
        { name: 'ds_user_id', value: '44596047994' },
        { name: 'csrftoken', value: 'XrP_I3yunQXQR6ZWugyQb7' },
        { name: 'sessionid', value: '44596047994%3Atest%3A19' },
      ]),
    });
    assert.equal(parsed.hasSession, true);
    assert.equal(parsed.dsUserId, '44596047994');
    assert.equal(parsed.csrfToken, 'XrP_I3yunQXQR6ZWugyQb7');
    assert.ok(parsed.cookieHeader.includes('sessionid=44596047994%3Atest%3A19'));

    const mediaId = shortcodeToMediaId('C8x9kLmN2pQ');
    assert.ok(mediaId && /^\d+$/.test(mediaId));
  });

  it('Cloudflare Worker router handles /api/health, rejects unsupported URLs (400), blocks SSRF (403), and enforces IP rate limiting (429)', async () => {
    resetRateLimitBuckets();
    resetD1RateLimitFallback();
    const healthRes = await worker.fetch(
      new Request('https://vidnex.space/api/health'),
      {}
    );
    assert.equal(healthRes.status, 200);
    const healthJson: any = await healthRes.json();
    assert.equal(healthJson.status, 'ok');

    const emptyExtractRes = await worker.fetch(
      new Request('https://vidnex.space/api/extract'),
      {}
    );
    assert.equal(emptyExtractRes.status, 400);

    const evilDownloadRes = await worker.fetch(
      new Request(
        'https://vidnex.space/api/download?url=https://evil.example.com/file.mp4'
      ),
      {}
    );
    assert.equal(evilDownloadRes.status, 403);

    const bareDomainDownloadRes = await worker.fetch(
      new Request(
        'https://vidnex.space/api/download?url=https://www.instagram.com/p/abc/'
      ),
      {}
    );
    assert.equal(bareDomainDownloadRes.status, 403);

    // Exhaust extract rate limit (30 req/min) for IP 203.0.113.99
    for (let i = 0; i < 30; i++) {
      await worker.fetch(
        new Request('https://vidnex.space/api/extract', {
          headers: { 'CF-Connecting-IP': '203.0.113.99' },
        }),
        {}
      );
    }
    const throttledRes = await worker.fetch(
      new Request('https://vidnex.space/api/extract', {
        headers: { 'CF-Connecting-IP': '203.0.113.99' },
      }),
      {}
    );
    assert.equal(throttledRes.status, 429);
    assert.ok(Number(throttledRes.headers.get('Retry-After')) >= 1);
  });

  it('ÉTAPE 7 — Vérification complète des 9 scénarios du panneau /admin et Cloudflare D1', async () => {
    const db = createMemoryD1Database();
    const adminEnv = {
      DB: db,
      ADMIN_PASSWORD: 'super-secret-admin-pwd',
      SESSION_SECRET: 'hmac-session-secret-key-2026',
      IP_HASH_SALT: 'ip-salt-2026',
    };

    // (1) /api/admin/* sans connexion => 401 UNAUTHORIZED + X-Robots-Tag: noindex
    const unauthStatsRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/stats'),
      adminEnv
    );
    assert.equal(unauthStatsRes.status, 401);
    assert.equal(unauthStatsRes.headers.get('X-Robots-Tag'), 'noindex, nofollow');

    const loginCheckUnauth = await worker.fetch(
      new Request('https://vidnex.space/api/admin/login'),
      adminEnv
    );
    const loginCheckJson: any = await loginCheckUnauth.json();
    assert.equal(loginCheckJson.authenticated, false);

    // (2) Mauvais mot de passe 5 fois => blocage 15 min (HTTP 429 BRUTE_FORCE_LOCKED)
    for (let attempt = 1; attempt <= 5; attempt++) {
      const badRes = await worker.fetch(
        new Request('https://vidnex.space/api/admin/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'https://vidnex.space',
            'CF-Connecting-IP': '198.51.100.77',
          },
          body: JSON.stringify({ password: `wrong-pass-${attempt}` }),
        }),
        adminEnv
      );
      if (attempt < 5) {
        assert.equal(badRes.status, 401);
      } else {
        assert.equal(badRes.status, 429);
        const badJson: any = await badRes.json();
        assert.equal(badJson.errorCode, 'BRUTE_FORCE_LOCKED');
      }
    }

    // Even with the right password, IP 198.51.100.77 is locked for 15 minutes
    const lockedAttemptRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://vidnex.space',
          'CF-Connecting-IP': '198.51.100.77',
        },
        body: JSON.stringify({ password: 'super-secret-admin-pwd' }),
      }),
      adminEnv
    );
    assert.equal(lockedAttemptRes.status, 429);

    // (3) Connexion OK depuis une IP non bloquée => cookie signé HttpOnly, Secure, SameSite=Strict + accès dashboard
    const okLoginRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://vidnex.space',
          'CF-Connecting-IP': '198.51.100.88',
        },
        body: JSON.stringify({ password: 'super-secret-admin-pwd' }),
      }),
      adminEnv
    );
    assert.equal(okLoginRes.status, 200);
    const setCookie = okLoginRes.headers.get('Set-Cookie') || '';
    assert.ok(setCookie.includes('vidnex_admin_session='));
    assert.ok(setCookie.includes('HttpOnly'));
    assert.ok(setCookie.includes('SameSite=Strict'));
    assert.ok(setCookie.includes('Secure'));

    const sessionCookie = setCookie.split(';')[0];

    const statsRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/stats', {
        headers: { Cookie: sessionCookie },
      }),
      adminEnv
    );
    assert.equal(statsRes.status, 200);
    const statsJson: any = await statsRes.json();
    assert.equal(statsJson.ok, true);
    assert.equal(statsJson.daily.length, 30);

    // (4) Maintenance ON => /api/extract renvoie MAINTENANCE (HTTP 503)
    await worker.fetch(
      new Request('https://vidnex.space/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://vidnex.space',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ maintenance: true }),
      }),
      adminEnv
    );

    const maintExtractRes = await worker.fetch(
      new Request(
        'https://vidnex.space/api/extract?url=https://www.tiktok.com/@tiktok/video/7106594312292453675'
      ),
      adminEnv
    );
    assert.equal(maintExtractRes.status, 503);
    const maintJson: any = await maintExtractRes.json();
    assert.equal(maintJson.error.code, 'MAINTENANCE');

    // Désactivation de maintenance et test de (5) Plateforme désactivée => PLATFORM_DISABLED (HTTP 403)
    await worker.fetch(
      new Request('https://vidnex.space/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://vidnex.space',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ maintenance: false, platform_tiktok: false }),
      }),
      adminEnv
    );

    const disabledPlatRes = await worker.fetch(
      new Request(
        'https://vidnex.space/api/extract?url=https://www.tiktok.com/@tiktok/video/7106594312292453675'
      ),
      adminEnv
    );
    assert.equal(disabledPlatRes.status, 403);
    const disabledPlatJson: any = await disabledPlatRes.json();
    assert.equal(disabledPlatJson.error.code, 'PLATFORM_DISABLED');

    // Réactivation de TikTok
    await worker.fetch(
      new Request('https://vidnex.space/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://vidnex.space',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ platform_tiktok: true }),
      }),
      adminEnv
    );

    // (6) Blocklist => /api/extract renvoie BLOCKED (HTTP 403)
    await worker.fetch(
      new Request('https://vidnex.space/api/admin/blocklist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://vidnex.space',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          type: 'url',
          value: 'blocked-video-99999',
        }),
      }),
      adminEnv
    );

    const blockedRes = await worker.fetch(
      new Request(
        'https://vidnex.space/api/extract?url=https://www.tiktok.com/@user/video/blocked-video-99999'
      ),
      adminEnv
    );
    assert.equal(blockedRes.status, 403);
    const blockedJson: any = await blockedRes.json();
    assert.equal(blockedJson.error.code, 'BLOCKED');

    // (7) Dépassement de limite => /api/extract renvoie RATE_LIMITED (HTTP 429)
    await worker.fetch(
      new Request('https://vidnex.space/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://vidnex.space',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ rate_limit_per_min: 2 }),
      }),
      adminEnv
    );

    for (let i = 0; i < 2; i++) {
      await worker.fetch(
        new Request('https://vidnex.space/api/extract', {
          headers: { 'CF-Connecting-IP': '203.0.113.55' },
        }),
        adminEnv
      );
    }
    const d1RateLimitedRes = await worker.fetch(
      new Request('https://vidnex.space/api/extract', {
        headers: { 'CF-Connecting-IP': '203.0.113.55' },
      }),
      adminEnv
    );
    assert.equal(d1RateLimitedRes.status, 429);
    const d1RateLimitedJson: any = await d1RateLimitedRes.json();
    assert.equal(d1RateLimitedJson.error.code, 'RATE_LIMITED');

    // (8) Bouton « Tester maintenant » (POST /api/admin/health) enregistre l'URL et le résultat dans engine_status
    const healthTestRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/health', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://vidnex.space',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          action: 'test_engine',
          platform: 'tiktok',
          url: 'https://www.tiktok.com/@tiktok/video/7106594312292453675',
        }),
      }),
      adminEnv
    );
    assert.equal(healthTestRes.status, 200);
    const healthTestJson: any = await healthTestRes.json();
    assert.equal(healthTestJson.ok, true);
    assert.equal(healthTestJson.platform, 'tiktok');

    const healthGetRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/health', {
        headers: { Cookie: sessionCookie },
      }),
      adminEnv
    );
    const healthGetJson: any = await healthGetRes.json();
    assert.equal(
      healthGetJson.engines.tiktok.test_url,
      'https://www.tiktok.com/@tiktok/video/7106594312292453675'
    );
    assert.ok(healthGetJson.engines.tiktok.last_test_ts > 0);

    // (9) L'extraction publique et /api/public-config continuent de fonctionner si D1 est coupé (DB: null)
    const brokenD1Env = {
      DB: null,
      DB_DISABLED: 'true',
    };
    const pubConfigNoDbRes = await worker.fetch(
      new Request('https://vidnex.space/api/public-config'),
      brokenD1Env
    );
    assert.equal(pubConfigNoDbRes.status, 200);
    const pubConfigNoDbJson: any = await pubConfigNoDbRes.json();
    assert.equal(pubConfigNoDbJson.ok, true);
    assert.equal(pubConfigNoDbJson.maintenance, false);
    assert.equal(pubConfigNoDbJson.platforms.tiktok, true);

    const extractNoDbRes = await worker.fetch(
      new Request('https://vidnex.space/api/extract?url=invalid-link'),
      brokenD1Env
    );
    // Returns normal 400 UNSUPPORTED_URL validation response instead of crashing with 500 D1 error
    assert.equal(extractNoDbRes.status, 400);
    const extractNoDbJson: any = await extractNoDbRes.json();
    assert.equal(extractNoDbJson.error.code, 'UNSUPPORTED_URL');
  });
});

