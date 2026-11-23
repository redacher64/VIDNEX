import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DESKTOP_MAX_VIDEO_BYTES,
  MOBILE_MAX_VIDEO_BYTES,
  MP3_BITRATE_OPTIONS,
  WAV_SAMPLE_RATE_OPTIONS,
  VIDEO_TO_MP3_I18N,
  clampTrimRange,
  computeWaveformPeaks,
  createSampleAudioPcm,
  encodeMp3FromPcm,
  encodeWavFromPcm,
  estimateAudioOutputBytes,
  extractTrimmedPcm,
  formatByteSize,
  formatTimecode,
  getMaxVideoBytes,
  getVideoToMp3Content,
  mixChannels,
  normalizePcmChannels,
  parseTimecodeToSeconds,
  resamplePcmLinear,
  sanitizeOutputFilename,
  validateVideoFile,
} from '../src/utils/videoToMp3Logic.ts';
import {
  clearPendingVideoForAudioTool,
  consumePendingVideoForAudioTool,
  isAudioExtractionSupportedPlatform,
  peekPendingVideoForAudioTool,
  setPendingVideoForAudioTool,
} from '../src/utils/toolMediaBridge.ts';
import {
  TOOLS_HUB_I18N,
  VIDNEX_TOOLS_REGISTRY,
  getLocalizedRegisteredTools,
  getToolsHubContent,
} from '../src/data/toolsRegistry.ts';
import {
  SUPPORTED_LOCALES,
  buildLlmsTxt,
  getLocalizedPagePath,
  resolveRouteFromPathname,
} from '../src/i18n/config.ts';
import {
  buildHeadMetadataForRoute,
  buildHreflangCluster,
} from '../src/i18n/hreflang.ts';

describe('Video -> MP3 / WAV (100% browser-local)', () => {
  it('validates MP4/MOV/WebM files and enforces 500 MB desktop / 200 MB mobile limits', () => {
    assert.equal(getMaxVideoBytes(false), DESKTOP_MAX_VIDEO_BYTES);
    assert.equal(getMaxVideoBytes(true), MOBILE_MAX_VIDEO_BYTES);
    assert.equal(DESKTOP_MAX_VIDEO_BYTES, 500 * 1024 * 1024);
    assert.equal(MOBILE_MAX_VIDEO_BYTES, 200 * 1024 * 1024);

    // Valid formats
    assert.equal(
      validateVideoFile({ name: 'clip.mp4', type: 'video/mp4', size: 12_000_000 }, false).valid,
      true
    );
    assert.equal(
      validateVideoFile({ name: 'iphone.MOV', type: 'video/quicktime', size: 80_000_000 }, true).valid,
      true
    );
    assert.equal(
      validateVideoFile({ name: 'capture.webm', type: 'video/webm; codecs=vp9,opus', size: 10_000_000 }, false).valid,
      true
    );
    // Extension fallback when browser omits MIME type
    assert.equal(
      validateVideoFile({ name: 'raw.mov', type: '', size: 1024 }, false).valid,
      true
    );

    // Empty file rejected
    const empty = validateVideoFile({ name: 'clip.mp4', type: 'video/mp4', size: 0 }, false);
    assert.equal(empty.valid, false);
    assert.equal(empty.errorCode, 'EMPTY_FILE');

    // Unsupported format rejected
    const unsupported = validateVideoFile(
      { name: 'archive.mkv', type: 'video/x-matroska', size: 5_000_000 },
      false
    );
    assert.equal(unsupported.valid, false);
    assert.equal(unsupported.errorCode, 'UNSUPPORTED_FORMAT');

    // 250 MB allowed on desktop, rejected on mobile
    const midSize = 250 * 1024 * 1024;
    assert.equal(
      validateVideoFile({ name: 'vlog.mp4', type: 'video/mp4', size: midSize }, false).valid,
      true
    );
    const mobileRejected = validateVideoFile(
      { name: 'vlog.mp4', type: 'video/mp4', size: midSize },
      true
    );
    assert.equal(mobileRejected.valid, false);
    assert.equal(mobileRejected.errorCode, 'FILE_TOO_LARGE');

    // 501 MB rejected on desktop
    const desktopRejected = validateVideoFile(
      { name: 'huge.mp4', type: 'video/mp4', size: DESKTOP_MAX_VIDEO_BYTES + 1 },
      false
    );
    assert.equal(desktopRejected.valid, false);
    assert.equal(desktopRejected.errorCode, 'FILE_TOO_LARGE');
  });

  it('clamps trim ranges, formats/parses timecodes, estimates output sizes, and sanitizes filenames', () => {
    assert.deepEqual(clampTrimRange(-5, 999, 12.5), { start: 0, end: 12.5 });
    assert.deepEqual(clampTrimRange(10, 5, 12.5, 0.25), { start: 10, end: 10.25 });
    assert.deepEqual(clampTrimRange(2.345, 7.891, 10), { start: 2.35, end: 7.89 });

    assert.equal(formatTimecode(0), '00:00.0');
    assert.equal(formatTimecode(65.4), '01:05.4');
    assert.equal(parseTimecodeToSeconds('01:05.5'), 65.5);
    assert.equal(parseTimecodeToSeconds('12.25'), 12.25);
    assert.equal(parseTimecodeToSeconds('01:02:03'), 3723);
    assert.equal(parseTimecodeToSeconds('invalid', 4), 4);

    assert.equal(formatByteSize(512), '512 B');
    assert.equal(formatByteSize(2048), '2.0 KB');
    assert.equal(formatByteSize(3 * 1024 * 1024), '3.00 MB');

    const mp3_128 = estimateAudioOutputBytes({
      format: 'mp3',
      durationSec: 10,
      mp3BitrateKbps: 128,
      wavSampleRate: 44100,
      wavChannels: 2,
    });
    const mp3_320 = estimateAudioOutputBytes({
      format: 'mp3',
      durationSec: 10,
      mp3BitrateKbps: 320,
      wavSampleRate: 44100,
      wavChannels: 2,
    });
    assert.equal(mp3_128, 160_000);
    assert.equal(mp3_320, 400_000);
    assert.ok(mp3_320 > mp3_128);

    const wav48Stereo = estimateAudioOutputBytes({
      format: 'wav',
      durationSec: 2,
      mp3BitrateKbps: 192,
      wavSampleRate: 48000,
      wavChannels: 2,
    });
    assert.equal(wav48Stereo, 44 + 48000 * 2 * 2 * 2);

    assert.equal(sanitizeOutputFilename('My Clip.mp4', 'mp3'), 'My-Clip.mp3');
    assert.equal(sanitizeOutputFilename('track<>:"/\\|?*.wav', 'wav'), 'track.wav');
    assert.equal(sanitizeOutputFilename('   ', 'mp3'), 'vidnex-audio.mp3');
  });

  it('processes PCM trimming, channel mixing, resampling, peak normalization, and waveform peaks', () => {
    const sample = createSampleAudioPcm(2, 44100);
    assert.equal(sample.channels.length, 2);
    assert.equal(sample.channels[0].length, 88200);

    // Trim [0.5s, 1.5s] -> ~1s (44,100 frames)
    const trimmed = extractTrimmedPcm(sample.channels, 44100, 0.5, 1.5);
    assert.equal(trimmed.length, 2);
    assert.equal(trimmed[0].length, 44100);

    // Mix stereo -> mono and mono -> stereo
    const mono = mixChannels(trimmed, 1);
    assert.equal(mono.length, 1);
    assert.equal(mono[0].length, 44100);
    const backToStereo = mixChannels(mono, 2);
    assert.equal(backToStereo.length, 2);
    assert.equal(backToStereo[0][100], backToStereo[1][100]);

    // Resample 44.1 kHz -> 48 kHz
    const resampled = resamplePcmLinear(trimmed, 44100, 48000);
    assert.equal(resampled.length, 2);
    assert.equal(resampled[0].length, 48000);

    // Normalize quiet stereo signal uniformly while preserving L/R balance
    const quietLeft = new Float32Array([0, 0.2, -0.1, 0.05]);
    const quietRight = new Float32Array([0, 0.1, -0.05, 0.025]);
    const norm = normalizePcmChannels([quietLeft, quietRight], 0.98);
    assert.ok(Math.abs(norm.gainApplied - 0.98 / 0.2) < 1e-4);
    assert.ok(Math.abs(norm.channels[0][1] - 0.98) < 1e-4);
    assert.ok(Math.abs(norm.channels[1][1] - 0.49) < 1e-4);

    // Silence guard does not amplify zero signal
    const silent = normalizePcmChannels([new Float32Array(64)]);
    assert.equal(silent.gainApplied, 1);

    // Waveform peaks in [0.06, 1.0]
    const peaks = computeWaveformPeaks(sample.channels, 96);
    assert.equal(peaks.length, 96);
    for (const p of peaks) {
      assert.ok(p >= 0.06 && p <= 1, `Peak out of range: ${p}`);
    }
  });

  it('manually encodes valid 16-bit PCM RIFF/WAVE files at 44.1/48 kHz and mono/stereo', () => {
    const sample = createSampleAudioPcm(0.5, 44100);

    for (const sr of WAV_SAMPLE_RATE_OPTIONS) {
      const srPcm = resamplePcmLinear(sample.channels, 44100, sr);
      for (const chCount of [1, 2] as const) {
        const mixed = mixChannels(srPcm, chCount);
        let lastPct = 0;
        const wavBytes = encodeWavFromPcm(mixed, sr, (pct) => {
          lastPct = pct;
        });

        assert.equal(lastPct, 100);
        const expectedLen = 44 + mixed[0].length * chCount * 2;
        assert.equal(wavBytes.byteLength, expectedLen);

        const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);
        const ascii = (start: number, len: number) =>
          String.fromCharCode(...wavBytes.slice(start, start + len));

        assert.equal(ascii(0, 4), 'RIFF');
        assert.equal(view.getUint32(4, true), expectedLen - 8);
        assert.equal(ascii(8, 4), 'WAVE');
        assert.equal(ascii(12, 4), 'fmt ');
        assert.equal(view.getUint16(20, true), 1); // PCM
        assert.equal(view.getUint16(22, true), chCount);
        assert.equal(view.getUint32(24, true), sr);
        assert.equal(view.getUint16(34, true), 16); // 16-bit
        assert.equal(ascii(36, 4), 'data');
        assert.equal(view.getUint32(40, true), mixed[0].length * chCount * 2);
      }
    }
  });

  it('encodes real CBR MP3 files via lamejs across 128/192/256/320 kbps', async () => {
    const sample = createSampleAudioPcm(1, 44100);
    const sizes: number[] = [];

    for (const kbps of MP3_BITRATE_OPTIONS) {
      let lastPct = 0;
      const mp3Bytes = await encodeMp3FromPcm(sample.channels, 44100, kbps, (pct) => {
        lastPct = pct;
      });
      assert.equal(lastPct, 100);
      assert.ok(mp3Bytes.byteLength > 4000, `MP3 ${kbps} kbps unexpectedly small: ${mp3Bytes.byteLength}`);
      // MPEG-1 Layer III frame sync starts with 0xFF and top 3 bits of byte 1 are 111 (0xE0)
      assert.equal(mp3Bytes[0], 0xff);
      assert.equal(mp3Bytes[1] & 0xe0, 0xe0);
      sizes.push(mp3Bytes.byteLength);
    }

    // Higher bitrate produces larger CBR MP3 output
    assert.ok(sizes[0] < sizes[1] && sizes[1] < sizes[2] && sizes[2] < sizes[3]);
  });

  it('transfers TikTok, Instagram, X, and Facebook videos via toolMediaBridge without re-upload', () => {
    clearPendingVideoForAudioTool();
    assert.equal(peekPendingVideoForAudioTool(), null);

    assert.equal(isAudioExtractionSupportedPlatform('tiktok'), true);
    assert.equal(isAudioExtractionSupportedPlatform('instagram'), true);
    assert.equal(isAudioExtractionSupportedPlatform('x'), true);
    assert.equal(isAudioExtractionSupportedPlatform('twitter'), true);
    assert.equal(isAudioExtractionSupportedPlatform('facebook'), true);
    assert.equal(isAudioExtractionSupportedPlatform('linkedin'), false);
    assert.equal(isAudioExtractionSupportedPlatform(null), false);

    setPendingVideoForAudioTool({
      id: 'tiktok-123',
      platform: 'tiktok',
      title: 'Studio Demo Video',
      creatorHandle: '@creator',
      fetchUrl: '/api/download?url=https%3A%2F%2Fcdn.example.com%2Fv.mp4&filename=demo.mp4&inline=1',
      suggestedBaseName: 'studio-demo-video',
    });

    const peeked = peekPendingVideoForAudioTool();
    assert.ok(peeked);
    assert.equal(peeked.platform, 'tiktok');

    // One-shot consume clears the pending item
    const consumed = consumePendingVideoForAudioTool();
    assert.ok(consumed);
    assert.equal(consumed.id, 'tiktok-123');
    assert.equal(peekPendingVideoForAudioTool(), null);
    assert.equal(consumePendingVideoForAudioTool(), null);
  });

  it('registers /tools hub and /tools/video/video-to-mp3 across all 10 locales with hreflang, JSON-LD, and llms.txt', () => {
    assert.ok(VIDNEX_TOOLS_REGISTRY.some((t) => t.id === 'video_to_mp3'));
    assert.ok(VIDNEX_TOOLS_REGISTRY.some((t) => t.id === 'split_image'));
    assert.equal(VIDNEX_TOOLS_REGISTRY.length, 7);

    const mp3Hreflangs = buildHreflangCluster('video_to_mp3');
    assert.equal(mp3Hreflangs.length, 11);
    assert.equal(
      mp3Hreflangs.find((h) => h.hreflang === 'x-default')?.href,
      'https://vidnex.space/en/tools/video/video-to-mp3'
    );

    const hubHreflangs = buildHreflangCluster('tools_hub');
    assert.equal(hubHreflangs.length, 11);
    assert.equal(
      hubHreflangs.find((h) => h.hreflang === 'x-default')?.href,
      'https://vidnex.space/en/tools'
    );

    for (const loc of SUPPORTED_LOCALES) {
      assert.ok(VIDEO_TO_MP3_I18N[loc]);
      assert.ok(TOOLS_HUB_I18N[loc]);
      assert.ok(getVideoToMp3Content(loc).h1.length > 5);
      assert.ok(getToolsHubContent(loc).h1.length > 5);

      const expectedMp3Path =
        loc === 'fr' ? '/tools/video/video-to-mp3' : `/${loc}/tools/video/video-to-mp3`;
      const expectedHubPath = loc === 'fr' ? '/tools' : `/${loc}/tools`;
      assert.equal(getLocalizedPagePath(loc, 'video_to_mp3'), expectedMp3Path);
      assert.equal(getLocalizedPagePath(loc, 'tools_hub'), expectedHubPath);

      const resolvedMp3 = resolveRouteFromPathname(expectedMp3Path);
      assert.equal(resolvedMp3.locale, loc);
      assert.equal(resolvedMp3.pageKey, 'video_to_mp3');

      const resolvedHub = resolveRouteFromPathname(expectedHubPath);
      assert.equal(resolvedHub.locale, loc);
      assert.equal(resolvedHub.pageKey, 'tools_hub');

      const cards = getLocalizedRegisteredTools(loc);
      assert.equal(cards.length, 7);
      const mp3Card = cards.find((c) => c.entry.id === 'video_to_mp3');
      assert.ok(mp3Card);
      assert.equal(mp3Card.href, expectedMp3Path);

      const mp3Meta = buildHeadMetadataForRoute(loc, 'video_to_mp3');
      const graph = (mp3Meta.jsonLdGraph['@graph'] || []) as Array<Record<string, unknown>>;
      assert.ok(graph.some((n) => n['@type'] === 'WebApplication'));
      assert.ok(graph.some((n) => n['@type'] === 'HowTo'));
      assert.ok(graph.some((n) => n['@type'] === 'FAQPage'));
      assert.ok(graph.some((n) => n['@type'] === 'BreadcrumbList'));
    }

    // Legacy /fr/ aliases still resolve cleanly
    const legacyFr = resolveRouteFromPathname('/fr/tools/video/video-to-mp3');
    assert.equal(legacyFr.locale, 'fr');
    assert.equal(legacyFr.pageKey, 'video_to_mp3');
    assert.equal(legacyFr.isLegacyAlias, true);
    assert.equal(legacyFr.canonicalPath, '/tools/video/video-to-mp3');

    const llms = buildLlmsTxt();
    assert.ok(llms.includes('/tools/video/video-to-mp3'));
    assert.ok(llms.includes('/tools'));
    assert.ok(llms.includes('lamejs'));
  });
});
