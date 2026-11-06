import test from 'node:test';
import assert from 'node:assert/strict';
import { detectMediaUrl } from './urlDetector';
import {
  calcSyndicationToken,
  getBestTwitterMp4Url,
  getTikWmApiKey,
  prepareCookiesFile,
} from '../../server/api/_config';
import {
  normalizeTikWmPayload,
  normalizeVxTwitterPayload,
  normalizeYtDlpPayload,
  normalizeInstagramRapidApiPayload,
} from '../../server/api/_normalizer';
import { resolveDownloadStream } from '../../server/api/download';

test('detects Instagram Reel URLs accurately', () => {
  const res = detectMediaUrl('https://www.instagram.com/reel/C8x9kLmN2pQ/');
  assert.equal(res.isValid, true);
  assert.equal(res.platform, 'instagram');
  assert.equal(res.mediaType, 'reel');
  assert.equal(res.identifier, 'C8x9kLmN2pQ');
});

test('detects Instagram Carousel post URLs', () => {
  const res = detectMediaUrl('https://www.instagram.com/p/C9aBcDeFgHi/');
  assert.equal(res.isValid, true);
  assert.equal(res.platform, 'instagram');
  assert.equal(res.mediaType, 'post');
});

test('detects direct @handle for Instagram and TikTok', () => {
  const igHandle = detectMediaUrl('@natgeo', 'instagram');
  assert.equal(igHandle.isValid, true);
  assert.equal(igHandle.platform, 'instagram');
  assert.equal(igHandle.mediaType, 'profile');

  const ttHandle = detectMediaUrl('@designsystems', 'tiktok');
  assert.equal(ttHandle.isValid, true);
  assert.equal(ttHandle.platform, 'tiktok');
  assert.equal(ttHandle.mediaType, 'profile');
});

test('detects TikTok Video and Photo Slideshow URLs', () => {
  const vid = detectMediaUrl(
    'https://www.tiktok.com/@tiktok/video/7106594312292453675'
  );
  assert.equal(vid.isValid, true);
  assert.equal(vid.platform, 'tiktok');
  assert.equal(vid.mediaType, 'video');

  const photo = detectMediaUrl(
    'https://www.tiktok.com/@minimal.archive/photo/7391029384756'
  );
  assert.equal(photo.isValid, true);
  assert.equal(photo.platform, 'tiktok');
  assert.equal(photo.mediaType, 'slideshow');
});

test('detects YouTube Shorts, X, Facebook, and Snapchat URLs', () => {
  const yt = detectMediaUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ');
  assert.equal(yt.isValid, true);
  assert.equal(yt.platform, 'youtube');
  assert.equal(yt.mediaType, 'short');

  const xPost = detectMediaUrl(
    'https://x.com/linear_updates/status/1802938475610293'
  );
  assert.equal(xPost.isValid, true);
  assert.equal(xPost.platform, 'twitter');

  const fb = detectMediaUrl('https://www.facebook.com/reel/129384756012');
  assert.equal(fb.isValid, true);
  assert.equal(fb.platform, 'facebook');

  const snap = detectMediaUrl(
    'https://www.snapchat.com/spotlight/W7_EDlXWTBiXAEEniNoMPwAAY'
  );
  assert.equal(snap.isValid, true);
  assert.equal(snap.platform, 'snapchat');
});

test('rejects empty or unsupported URLs', () => {
  const empty = detectMediaUrl('   ');
  assert.equal(empty.isValid, false);

  const invalid = detectMediaUrl(
    'https://example.com/not-a-supported-media-link'
  );
  assert.equal(invalid.isValid, false);
});

test('Engine 1 (TikWM) configures API key and normalizes TikTok Video, Slideshow, and Profile DP payloads', () => {
  assert.equal(getTikWmApiKey({}), 'fbef7469f068f8ee1493378b59468819');
  assert.equal(
    getTikWmApiKey({ TIKWM_API_KEY: 'custom_key_123' }),
    'custom_key_123'
  );

  const ttVideo = normalizeTikWmPayload(
    {
      data: {
        id: '7106594312292453675',
        title: 'TikTok HD No-Watermark Test',
        duration: 24,
        hdplay: 'https://v16m.tiktokcdn.com/hd.mp4',
        play: 'https://v16m.tiktokcdn.com/sd.mp4',
        music: 'https://v16m.tiktokcdn.com/audio.mp3',
        cover: 'https://p16-sign.tiktokcdn.com/cover.jpg',
        author: { unique_id: 'tiktok', nickname: 'TikTok' },
      },
    },
    {
      url: 'https://www.tiktok.com/@tiktok/video/7106594312292453675',
      platform: 'tiktok',
      mediaType: 'video',
    }
  );
  assert.ok(ttVideo);
  assert.equal(ttVideo.payloadType, 'video');
  assert.equal(ttVideo.creatorHandle, '@tiktok');
  assert.ok(ttVideo.formats[0].downloadUrl.startsWith('/api/download?'));
  assert.ok(ttVideo.thumbnailUrl.startsWith('/api/proxy-image?'));

  const ttSlideshow = normalizeTikWmPayload(
    {
      data: {
        id: '998877',
        title: 'Photo Slideshow',
        images: [
          'https://p16.tiktokcdn.com/img1.jpg',
          'https://p16.tiktokcdn.com/img2.jpg',
        ],
        author: { unique_id: 'minimal.archive', nickname: 'Minimal Archive' },
      },
    },
    {
      url: 'https://www.tiktok.com/@minimal.archive/photo/998877',
      platform: 'tiktok',
      mediaType: 'slideshow',
    }
  );
  assert.ok(ttSlideshow);
  assert.equal(ttSlideshow.payloadType, 'carousel');
  assert.equal(ttSlideshow.items.length, 2);
});

test('Engine 2 (BetterTwitFix / vxTwitter) normalizes video, multi-media carousel, and twExtract syndication payloads', () => {
  const token = calcSyndicationToken('1577730467436138524');
  assert.ok(token.length > 0 && !token.includes('0') && !token.includes('.'));

  const bestMp4 = getBestTwitterMp4Url([
    {
      content_type: 'application/x-mpegURL',
      url: 'https://video.twimg.com/pl.m3u8',
    },
    {
      content_type: 'video/mp4',
      bitrate: 832000,
      url: 'https://video.twimg.com/vid/720p.mp4?tag=12',
    },
    {
      content_type: 'video/mp4',
      bitrate: 10368000,
      url: 'https://video.twimg.com/vid/hevc/1080p.mp4?tag=14',
    },
    {
      content_type: 'video/mp4',
      bitrate: 2176000,
      url: 'https://video.twimg.com/vid/avc1/1080p.mp4?tag=14',
    },
  ]);
  assert.equal(bestMp4, 'https://video.twimg.com/vid/avc1/1080p.mp4');

  const vxPayload = {
    tweetID: '1802938475610293',
    text: 'High-speed UI architecture demo',
    user_name: 'Linear Updates',
    user_screen_name: 'linear_updates',
    media_extended: [
      {
        type: 'video',
        url: 'https://video.twimg.com/ext_tw_video/1080p.mp4?tag=12',
        thumbnail_url: 'https://pbs.twimg.com/ext_tw_video_thumb/img.jpg',
        duration_millis: 29000,
        size: { width: 1920, height: 1080 },
      },
    ],
  };

  const normalized = normalizeVxTwitterPayload(vxPayload, {
    url: 'https://x.com/linear_updates/status/1802938475610293',
    platform: 'twitter',
    mediaType: 'video',
  });
  assert.ok(normalized);
  assert.equal(normalized.payloadType, 'video');
  assert.equal(normalized.creatorHandle, '@linear_updates');
  assert.equal(normalized.aspectRatio, '16:9');
  assert.ok(normalized.formats[0].downloadUrl.startsWith('/api/download?'));

  // BetterTwitFix twExtract syndication payload
  const syndicationPayload = {
    id_str: '1577730467436138524',
    text: 'Syndication video test',
    user: { screen_name: 'Twitter', name: 'Twitter Official' },
    mediaDetails: [
      {
        type: 'video',
        media_url_https: 'https://pbs.twimg.com/thumb.jpg',
        original_info: { width: 1920, height: 1080 },
        video_info: {
          duration_millis: 15000,
          variants: [
            {
              content_type: 'video/mp4',
              bitrate: 2176000,
              url: 'https://video.twimg.com/syndication_1080p.mp4?tag=12',
            },
          ],
        },
      },
    ],
  };
  const normSyn = normalizeVxTwitterPayload(syndicationPayload, {
    url: 'https://x.com/Twitter/status/1577730467436138524',
    platform: 'twitter',
    mediaType: 'video',
  });
  assert.ok(normSyn);
  assert.equal(normSyn.payloadType, 'video');
  assert.equal(normSyn.creatorHandle, '@Twitter');
});

test('Engine 3 (yt-dlp) normalizes single video and multi-entry carousel JSON', () => {
  const ytdlpVideo = normalizeYtDlpPayload(
    {
      id: 'dQw4w9WgXcQ',
      title: 'Optical Clock Engineering Short',
      uploader: 'Veritas Engineering',
      uploader_id: '@veritas_engineering',
      duration: 58,
      width: 1080,
      height: 1920,
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      formats: [
        {
          url: 'https://rr1---sn.googlevideo.com/videoplayback_1080p.mp4',
          vcodec: 'avc1.64002a',
          acodec: 'mp4a.40.2',
          height: 1920,
          width: 1080,
          filesize: 18400000,
        },
      ],
    },
    {
      url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      platform: 'youtube',
      mediaType: 'short',
    }
  );
  assert.ok(ytdlpVideo);
  assert.equal(ytdlpVideo.payloadType, 'video');
  assert.equal(ytdlpVideo.creatorHandle, '@veritas_engineering');
  assert.ok(ytdlpVideo.formats[0].downloadUrl.startsWith('/api/download?'));

  const igGraph = normalizeInstagramRapidApiPayload(
    {
      user: {
        username: 'natgeo',
        full_name: 'National Geographic',
        follower_count: 281400000,
        hd_profile_pic_url_info: {
          url: 'https://cdn.instagram.com/natgeo_1080.jpg',
        },
      },
    },
    {
      url: 'https://www.instagram.com/natgeo/',
      platform: 'instagram',
      mediaType: 'profile',
    }
  );
  assert.ok(igGraph);
  assert.equal(igGraph.payloadType, 'profile_dp');
});

test('COOKIES_TXT_BASE64 decodes valid Netscape cookie file to /tmp/cookies.txt', () => {
  const sampleCookies =
    '# Netscape HTTP Cookie File\n.instagram.com\tTRUE\t/\tTRUE\t2147483647\tsessionid\ttest_val\n';
  const b64 = Buffer.from(sampleCookies, 'utf-8').toString('base64');
  const path = prepareCookiesFile({ COOKIES_TXT_BASE64: b64 });
  assert.equal(path, '/tmp/cookies.txt');
});

test('/api/download proxy returns playable multi-megabyte MP4 with Content-Disposition attachment', async () => {
  const res = await resolveDownloadStream(
    'synthetic://instagram/dieter_industrial/1080p.mp4',
    'VIDNEX_instagram_dieter_1080p.mp4'
  );
  assert.equal(res.status, 200);
  assert.equal(
    res.headers['Content-Disposition'],
    'attachment; filename="VIDNEX_instagram_dieter_1080p.mp4"'
  );
  assert.equal(res.headers['Content-Type'], 'video/mp4');
  assert.ok((res.body as Uint8Array).byteLength > 1000000);
});
