import { detectMediaUrl } from './urlDetector.ts';

// Tests unitaires de validation et détection d'URLs
describe?.('detectMediaUrl', () => {
  it?.('detects Instagram Reel URLs accurately', () => {
    const res = detectMediaUrl('https://www.instagram.com/reel/C8x9kLmN2pQ/');
    if (!res.isValid || res.platform !== 'instagram' || res.mediaType !== 'reel') {
      throw new Error('Failed to detect Instagram Reel');
    }
  });

  it?.('detects TikTok video URLs accurately', () => {
    const res = detectMediaUrl('https://www.tiktok.com/@tiktok/video/7106594312292453675');
    if (!res.isValid || res.platform !== 'tiktok' || res.mediaType !== 'video') {
      throw new Error('Failed to detect TikTok video');
    }
  });

  it?.('rejects invalid or empty URLs', () => {
    const empty = detectMediaUrl('');
    if (empty.isValid) throw new Error('Empty URL should not be valid');
    const invalid = detectMediaUrl('https://example.com/invalid');
    if (invalid.isValid) throw new Error('Unsupported domain should not be valid');
  });
});
