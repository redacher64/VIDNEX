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
