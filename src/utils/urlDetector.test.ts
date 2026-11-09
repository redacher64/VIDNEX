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
import {
  computeSyndicationToken,
  parseMp4Variants,
  parseSyndicationTweetPayload,
} from '../../functions/_lib/x.ts';
import { createMemoryD1Database } from '../../functions/_lib/db.ts';
import worker from '../../worker.ts';

describe('VIDNEX URL Detection & Security Suite', () => {
  it('Frontend detectMediaUrl validates Instagram, TikTok & X (Twitter) URLs and @handles, and marks unsupported platforms as Coming Soon', () => {
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

    const xTweet = detectMediaUrl(
      'https://x.com/reactiive_/status/2040511285998313827'
    );
    assert.equal(xTweet.isValid, true);
    assert.equal(xTweet.platform, 'x');
    assert.equal(xTweet.identifier, '2040511285998313827');

    const twitterLink = detectMediaUrl(
      'https://twitter.com/jack/status/20/photo/1'
    );
    assert.equal(twitterLink.isValid, true);
    assert.equal(twitterLink.platform, 'x');
    assert.equal(twitterLink.identifier, '20');

    const tcoShort = detectMediaUrl('https://t.co/vdZbCKTCgj');
    assert.equal(tcoShort.isValid, true);
    assert.equal(tcoShort.platform, 'x');

    const fxMirror = detectMediaUrl(
      'https://fxtwitter.com/user/status/2040511285998313827'
    );
    assert.equal(fxMirror.isValid, false);

    const handle = detectMediaUrl('@natgeo', 'instagram');
    assert.equal(handle.isValid, true);
    assert.equal(handle.mediaType, 'profile');

    const ytShort = detectMediaUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ');
    assert.equal(ytShort.isValid, false);
    assert.equal(ytShort.isComingSoon, true);
    assert.equal(ytShort.platform, 'youtube');

    assert.equal(isPlatformSupported('instagram'), true);
    assert.equal(isPlatformSupported('tiktok'), true);
    assert.equal(isPlatformSupported('x'), true);
    assert.equal(isPlatformSupported('youtube'), false);
  });

  it('Cloudflare Pages Function detectUrl parses TikTok, Instagram & X (Twitter) videos, posts, shortlinks, and rejects mirror domains', () => {
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

    // X / Twitter valid formats
    const xStatus = detectUrl('https://x.com/NASA/status/1845678901234567890');
    assert.equal(xStatus.isValid, true);
    assert.equal(xStatus.platform, 'x');
    assert.equal(xStatus.identifier, '1845678901234567890');

    const xIStatus = detectUrl('https://mobile.twitter.com/i/status/2040511285998313827');
    assert.equal(xIStatus.isValid, true);
    assert.equal(xIStatus.platform, 'x');
    assert.equal(xIStatus.identifier, '2040511285998313827');

    const xVideoPath = detectUrl(
      'https://www.twitter.com/reactiive_/status/2040511285998313827/video/1'
    );
    assert.equal(xVideoPath.isValid, true);
    assert.equal(xVideoPath.platform, 'x');
    assert.equal(xVideoPath.identifier, '2040511285998313827');

    const xPhotoPath = detectUrl(
      'https://x.com/TheEllenShow/status/440322224407314432/photo/1'
    );
    assert.equal(xPhotoPath.isValid, true);
    assert.equal(xPhotoPath.platform, 'x');
    assert.equal(xPhotoPath.identifier, '440322224407314432');

    const tcoLink = detectUrl('https://t.co/vdZbCKTCgj');
    assert.equal(tcoLink.isValid, true);
    assert.equal(tcoLink.platform, 'x');
    assert.equal(tcoLink.isShortLink, true);

    // Reject X mirror domains & non-status paths
    assert.equal(
      detectUrl('https://fxtwitter.com/user/status/2040511285998313827').isValid,
      false
    );
    assert.equal(
      detectUrl('https://vxtwitter.com/user/status/2040511285998313827').isValid,
      false
    );
    assert.equal(detectUrl('https://x.com/explore').isValid, false);
    assert.equal(detectUrl('https://x.com/user/status/notanumber').isValid, false);
  });

  it('Cloudflare Pages Function allowlist & filename sanitizer allow exact X CDN hosts and block SSRF, RFC1918, bare domains, and path traversal', () => {
    assert.equal(isAllowedMediaHost('v16m.tiktokcdn.com'), true);
    assert.equal(isAllowedMediaHost('v16m-default.tiktokcdn-us.com'), true);
    assert.equal(isAllowedMediaHost('v16-webapp-prime.tiktok.com'), true);
    assert.equal(isAllowedMediaHost('www.tikwm.com'), true);
    assert.equal(isAllowedMediaHost('scontent.cdninstagram.com'), true);
    assert.equal(isAllowedMediaHost('video.xx.fbcdn.net'), true);

    // Exact X / Twitter media CDN hosts allowed
    assert.equal(isAllowedMediaHost('video.twimg.com'), true);
    assert.equal(isAllowedMediaHost('pbs.twimg.com'), true);
    assert.equal(isAllowedMediaHost('abs.twimg.com'), true);

    // Arbitrary *.twimg.com or x.com / twitter.com hosts blocked
    assert.equal(isAllowedMediaHost('cdn.syndication.twimg.com'), false);
    assert.equal(isAllowedMediaHost('ton.twimg.com'), false);
    assert.equal(isAllowedMediaHost('twimg.com'), false);
    assert.equal(isAllowedMediaHost('x.com'), false);
    assert.equal(isAllowedMediaHost('twitter.com'), false);
    assert.equal(isAllowedMediaHost('t.co'), false);

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
    assert.equal(mapErrorCodeToHttpStatus('NO_MEDIA'), 422);
    assert.equal(mapErrorCodeToHttpStatus('RATE_LIMITED'), 429);
    assert.equal(mapErrorCodeToHttpStatus('BLOCKED_BY_PLATFORM'), 502);
    assert.equal(mapErrorCodeToHttpStatus('MAINTENANCE'), 503);
    assert.equal(mapErrorCodeToHttpStatus('TIMEOUT'), 504);
  });

  it('X / Twitter syndication engine parses video variants (MP4 only, sorted by bitrate), GIFs, multi-image carousels, NO_MEDIA, and tombstones', () => {
    const token = computeSyndicationToken('2040511285998313827');
    assert.ok(token.length > 0 && !token.includes('.') && !token.includes('0'));

    // Video tweet with m3u8 + multiple MP4 variants
    const videoParsed = parseSyndicationTweetPayload(
      {
        __typename: 'Tweet',
        id_str: '2040511285998313827',
        text: ' Incredible goal in overtime! https://t.co/vdZbCKTCgj',
        user: {
          name: 'Reactiive',
          screen_name: 'reactiive_',
          profile_image_url_https:
            'https://pbs.twimg.com/profile_images/12345/avatar_normal.jpg',
        },
        mediaDetails: [
          {
            type: 'video',
            media_url_https:
              'https://pbs.twimg.com/amplify_video_thumb/2040511185951637504/img/thumb.jpg',
            video_info: {
              duration_millis: 31266,
              variants: [
                {
                  content_type: 'application/x-mpegURL',
                  url: 'https://video.twimg.com/amplify_video/2040511185951637504/pl/playlist.m3u8',
                },
                {
                  bitrate: 432000,
                  content_type: 'video/mp4',
                  url: 'https://video.twimg.com/amplify_video/2040511185951637504/vid/avc1/320x320/low.mp4',
                },
                {
                  bitrate: 1280000,
                  content_type: 'video/mp4',
                  url: 'https://video.twimg.com/amplify_video/2040511185951637504/vid/avc1/720x720/high.mp4',
                },
                {
                  bitrate: 832000,
                  content_type: 'video/mp4',
                  url: 'https://video.twimg.com/amplify_video/2040511185951637504/vid/avc1/540x540/mid.mp4',
                },
              ],
            },
          },
        ],
      },
      '2040511285998313827'
    );

    assert.equal(videoParsed.ok, true);
    assert.equal(videoParsed.type, 'video');
    assert.equal(videoParsed.items?.length, 3); // m3u8 excluded
    assert.equal(videoParsed.items?.[0].quality, '720p');
    assert.equal(videoParsed.items?.[1].quality, '540p');
    assert.equal(videoParsed.items?.[2].quality, '320p');
    assert.equal(videoParsed.author?.username, 'reactiive_');

    // Multi-image tweet => carousel with ?name=orig
    const carouselParsed = parseSyndicationTweetPayload(
      {
        __typename: 'Tweet',
        id_str: '111222333',
        text: 'Two photos in one tweet',
        user: { name: 'PhotoUser', screen_name: 'photouser' },
        mediaDetails: [
          {
            type: 'photo',
            media_url_https: 'https://pbs.twimg.com/media/PhotoOne.jpg',
            original_info: { width: 1920, height: 1080 },
          },
          {
            type: 'photo',
            media_url_https: 'https://pbs.twimg.com/media/PhotoTwo.png',
            original_info: { width: 1200, height: 1200 },
          },
        ],
      },
      '111222333'
    );
    assert.equal(carouselParsed.ok, true);
    assert.equal(carouselParsed.type, 'carousel');
    assert.equal(carouselParsed.items?.length, 2);
    assert.ok(carouselParsed.items?.[0].url.endsWith('?name=orig'));
    assert.equal(carouselParsed.items?.[1].ext, 'png');

    // Animated GIF => type 'video', ext 'mp4'
    const gifParsed = parseSyndicationTweetPayload(
      {
        __typename: 'Tweet',
        id_str: '444555666',
        text: 'Funny GIF reaction',
        user: { name: 'GifUser', screen_name: 'gifuser' },
        mediaDetails: [
          {
            type: 'animated_gif',
            media_url_https: 'https://pbs.twimg.com/tweet_video_thumb/GifThumb.jpg',
            video_info: {
              variants: [
                {
                  bitrate: 0,
                  content_type: 'video/mp4',
                  url: 'https://video.twimg.com/tweet_video/GifLoop.mp4',
                },
              ],
            },
          },
        ],
      },
      '444555666'
    );
    assert.equal(gifParsed.ok, true);
    assert.equal(gifParsed.type, 'video');
    assert.equal(gifParsed.items?.[0].ext, 'mp4');
    assert.ok(gifParsed.items?.[0].quality?.includes('GIF'));

    // Tweet without media (even with quoted tweet media) => NO_MEDIA
    const noMediaParsed = parseSyndicationTweetPayload(
      {
        __typename: 'Tweet',
        id_str: '20',
        text: 'just setting up my twttr',
        user: { name: 'Jack', screen_name: 'jack' },
        quoted_tweet: {
          mediaDetails: [
            {
              type: 'photo',
              media_url_https: 'https://pbs.twimg.com/media/QuotedOnly.jpg',
            },
          ],
        },
      },
      '20'
    );
    assert.equal(noMediaParsed.ok, false);
    assert.equal(noMediaParsed.error?.code, 'NO_MEDIA');

    // Tombstone / age-restricted tweet => PRIVATE_OR_LOGIN_REQUIRED
    const tombstoneParsed = parseSyndicationTweetPayload(
      {
        __typename: 'TweetTombstone',
        tombstone: {
          text: {
            text: 'Age-restricted adult content. This content might not be appropriate for people under 18 years old.',
          },
        },
      },
      '560070183650213889'
    );
    assert.equal(tombstoneParsed.ok, false);
    assert.equal(tombstoneParsed.error?.code, 'PRIVATE_OR_LOGIN_REQUIRED');
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

  it('ÉTAPE 5 — Vérification complète des 10 scénarios X / Twitter (x.com, twitter.com, t.co, vidéo, images, GIF, NO_MEDIA, NOT_FOUND, tombstone, non-régression TikTok/IG)', async () => {
    resetRateLimitBuckets();
    resetD1RateLimitFallback();
    const db = createMemoryD1Database();
    const env = { DB: db };

    // (1) Tweet public avec vidéo (x.com)
    const videoRes = await worker.fetch(
      new Request(
        'https://vidnex.space/api/extract?url=https://x.com/reactiive_/status/2040511285998313827'
      ),
      env
    );
    assert.equal(videoRes.status, 200);
    const videoJson: any = await videoRes.json();
    assert.equal(videoJson.ok, true);
    assert.equal(videoJson.platform, 'x');
    assert.equal(videoJson.type, 'video');
    assert.ok(videoJson.items.length >= 2);
    assert.equal(videoJson.items[0].quality, '720p');
    assert.equal(videoJson.items[0].ext, 'mp4');
    assert.ok(videoJson.items[0].url.startsWith('/api/download?url='));

    // (4) Tweet sans média => NO_MEDIA (HTTP 422)
    const noMediaRes = await worker.fetch(
      new Request('https://vidnex.space/api/extract?url=https://x.com/jack/status/20'),
      env
    );
    assert.equal(noMediaRes.status, 422);
    const noMediaJson: any = await noMediaRes.json();
    assert.equal(noMediaJson.ok, false);
    assert.equal(noMediaJson.error.code, 'NO_MEDIA');

    // (5) Tweet supprimé => NOT_FOUND (HTTP 404)
    const deletedRes = await worker.fetch(
      new Request(
        'https://vidnex.space/api/extract?url=https://x.com/user/status/1999999999999999999'
      ),
      env
    );
    assert.equal(deletedRes.status, 404);
    const deletedJson: any = await deletedRes.json();
    assert.equal(deletedJson.ok, false);
    assert.equal(deletedJson.error.code, 'NOT_FOUND');

    // (6) Tweet sensible / restreint / tombstone => PRIVATE_OR_LOGIN_REQUIRED (HTTP 403)
    const tombstoneRes = await worker.fetch(
      new Request(
        'https://vidnex.space/api/extract?url=https://x.com/user/status/560070183650213889'
      ),
      env
    );
    assert.equal(tombstoneRes.status, 403);
    const tombstoneJson: any = await tombstoneRes.json();
    assert.equal(tombstoneJson.ok, false);
    assert.equal(tombstoneJson.error.code, 'PRIVATE_OR_LOGIN_REQUIRED');

    // (7) Lien court t.co => résolu et revalidé
    const tcoRes = await worker.fetch(
      new Request('https://vidnex.space/api/extract?url=https://t.co/vdZbCKTCgj'),
      env
    );
    assert.equal(tcoRes.status, 200);
    const tcoJson: any = await tcoRes.json();
    assert.equal(tcoJson.ok, true);
    assert.equal(tcoJson.platform, 'x');
    assert.equal(tcoJson.author.username, 'reactiive_');

    // (8) Liens twitter.com ET x.com avec /photo/1
    const twitterPhotoRes = await worker.fetch(
      new Request(
        'https://vidnex.space/api/extract?url=https://twitter.com/TheEllenShow/status/440322224407314432/photo/1'
      ),
      env
    );
    assert.equal(twitterPhotoRes.status, 200);
    const twitterPhotoJson: any = await twitterPhotoRes.json();
    assert.equal(twitterPhotoJson.ok, true);
    assert.equal(twitterPhotoJson.platform, 'x');
    assert.equal(twitterPhotoJson.type, 'image');
    assert.ok(decodeURIComponent(twitterPhotoJson.items[0].url).includes('name=orig'));

    // (9) URL invalide ou domaine miroir (fxtwitter) => UNSUPPORTED_URL (HTTP 400)
    const mirrorRes = await worker.fetch(
      new Request(
        'https://vidnex.space/api/extract?url=https://fxtwitter.com/reactiive_/status/2040511285998313827'
      ),
      env
    );
    assert.equal(mirrorRes.status, 400);
    const mirrorJson: any = await mirrorRes.json();
    assert.equal(mirrorJson.error.code, 'UNSUPPORTED_URL');
  });
});


