/// <reference path="../vite-env.d.ts" />
import type { SupportedLocale } from '../i18n/config.ts';

export const DESKTOP_MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB
export const MOBILE_MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB

export type AudioOutputFormat = 'mp3' | 'wav';
export type Mp3BitrateKbps = 128 | 192 | 256 | 320;
export type WavSampleRate = 44100 | 48000;
export type WavChannelCount = 1 | 2;

export const MP3_BITRATE_OPTIONS: readonly Mp3BitrateKbps[] = [
  128, 192, 256, 320,
] as const;

export const WAV_SAMPLE_RATE_OPTIONS: readonly WavSampleRate[] = [
  44100, 48000,
] as const;

export const ACCEPTED_VIDEO_EXTENSIONS = /\.(mp4|mov|m4v|webm)$/i;
export const ACCEPTED_VIDEO_MIMES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
]);

export type VideoValidationErrorCode =
  | 'EMPTY_FILE'
  | 'UNSUPPORTED_FORMAT'
  | 'FILE_TOO_LARGE';

export interface VideoValidationResult {
  valid: boolean;
  errorCode?: VideoValidationErrorCode;
  maxBytes: number;
}

export function detectIsMobileClient(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent || '';
  const uaMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const narrowScreen =
    typeof window.innerWidth === 'number' && window.innerWidth > 0
      ? window.innerWidth <= 768
      : false;
  const coarsePointer =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false;
  return uaMobile || (narrowScreen && coarsePointer);
}

export function getMaxVideoBytes(isMobile: boolean): number {
  return isMobile ? MOBILE_MAX_VIDEO_BYTES : DESKTOP_MAX_VIDEO_BYTES;
}

export function validateVideoFile(
  file: { name: string; type: string; size: number },
  isMobile: boolean
): VideoValidationResult {
  const maxBytes = getMaxVideoBytes(isMobile);

  if (!file || !Number.isFinite(file.size) || file.size <= 0) {
    return { valid: false, errorCode: 'EMPTY_FILE', maxBytes };
  }

  const normalizedMime = (file.type || '').toLowerCase().split(';')[0].trim();
  const hasSupportedMime =
    normalizedMime.length > 0 && ACCEPTED_VIDEO_MIMES.has(normalizedMime);
  const hasSupportedExt = ACCEPTED_VIDEO_EXTENSIONS.test(file.name || '');

  if (!hasSupportedMime && !hasSupportedExt) {
    return { valid: false, errorCode: 'UNSUPPORTED_FORMAT', maxBytes };
  }

  if (file.size > maxBytes) {
    return { valid: false, errorCode: 'FILE_TOO_LARGE', maxBytes };
  }

  return { valid: true, maxBytes };
}

export function clampTrimRange(
  startSec: number,
  endSec: number,
  durationSec: number,
  minClipSec = 0.1
): { start: number; end: number } {
  const safeDuration = Math.max(0, Number.isFinite(durationSec) ? durationSec : 0);
  if (safeDuration <= 0) {
    return { start: 0, end: 0 };
  }
  const safeMin = Math.min(minClipSec, safeDuration);
  let start = Number.isFinite(startSec) ? startSec : 0;
  let end = Number.isFinite(endSec) ? endSec : safeDuration;

  start = Math.max(0, Math.min(safeDuration - safeMin, start));
  end = Math.max(start + safeMin, Math.min(safeDuration, end));
  return {
    start: Math.round(start * 100) / 100,
    end: Math.round(end * 100) / 100,
  };
}

export function formatTimecode(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const tenths = Math.floor((safe - Math.floor(safe)) * 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

export function parseTimecodeToSeconds(raw: string, fallback = 0): number {
  const trimmed = (raw || '').trim();
  if (!trimmed) return fallback;
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const n = parseFloat(trimmed);
    return Number.isFinite(n) ? Math.max(0, n) : fallback;
  }
  const parts = trimmed.split(':').map((p) => parseFloat(p));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) {
    return fallback;
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return fallback;
}

export function formatByteSize(bytes: number): string {
  const safe = Math.max(0, Number.isFinite(bytes) ? bytes : 0);
  if (safe < 1024) return `${Math.round(safe)} B`;
  if (safe < 1024 * 1024) return `${(safe / 1024).toFixed(1)} KB`;
  return `${(safe / (1024 * 1024)).toFixed(2)} MB`;
}

export function estimateAudioOutputBytes(params: {
  format: AudioOutputFormat;
  durationSec: number;
  mp3BitrateKbps: Mp3BitrateKbps;
  wavSampleRate: WavSampleRate;
  wavChannels: WavChannelCount;
}): number {
  const dur = Math.max(0, Number.isFinite(params.durationSec) ? params.durationSec : 0);
  if (dur <= 0) return 0;

  if (params.format === 'mp3') {
    // CBR MP3 byte rate = (kbps * 1000) / 8 bytes/sec + small frame overhead
    return Math.round(((params.mp3BitrateKbps * 1000) / 8) * dur);
  }

  // Uncompressed 16-bit PCM WAV: 44-byte RIFF header + samples * channels * 2 bytes
  const sampleCount = Math.round(dur * params.wavSampleRate);
  return 44 + sampleCount * params.wavChannels * 2;
}

export function sanitizeOutputFilename(
  rawName: string,
  ext: AudioOutputFormat
): string {
  const stripped = (rawName || '')
    .trim()
    .replace(/\.(mp3|wav|mp4|mov|webm|m4v|m4a)$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 100);

  const base = stripped || 'vidnex-audio';
  return `${base}.${ext}`;
}

/**
 * Extracts a trimmed slice [startSec, endSec] from decoded PCM Float32 channels.
 */
export function extractTrimmedPcm(
  channels: readonly Float32Array[],
  sampleRate: number,
  startSec: number,
  endSec: number
): Float32Array[] {
  if (!channels.length || !channels[0].length || sampleRate <= 0) {
    return [];
  }
  const totalSamples = channels[0].length;
  const startSample = Math.max(
    0,
    Math.min(totalSamples - 1, Math.floor(startSec * sampleRate))
  );
  const endSample = Math.max(
    startSample + 1,
    Math.min(totalSamples, Math.ceil(endSec * sampleRate))
  );
  return channels.map((ch) => ch.slice(startSample, endSample));
}

/**
 * Converts PCM channel array to target channel count (1 = mono, 2 = stereo).
 */
export function mixChannels(
  channels: readonly Float32Array[],
  targetChannels: WavChannelCount
): Float32Array[] {
  if (!channels.length) return [];
  const len = channels[0].length;

  if (targetChannels === 1) {
    if (channels.length === 1) {
      return [new Float32Array(channels[0])];
    }
    const mono = new Float32Array(len);
    const numCh = channels.length;
    const inv = 1 / numCh;
    for (let i = 0; i < len; i++) {
      let sum = 0;
      for (let c = 0; c < numCh; c++) {
        sum += channels[c][i] || 0;
      }
      mono[i] = sum * inv;
    }
    return [mono];
  }

  // targetChannels === 2 (Stereo)
  if (channels.length === 1) {
    return [new Float32Array(channels[0]), new Float32Array(channels[0])];
  }
  return [new Float32Array(channels[0]), new Float32Array(channels[1])];
}

/**
 * High-precision linear interpolation resampler (works identically in browser & Node tests).
 */
export function resamplePcmLinear(
  channels: readonly Float32Array[],
  srcSampleRate: number,
  dstSampleRate: number
): Float32Array[] {
  if (!channels.length || srcSampleRate <= 0 || dstSampleRate <= 0) {
    return [];
  }
  if (srcSampleRate === dstSampleRate) {
    return channels.map((ch) => new Float32Array(ch));
  }

  const srcLen = channels[0].length;
  const ratio = srcSampleRate / dstSampleRate;
  const dstLen = Math.max(1, Math.round(srcLen / ratio));

  return channels.map((src) => {
    const dst = new Float32Array(dstLen);
    for (let i = 0; i < dstLen; i++) {
      const srcPos = i * ratio;
      const idx = Math.floor(srcPos);
      const frac = srcPos - idx;
      const s0 = src[idx] ?? 0;
      const s1 = src[idx + 1] ?? s0;
      dst[i] = s0 + (s1 - s0) * frac;
    }
    return dst;
  });
}

/**
 * Peak-normalizes audio channels uniformly (preserving stereo balance) to targetPeak (-0.17 dBFS by default).
 * Safely skips near-silent clips so noise floors are not blown up.
 */
export function normalizePcmChannels(
  channels: readonly Float32Array[],
  targetPeak = 0.98
): { channels: Float32Array[]; gainApplied: number; originalPeak: number } {
  if (!channels.length) {
    return { channels: [], gainApplied: 1, originalPeak: 0 };
  }

  let peak = 0;
  for (let c = 0; c < channels.length; c++) {
    const ch = channels[c];
    for (let i = 0; i < ch.length; i++) {
      const abs = Math.abs(ch[i]);
      if (abs > peak) peak = abs;
    }
  }

  // Silence guard (< -80 dBFS)
  if (peak < 1e-4) {
    return {
      channels: channels.map((ch) => new Float32Array(ch)),
      gainApplied: 1,
      originalPeak: peak,
    };
  }

  // Cap gain at +30 dB (~31.6x) to avoid amplifying dead noise
  const rawGain = targetPeak / peak;
  const gain = Math.min(rawGain, 31.6228);

  const out = channels.map((ch) => {
    const res = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) {
      const v = ch[i] * gain;
      res[i] = v > 1 ? 1 : v < -1 ? -1 : v;
    }
    return res;
  });

  return { channels: out, gainApplied: gain, originalPeak: peak };
}

/**
 * Computes normalized peak bars in [0.06, 1.0] for rendering the interactive waveform.
 */
export function computeWaveformPeaks(
  channels: readonly Float32Array[],
  barCount = 120
): number[] {
  const safeBars = Math.max(16, Math.min(400, Math.round(barCount)));
  if (!channels.length || !channels[0].length) {
    return Array.from({ length: safeBars }, () => 0.1);
  }

  const totalSamples = channels[0].length;
  const numChannels = channels.length;
  const samplesPerBar = totalSamples / safeBars;
  const rawPeaks = new Float32Array(safeBars);
  let maxPeak = 0;

  for (let b = 0; b < safeBars; b++) {
    const start = Math.floor(b * samplesPerBar);
    const end = Math.max(start + 1, Math.min(totalSamples, Math.floor((b + 1) * samplesPerBar)));
    // Stride sampling for huge buffers so waveform calculation stays instantaneous
    const stride = Math.max(1, Math.floor((end - start) / 128));
    let barPeak = 0;
    for (let i = start; i < end; i += stride) {
      let sampleAbs = 0;
      for (let c = 0; c < numChannels; c++) {
        sampleAbs += Math.abs(channels[c][i] || 0);
      }
      sampleAbs /= numChannels;
      if (sampleAbs > barPeak) barPeak = sampleAbs;
    }
    rawPeaks[b] = barPeak;
    if (barPeak > maxPeak) maxPeak = barPeak;
  }

  const scale = maxPeak > 1e-4 ? 1 / maxPeak : 1;
  const normalized: number[] = [];
  for (let b = 0; b < safeBars; b++) {
    const v = Math.min(1, rawPeaks[b] * scale);
    normalized.push(Math.max(0.06, Math.round(v * 1000) / 1000));
  }
  return normalized;
}

function floatToInt16Sample(sample: number): number {
  const clamped = sample > 1 ? 1 : sample < -1 ? -1 : sample;
  return clamped < 0
    ? Math.round(clamped * 32768)
    : Math.round(clamped * 32767);
}

/**
 * Manual 16-bit PCM RIFF/WAVE encoder (zero dependencies, 100% browser / Node compatible).
 */
export function encodeWavFromPcm(
  channels: readonly Float32Array[],
  sampleRate: number,
  onProgress?: (pct: number) => void
): Uint8Array {
  const numChannels = Math.max(1, Math.min(2, channels.length));
  const numFrames = channels[0]?.length || 0;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF chunk descriptor
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');

  // fmt sub-chunk
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM subchunk size
  view.setUint16(20, 1, true); // AudioFormat = 1 (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample = 16

  // data sub-chunk
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const reportStep = Math.max(1, Math.floor(numFrames / 20));
  const left = channels[0];
  const right = numChannels > 1 ? channels[1] : left;

  for (let i = 0; i < numFrames; i++) {
    view.setInt16(offset, floatToInt16Sample(left[i]), true);
    offset += 2;
    if (numChannels > 1) {
      view.setInt16(offset, floatToInt16Sample(right[i]), true);
      offset += 2;
    }
    if (onProgress && i % reportStep === 0) {
      onProgress(Math.min(99, Math.round((i / Math.max(1, numFrames)) * 100)));
    }
  }

  if (onProgress) onProgress(100);
  return new Uint8Array(buffer);
}

interface LameMp3EncoderInstance {
  encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array;
  flush(): Int8Array;
}

interface LameJsModule {
  Mp3Encoder: new (
    channels: number,
    samplerate: number,
    kbps: number
  ) => LameMp3EncoderInstance;
}

let cachedLameJs: LameJsModule | null = null;

/**
 * Lazy-loads the self-contained `lamejs/lame.min.js` bundle so:
 * 1) Zero bytes are added to the main VIDNEX initial bundle.
 * 2) `lamejs@1.2.1` runs cleanly in strict ESM / Vite production builds without
 *    triggering the notorious unbundled `MPEGMode is not defined` bug.
 */
export async function loadLameJs(): Promise<LameJsModule> {
  if (cachedLameJs) return cachedLameJs;

  let rawCode: string | null = null;

  // Node.js unit-test fallback via builtin fs
  try {
    const proc = (
      globalThis as unknown as {
        process?: {
          versions?: { node?: string };
          cwd?: () => string;
          getBuiltinModule?: (id: string) => {
            existsSync: (p: string) => boolean;
            readFileSync: (p: string, enc: string) => string;
          };
        };
      }
    ).process;
    if (proc?.versions?.node && typeof proc.getBuiltinModule === 'function') {
      const fs = proc.getBuiltinModule('node:fs');
      const pathMod = proc.getBuiltinModule('node:path') as unknown as {
        join: (...parts: string[]) => string;
      };
      const filePath = pathMod.join(
        proc.cwd ? proc.cwd() : '.',
        'node_modules',
        'lamejs',
        'lame.min.js'
      );
      if (fs.existsSync(filePath)) {
        rawCode = fs.readFileSync(filePath, 'utf8');
      }
    }
  } catch {
    // Ignore outside Node.js
  }

  if (!rawCode) {
    const mod = await import('lamejs/lame.min.js?raw');
    rawCode = mod.default;
  }

  const factory = new Function(
    'exports',
    'module',
    `${rawCode}\n;return typeof lamejs !== 'undefined' ? lamejs : module.exports;`
  );
  const exportsObj: Record<string, unknown> = {};
  const moduleObj = { exports: exportsObj };
  const loaded = factory(exportsObj, moduleObj) as LameJsModule;

  if (!loaded || typeof loaded.Mp3Encoder !== 'function') {
    throw new Error('LAMEJS_LOAD_FAILED');
  }

  cachedLameJs = loaded;
  return loaded;
}

/**
 * Encodes Float32 PCM channels into a standard CBR MP3 byte array using `lamejs`.
 * Yields periodically to the event loop so the browser progress bar stays smooth.
 */
export async function encodeMp3FromPcm(
  channels: readonly Float32Array[],
  sampleRate: number,
  bitrateKbps: Mp3BitrateKbps,
  onProgress?: (pct: number) => void
): Promise<Uint8Array> {
  const lame = await loadLameJs();
  const numChannels = Math.max(1, Math.min(2, channels.length));
  const numFrames = channels[0]?.length || 0;
  const encoder = new lame.Mp3Encoder(numChannels, sampleRate, bitrateKbps);

  const leftFloat = channels[0];
  const rightFloat = numChannels > 1 ? channels[1] : leftFloat;

  const chunkSize = 1152 * 16; // 18,432 samples (~0.4s per batch)
  const mp3Chunks: Uint8Array[] = [];
  let totalBytes = 0;

  let batchCount = 0;
  for (let offset = 0; offset < numFrames; offset += chunkSize) {
    const end = Math.min(numFrames, offset + chunkSize);
    const len = end - offset;
    const leftInt16 = new Int16Array(len);
    const rightInt16 = numChannels > 1 ? new Int16Array(len) : undefined;

    for (let i = 0; i < len; i++) {
      leftInt16[i] = floatToInt16Sample(leftFloat[offset + i]);
      if (rightInt16) {
        rightInt16[i] = floatToInt16Sample(rightFloat[offset + i]);
      }
    }

    const encoded =
      numChannels > 1 && rightInt16
        ? encoder.encodeBuffer(leftInt16, rightInt16)
        : encoder.encodeBuffer(leftInt16);

    if (encoded.length > 0) {
      const u8 = new Uint8Array(
        encoded.buffer,
        encoded.byteOffset,
        encoded.byteLength
      ).slice();
      mp3Chunks.push(u8);
      totalBytes += u8.length;
    }

    if (onProgress) {
      onProgress(Math.min(98, Math.round((end / Math.max(1, numFrames)) * 98)));
    }

    batchCount++;
    if (batchCount % 4 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) {
    const u8 = new Uint8Array(
      flushed.buffer,
      flushed.byteOffset,
      flushed.byteLength
    ).slice();
    mp3Chunks.push(u8);
    totalBytes += u8.length;
  }

  const output = new Uint8Array(totalBytes);
  let writeOffset = 0;
  for (const chunk of mp3Chunks) {
    output.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }

  if (onProgress) onProgress(100);
  return output;
}

/**
 * Generates a short pleasant musical chord AudioBuffer / PCM demo locally (zero network)
 * so users can test waveform trimming, normalization, preview, and MP3/WAV export in 1 click.
 */
export function createSampleAudioPcm(
  durationSec = 6,
  sampleRate = 44100
): { channels: Float32Array[]; sampleRate: number; duration: number } {
  const numFrames = Math.round(durationSec * sampleRate);
  const left = new Float32Array(numFrames);
  const right = new Float32Array(numFrames);
  const freqs = [261.63, 329.63, 392.0, 523.25]; // C major studio chord

  for (let i = 0; i < numFrames; i++) {
    const t = i / sampleRate;
    // Dynamic envelope so the waveform visibly pulses across the timeline
    const beat = 0.35 + 0.65 * Math.abs(Math.sin(Math.PI * t * 1.25));
    const fadeIn = Math.min(1, t / 0.25);
    const fadeOut = Math.min(1, (durationSec - t) / 0.4);
    const env = beat * fadeIn * fadeOut * 0.22;

    let sumL = 0;
    let sumR = 0;
    for (let f = 0; f < freqs.length; f++) {
      const phase = 2 * Math.PI * freqs[f] * t;
      sumL += Math.sin(phase) * (f % 2 === 0 ? 0.35 : 0.22);
      sumR += Math.sin(phase + 0.35) * (f % 2 === 1 ? 0.35 : 0.22);
    }
    left[i] = sumL * env;
    right[i] = sumR * env;
  }

  return { channels: [left, right], sampleRate, duration: durationSec };
}

export interface VideoToMp3LocaleContent {
  navLabel: string;
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  ogImageAlt: string;
  breadcrumbLabel: string;
  badgeText: string;
  h1: string;
  subtitle: string;
  dropzoneTitle: string;
  dropzoneSubtitle: string;
  selectFileCta: string;
  loadSampleCta: string;
  changeVideoCta: string;
  limitBadgeDesktop: string;
  limitBadgeMobile: string;
  importingFromDownloader: string;
  importedFromBadge: string;
  decodingStatus: string;
  waveformHeading: string;
  trimStartLabel: string;
  trimEndLabel: string;
  clipDurationLabel: string;
  totalDurationLabel: string;
  previewClipPlay: string;
  previewClipStop: string;
  resetTrimCta: string;
  settingsHeading: string;
  formatLabel: string;
  formatMp3: string;
  formatWav: string;
  bitrateLabel: string;
  sampleRateLabel: string;
  channelsLabel: string;
  channelStereo: string;
  channelMono: string;
  normalizeLabel: string;
  normalizeHint: string;
  estimatedSizeLabel: string;
  convertToMp3Cta: string;
  convertToWavCta: string;
  convertingStatus: string;
  progressEncodingMp3: string;
  progressEncodingWav: string;
  progressNormalizing: string;
  resultHeading: string;
  filenameLabel: string;
  downloadAudioCta: string;
  actualSizeLabel: string;
  privacyNotice: string;
  errorUnsupportedFormat: string;
  errorFileTooLargeDesktop: string;
  errorFileTooLargeMobile: string;
  errorDecodeFailed: string;
  errorEmptyFile: string;
  errorTransferFailed: string;
  downloaderExtractAudioBtn: string;
  downloaderExtractAudioSub: string;
}

export const VIDEO_TO_MP3_I18N: Record<SupportedLocale, VideoToMp3LocaleContent> = {
  fr: {
    navLabel: 'Vidéo → MP3 / WAV',
    metaTitle: 'Convertir Vidéo en MP3 / WAV en ligne (Local) — VIDNEX',
    metaDescription:
      'Extrayez l’audio MP3 (128–320 kbps) ou WAV depuis une vidéo MP4, MOV ou WebM dans votre navigateur. Découpe forme d’onde, normalisation, zéro upload.',
    ogTitle: 'Convertir Vidéo en MP3 / WAV en ligne (Local) — VIDNEX',
    ogDescription:
      'Extrayez l’audio MP3 (128–320 kbps) ou WAV depuis une vidéo MP4, MOV ou WebM dans votre navigateur. Découpe forme d’onde, normalisation, zéro upload.',
    ogImageAlt: 'Outil VIDNEX Vidéo vers MP3 et WAV 100 % navigateur avec forme d’onde',
    breadcrumbLabel: 'Vidéo → MP3 / WAV',
    badgeText: '100 % NAVIGATEUR · WEB AUDIO + LAMEJS · AUCUN UPLOAD',
    h1: 'Convertisseur Vidéo → MP3 / WAV',
    subtitle:
      'Extrayez la piste audio d’une vidéo MP4, MOV ou WebM en MP3 ou WAV directement sur votre appareil, avec découpe par forme d’onde et normalisation.',
    dropzoneTitle: 'Glissez-déposez votre fichier vidéo ici',
    dropzoneSubtitle: 'Formats pris en charge : MP4, MOV, WebM · Traitement 100 % local',
    selectFileCta: 'Choisir une vidéo',
    loadSampleCta: 'Tester avec un extrait démo',
    changeVideoCta: 'Changer de vidéo',
    limitBadgeDesktop: 'Limite ordinateur : 500 Mo',
    limitBadgeMobile: 'Limite mobile : 200 Mo',
    importingFromDownloader: 'Chargement de la vidéo depuis le téléchargeur VIDNEX…',
    importedFromBadge: 'Vidéo reçue depuis le téléchargeur VIDNEX (zéro re-upload)',
    decodingStatus: 'Décodage de la piste audio via Web Audio API…',
    waveformHeading: 'Forme d’onde & découpe de l’extrait',
    trimStartLabel: 'Début',
    trimEndLabel: 'Fin',
    clipDurationLabel: 'Durée sélectionnée',
    totalDurationLabel: 'Durée totale',
    previewClipPlay: 'Écouter l’extrait',
    previewClipStop: 'Arrêter l’écoute',
    resetTrimCta: 'Réinitialiser',
    settingsHeading: 'Paramètres audio & export',
    formatLabel: 'Format de sortie',
    formatMp3: 'MP3 (Compressé)',
    formatWav: 'WAV (PCM sans perte)',
    bitrateLabel: 'Débit MP3',
    sampleRateLabel: 'Fréquence WAV',
    channelsLabel: 'Canaux audio',
    channelStereo: 'Stéréo (2 canaux)',
    channelMono: 'Mono (1 canal)',
    normalizeLabel: 'Normaliser le volume',
    normalizeHint: 'Aligne automatiquement le pic sonore à -0,2 dB sans saturation.',
    estimatedSizeLabel: 'Taille estimée',
    convertToMp3Cta: 'Convertir en MP3',
    convertToWavCta: 'Convertir en WAV',
    convertingStatus: 'Encodage local en cours…',
    progressEncodingMp3: 'Encodage MP3 via lamejs',
    progressEncodingWav: 'Assemblage WAV PCM 16-bit',
    progressNormalizing: 'Normalisation du volume…',
    resultHeading: 'Audio prêt — Aperçu & téléchargement',
    filenameLabel: 'Nom du fichier',
    downloadAudioCta: 'Télécharger l’audio',
    actualSizeLabel: 'Taille finale',
    privacyNotice:
      'Traitement 100 % navigateur (Web Audio API & lamejs). Votre fichier vidéo n’est jamais envoyé vers un serveur.',
    errorUnsupportedFormat:
      'Format non pris en charge. Veuillez déposer un fichier vidéo MP4, MOV ou WebM.',
    errorFileTooLargeDesktop:
      'Fichier trop volumineux : la limite sur ordinateur est de 500 Mo pour éviter de saturer la mémoire du navigateur.',
    errorFileTooLargeMobile:
      'Fichier trop volumineux : la limite sur mobile est de 200 Mo pour éviter de saturer la mémoire du navigateur.',
    errorDecodeFailed:
      'Votre navigateur ne parvient pas à lire la piste audio de cette vidéo (codec non supporté ou vidéo muette). Essayez un fichier MP4 (AAC) ou WebM standard.',
    errorEmptyFile: 'Le fichier sélectionné est vide ou illisible.',
    errorTransferFailed:
      'Impossible de récupérer la vidéo depuis le téléchargeur. Téléchargez-la d’abord puis déposez-la ci-dessous.',
    downloaderExtractAudioBtn: 'Extraire l’audio (MP3)',
    downloaderExtractAudioSub: 'Ouvrir dans l’outil MP3/WAV',
  },
  en: {
    navLabel: 'Video → MP3 / WAV',
    metaTitle: 'Video to MP3 / WAV Converter Online (Local) — VIDNEX',
    metaDescription:
      'Extract MP3 (128–320 kbps) or WAV audio from MP4, MOV, or WebM videos 100% in your browser. Waveform trimmer, volume normalization, zero upload.',
    ogTitle: 'Video to MP3 / WAV Converter Online (Local) — VIDNEX',
    ogDescription:
      'Extract MP3 (128–320 kbps) or WAV audio from MP4, MOV, or WebM videos 100% in your browser. Waveform trimmer, volume normalization, zero upload.',
    ogImageAlt: 'VIDNEX browser-based Video to MP3 and WAV audio converter with waveform',
    breadcrumbLabel: 'Video → MP3 / WAV',
    badgeText: '100% BROWSER · WEB AUDIO + LAMEJS · ZERO UPLOAD',
    h1: 'Video → MP3 / WAV Converter',
    subtitle:
      'Extract clean MP3 or uncompressed WAV audio from MP4, MOV, and WebM videos locally in your browser with waveform trimming and volume normalization.',
    dropzoneTitle: 'Drag & drop your video file here',
    dropzoneSubtitle: 'Supported formats: MP4, MOV, WebM · 100% local browser processing',
    selectFileCta: 'Choose a video',
    loadSampleCta: 'Try demo clip',
    changeVideoCta: 'Change video',
    limitBadgeDesktop: 'Desktop limit: 500 MB',
    limitBadgeMobile: 'Mobile limit: 200 MB',
    importingFromDownloader: 'Loading video from VIDNEX downloader…',
    importedFromBadge: 'Video loaded directly from VIDNEX downloader (no re-upload)',
    decodingStatus: 'Decoding audio track via Web Audio API…',
    waveformHeading: 'Waveform & clip trimmer',
    trimStartLabel: 'Start',
    trimEndLabel: 'End',
    clipDurationLabel: 'Selected clip',
    totalDurationLabel: 'Total duration',
    previewClipPlay: 'Preview clip',
    previewClipStop: 'Stop preview',
    resetTrimCta: 'Reset trim',
    settingsHeading: 'Audio settings & export',
    formatLabel: 'Output format',
    formatMp3: 'MP3 (Compressed)',
    formatWav: 'WAV (Lossless PCM)',
    bitrateLabel: 'MP3 Bitrate',
    sampleRateLabel: 'WAV Sample Rate',
    channelsLabel: 'Audio channels',
    channelStereo: 'Stereo (2 ch)',
    channelMono: 'Mono (1 ch)',
    normalizeLabel: 'Normalize volume',
    normalizeHint: 'Automatically scales peak loudness to -0.2 dB without clipping.',
    estimatedSizeLabel: 'Estimated size',
    convertToMp3Cta: 'Convert to MP3',
    convertToWavCta: 'Convert to WAV',
    convertingStatus: 'Encoding locally…',
    progressEncodingMp3: 'Encoding MP3 with lamejs',
    progressEncodingWav: 'Building 16-bit PCM WAV',
    progressNormalizing: 'Normalizing audio volume…',
    resultHeading: 'Audio ready — Preview & download',
    filenameLabel: 'File name',
    downloadAudioCta: 'Download audio',
    actualSizeLabel: 'Final size',
    privacyNotice:
      '100% browser processing (Web Audio API & lamejs). Your video file is never uploaded to any server.',
    errorUnsupportedFormat:
      'Unsupported format. Please select an MP4, MOV, or WebM video file.',
    errorFileTooLargeDesktop:
      'File too large: desktop limit is 500 MB to keep browser memory stable.',
    errorFileTooLargeMobile:
      'File too large: mobile limit is 200 MB to keep browser memory stable.',
    errorDecodeFailed:
      'Your browser could not decode the audio track from this video (unsupported codec or silent video). Try a standard MP4 (AAC) or WebM file.',
    errorEmptyFile: 'The selected file is empty or unreadable.',
    errorTransferFailed:
      'Could not load the video from the downloader. Save it first and drop it below.',
    downloaderExtractAudioBtn: 'Extract Audio (MP3)',
    downloaderExtractAudioSub: 'Open in MP3/WAV studio',
  },
  ar: {
    navLabel: 'فيديو ← MP3 / WAV',
    metaTitle: 'تحويل الفيديو إلى MP3 / WAV في المتصفح — VIDNEX',
    metaDescription:
      'استخرج الصوت بصيغة MP3 أو WAV من فيديوهات MP4 وMOV وWebM محلياً في المتصفح مع قص الموجة الصوتية وتطبيع الصوت دون رفع أي ملفات.',
    ogTitle: 'تحويل الفيديو إلى MP3 / WAV في المتصفح — VIDNEX',
    ogDescription:
      'استخرج الصوت بصيغة MP3 أو WAV من فيديوهات MP4 وMOV وWebM محلياً في المتصفح مع قص الموجة الصوتية وتطبيع الصوت دون رفع أي ملفات.',
    ogImageAlt: 'أداة VIDNEX لتحويل الفيديو إلى MP3 وWAV داخل المتصفح',
    breadcrumbLabel: 'فيديو ← MP3 / WAV',
    badgeText: '100% في المتصفح · WEB AUDIO + LAMEJS · بدون رفع',
    h1: 'محول الفيديو ← MP3 / WAV',
    subtitle:
      'استخرج الصوت من فيديوهات MP4 وMOV وWebM بصيغة MP3 أو WAV مباشرة على جهازك مع قص المقطع بالموجة الصوتية وتطبيع مستوى الصوت.',
    dropzoneTitle: 'اسحب ملف الفيديو وأفلته هنا',
    dropzoneSubtitle: 'الصيغ المدعومة: MP4، MOV، WebM · معالجة محلية 100%',
    selectFileCta: 'اختر فيديو',
    loadSampleCta: 'تجربة مقطع تجريبي',
    changeVideoCta: 'تغيير الفيديو',
    limitBadgeDesktop: 'حد الحاسوب: 500 ميغابايت',
    limitBadgeMobile: 'حد الهاتف: 200 ميغابايت',
    importingFromDownloader: 'جارٍ تحميل الفيديو من أداة التنزيل…',
    importedFromBadge: 'تم استلام الفيديو مباشرة من VIDNEX (بدون إعادة رفع)',
    decodingStatus: 'جارٍ فك ترميز المسار الصوتي عبر Web Audio API…',
    waveformHeading: 'الموجة الصوتية وقص المقطع',
    trimStartLabel: 'البداية',
    trimEndLabel: 'النهاية',
    clipDurationLabel: 'مدة المقطع المحدد',
    totalDurationLabel: 'المدة الكلية',
    previewClipPlay: 'تشغيل المقطع',
    previewClipStop: 'إيقاف المعاينة',
    resetTrimCta: 'إعادة تعيين',
    settingsHeading: 'إعدادات الصوت والتصدير',
    formatLabel: 'صيغة الإخراج',
    formatMp3: 'MP3 (مضغوط)',
    formatWav: 'WAV (بدون فقدان)',
    bitrateLabel: 'معدل بت MP3',
    sampleRateLabel: 'تردد WAV',
    channelsLabel: 'قنوات الصوت',
    channelStereo: 'ستيريو (قناتان)',
    channelMono: 'مونو (قناة واحدة)',
    normalizeLabel: 'تطبيع مستوى الصوت',
    normalizeHint: 'يرفع ذروة الصوت تلقائياً إلى ‎-0.2 dB دون تشويه.',
    estimatedSizeLabel: 'الحجم التقديري',
    convertToMp3Cta: 'تحويل إلى MP3',
    convertToWavCta: 'تحويل إلى WAV',
    convertingStatus: 'جارٍ الترميز محلياً…',
    progressEncodingMp3: 'ترميز MP3 عبر lamejs',
    progressEncodingWav: 'إنشاء ملف WAV 16-bit',
    progressNormalizing: 'تطبيع مستوى الصوت…',
    resultHeading: 'الصوت جاهز — المعاينة والتنزيل',
    filenameLabel: 'اسم الملف',
    downloadAudioCta: 'تنزيل الصوت',
    actualSizeLabel: 'الحجم النهائي',
    privacyNotice:
      'معالجة محلية 100% في المتصفح (Web Audio API وlamejs). لا يتم رفع الفيديو إلى أي خادم أبداً.',
    errorUnsupportedFormat:
      'صيغة غير مدعومة. يرجى اختيار ملف فيديو MP4 أو MOV أو WebM.',
    errorFileTooLargeDesktop:
      'الملف كبير جداً: الحد الأقصى على الحاسوب هو 500 ميغابايت لحماية ذاكرة المتصفح.',
    errorFileTooLargeMobile:
      'الملف كبير جداً: الحد الأقصى على الهاتف هو 200 ميغابايت لحماية ذاكرة المتصفح.',
    errorDecodeFailed:
      'تعذر على المتصفح قراءة المسار الصوتي لهذا الفيديو (ترميز غير مدعوم أو فيديو بلا صوت). جرّب ملف MP4 أو WebM قياسي.',
    errorEmptyFile: 'الملف المحدد فارغ أو غير قابل للقراءة.',
    errorTransferFailed:
      'تعذر جلب الفيديو من أداة التنزيل. نزّله أولاً ثم أفلته هنا.',
    downloaderExtractAudioBtn: 'استخراج الصوت (MP3)',
    downloaderExtractAudioSub: 'فتح في أداة MP3/WAV',
  },
  es: {
    navLabel: 'Vídeo → MP3 / WAV',
    metaTitle: 'Convertir Vídeo a MP3 / WAV Online (Local) — VIDNEX',
    metaDescription:
      'Extrae audio MP3 (128–320 kbps) o WAV desde vídeos MP4, MOV o WebM en tu navegador. Recorte con forma de onda, normalización y cero subidas.',
    ogTitle: 'Convertir Vídeo a MP3 / WAV Online (Local) — VIDNEX',
    ogDescription:
      'Extrae audio MP3 (128–320 kbps) o WAV desde vídeos MP4, MOV o WebM en tu navegador. Recorte con forma de onda, normalización y cero subidas.',
    ogImageAlt: 'Convertidor VIDNEX de vídeo a MP3 y WAV 100 % en navegador',
    breadcrumbLabel: 'Vídeo → MP3 / WAV',
    badgeText: '100 % NAVEGADOR · WEB AUDIO + LAMEJS · SIN SUBIDAS',
    h1: 'Convertidor de Vídeo → MP3 / WAV',
    subtitle:
      'Extrae el audio de cualquier vídeo MP4, MOV o WebM en MP3 o WAV directamente en tu dispositivo, con recorte por forma de onda y normalización.',
    dropzoneTitle: 'Arrastra y suelta tu archivo de vídeo aquí',
    dropzoneSubtitle: 'Formatos admitidos: MP4, MOV, WebM · Procesamiento 100 % local',
    selectFileCta: 'Elegir un vídeo',
    loadSampleCta: 'Probar clip demo',
    changeVideoCta: 'Cambiar vídeo',
    limitBadgeDesktop: 'Límite escritorio: 500 MB',
    limitBadgeMobile: 'Límite móvil: 200 MB',
    importingFromDownloader: 'Cargando vídeo desde el descargador VIDNEX…',
    importedFromBadge: 'Vídeo recibido desde el descargador VIDNEX (sin resubir)',
    decodingStatus: 'Decodificando pista de audio con Web Audio API…',
    waveformHeading: 'Forma de onda y recorte del fragmento',
    trimStartLabel: 'Inicio',
    trimEndLabel: 'Fin',
    clipDurationLabel: 'Duración seleccionada',
    totalDurationLabel: 'Duración total',
    previewClipPlay: 'Escuchar fragmento',
    previewClipStop: 'Detener vista previa',
    resetTrimCta: 'Restablecer',
    settingsHeading: 'Ajustes de audio y exportación',
    formatLabel: 'Formato de salida',
    formatMp3: 'MP3 (Comprimido)',
    formatWav: 'WAV (PCM sin pérdida)',
    bitrateLabel: 'Tasa MP3',
    sampleRateLabel: 'Frecuencia WAV',
    channelsLabel: 'Canales de audio',
    channelStereo: 'Estéreo (2 canales)',
    channelMono: 'Mono (1 canal)',
    normalizeLabel: 'Normalizar volumen',
    normalizeHint: 'Ajusta el pico de volumen a -0,2 dB automáticamente sin distorsión.',
    estimatedSizeLabel: 'Tamaño estimado',
    convertToMp3Cta: 'Convertir a MP3',
    convertToWavCta: 'Convertir a WAV',
    convertingStatus: 'Codificando localmente…',
    progressEncodingMp3: 'Codificando MP3 con lamejs',
    progressEncodingWav: 'Creando WAV PCM 16-bit',
    progressNormalizing: 'Normalizando volumen…',
    resultHeading: 'Audio listo — Vista previa y descarga',
    filenameLabel: 'Nombre del archivo',
    downloadAudioCta: 'Descargar audio',
    actualSizeLabel: 'Tamaño final',
    privacyNotice:
      'Procesamiento 100 % en navegador (Web Audio API y lamejs). Tu vídeo nunca se sube a ningún servidor.',
    errorUnsupportedFormat:
      'Formato no compatible. Selecciona un archivo de vídeo MP4, MOV o WebM.',
    errorFileTooLargeDesktop:
      'Archivo demasiado grande: el límite en ordenador es de 500 MB para proteger la memoria del navegador.',
    errorFileTooLargeMobile:
      'Archivo demasiado grande: el límite en móvil es de 200 MB para proteger la memoria del navegador.',
    errorDecodeFailed:
      'Tu navegador no puede leer la pista de audio de este vídeo (códec no compatible o vídeo sin sonido). Prueba un MP4 (AAC) o WebM estándar.',
    errorEmptyFile: 'El archivo seleccionado está vacío o no se puede leer.',
    errorTransferFailed:
      'No se pudo cargar el vídeo desde el descargador. Descárgalo primero y suéltalo aquí.',
    downloaderExtractAudioBtn: 'Extraer audio (MP3)',
    downloaderExtractAudioSub: 'Abrir en herramienta MP3/WAV',
  },
  pt: {
    navLabel: 'Vídeo → MP3 / WAV',
    metaTitle: 'Converter Vídeo para MP3 / WAV Online (Local) — VIDNEX',
    metaDescription:
      'Extraia áudio MP3 (128–320 kbps) ou WAV de vídeos MP4, MOV ou WebM no navegador. Recorte com forma de onda, normalização e zero upload.',
    ogTitle: 'Converter Vídeo para MP3 / WAV Online (Local) — VIDNEX',
    ogDescription:
      'Extraia áudio MP3 (128–320 kbps) ou WAV de vídeos MP4, MOV ou WebM no navegador. Recorte com forma de onda, normalização e zero upload.',
    ogImageAlt: 'Conversor VIDNEX de vídeo para MP3 e WAV 100% no navegador',
    breadcrumbLabel: 'Vídeo → MP3 / WAV',
    badgeText: '100% NAVEGADOR · WEB AUDIO + LAMEJS · SEM UPLOAD',
    h1: 'Conversor de Vídeo → MP3 / WAV',
    subtitle:
      'Extraia áudio MP3 ou WAV de vídeos MP4, MOV e WebM diretamente no seu navegador, com recorte por forma de onda e normalização de volume.',
    dropzoneTitle: 'Arraste e solte seu arquivo de vídeo aqui',
    dropzoneSubtitle: 'Formatos suportados: MP4, MOV, WebM · Processamento 100% local',
    selectFileCta: 'Escolher vídeo',
    loadSampleCta: 'Testar clipe demo',
    changeVideoCta: 'Trocar vídeo',
    limitBadgeDesktop: 'Limite desktop: 500 MB',
    limitBadgeMobile: 'Limite mobile: 200 MB',
    importingFromDownloader: 'Carregando vídeo do downloader VIDNEX…',
    importedFromBadge: 'Vídeo recebido do downloader VIDNEX (sem re-upload)',
    decodingStatus: 'Decodificando faixa de áudio via Web Audio API…',
    waveformHeading: 'Forma de onda e recorte do trecho',
    trimStartLabel: 'Início',
    trimEndLabel: 'Fim',
    clipDurationLabel: 'Duração selecionada',
    totalDurationLabel: 'Duração total',
    previewClipPlay: 'Ouvir trecho',
    previewClipStop: 'Parar prévia',
    resetTrimCta: 'Redefinir',
    settingsHeading: 'Configurações de áudio e exportação',
    formatLabel: 'Formato de saída',
    formatMp3: 'MP3 (Comprimido)',
    formatWav: 'WAV (PCM sem perdas)',
    bitrateLabel: 'Taxa de bits MP3',
    sampleRateLabel: 'Taxa WAV',
    channelsLabel: 'Canais de áudio',
    channelStereo: 'Estéreo (2 canais)',
    channelMono: 'Mono (1 canal)',
    normalizeLabel: 'Normalizar volume',
    normalizeHint: 'Ajusta o pico sonoro para -0,2 dB automaticamente sem distorção.',
    estimatedSizeLabel: 'Tamanho estimado',
    convertToMp3Cta: 'Converter para MP3',
    convertToWavCta: 'Converter para WAV',
    convertingStatus: 'Codificando localmente…',
    progressEncodingMp3: 'Codificando MP3 com lamejs',
    progressEncodingWav: 'Gerando WAV PCM 16-bit',
    progressNormalizing: 'Normalizando volume…',
    resultHeading: 'Áudio pronto — Prévia e download',
    filenameLabel: 'Nome do arquivo',
    downloadAudioCta: 'Baixar áudio',
    actualSizeLabel: 'Tamanho final',
    privacyNotice:
      'Processamento 100% no navegador (Web Audio API e lamejs). Seu vídeo nunca é enviado para servidores.',
    errorUnsupportedFormat:
      'Formato não suportado. Selecione um vídeo MP4, MOV ou WebM.',
    errorFileTooLargeDesktop:
      'Arquivo muito grande: o limite no computador é 500 MB para preservar a memória do navegador.',
    errorFileTooLargeMobile:
      'Arquivo muito grande: o limite no celular é 200 MB para preservar a memória do navegador.',
    errorDecodeFailed:
      'Seu navegador não conseguiu ler o áudio deste vídeo (codec incompatível ou vídeo sem som). Tente um MP4 (AAC) ou WebM padrão.',
    errorEmptyFile: 'O arquivo selecionado está vazio ou ilegível.',
    errorTransferFailed:
      'Não foi possível carregar o vídeo do downloader. Baixe primeiro e solte-o aqui.',
    downloaderExtractAudioBtn: 'Extrair áudio (MP3)',
    downloaderExtractAudioSub: 'Abrir na ferramenta MP3/WAV',
  },
  de: {
    navLabel: 'Video → MP3 / WAV',
    metaTitle: 'Video in MP3 / WAV umwandeln (Lokal im Browser) — VIDNEX',
    metaDescription:
      'Extrahiere MP3 (128–320 kbps) oder WAV aus MP4-, MOV- und WebM-Videos direkt im Browser. Wellenform-Schnitt, Lautstärke-Normalisierung, kein Upload.',
    ogTitle: 'Video in MP3 / WAV umwandeln (Lokal im Browser) — VIDNEX',
    ogDescription:
      'Extrahiere MP3 (128–320 kbps) oder WAV aus MP4-, MOV- und WebM-Videos direkt im Browser. Wellenform-Schnitt, Lautstärke-Normalisierung, kein Upload.',
    ogImageAlt: 'VIDNEX Browser-Konverter für Video zu MP3 und WAV mit Wellenform',
    breadcrumbLabel: 'Video → MP3 / WAV',
    badgeText: '100 % BROWSER · WEB AUDIO + LAMEJS · KEIN UPLOAD',
    h1: 'Video → MP3 / WAV Konverter',
    subtitle:
      'Extrahiere MP3- oder verlustfreies WAV-Audio aus MP4-, MOV- und WebM-Videos direkt lokal im Browser mit Wellenform-Zuschnitt und Normalisierung.',
    dropzoneTitle: 'Videodatei hier ablegen',
    dropzoneSubtitle: 'Unterstützte Formate: MP4, MOV, WebM · 100 % lokal im Browser',
    selectFileCta: 'Video auswählen',
    loadSampleCta: 'Demo-Clip testen',
    changeVideoCta: 'Video wechseln',
    limitBadgeDesktop: 'Desktop-Limit: 500 MB',
    limitBadgeMobile: 'Mobil-Limit: 200 MB',
    importingFromDownloader: 'Video wird aus dem VIDNEX Downloader geladen…',
    importedFromBadge: 'Video direkt aus dem VIDNEX Downloader übernommen (kein Re-Upload)',
    decodingStatus: 'Audiospur wird über Web Audio API dekodiert…',
    waveformHeading: 'Wellenform & Ausschnitt zuschneiden',
    trimStartLabel: 'Start',
    trimEndLabel: 'Ende',
    clipDurationLabel: 'Ausgewählter Clip',
    totalDurationLabel: 'Gesamtdauer',
    previewClipPlay: 'Ausschnitt abspielen',
    previewClipStop: 'Wiedergabe stoppen',
    resetTrimCta: 'Zurücksetzen',
    settingsHeading: 'Audio-Einstellungen & Export',
    formatLabel: 'Ausgabeformat',
    formatMp3: 'MP3 (Komprimiert)',
    formatWav: 'WAV (PCM verlustfrei)',
    bitrateLabel: 'MP3-Bitrate',
    sampleRateLabel: 'WAV-Abtastrate',
    channelsLabel: 'Audiokanäle',
    channelStereo: 'Stereo (2 Kanäle)',
    channelMono: 'Mono (1 Kanal)',
    normalizeLabel: 'Lautstärke normalisieren',
    normalizeHint: 'Hebt die Spitzenlautstärke automatisch auf -0,2 dB ohne Übersteuerung an.',
    estimatedSizeLabel: 'Geschätzte Größe',
    convertToMp3Cta: 'In MP3 umwandeln',
    convertToWavCta: 'In WAV umwandeln',
    convertingStatus: 'Lokale Kodierung läuft…',
    progressEncodingMp3: 'MP3-Kodierung mit lamejs',
    progressEncodingWav: '16-Bit-PCM-WAV wird erstellt',
    progressNormalizing: 'Lautstärke wird normalisiert…',
    resultHeading: 'Audio bereit — Vorschau & Download',
    filenameLabel: 'Dateiname',
    downloadAudioCta: 'Audio herunterladen',
    actualSizeLabel: 'Endgültige Größe',
    privacyNotice:
      '100 % Browser-Verarbeitung (Web Audio API & lamejs). Dein Video wird niemals auf einen Server hochgeladen.',
    errorUnsupportedFormat:
      'Nicht unterstütztes Format. Bitte wähle eine MP4-, MOV- oder WebM-Videodatei.',
    errorFileTooLargeDesktop:
      'Datei zu groß: Das Desktop-Limit beträgt 500 MB für eine stabile Browser-Speichernutzung.',
    errorFileTooLargeMobile:
      'Datei zu groß: Das Mobil-Limit beträgt 200 MB für eine stabile Browser-Speichernutzung.',
    errorDecodeFailed:
      'Dein Browser kann die Audiospur dieses Videos nicht dekodieren (nicht unterstützter Codec oder stummes Video). Nutze ein Standard-MP4 oder WebM.',
    errorEmptyFile: 'Die ausgewählte Datei ist leer oder unlesbar.',
    errorTransferFailed:
      'Video konnte nicht vom Downloader übernommen werden. Bitte herunterladen und hier ablegen.',
    downloaderExtractAudioBtn: 'Audio extrahieren (MP3)',
    downloaderExtractAudioSub: 'Im MP3/WAV-Tool öffnen',
  },
  tr: {
    navLabel: 'Video → MP3 / WAV',
    metaTitle: 'Videoyu MP3 / WAV Dönüştürücü (Yerel Tarayıcı) — VIDNEX',
    metaDescription:
      'MP4, MOV ve WebM videolarından tarayıcınızda %100 yerel olarak MP3 (128–320 kbps) veya WAV ses çıkarın. Dalga formu kırpma, ses normalleştirme.',
    ogTitle: 'Videoyu MP3 / WAV Dönüştürücü (Yerel Tarayıcı) — VIDNEX',
    ogDescription:
      'MP4, MOV ve WebM videolarından tarayıcınızda %100 yerel olarak MP3 (128–320 kbps) veya WAV ses çıkarın. Dalga formu kırpma, ses normalleştirme.',
    ogImageAlt: 'VIDNEX tarayıcı içi Video MP3 ve WAV dönüştürücü aracı',
    breadcrumbLabel: 'Video → MP3 / WAV',
    badgeText: '%100 TARAYICI · WEB AUDIO + LAMEJS · YÜKLEME YOK',
    h1: 'Video → MP3 / WAV Dönüştürücü',
    subtitle:
      'MP4, MOV ve WebM videolarından doğrudan tarayıcınızda dalga formu kırpma ve ses normalleştirme ile MP3 veya kayıpsız WAV ses çıkarın.',
    dropzoneTitle: 'Video dosyanızı buraya sürükleyip bırakın',
    dropzoneSubtitle: 'Desteklenen formatlar: MP4, MOV, WebM · %100 yerel işlem',
    selectFileCta: 'Video seç',
    loadSampleCta: 'Demo klibi dene',
    changeVideoCta: 'Videoyu değiştir',
    limitBadgeDesktop: 'Masaüstü limiti: 500 MB',
    limitBadgeMobile: 'Mobil limit: 200 MB',
    importingFromDownloader: 'Video VIDNEX indiriciden yükleniyor…',
    importedFromBadge: 'Video doğrudan VIDNEX indiriciden alındı (tekrar yükleme yok)',
    decodingStatus: 'Web Audio API ile ses izi çözülüyor…',
    waveformHeading: 'Dalga formu ve klip kırpma',
    trimStartLabel: 'Başlangıç',
    trimEndLabel: 'Bitiş',
    clipDurationLabel: 'Seçili süre',
    totalDurationLabel: 'Toplam süre',
    previewClipPlay: 'Klibi dinle',
    previewClipStop: 'Önizlemeyi durdur',
    resetTrimCta: 'Sıfırla',
    settingsHeading: 'Ses ayarları ve dışa aktarma',
    formatLabel: 'Çıkış formatı',
    formatMp3: 'MP3 (Sıkıştırılmış)',
    formatWav: 'WAV (Kayıpsız PCM)',
    bitrateLabel: 'MP3 Bit Hızı',
    sampleRateLabel: 'WAV Örnekleme',
    channelsLabel: 'Ses kanalları',
    channelStereo: 'Stereo (2 kanal)',
    channelMono: 'Mono (1 kanal)',
    normalizeLabel: 'Ses seviyesini normalleştir',
    normalizeHint: 'Tepe ses düzeyini bozulma olmadan otomatik olarak -0,2 dB’ye dengeler.',
    estimatedSizeLabel: 'Tahmini boyut',
    convertToMp3Cta: 'MP3’e Dönüştür',
    convertToWavCta: 'WAV’a Dönüştür',
    convertingStatus: 'Yerel olarak kodlanıyor…',
    progressEncodingMp3: 'lamejs ile MP3 kodlanıyor',
    progressEncodingWav: '16-bit PCM WAV oluşturuluyor',
    progressNormalizing: 'Ses seviyesi normalleştiriliyor…',
    resultHeading: 'Ses hazır — Önizleme ve indirme',
    filenameLabel: 'Dosya adı',
    downloadAudioCta: 'Sesi indir',
    actualSizeLabel: 'Son boyut',
    privacyNotice:
      '%100 tarayıcı içi işlem (Web Audio API ve lamejs). Video dosyanız hiçbir sunucuya yüklenmez.',
    errorUnsupportedFormat:
      'Desteklenmeyen format. Lütfen MP4, MOV veya WebM video dosyası seçin.',
    errorFileTooLargeDesktop:
      'Dosya çok büyük: tarayıcı belleğini korumak için masaüstü limiti 500 MB’dir.',
    errorFileTooLargeMobile:
      'Dosya çok büyük: tarayıcı belleğini korumak için mobil limit 200 MB’dir.',
    errorDecodeFailed:
      'Tarayıcınız bu videonun ses izini okuyamıyor (desteklenmeyen kodek veya sessiz video). Standart bir MP4 (AAC) veya WebM deneyin.',
    errorEmptyFile: 'Seçilen dosya boş veya okunamıyor.',
    errorTransferFailed:
      'Video indiriciden alınamadı. Önce kaydedip aşağıya bırakın.',
    downloaderExtractAudioBtn: 'Sesi çıkar (MP3)',
    downloaderExtractAudioSub: 'MP3/WAV aracında aç',
  },
  id: {
    navLabel: 'Video → MP3 / WAV',
    metaTitle: 'Konverter Video ke MP3 / WAV Online (Lokal) — VIDNEX',
    metaDescription:
      'Ekstrak audio MP3 (128–320 kbps) atau WAV dari video MP4, MOV, dan WebM 100% di browser. Potong waveform, normalisasi volume, tanpa upload.',
    ogTitle: 'Konverter Video ke MP3 / WAV Online (Lokal) — VIDNEX',
    ogDescription:
      'Ekstrak audio MP3 (128–320 kbps) atau WAV dari video MP4, MOV, dan WebM 100% di browser. Potong waveform, normalisasi volume, tanpa upload.',
    ogImageAlt: 'Alat VIDNEX konverter Video ke MP3 dan WAV 100% lokal di browser',
    breadcrumbLabel: 'Video → MP3 / WAV',
    badgeText: '100% BROWSER · WEB AUDIO + LAMEJS · TANPA UPLOAD',
    h1: 'Konverter Video → MP3 / WAV',
    subtitle:
      'Ekstrak audio MP3 atau WAV tanpa kompresi dari video MP4, MOV, dan WebM langsung di browser dengan pemotong waveform dan normalisasi volume.',
    dropzoneTitle: 'Seret dan lepas file video di sini',
    dropzoneSubtitle: 'Format didukung: MP4, MOV, WebM · Proses 100% lokal di browser',
    selectFileCta: 'Pilih video',
    loadSampleCta: 'Coba klip demo',
    changeVideoCta: 'Ganti video',
    limitBadgeDesktop: 'Batas desktop: 500 MB',
    limitBadgeMobile: 'Batas ponsel: 200 MB',
    importingFromDownloader: 'Memuat video dari pengunduh VIDNEX…',
    importedFromBadge: 'Video diterima langsung dari pengunduh VIDNEX (tanpa upload ulang)',
    decodingStatus: 'Mendekode trek audio melalui Web Audio API…',
    waveformHeading: 'Waveform & potong klip',
    trimStartLabel: 'Mulai',
    trimEndLabel: 'Selesai',
    clipDurationLabel: 'Durasi terpilih',
    totalDurationLabel: 'Durasi total',
    previewClipPlay: 'Putar klip',
    previewClipStop: 'Hentikan pratinjau',
    resetTrimCta: 'Reset',
    settingsHeading: 'Pengaturan audio & ekspor',
    formatLabel: 'Format output',
    formatMp3: 'MP3 (Terkompresi)',
    formatWav: 'WAV (PCM tanpa rugi)',
    bitrateLabel: 'Bitrate MP3',
    sampleRateLabel: 'Sample rate WAV',
    channelsLabel: 'Saluran audio',
    channelStereo: 'Stereo (2 ch)',
    channelMono: 'Mono (1 ch)',
    normalizeLabel: 'Normalisasi volume',
    normalizeHint: 'Menyelaraskan puncak volume otomatis ke -0,2 dB tanpa distorsi.',
    estimatedSizeLabel: 'Perkiraan ukuran',
    convertToMp3Cta: 'Konversi ke MP3',
    convertToWavCta: 'Konversi ke WAV',
    convertingStatus: 'Mengkode secara lokal…',
    progressEncodingMp3: 'Mengkode MP3 dengan lamejs',
    progressEncodingWav: 'Membuat WAV PCM 16-bit',
    progressNormalizing: 'Menormalisasi volume…',
    resultHeading: 'Audio siap — Pratinjau & unduh',
    filenameLabel: 'Nama file',
    downloadAudioCta: 'Unduh audio',
    actualSizeLabel: 'Ukuran akhir',
    privacyNotice:
      'Pemrosesan 100% di browser (Web Audio API & lamejs). File video tidak pernah diunggah ke server mana pun.',
    errorUnsupportedFormat:
      'Format tidak didukung. Harap pilih file video MP4, MOV, atau WebM.',
    errorFileTooLargeDesktop:
      'File terlalu besar: batas desktop adalah 500 MB agar memori browser tetap stabil.',
    errorFileTooLargeMobile:
      'File terlalu besar: batas ponsel adalah 200 MB agar memori browser tetap stabil.',
    errorDecodeFailed:
      'Browser tidak dapat membaca trek audio video ini (codec tidak didukung atau video tanpa suara). Coba file MP4 (AAC) atau WebM standar.',
    errorEmptyFile: 'File yang dipilih kosong atau tidak terbaca.',
    errorTransferFailed:
      'Gagal memuat video dari pengunduh. Unduh dulu lalu lepas file di bawah ini.',
    downloaderExtractAudioBtn: 'Ekstrak Audio (MP3)',
    downloaderExtractAudioSub: 'Buka di alat MP3/WAV',
  },
  it: {
    navLabel: 'Video → MP3 / WAV',
    metaTitle: 'Converti Video in MP3 / WAV Online (Locale) — VIDNEX',
    metaDescription:
      'Estrai audio MP3 (128–320 kbps) o WAV da video MP4, MOV e WebM nel browser. Taglio con forma d’onda, normalizzazione volume, zero upload.',
    ogTitle: 'Converti Video in MP3 / WAV Online (Locale) — VIDNEX',
    ogDescription:
      'Estrai audio MP3 (128–320 kbps) o WAV da video MP4, MOV e WebM nel browser. Taglio con forma d’onda, normalizzazione volume, zero upload.',
    ogImageAlt: 'Convertitore VIDNEX Video in MP3 e WAV 100% nel browser',
    breadcrumbLabel: 'Video → MP3 / WAV',
    badgeText: '100% BROWSER · WEB AUDIO + LAMEJS · ZERO UPLOAD',
    h1: 'Convertitore Video → MP3 / WAV',
    subtitle:
      'Estrai audio MP3 o WAV senza perdita da video MP4, MOV e WebM direttamente sul dispositivo, con taglio forma d’onda e normalizzazione.',
    dropzoneTitle: 'Trascina qui il tuo file video',
    dropzoneSubtitle: 'Formati supportati: MP4, MOV, WebM · Elaborazione 100% locale',
    selectFileCta: 'Scegli un video',
    loadSampleCta: 'Prova clip demo',
    changeVideoCta: 'Cambia video',
    limitBadgeDesktop: 'Limite desktop: 500 MB',
    limitBadgeMobile: 'Limite mobile: 200 MB',
    importingFromDownloader: 'Caricamento video dal downloader VIDNEX…',
    importedFromBadge: 'Video ricevuto dal downloader VIDNEX (zero re-upload)',
    decodingStatus: 'Decodifica traccia audio tramite Web Audio API…',
    waveformHeading: 'Forma d’onda e taglio estratto',
    trimStartLabel: 'Inizio',
    trimEndLabel: 'Fine',
    clipDurationLabel: 'Durata selezionata',
    totalDurationLabel: 'Durata totale',
    previewClipPlay: 'Ascolta estratto',
    previewClipStop: 'Ferma anteprima',
    resetTrimCta: 'Ripristina',
    settingsHeading: 'Impostazioni audio ed esportazione',
    formatLabel: 'Formato di uscita',
    formatMp3: 'MP3 (Compresso)',
    formatWav: 'WAV (PCM lossless)',
    bitrateLabel: 'Bitrate MP3',
    sampleRateLabel: 'Frequenza WAV',
    channelsLabel: 'Canali audio',
    channelStereo: 'Stereo (2 canali)',
    channelMono: 'Mono (1 canale)',
    normalizeLabel: 'Normalizza volume',
    normalizeHint: 'Porta automaticamente il picco a -0,2 dB senza distorsione.',
    estimatedSizeLabel: 'Dimensione stimata',
    convertToMp3Cta: 'Converti in MP3',
    convertToWavCta: 'Converti in WAV',
    convertingStatus: 'Codifica locale in corso…',
    progressEncodingMp3: 'Codifica MP3 con lamejs',
    progressEncodingWav: 'Creazione WAV PCM 16-bit',
    progressNormalizing: 'Normalizzazione volume…',
    resultHeading: 'Audio pronto — Anteprima e download',
    filenameLabel: 'Nome file',
    downloadAudioCta: 'Scarica audio',
    actualSizeLabel: 'Dimensione finale',
    privacyNotice:
      'Elaborazione 100% nel browser (Web Audio API e lamejs). Il tuo video non viene mai caricato su alcun server.',
    errorUnsupportedFormat:
      'Formato non supportato. Seleziona un file video MP4, MOV o WebM.',
    errorFileTooLargeDesktop:
      'File troppo grande: il limite su desktop è 500 MB per proteggere la memoria del browser.',
    errorFileTooLargeMobile:
      'File troppo grande: il limite su mobile è 200 MB per proteggere la memoria del browser.',
    errorDecodeFailed:
      'Il browser non riesce a decodificare la traccia audio di questo video (codec non supportato o video muto). Prova un MP4 (AAC) o WebM standard.',
    errorEmptyFile: 'Il file selezionato è vuoto o illeggibile.',
    errorTransferFailed:
      'Impossibile caricare il video dal downloader. Scaricalo prima e rilascialo qui.',
    downloaderExtractAudioBtn: 'Estrai audio (MP3)',
    downloaderExtractAudioSub: 'Apri nello strumento MP3/WAV',
  },
  ru: {
    navLabel: 'Видео → MP3 / WAV',
    metaTitle: 'Конвертер Видео в MP3 / WAV в браузере — VIDNEX',
    metaDescription:
      'Извлекайте MP3 (128–320 kbps) или WAV из видео MP4, MOV и WebM локально в браузере. Обрезка по волне, нормализация громкости, без загрузки.',
    ogTitle: 'Конвертер Видео в MP3 / WAV в браузере — VIDNEX',
    ogDescription:
      'Извлекайте MP3 (128–320 kbps) или WAV из видео MP4, MOV и WebM локально в браузере. Обрезка по волне, нормализация громкости, без загрузки.',
    ogImageAlt: 'Браузерный конвертер VIDNEX из видео в MP3 и WAV с волной',
    breadcrumbLabel: 'Видео → MP3 / WAV',
    badgeText: '100% В БРАУЗЕРЕ · WEB AUDIO + LAMEJS · БЕЗ ЗАГРУЗКИ',
    h1: 'Конвертер Видео → MP3 / WAV',
    subtitle:
      'Извлекайте аудио MP3 или WAV без потерь из видео MP4, MOV и WebM прямо на устройстве с обрезкой по звуковой волне и нормализацией громкости.',
    dropzoneTitle: 'Перетащите видеофайл сюда',
    dropzoneSubtitle: 'Форматы: MP4, MOV, WebM · 100% локальная обработка',
    selectFileCta: 'Выбрать видео',
    loadSampleCta: 'Тестовый клип',
    changeVideoCta: 'Сменить видео',
    limitBadgeDesktop: 'Лимит ПК: 500 МБ',
    limitBadgeMobile: 'Лимит мобильных: 200 МБ',
    importingFromDownloader: 'Загрузка видео из загрузчика VIDNEX…',
    importedFromBadge: 'Видео передано из загрузчика VIDNEX (без повторной загрузки)',
    decodingStatus: 'Декодирование аудиодорожки через Web Audio API…',
    waveformHeading: 'Звуковая волна и обрезка фрагмента',
    trimStartLabel: 'Начало',
    trimEndLabel: 'Конец',
    clipDurationLabel: 'Выбранная длина',
    totalDurationLabel: 'Общая длина',
    previewClipPlay: 'Прослушать фрагмент',
    previewClipStop: 'Остановить',
    resetTrimCta: 'Сбросить',
    settingsHeading: 'Настройки аудио и экспорт',
    formatLabel: 'Формат вывода',
    formatMp3: 'MP3 (Сжатый)',
    formatWav: 'WAV (PCM без потерь)',
    bitrateLabel: 'Битрейт MP3',
    sampleRateLabel: 'Частота WAV',
    channelsLabel: 'Каналы аудио',
    channelStereo: 'Стерео (2 канала)',
    channelMono: 'Моно (1 канал)',
    normalizeLabel: 'Нормализовать громкость',
    normalizeHint: 'Автоматически выравнивает пик до -0,2 дБ без искажений.',
    estimatedSizeLabel: 'Примерный размер',
    convertToMp3Cta: 'Конвертировать в MP3',
    convertToWavCta: 'Конвертировать в WAV',
    convertingStatus: 'Локальное кодирование…',
    progressEncodingMp3: 'Кодирование MP3 через lamejs',
    progressEncodingWav: 'Сборка 16-bit PCM WAV',
    progressNormalizing: 'Нормализация громкости…',
    resultHeading: 'Аудио готово — Предпросмотр и скачивание',
    filenameLabel: 'Имя файла',
    downloadAudioCta: 'Скачать аудио',
    actualSizeLabel: 'Итоговый размер',
    privacyNotice:
      '100% локальная обработка в браузере (Web Audio API и lamejs). Ваше видео никогда не отправляется на сервер.',
    errorUnsupportedFormat:
      'Неподдерживаемый формат. Выберите видеофайл MP4, MOV или WebM.',
    errorFileTooLargeDesktop:
      'Файл слишком большой: лимит для ПК — 500 МБ для стабильной работы памяти браузера.',
    errorFileTooLargeMobile:
      'Файл слишком большой: лимит для смартфонов — 200 МБ для стабильной работы памяти браузера.',
    errorDecodeFailed:
      'Браузер не смог декодировать аудиодорожку этого видео (неподдерживаемый кодек или видео без звука). Попробуйте стандартный MP4 (AAC) или WebM.',
    errorEmptyFile: 'Выбранный файл пуст или повреждён.',
    errorTransferFailed:
      'Не удалось передать видео из загрузчика. Скачайте файл и перетащите его ниже.',
    downloaderExtractAudioBtn: 'Извлечь аудио (MP3)',
    downloaderExtractAudioSub: 'Открыть в инструменте MP3/WAV',
  },
};

export function getVideoToMp3Content(
  locale: SupportedLocale
): VideoToMp3LocaleContent {
  return VIDEO_TO_MP3_I18N[locale] || VIDEO_TO_MP3_I18N.fr;
}
