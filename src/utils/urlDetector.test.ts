import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectMediaUrl, isPlatformSupported } from './urlDetector.ts';
import { buildUncompressedZipBytes, crc32 } from './zipArchive.ts';
import { getLocalizedErrorMessage } from '../services/extractorService.ts';
import { detectUrl } from '../../functions/_lib/detect.ts';
import { isAllowedMediaHost } from '../../functions/_lib/allowlist.ts';
import { sanitizeFilename } from '../../functions/api/download.ts';
import { mapErrorCodeToHttpStatus } from '../../functions/_lib/normalize.ts';
import { checkRateLimit, resetRateLimitBuckets } from '../../functions/_lib/rateLimit.ts';
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
    assert.equal(mapErrorCodeToHttpStatus('NOT_FOUND'), 404);
    assert.equal(mapErrorCodeToHttpStatus('RATE_LIMITED'), 429);
    assert.equal(mapErrorCodeToHttpStatus('BLOCKED_BY_PLATFORM'), 502);
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

  it('Localizes extraction error messages across all 5 supported languages (en, fr, es, pt, ar)', () => {
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
  });

  it('Cloudflare Worker router handles /api/health, rejects unsupported URLs (400), blocks SSRF (403), and enforces IP rate limiting (429)', async () => {
    resetRateLimitBuckets();
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
});
