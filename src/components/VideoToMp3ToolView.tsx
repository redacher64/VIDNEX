import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getLocalizedPagePath,
  PLATFORM_PAGE_KEYS,
  type PageKey,
  type SupportedLocale,
} from '../i18n/config.ts';
import {
  getLocaleBundleSync,
  getToolContentSync,
} from '../i18n/localeLoader.ts';
import { getToolsHubContent } from '../data/toolsRegistry.ts';
import { getSplitImageContent } from '../utils/splitImageLogic.ts';
import { consumePendingVideoForAudioTool } from '../utils/toolMediaBridge.ts';
import {
  type AudioOutputFormat,
  clampTrimRange,
  computeWaveformPeaks,
  createSampleAudioPcm,
  detectIsMobileClient,
  encodeMp3FromPcm,
  encodeWavFromPcm,
  estimateAudioOutputBytes,
  extractTrimmedPcm,
  formatByteSize,
  formatTimecode,
  getMaxVideoBytes,
  getVideoToMp3Content,
  mixChannels,
  MP3_BITRATE_OPTIONS,
  type Mp3BitrateKbps,
  normalizePcmChannels,
  parseTimecodeToSeconds,
  resamplePcmLinear,
  sanitizeOutputFilename,
  validateVideoFile,
  WAV_SAMPLE_RATE_OPTIONS,
  type WavChannelCount,
  type WavSampleRate,
} from '../utils/videoToMp3Logic.ts';
import { AdSlot } from './AdSlot.tsx';
import { ToolRichSections } from './ToolRichSections.tsx';

type SvgIconProps = { className?: string };

const UploadIcon: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
);
const MusicIcon: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
);
const ScissorsIcon: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg>
);
const PlayIcon: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}><polygon points="6 4 20 12 6 20 6 4" /></svg>
);
const SquareIcon: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
);
const DownloadIcon: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
);
const SparklesIcon: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" /></svg>
);
const ShieldCheckIcon: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
);
const RefreshCwIcon: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
);
const SlidersIcon: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>
);
const VolumeIcon: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>
);
const HelpCircleIcon: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
);
const ChevronDownIcon: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><polyline points="6 9 12 15 18 9" /></svg>
);
const CheckCircleIcon: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
);

interface VideoToMp3ToolViewProps {
  locale: SupportedLocale;
  onNavigatePage: (page: PageKey) => void;
  onNavigatePath?: (path: string) => void;
}

interface DecodedAudioSource {
  fileName: string;
  fileSize: number;
  channels: Float32Array[];
  sampleRate: number;
  duration: number;
  waveformPeaks: number[];
  fromDownloaderPlatform?: string;
}

interface ConvertedAudioOutput {
  format: AudioOutputFormat;
  blob: Blob;
  objectUrl: string;
  byteSize: number;
  durationSec: number;
  detailBadge: string;
}

function createAudioContextCompat(): AudioContext {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('WEB_AUDIO_UNAVAILABLE');
  }
  return new AudioCtx();
}

export const VideoToMp3ToolView: React.FC<VideoToMp3ToolViewProps> = ({
  locale,
  onNavigatePage,
  onNavigatePath,
}) => {
  const copy = getVideoToMp3Content(locale);
  const hubCopy = getToolsHubContent(locale);
  const splitCopy = getSplitImageContent(locale);
  const bundle = getLocaleBundleSync(locale);
  const videoToolContent = getToolContentSync(locale, 'video_to_mp3');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const previewCtxRef = useRef<AudioContext | null>(null);
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const previewRafRef = useRef<number | null>(null);

  const [isMobileClient, setIsMobileClient] = useState<boolean>(false);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [isLoadingSource, setIsLoadingSource] = useState<boolean>(false);
  const [loadingLabel, setLoadingLabel] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [decodedSource, setDecodedSource] = useState<DecodedAudioSource | null>(
    null
  );
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);
  const [startInputText, setStartInputText] = useState<string>('00:00.0');
  const [endInputText, setEndInputText] = useState<string>('00:00.0');
  const [draggingHandle, setDraggingHandle] = useState<'start' | 'end' | null>(
    null
  );

  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);
  const [playheadSec, setPlayheadSec] = useState<number | null>(null);

  const [outputFormat, setOutputFormat] = useState<AudioOutputFormat>('mp3');
  const [mp3Bitrate, setMp3Bitrate] = useState<Mp3BitrateKbps>(192);
  const [wavSampleRate, setWavSampleRate] = useState<WavSampleRate>(44100);
  const [wavChannels, setWavChannels] = useState<WavChannelCount>(2);
  const [normalizeVolume, setNormalizeVolume] = useState<boolean>(false);

  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [conversionProgress, setConversionProgress] = useState<number>(0);
  const [conversionStageText, setConversionStageText] = useState<string>('');
  const [convertedOutput, setConvertedOutput] =
    useState<ConvertedAudioOutput | null>(null);
  const [outputFilenameBase, setOutputFilenameBase] =
    useState<string>('vidnex-audio');

  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  useEffect(() => {
    setIsMobileClient(detectIsMobileClient());
  }, []);

  const stopClipPreview = useCallback(() => {
    if (previewRafRef.current !== null) {
      cancelAnimationFrame(previewRafRef.current);
      previewRafRef.current = null;
    }
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.onended = null;
        previewSourceRef.current.stop();
      } catch {
        // ignore if already stopped
      }
      previewSourceRef.current.disconnect();
      previewSourceRef.current = null;
    }
    if (previewCtxRef.current) {
      previewCtxRef.current.close().catch(() => {});
      previewCtxRef.current = null;
    }
    setIsPlayingPreview(false);
    setPlayheadSec(null);
  }, []);

  useEffect(() => {
    return () => {
      stopClipPreview();
    };
  }, [stopClipPreview]);

  useEffect(() => {
    return () => {
      if (convertedOutput?.objectUrl) {
        URL.revokeObjectURL(convertedOutput.objectUrl);
      }
    };
  }, [convertedOutput]);

  const clearPreviousOutput = useCallback(() => {
    setConvertedOutput((prev) => {
      if (prev?.objectUrl) {
        URL.revokeObjectURL(prev.objectUrl);
      }
      return null;
    });
  }, []);

  const applyTrimRange = useCallback(
    (nextStart: number, nextEnd: number, duration: number) => {
      const clamped = clampTrimRange(nextStart, nextEnd, duration, 0.1);
      setTrimStart(clamped.start);
      setTrimEnd(clamped.end);
      setStartInputText(formatTimecode(clamped.start));
      setEndInputText(formatTimecode(clamped.end));
    },
    []
  );

  const decodeArrayBufferAsVideoAudio = useCallback(
    async (
      arrayBuffer: ArrayBuffer,
      meta: {
        fileName: string;
        fileSize: number;
        suggestedBaseName?: string;
        fromDownloaderPlatform?: string;
      }
    ) => {
      stopClipPreview();
      clearPreviousOutput();
      setErrorMsg(null);
      setIsLoadingSource(true);
      setLoadingLabel(copy.decodingStatus);

      let audioCtx: AudioContext | null = null;
      try {
        audioCtx = createAudioContextCompat();
        // Copy buffer so decodeAudioData can safely detach it across Safari/Chromium
        const copyBuf = arrayBuffer.slice(0);
        const audioBuffer = await audioCtx.decodeAudioData(copyBuf);

        if (!audioBuffer || audioBuffer.length === 0 || audioBuffer.duration <= 0) {
          throw new Error('EMPTY_AUDIO_TRACK');
        }

        const channelCount = Math.min(2, Math.max(1, audioBuffer.numberOfChannels));
        const channels: Float32Array[] = [];
        for (let c = 0; c < channelCount; c++) {
          channels.push(new Float32Array(audioBuffer.getChannelData(c)));
        }

        const peaks = computeWaveformPeaks(channels, 120);
        const baseName =
          meta.suggestedBaseName ||
          meta.fileName.replace(/\.(mp4|mov|webm|m4v|mp3|wav)$/i, '') ||
          'vidnex-audio';

        setDecodedSource({
          fileName: meta.fileName,
          fileSize: meta.fileSize,
          channels,
          sampleRate: audioBuffer.sampleRate,
          duration: audioBuffer.duration,
          waveformPeaks: peaks,
          fromDownloaderPlatform: meta.fromDownloaderPlatform,
        });
        setOutputFilenameBase(baseName);
        applyTrimRange(0, audioBuffer.duration, audioBuffer.duration);
      } catch {
        setDecodedSource(null);
        setErrorMsg(copy.errorDecodeFailed);
      } finally {
        if (audioCtx) {
          audioCtx.close().catch(() => {});
        }
        setIsLoadingSource(false);
        setLoadingLabel('');
      }
    },
    [
      applyTrimRange,
      clearPreviousOutput,
      copy.decodingStatus,
      copy.errorDecodeFailed,
      stopClipPreview,
    ]
  );

  const handleSelectedVideoFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      const mobileNow = detectIsMobileClient();
      setIsMobileClient(mobileNow);

      const validation = validateVideoFile(
        { name: file.name, type: file.type, size: file.size },
        mobileNow
      );
      if (!validation.valid) {
        if (validation.errorCode === 'EMPTY_FILE') {
          setErrorMsg(copy.errorEmptyFile);
        } else if (validation.errorCode === 'FILE_TOO_LARGE') {
          setErrorMsg(
            mobileNow
              ? copy.errorFileTooLargeMobile
              : copy.errorFileTooLargeDesktop
          );
        } else {
          setErrorMsg(copy.errorUnsupportedFormat);
        }
        return;
      }

      setErrorMsg(null);
      setIsLoadingSource(true);
      setLoadingLabel(copy.decodingStatus);
      try {
        const arrayBuffer = await file.arrayBuffer();
        await decodeArrayBufferAsVideoAudio(arrayBuffer, {
          fileName: file.name,
          fileSize: file.size,
        });
      } catch {
        setIsLoadingSource(false);
        setLoadingLabel('');
        setErrorMsg(copy.errorDecodeFailed);
      }
    },
    [
      copy.decodingStatus,
      copy.errorDecodeFailed,
      copy.errorEmptyFile,
      copy.errorFileTooLargeDesktop,
      copy.errorFileTooLargeMobile,
      copy.errorUnsupportedFormat,
      decodeArrayBufferAsVideoAudio,
    ]
  );

  // Consume zero-reupload handoff from VIDNEX downloader (TikTok, Instagram, X, Facebook)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pending = consumePendingVideoForAudioTool();
    if (!pending) return;

    let cancelled = false;
    const mobileNow = detectIsMobileClient();
    setIsMobileClient(mobileNow);
    setErrorMsg(null);
    setIsLoadingSource(true);
    setLoadingLabel(copy.importingFromDownloader);

    (async () => {
      try {
        let blob: Blob;
        if (pending.blob) {
          blob = pending.blob;
        } else {
          const response = await fetch(pending.fetchUrl);
          if (!response.ok) {
            throw new Error(`HTTP_${response.status}`);
          }
          const contentLengthHeader = response.headers.get('content-length');
          const maxBytes = getMaxVideoBytes(mobileNow);
          if (contentLengthHeader) {
            const parsedLen = Number(contentLengthHeader);
            if (Number.isFinite(parsedLen) && parsedLen > maxBytes) {
              if (!cancelled) {
                setIsLoadingSource(false);
                setLoadingLabel('');
                setErrorMsg(
                  mobileNow
                    ? copy.errorFileTooLargeMobile
                    : copy.errorFileTooLargeDesktop
                );
              }
              return;
            }
          }
          blob = await response.blob();
        }

        if (cancelled) return;

        const maxBytes = getMaxVideoBytes(mobileNow);
        if (blob.size <= 0) {
          setIsLoadingSource(false);
          setLoadingLabel('');
          setErrorMsg(copy.errorEmptyFile);
          return;
        }
        if (blob.size > maxBytes) {
          setIsLoadingSource(false);
          setLoadingLabel('');
          setErrorMsg(
            mobileNow
              ? copy.errorFileTooLargeMobile
              : copy.errorFileTooLargeDesktop
          );
          return;
        }

        const arrayBuffer = await blob.arrayBuffer();
        if (cancelled) return;

        await decodeArrayBufferAsVideoAudio(arrayBuffer, {
          fileName: `${pending.suggestedBaseName}.mp4`,
          fileSize: blob.size,
          suggestedBaseName: pending.suggestedBaseName,
          fromDownloaderPlatform: pending.platform,
        });
      } catch {
        if (!cancelled) {
          setIsLoadingSource(false);
          setLoadingLabel('');
          setErrorMsg(copy.errorTransferFailed);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    copy.errorEmptyFile,
    copy.errorFileTooLargeDesktop,
    copy.errorFileTooLargeMobile,
    copy.errorTransferFailed,
    copy.importingFromDownloader,
    decodeArrayBufferAsVideoAudio,
  ]);

  const handleLoadSampleAudio = useCallback(() => {
    stopClipPreview();
    clearPreviousOutput();
    setErrorMsg(null);
    const sample = createSampleAudioPcm(6, 44100);
    const peaks = computeWaveformPeaks(sample.channels, 120);
    setDecodedSource({
      fileName: 'vidnex-demo-clip.mp4',
      fileSize: sample.channels[0].byteLength * 2,
      channels: sample.channels,
      sampleRate: sample.sampleRate,
      duration: sample.duration,
      waveformPeaks: peaks,
    });
    setOutputFilenameBase('vidnex-demo-audio');
    applyTrimRange(0, sample.duration, sample.duration);
  }, [applyTrimRange, clearPreviousOutput, stopClipPreview]);

  // Interactive waveform pointer dragging (mouse + touch)
  const updateHandleFromClientX = useCallback(
    (clientX: number, handle: 'start' | 'end') => {
      if (!decodedSource || !waveformRef.current) return;
      const rect = waveformRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const sec = ratio * decodedSource.duration;
      if (handle === 'start') {
        applyTrimRange(
          Math.min(sec, trimEnd - 0.1),
          trimEnd,
          decodedSource.duration
        );
      } else {
        applyTrimRange(
          trimStart,
          Math.max(sec, trimStart + 0.1),
          decodedSource.duration
        );
      }
    },
    [applyTrimRange, decodedSource, trimEnd, trimStart]
  );

  const handlePointerDownHandle = (
    e: React.PointerEvent<HTMLButtonElement>,
    handle: 'start' | 'end'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingHandle(handle);
    stopClipPreview();
  };

  const handlePointerMoveHandle = (
    e: React.PointerEvent<HTMLButtonElement>,
    handle: 'start' | 'end'
  ) => {
    if (draggingHandle !== handle) return;
    updateHandleFromClientX(e.clientX, handle);
  };

  const handlePointerUpHandle = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDraggingHandle(null);
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!decodedSource || !waveformRef.current || draggingHandle) return;
    const rect = waveformRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const sec = ratio * decodedSource.duration;
    // Move whichever handle is closer to the click position
    if (Math.abs(sec - trimStart) <= Math.abs(sec - trimEnd)) {
      applyTrimRange(
        Math.min(sec, trimEnd - 0.1),
        trimEnd,
        decodedSource.duration
      );
    } else {
      applyTrimRange(
        trimStart,
        Math.max(sec, trimStart + 0.1),
        decodedSource.duration
      );
    }
    stopClipPreview();
  };

  const handleTogglePlayClip = useCallback(async () => {
    if (!decodedSource) return;
    if (isPlayingPreview) {
      stopClipPreview();
      return;
    }

    stopClipPreview();
    try {
      const ctx = createAudioContextCompat();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const trimmed = extractTrimmedPcm(
        decodedSource.channels,
        decodedSource.sampleRate,
        trimStart,
        trimEnd
      );
      if (!trimmed.length || !trimmed[0].length) {
        ctx.close().catch(() => {});
        return;
      }
      const finalPreviewChannels = normalizeVolume
        ? normalizePcmChannels(trimmed).channels
        : trimmed;

      const audioBuf = ctx.createBuffer(
        finalPreviewChannels.length,
        finalPreviewChannels[0].length,
        decodedSource.sampleRate
      );
      for (let c = 0; c < finalPreviewChannels.length; c++) {
        audioBuf.copyToChannel(
          new Float32Array(finalPreviewChannels[c]),
          c
        );
      }

      const sourceNode = ctx.createBufferSource();
      sourceNode.buffer = audioBuf;
      sourceNode.connect(ctx.destination);

      previewCtxRef.current = ctx;
      previewSourceRef.current = sourceNode;

      const startedAtCtx = ctx.currentTime;
      const clipDur = Math.max(0.1, trimEnd - trimStart);

      sourceNode.onended = () => {
        stopClipPreview();
      };

      setIsPlayingPreview(true);
      setPlayheadSec(trimStart);
      sourceNode.start(0);

      const tick = () => {
        if (!previewCtxRef.current) return;
        const elapsed = previewCtxRef.current.currentTime - startedAtCtx;
        if (elapsed >= clipDur) {
          setPlayheadSec(trimEnd);
          return;
        }
        setPlayheadSec(trimStart + elapsed);
        previewRafRef.current = requestAnimationFrame(tick);
      };
      previewRafRef.current = requestAnimationFrame(tick);
    } catch {
      stopClipPreview();
    }
  }, [
    decodedSource,
    isPlayingPreview,
    normalizeVolume,
    stopClipPreview,
    trimEnd,
    trimStart,
  ]);

  const clipDurationSec = useMemo(() => {
    if (!decodedSource) return 0;
    return Math.max(0.1, Math.round((trimEnd - trimStart) * 100) / 100);
  }, [decodedSource, trimEnd, trimStart]);

  const estimatedBytes = useMemo(() => {
    if (!decodedSource || clipDurationSec <= 0) return 0;
    return estimateAudioOutputBytes({
      format: outputFormat,
      durationSec: clipDurationSec,
      mp3BitrateKbps: mp3Bitrate,
      wavSampleRate,
      wavChannels,
    });
  }, [
    clipDurationSec,
    decodedSource,
    mp3Bitrate,
    outputFormat,
    wavChannels,
    wavSampleRate,
  ]);

  const handleConvert = useCallback(async () => {
    if (!decodedSource || isConverting) return;
    stopClipPreview();
    clearPreviousOutput();
    setErrorMsg(null);
    setIsConverting(true);
    setConversionProgress(4);

    try {
      let pcm = extractTrimmedPcm(
        decodedSource.channels,
        decodedSource.sampleRate,
        trimStart,
        trimEnd
      );
      if (!pcm.length || !pcm[0].length) {
        throw new Error('EMPTY_TRIM');
      }

      if (normalizeVolume) {
        setConversionStageText(copy.progressNormalizing);
        setConversionProgress(12);
        await new Promise((r) => setTimeout(r, 0));
        pcm = normalizePcmChannels(pcm).channels;
      }

      if (outputFormat === 'wav') {
        setConversionStageText(copy.progressEncodingWav);
        setConversionProgress(25);
        await new Promise((r) => setTimeout(r, 0));
        const mixed = mixChannels(pcm, wavChannels);
        const resampled = resamplePcmLinear(
          mixed,
          decodedSource.sampleRate,
          wavSampleRate
        );
        const wavBytes = encodeWavFromPcm(resampled, wavSampleRate, (pct) => {
          setConversionProgress(Math.min(100, 25 + Math.round(pct * 0.75)));
        });
        const wavBlob = new Blob([wavBytes.slice().buffer], {
          type: 'audio/wav',
        });
        const url = URL.createObjectURL(wavBlob);
        setConvertedOutput({
          format: 'wav',
          blob: wavBlob,
          objectUrl: url,
          byteSize: wavBlob.size,
          durationSec: clipDurationSec,
          detailBadge: `WAV · ${(wavSampleRate / 1000).toFixed(1)} kHz · ${
            wavChannels === 2 ? copy.channelStereo : copy.channelMono
          }`,
        });
      } else {
        setConversionStageText(copy.progressEncodingMp3);
        setConversionProgress(18);
        await new Promise((r) => setTimeout(r, 0));
        const mp3SampleRate =
          decodedSource.sampleRate === 48000 ||
          decodedSource.sampleRate === 44100 ||
          decodedSource.sampleRate === 32000
            ? decodedSource.sampleRate
            : 44100;
        const prepared = resamplePcmLinear(
          pcm,
          decodedSource.sampleRate,
          mp3SampleRate
        );
        const mp3Bytes = await encodeMp3FromPcm(
          prepared,
          mp3SampleRate,
          mp3Bitrate,
          (pct) => {
            setConversionProgress(Math.min(100, 18 + Math.round(pct * 0.82)));
          }
        );
        const mp3Blob = new Blob([mp3Bytes.slice().buffer], {
          type: 'audio/mpeg',
        });
        const url = URL.createObjectURL(mp3Blob);
        setConvertedOutput({
          format: 'mp3',
          blob: mp3Blob,
          objectUrl: url,
          byteSize: mp3Blob.size,
          durationSec: clipDurationSec,
          detailBadge: `MP3 · ${mp3Bitrate} kbps · ${(mp3SampleRate / 1000).toFixed(
            1
          )} kHz`,
        });
      }
      setConversionProgress(100);
    } catch {
      setErrorMsg(copy.errorDecodeFailed);
    } finally {
      setIsConverting(false);
    }
  }, [
    clearPreviousOutput,
    clipDurationSec,
    copy.channelMono,
    copy.channelStereo,
    copy.errorDecodeFailed,
    copy.progressEncodingMp3,
    copy.progressEncodingWav,
    copy.progressNormalizing,
    decodedSource,
    isConverting,
    mp3Bitrate,
    normalizeVolume,
    outputFormat,
    stopClipPreview,
    trimEnd,
    trimStart,
    wavChannels,
    wavSampleRate,
  ]);

  const handleDownloadConverted = useCallback(() => {
    if (!convertedOutput) return;
    const safeName = sanitizeOutputFilename(
      outputFilenameBase,
      convertedOutput.format
    );
    const a = document.createElement('a');
    a.href = convertedOutput.objectUrl;
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [convertedOutput, outputFilenameBase]);

  const homeHref = getLocalizedPagePath(locale, 'home');
  const toolsHubHref = getLocalizedPagePath(locale, 'tools_hub');
  const splitHref = getLocalizedPagePath(locale, 'split_image');

  const startPct =
    decodedSource && decodedSource.duration > 0
      ? (trimStart / decodedSource.duration) * 100
      : 0;
  const endPct =
    decodedSource && decodedSource.duration > 0
      ? (trimEnd / decodedSource.duration) * 100
      : 100;
  const playheadPct =
    decodedSource && decodedSource.duration > 0 && playheadSec !== null
      ? Math.max(0, Math.min(100, (playheadSec / decodedSource.duration) * 100))
      : null;

  const activeEditorial = videoToolContent?.editorial;
  const activeHowToSteps = videoToolContent?.howToSteps || [];
  const activeFaqs = videoToolContent?.faqs || [];

  return (
    <div className="w-full">
      {/* Top AdSlot (above the tool, never overlapping buttons or preview) */}
      <div className="max-w-6xl mx-auto px-4 pt-3">
        <AdSlot
          slotId="vidnex-v2m-top-mobile-banner"
          format="mobile-banner"
          language={locale}
        />
        <AdSlot
          slotId="vidnex-v2m-top-leaderboard"
          format="leaderboard"
          language={locale}
          hideOnMobile={true}
        />
      </div>

      {/* Main Tool Layout with Desktop Sidebars on xl (>= 1280px) */}
      <section className="max-w-[1440px] mx-auto px-4 pt-4 pb-12">
        <div className="flex flex-col xl:flex-row items-start justify-center gap-6">
          {/* Left Desktop Skyscraper Ad */}
          <aside
            aria-label="Sponsored Left"
            className="hidden xl:flex shrink-0 sticky top-24"
          >
            <AdSlot
              slotId="vidnex-v2m-left-skyscraper"
              format="skyscraper"
              language={locale}
            />
          </aside>

          {/* Center Tool Container */}
          <div className="w-full max-w-4xl mx-auto">
            {/* Breadcrumb: Home / Tools / Video -> MP3 / WAV */}
            <nav
              aria-label="Breadcrumb"
              className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#7c4a2d] dark:text-[#d6b8a3] mb-4"
            >
              <a
                href={homeHref}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigatePage('home');
                }}
                className="hover:text-[#c2410c] dark:hover:text-[#fb923c] transition-colors"
              >
                {bundle.ui.sections.breadcrumbHome}
              </a>
              <span aria-hidden="true">/</span>
              <a
                href={toolsHubHref}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigatePage('tools_hub');
                }}
                className="hover:text-[#c2410c] dark:hover:text-[#fb923c] transition-colors"
              >
                {hubCopy.breadcrumbLabel}
              </a>
              <span aria-hidden="true">/</span>
              <span className="text-[#c2410c] dark:text-[#fb923c] font-semibold">
                {copy.breadcrumbLabel}
              </span>
            </nav>

            {/* Header Hero */}
            <div className="text-center sm:text-start mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/25 text-[#c2410c] dark:text-[#fb923c] font-mono text-[11px] font-bold tracking-wide mb-3">
                <SparklesIcon className="w-3.5 h-3.5 shrink-0" />
                <span>{copy.badgeText}</span>
              </div>

              <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-[#1f130b] dark:text-[#fffaf5] mb-2">
                {copy.h1}
              </h1>
              <p className="text-sm sm:text-base text-[#6e472b] dark:text-[#d6b8a3] max-w-2xl">
                {copy.subtitle}
              </p>
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
              aria-label={copy.selectFileCta}
              data-testid="v2m-file-input"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                handleSelectedVideoFile(file);
                e.target.value = '';
              }}
            />

            {/* Error Banner */}
            {errorMsg && (
              <div
                role="alert"
                data-testid="v2m-error-banner"
                className="mb-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs sm:text-sm font-medium"
              >
                {errorMsg}
              </div>
            )}

            {/* Loading / Decoding Status */}
            {isLoadingSource && (
              <div
                role="status"
                aria-live="polite"
                data-testid="v2m-loading-banner"
                className="mb-5 p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center gap-3 text-sm font-display font-semibold text-[#9a3412] dark:text-[#fb923c]"
              >
                <span className="w-5 h-5 rounded-full border-2 border-[#c2410c] border-t-transparent animate-spin shrink-0" />
                <span>{loadingLabel || copy.decodingStatus}</span>
              </div>
            )}

            {/* Imported from Downloader Badge */}
            {decodedSource?.fromDownloaderPlatform && (
              <div
                role="status"
                data-testid="v2m-imported-badge"
                className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-medium flex items-center gap-2.5"
              >
                <CheckCircleIcon className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{copy.importedFromBadge}</span>
              </div>
            )}

            {/* Step 1: Dropzone (shown when no video is loaded) */}
            {!decodedSource && !isLoadingSource && (
              <div
                data-testid="v2m-dropzone"
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(false);
                  const file = e.dataTransfer.files?.[0];
                  handleSelectedVideoFile(file);
                }}
                className={`rounded-2xl border-2 border-dashed p-6 sm:p-10 text-center transition-all ${
                  isDraggingFile
                    ? 'border-[#c2410c] bg-orange-500/10'
                    : 'border-orange-300/80 dark:border-orange-900/50 bg-white/95 dark:bg-[#1d140e]/95 hover:border-[#c2410c]/70'
                } shadow-sm mb-6`}
              >
                <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-4 text-[#c2410c] dark:text-[#fb923c]">
                  <UploadIcon className="w-7 h-7" />
                </div>
                <h2 className="font-display text-lg sm:text-xl font-bold text-[#1f130b] dark:text-[#fffaf5] mb-1">
                  {copy.dropzoneTitle}
                </h2>
                <p className="text-xs sm:text-sm text-[#7c4a2d] dark:text-[#d6b8a3] mb-4">
                  {copy.dropzoneSubtitle}
                </p>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#fffaf5] dark:bg-[#140e0a] border border-orange-200/80 dark:border-orange-900/50 font-mono text-[11px] font-semibold text-[#7c4a2d] dark:text-[#d6b8a3] mb-6">
                  <span>
                    {isMobileClient
                      ? copy.limitBadgeMobile
                      : copy.limitBadgeDesktop}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    data-testid="v2m-select-file-btn"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#c2410c] hover:bg-[#9a3412] text-white font-display font-bold text-sm shadow-sm transition-colors cursor-pointer"
                  >
                    <MusicIcon className="w-4 h-4" />
                    <span>{copy.selectFileCta}</span>
                  </button>

                  <button
                    type="button"
                    data-testid="v2m-load-sample-btn"
                    onClick={handleLoadSampleAudio}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/25 text-[#9a3412] dark:text-[#fb923c] font-mono text-xs font-bold transition-colors cursor-pointer"
                  >
                    <SparklesIcon className="w-3.5 h-3.5" />
                    <span>{copy.loadSampleCta}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Main Interactive Studio Workspace */}
            <div className="space-y-6">
              {/* Waveform Trimmer Card */}
              <div className="rounded-2xl border border-orange-200/80 dark:border-orange-950/70 bg-white/95 dark:bg-[#1d140e]/95 p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <ScissorsIcon className="w-4 h-4 text-[#c2410c] dark:text-[#fb923c]" />
                    <h2 className="font-display text-sm sm:text-base font-bold text-[#1f130b] dark:text-[#fffaf5]">
                      {copy.waveformHeading}
                    </h2>
                  </div>

                  {decodedSource && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        data-testid="v2m-source-meta"
                        className="px-2.5 py-1 rounded-lg bg-[#fffaf5] dark:bg-[#140e0a] border border-orange-200/70 dark:border-orange-900/50 font-mono text-[11px] font-semibold text-[#7c4a2d] dark:text-[#d6b8a3] truncate max-w-[220px]"
                      >
                        {decodedSource.fileName} ·{' '}
                        {formatByteSize(decodedSource.fileSize)}
                      </span>
                      <button
                        type="button"
                        data-testid="v2m-change-video-btn"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-[#c2410c] dark:text-[#fb923c] font-mono text-xs font-bold transition-colors cursor-pointer"
                      >
                        <RefreshCwIcon className="w-3.5 h-3.5" />
                        <span>{copy.changeVideoCta}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Waveform Interactive Track (always LTR for chronological timeline) */}
                <div
                  ref={waveformRef}
                  dir="ltr"
                  data-testid="v2m-waveform-stage"
                  onClick={handleWaveformClick}
                  className="relative h-32 sm:h-36 w-full rounded-xl bg-[#140e0a] border border-orange-300/60 dark:border-orange-900/60 overflow-hidden select-none cursor-crosshair flex items-center px-2"
                >
                  {/* Waveform Bars */}
                  <div className="w-full h-24 flex items-center gap-[2px]">
                    {(
                      decodedSource?.waveformPeaks ||
                      Array.from({ length: 80 }, (_, idx) => {
                        const wave =
                          0.2 +
                          0.55 *
                            Math.abs(Math.sin(idx * 0.24) * Math.cos(idx * 0.11));
                        return wave;
                      })
                    ).map((peak, idx, arr) => {
                      const barPct = (idx / Math.max(1, arr.length - 1)) * 100;
                      const isInRange =
                        !decodedSource ||
                        (barPct >= startPct && barPct <= endPct);
                      return (
                        <div
                          key={idx}
                          className={`flex-1 rounded-full transition-colors ${
                            decodedSource
                              ? isInRange
                                ? 'bg-gradient-to-t from-orange-600 via-orange-500 to-amber-400'
                                : 'bg-orange-200/20'
                              : 'bg-orange-500/25'
                          }`}
                          style={{
                            height: `${Math.max(10, Math.round(peak * 100))}%`,
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Dimmed Outside Regions & Handles when audio is loaded */}
                  {decodedSource && (
                    <>
                      <div
                        className="absolute inset-y-0 left-0 bg-black/55 pointer-events-none"
                        style={{ width: `${startPct}%` }}
                      />
                      <div
                        className="absolute inset-y-0 right-0 bg-black/55 pointer-events-none"
                        style={{ width: `${Math.max(0, 100 - endPct)}%` }}
                      />

                      {/* Active Selection Frame */}
                      <div
                        className="absolute inset-y-0 border-y-2 border-amber-400/80 pointer-events-none"
                        style={{
                          left: `${startPct}%`,
                          width: `${Math.max(0, endPct - startPct)}%`,
                        }}
                      />

                      {/* Live Playhead */}
                      {playheadPct !== null && (
                        <div
                          className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] pointer-events-none z-10"
                          style={{ left: `${playheadPct}%` }}
                        />
                      )}

                      {/* Start Handle */}
                      <button
                        type="button"
                        role="slider"
                        aria-label={copy.trimStartLabel}
                        aria-valuemin={0}
                        aria-valuemax={Math.max(0, trimEnd - 0.1)}
                        aria-valuenow={trimStart}
                        data-testid="v2m-handle-start"
                        onPointerDown={(e) => handlePointerDownHandle(e, 'start')}
                        onPointerMove={(e) => handlePointerMoveHandle(e, 'start')}
                        onPointerUp={handlePointerUpHandle}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowLeft') {
                            e.preventDefault();
                            applyTrimRange(
                              trimStart - 0.5,
                              trimEnd,
                              decodedSource.duration
                            );
                          } else if (e.key === 'ArrowRight') {
                            e.preventDefault();
                            applyTrimRange(
                              trimStart + 0.5,
                              trimEnd,
                              decodedSource.duration
                            );
                          }
                        }}
                        style={{ left: `${startPct}%` }}
                        className="absolute top-0 bottom-0 -translate-x-1/2 w-5 flex items-center justify-center cursor-ew-resize z-20 touch-none focus:outline-none group"
                      >
                        <span className="w-1 h-full bg-amber-400 group-focus-visible:bg-white" />
                        <span className="absolute top-1/2 -translate-y-1/2 w-5 h-9 rounded-md bg-amber-400 border-2 border-[#140e0a] shadow-md flex items-center justify-center text-[9px] font-mono font-black text-[#140e0a]">
                          ‖
                        </span>
                      </button>

                      {/* End Handle */}
                      <button
                        type="button"
                        role="slider"
                        aria-label={copy.trimEndLabel}
                        aria-valuemin={trimStart + 0.1}
                        aria-valuemax={decodedSource.duration}
                        aria-valuenow={trimEnd}
                        data-testid="v2m-handle-end"
                        onPointerDown={(e) => handlePointerDownHandle(e, 'end')}
                        onPointerMove={(e) => handlePointerMoveHandle(e, 'end')}
                        onPointerUp={handlePointerUpHandle}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowLeft') {
                            e.preventDefault();
                            applyTrimRange(
                              trimStart,
                              trimEnd - 0.5,
                              decodedSource.duration
                            );
                          } else if (e.key === 'ArrowRight') {
                            e.preventDefault();
                            applyTrimRange(
                              trimStart,
                              trimEnd + 0.5,
                              decodedSource.duration
                            );
                          }
                        }}
                        style={{ left: `${endPct}%` }}
                        className="absolute top-0 bottom-0 -translate-x-1/2 w-5 flex items-center justify-center cursor-ew-resize z-20 touch-none focus:outline-none group"
                      >
                        <span className="w-1 h-full bg-amber-400 group-focus-visible:bg-white" />
                        <span className="absolute top-1/2 -translate-y-1/2 w-5 h-9 rounded-md bg-amber-400 border-2 border-[#140e0a] shadow-md flex items-center justify-center text-[9px] font-mono font-black text-[#140e0a]">
                          ‖
                        </span>
                      </button>
                    </>
                  )}
                </div>

                {/* Timecode Inputs & Preview Controls */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <label className="block">
                    <span className="block text-[11px] font-mono font-semibold text-[#7c4a2d] dark:text-[#d6b8a3] mb-1">
                      {copy.trimStartLabel}
                    </span>
                    <input
                      type="text"
                      dir="ltr"
                      disabled={!decodedSource}
                      data-testid="v2m-trim-start-input"
                      value={startInputText}
                      onChange={(e) => setStartInputText(e.target.value)}
                      onBlur={() => {
                        if (!decodedSource) return;
                        const parsed = parseTimecodeToSeconds(
                          startInputText,
                          trimStart
                        );
                        applyTrimRange(parsed, trimEnd, decodedSource.duration);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-orange-200/80 dark:border-orange-900/60 bg-[#fffaf5] dark:bg-[#140e0a] font-mono text-xs sm:text-sm font-bold text-[#1f130b] dark:text-[#fffaf5] disabled:opacity-50"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-[11px] font-mono font-semibold text-[#7c4a2d] dark:text-[#d6b8a3] mb-1">
                      {copy.trimEndLabel}
                    </span>
                    <input
                      type="text"
                      dir="ltr"
                      disabled={!decodedSource}
                      data-testid="v2m-trim-end-input"
                      value={endInputText}
                      onChange={(e) => setEndInputText(e.target.value)}
                      onBlur={() => {
                        if (!decodedSource) return;
                        const parsed = parseTimecodeToSeconds(
                          endInputText,
                          trimEnd
                        );
                        applyTrimRange(trimStart, parsed, decodedSource.duration);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-orange-200/80 dark:border-orange-900/60 bg-[#fffaf5] dark:bg-[#140e0a] font-mono text-xs sm:text-sm font-bold text-[#1f130b] dark:text-[#fffaf5] disabled:opacity-50"
                    />
                  </label>

                  <div className="px-3 py-2 rounded-xl bg-[#fffaf5] dark:bg-[#140e0a] border border-orange-200/60 dark:border-orange-900/40">
                    <div className="text-[10px] font-mono uppercase text-[#7c4a2d] dark:text-[#d6b8a3]">
                      {copy.clipDurationLabel}
                    </div>
                    <div
                      dir="ltr"
                      data-testid="v2m-clip-duration"
                      className="font-mono text-xs sm:text-sm font-bold text-[#c2410c] dark:text-[#fb923c]"
                    >
                      {decodedSource ? formatTimecode(clipDurationSec) : '00:00.0'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!decodedSource}
                      data-testid="v2m-preview-clip-btn"
                      onClick={handleTogglePlayClip}
                      className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 disabled:opacity-40 text-[#9a3412] dark:text-[#fb923c] font-mono text-xs font-bold transition-colors cursor-pointer"
                    >
                      {isPlayingPreview ? (
                        <SquareIcon className="w-3.5 h-3.5" />
                      ) : (
                        <PlayIcon className="w-3.5 h-3.5" />
                      )}
                      <span className="truncate">
                        {isPlayingPreview
                          ? copy.previewClipStop
                          : copy.previewClipPlay}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={!decodedSource}
                      title={copy.resetTrimCta}
                      aria-label={copy.resetTrimCta}
                      data-testid="v2m-reset-trim-btn"
                      onClick={() => {
                        if (!decodedSource) return;
                        stopClipPreview();
                        applyTrimRange(
                          0,
                          decodedSource.duration,
                          decodedSource.duration
                        );
                      }}
                      className="min-h-[40px] px-2.5 py-2 rounded-xl border border-orange-200/80 dark:border-orange-900/60 bg-[#fffaf5] dark:bg-[#140e0a] hover:border-[#c2410c] disabled:opacity-40 text-[#7c4a2d] dark:text-[#d6b8a3] transition-colors cursor-pointer"
                    >
                      <RefreshCwIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Audio Export Settings + Convert Action */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 rounded-2xl border border-orange-200/80 dark:border-orange-950/70 bg-white/95 dark:bg-[#1d140e]/95 p-5 shadow-sm space-y-5">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#7c4a2d] dark:text-[#d6b8a3]">
                    <SlidersIcon className="w-3.5 h-3.5 text-[#c2410c] dark:text-[#fb923c]" />
                    <span>{copy.settingsHeading}</span>
                  </div>

                  {/* Format Toggle (MP3 vs WAV) */}
                  <div>
                    <div className="text-xs font-mono font-semibold text-[#7c4a2d] dark:text-[#d6b8a3] mb-2">
                      {copy.formatLabel}
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        data-testid="v2m-format-mp3"
                        onClick={() => setOutputFormat('mp3')}
                        className={`px-3 py-3 rounded-xl font-mono text-xs font-bold border transition-all cursor-pointer ${
                          outputFormat === 'mp3'
                            ? 'bg-[#c2410c] text-white border-[#c2410c] shadow-sm'
                            : 'bg-[#fffaf5] dark:bg-[#140e0a] text-[#432818] dark:text-[#f5ebe4] border-orange-200/80 dark:border-orange-900/50 hover:border-[#c2410c]/60'
                        }`}
                      >
                        {copy.formatMp3}
                      </button>
                      <button
                        type="button"
                        data-testid="v2m-format-wav"
                        onClick={() => setOutputFormat('wav')}
                        className={`px-3 py-3 rounded-xl font-mono text-xs font-bold border transition-all cursor-pointer ${
                          outputFormat === 'wav'
                            ? 'bg-[#c2410c] text-white border-[#c2410c] shadow-sm'
                            : 'bg-[#fffaf5] dark:bg-[#140e0a] text-[#432818] dark:text-[#f5ebe4] border-orange-200/80 dark:border-orange-900/50 hover:border-[#c2410c]/60'
                        }`}
                      >
                        {copy.formatWav}
                      </button>
                    </div>
                  </div>

                  {/* MP3 Bitrate Selector OR WAV Sample Rate + Channels */}
                  {outputFormat === 'mp3' ? (
                    <div>
                      <div className="text-xs font-mono font-semibold text-[#7c4a2d] dark:text-[#d6b8a3] mb-2">
                        {copy.bitrateLabel}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {MP3_BITRATE_OPTIONS.map((kbps) => (
                          <button
                            key={kbps}
                            type="button"
                            data-testid={`v2m-bitrate-${kbps}`}
                            onClick={() => setMp3Bitrate(kbps)}
                            className={`px-2 py-2.5 rounded-xl font-mono text-xs font-bold border transition-all cursor-pointer ${
                              mp3Bitrate === kbps
                                ? 'bg-[#c2410c] text-white border-[#c2410c] shadow-sm'
                                : 'bg-[#fffaf5] dark:bg-[#140e0a] text-[#432818] dark:text-[#f5ebe4] border-orange-200/80 dark:border-orange-900/50 hover:border-[#c2410c]/60'
                            }`}
                          >
                            {kbps} kbps
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-mono font-semibold text-[#7c4a2d] dark:text-[#d6b8a3] mb-2">
                          {copy.sampleRateLabel}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {WAV_SAMPLE_RATE_OPTIONS.map((sr) => (
                            <button
                              key={sr}
                              type="button"
                              data-testid={`v2m-samplerate-${sr}`}
                              onClick={() => setWavSampleRate(sr)}
                              className={`px-2 py-2.5 rounded-xl font-mono text-xs font-bold border transition-all cursor-pointer ${
                                wavSampleRate === sr
                                  ? 'bg-[#c2410c] text-white border-[#c2410c] shadow-sm'
                                  : 'bg-[#fffaf5] dark:bg-[#140e0a] text-[#432818] dark:text-[#f5ebe4] border-orange-200/80 dark:border-orange-900/50'
                              }`}
                            >
                              {sr === 44100 ? '44.1 kHz' : '48 kHz'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-mono font-semibold text-[#7c4a2d] dark:text-[#d6b8a3] mb-2">
                          {copy.channelsLabel}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            data-testid="v2m-channels-2"
                            onClick={() => setWavChannels(2)}
                            className={`px-2 py-2.5 rounded-xl font-mono text-xs font-bold border transition-all cursor-pointer ${
                              wavChannels === 2
                                ? 'bg-[#c2410c] text-white border-[#c2410c] shadow-sm'
                                : 'bg-[#fffaf5] dark:bg-[#140e0a] text-[#432818] dark:text-[#f5ebe4] border-orange-200/80 dark:border-orange-900/50'
                            }`}
                          >
                            {copy.channelStereo}
                          </button>
                          <button
                            type="button"
                            data-testid="v2m-channels-1"
                            onClick={() => setWavChannels(1)}
                            className={`px-2 py-2.5 rounded-xl font-mono text-xs font-bold border transition-all cursor-pointer ${
                              wavChannels === 1
                                ? 'bg-[#c2410c] text-white border-[#c2410c] shadow-sm'
                                : 'bg-[#fffaf5] dark:bg-[#140e0a] text-[#432818] dark:text-[#f5ebe4] border-orange-200/80 dark:border-orange-900/50'
                            }`}
                          >
                            {copy.channelMono}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Volume Normalization Switch */}
                  <div className="p-3.5 rounded-xl bg-[#fffaf5] dark:bg-[#140e0a] border border-orange-200/70 dark:border-orange-900/50">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <VolumeIcon className="w-4 h-4 text-[#c2410c] dark:text-[#fb923c] shrink-0" />
                        <span className="font-display text-sm font-bold text-[#1f130b] dark:text-[#fffaf5]">
                          {copy.normalizeLabel}
                        </span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={normalizeVolume}
                        aria-label={copy.normalizeLabel}
                        data-testid="v2m-normalize-toggle"
                        onClick={() => setNormalizeVolume((prev) => !prev)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          normalizeVolume
                            ? 'bg-[#c2410c]'
                            : 'bg-orange-200 dark:bg-orange-950'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            normalizeVolume
                              ? locale === 'ar'
                                ? '-translate-x-5'
                                : 'translate-x-5'
                              : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                    <p className="mt-1.5 text-xs text-[#7c4a2d] dark:text-[#d6b8a3] leading-relaxed">
                      {copy.normalizeHint}
                    </p>
                  </div>

                  {/* Privacy notice */}
                  <div className="flex items-start gap-2.5 pt-2 border-t border-orange-200/60 dark:border-orange-950/60 text-[11px] text-[#7c4a2d] dark:text-[#d6b8a3]">
                    <ShieldCheckIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>{copy.privacyNotice}</span>
                  </div>
                </div>

                {/* Right Column: Estimated Size, Convert CTA, Progress Bar & Audio Result */}
                <div className="lg:col-span-5 rounded-2xl border border-orange-200/80 dark:border-orange-950/70 bg-white/95 dark:bg-[#1d140e]/95 p-5 shadow-sm space-y-5">
                  <div className="p-4 rounded-xl bg-[#fffaf5] dark:bg-[#140e0a] border border-orange-200/70 dark:border-orange-900/50 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-mono uppercase text-[#7c4a2d] dark:text-[#d6b8a3]">
                        {copy.estimatedSizeLabel}
                      </div>
                      <div
                        dir="ltr"
                        data-testid="v2m-estimated-size"
                        className="font-mono text-lg font-extrabold text-[#1f130b] dark:text-[#fffaf5]"
                      >
                        {decodedSource ? `~ ${formatByteSize(estimatedBytes)}` : '—'}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-orange-500/15 text-[#c2410c] dark:text-[#fb923c] font-mono text-xs font-bold">
                      {outputFormat === 'mp3'
                        ? `MP3 ${mp3Bitrate}`
                        : `WAV ${wavSampleRate / 1000}k`}
                    </span>
                  </div>

                  {/* Primary Convert CTA */}
                  <button
                    type="button"
                    data-testid="v2m-convert-btn"
                    disabled={!decodedSource || isConverting}
                    onClick={handleConvert}
                    className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 disabled:opacity-45 text-white font-display font-bold text-sm sm:text-base shadow-md shadow-orange-600/20 transition-all cursor-pointer"
                  >
                    <MusicIcon className="w-4 h-4" />
                    <span>
                      {isConverting
                        ? `${copy.convertingStatus} ${conversionProgress}%`
                        : outputFormat === 'mp3'
                        ? copy.convertToMp3Cta
                        : copy.convertToWavCta}
                    </span>
                  </button>

                  {/* Live Progress Bar */}
                  {(isConverting || conversionProgress > 0) && (
                    <div
                      aria-live="polite"
                      data-testid="v2m-progress-wrap"
                      className="space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs font-mono font-semibold text-[#7c4a2d] dark:text-[#d6b8a3]">
                        <span className="truncate">{conversionStageText}</span>
                        <span>{conversionProgress}%</span>
                      </div>
                      <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={conversionProgress}
                        className="w-full h-2.5 rounded-full bg-orange-100 dark:bg-orange-950 overflow-hidden"
                      >
                        <div
                          className="h-full bg-gradient-to-r from-orange-600 to-amber-400 transition-all duration-150"
                          style={{ width: `${conversionProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Converted Audio Preview Player + Rename + Download */}
                  {convertedOutput && (
                    <div
                      data-testid="v2m-result-card"
                      className="pt-4 border-t border-orange-200/70 dark:border-orange-900/50 space-y-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-sm font-bold text-[#1f130b] dark:text-[#fffaf5]">
                          {copy.resultHeading}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-bold">
                          {convertedOutput.detailBadge}
                        </span>
                      </div>

                      <audio
                        controls
                        preload="metadata"
                        src={convertedOutput.objectUrl}
                        data-testid="v2m-audio-preview"
                        className="w-full h-11 rounded-xl"
                      />

                      <div className="flex items-center justify-between text-xs font-mono text-[#7c4a2d] dark:text-[#d6b8a3]">
                        <span>{copy.actualSizeLabel}</span>
                        <strong className="text-[#1f130b] dark:text-[#fffaf5]">
                          {formatByteSize(convertedOutput.byteSize)}
                        </strong>
                      </div>

                      <label className="block">
                        <span className="block text-[11px] font-mono font-semibold text-[#7c4a2d] dark:text-[#d6b8a3] mb-1">
                          {copy.filenameLabel}
                        </span>
                        <div
                          dir="ltr"
                          className="flex items-center rounded-xl border border-orange-300/80 dark:border-orange-900/60 bg-[#fffaf5] dark:bg-[#140e0a] overflow-hidden"
                        >
                          <input
                            type="text"
                            data-testid="v2m-filename-input"
                            value={outputFilenameBase}
                            onChange={(e) =>
                              setOutputFilenameBase(e.target.value)
                            }
                            className="flex-1 min-w-0 px-3 py-2 bg-transparent font-mono text-xs sm:text-sm font-semibold text-[#1f130b] dark:text-[#fffaf5] focus:outline-none"
                          />
                          <span className="px-3 py-2 bg-orange-500/10 text-[#c2410c] dark:text-[#fb923c] font-mono text-xs font-bold border-l border-orange-200/70 dark:border-orange-900/50">
                            .{convertedOutput.format}
                          </span>
                        </div>
                      </label>

                      <button
                        type="button"
                        data-testid="v2m-download-btn"
                        onClick={handleDownloadConverted}
                        className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#1f130b] hover:bg-[#382315] dark:bg-orange-600 dark:hover:bg-orange-500 text-white font-display font-bold text-sm shadow-sm transition-colors cursor-pointer"
                      >
                        <DownloadIcon className="w-4 h-4" />
                        <span>{copy.downloadAudioCta}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Ads (below the tool, never overlapping preview or download buttons) */}
            <div className="mt-8 space-y-6">
              <AdSlot
                slotId="vidnex-v2m-bottom-rectangle"
                format="rectangle"
                language={locale}
              />
              <AdSlot
                slotId="vidnex-v2m-native"
                format="native"
                language={locale}
              />
            </div>

            {/* How-To 3 Steps Section */}
            {activeHowToSteps.length > 0 && (
              <div className="mt-12">
                <div className="text-xs font-mono font-bold uppercase tracking-widest text-[#c2410c] dark:text-[#fb923c] mb-2">
                  {bundle.ui.sections.workflowProtocol}
                </div>
                <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#1f130b] dark:text-[#fffaf5] mb-6">
                  {bundle.ui.sections.howToHeading}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {activeHowToSteps.map((step, idx) => (
                    <div
                      key={step.number}
                      id={`step-${idx + 1}`}
                      className="rounded-2xl border border-orange-200/80 dark:border-orange-950/70 bg-white/90 dark:bg-[#1d140e]/90 p-5 shadow-sm flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-orange-500/10 text-[#c2410c] dark:text-[#fb923c]">
                            {step.number}
                          </span>
                          <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                            ● {bundle.ui.sections.readyStatus}
                          </span>
                        </div>
                        <h3 className="font-display text-base font-bold text-[#1f130b] dark:text-[#fffaf5] mb-2">
                          {step.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-[#6e472b] dark:text-[#d6b8a3] leading-relaxed mb-4">
                          {step.description}
                        </p>
                      </div>
                      <div className="px-3 py-2 rounded-lg bg-[#fffaf5] dark:bg-[#140e0a] border border-orange-200/60 dark:border-orange-900/40 font-mono text-[11px] text-[#7c4a2d] dark:text-[#d6b8a3]">
                        {step.codeHint}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Editorial Guide Block */}
            {activeEditorial && (
              <article className="mt-12 rounded-2xl border border-orange-200/80 dark:border-orange-950/70 bg-white/90 dark:bg-[#1d140e]/90 p-6 sm:p-8 shadow-sm">
                <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#1f130b] dark:text-[#fffaf5] mb-2">
                  {activeEditorial.heading}
                </h2>
                <p className="text-xs sm:text-sm font-mono font-semibold text-[#c2410c] dark:text-[#fb923c] mb-4">
                  {activeEditorial.subheading}
                </p>

                <div className="space-y-3 text-sm sm:text-base text-[#432818] dark:text-[#e7d5c9] leading-relaxed mb-6">
                  {activeEditorial.paragraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-orange-200/60 dark:border-orange-950/60">
                  <div>
                    <h3 className="font-display text-sm font-bold text-[#1f130b] dark:text-[#fffaf5] mb-2">
                      {activeEditorial.formatsTitle}
                    </h3>
                    <ul className="space-y-1.5 text-xs sm:text-sm text-[#6e472b] dark:text-[#d6b8a3] list-disc list-inside">
                      {activeEditorial.formatsList.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-[#1f130b] dark:text-[#fffaf5] mb-2">
                      {activeEditorial.limitsTitle}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#6e472b] dark:text-[#d6b8a3] leading-relaxed">
                      {activeEditorial.limitsText}
                    </p>
                  </div>
                </div>
              </article>
            )}

            {/* Formats Table, Troubleshooting, Where To Find File, Related Tools */}
            {videoToolContent && (
              <ToolRichSections
                locale={locale}
                toolContent={videoToolContent}
                onNavigatePage={onNavigatePage}
                onNavigatePath={onNavigatePath}
                compactContainer
              />
            )}

            {/* FAQ Section (matches FAQPage JSON-LD 1:1) */}
            {activeFaqs.length > 0 && (
              <div className="mt-12">
                <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-[#c2410c] dark:text-[#fb923c] mb-2">
                  <HelpCircleIcon className="w-3.5 h-3.5" />
                  <span>{bundle.ui.sections.knowledgeBase}</span>
                </div>
                <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#1f130b] dark:text-[#fffaf5] mb-6">
                  {bundle.ui.sections.faqHeading}
                </h2>

                <div className="space-y-3">
                  {activeFaqs.map((faq, idx) => {
                    const isOpen = openFaqIndex === idx;
                    return (
                      <div
                        key={idx}
                        data-faq-item="true"
                        className="rounded-2xl border border-orange-200/80 dark:border-orange-950/70 bg-white/90 dark:bg-[#1d140e]/90 overflow-hidden"
                      >
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                          className="w-full px-5 py-4 text-start flex items-center justify-between gap-4 font-display text-sm sm:text-base font-bold text-[#1f130b] dark:text-[#fffaf5] cursor-pointer"
                        >
                          <span data-faq-question="true">{faq.question}</span>
                          <ChevronDownIcon
                            className={`w-4 h-4 shrink-0 text-[#c2410c] dark:text-[#fb923c] transition-transform ${
                              isOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                        <div
                          data-faq-answer="true"
                          className={
                            isOpen
                              ? 'px-5 pb-4 text-xs sm:text-sm text-[#6e472b] dark:text-[#d6b8a3] leading-relaxed'
                              : 'hidden'
                          }
                        >
                          {faq.answer}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Internal Cross-Links to Tools Hub, Split Image, and Platform Downloaders */}
            <div className="mt-12 pt-8 border-t border-orange-200/60 dark:border-orange-950/60">
              <h2 className="font-display text-base sm:text-lg font-bold text-[#1f130b] dark:text-[#fffaf5] mb-4">
                {bundle.ui.sections.platformsHeading}
              </h2>
              <div className="flex flex-wrap gap-2.5">
                <a
                  href={toolsHubHref}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigatePage('tools_hub');
                  }}
                  className="px-3.5 py-2 rounded-xl border border-orange-300/80 dark:border-orange-800/60 bg-orange-50/80 dark:bg-[#231710] hover:border-[#c2410c] text-xs font-mono font-bold text-[#9a3412] dark:text-[#fb923c] transition-colors"
                >
                  {hubCopy.breadcrumbLabel}
                </a>
                <a
                  href={splitHref}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigatePage('split_image');
                  }}
                  className="px-3.5 py-2 rounded-xl border border-orange-200/80 dark:border-orange-900/50 bg-white/80 dark:bg-[#1d140e]/80 hover:border-[#c2410c] text-xs font-mono font-bold text-[#432818] dark:text-[#f5ebe4] transition-colors"
                >
                  {splitCopy.breadcrumbLabel}
                </a>
                {PLATFORM_PAGE_KEYS.map((pKey) => {
                  const pHref = getLocalizedPagePath(locale, pKey);
                  const pData = bundle.platforms[pKey];
                  return (
                    <a
                      key={pKey}
                      href={pHref}
                      onClick={(e) => {
                        e.preventDefault();
                        onNavigatePage(pKey);
                      }}
                      className="px-3.5 py-2 rounded-xl border border-orange-200/80 dark:border-orange-900/50 bg-white/80 dark:bg-[#1d140e]/80 hover:border-[#c2410c] text-xs font-mono font-bold text-[#432818] dark:text-[#f5ebe4] transition-colors"
                    >
                      {pData.shortLabel || pData.breadcrumbLabel}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Desktop Skyscraper Ad */}
          <aside
            aria-label="Sponsored Right"
            className="hidden xl:flex shrink-0 sticky top-24"
          >
            <AdSlot
              slotId="vidnex-v2m-right-skyscraper"
              format="skyscraper"
              language={locale}
            />
          </aside>
        </div>
      </section>
    </div>
  );
};
