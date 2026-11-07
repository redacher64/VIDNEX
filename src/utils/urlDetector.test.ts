import test from 'node:test';
import assert from 'node:assert/strict';
import { detectMediaUrl } from './urlDetector.ts';
import { detectUrl } from '../../functions/_lib/detect.ts';
import { isAllowedMediaHost } from '../../functions/_lib/allowlist.ts';
import { sanitizeFilename } from '../../functions/api/download.ts';

test('Frontend detectMediaUrl validates Instagram & TikTok URLs and @handles', () => {
  const igReel = detectMediaUrl('https://www.instagram.com/reel/C8x9kLmN2pQ/');
  assert.equal(igReel.isValid, true);
  assert.equal(igReel.platform, 'instagram');
  assert.equal(igReel.mediaType, 'reel');

  const ttVideo = detectMediaUrl('https://www.tiktok.com/@tiktok/video/7106594312292453675');
  assert.equal(ttVideo.isValid, true);
  assert.equal(ttVideo.platform, 'tiktok');
  assert.equal(ttVideo.mediaType, 'video');

  const handle = detectMediaUrl('@natgeo', 'instagram');
  assert.equal(handle.isValid, true);
  assert.equal(handle.mediaType, 'profile');
});

test('Cloudflare Pages Function detectUrl parses TikTok & Instagram videos, posts, and profiles', () => {
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

test('Cloudflare Pages Function allowlist & filename sanitizer block SSRF and path traversal', () => {
  assert.equal(isAllowedMediaHost('v16m.tiktokcdn.com'), true);
  assert.equal(isAllowedMediaHost('www.tikwm.com'), true);
  assert.equal(isAllowedMediaHost('scontent.cdninstagram.com'), true);
  assert.equal(isAllowedMediaHost('video.xx.fbcdn.net'), true);

  assert.equal(isAllowedMediaHost('localhost'), false);
  assert.equal(isAllowedMediaHost('127.0.0.1'), false);
  assert.equal(isAllowedMediaHost('169.254.169.254'), false);
  assert.equal(isAllowedMediaHost('evil.example.com'), false);

  assert.equal(
    sanitizeFilename('VIDNEX../bad name!.mp4'),
    'VIDNEX_bad_name_.mp4'
  );
});
