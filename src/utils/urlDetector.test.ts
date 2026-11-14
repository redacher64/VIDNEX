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

    // Reject Facebook photos, lives, and mirror domains; classify Facebook stories as 'story'
    assert.equal(detectUrl('https://www.facebook.com/photo/?fbid=12345').isValid, false);
    const fbStoryDet = detectUrl('https://www.facebook.com/stories/12345');
    assert.equal(fbStoryDet.isValid, true);
    assert.equal(fbStoryDet.platform, 'facebook');
    assert.equal(fbStoryDet.kind, 'story');
    assert.equal(fbStoryDet.contentKind, 'story');
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

    const origFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const u =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        if (u.startsWith('https://fb.watch/testwatch123')) {
          return new Response(null, {
            status: 302,
            headers: {
              Location:
                'https://www.facebook.com/facebook/videos/10153231379946729/',
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
              Location:
                'https://www.facebook.com/login/?next=https%3A%2F%2Fwww.facebook.com%2Freel%2F999',
            },
          });
        }
        if (u.includes('10153231379946729')) {
          return new Response(
            `<html><head><meta property="og:title" content="Facebook Demo Video" /><meta property="og:image" content="https://scontent-fra5-1.xx.fbcdn.net/thumb.jpg" /></head><body><script>{"browser_native_hd_url":"https:\\/\\/video-fra3-1.xx.fbcdn.net\\/v\\/t42.1790-2\\/10153231379946729_hd.mp4?oh=1","browser_native_sd_url":"https:\\/\\/video-fra3-1.xx.fbcdn.net\\/v\\/t42.1790-2\\/10153231379946729_sd.mp4?oh=1","owner":{"name":"Facebook"}}</script></body></html>`,
            { status: 200, headers: { 'Content-Type': 'text/html' } }
          );
        }
        if (u.includes('999999999999999999')) {
          return new Response(
            "<html><body><div>This Video Isn't Available Anymore</div></body></html>",
            { status: 404, headers: { 'Content-Type': 'text/html' } }
          );
        }
        return origFetch(input, init);
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
        fbVideoJson.items[0].url.includes(
          'filename=facebook_10153231379946729.mp4'
        )
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

      // (3) Lien court fb.watch & (4) Lien /share/v/ ou /share/r/
      const fbWatchShortRes = await worker.fetch(
        new Request(
          'https://vidnex.space/api/extract?url=https://fb.watch/testwatch123/'
        ),
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
      assert.equal(
        fbPrivateShareJson.error.code,
        'PRIVATE_OR_LOGIN_REQUIRED'
      );

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
      const sessionCookie = (loginRes.headers.get('Set-Cookie') || '').split(
        ';'
      )[0];

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
    } finally {
      globalThis.fetch = origFetch;
    }
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

    // 5. 75 routes publiques au total (60 principales + 15 légales)
    assert.equal(getAllPublicRoutes().length, 75);
    assert.equal(
      getLocalizedPagePath('fr', 'linkedin'),
      '/telecharger-photo-profil-linkedin'
    );
    assert.equal(
      getLocalizedPagePath('en', 'linkedin'),
      '/en/linkedin-profile-picture-downloader'
    );
    assert.equal(
      getLocalizedPagePath('ar', 'linkedin'),
      '/ar/linkedin-profile-picture-downloader'
    );
    assert.equal(
      getLocalizedPagePath('ru', 'linkedin'),
      '/ru/linkedin-profile-picture-downloader'
    );

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
      buildSocialShareUrls,
      clampSocialText,
    } = await import('../i18n/hreflang.ts');
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
    const frLi = buildHeadMetadataForRoute('fr', 'linkedin');
    assert.equal(frLi.ogImage, `${SITE_URL}${OG_IMAGES.linkedin}`);
    assert.equal(frLi.ogUrl, 'https://vidnex.space/telecharger-photo-profil-linkedin');

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

  it('ÉTAPE 6 (PROFIL INSTAGRAM) — Vérification complète des 8 scénarios : profil public (HD/Standard), caractères spéciaux, compte privé, compte inexistant (NOT_FOUND), blocage simulé (BLOCKED_BY_PLATFORM jamais NOT_FOUND), lien avec paramètres/sans slash, non-régression Reel/post/TikTok/X/Facebook, et téléchargement instagram_{username}_profile.jpg', async () => {
    resetRateLimitBuckets();
    resetD1RateLimitFallback();
    const db = createMemoryD1Database();
    const adminEnv = {
      DB: db,
      ADMIN_PASSWORD: 'super-secret-admin-pwd',
      SESSION_SECRET: 'hmac-session-secret-key-2026',
      IP_HASH_SALT: 'ip-salt-2026',
    };

    const { extractInstagramProfile } = await import(
      '../../functions/_lib/instagram.ts'
    );

    // -------------------------------------------------------------------
    // (6) Lien de profil avec paramètres (?igsh=...) et sans slash final + chemins réservés exclus
    // -------------------------------------------------------------------
    const detQueryNoSlash = detectMediaUrl(
      'https://www.instagram.com/N4ADDA?igsh=MzRlODBiNWFlZA==&utm_source=ig_web_copy_link'
    );
    assert.equal(detQueryNoSlash.isValid, true);
    assert.equal(detQueryNoSlash.platform, 'instagram');
    assert.equal(detQueryNoSlash.mediaType, 'profile');
    assert.equal(detQueryNoSlash.identifier, '@n4adda');

    const backendDetQueryNoSlash = detectUrl(
      'https://www.instagram.com/N4ADDA?igsh=MzRlODBiNWFlZA=='
    );
    assert.equal(backendDetQueryNoSlash.isValid, true);
    assert.equal(backendDetQueryNoSlash.platform, 'instagram');
    assert.equal(backendDetQueryNoSlash.kind, 'profile');
    assert.equal(backendDetQueryNoSlash.identifier, 'n4adda');

    const reservedPaths = [
      'p',
      'reel',
      'reels',
      'tv',
      'stories',
      'explore',
      'accounts',
      'direct',
      'about',
      'developer',
      'developers',
      'legal',
      'challenge',
      'graphql',
      'api',
      'login',
      'session',
      'privacy',
      'terms',
      'help',
      'press',
      'web',
      'tags',
      'locations',
      'directory',
      'share',
      'clips',
    ];
    for (const seg of reservedPaths) {
      const dFront = detectMediaUrl(`https://www.instagram.com/${seg}/`);
      assert.notEqual(
        dFront.mediaType,
        'profile',
        `Reserved segment /${seg}/ must not be detected as profile on frontend`
      );
      const dBack = detectUrl(`https://www.instagram.com/${seg}/`);
      assert.equal(
        dBack.isValid,
        false,
        `Reserved segment /${seg}/ must not be detected as profile on backend`
      );
    }

    // -------------------------------------------------------------------
    // (1) Profil public (Niveau 1 web_profile_info HD + Niveau 2 IG_SESSION_ID sans fuite + Niveau 3 repli Standard/HD)
    // -------------------------------------------------------------------
    // Test Niveau 1 sans compte : web_profile_info renvoie hd_profile_pic_url_info.url
    const level1Res = await extractInstagramProfile(
      'N4ADDA',
      undefined,
      async (input, init) => {
        const u = typeof input === 'string' ? input : input.toString();
        assert.ok(
          u.includes('/api/v1/users/web_profile_info/?username=n4adda')
        );
        const headers = new Headers(init?.headers);
        assert.equal(headers.get('X-IG-App-ID'), '936619743392459');
        assert.equal(init?.redirect, 'manual');
        return new Response(
          JSON.stringify({
            data: {
              user: {
                username: 'n4adda',
                full_name: 'Nadda Official',
                is_private: false,
                profile_pic_url:
                  'https://scontent.cdninstagram.com/v/t51.2885-19/150x150_n4adda.jpg',
                hd_profile_pic_url_info: {
                  url: 'https://scontent.cdninstagram.com/v/t51.2885-19/1080x1080_n4adda_hd.jpg',
                },
              },
            },
            status: 'ok',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    );
    assert.equal(level1Res.ok, true);
    if (level1Res.ok) {
      assert.equal(level1Res.type, 'image');
      assert.equal(level1Res.platform, 'instagram');
      assert.equal(level1Res.title, '@n4adda');
      assert.equal(level1Res.author?.username, 'n4adda');
      assert.equal(level1Res.author?.full_name, 'Nadda Official');
      assert.equal(level1Res.items.length, 1);
      assert.equal(level1Res.items[0].kind, 'image');
      assert.equal(level1Res.items[0].quality, 'HD');
      assert.equal(level1Res.items[0].ext, 'jpg');
      assert.equal(
        level1Res.items[0].url,
        'https://scontent.cdninstagram.com/v/t51.2885-19/1080x1080_n4adda_hd.jpg'
      );
    }

    // Test Niveau 2 : quand Niveau 1 est bloqué (429) et que IG_SESSION_ID est configuré,
    // réessaie avec le cookie sessionid sans jamais l'exposer dans la réponse
    let level2CalledWithCookie = false;
    const secretSessionId = 'SECRET_IG_SESSION_9988776655';
    const level2Res = await extractInstagramProfile(
      'n4adda',
      parseInstagramCookies({ IG_SESSION_ID: secretSessionId }),
      async (_input, init) => {
        const headers = new Headers(init?.headers);
        const cookie = headers.get('Cookie') || '';
        if (cookie.includes(`sessionid=${secretSessionId}`)) {
          level2CalledWithCookie = true;
          return new Response(
            JSON.stringify({
              data: {
                user: {
                  username: 'n4adda',
                  full_name: 'Nadda',
                  profile_pic_url_hd:
                    'https://scontent.cdninstagram.com/v/t51.2885-19/hd_via_session.jpg',
                },
              },
              status: 'ok',
            }),
            { status: 200 }
          );
        }
        return new Response('', { status: 429 });
      }
    );
    assert.equal(level2CalledWithCookie, true);
    assert.equal(level2Res.ok, true);
    assert.ok(!JSON.stringify(level2Res).includes(secretSessionId));

    // -------------------------------------------------------------------
    // (2) Profil avec nom complet et caractères spéciaux (accents, emojis, entités HTML) + Niveau 3 og:image Standard
    // -------------------------------------------------------------------
    const specialCharsRes = await extractInstagramProfile(
      ' cafe.de.l_art ',
      undefined,
      async (input) => {
        const u = typeof input === 'string' ? input : input.toString();
        if (u.includes('web_profile_info')) {
          return new Response('', { status: 429 });
        }
        if (u.endsWith('/embed/')) {
          return new Response('blocked', { status: 429 });
        }
        return new Response(
          `<!doctype html><html><head>
            <meta property="og:title" content="Café de l&#x27;Art &amp; Co ✨ (@cafe.de.l_art) • Instagram photos and videos" />
            <meta property="og:image" content="https://scontent-cdg4-1.cdninstagram.com/v/t51.82787-19/profile_standard.jpg?stp=dst-jpg_s320x320&amp;_nc_cat=104" />
          </head><body></body></html>`,
          { status: 200, headers: { 'Content-Type': 'text/html' } }
        );
      }
    );
    assert.equal(specialCharsRes.ok, true);
    if (specialCharsRes.ok) {
      assert.equal(specialCharsRes.title, '@cafe.de.l_art');
      assert.equal(
        specialCharsRes.author?.full_name,
        "Café de l'Art & Co ✨"
      );
      assert.equal(specialCharsRes.items[0].quality, 'Standard');
      assert.equal(
        specialCharsRes.items[0].url,
        'https://scontent-cdg4-1.cdninstagram.com/v/t51.82787-19/profile_standard.jpg?stp=dst-jpg_s320x320&_nc_cat=104'
      );
    }

    // -------------------------------------------------------------------
    // (3) Compte privé : photo de profil publique extraite si présente, sinon PRIVATE_OR_LOGIN_REQUIRED
    // -------------------------------------------------------------------
    const privateWithPublicPhotoRes = await extractInstagramProfile(
      'private_user_with_dp',
      undefined,
      async () =>
        new Response(
          JSON.stringify({
            data: {
              user: {
                username: 'private_user_with_dp',
                full_name: 'Compte Privé',
                is_private: true,
                hd_profile_pic_url_info: {
                  url: 'https://scontent.cdninstagram.com/v/t51.2885-19/private_user_hd.jpg',
                },
              },
            },
            status: 'ok',
          }),
          { status: 200 }
        )
    );
    assert.equal(privateWithPublicPhotoRes.ok, true);
    if (privateWithPublicPhotoRes.ok) {
      assert.equal(privateWithPublicPhotoRes.items[0].quality, 'HD');
    }

    const privateWithoutPhotoRes = await extractInstagramProfile(
      'private_no_dp',
      undefined,
      async () =>
        new Response(
          JSON.stringify({
            data: {
              user: {
                username: 'private_no_dp',
                full_name: 'Privé Sans Photo',
                is_private: true,
                profile_pic_url: '',
              },
            },
            status: 'ok',
          }),
          { status: 200 }
        )
    );
    assert.equal(privateWithoutPhotoRes.ok, false);
    if (!privateWithoutPhotoRes.ok) {
      assert.equal(
        privateWithoutPhotoRes.error.code,
        'PRIVATE_OR_LOGIN_REQUIRED'
      );
    }

    // -------------------------------------------------------------------
    // (4) Compte inexistant => NOT_FOUND uniquement si DEUX sources indépendantes le confirment
    // -------------------------------------------------------------------
    const notFoundTwoSourcesRes = await extractInstagramProfile(
      'user_does_not_exist_999999',
      undefined,
      async (input) => {
        const u = typeof input === 'string' ? input : input.toString();
        if (u.includes('web_profile_info')) {
          return new Response(
            JSON.stringify({
              data: { user: null },
              status: 'ok',
            }),
            { status: 200 }
          );
        }
        return new Response('Page Not Found', { status: 404 });
      }
    );
    assert.equal(notFoundTwoSourcesRes.ok, false);
    if (!notFoundTwoSourcesRes.ok) {
      assert.equal(notFoundTwoSourcesRes.error.code, 'NOT_FOUND');
      assert.equal(mapErrorCodeToHttpStatus(notFoundTwoSourcesRes.error.code), 404);
      assert.ok(notFoundTwoSourcesRes.engineStage?.includes('+'));
      assert.equal(notFoundTwoSourcesRes.httpStatus, 404);
    }

    // Un 404 isolé de l'endpoint interne (suivi d'un blocage 403/302 sur la page publique) => BLOCKED_BY_PLATFORM (JAMAIS NOT_FOUND)
    const isolated404Res = await extractInstagramProfile(
      'isolated_404_user',
      undefined,
      async (input) => {
        const u = typeof input === 'string' ? input : input.toString();
        if (u.includes('web_profile_info')) {
          return new Response('Not Found', { status: 404 });
        }
        return new Response('Forbidden', { status: 403 });
      }
    );
    assert.equal(isolated404Res.ok, false);
    if (!isolated404Res.ok) {
      assert.equal(isolated404Res.error.code, 'BLOCKED_BY_PLATFORM');
      assert.notEqual(isolated404Res.error.code, 'NOT_FOUND');
      assert.equal(
        isolated404Res.error.message,
        'Instagram bloque temporairement la demande. Réessayez dans quelques minutes.'
      );
    }

    // -------------------------------------------------------------------
    // (5) Blocage simulé (403, 429 vide, redirection 302 vers /accounts/login/) => BLOCKED_BY_PLATFORM (JAMAIS NOT_FOUND)
    // -------------------------------------------------------------------
    const blocked403Res = await extractInstagramProfile(
      'blocked_403_user',
      undefined,
      async () => new Response('Forbidden', { status: 403 })
    );
    assert.equal(blocked403Res.ok, false);
    if (!blocked403Res.ok) {
      assert.equal(blocked403Res.error.code, 'BLOCKED_BY_PLATFORM');
      assert.notEqual(blocked403Res.error.code, 'NOT_FOUND');
      assert.equal(
        blocked403Res.error.message,
        'Instagram bloque temporairement la demande. Réessayez dans quelques minutes.'
      );
      assert.equal(blocked403Res.httpStatus, 403);
    }

    const blockedSimRes = await extractInstagramProfile(
      'n4adda',
      undefined,
      async (input) => {
        const u = typeof input === 'string' ? input : input.toString();
        if (u.includes('web_profile_info')) {
          return new Response('', { status: 429 });
        }
        return new Response(null, {
          status: 302,
          headers: {
            Location:
              'https://www.instagram.com/accounts/login/?next=https%3A%2F%2Fwww.instagram.com%2Fn4adda%2F&is_from_rle',
          },
        });
      }
    );
    assert.equal(blockedSimRes.ok, false);
    if (!blockedSimRes.ok) {
      assert.equal(blockedSimRes.error.code, 'BLOCKED_BY_PLATFORM');
      assert.notEqual(blockedSimRes.error.code, 'NOT_FOUND');
      assert.equal(
        blockedSimRes.error.message,
        'Instagram bloque temporairement la demande. Réessayez dans quelques minutes.'
      );
      assert.equal(mapErrorCodeToHttpStatus(blockedSimRes.error.code), 502);
    }

    // Vérifie aussi que le message front est distinct en français pour un profil
    const frNotFoundMsg = getLocalizedErrorMessage('NOT_FOUND', 'fr', {
      isProfile: true,
    });
    const frBlockedMsg = getLocalizedErrorMessage('BLOCKED_BY_PLATFORM', 'fr', {
      isProfile: true,
    });
    assert.ok(frNotFoundMsg.toLowerCase().includes('introuvable'));
    assert.equal(
      frBlockedMsg,
      'Instagram bloque temporairement la demande. Réessayez dans quelques minutes.'
    );
    assert.notEqual(frNotFoundMsg, frBlockedMsg);

    // -------------------------------------------------------------------
    // (1b) Extraction réelle via /api/extract sur @instagram, @chadi.sammou et compte inexistant @vidnex_nonexistent_987654321
    // -------------------------------------------------------------------
    const liveIgRes = await worker.fetch(
      new Request(
        'https://vidnex.space/api/extract?url=https://www.instagram.com/instagram/'
      ),
      adminEnv
    );
    assert.equal(liveIgRes.status, 200);
    const liveIgJson: any = await liveIgRes.json();
    assert.equal(liveIgJson.ok, true);
    assert.equal(liveIgJson.platform, 'instagram');
    assert.equal(liveIgJson.type, 'image');
    assert.equal(liveIgJson.title, '@instagram');
    assert.equal(liveIgJson.author.username, 'instagram');
    assert.equal(liveIgJson.items.length, 1);
    assert.equal(liveIgJson.items[0].kind, 'image');
    assert.equal(liveIgJson.items[0].ext, 'jpg');
    assert.ok(
      liveIgJson.items[0].url.includes('filename=instagram_instagram_profile.jpg')
    );
    // Le front public ne reçoit jamais engineStage ni httpStatus
    assert.equal(liveIgJson.engineStage, undefined);
    assert.equal(liveIgJson.httpStatus, undefined);

    const liveChadiRes = await worker.fetch(
      new Request(
        'https://vidnex.space/api/extract?url=https://www.instagram.com/chadi.sammou/'
      ),
      adminEnv
    );
    assert.ok(liveChadiRes.status === 200 || liveChadiRes.status === 502);
    const liveChadiJson: any = await liveChadiRes.json();
    if (liveChadiRes.status === 200) {
      assert.equal(liveChadiJson.ok, true);
      assert.equal(liveChadiJson.platform, 'instagram');
      assert.equal(liveChadiJson.type, 'image');
      assert.equal(liveChadiJson.title, '@chadi.sammou');
      assert.equal(liveChadiJson.author.username, 'chadi.sammou');
      assert.ok(
        liveChadiJson.items[0].url.includes(
          'filename=instagram_chadi.sammou_profile.jpg'
        )
      );
    } else {
      assert.equal(liveChadiJson.error?.code, 'BLOCKED_BY_PLATFORM');
    }

    const liveNonExistentRes = await worker.fetch(
      new Request(
        'https://vidnex.space/api/extract?url=https://www.instagram.com/vidnex_nonexistent_987654321/'
      ),
      adminEnv
    );
    assert.ok(liveNonExistentRes.status === 404 || liveNonExistentRes.status === 502);
    const liveNonExistentJson: any = await liveNonExistentRes.json();
    assert.equal(liveNonExistentJson.ok, false);
    assert.ok(
      liveNonExistentJson.error.code === 'NOT_FOUND' ||
        liveNonExistentJson.error.code === 'BLOCKED_BY_PLATFORM'
    );

    // (8) Vérification du téléchargement via /api/download : streaming JPG, Referer: https://www.instagram.com/, filename="instagram_{username}_profile.jpg"
    const origFetch = globalThis.fetch;
    try {
      let capturedUpstreamReferer = '';
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const u =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        if (u.includes('scontent-cdg4-1.cdninstagram.com/v/t51.2885-19/n4adda_profile.jpg')) {
          const h = new Headers(init?.headers);
          capturedUpstreamReferer = h.get('Referer') || '';
          return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), {
            status: 200,
            headers: {
              'Content-Type': 'image/jpeg',
              'Content-Length': '6',
            },
          });
        }
        return origFetch(input, init);
      };

      const dlRes = await worker.fetch(
        new Request(
          'https://vidnex.space/api/download?url=' +
            encodeURIComponent(
              'https://scontent-cdg4-1.cdninstagram.com/v/t51.2885-19/n4adda_profile.jpg'
            ) +
            '&filename=instagram_n4adda_profile.jpg'
        ),
        adminEnv
      );
      assert.equal(dlRes.status, 200);
      assert.equal(capturedUpstreamReferer, 'https://www.instagram.com/');
      assert.equal(dlRes.headers.get('Content-Type'), 'image/jpeg');
      assert.equal(
        dlRes.headers.get('Content-Disposition'),
        'attachment; filename="instagram_n4adda_profile.jpg"'
      );
      const bytes = new Uint8Array(await dlRes.arrayBuffer());
      assert.equal(bytes[0], 0xff);
      assert.equal(bytes[1], 0xd8);
    } finally {
      globalThis.fetch = origFetch;
    }

    // -------------------------------------------------------------------
    // (7) Vérification Admin Santé des moteurs + Activité (engine_stage & http_status) + stats
    // -------------------------------------------------------------------
    const loginRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://vidnex.space',
          'CF-Connecting-IP': '198.51.100.210',
        },
        body: JSON.stringify({ password: 'super-secret-admin-pwd' }),
      }),
      adminEnv
    );
    const sessionCookie = (loginRes.headers.get('Set-Cookie') || '').split(';')[0];

    const healthGetRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/health', {
        headers: { Cookie: sessionCookie },
      }),
      adminEnv
    );
    assert.equal(healthGetRes.status, 200);
    const healthGetJson: any = await healthGetRes.json();
    assert.ok(healthGetJson.engines.instagram_profile);
    assert.equal(healthGetJson.engines.instagram_profile.test_url, '');

    const activityGetRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/activity?page=1&limit=20', {
        headers: { Cookie: sessionCookie },
      }),
      adminEnv
    );
    assert.equal(activityGetRes.status, 200);
    const activityGetJson: any = await activityGetRes.json();
    assert.equal(activityGetJson.ok, true);
    assert.ok(activityGetJson.items.length >= 1);
    const igProfileSuccessLog = activityGetJson.items.find(
      (it: any) => it.platform === 'instagram_profile' && it.status === 'success'
    );
    assert.equal(igProfileSuccessLog, undefined, 'Successes are aggregated in daily_metrics, not request_log');
    const notFoundLog = activityGetJson.items.find(
      (it: any) =>
        it.platform === 'instagram_profile' &&
        (it.error_code === 'NOT_FOUND' || it.error_code === 'BLOCKED_BY_PLATFORM')
    );
    assert.ok(notFoundLog);
    assert.ok(notFoundLog.engine_stage.length > 0);
    assert.ok(notFoundLog.http_status === 404 || notFoundLog.http_status === 502 || notFoundLog.http_status === 302);
    assert.equal(notFoundLog.content_kind, 'profile');
    assert.equal(notFoundLog.engine_fn, 'instagram.profile');
    assert.equal(notFoundLog.ip_hash.length, 12);
    assert.notEqual(notFoundLog.ip_hash_short, 'anonyme');

    const statsGetRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/stats', {
        headers: { Cookie: sessionCookie },
      }),
      adminEnv
    );
    assert.equal(statsGetRes.status, 200);
    const statsGetJson: any = await statsGetRes.json();
    assert.ok(statsGetJson.platforms.instagram_profile);
    assert.ok(statsGetJson.platforms.instagram_profile.total >= 3);
    assert.ok(statsGetJson.platforms.instagram_profile.success >= 1);
  });

  it('Serves /llms.txt in text/plain with site name, public-only description, main absolute URLs, and 10 languages', async () => {
    const { buildLlmsTxt } = await import('../i18n/config.ts');
    const txt = buildLlmsTxt('https://vidnex.space');
    assert.ok(txt.startsWith('# VIDNEX\n'));
    assert.ok(txt.includes('vidéos publiques'));
    assert.ok(txt.includes('https://vidnex.space/telecharger-video-tiktok'));
    assert.ok(txt.includes('https://vidnex.space/a-propos'));
    assert.ok(txt.includes('https://vidnex.space/en'));
    assert.ok(txt.includes('https://vidnex.space/ar'));

    const res = await worker.fetch(
      new Request('https://vidnex.space/llms.txt'),
      {}
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Content-Type'), 'text/plain; charset=utf-8');
    const body = await res.text();
    assert.equal(body, txt);

    const aiCatalogRes = await worker.fetch(
      new Request('https://vidnex.space/.well-known/ai-catalog.json'),
      {}
    );
    assert.equal(aiCatalogRes.status, 404);

    const ardRes = await worker.fetch(
      new Request('https://vidnex.space/.well-known/ard.json'),
      {}
    );
    assert.equal(ardRes.status, 404);
  });

  it('TikTok audio extraction: detects real mp3 vs m4a format from page JSON, validates observed CDN suffixes, sets filename tiktok_{id}.{ext}, omits audio when absent, and localizes button in 10 languages', async () => {
    const {
      extractTikTokMusicUrl,
      detectTikTokAudioExt,
    } = await import('../../functions/_lib/tiktok.ts');
    const { isAllowedTikTokAudioHost } = await import(
      '../../functions/_lib/allowlist.ts'
    );
    const { SUPPORTED_LOCALES } = await import('../i18n/config.ts');
    const { loadLocaleBundle } = await import('../i18n/localeLoader.ts');

    // 1. Verify observed audio CDN hosts in allowlist
    assert.equal(isAllowedTikTokAudioHost('sf16-music.tiktokcdn-eu.com'), true);
    assert.equal(isAllowedTikTokAudioHost('v45.tiktokcdn-eu.com'), true);
    assert.equal(isAllowedTikTokAudioHost('v16-ies-music.tiktokcdn-us.com'), true);
    assert.equal(isAllowedTikTokAudioHost('sf16-ies-music-sg.tiktokcdn.com'), true);
    assert.equal(isAllowedTikTokAudioHost('sf16-ies-music-va.tiktokcdn.com'), true);
    assert.equal(isAllowedTikTokAudioHost('evil.example.com'), false);
    assert.equal(isAllowedTikTokAudioHost('tiktok.com'), false);

    // 2. Verify real format detection (mp3 vs m4a)
    const m4aUrl =
      'https://v45.tiktokcdn-eu.com/abc/video/tos/maliva/tos-maliva-v-27dcd7c799-us/3b1e/?mime_type=video_mp4';
    const mp3QueryUrl =
      'https://v45.tiktokcdn-eu.com/def/video/tos/useast2a/tos-useast2a-v-27dcd7/e336/?mime_type=audio_mpeg';
    const mp3PathUrl =
      'https://sf16-music.tiktokcdn-eu.com/obj/ies-music-eu2-no/7680158674307812118.mp3';

    assert.equal(detectTikTokAudioExt(m4aUrl, 'audio/x-m4a'), 'm4a');
    assert.equal(detectTikTokAudioExt(m4aUrl, null), 'm4a');
    assert.equal(detectTikTokAudioExt(mp3QueryUrl, 'audio/mpeg'), 'mp3');
    assert.equal(detectTikTokAudioExt(mp3PathUrl, null), 'mp3');

    assert.equal(extractTikTokMusicUrl({ playUrl: m4aUrl }), m4aUrl);
    assert.equal(extractTikTokMusicUrl({ playUrl: '' }), null);
    assert.equal(extractTikTokMusicUrl(undefined), null);

    // 3. Verify /api/extract emits { kind: "audio", quality: "Audio", ext: "m4a" | "mp3" } with filename=tiktok_{id}.{ext}, and omits audio when missing
    resetRateLimitBuckets();
    resetD1RateLimitFallback();
    const origFetch = globalThis.fetch;
    try {
      // Case A: Page JSON has m4a audio (Content-Type: audio/x-m4a)
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const u = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (u.includes('tikwm.com')) {
          return new Response(JSON.stringify({ code: -1 }), { status: 500 });
        }
        if (init?.method === 'HEAD' && u.includes('v45.tiktokcdn-eu.com')) {
          return new Response(null, {
            status: 200,
            headers: { 'content-type': 'audio/x-m4a' },
          });
        }
        const pageJson = {
          __DEFAULT_SCOPE__: {
            'webapp.video-detail': {
              itemInfo: {
                itemStruct: {
                  id: '7106594312292453675',
                  desc: 'Test TikTok M4A Audio',
                  author: { uniqueId: 'tiktok', nickname: 'TikTok' },
                  video: {
                    duration: 24,
                    playAddr: 'https://v45.tiktokcdn-eu.com/video.mp4',
                    cover: 'https://p16-common-sign.tiktokcdn-eu.com/cover.jpeg',
                  },
                  music: {
                    id: '7106594280055130923',
                    title: 'original sound',
                    playUrl: m4aUrl,
                  },
                },
              },
            },
          },
        };
        return new Response(
          `<html><body><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify(pageJson)}</script></body></html>`,
          { status: 200, headers: { 'content-type': 'text/html' } }
        );
      };

      const resM4a = await worker.fetch(
        new Request(
          'https://vidnex.space/api/extract?url=' +
            encodeURIComponent('https://www.tiktok.com/@tiktok/video/7106594312292453675')
        ),
        {}
      );
      assert.equal(resM4a.status, 200);
      const jsonM4a: any = await resM4a.json();
      assert.equal(jsonM4a.ok, true);
      const audioItemM4a = jsonM4a.items.find((it: any) => it.kind === 'audio');
      assert.ok(audioItemM4a);
      assert.equal(audioItemM4a.quality, 'Audio');
      assert.equal(audioItemM4a.ext, 'm4a');
      assert.ok(
        audioItemM4a.url.includes('filename=tiktok_7106594312292453675.m4a'),
        `Expected tiktok_7106594312292453675.m4a in ${audioItemM4a.url}`
      );

      // Case B: Video without recoverable audio -> no audio item emitted
      globalThis.fetch = async (input: RequestInfo | URL) => {
        const u = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (u.includes('tikwm.com')) {
          return new Response(JSON.stringify({ code: -1 }), { status: 500 });
        }
        const pageJsonNoAudio = {
          __DEFAULT_SCOPE__: {
            'webapp.video-detail': {
              itemInfo: {
                itemStruct: {
                  id: '7002287836661337350',
                  desc: 'Silent TikTok Video',
                  author: { uniqueId: 'khaby.lame', nickname: 'Khaby Lame' },
                  video: {
                    duration: 15,
                    playAddr: 'https://v45.tiktokcdn-eu.com/video2.mp4',
                    cover: 'https://p16-common-sign.tiktokcdn-eu.com/cover2.jpeg',
                  },
                  music: {},
                },
              },
            },
          },
        };
        return new Response(
          `<html><body><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify(pageJsonNoAudio)}</script></body></html>`,
          { status: 200, headers: { 'content-type': 'text/html' } }
        );
      };

      const resNoAudio = await worker.fetch(
        new Request(
          'https://vidnex.space/api/extract?url=' +
            encodeURIComponent('https://www.tiktok.com/@khaby.lame/video/7002287836661337350')
        ),
        {}
      );
      assert.equal(resNoAudio.status, 200);
      const jsonNoAudio: any = await resNoAudio.json();
      assert.equal(jsonNoAudio.ok, true);
      const missingAudio = jsonNoAudio.items.find((it: any) => it.kind === 'audio');
      assert.equal(missingAudio, undefined);
    } finally {
      globalThis.fetch = origFetch;
    }

    // 4. Verify all 10 locales have the localized sound download label (and FR is "Télécharger le son")
    for (const loc of SUPPORTED_LOCALES) {
      const bundle = await loadLocaleBundle(loc);
      assert.ok(bundle.ui.drawer.extractAudioMp3.length > 0);
      assert.ok(!bundle.ui.drawer.extractAudioMp3.includes('MP3'));
    }
    const frBundle = await loadLocaleBundle('fr');
    assert.equal(frBundle.ui.drawer.extractAudioMp3, 'Télécharger le son');
  });

  it('Phase 2 (ISSUE 03, 04, 05): inline video preview isolation, www 301 redirect, and redacher64.vidnex.space noindex', async () => {
    const { isPreviewHostRequiringNoindex } = await import(
      '../../functions/_middleware.ts'
    );

    // ISSUE 04: www.vidnex.space -> https://vidnex.space 301 redirect preserving pathname and search
    const wwwRedirectRes = await worker.fetch(
      new Request(
        'https://www.vidnex.space/telecharger-video-tiktok?utm_source=audit&lang=fr'
      ),
      {}
    );
    assert.equal(wwwRedirectRes.status, 301);
    assert.equal(
      wwwRedirectRes.headers.get('Location'),
      'https://vidnex.space/telecharger-video-tiktok?utm_source=audit&lang=fr'
    );

    // Verify no redirect loop on canonical domain vidnex.space
    const canonicalHealthRes = await worker.fetch(
      new Request('https://vidnex.space/api/health'),
      {}
    );
    assert.equal(canonicalHealthRes.status, 200);

    // ISSUE 05: redacher64.vidnex.space has anti-indexing policy (X-Robots-Tag: noindex, nofollow)
    assert.equal(
      isPreviewHostRequiringNoindex('redacher64.vidnex.space', 'https://vidnex.space'),
      true
    );
    assert.equal(
      isPreviewHostRequiringNoindex('vidnex.space', 'https://vidnex.space'),
      false
    );
    assert.equal(
      isPreviewHostRequiringNoindex('www.vidnex.space', 'https://vidnex.space'),
      false
    );

    const redacherRes = await worker.fetch(
      new Request('https://redacher64.vidnex.space/'),
      {
        ASSETS: {
          fetch: async () =>
            new Response('<!doctype html><html><body>OK</body></html>', {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }),
        },
      }
    );
    assert.equal(redacherRes.status, 200);
    assert.equal(redacherRes.headers.get('X-Robots-Tag'), 'noindex, nofollow');

    // ISSUE 03: Video inline preview (inline=1) vs real download (attachment)
    resetRateLimitBuckets();
    resetD1RateLimitFallback();
    const metricEvents: Array<{ platform: string; event: string }> = [];
    const mockDb = {
      prepare(sql: string) {
        return {
          bind(...args: unknown[]) {
            return {
              async run() {
                if (sql.includes('INSERT INTO daily_metrics')) {
                  metricEvents.push({
                    platform: String(args[1]),
                    event: String(args[2]),
                  });
                }
                return { success: true };
              },
              async first() {
                if (sql.includes('SELECT count FROM rate_limits')) {
                  return { count: 1 };
                }
                return null;
              },
              async all() {
                return { results: [] };
              },
            };
          },
        };
      },
    };

    const origFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () =>
        new Response(new Uint8Array([0, 1, 2, 3, 4, 5]), {
          status: 200,
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': '6',
          },
        });

      const targetVideoUrl = 'https://v16-webapp-prime.tiktok.com/video/tos/test.mp4';
      const pendingTasks: Promise<unknown>[] = [];
      const ctx = {
        waitUntil(p: Promise<unknown>) {
          pendingTasks.push(p);
        },
      };

      // 1. Video preview request with inline=1
      const inlineRes = await worker.fetch(
        new Request(
          `https://vidnex.space/api/download?url=${encodeURIComponent(
            targetVideoUrl
          )}&filename=VIDNEX_tiktok_test_1080p.mp4&inline=1`
        ),
        { DB: mockDb as any },
        ctx
      );
      await Promise.all(pendingTasks);
      assert.equal(inlineRes.status, 200);
      assert.equal(
        inlineRes.headers.get('Content-Disposition'),
        'inline; filename="VIDNEX_tiktok_test_1080p.mp4"'
      );
      assert.equal(inlineRes.headers.get('Accept-Ranges'), 'bytes');
      // Video preview MUST NOT trigger download_started or download_success
      assert.equal(metricEvents.length, 0);

      // 2. Subsequent real download request (without inline=1) for the exact same file within the same minute
      const attachmentRes = await worker.fetch(
        new Request(
          `https://vidnex.space/api/download?url=${encodeURIComponent(
            targetVideoUrl
          )}&filename=VIDNEX_tiktok_test_1080p.mp4`
        ),
        { DB: mockDb as any },
        ctx
      );
      await attachmentRes.arrayBuffer();
      await Promise.all(pendingTasks);
      assert.equal(attachmentRes.status, 200);
      assert.equal(
        attachmentRes.headers.get('Content-Disposition'),
        'attachment; filename="VIDNEX_tiktok_test_1080p.mp4"'
      );
      // Real download MUST trigger download_started and download_success
      assert.deepEqual(
        metricEvents.map((m) => m.event),
        ['download_started', 'download_success']
      );
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('MULTILINGUAL BLOG & SEO SYSTEM — 5 published articles (en/fr), es/de drafts, 301 redirects (/en/blog -> /blog), self-referencing canonicals, reciprocal hreflang, and JSON-LD', async () => {
    const {
      resolveRouteFromPathname,
      resolveBlogRedirectPath,
      getAllPublicRoutes,
      getAllBlogPublicRoutes,
      getAllIndexableRoutes,
      SUPPORTED_LOCALES,
    } = await import('../i18n/config.ts');
    const {
      buildBlogHreflangCluster,
      buildHeadMetadataForRoute,
    } = await import('../i18n/hreflang.ts');
    const {
      getPublishedArticlesForLocale,
      getPublishedArticleBySlug,
      getPublishedArticleTranslations,
    } = await import('../data/blogArticles.ts');
    const {
      trackBlogArticleView,
      trackBlogToolCtaClick,
      getBlogAnalyticsHistory,
    } = await import('./blogAnalytics.ts');

    // 0. Supported locales remain strictly identical to pre-blog: fr, en, ar, es, pt, de, tr, id, it, ru
    assert.deepEqual(SUPPORTED_LOCALES, [
      'fr',
      'en',
      'ar',
      'es',
      'pt',
      'de',
      'tr',
      'id',
      'it',
      'ru',
    ]);

    // 1. Existing 75 core routes remain untouched; blog routes add 2 hubs (/blog, /fr/blog) + 11 published article pages (6 EN + 5 FR) = 13 routes -> 88 total
    assert.equal(getAllPublicRoutes().length, 75);
    const blogRoutes = getAllBlogPublicRoutes();
    assert.equal(blogRoutes.length, 13);
    assert.equal(getAllIndexableRoutes().length, 88);

    // 2. Only the 6 specified English articles are published at /blog/{slug}; es and de have 0 published articles
    const enArticles = getPublishedArticlesForLocale('en');
    assert.equal(enArticles.length, 6);
    const expectedEnIds = [
      'troubleshooting-expired-blocked-social-media-links',
      'instagram-reels-carousels-resolution-compression-guide',
      'tiktok-audio-tracks-mp3-vs-m4a-aac-guide',
      'why-is-downloaded-video-low-quality',
      'save-public-tiktok-videos-without-watermark-guide',
      'download-public-instagram-reels-carousels-guide',
    ];
    assert.deepEqual(
      enArticles.map((a) => a.article.id),
      expectedEnIds
    );
    assert.equal(getPublishedArticlesForLocale('es').length, 0);
    assert.equal(getPublishedArticlesForLocale('de').length, 0);
    assert.equal(getPublishedArticlesForLocale('fr').length, 5);

    // 3. English default blog hub (/blog) is 200; /en/blog and /en/blog/{slug} are 301 redirects (no longer 200 aliases)
    const resBlogEn = resolveRouteFromPathname('/blog');
    assert.equal(resBlogEn.isValidRoute, true);
    assert.equal(resBlogEn.locale, 'en');
    assert.equal(resBlogEn.pageKey, 'blog');
    assert.equal(resBlogEn.canonicalPath, '/blog');

    const resBlogEnAlias = resolveRouteFromPathname('/en/blog');
    assert.equal(resBlogEnAlias.isValidRoute, false);
    assert.equal(resBlogEnAlias.isNotFound, true);
    assert.equal(resolveBlogRedirectPath('/en/blog'), '/blog');
    assert.equal(
      resolveBlogRedirectPath(
        '/en/blog/save-public-tiktok-videos-without-watermark-guide'
      ),
      '/blog/save-public-tiktok-videos-without-watermark-guide'
    );

    const redirectHubRes = await worker.fetch(
      new Request('https://vidnex.space/en/blog')
    );
    assert.equal(redirectHubRes.status, 301);
    assert.equal(
      redirectHubRes.headers.get('Location'),
      'https://vidnex.space/blog'
    );

    const redirectArtRes = await worker.fetch(
      new Request(
        'https://vidnex.space/en/blog/why-is-downloaded-video-low-quality'
      )
    );
    assert.equal(redirectArtRes.status, 301);
    assert.equal(
      redirectArtRes.headers.get('Location'),
      'https://vidnex.space/blog/why-is-downloaded-video-low-quality'
    );

    // 4. Localized blog hub (/fr/blog) vs draft/unpublished blog hubs (/es/blog, /de/blog, /ar/blog -> 404)
    const resBlogFr = resolveRouteFromPathname('/fr/blog');
    assert.equal(resBlogFr.isValidRoute, true);
    assert.equal(resBlogFr.locale, 'fr');
    assert.equal(resBlogFr.pageKey, 'blog');
    assert.equal(resBlogFr.canonicalPath, '/fr/blog');

    assert.equal(resolveRouteFromPathname('/es/blog').isNotFound, true);
    assert.equal(resolveRouteFromPathname('/de/blog').isNotFound, true);
    assert.equal(resolveRouteFromPathname('/ar/blog').isNotFound, true);

    // 5. Localized article slugs & self-referencing canonicals (never canonicalized to English)
    const resArtFr = resolveRouteFromPathname(
      '/fr/blog/telecharger-video-tiktok-probleme'
    );
    assert.equal(resArtFr.isValidRoute, true);
    assert.equal(resArtFr.locale, 'fr');
    assert.equal(resArtFr.pageKey, 'blog_article');
    assert.equal(
      resArtFr.blogArticleId,
      'troubleshooting-expired-blocked-social-media-links'
    );
    assert.equal(
      resArtFr.canonicalPath,
      '/fr/blog/telecharger-video-tiktok-probleme'
    );

    const headArtFr = buildHeadMetadataForRoute(
      'fr',
      'blog_article',
      'telecharger-video-tiktok-probleme'
    );
    assert.equal(
      headArtFr.canonicalUrl,
      'https://vidnex.space/fr/blog/telecharger-video-tiktok-probleme'
    );
    assert.equal(headArtFr.lang, 'fr');

    // 6. Draft articles & draft translations are strictly excluded (404, not in hreflang, not in routes)
    const draftArtRes = resolveRouteFromPathname(
      '/blog/how-to-download-x-videos'
    );
    assert.equal(draftArtRes.isNotFound, true);
    assert.equal(
      getPublishedArticleBySlug('en', 'how-to-download-x-videos'),
      null
    );

    // 'why-is-downloaded-video-low-quality' is published in EN but 'draft' in FR => no hreflang="fr"
    const draftTransRes = resolveRouteFromPathname(
      '/fr/blog/pourquoi-video-telechargee-basse-qualite'
    );
    assert.equal(draftTransRes.isNotFound, true);
    const art7Translations = getPublishedArticleTranslations(
      'why-is-downloaded-video-low-quality'
    );
    assert.deepEqual(
      art7Translations.map((t) => t.locale),
      ['en']
    );
    const art7Hreflangs = buildBlogHreflangCluster(
      'blog_article',
      'why-is-downloaded-video-low-quality'
    );
    assert.deepEqual(
      art7Hreflangs.map((h) => h.hreflang),
      ['en', 'x-default']
    );

    // 7. 'troubleshooting-expired-blocked-social-media-links' has 2 published translations (en, fr) + x-default
    const art1Hreflangs = buildBlogHreflangCluster(
      'blog_article',
      'troubleshooting-expired-blocked-social-media-links'
    );
    assert.equal(art1Hreflangs.length, 3);
    assert.equal(
      art1Hreflangs.find((h) => h.hreflang === 'en')?.href,
      'https://vidnex.space/blog/troubleshooting-expired-blocked-social-media-links'
    );
    assert.equal(
      art1Hreflangs.find((h) => h.hreflang === 'fr')?.href,
      'https://vidnex.space/fr/blog/telecharger-video-tiktok-probleme'
    );
    assert.equal(
      art1Hreflangs.find((h) => h.hreflang === 'x-default')?.href,
      'https://vidnex.space/blog/troubleshooting-expired-blocked-social-media-links'
    );

    // 8. Verify Schema.org JSON-LD graph on blog article (BlogPosting + BreadcrumbList + FAQPage)
    const graphItems = (headArtFr.jsonLdGraph as any)['@graph'] as Array<
      Record<string, any>
    >;
    assert.equal(graphItems.length, 3);
    assert.equal(graphItems[0]['@type'], 'BlogPosting');
    assert.equal(graphItems[0].author.name, 'VIDNEX');
    assert.equal(graphItems[1]['@type'], 'BreadcrumbList');
    assert.equal(graphItems[2]['@type'], 'FAQPage');

    // 9. Verify blog analytics tracking
    trackBlogArticleView(
      'en',
      'troubleshooting-expired-blocked-social-media-links',
      'troubleshooting-expired-blocked-social-media-links',
      'troubleshooting'
    );
    trackBlogToolCtaClick(
      'en',
      'troubleshooting-expired-blocked-social-media-links',
      '/en/tiktok-video-downloader'
    );
    const history = getBlogAnalyticsHistory();
    assert.ok(history.length >= 2);
    assert.equal(history[history.length - 1].type, 'blog_tool_cta_click');
  });

  it('Gère le réglage allow_third_party (extraction directe uniquement + refus allowlist /api/download) et distingue les succès direct vs tiers sur 7 jours sans URL en base', async () => {
    const { isAllowedMediaHost, isAllowedMediaUrl } = await import(
      '../../functions/_lib/allowlist.ts'
    );
    const { getSystemSettings, updateSystemSettings } = await import(
      '../../functions/_lib/settings.ts'
    );
    const { logExtractionEvent } = await import('../../functions/_lib/logger.ts');

    const db = createMemoryD1Database();
    const adminEnv = {
      DB: db,
      ADMIN_PASSWORD: 'super-secret-admin-pwd',
      SESSION_SECRET: 'hmac-session-secret-key-2026',
      IP_HASH_SALT: 'ip-salt-2026',
    };

    // 1. Par défaut allow_third_party est activé (true)
    const initialSettings = await getSystemSettings(adminEnv);
    assert.equal(initialSettings.allow_third_party, true);
    assert.equal(isAllowedMediaHost('www.tikwm.com', true), true);
    assert.equal(isAllowedMediaHost('d.ddinstagram.com', true), true);
    assert.equal(isAllowedMediaHost('api.vxinstagram.com', true), true);

    // 2. Quand allow_third_party = false, l'allowlist refuse tikwm.com, vxinstagram.com et ddinstagram.com
    assert.equal(isAllowedMediaHost('www.tikwm.com', false), false);
    assert.equal(isAllowedMediaHost('tikwm.com', false), false);
    assert.equal(isAllowedMediaHost('d.ddinstagram.com', false), false);
    assert.equal(isAllowedMediaHost('api.vxinstagram.com', false), false);
    assert.equal(
      isAllowedMediaUrl('https://www.tikwm.com/video/media/hdplay/123.mp4', false),
      false
    );
    // Les CDN officiels restent autorisés
    assert.equal(isAllowedMediaHost('v16-webapp-prime.tiktok.com', false), true);
    assert.equal(isAllowedMediaHost('scontent.cdninstagram.com', false), true);

    // 3. Désactivation dynamique via updateSystemSettings (sans redéploiement)
    await updateSystemSettings(adminEnv, { allow_third_party: false });
    const updatedSettings = await getSystemSettings(adminEnv);
    assert.equal(updatedSettings.allow_third_party, false);

    // 4. /api/download refuse immédiatement ces hôtes tiers en 403 quand allow_third_party = false
    for (const blockedUrl of [
      'https://www.tikwm.com/video/media/hdplay/7123456789.mp4',
      'https://d.ddinstagram.com/reel/C8x9kLmN2pQ.mp4',
      'https://api.vxinstagram.com/reel/C8x9kLmN2pQ.mp4',
    ]) {
      const dlRes = await worker.fetch(
        new Request(
          `https://vidnex.space/api/download?url=${encodeURIComponent(blockedUrl)}`
        ),
        adminEnv
      );
      assert.equal(dlRes.status, 403);
    }

    // 4b. Vérifier qu'aucun appel vers tikwm.com, vxinstagram.com ou ddinstagram.com n'est émis quand allow_third_party = false
    const calledHosts: string[] = [];
    const origFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (input: RequestInfo | URL) => {
        const u =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        calledHosts.push(new URL(u).hostname);
        return new Response('<html></html>', { status: 403 });
      };

      await worker.fetch(
        new Request(
          'https://vidnex.space/api/extract?url=https://www.tiktok.com/@tiktok/video/7106594312292453675'
        ),
        adminEnv
      );
      await worker.fetch(
        new Request(
          'https://vidnex.space/api/extract?url=https://www.instagram.com/reel/C8x9kLmN2pQ/'
        ),
        adminEnv
      );
    } finally {
      globalThis.fetch = origFetch;
    }
    assert.equal(
      calledHosts.some(
        (h) =>
          h.includes('tikwm.com') ||
          h.includes('vxinstagram.com') ||
          h.includes('ddinstagram.com')
      ),
      false
    );

    // 5. Enregistrement des compteurs direct vs tiers pour TikTok et Instagram + absence totale d'URL dans les logs
    await logExtractionEvent(adminEnv, {
      platform: 'tiktok',
      status: 'success',
      errorCode: null,
      stage: 'direct',
      durationMs: 120,
      ipHash: 'hash_tt_1',
      country: 'FR',
    });
    await logExtractionEvent(adminEnv, {
      platform: 'tiktok',
      status: 'success',
      errorCode: null,
      stage: 'tiers',
      durationMs: 180,
      ipHash: 'hash_tt_2',
      country: 'FR',
    });
    await logExtractionEvent(adminEnv, {
      platform: 'tiktok',
      status: 'success',
      errorCode: null,
      stage: 'tiers',
      durationMs: 195,
      ipHash: 'hash_tt_3',
      country: 'FR',
    });
    await logExtractionEvent(adminEnv, {
      platform: 'instagram',
      status: 'success',
      errorCode: null,
      stage: 'direct',
      durationMs: 140,
      ipHash: 'hash_ig_1',
      country: 'FR',
    });
    await logExtractionEvent(adminEnv, {
      platform: 'instagram',
      status: 'success',
      errorCode: null,
      stage: 'tiers',
      durationMs: 250,
      ipHash: 'hash_ig_2',
      country: 'FR',
    });

    // Connexion admin pour lire /api/admin/stats
    const loginRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://vidnex.space',
          'CF-Connecting-IP': '198.51.100.250',
        },
        body: JSON.stringify({ password: 'super-secret-admin-pwd' }),
      }),
      adminEnv
    );
    assert.equal(loginRes.status, 200);
    const cookie = (loginRes.headers.get('Set-Cookie') || '').split(';')[0];

    const statsRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/stats', {
        headers: { Cookie: cookie },
      }),
      adminEnv
    );
    assert.equal(statsRes.status, 200);
    const statsJson: any = await statsRes.json();

    assert.equal(statsJson.platforms.tiktok.direct, 1);
    assert.equal(statsJson.platforms.tiktok.tiers, 2);
    assert.equal(statsJson.platforms.tiktok.direct7d, 1);
    assert.equal(statsJson.platforms.tiktok.tiers7d, 2);
    assert.equal(statsJson.platforms.tiktok.thirdPartyRate7d, 66.7);
    assert.equal(statsJson.platforms.tiktok.stage.thirdPartyRate7d, 66.7);

    assert.equal(statsJson.platforms.instagram.direct, 1);
    assert.equal(statsJson.platforms.instagram.tiers, 1);
    assert.equal(statsJson.platforms.instagram.direct7d, 1);
    assert.equal(statsJson.platforms.instagram.tiers7d, 1);
    assert.equal(statsJson.platforms.instagram.thirdPartyRate7d, 50);
  });

  it('STORIES INSTAGRAM & FACEBOOK vs REELS — Détection stricte avant Reels (6+ URL + liens courts redirigés), moteur story avec/sans IG_SESSION_ID, journal admin content_kind story/highlight et messages en 10 langues', async () => {
    const {
      detectUrl: detectBackendUrl,
      resolveAndDetectUrl,
      classifyUrlForLog,
    } = await import('../../functions/_lib/detect.ts');
    const {
      extractInstagram,
      IG_STORY_LOGIN_REQUIRED_MESSAGE,
    } = await import('../../functions/_lib/instagram.ts');
    const {
      extractFacebook,
      FB_STORY_LOGIN_REQUIRED_MESSAGE,
    } = await import('../../functions/_lib/facebook.ts');
    const {
      getLocalizedErrorMessage,
      STORY_ERROR_MESSAGES,
    } = await import('../services/extractorService.ts');

    // 1. Les 6 URLs de référence + variantes Facebook story.php : aucune story ne doit jamais être classée "reel"
    const igStoryUrl = 'https://www.instagram.com/stories/natgeo/3399123456789012345/';
    const igHighlightUrl = 'https://www.instagram.com/stories/highlights/17895485201104054/';
    const fbStoryPathUrl = 'https://www.facebook.com/stories/10293847561029384/';
    const fbStoryPhpUrl = 'https://www.facebook.com/story.php?story_fbid=99887766554433&id=1000445566';
    const igReelUrl = 'https://www.instagram.com/reel/C8x9kLmN2pQ/';
    const fbReelUrl = 'https://www.facebook.com/reel/123456789012345/';
    const igPostUrl = 'https://www.instagram.com/p/C8x9kLmN2pQ/';

    const dIgStory = detectBackendUrl(igStoryUrl);
    assert.equal(dIgStory.isValid, true);
    assert.equal(dIgStory.platform, 'instagram');
    assert.equal(dIgStory.kind, 'story');
    assert.equal(dIgStory.contentKind, 'story');
    assert.equal(dIgStory.content_kind, 'story');
    assert.notEqual(dIgStory.kind, 'reel');
    assert.equal(classifyUrlForLog(igStoryUrl).contentKind, 'story');
    assert.equal(detectMediaUrl(igStoryUrl).mediaType, 'story');

    const dIgHighlight = detectBackendUrl(igHighlightUrl);
    assert.equal(dIgHighlight.isValid, true);
    assert.equal(dIgHighlight.platform, 'instagram');
    assert.equal(dIgHighlight.kind, 'highlight');
    assert.equal(dIgHighlight.contentKind, 'highlight');
    assert.equal(dIgHighlight.content_kind, 'highlight');
    assert.notEqual(dIgHighlight.kind, 'reel');
    assert.equal(classifyUrlForLog(igHighlightUrl).contentKind, 'highlight');
    assert.equal(detectMediaUrl(igHighlightUrl).mediaType, 'highlight');

    const dFbStoryPath = detectBackendUrl(fbStoryPathUrl);
    assert.equal(dFbStoryPath.isValid, true);
    assert.equal(dFbStoryPath.platform, 'facebook');
    assert.equal(dFbStoryPath.kind, 'story');
    assert.equal(dFbStoryPath.contentKind, 'story');
    assert.notEqual(dFbStoryPath.kind, 'reel');
    assert.equal(classifyUrlForLog(fbStoryPathUrl).contentKind, 'story');
    assert.equal(detectMediaUrl(fbStoryPathUrl).mediaType, 'story');

    const dFbStoryPhp = detectBackendUrl(fbStoryPhpUrl);
    assert.equal(dFbStoryPhp.isValid, true);
    assert.equal(dFbStoryPhp.platform, 'facebook');
    assert.equal(dFbStoryPhp.kind, 'story');
    assert.equal(dFbStoryPhp.contentKind, 'story');
    assert.notEqual(dFbStoryPhp.kind, 'reel');
    assert.equal(classifyUrlForLog(fbStoryPhpUrl).contentKind, 'story');
    assert.equal(detectMediaUrl(fbStoryPhpUrl).mediaType, 'story');

    const dIgReel = detectBackendUrl(igReelUrl);
    assert.equal(dIgReel.isValid, true);
    assert.equal(dIgReel.platform, 'instagram');
    assert.equal(dIgReel.kind, 'reel');
    assert.equal(dIgReel.contentKind, 'reel');

    const dFbReel = detectBackendUrl(fbReelUrl);
    assert.equal(dFbReel.isValid, true);
    assert.equal(dFbReel.platform, 'facebook');
    assert.equal(dFbReel.kind, 'reel');
    assert.equal(dFbReel.contentKind, 'reel');

    const dIgPost = detectBackendUrl(igPostUrl);
    assert.equal(dIgPost.isValid, true);
    assert.equal(dIgPost.platform, 'instagram');
    assert.equal(dIgPost.kind, 'post');
    assert.equal(dIgPost.contentKind, 'carousel');
    assert.notEqual(dIgPost.kind, 'reel');

    // 2. Liens courts ou de partage redirigeant vers /stories/ -> suivent la redirection puis reclassent en "story"
    const redirectedFbStory = await resolveAndDetectUrl(
      'https://www.facebook.com/share/r/1StoryShort/',
      'facebook',
      async () =>
        new Response(null, {
          status: 302,
          headers: {
            Location: 'https://www.facebook.com/stories/10293847561029384/',
          },
        })
    );
    assert.equal(redirectedFbStory.isValid, true);
    assert.equal(redirectedFbStory.platform, 'facebook');
    assert.equal(redirectedFbStory.kind, 'story');
    assert.equal(redirectedFbStory.contentKind, 'story');
    assert.notEqual(redirectedFbStory.kind, 'reel');

    const redirectedIgStory = await resolveAndDetectUrl(
      'https://www.instagram.com/share/reel/BAStoryShort/',
      'instagram',
      async () =>
        new Response(null, {
          status: 302,
          headers: {
            Location: 'https://www.instagram.com/stories/natgeo/3399123456789012345/',
          },
        })
    );
    assert.equal(redirectedIgStory.isValid, true);
    assert.equal(redirectedIgStory.platform, 'instagram');
    assert.equal(redirectedIgStory.kind, 'story');
    assert.equal(redirectedIgStory.contentKind, 'story');
    assert.notEqual(redirectedIgStory.kind, 'reel');

    // Liens courts Instagram Highlight (/s/base64) et login redirect (?next=/stories/...)
    const igHighlightShortUrl = 'https://www.instagram.com/s/aGlnaGxpZ2h0OjE3ODk1NDg1MjAxMTA0MDU0?story_media_id=3399123456789012345';
    const dIgHighlightShort = detectBackendUrl(igHighlightShortUrl);
    assert.equal(dIgHighlightShort.isValid, true);
    assert.equal(dIgHighlightShort.kind, 'highlight');
    assert.equal(dIgHighlightShort.contentKind, 'highlight');
    assert.notEqual(dIgHighlightShort.kind, 'reel');

    const redirectedIgLoginStory = await resolveAndDetectUrl(
      'https://www.instagram.com/share/BAStoryLoginRedirect/',
      'instagram',
      async () =>
        new Response(null, {
          status: 302,
          headers: {
            Location: 'https://www.instagram.com/accounts/login/?next=%2Fstories%2Fnatgeo%2F3399123456789012345%2F',
          },
        })
    );
    assert.equal(redirectedIgLoginStory.isValid, true);
    assert.equal(redirectedIgLoginStory.kind, 'story');
    assert.equal(redirectedIgLoginStory.contentKind, 'story');
    assert.notEqual(redirectedIgLoginStory.kind, 'reel');
    assert.equal(redirectedIgLoginStory.isLoginRedirect, true);

    const dFbShareStory = detectBackendUrl('https://www.facebook.com/share/s/1AbCdEfGhI/');
    assert.equal(dFbShareStory.isValid, true);
    assert.equal(dFbShareStory.kind, 'story');
    assert.equal(dFbShareStory.contentKind, 'story');
    assert.equal(dFbShareStory.isShortLink, true);
    assert.notEqual(dFbShareStory.kind, 'reel');

    // 3. Moteur Instagram Story sans IG_SESSION_ID : PRIVATE_OR_LOGIN_REQUIRED immédiat, 0 appel réseau Reels/Embed
    let igNetworkCallsWithoutSession = 0;
    const igNoSessionRes = await extractInstagram(
      'natgeo/3399123456789012345',
      {},
      'story',
      async () => {
        igNetworkCallsWithoutSession++;
        return new Response('should not be called', { status: 500 });
      }
    );
    assert.equal(igNoSessionRes.ok, false);
    assert.equal(igNoSessionRes.error?.code, 'PRIVATE_OR_LOGIN_REQUIRED');
    assert.equal(igNoSessionRes.error?.message, IG_STORY_LOGIN_REQUIRED_MESSAGE);
    assert.equal(igNoSessionRes.contentKind, 'story');
    assert.equal(igNoSessionRes.engineFn, 'instagram.story');
    assert.equal(igNetworkCallsWithoutSession, 0);

    // 4. Moteur Instagram Story avec IG_SESSION_ID défini : utilise le moteur story authentifié
    const igWithSessionRes = await extractInstagram(
      'natgeo/3399123456789012345',
      { IG_SESSION_ID: '12345678%3Avalid_session_token%3A28' },
      'story',
      async (input) => {
        const reqUrl = typeof input === 'string' ? input : input.toString();
        if (reqUrl.includes('/api/v1/media/3399123456789012345/info/')) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  pk: '3399123456789012345',
                  id: '3399123456789012345_12345',
                  media_type: 2,
                  user: { username: 'natgeo', full_name: 'National Geographic' },
                  image_versions2: {
                    candidates: [
                      {
                        url: 'https://scontent.cdninstagram.com/v/t51.2885-15/story_thumb.jpg',
                        width: 1080,
                        height: 1920,
                      },
                    ],
                  },
                  video_versions: [
                    {
                      url: 'https://scontent.cdninstagram.com/v/t50.2886-16/story_hd.mp4',
                      width: 1080,
                      height: 1920,
                    },
                  ],
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('not found', { status: 404 });
      }
    );
    assert.equal(igWithSessionRes.ok, true);
    assert.equal(igWithSessionRes.contentKind, 'story');
    assert.equal(igWithSessionRes.engineFn, 'instagram.story');
    assert.ok((igWithSessionRes.items?.length || 0) >= 1);
    assert.equal(igWithSessionRes.items?.[0].kind, 'video');

    // 5. Moteur Facebook Story : PRIVATE_OR_LOGIN_REQUIRED immédiat avec message équivalent, jamais le moteur Reels
    const fbStoryRes = await extractFacebook(fbStoryPathUrl, '10293847561029384');
    assert.equal(fbStoryRes.ok, false);
    assert.equal(fbStoryRes.error?.code, 'PRIVATE_OR_LOGIN_REQUIRED');
    assert.equal(fbStoryRes.error?.message, FB_STORY_LOGIN_REQUIRED_MESSAGE);
    assert.equal(fbStoryRes.contentKind, 'story');
    assert.equal(fbStoryRes.engineFn, 'facebook.story');

    // 6. Journal admin (/api/extract -> request_log) : enregistre bien content_kind "story" et "highlight"
    resetRateLimitBuckets();
    resetD1RateLimitFallback();
    const db = createMemoryD1Database();
    const adminEnv = {
      DB: db,
      ADMIN_PASSWORD: 'super-secret-admin-pwd',
      SESSION_SECRET: 'hmac-session-secret-key-2026',
      IP_HASH_SALT: 'ip-salt-2026',
    };

    const igStoryApiRes = await worker.fetch(
      new Request(
        `https://vidnex.space/api/extract?url=${encodeURIComponent(igStoryUrl)}`
      ),
      adminEnv
    );
    assert.equal(igStoryApiRes.status, 403);
    const igStoryApiJson: any = await igStoryApiRes.json();
    assert.equal(igStoryApiJson.error?.code, 'PRIVATE_OR_LOGIN_REQUIRED');
    assert.equal(igStoryApiJson.error?.message, IG_STORY_LOGIN_REQUIRED_MESSAGE);

    const igHighlightApiRes = await worker.fetch(
      new Request(
        `https://vidnex.space/api/extract?url=${encodeURIComponent(igHighlightUrl)}`
      ),
      adminEnv
    );
    assert.equal(igHighlightApiRes.status, 403);

    const fbStoryApiRes = await worker.fetch(
      new Request(
        `https://vidnex.space/api/extract?url=${encodeURIComponent(fbStoryPhpUrl)}`
      ),
      adminEnv
    );
    assert.equal(fbStoryApiRes.status, 403);
    const fbStoryApiJson: any = await fbStoryApiRes.json();
    assert.equal(fbStoryApiJson.error?.code, 'PRIVATE_OR_LOGIN_REQUIRED');
    assert.equal(fbStoryApiJson.error?.message, FB_STORY_LOGIN_REQUIRED_MESSAGE);

    const logRows = await db
      .prepare('SELECT id, ts, platform, status, error_code, duration_ms, ip_hash, engine_stage, http_status, content_kind, engine_fn FROM request_log ORDER BY ts DESC, id DESC LIMIT ? OFFSET ?')
      .bind(20, 0)
      .all<{ content_kind?: string | null }>();
    const loggedKinds = (logRows.results || []).map((r) => r.content_kind);
    assert.ok(loggedKinds.includes('story'));
    assert.ok(loggedKinds.includes('highlight'));
    assert.ok(!loggedKinds.includes('reel'));

    // 7. Messages localisés dans les 10 langues
    const locales = ['fr', 'en', 'ar', 'es', 'pt', 'de', 'tr', 'id', 'it', 'ru'] as const;
    for (const loc of locales) {
      const igMsg = getLocalizedErrorMessage('PRIVATE_OR_LOGIN_REQUIRED', loc, {
        isStory: true,
        platform: 'instagram',
      });
      const fbMsg = getLocalizedErrorMessage('PRIVATE_OR_LOGIN_REQUIRED', loc, {
        isStory: true,
        platform: 'facebook',
      });
      assert.equal(igMsg, STORY_ERROR_MESSAGES[loc].instagram);
      assert.equal(fbMsg, STORY_ERROR_MESSAGES[loc].facebook);
      assert.ok(igMsg.length > 15);
      assert.ok(fbMsg.length > 15);
    }
  });

  it('Blog CMS Phase 1: restricted Markdown, shared SEO validation, RBAC permissions (403 without perm, never published without blog.publish), 10-revision cap, owner import without duplicates, and 301 slug redirects', async () => {
    const {
      parseRestrictedBlogMarkdown,
      sectionsToRestrictedMarkdown,
      validateBlogTranslationInput,
      validateStaticBlogRepository,
    } = await import('./blogValidation.ts');
    const { BLOG_ARTICLES } = await import('../data/blogArticles.ts');
    const {
      ADMIN_COOKIE_NAME,
      createSignedSessionToken,
      hashPasswordPbkdf2,
    } = await import('../../functions/_lib/auth.ts');
    const { ensureD1Schema } = await import('../../functions/_lib/db.ts');

    // 1. Validation du dépôt statique existant (commun au build verify-seo.mjs)
    const repoCheck = validateStaticBlogRepository(BLOG_ARTICLES);
    assert.equal(repoCheck.valid, true, `Erreurs repo statique: ${JSON.stringify(repoCheck.errors)}`);

    // 2. Markdown restreint : H2, H3, paragraphes, listes, tableaux, liens HTTPS (rel="noopener noreferrer") et bloc conseil
    const validMd = [
      '## Première section de téléchargement',
      '',
      'Ce paragraphe explique comment sauvegarder une vidéo avec [Documentation Cloudflare](https://developers.cloudflare.com/workers/) et un lien interne [Outil TikTok](/telecharger-video-tiktok).',
      '',
      '- Premier point de contrôle qualité',
      '- Deuxième point sans filigrane',
      '',
      '### Sous-section comparatif des formats',
      '',
      '| Format | Qualité | Audio |',
      '| --- | --- | --- |',
      '| MP4 | 1080p HD | Inclus |',
      '| M4A | Original | Stéréo |',
      '',
      ':::conseil',
      'Vérifiez toujours que la publication est publique avant de lancer le téléchargement.',
      ':::',
    ].join('\n');

    const parsedMd = parseRestrictedBlogMarkdown(validMd);
    assert.equal(parsedMd.errors.length, 0);
    assert.equal(parsedMd.sections.length, 1);
    assert.equal(parsedMd.tableOfContents.length, 1);
    assert.equal(parsedMd.sections[0].heading, 'Première section de téléchargement');
    assert.equal(parsedMd.sections[0].bullets?.length, 2);
    assert.equal(parsedMd.sections[0].subSections?.length, 1);
    assert.equal(parsedMd.sections[0].subSections?.[0].table?.headers.length, 3);
    assert.equal(parsedMd.sections[0].subSections?.[0].table?.rows.length, 2);
    assert.equal(
      parsedMd.sections[0].subSections?.[0].callout,
      'Vérifiez toujours que la publication est publique avant de lancer le téléchargement.'
    );
    assert.equal(parsedMd.externalLinks.length, 1);
    assert.equal(parsedMd.externalLinks[0].rel, 'noopener noreferrer');
    assert.equal(parsedMd.externalLinks[0].target, '_blank');

    // Round-trip sections -> Markdown restreint -> sections
    const roundTripMd = sectionsToRestrictedMarkdown(parsedMd.sections);
    const reparsed = parseRestrictedBlogMarkdown(roundTripMd);
    assert.equal(reparsed.errors.length, 0);
    assert.equal(reparsed.sections[0].heading, 'Première section de téléchargement');

    // Rejet du HTML brut, du H1 dans le corps et des liens externes non-HTTPS
    const htmlMd = '## Section\n\nParagraphe avec <script>alert(1)</script> interdit.';
    const htmlParsed = parseRestrictedBlogMarkdown(htmlMd);
    assert.ok(htmlParsed.errors.some((e) => e.code === 'RAW_HTML_FORBIDDEN'));

    const h1Md = '# Titre H1 interdit\n\n## Section valide\n\nTexte.';
    const h1Parsed = parseRestrictedBlogMarkdown(h1Md);
    assert.ok(h1Parsed.errors.some((e) => e.code === 'H1_FORBIDDEN_IN_BODY'));

    const httpLinkMd = '## Section\n\nLien non sécurisé [Site](http://example.com/page).';
    const httpParsed = parseRestrictedBlogMarkdown(httpLinkMd);
    assert.ok(
      httpParsed.errors.some((e) => e.code === 'EXTERNAL_LINK_MUST_BE_HTTPS')
    );

    // 3. Validation commune (erreurs bloquantes vs avertissements non bloquants)
    const invalidInputCheck = validateBlogTranslationInput({
      locale: 'fr',
      slug: 'guide-tiktok-2026', // Année interdite dans le slug
      title: 'Guide TikTok',
      excerpt: 'Résumé court mais valide pour tester la validation.',
      metaTitle: 'Ce metaTitle dépasse volontairement la limite stricte de soixante caractères autorisés',
      metaDescription: 'Trop courte.',
      bodyMarkdown: validMd,
      existingSlugsInLocale: ['slug-deja-pris'],
    });
    assert.equal(invalidInputCheck.valid, false);
    assert.ok(
      invalidInputCheck.errors.some((e) => e.code === 'SLUG_CONTAINS_YEAR')
    );
    assert.ok(
      invalidInputCheck.errors.some((e) => e.code === 'META_TITLE_TOO_LONG')
    );
    assert.ok(
      invalidInputCheck.errors.some(
        (e) => e.code === 'META_DESCRIPTION_LENGTH_INVALID'
      )
    );

    const duplicateSlugCheck = validateBlogTranslationInput({
      locale: 'fr',
      slug: 'slug-deja-pris',
      title: 'Guide TikTok',
      excerpt: 'Résumé valide.',
      metaTitle: 'Guide TikTok complet sans filigrane | VIDNEX',
      metaDescription:
        'Découvrez comment télécharger une vidéo TikTok publique en MP4 HD sans filigrane rapidement et en toute sécurité depuis votre navigateur.',
      bodyMarkdown: validMd,
      existingSlugsInLocale: ['slug-deja-pris'],
    });
    assert.equal(duplicateSlugCheck.valid, false);
    assert.ok(
      duplicateSlugCheck.errors.some(
        (e) => e.code === 'SLUG_NOT_UNIQUE_IN_LOCALE'
      )
    );

    // Avertissements non bloquants (longueur < 250 mots, FAQ absente, sources absentes)
    const validWithWarnings = validateBlogTranslationInput({
      locale: 'fr',
      slug: 'guide-test-validation-propre',
      title: 'Guide de test validation propre',
      excerpt: 'Un extrait clair pour tester les avertissements non bloquants.',
      metaTitle: 'Guide de test validation propre | VIDNEX',
      metaDescription:
        'Découvrez comment valider un article de blog VIDNEX avec un titre SEO court, une description calibrée et un contenu Markdown restreint.',
      bodyMarkdown: validMd,
      existingSlugsInLocale: [],
    });
    assert.equal(validWithWarnings.valid, true);
    assert.equal(validWithWarnings.errors.length, 0);
    assert.ok(
      validWithWarnings.warnings.some((w) => w.code === 'SHORT_WORD_COUNT')
    );
    assert.ok(validWithWarnings.warnings.some((w) => w.code === 'MISSING_FAQ'));
    assert.ok(
      validWithWarnings.warnings.some((w) => w.code === 'MISSING_SOURCES')
    );

    // 4. Tests d'intégration de l'API protégée /api/admin/blog
    const db = createMemoryD1Database();
    await ensureD1Schema(db);
    const sessionSecret = 'blog-cms-test-secret-2026-hmac';
    const env = {
      DB: db,
      ADMIN_PASSWORD: 'owner-master-password-2026',
      SESSION_SECRET: sessionSecret,
      IP_HASH_SALT: 'salt-2026',
    };

    const pwdHash = await hashPasswordPbkdf2('ValidUserPass!2026');

    // Créer 4 profils en base : observateur (sans blog.*), redacteur (blog.write), editeur (blog.write, blog.edit_all, blog.delete), publieur (blog.write, blog.publish)
    await db
      .prepare(
        `INSERT INTO users (login, display_name, role_label, password_hash, must_change_password, active, permissions, session_version, failed_attempts, locked_until, created_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, NULL)`
      )
      .bind(
        'observateur1',
        'Observateur Un',
        'Observateur',
        pwdHash,
        0,
        1,
        JSON.stringify(['dashboard.view']),
        1,
        Date.now()
      )
      .run();

    await db
      .prepare(
        `INSERT INTO users (login, display_name, role_label, password_hash, must_change_password, active, permissions, session_version, failed_attempts, locked_until, created_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, NULL)`
      )
      .bind(
        'redacteur1',
        'Rédacteur Un',
        'Rédacteur blog',
        pwdHash,
        0,
        1,
        JSON.stringify(['blog.write']),
        1,
        Date.now()
      )
      .run();

    await db
      .prepare(
        `INSERT INTO users (login, display_name, role_label, password_hash, must_change_password, active, permissions, session_version, failed_attempts, locked_until, created_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, NULL)`
      )
      .bind(
        'editeur1',
        'Éditeur Un',
        'Éditeur blog',
        pwdHash,
        0,
        1,
        JSON.stringify(['blog.write', 'blog.edit_all', 'blog.delete']),
        1,
        Date.now()
      )
      .run();

    await db
      .prepare(
        `INSERT INTO users (login, display_name, role_label, password_hash, must_change_password, active, permissions, session_version, failed_attempts, locked_until, created_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, NULL)`
      )
      .bind(
        'publieur1',
        'Publieur Un',
        'Responsable publication',
        pwdHash,
        0,
        1,
        JSON.stringify(['blog.write', 'blog.publish']),
        1,
        Date.now()
      )
      .run();

    const ownerToken = await createSignedSessionToken(sessionSecret, Date.now(), {
      type: 'owner',
    });
    const obsToken = await createSignedSessionToken(sessionSecret, Date.now(), {
      type: 'user',
      userId: 1,
      sessionVersion: 1,
    });
    const writerToken = await createSignedSessionToken(sessionSecret, Date.now(), {
      type: 'user',
      userId: 2,
      sessionVersion: 1,
    });
    const editorToken = await createSignedSessionToken(sessionSecret, Date.now(), {
      type: 'user',
      userId: 3,
      sessionVersion: 1,
    });
    const publisherToken = await createSignedSessionToken(
      sessionSecret,
      Date.now(),
      {
        type: 'user',
        userId: 4,
        sessionVersion: 1,
      }
    );

    const makeHeaders = (token: string) => ({
      'Content-Type': 'application/json',
      Origin: 'https://vidnex.space',
      Cookie: `${ADMIN_COOKIE_NAME}=${token}`,
    });

    // 4a. Un compte sans droit blog.* (observateur) reçoit 403 sur GET et POST /api/admin/blog
    const obsGetRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/blog', {
        method: 'GET',
        headers: { Cookie: `${ADMIN_COOKIE_NAME}=${obsToken}` },
      }),
      env
    );
    assert.equal(obsGetRes.status, 403);

    // 4b. Un rédacteur (blog.write) peut créer son propre article en draft
    const validTranslationPayload = {
      slug: 'astuces-telechargement-video-hd',
      title: 'Astuces pour télécharger une vidéo en HD',
      excerpt: 'Guide pratique pour conserver la qualité originale MP4.',
      metaTitle: 'Astuces téléchargement vidéo HD sans filigrane',
      metaDescription:
        'Découvrez toutes les astuces techniques pour télécharger une vidéo publique en haute définition MP4 sans perte de qualité ni filigrane.',
      primaryKeyword: 'telecharger video hd',
      bodyMarkdown: validMd,
    };

    const writerCreateRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/blog', {
        method: 'POST',
        headers: makeHeaders(writerToken),
        body: JSON.stringify({
          action: 'create',
          id: 'article-redacteur-test',
          category: 'tutorials',
          toolRoute: 'tiktok',
          translations: {
            fr: validTranslationPayload,
          },
        }),
      }),
      env
    );
    assert.equal(writerCreateRes.status, 201);
    const writerCreateJson: any = await writerCreateRes.json();
    assert.equal(writerCreateJson.ok, true);
    assert.equal(writerCreateJson.status, 'draft');

    // 4c. Règle stricte : un compte sans blog.publish (rédacteur ou éditeur) ne peut JAMAIS passer un article en published
    const writerCreatePublishedRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/blog', {
        method: 'POST',
        headers: makeHeaders(writerToken),
        body: JSON.stringify({
          action: 'create',
          id: 'article-interdit-pub',
          status: 'published',
          translations: {
            fr: { ...validTranslationPayload, slug: 'autre-slug-test' },
          },
        }),
      }),
      env
    );
    assert.equal(writerCreatePublishedRes.status, 403);

    const writerPublishActionRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/blog', {
        method: 'POST',
        headers: makeHeaders(writerToken),
        body: JSON.stringify({
          action: 'publish',
          id: 'article-redacteur-test',
        }),
      }),
      env
    );
    assert.equal(writerPublishActionRes.status, 403);

    const editorPublishActionRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/blog', {
        method: 'POST',
        headers: makeHeaders(editorToken),
        body: JSON.stringify({
          action: 'publish',
          id: 'article-redacteur-test',
        }),
      }),
      env
    );
    assert.equal(editorPublishActionRes.status, 403);

    // 4d. Soumission en relecture (in_review) par le rédacteur sur son propre article
    const submitReviewRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/blog', {
        method: 'POST',
        headers: makeHeaders(writerToken),
        body: JSON.stringify({
          action: 'submit_review',
          id: 'article-redacteur-test',
        }),
      }),
      env
    );
    assert.equal(submitReviewRes.status, 200);
    const submitReviewJson: any = await submitReviewRes.json();
    assert.equal(submitReviewJson.status, 'in_review');

    // 4e. Modification des articles d'autrui : refusée (403) sans blog.edit_all, autorisée avec blog.edit_all
    const editorCreateOwnRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/blog', {
        method: 'POST',
        headers: makeHeaders(editorToken),
        body: JSON.stringify({
          action: 'create',
          id: 'article-editeur-propre',
          category: 'comparisons',
          translations: {
            fr: {
              ...validTranslationPayload,
              slug: 'comparatif-formats-video-mp4',
            },
          },
        }),
      }),
      env
    );
    assert.equal(editorCreateOwnRes.status, 201);

    // Le rédacteur1 (qui a seulement blog.write) tente de modifier l'article de editeur1 -> 403 FORBIDDEN
    const writerEditOthersRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/blog', {
        method: 'POST',
        headers: makeHeaders(writerToken),
        body: JSON.stringify({
          action: 'update',
          id: 'article-editeur-propre',
          translations: {
            fr: {
              ...validTranslationPayload,
              slug: 'comparatif-formats-video-mp4',
              title: 'Tentative modification non autorisée',
            },
          },
        }),
      }),
      env
    );
    assert.equal(writerEditOthersRes.status, 403);

    // L'éditeur1 (qui a blog.edit_all) peut modifier l'article de redacteur1 -> 200 OK
    const editorEditWritersArticleRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/blog', {
        method: 'POST',
        headers: makeHeaders(editorToken),
        body: JSON.stringify({
          action: 'update',
          id: 'article-redacteur-test',
          translations: {
            fr: {
              ...validTranslationPayload,
              title: 'Titre révisé par éditeur',
            },
          },
        }),
      }),
      env
    );
    assert.equal(editorEditWritersArticleRes.status, 200);

    // 4f. Historique des révisions : plafonné aux 10 dernières versions par traduction + restauration
    for (let i = 1; i <= 12; i++) {
      const revUpdateRes = await worker.fetch(
        new Request('https://vidnex.space/api/admin/blog', {
          method: 'POST',
          headers: makeHeaders(writerToken),
          body: JSON.stringify({
            action: 'update',
            id: 'article-redacteur-test',
            translations: {
              fr: {
                ...validTranslationPayload,
                title: `Version numéro ${i} du guide`,
              },
            },
          }),
        }),
        env
      );
      assert.equal(revUpdateRes.status, 200);
    }

    const detailRes = await worker.fetch(
      new Request(
        'https://vidnex.space/api/admin/blog?id=article-redacteur-test&locale=fr',
        {
          method: 'GET',
          headers: { Cookie: `${ADMIN_COOKIE_NAME}=${writerToken}` },
        }
      ),
      env
    );
    assert.equal(detailRes.status, 200);
    const detailJson: any = await detailRes.json();
    assert.equal(detailJson.revisions.length, 10);
    assert.equal(detailJson.revisions[0].title, 'Version numéro 12 du guide');
    assert.equal(detailJson.revisions[9].title, 'Version numéro 3 du guide');

    // Restauration d'une révision antérieure
    const targetRev = detailJson.revisions[5];
    const restoreRevRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/blog', {
        method: 'POST',
        headers: makeHeaders(writerToken),
        body: JSON.stringify({
          action: 'restore_revision',
          id: 'article-redacteur-test',
          revisionId: targetRev.id,
        }),
      }),
      env
    );
    assert.equal(restoreRevRes.status, 200);

    // 4g. Publication par un compte disposant de blog.publish + redirection 301 automatique sur changement de slug publié
    const publishRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/blog', {
        method: 'POST',
        headers: makeHeaders(publisherToken),
        body: JSON.stringify({
          action: 'publish',
          id: 'article-redacteur-test',
        }),
      }),
      env
    );
    assert.equal(publishRes.status, 200);
    const publishJson: any = await publishRes.json();
    assert.equal(publishJson.status, 'published');

    // Changement de slug d'un article publié (astuces-telechargement-video-hd -> guide-telechargement-hd-pro)
    const slugChange1Res = await worker.fetch(
      new Request('https://vidnex.space/api/admin/blog', {
        method: 'POST',
        headers: makeHeaders(ownerToken),
        body: JSON.stringify({
          action: 'update',
          id: 'article-redacteur-test',
          status: 'published',
          translations: {
            fr: {
              ...validTranslationPayload,
              slug: 'guide-telechargement-hd-pro',
              status: 'published',
            },
          },
        }),
      }),
      env
    );
    assert.equal(slugChange1Res.status, 200);

    // Deuxième changement de slug (guide-telechargement-hd-pro -> guide-video-hd-final) : vérifie la mise à jour de chaîne A -> C et B -> C
    const slugChange2Res = await worker.fetch(
      new Request('https://vidnex.space/api/admin/blog', {
        method: 'POST',
        headers: makeHeaders(ownerToken),
        body: JSON.stringify({
          action: 'update',
          id: 'article-redacteur-test',
          status: 'published',
          translations: {
            fr: {
              ...validTranslationPayload,
              slug: 'guide-video-hd-final',
              status: 'published',
            },
          },
        }),
      }),
      env
    );
    assert.equal(slugChange2Res.status, 200);

    const afterRedirectRes = await worker.fetch(
      new Request(
        'https://vidnex.space/api/admin/blog?id=article-redacteur-test',
        {
          method: 'GET',
          headers: { Cookie: `${ADMIN_COOKIE_NAME}=${ownerToken}` },
        }
      ),
      env
    );
    const afterRedirectJson: any = await afterRedirectRes.json();
    const redirects: Array<{ oldSlug: string; newSlug: string; statusCode: number }> =
      afterRedirectJson.redirects;
    assert.equal(redirects.length, 2);
    const redir1 = redirects.find(
      (r) => r.oldSlug === 'astuces-telechargement-video-hd'
    );
    const redir2 = redirects.find(
      (r) => r.oldSlug === 'guide-telechargement-hd-pro'
    );
    assert.ok(redir1);
    assert.equal(redir1.newSlug, 'guide-video-hd-final');
    assert.equal(redir1.statusCode, 301);
    assert.ok(redir2);
    assert.equal(redir2.newSlug, 'guide-video-hd-final');
    assert.equal(redir2.statusCode, 301);

    // 4h. Mise à la corbeille / restauration 30 j (blog.delete requis)
    const writerTrashRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/blog', {
        method: 'POST',
        headers: makeHeaders(writerToken),
        body: JSON.stringify({
          action: 'trash',
          id: 'article-redacteur-test',
        }),
      }),
      env
    );
    assert.equal(writerTrashRes.status, 403);

    const editorTrashRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/blog', {
        method: 'POST',
        headers: makeHeaders(editorToken),
        body: JSON.stringify({
          action: 'trash',
          id: 'article-redacteur-test',
        }),
      }),
      env
    );
    assert.equal(editorTrashRes.status, 200);
    const editorTrashJson: any = await editorTrashRes.json();
    assert.equal(editorTrashJson.status, 'trashed');

    // Si l'éditeur (sans blog.publish) restaure un article qui était publié, il revient en draft (jamais en published sans blog.publish)
    const editorRestoreRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/blog', {
        method: 'POST',
        headers: makeHeaders(editorToken),
        body: JSON.stringify({
          action: 'restore',
          id: 'article-redacteur-test',
        }),
      }),
      env
    );
    assert.equal(editorRestoreRes.status, 200);
    const editorRestoreJson: any = await editorRestoreRes.json();
    assert.equal(editorRestoreJson.status, 'draft');

    // 4i. Action réservée au propriétaire « Importer les articles existants » sans doublon
    const nonOwnerImportRes = await worker.fetch(
      new Request('https://vidnex.space/api/admin/blog', {
        method: 'POST',
        headers: makeHeaders(editorToken),
        body: JSON.stringify({ action: 'import_existing' }),
      }),
      env
    );
    assert.equal(nonOwnerImportRes.status, 403);

    const ownerImport1Res = await worker.fetch(
      new Request('https://vidnex.space/api/admin/blog', {
        method: 'POST',
        headers: makeHeaders(ownerToken),
        body: JSON.stringify({ action: 'import_existing' }),
      }),
      env
    );
    assert.equal(ownerImport1Res.status, 200);
    const ownerImport1Json: any = await ownerImport1Res.json();
    assert.equal(ownerImport1Json.ok, true);
    assert.equal(ownerImport1Json.importedArticles, BLOG_ARTICLES.length);
    assert.ok(ownerImport1Json.importedTranslations >= BLOG_ARTICLES.length);

    // Deuxième exécution : 0 doublon créé
    const ownerImport2Res = await worker.fetch(
      new Request('https://vidnex.space/api/admin/blog', {
        method: 'POST',
        headers: makeHeaders(ownerToken),
        body: JSON.stringify({ action: 'import_existing' }),
      }),
      env
    );
    assert.equal(ownerImport2Res.status, 200);
    const ownerImport2Json: any = await ownerImport2Res.json();
    assert.equal(ownerImport2Json.importedArticles, 0);
    assert.equal(ownerImport2Json.skippedArticles, BLOG_ARTICLES.length);
    assert.equal(ownerImport2Json.importedTranslations, 0);

    // Vérification du journal d'audit (audit_log)
    const auditRows = await db
      .prepare(
        'SELECT id, actor, action, target, created_at FROM audit_log ORDER BY created_at DESC, id DESC LIMIT ?'
      )
      .bind(50)
      .all<{ action: string }>();
    const loggedActions = new Set(
      (auditRows.results || []).map((r) => r.action)
    );
    assert.ok(loggedActions.has('blog.create'));
    assert.ok(loggedActions.has('blog.update'));
    assert.ok(loggedActions.has('blog.submit_review'));
    assert.ok(loggedActions.has('blog.restore_revision'));
    assert.ok(loggedActions.has('blog.publish'));
    assert.ok(loggedActions.has('blog.redirect_301'));
    assert.ok(loggedActions.has('blog.trash'));
    assert.ok(loggedActions.has('blog.restore'));
    assert.ok(loggedActions.has('blog.import_existing'));
  });

  it('Écran de SÉLECTION avant téléchargement — Carrousels (IG, TikTok, X), Stories/Highlights/Profil actifs avec IG_SESSION_ID (présélection de la story du lien), ZIP fflate (limite 20 éléments / 100 Mo), miniatures /api/download, 10 langues et compteurs selection_started / selection_download', async () => {
    resetRateLimitBuckets();
    resetD1RateLimitFallback();
    const db = createMemoryD1Database();
    const origFetch = globalThis.fetch;

    const { mapExtractResponseToMediaResult } = await import(
      '../services/extractorService.ts'
    );
    const {
      buildUncompressedZipBytes,
      validateSelectionLimits,
      MAX_SELECTION_ITEMS,
      MAX_SELECTION_TOTAL_BYTES,
    } = await import('../utils/zipArchive.ts');
    const { unzipSync } = await import('fflate');
    const { SELECTION_UI_TEXTS } = await import('../i18n/translations.ts');
    const { SUPPORTED_LOCALES } = await import('../i18n/config.ts');

    // 1. Textes traduits dans les 10 langues
    for (const loc of SUPPORTED_LOCALES) {
      const t = SELECTION_UI_TEXTS[loc];
      assert.ok(t, `Missing SELECTION_UI_TEXTS for locale ${loc}`);
      assert.ok(t.selectedCount.includes('{selected}'));
      assert.ok(t.selectedCount.includes('{total}'));
      assert.ok(t.downloadSelection.length > 0);
      assert.ok(t.limitMaxItems.includes('20'));
      assert.ok(t.limitMaxSize.includes('100'));
      assert.ok(t.progressFetching.includes('{current}'));
      assert.ok(t.activeStoriesSubtitle.length > 0);
    }

    // 2. Assemblage ZIP côté navigateur via fflate + limites strictes (20 éléments ou 100 Mo)
    const sampleFiles = [
      { name: 'slide_1.jpg', data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]) },
      { name: 'slide_2.mp4', data: new Uint8Array([0x00, 0x00, 0x00, 0x18, 4, 5, 6]) },
    ];
    const zipBytes = buildUncompressedZipBytes(sampleFiles);
    const unzipped = unzipSync(zipBytes);
    assert.deepEqual(Array.from(unzipped['slide_1.jpg']), [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    assert.deepEqual(Array.from(unzipped['slide_2.mp4']), [0x00, 0x00, 0x00, 0x18, 4, 5, 6]);

    assert.equal(MAX_SELECTION_ITEMS, 20);
    assert.equal(MAX_SELECTION_TOTAL_BYTES, 100 * 1024 * 1024);
    assert.equal(validateSelectionLimits(20, 50 * 1024 * 1024).valid, true);
    const overItems = validateSelectionLimits(21, 10 * 1024 * 1024);
    assert.equal(overItems.valid, false);
    assert.equal(overItems.reason, 'MAX_ITEMS_EXCEEDED');
    const overSize = validateSelectionLimits(5, 101 * 1024 * 1024);
    assert.equal(overSize.valid, false);
    assert.equal(overSize.reason, 'MAX_SIZE_EXCEEDED');

    try {
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const u =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        // Mock X multi-image tweet
        if (u.includes('cdn.syndication.twimg.com/tweet-result') && u.includes('id=1888888888888888888')) {
          return new Response(
            JSON.stringify({
              id_str: '1888888888888888888',
              text: 'Multi photo post on X',
              created_at: '2026-03-20T14:30:00.000Z',
              user: { name: 'Creator X', screen_name: 'creatorx' },
              mediaDetails: [
                {
                  type: 'photo',
                  media_url_https: 'https://pbs.twimg.com/media/SlideOne.jpg',
                  original_info: { width: 1200, height: 1500 },
                },
                {
                  type: 'photo',
                  media_url_https: 'https://pbs.twimg.com/media/SlideTwo.png',
                  original_info: { width: 1080, height: 1080 },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Mock Instagram Story + Active Account Stories (when IG_SESSION_ID is set)
        if (u.includes('/api/v1/users/web_profile_info/?username=storycreator')) {
          return new Response(
            JSON.stringify({
              data: {
                user: {
                  id: '42424242',
                  username: 'storycreator',
                  full_name: 'Story Creator',
                  is_private: false,
                  profile_pic_url: 'https://scontent.cdninstagram.com/v/t51.2885-19/storycreator_150.jpg',
                  hd_profile_pic_url_info: {
                    url: 'https://scontent.cdninstagram.com/v/t51.2885-19/storycreator_hd.jpg',
                    width: 1080,
                    height: 1080,
                  },
                },
              },
              status: 'ok',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (u.includes('/api/v1/feed/reels_media/?reel_ids=42424242')) {
          return new Response(
            JSON.stringify({
              reels_media: [
                {
                  id: '42424242',
                  user: {
                    pk: '42424242',
                    username: 'storycreator',
                    full_name: 'Story Creator',
                    profile_pic_url: 'https://scontent.cdninstagram.com/v/t51.2885-19/storycreator_150.jpg',
                  },
                  items: [
                    {
                      pk: '1111111111111111111',
                      id: '1111111111111111111_42424242',
                      media_type: 1,
                      taken_at: 1774000000,
                      original_width: 1080,
                      original_height: 1920,
                      image_versions2: {
                        candidates: [
                          {
                            url: 'https://scontent.cdninstagram.com/v/t51.2885-15/story_1_photo.jpg',
                            width: 1080,
                            height: 1920,
                          },
                        ],
                      },
                    },
                    {
                      pk: '2222222222222222222',
                      id: '2222222222222222222_42424242',
                      media_type: 2,
                      taken_at: 1774003600,
                      original_width: 1080,
                      original_height: 1920,
                      image_versions2: {
                        candidates: [
                          {
                            url: 'https://scontent.cdninstagram.com/v/t51.2885-15/story_2_thumb.jpg',
                            width: 1080,
                            height: 1920,
                          },
                        ],
                      },
                      video_versions: [
                        {
                          url: 'https://scontent.cdninstagram.com/v/t50.2886-16/story_2_video.mp4',
                          width: 1080,
                          height: 1920,
                        },
                      ],
                    },
                  ],
                },
              ],
              status: 'ok',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Mock upstream image for /api/download?sel=1
        if (u.startsWith('https://pbs.twimg.com/media/SlideOne.jpg')) {
          return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), {
            status: 200,
            headers: {
              'Content-Type': 'image/jpeg',
              'Content-Length': '4',
            },
          });
        }

        return origFetch(input, init);
      };

      // 3. Carrousel X multi-images : items[] enrichi (index, kind, thumbnail via /api/download, width, height, date)
      const xCarouselRes = await worker.fetch(
        new Request(
          'https://vidnex.space/api/extract?url=https://x.com/creatorx/status/1888888888888888888'
        ),
        { DB: db, IP_HASH_SALT: 'sel-salt-2026' }
      );
      assert.equal(xCarouselRes.status, 200);
      const xCarouselJson: any = await xCarouselRes.json();
      assert.equal(xCarouselJson.ok, true);
      assert.equal(xCarouselJson.type, 'carousel');
      assert.equal(xCarouselJson.items.length, 2);
      assert.equal(xCarouselJson.items[0].index, 1);
      assert.equal(xCarouselJson.items[0].kind, 'image');
      assert.equal(xCarouselJson.items[0].width, 1200);
      assert.equal(xCarouselJson.items[0].height, 1500);
      assert.equal(xCarouselJson.items[0].date, '2026-03-20T14:30:00.000Z');
      assert.ok(xCarouselJson.items[0].thumbnail.startsWith('/api/download?'));
      assert.ok(xCarouselJson.items[0].thumbnail.includes('inline=1'));
      assert.equal(xCarouselJson.items[1].index, 2);

      // 4. Story Instagram avec IG_SESSION_ID : liste toutes les stories actives du compte + présélectionne la story du lien (#2)
      const igStoryRes = await worker.fetch(
        new Request(
          'https://vidnex.space/api/extract?url=https://www.instagram.com/stories/storycreator/2222222222222222222/'
        ),
        { DB: db, IG_SESSION_ID: 'mock_session_id_123', IP_HASH_SALT: 'sel-salt-2026' }
      );
      assert.equal(igStoryRes.status, 200);
      const igStoryJson: any = await igStoryRes.json();
      assert.equal(igStoryJson.ok, true);
      assert.equal(igStoryJson.type, 'carousel');
      assert.equal(igStoryJson.items.length, 2);
      assert.equal(igStoryJson.items[0].index, 1);
      assert.equal(igStoryJson.items[0].kind, 'image');
      assert.equal(igStoryJson.items[0].selected, false);
      assert.ok(igStoryJson.items[0].date);
      assert.equal(igStoryJson.items[1].index, 2);
      assert.equal(igStoryJson.items[1].kind, 'video');
      assert.equal(igStoryJson.items[1].selected, true);
      assert.equal(igStoryJson.items[1].quality, '1080p');
      assert.ok(igStoryJson.items[1].thumbnail.startsWith('/api/download?'));

      const mappedStoryResult = mapExtractResponseToMediaResult(
        igStoryJson,
        'https://www.instagram.com/stories/storycreator/2222222222222222222/',
        detectMediaUrl(
          'https://www.instagram.com/stories/storycreator/2222222222222222222/'
        )
      );
      assert.equal(mappedStoryResult.payloadType, 'carousel');
      if (mappedStoryResult.payloadType === 'carousel') {
        assert.equal(mappedStoryResult.selectionContext, 'story');
        assert.equal(mappedStoryResult.items.length, 2);
        assert.equal(mappedStoryResult.items[0].selected, false);
        assert.equal(mappedStoryResult.items[1].selected, true);
      }

      // 5. Profil Instagram avec IG_SESSION_ID et stories actives : photo de profil (présélectionnée) + stories actives
      const igProfileWithStoriesRes = await worker.fetch(
        new Request(
          'https://vidnex.space/api/extract?url=https://www.instagram.com/storycreator/'
        ),
        { DB: db, IG_SESSION_ID: 'mock_session_id_123', IP_HASH_SALT: 'sel-salt-2026' }
      );
      assert.equal(igProfileWithStoriesRes.status, 200);
      const igProfileJson: any = await igProfileWithStoriesRes.json();
      assert.equal(igProfileJson.ok, true);
      assert.equal(igProfileJson.type, 'carousel');
      assert.equal(igProfileJson.items.length, 3);
      assert.equal(igProfileJson.items[0].label, 'profile_photo');
      assert.equal(igProfileJson.items[0].selected, true);
      assert.equal(igProfileJson.items[1].label, 'story');
      assert.equal(igProfileJson.items[1].selected, false);
      assert.equal(igProfileJson.items[2].label, 'story');
      assert.equal(igProfileJson.items[2].selected, false);

      // 6. Story sans IG_SESSION_ID : conserve le message clair PRIVATE_OR_LOGIN_REQUIRED
      const igStoryNoSessionRes = await worker.fetch(
        new Request(
          'https://vidnex.space/api/extract?url=https://www.instagram.com/stories/storycreator/2222222222222222222/'
        ),
        { DB: db, IP_HASH_SALT: 'sel-salt-2026' }
      );
      assert.equal(igStoryNoSessionRes.status, 403);
      const igStoryNoSessionJson: any = await igStoryNoSessionRes.json();
      assert.equal(igStoryNoSessionJson.error.code, 'PRIVATE_OR_LOGIN_REQUIRED');
      assert.equal(
        igStoryNoSessionJson.error.message,
        'Les stories Instagram exigent une connexion : elles ne peuvent pas être téléchargées sans compte.'
      );

      // 7. Téléchargement depuis l'écran de sélection (&sel=1) -> incrémente selection_download dans daily_metrics sans identifiant
      const dlUrl = new URL(`https://vidnex.space${xCarouselJson.items[0].url}&sel=1`);
      const dlRes = await worker.fetch(new Request(dlUrl.toString()), {
        DB: db,
        IP_HASH_SALT: 'sel-salt-2026',
      });
      assert.equal(dlRes.status, 200);
      await dlRes.arrayBuffer();

      const metricsRows = await db
        .prepare('SELECT day, platform, event, count FROM daily_metrics')
        .all<{ day: string; platform: string; event: string; count: number }>();
      const eventsMap = new Map<string, number>();
      for (const r of metricsRows.results || []) {
        eventsMap.set(`${r.platform}:${r.event}`, r.count);
      }
      assert.ok((eventsMap.get('x:selection_started') || 0) >= 1);
      assert.ok((eventsMap.get('instagram:selection_started') || 0) >= 1);
      assert.ok((eventsMap.get('x:selection_download') || 0) >= 1);
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});




