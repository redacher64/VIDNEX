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
import {
  decodeFacebookEscapedString,
  parseFacebookHtmlPayload,
} from '../../functions/_lib/facebook.ts';
import { createMemoryD1Database } from '../../functions/_lib/db.ts';
import worker from '../../worker.ts';

describe('VIDNEX URL Detection & Security Suite', () => {
  it('Frontend detectMediaUrl validates Instagram, TikTok, X (Twitter) & Facebook URLs and @handles, and marks unsupported platforms as Coming Soon', () => {
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

    const fbReel = detectMediaUrl(
      'https://www.facebook.com/reel/10153231379946729'
    );
    assert.equal(fbReel.isValid, true);
    assert.equal(fbReel.platform, 'facebook');
    assert.equal(fbReel.mediaType, 'reel');
    assert.equal(fbReel.identifier, '10153231379946729');

    const fbWatch = detectMediaUrl(
      'https://www.facebook.com/watch/?v=10153231379946729'
    );
    assert.equal(fbWatch.isValid, true);
    assert.equal(fbWatch.platform, 'facebook');
    assert.equal(fbWatch.identifier, '10153231379946729');

    const fbShare = detectMediaUrl('https://www.facebook.com/share/v/1AbCdEfGh/');
    assert.equal(fbShare.isValid, true);
    assert.equal(fbShare.platform, 'facebook');

    const fbShort = detectMediaUrl('https://fb.watch/v1d2e3o4/');
    assert.equal(fbShort.isValid, true);
    assert.equal(fbShort.platform, 'facebook');

    const fbPhoto = detectMediaUrl('https://www.facebook.com/photo/?fbid=123456789');
    assert.equal(fbPhoto.isValid, false);

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
    assert.equal(isPlatformSupported('facebook'), true);
    assert.equal(isPlatformSupported('youtube'), false);
  });

  it('Cloudflare Pages Function detectUrl parses TikTok, Instagram, X (Twitter) & Facebook videos, Reels, share links, shortlinks, and rejects unsupported formats', () => {
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

    // Facebook valid formats
    const fbReel = detectUrl('https://www.facebook.com/reel/10153231379946729');
    assert.equal(fbReel.isValid, true);
    assert.equal(fbReel.platform, 'facebook');
    assert.equal(fbReel.identifier, '10153231379946729');

    const fbWatchSlash = detectUrl('https://www.facebook.com/watch/?v=10153231379946729');
    assert.equal(fbWatchSlash.isValid, true);
    assert.equal(fbWatchSlash.platform, 'facebook');
    assert.equal(fbWatchSlash.identifier, '10153231379946729');

    const fbWatchNoSlash = detectUrl('https://m.facebook.com/watch?v=10153231379946729');
    assert.equal(fbWatchNoSlash.isValid, true);
    assert.equal(fbWatchNoSlash.platform, 'facebook');
    assert.equal(fbWatchNoSlash.identifier, '10153231379946729');

    const fbPageVideos = detectUrl(
      'https://web.facebook.com/facebook/videos/10153231379946729/'
    );
    assert.equal(fbPageVideos.isValid, true);
    assert.equal(fbPageVideos.platform, 'facebook');
    assert.equal(fbPageVideos.identifier, '10153231379946729');

    const fbPageTitleVideos = detectUrl(
      'https://fb.com/facebook/videos/how-to-build/10153231379946729/'
    );
    assert.equal(fbPageTitleVideos.isValid, true);
    assert.equal(fbPageTitleVideos.platform, 'facebook');
    assert.equal(fbPageTitleVideos.identifier, '10153231379946729');

    const fbVideoPhp = detectUrl('https://www.facebook.com/video.php?v=10153231379946729');
    assert.equal(fbVideoPhp.isValid, true);
    assert.equal(fbVideoPhp.platform, 'facebook');
    assert.equal(fbVideoPhp.identifier, '10153231379946729');

    const fbShareV = detectUrl('https://www.facebook.com/share/v/1AbCdEfGh/');
    assert.equal(fbShareV.isValid, true);
    assert.equal(fbShareV.platform, 'facebook');
    assert.equal(fbShareV.isShortLink, true);

    const fbShareR = detectUrl('https://www.facebook.com/share/r/1AbCdEfGh/');
    assert.equal(fbShareR.isValid, true);
    assert.equal(fbShareR.platform, 'facebook');
    assert.equal(fbShareR.isShortLink, true);

    const fbWatchShort = detectUrl('https://fb.watch/v1d2e3o4/');
    assert.equal(fbWatchShort.isValid, true);
    assert.equal(fbWatchShort.platform, 'facebook');
    assert.equal(fbWatchShort.isShortLink, true);

    const fbLogin = detectUrl('https://www.facebook.com/login/?next=https%3A%2F%2Fwww.facebook.com%2Freel%2F123');
    assert.equal(fbLogin.isValid, false);
    assert.equal(fbLogin.platform, 'facebook');
    assert.equal(fbLogin.isLoginRedirect, true);

    // Reject Facebook photos, stories, lives, and mirror domains
    assert.equal(detectUrl('https://www.facebook.com/photo/?fbid=12345').isValid, false);
    assert.equal(detectUrl('https://www.facebook.com/stories/12345').isValid, false);
    assert.equal(detectUrl('https://www.facebook.com/watch/live/?v=12345').isValid, false);

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

  it('Cloudflare Pages Function allowlist & filename sanitizer allow exact X & Facebook CDN hosts and block SSRF, RFC1918, bare domains, and path traversal', () => {
    assert.equal(isAllowedMediaHost('v16m.tiktokcdn.com'), true);
    assert.equal(isAllowedMediaHost('v16m-default.tiktokcdn-us.com'), true);
    assert.equal(isAllowedMediaHost('v16-webapp-prime.tiktok.com'), true);
    assert.equal(isAllowedMediaHost('www.tikwm.com'), true);
    assert.equal(isAllowedMediaHost('scontent.cdninstagram.com'), true);
    assert.equal(isAllowedMediaHost('video.xx.fbcdn.net'), true);
    assert.equal(isAllowedMediaHost('video-fra3-1.xx.fbcdn.net'), true);
    assert.equal(isAllowedMediaHost('scontent-fra5-1.xx.fbcdn.net'), true);

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

    // Reject bare non-CDN web domains (including facebook.com, fb.watch, fb.com)
    assert.equal(isAllowedMediaHost('instagram.com'), false);
    assert.equal(isAllowedMediaHost('www.instagram.com'), false);
    assert.equal(isAllowedMediaHost('facebook.com'), false);
    assert.equal(isAllowedMediaHost('www.facebook.com'), false);
    assert.equal(isAllowedMediaHost('m.facebook.com'), false);
    assert.equal(isAllowedMediaHost('web.facebook.com'), false);
    assert.equal(isAllowedMediaHost('fb.watch'), false);
    assert.equal(isAllowedMediaHost('fb.com'), false);
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

  it('Facebook HTML/JSON parser decodes escaped CDN URLs, deduplicates HD/SD when identical, and classifies login walls & deleted videos', () => {
    const decoded = decodeFacebookEscapedString(
      'https:\\/\\/video-fra3-1.xx.fbcdn.net\\/o1\\/v\\/t2\\/f2\\/m69\\/video.mp4?efg=eyJ0est\\u00253D1\\u0026rl=1500&amp;oh=abc'
    );
    assert.equal(
      decoded,
      'https://video-fra3-1.xx.fbcdn.net/o1/v/t2/f2/m69/video.mp4?efg=eyJ0est%3D1&rl=1500&oh=abc'
    );

    const parsedDual = parseFacebookHtmlPayload(
      `<meta property="og:title" content="Facebook - How to Share With Just Friends" />
       <meta property="og:image" content="https://scontent-fra5-1.xx.fbcdn.net/v/t15.5256-10/thumb.jpg?oh=1&amp;oe=2" />
       <script>{"browser_native_hd_url":"https:\\/\\/video-fra3-1.xx.fbcdn.net\\/hd.mp4?rl=1500\\u0026oh=1","browser_native_sd_url":"https:\\/\\/video-fra3-2.xx.fbcdn.net\\/sd.mp4?rl=500\\u0026oh=2","video_owner":{"name":"Facebook"}}</script>`
    );
    assert.equal(parsedDual.ok, true);
    assert.equal(parsedDual.items?.[0]?.quality, 'HD');
    assert.equal(parsedDual.items?.[0]?.url, 'https://video-fra3-1.xx.fbcdn.net/hd.mp4?rl=1500&oh=1');
    assert.equal(parsedDual.items?.[1]?.quality, 'SD');
    assert.equal(parsedDual.items?.[1]?.url, 'https://video-fra3-2.xx.fbcdn.net/sd.mp4?rl=500&oh=2');
    assert.equal(parsedDual.author?.nickname, 'Facebook');
    assert.ok(parsedDual.thumbnail?.includes('scontent-fra5-1.xx.fbcdn.net'));

    // Dédoublonnage si HD === SD
    const parsedSame = parseFacebookHtmlPayload(
      `<script>{"browser_native_hd_url":"https:\\/\\/video-fra3-1.xx.fbcdn.net\\/same.mp4?oh=1","browser_native_sd_url":"https:\\/\\/video-fra3-1.xx.fbcdn.net\\/same.mp4?oh=1"}</script>`
    );
    assert.equal(parsedSame.ok, true);
    assert.equal(parsedSame.items?.length, 1);
    assert.equal(parsedSame.items?.[0]?.quality, 'HD');

    const parsedLogin = parseFacebookHtmlPayload(
      '<html><head><title>Log into Facebook</title></head><body><form id="login_form"></form></body></html>',
      '123',
      'https://www.facebook.com/login/?next=https%3A%2F%2Fwww.facebook.com%2Freel%2F123'
    );
    assert.equal(parsedLogin.ok, false);
    assert.equal(parsedLogin.error?.code, 'PRIVATE_OR_LOGIN_REQUIRED');

    const parsedDeleted = parseFacebookHtmlPayload(
      '<html><body><div>This Video Isn\'t Available Anymore</div></body></html>'
    );
    assert.equal(parsedDeleted.ok, false);
    assert.equal(parsedDeleted.error?.code, 'NOT_FOUND');
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

  it('Localizes extraction error messages across all 10 supported languages including MAINTENANCE, PLATFORM_DISABLED, BLOCKED, and Facebook PRIVATE_OR_LOGIN_REQUIRED', async () => {
    const { SUPPORTED_LOCALES } = await import('../i18n/config.ts');
    const { loadLocaleBundle } = await import('../i18n/localeLoader.ts');
    for (const loc of SUPPORTED_LOCALES) {
      await loadLocaleBundle(loc);
    }

    const enMsg = getLocalizedErrorMessage('NOT_FOUND', 'en');
    const frMsg = getLocalizedErrorMessage('NOT_FOUND', 'fr');
    const esMsg = getLocalizedErrorMessage('NOT_FOUND', 'es');
    const ptMsg = getLocalizedErrorMessage('NOT_FOUND', 'pt');
    const arMsg = getLocalizedErrorMessage('NOT_FOUND', 'ar');

    assert.ok(enMsg.includes('Media not found'));
    assert.ok(frMsg.includes('Contenu introuvable'));
    assert.ok(esMsg.includes('no se encuentra'));
    assert.ok(ptMsg.includes('não foi encontrada'));
    assert.ok(arMsg.includes('غير موجود'));

    assert.equal(
      getLocalizedErrorMessage('PRIVATE_OR_LOGIN_REQUIRED', 'fr'),
      "Cette vidéo n'est pas publique ou Facebook demande une connexion. Seules les vidéos publiques peuvent être téléchargées."
    );
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
    assert.equal(healthGetJson.engines.x.platform, 'x');
    assert.equal(healthGetJson.engines.facebook.platform, 'facebook');
    assert.equal(healthGetJson.engines.facebook.test_url, '');

    // Test de santé du moteur X (Twitter) et interrupteur platform_x dans Contrôles
    const xHealthTestRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/health', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://vidnex.space',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          action: 'test_engine',
          platform: 'x',
          url: 'https://x.com/reactiive_/status/2040511285998313827',
        }),
      }),
      adminEnv
    );
    assert.equal(xHealthTestRes.status, 200);
    const xHealthTestJson: any = await xHealthTestRes.json();
    assert.equal(xHealthTestJson.ok, true);
    assert.equal(xHealthTestJson.platform, 'x');
    assert.equal(xHealthTestJson.testOk, true);

    await worker.fetch(
      new Request('https://vidnex.space/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://vidnex.space',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ platform_x: false, rate_limit_per_min: 30 }),
      }),
      adminEnv
    );

    const disabledXRes = await worker.fetch(
      new Request(
        'https://vidnex.space/api/extract?url=https://x.com/reactiive_/status/2040511285998313827'
      ),
      adminEnv
    );
    assert.equal(disabledXRes.status, 403);
    const disabledXJson: any = await disabledXRes.json();
    assert.equal(disabledXJson.error.code, 'PLATFORM_DISABLED');

    await worker.fetch(
      new Request('https://vidnex.space/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://vidnex.space',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ platform_x: true }),
      }),
      adminEnv
    );

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
    assert.equal(pubConfigNoDbJson.platforms.facebook, true);

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

    // (10) Health.tsx : statut 'En ligne' / 'Hors ligne' et URL de test spécifique X
    const { DEFAULT_X_TEST_URL, getEngineStatusLabel } = await import(
      '../pages/admin/healthConfig.ts'
    );
    assert.equal(DEFAULT_X_TEST_URL, 'https://x.com/reactiive_/status/2040511285998313827');
    assert.equal(getEngineStatusLabel(1), 'En ligne');
    assert.equal(getEngineStatusLabel(null), 'En ligne');
    assert.equal(getEngineStatusLabel(0), 'Hors ligne');
  });

  it('ÉTAPE 5 (FACEBOOK) — Vérification complète des 9 scénarios Facebook (vidéo publique, Reel, fb.watch, /share/v|r/, privé/login, supprimée, invalide, non-régression, et test /admin)', async () => {
    resetRateLimitBuckets();
    resetD1RateLimitFallback();
    const db = createMemoryD1Database();
    const adminEnv = {
      DB: db,
      ADMIN_PASSWORD: 'super-secret-admin-pwd',
      SESSION_SECRET: 'hmac-session-secret-key-2026',
      IP_HASH_SALT: 'ip-salt-2026',
    };

    // (1) Vidéo Facebook publique (/{page}/videos/{id} & /watch/?v={id}) => HD + SD MP4 + nom facebook_{id}.mp4
    const fbVideoRes = await worker.fetch(
      new Request(
        'https://vidnex.space/api/extract?url=https://www.facebook.com/facebook/videos/10153231379946729/'
      ),
      adminEnv
    );
    assert.equal(fbVideoRes.status, 200);
    const fbVideoJson: any = await fbVideoRes.json();
    assert.equal(fbVideoJson.ok, true);
    assert.equal(fbVideoJson.platform, 'facebook');
    assert.equal(fbVideoJson.type, 'video');
    assert.ok(fbVideoJson.items.length >= 1);
    assert.equal(fbVideoJson.items[0].quality, 'HD');
    assert.equal(fbVideoJson.items[0].ext, 'mp4');
    assert.ok(
      fbVideoJson.items[0].url.includes('filename=facebook_10153231379946729.mp4')
    );

    // (2) Reel Facebook public (/reel/{id})
    const fbReelRes = await worker.fetch(
      new Request(
        'https://vidnex.space/api/extract?url=https://www.facebook.com/reel/10153231379946729'
      ),
      adminEnv
    );
    assert.equal(fbReelRes.status, 200);
    const fbReelJson: any = await fbReelRes.json();
    assert.equal(fbReelJson.ok, true);
    assert.equal(fbReelJson.platform, 'facebook');
    assert.equal(fbReelJson.type, 'video');
    assert.equal(fbReelJson.items[0].quality, 'HD');

    // (3) Lien court fb.watch & (4) Lien /share/v/ ou /share/r/ (avec interception contrôlée de redirection pour tester la résolution multi-sauts + revalidation anti-SSRF)
    const origFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const u = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (u.startsWith('https://fb.watch/testwatch123')) {
          return new Response(null, {
            status: 302,
            headers: {
              Location: 'https://www.facebook.com/facebook/videos/10153231379946729/',
            },
          });
        }
        if (u.startsWith('https://www.facebook.com/share/v/testshare123')) {
          return new Response(null, {
            status: 302,
            headers: {
              Location: 'https://www.facebook.com/reel/10153231379946729',
            },
          });
        }
        if (u.startsWith('https://www.facebook.com/share/r/privateshare999')) {
          return new Response(null, {
            status: 302,
            headers: {
              Location: 'https://www.facebook.com/login/?next=https%3A%2F%2Fwww.facebook.com%2Freel%2F999',
            },
          });
        }
        return origFetch(input, init);
      };

      const fbWatchShortRes = await worker.fetch(
        new Request('https://vidnex.space/api/extract?url=https://fb.watch/testwatch123/'),
        adminEnv
      );
      assert.equal(fbWatchShortRes.status, 200);
      const fbWatchShortJson: any = await fbWatchShortRes.json();
      assert.equal(fbWatchShortJson.ok, true);
      assert.equal(fbWatchShortJson.platform, 'facebook');

      const fbShareVRes = await worker.fetch(
        new Request(
          'https://vidnex.space/api/extract?url=https://www.facebook.com/share/v/testshare123/'
        ),
        adminEnv
      );
      assert.equal(fbShareVRes.status, 200);
      const fbShareVJson: any = await fbShareVRes.json();
      assert.equal(fbShareVJson.ok, true);
      assert.equal(fbShareVJson.platform, 'facebook');

      // (5) Vidéo privée ou redirection vers /login => PRIVATE_OR_LOGIN_REQUIRED (HTTP 403)
      const fbPrivateShareRes = await worker.fetch(
        new Request(
          'https://vidnex.space/api/extract?url=https://www.facebook.com/share/r/privateshare999/'
        ),
        adminEnv
      );
      assert.equal(fbPrivateShareRes.status, 403);
      const fbPrivateShareJson: any = await fbPrivateShareRes.json();
      assert.equal(fbPrivateShareJson.error.code, 'PRIVATE_OR_LOGIN_REQUIRED');
    } finally {
      globalThis.fetch = origFetch;
    }

    // (5b) Lien direct vers /login => PRIVATE_OR_LOGIN_REQUIRED (HTTP 403)
    const fbLoginRes = await worker.fetch(
      new Request(
        'https://vidnex.space/api/extract?url=https://www.facebook.com/login/?next=https%3A%2F%2Fwww.facebook.com%2Freel%2F123'
      ),
      adminEnv
    );
    assert.equal(fbLoginRes.status, 403);
    const fbLoginJson: any = await fbLoginRes.json();
    assert.equal(fbLoginJson.error.code, 'PRIVATE_OR_LOGIN_REQUIRED');

    // (6) Vidéo Facebook supprimée / inexistante => NOT_FOUND (HTTP 404) ou PRIVATE_OR_LOGIN_REQUIRED
    const fbDeletedRes = await worker.fetch(
      new Request(
        'https://vidnex.space/api/extract?url=https://www.facebook.com/watch/?v=999999999999999999'
      ),
      adminEnv
    );
    assert.ok(fbDeletedRes.status === 404 || fbDeletedRes.status === 403);
    const fbDeletedJson: any = await fbDeletedRes.json();
    assert.equal(fbDeletedJson.ok, false);
    assert.ok(
      fbDeletedJson.error.code === 'NOT_FOUND' ||
        fbDeletedJson.error.code === 'PRIVATE_OR_LOGIN_REQUIRED'
    );

    // (7) URL Facebook invalide (photo / story / live) => UNSUPPORTED_URL (HTTP 400)
    const fbPhotoInvalidRes = await worker.fetch(
      new Request(
        'https://vidnex.space/api/extract?url=https://www.facebook.com/photo/?fbid=10153231379946729'
      ),
      adminEnv
    );
    assert.equal(fbPhotoInvalidRes.status, 400);
    const fbPhotoInvalidJson: any = await fbPhotoInvalidRes.json();
    assert.equal(fbPhotoInvalidJson.error.code, 'UNSUPPORTED_URL');

    // (8) Non-régression X / TikTok / Instagram + (9) Test Facebook dans /admin met à jour engine_status
    const loginRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://vidnex.space',
          'CF-Connecting-IP': '198.51.100.200',
        },
        body: JSON.stringify({ password: 'super-secret-admin-pwd' }),
      }),
      adminEnv
    );
    const sessionCookie = (loginRes.headers.get('Set-Cookie') || '').split(';')[0];

    const fbAdminTestRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/health', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://vidnex.space',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          action: 'test_engine',
          platform: 'facebook',
          url: 'https://www.facebook.com/facebook/videos/10153231379946729/',
        }),
      }),
      adminEnv
    );
    assert.equal(fbAdminTestRes.status, 200);
    const fbAdminTestJson: any = await fbAdminTestRes.json();
    assert.equal(fbAdminTestJson.ok, true);
    assert.equal(fbAdminTestJson.platform, 'facebook');
    assert.equal(fbAdminTestJson.testOk, true);
    assert.ok(fbAdminTestJson.itemsCount >= 1);

    const afterHealthRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/health', {
        headers: { Cookie: sessionCookie },
      }),
      adminEnv
    );
    const afterHealthJson: any = await afterHealthRes.json();
    assert.equal(afterHealthJson.engines.facebook.last_test_ok, 1);
    assert.equal(
      afterHealthJson.engines.facebook.test_url,
      'https://www.facebook.com/facebook/videos/10153231379946729/'
    );
  });

  it('ÉTAPE 1 à 8 (SEO INTERNATIONAL 10 LANGUES) — Routage 10 langues, slugs localisés, hreflang réciproques + x-default, X-Robots-Tag sur .pages.dev/.workers.dev, et statut HTTP 404', async () => {
    const {
      SUPPORTED_LOCALES,
      getLocalizedPagePath,
      resolveRouteFromPathname,
      getAllPublicRoutes,
    } = await import('../i18n/config.ts');
    const { buildHreflangCluster, getPageCanonicalUrl } = await import(
      '../i18n/hreflang.ts'
    );

    // 1. 10 langues configurées, français par défaut à la racine SANS préfixe
    assert.equal(SUPPORTED_LOCALES.length, 10);
    assert.equal(getLocalizedPagePath('fr', 'home'), '/');
    assert.equal(
      getLocalizedPagePath('fr', 'tiktok'),
      '/telecharger-video-tiktok'
    );
    assert.equal(getLocalizedPagePath('en', 'home'), '/en');
    assert.equal(
      getLocalizedPagePath('en', 'tiktok'),
      '/en/tiktok-video-downloader'
    );
    assert.equal(
      getLocalizedPagePath('ar', 'tiktok'),
      '/ar/tiktok-video-downloader'
    );
    assert.equal(
      getLocalizedPagePath('ru', 'x'),
      '/ru/x-twitter-video-downloader'
    );
    assert.equal(
      getLocalizedPagePath('es', 'facebook'),
      '/es/descargar-video-facebook'
    );

    // 2. Pages légales : fr, en, ar ont leurs propres URLs ; les 7 autres langues pointent vers /en/...
    assert.equal(getLocalizedPagePath('fr', 'about'), '/a-propos');
    assert.equal(getLocalizedPagePath('en', 'about'), '/en/about');
    assert.equal(getLocalizedPagePath('ar', 'about'), '/ar/about');
    assert.equal(getLocalizedPagePath('de', 'about'), '/en/about');
    assert.equal(getLocalizedPagePath('ru', 'privacy'), '/en/privacy');

    // 3. Résolution d'URL + détection 404
    const resolvedFr = resolveRouteFromPathname('/telecharger-reel-instagram');
    assert.equal(resolvedFr.locale, 'fr');
    assert.equal(resolvedFr.pageKey, 'instagram');
    assert.equal(resolvedFr.isNotFound, false);

    const resolvedAr = resolveRouteFromPathname('/ar/facebook-video-downloader');
    assert.equal(resolvedAr.locale, 'ar');
    assert.equal(resolvedAr.pageKey, 'facebook');
    assert.equal(resolvedAr.isNotFound, false);

    const resolved404 = resolveRouteFromPathname('/ar/unknown-broken-route');
    assert.equal(resolved404.locale, 'ar');
    assert.equal(resolved404.pageKey, 'not_found');
    assert.equal(resolved404.isNotFound, true);

    // 4. Hreflang : 10 langues + x-default sur les pages principales, aucun hreflang sur les pages légales
    const tiktokHreflangs = buildHreflangCluster('tiktok');
    assert.equal(tiktokHreflangs.length, 11);
    const xDefault = tiktokHreflangs.find((h) => h.hreflang === 'x-default');
    assert.equal(
      xDefault?.href,
      'https://vidnex.space/en/tiktok-video-downloader'
    );
    assert.equal(buildHreflangCluster('privacy').length, 0);
    assert.equal(
      getPageCanonicalUrl('fr', 'home'),
      'https://vidnex.space/'
    );

    // 5. 65 routes publiques au total (50 principales + 15 légales)
    assert.equal(getAllPublicRoutes().length, 65);

    // 6. Messages d'erreur localisés dans les 10 langues
    for (const loc of SUPPORTED_LOCALES) {
      const msg = getLocalizedErrorMessage('UNSUPPORTED_URL', loc);
      assert.ok(typeof msg === 'string' && msg.length > 10);
    }

    // 7. Anti-duplication : X-Robots-Tag: noindex, nofollow sur *.pages.dev et *.workers.dev
    const previewRes = await worker.fetch(
      new Request('https://vidnex.redacher64.workers.dev/api/health'),
      {}
    );
    assert.equal(
      previewRes.headers.get('X-Robots-Tag'),
      'noindex, nofollow'
    );
  });

  it('ÉTAPE 1 à 7 (OPENGRAPH, TWITTER CARDS, IMAGES /OG/, FAVICONS & SHAREBUTTON) — Métadonnées sociales par page/langue, troncature propre arabe/latin, liens de partage sans suivi, et accès robots', async () => {
    const {
      buildHeadMetadataForRoute,
      clampSocialText,
    } = await import('../i18n/hreflang.ts');
    const { buildSocialShareUrls } = await import(
      '../components/ShareButton.tsx'
    );
    const { OG_IMAGES, SITE_URL } = await import('../config/site.ts');

    // 1. Vérifie que chaque plateforme utilise son image dédiée avec hash en URL absolue https
    const frHome = buildHeadMetadataForRoute('fr', 'home');
    assert.equal(frHome.ogImage, `${SITE_URL}${OG_IMAGES.default}`);
    assert.equal(frHome.ogImageSecureUrl, `${SITE_URL}${OG_IMAGES.default}`);
    assert.equal(frHome.twitterImage, `${SITE_URL}${OG_IMAGES.default}`);
    assert.equal(frHome.ogImageWidth, '1200');
    assert.equal(frHome.ogImageHeight, '630');
    assert.equal(frHome.ogImageType, 'image/jpeg');
    assert.equal(frHome.ogUrl, frHome.canonicalUrl);
    assert.equal(frHome.ogLocale, 'fr_FR');
    assert.ok(frHome.ogImageAlt.length > 20);

    const arTiktok = buildHeadMetadataForRoute('ar', 'tiktok');
    assert.equal(arTiktok.ogImage, `${SITE_URL}${OG_IMAGES.tiktok}`);
    assert.equal(arTiktok.ogUrl, 'https://vidnex.space/ar/tiktok-video-downloader');
    assert.equal(arTiktok.ogLocale, 'ar_AR');
    assert.ok(arTiktok.ogTitle.length <= 60);
    assert.ok(
      arTiktok.ogDescription.length >= 90 && arTiktok.ogDescription.length <= 150
    );

    const enInsta = buildHeadMetadataForRoute('en', 'instagram');
    assert.equal(enInsta.ogImage, `${SITE_URL}${OG_IMAGES.instagram}`);
    const esX = buildHeadMetadataForRoute('es', 'x');
    assert.equal(esX.ogImage, `${SITE_URL}${OG_IMAGES.x}`);
    const deFb = buildHeadMetadataForRoute('de', 'facebook');
    assert.equal(deFb.ogImage, `${SITE_URL}${OG_IMAGES.facebook}`);

    // 2. Troncature propre sans couper un mot ni un caractère arabe en deux
    const longAr =
      'أداة مجانية لتحميل الفيديوهات العامة من تيك توك بدون علامة مائية وريلز إنستغرام وفيديوهات إكس وفيسبوك بجودة عالية مباشرة عبر المتصفح بدون حساب';
    const clampedAr = clampSocialText(longAr, 60);
    assert.ok([...clampedAr].length <= 60);
    assert.ok(clampedAr.endsWith('…'));
    assert.ok(!clampedAr.includes('\uFFFD'));

    // 3. ShareButton : URLs de partage propres utilisant l'URL canonique exacte sans paramètres de suivi
    const shareUrls = buildSocialShareUrls('fr', 'tiktok');
    assert.equal(
      shareUrls.canonicalUrl,
      'https://vidnex.space/telecharger-video-tiktok'
    );
    assert.ok(shareUrls.whatsapp.startsWith('https://wa.me/?text='));
    assert.ok(
      shareUrls.telegram.startsWith(
        'https://t.me/share/url?url=https%3A%2F%2Fvidnex.space%2Ftelecharger-video-tiktok'
      )
    );
    assert.ok(
      shareUrls.facebook.startsWith(
        'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fvidnex.space%2Ftelecharger-video-tiktok'
      )
    );
    assert.ok(
      shareUrls.x.startsWith(
        'https://x.com/intent/tweet?url=https%3A%2F%2Fvidnex.space%2Ftelecharger-video-tiktok'
      )
    );
  });
});
