import test from 'node:test';
import assert from 'node:assert/strict';
import { detectMediaUrl } from './urlDetector';

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
  const vid = detectMediaUrl('https://www.tiktok.com/@designsystems/video/7384920192837465');
  assert.equal(vid.isValid, true);
  assert.equal(vid.platform, 'tiktok');
  assert.equal(vid.mediaType, 'video');

  const photo = detectMediaUrl('https://www.tiktok.com/@minimal.archive/photo/7391029384756');
  assert.equal(photo.isValid, true);
  assert.equal(photo.platform, 'tiktok');
  assert.equal(photo.mediaType, 'slideshow');
});

test('detects YouTube Shorts, X, Facebook, and Snapchat URLs', () => {
  const yt = detectMediaUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ');
  assert.equal(yt.isValid, true);
  assert.equal(yt.platform, 'youtube');
  assert.equal(yt.mediaType, 'short');

  const xPost = detectMediaUrl('https://x.com/linear_updates/status/1802938475610293');
  assert.equal(xPost.isValid, true);
  assert.equal(xPost.platform, 'twitter');

  const fb = detectMediaUrl('https://www.facebook.com/reel/129384756012');
  assert.equal(fb.isValid, true);
  assert.equal(fb.platform, 'facebook');

  const snap = detectMediaUrl('https://www.snapchat.com/spotlight/W7_EDlXWTBiXAEEniNoMPwAAY');
  assert.equal(snap.isValid, true);
  assert.equal(snap.platform, 'snapchat');
});

test('rejects empty or unsupported URLs', () => {
  const empty = detectMediaUrl('   ');
  assert.equal(empty.isValid, false);

  const invalid = detectMediaUrl('https://example.com/not-a-supported-media-link');
  assert.equal(invalid.isValid, false);
});

import { getRapidApiConfig, buildRapidApiHeaders } from '../../api/_config';
import {
  normalizeInstagramRapidApiPayload,
  normalizeTikTokRapidApiPayload,
} from '../../api/_normalizer';
import { resolveDownloadStream } from '../../api/download';

test('server-side RapidAPI config injects x-rapidapi-key and x-rapidapi-host headers securely', () => {
  const cfg = getRapidApiConfig({
    RAPIDAPI_KEY: '4ccf5ce995msha5582c5f65fa102p1181adjsn3547153d857f',
    RAPIDAPI_HOST: 'instagram-scraper-stable-api.p.rapidapi.com',
    RAPIDAPI_UA: 'RapidAPI-Playground',
  });
  assert.equal(cfg.isConfigured, true);
  const headers = buildRapidApiHeaders(cfg.instagramHost, cfg);
  assert.equal(headers.accept, 'application/json');
  assert.equal(
    headers['x-rapidapi-host'],
    'instagram-scraper-stable-api.p.rapidapi.com'
  );
  assert.equal(
    headers['x-rapidapi-key'],
    '4ccf5ce995msha5582c5f65fa102p1181adjsn3547153d857f'
  );
  assert.equal(headers['x-rapidapi-ua'], 'RapidAPI-Playground');
});

test('normalizes Instagram Reel, Carousel, and Profile DP RapidAPI payloads to MediaResult', () => {
  const reelPayload = {
    data: {
      xdt_shortcode_media: {
        id: '12345',
        video_url: 'https://cdn.instagram.com/reel_1080p.mp4',
        display_url: 'https://cdn.instagram.com/reel_thumb.jpg',
        video_duration: 34,
        dimensions: { width: 1080, height: 1920 },
        owner: { username: 'dieter.industrial', full_name: 'Industrial Lab', is_verified: true },
        edge_media_to_caption: { edges: [{ node: { text: 'Studio CNC Reel' } }] },
      },
    },
  };

  const normalizedReel = normalizeInstagramRapidApiPayload(reelPayload, {
    url: 'https://www.instagram.com/reel/C8x9kLmN2pQ/',
    platform: 'instagram',
    mediaType: 'reel',
  });
  assert.ok(normalizedReel);
  assert.equal(normalizedReel.payloadType, 'video');
  assert.equal(normalizedReel.creatorHandle, '@dieter.industrial');
  assert.ok(normalizedReel.formats[0].downloadUrl.startsWith('/api/download?'));

  const dpPayload = {
    user: {
      username: 'natgeo',
      full_name: 'National Geographic',
      follower_count: 281400000,
      hd_profile_pic_url_info: { url: 'https://cdn.instagram.com/natgeo_1080.jpg' },
    },
  };
  const normalizedDp = normalizeInstagramRapidApiPayload(dpPayload, {
    url: 'https://www.instagram.com/natgeo/',
    platform: 'instagram',
    mediaType: 'profile',
    identifier: '@natgeo',
  });
  assert.ok(normalizedDp);
  assert.equal(normalizedDp.payloadType, 'profile_dp');
  assert.equal(normalizedDp.dimensions, '1080 × 1080');
  assert.ok(normalizedDp.hdOriginalUrl.startsWith('/api/download?'));
});

test('normalizes TikTok video RapidAPI payload to MediaResult', () => {
  const ttPayload = {
    data: {
      id: '7384920192837465',
      title: 'Swiss Grid Systems in UI',
      duration: 48,
      hdplay: 'https://cdn.tiktok.com/hd_no_wm.mp4',
      wmplay: 'https://cdn.tiktok.com/sd.mp4',
      music: 'https://cdn.tiktok.com/audio.mp3',
      cover: 'https://cdn.tiktok.com/cover.jpg',
      author: { unique_id: 'designsystems', nickname: 'Swiss Grid Systems' },
    },
  };
  const normalizedTt = normalizeTikTokRapidApiPayload(ttPayload, {
    url: 'https://www.tiktok.com/@designsystems/video/7384920192837465',
    platform: 'tiktok',
    mediaType: 'video',
  });
  assert.ok(normalizedTt);
  assert.equal(normalizedTt.payloadType, 'video');
  assert.equal(normalizedTt.creatorHandle, '@designsystems');
  assert.ok(normalizedTt.formats[0].downloadUrl.startsWith('/api/download?'));
});

test('/api/download proxy enforces Content-Disposition attachment header', async () => {
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
});
