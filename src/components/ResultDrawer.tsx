import React, { useState, useEffect, useRef } from 'react';
import {
  MediaResult,
  VideoMediaResult,
  ProfileDpMediaResult,
  CarouselMediaResult,
  resolveApiUrl,
} from '../services/extractorService';
import {
  LanguageCode,
  UI_TRANSLATIONS,
  UiDictionary,
} from '../i18n/translations';
import { buildUncompressedZipArchive } from '../utils/zipArchive';

interface ResultDrawerProps {
  isLoading: boolean;
  error: string | null;
  result: MediaResult | null;
  onClose: () => void;
  onRetry?: () => void;
  language: LanguageCode;
}

const STUDIO_FALLBACK_THUMB =
  "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 720 900'%3E%3Crect width='720' height='900' fill='%231f130b'/%3E%3Ccircle cx='360' cy='420' r='56' fill='%23ea580c' fill-opacity='0.85'/%3E%3Cpolygon points='346,396 346,444 388,420' fill='%23fffaf5'/%3E%3Ctext x='360' y='535' text-anchor='middle' fill='%23fffaf5' font-family='sans-serif' font-size='26' font-weight='700'%3EVIDNEX HD STREAM%3C/text%3E%3C/svg%3E";

function buildDownloadEndpointUrl(filename: string, rawDownloadUrl?: string): string {
  if (!rawDownloadUrl) return '';
  if (rawDownloadUrl.includes('/api/download')) {
    return resolveApiUrl(rawDownloadUrl);
  }
  return resolveApiUrl(
    `/api/download?${new URLSearchParams({
      url: rawDownloadUrl,
      filename,
    }).toString()}`
  );
}

export function buildInlineVideoPreviewUrl(rawDownloadUrl?: string): string {
  if (!rawDownloadUrl) return '';
  const resolved = resolveApiUrl(rawDownloadUrl);
  if (!resolved.includes('/api/download')) {
    return resolved;
  }
  try {
    const isAbsolute =
      resolved.startsWith('http://') || resolved.startsWith('https://');
    const parsed = new URL(resolved, 'https://vidnex.space');
    parsed.searchParams.set('inline', '1');
    return isAbsolute
      ? parsed.toString()
      : `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    const separator = resolved.includes('?') ? '&' : '?';
    return `${resolved}${separator}inline=1`;
  }
}

function triggerNativeBackendDownload(filename: string, rawDownloadUrl?: string) {
  const targetUrl = buildDownloadEndpointUrl(filename, rawDownloadUrl);
  if (!targetUrl) return;

  let downloadAttr = filename;
  try {
    const parsed = new URL(targetUrl, window.location.origin);
    const backendName = parsed.searchParams.get('filename');
    if (backendName) {
      downloadAttr = backendName;
    }
  } catch {
    // Keep fallback filename
  }

  const anchor = document.createElement('a');
  anchor.href = targetUrl;
  anchor.download = downloadAttr;
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 15000);
}

export const ResultDrawer: React.FC<ResultDrawerProps> = ({
  isLoading,
  error,
  result,
  onClose,
  onRetry,
  language,
}) => {
  const t = UI_TRANSLATIONS[language].drawer;
  const sectionRef = useRef<HTMLElement>(null);

  // ÉTAPE 5: Smooth automatic scroll to result drawer when extraction starts or completes
  useEffect(() => {
    if ((isLoading || error || result) && sectionRef.current) {
      sectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [isLoading, Boolean(error), result?.id]);

  if (!isLoading && !error && !result) {
    return null;
  }

  return (
    <section
      ref={sectionRef}
      aria-live="polite"
      className="w-full py-5 sm:py-8 scroll-mt-16"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* 1. WARM ORANGE WAVEFORM PROCESSING LOADER */}
        {isLoading && (
          <div className="rounded-3xl bg-white/95 dark:bg-[#1c140e]/95 backdrop-blur-xl border-2 border-orange-200/80 dark:border-orange-900/60 p-6 sm:p-8 shadow-orange-glow flex flex-col items-center text-center relative overflow-hidden">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center mb-4 shadow-[0_0_24px_rgba(234,88,12,0.45)]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-8 h-8 animate-spin"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </div>
            <div className="font-mono text-[11px] text-orange-600 dark:text-amber-400 uppercase tracking-widest mb-1 font-bold">
              {t.bypassingWatermark}
            </div>
            <h3 className="font-display text-lg font-bold text-[#1f130b] dark:text-[#fffaf5] mb-4">
              {t.resolvingStream}
            </h3>

            {/* Animated Audio/Video Waveform Graphic */}
            <div className="w-full max-w-md bg-orange-50/90 dark:bg-[#2a1b12] border border-orange-200 dark:border-orange-900/60 p-4 rounded-2xl shadow-inner">
              <div className="flex items-end justify-between h-12 px-3 gap-1.5">
                {[32, 48, 24, 52, 40, 28, 48, 20, 44, 36, 50, 30].map(
                  (h, i) => (
                    <span
                      key={i}
                      style={{ height: `${h}px` }}
                      className="w-2.5 bg-gradient-to-t from-orange-600 to-amber-400 rounded-full animate-pulse shadow-[0_0_8px_#ea580c]"
                    />
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. WARM GUARDRAIL ERROR CARD */}
        {!isLoading && error && (
          <div
            role="alert"
            className="rounded-3xl bg-white/95 dark:bg-[#1c140e]/95 backdrop-blur-xl border-2 border-red-300 dark:border-red-900/70 p-5 sm:p-6 shadow-orange-glow flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 sm:gap-5"
          >
            <div className="flex items-start gap-4 text-start">
              <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 items-center justify-center shrink-0 text-red-600 dark:text-red-400">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-6 h-6"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="font-mono text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                  {t.extractionInterrupted}
                </div>
                <p className="mt-1 text-base font-medium text-[#1f130b] dark:text-[#fffaf5] leading-relaxed break-words">
                  {error}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="flex-1 sm:flex-initial min-h-[48px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-mono text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  {t.retryExtraction}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-initial min-h-[48px] px-4 py-2.5 rounded-xl bg-orange-50 dark:bg-[#2a1b12] border border-orange-200 dark:border-orange-800/70 font-mono text-xs font-semibold text-orange-950 dark:text-orange-100 hover:bg-orange-100 transition-colors cursor-pointer"
              >
                {t.dismiss}
              </button>
            </div>
          </div>
        )}

        {/* 3. ACTIVE RESULT CARD */}
        {!isLoading && !error && result && (
          <div className="relative rounded-3xl bg-white/95 dark:bg-[#1c140e]/95 backdrop-blur-xl border-2 border-orange-200/80 dark:border-orange-900/60 p-4 sm:p-6 shadow-orange-glow overflow-hidden">
            <div className="absolute -right-16 -top-16 w-48 h-48 bg-orange-400/10 rounded-full blur-2xl pointer-events-none" />
            <button
              type="button"
              onClick={onClose}
              aria-label={t.clearResult}
              className="absolute top-3 right-3 rtl:right-auto rtl:left-3 w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center bg-orange-50 dark:bg-[#2a1b12] border border-orange-200/80 dark:border-orange-800/70 text-orange-900 dark:text-orange-200 hover:bg-orange-500 hover:text-white transition-colors z-10 font-mono text-base font-bold cursor-pointer"
            >
              ×
            </button>

            {result.payloadType === 'video' && (
              <VideoResultView data={result} t={t} />
            )}
            {result.payloadType === 'profile_dp' && (
              <ProfileDpResultView data={result} t={t} />
            )}
            {result.payloadType === 'carousel' && (
              <CarouselResultView data={result} t={t} />
            )}
          </div>
        )}
      </div>
    </section>
  );
};

/* ============================================================================
 * VIDEO RESULT VIEW
 * ========================================================================== */
const VideoResultView: React.FC<{
  data: VideoMediaResult;
  t: UiDictionary['drawer'];
}> = ({ data, t }) => {
  const [activeDownloadId, setActiveDownloadId] = useState<string | null>(null);
  const [hasTriggeredDownload, setHasTriggeredDownload] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  useEffect(() => {
    setIsPlayingPreview(false);
    setHasTriggeredDownload(false);
  }, [data.id]);

  const primaryFormat =
    data.formats.find((f) => f.isPrimary) || data.formats[0];
  const secondaryFormats = data.formats.filter(
    (f) => f.id !== primaryFormat?.id
  );

  const previewVideoSrc = buildInlineVideoPreviewUrl(
    primaryFormat?.downloadUrl
  );

  const overlayBadgeParts = [data.duration, data.resolution].filter(Boolean);
  const technicalSpecsParts = [
    data.resolution,
    data.codec,
    primaryFormat?.fileSize,
  ].filter(Boolean);

  const handleDownloadClick = (
    formatId: string,
    quality: string,
    container: string,
    downloadUrl?: string
  ) => {
    setActiveDownloadId(formatId);
    setHasTriggeredDownload(true);
    const cleanHandle = data.creatorHandle.replace(/[^a-zA-Z0-9_-]/g, '');
    const ext = container.toLowerCase();
    const isAudio = ext === 'mp3' || ext === 'm4a' || quality === 'Audio';
    const cleanVideoId = (data.id || 'video')
      .replace(/^vid-|^car-/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '');
    const filename =
      data.platform === 'tiktok' && isAudio
        ? `tiktok_${cleanVideoId}.${ext}`
        : `VIDNEX_${data.platform}_${cleanHandle}_${quality}.${ext}`;

    triggerNativeBackendDownload(filename, downloadUrl);

    setTimeout(() => {
      setActiveDownloadId(null);
    }, 1000);
  };

  const isSingleImage =
    primaryFormat?.container === 'JPG' || primaryFormat?.container === 'PNG';

  return (
    <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 items-center sm:items-stretch relative z-10">
      {/* Left: Mobile-adapted Media Preview Card with Click-to-Play Inline Video */}
      <div className="relative w-full max-w-[260px] sm:max-w-none sm:w-52 aspect-[4/5] rounded-2xl overflow-hidden bg-[#1f130b] shrink-0 shadow-md border-2 border-orange-300 dark:border-orange-800/80 group">
        {isPlayingPreview && !isSingleImage ? (
          <video
            src={previewVideoSrc}
            controls
            autoPlay
            playsInline
            className="w-full h-full object-cover bg-black"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              if (!isSingleImage) setIsPlayingPreview(true);
            }}
            aria-label={isSingleImage ? data.title : 'Play video preview'}
            className="w-full h-full relative block text-left cursor-pointer"
          >
            <img
              src={resolveApiUrl(data.thumbnailUrl)}
              alt={data.title || `${data.badgeLabel} — ${data.creatorHandle}`}
              width={480}
              height={600}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const img = e.currentTarget;
                if (img.src !== STUDIO_FALLBACK_THUMB) {
                  img.src = STUDIO_FALLBACK_THUMB;
                }
              }}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {overlayBadgeParts.length > 0 && (
              <span
                dir="ltr"
                className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-md bg-stone-900/85 backdrop-blur-md text-white font-mono text-[11px] font-semibold"
              >
                {overlayBadgeParts.join(' • ')}
              </span>
            )}
          </button>
        )}
        <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-gradient-to-r from-orange-600 to-amber-500 text-white font-mono text-[10px] uppercase font-bold shadow-sm pointer-events-none">
          {isSingleImage ? t.originalJpglBadge : t.noWatermarkBadge}
        </span>
      </div>

      {/* Right: Metadata & Full-Width Format Download Buttons */}
      <div className="flex-1 flex flex-col justify-between w-full gap-4 min-w-0">
        <div className="pr-10 rtl:pr-0 rtl:pl-10">
          <div className="flex flex-wrap items-center gap-2 text-xs text-orange-900/75 dark:text-orange-200/75 font-mono">
            <span className="font-bold text-orange-700 dark:text-amber-400">
              {data.badgeLabel}
            </span>
            <span>·</span>
            <span
              dir="ltr"
              className="font-semibold text-[#1f130b] dark:text-[#fffaf5]"
            >
              {data.creatorHandle}
            </span>
            {data.creatorName && data.creatorName !== data.creatorHandle && (
              <>
                <span>·</span>
                <span>{data.creatorName}</span>
              </>
            )}
          </div>

          <h3 className="mt-1.5 font-display text-base sm:text-lg font-bold text-[#1f130b] dark:text-[#fffaf5] line-clamp-2 leading-snug break-words">
            {data.title}
          </h3>

          {technicalSpecsParts.length > 0 && (
            <p className="mt-1 font-mono text-xs text-[#6c4e40] dark:text-orange-200/70 font-medium">
              {technicalSpecsParts.join(' · ')}
            </p>
          )}
        </div>

        <div className="space-y-2.5 w-full">
          {/* Primary Button: Full-width MP4 HD or Original Image */}
          {primaryFormat && (
            <button
              type="button"
              onClick={() =>
                handleDownloadClick(
                  primaryFormat.id,
                  primaryFormat.quality,
                  primaryFormat.container,
                  primaryFormat.downloadUrl
                )
              }
              className="w-full min-h-[48px] px-5 rounded-xl flex items-center justify-between bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 hover:from-orange-700 hover:to-amber-600 text-white shadow-[0_4px_16px_rgba(234,88,12,0.35)] hover:shadow-[0_6px_22px_rgba(234,88,12,0.5)] text-sm font-bold transition-all active:scale-[0.99] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                  className="w-4 h-4 shrink-0"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>
                  {activeDownloadId === primaryFormat.id
                    ? t.startingStream
                    : isSingleImage
                    ? `${t.originalJpglBadge} (${primaryFormat.quality})`
                    : primaryFormat.quality === '1080p'
                    ? t.downloadHd1080
                    : primaryFormat.quality === 'HD'
                    ? `${t.downloadHd1080.split('1080p')[0].trim()} (MP4)`
                    : `${t.downloadHd1080.split('1080p')[0].trim()} ${primaryFormat.quality} (MP4)`}
                </span>
              </span>
              <span dir="ltr" className="font-mono text-xs opacity-90 shrink-0">
                {primaryFormat.fileSize
                  ? primaryFormat.fileSize
                  : `${primaryFormat.container} · ${primaryFormat.quality}`}
              </span>
            </button>
          )}

          {/* Secondary Quality / Format Buttons (Full-width on mobile, >= 48px height) */}
          {secondaryFormats.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
              {secondaryFormats.map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() =>
                    handleDownloadClick(
                      fmt.id,
                      fmt.quality,
                      fmt.container,
                      fmt.downloadUrl
                    )
                  }
                  className="w-full min-h-[48px] px-4 rounded-xl flex items-center justify-between bg-orange-50/80 dark:bg-[#2a1b12] border border-orange-200 dark:border-orange-800/70 hover:bg-orange-100 dark:hover:bg-orange-950 hover:border-orange-400 text-xs sm:text-sm font-bold text-orange-950 dark:text-orange-100 transition-all shadow-sm cursor-pointer"
                >
                  <span>
                    {activeDownloadId === fmt.id
                      ? t.saving
                      : fmt.container === 'MP3' ||
                        fmt.container === 'M4A' ||
                        fmt.quality === 'Audio'
                      ? t.extractAudioMp3
                      : fmt.quality === '720p' &&
                        data.platform !== 'x' &&
                        data.platform !== 'twitter'
                      ? t.downloadSd720
                      : `${fmt.container} · ${fmt.quality}`}
                  </span>
                  <span
                    dir="ltr"
                    className="font-mono text-xs text-orange-700 dark:text-amber-400 shrink-0"
                  >
                    {fmt.container === 'MP3' || fmt.container === 'M4A'
                      ? fmt.fileSize
                        ? `${fmt.container} · ${fmt.fileSize}`
                        : fmt.container
                      : fmt.fileSize || fmt.quality}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* ÉTAPE 5: Post-download reminder for iOS / mobile ("Retrouvez le fichier dans l'app Fichiers") */}
          {hasTriggeredDownload && t.iosFilesHint && (
            <p
              data-testid="ios-files-hint"
              className="mt-2 px-3.5 py-2.5 rounded-xl bg-orange-50/90 dark:bg-[#231710] border border-orange-200/80 dark:border-orange-900/50 text-xs text-[#6c4e40] dark:text-orange-200/85 leading-relaxed"
            >
              {t.iosFilesHint}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * PROFILE PHOTO (DP) VIEW
 * ========================================================================== */
const ProfileDpResultView: React.FC<{
  data: ProfileDpMediaResult;
  t: UiDictionary['drawer'];
}> = ({ data, t }) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [hasTriggeredDownload, setHasTriggeredDownload] = useState(false);

  const qualityBadge = data.quality === 'Standard' ? 'Standard' : 'HD';
  const cleanUsername = data.creatorHandle
    .replace(/^@/, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');

  const handleDownloadDp = () => {
    setDownloading(true);
    setHasTriggeredDownload(true);
    const filename =
      data.platform === 'instagram'
        ? `instagram_${cleanUsername || 'user'}_profile.jpg`
        : data.platform === 'linkedin'
        ? `linkedin_${cleanUsername || 'user'}_profile.jpg`
        : `VIDNEX_${cleanUsername || 'user'}_HD_DP.jpg`;
    triggerNativeBackendDownload(filename, data.hdOriginalUrl);
    setTimeout(() => setDownloading(false), 1000);
  };

  return (
    <div className="flex flex-col items-center text-center space-y-4 pt-1 relative z-10">
      <div className="space-y-1 px-8">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <h3
            dir="ltr"
            className="font-display text-lg sm:text-xl font-bold text-[#1f130b] dark:text-[#fffaf5]"
          >
            {data.creatorHandle}
          </h3>
          <span
            data-testid="profile-quality-badge"
            className={`px-2.5 py-0.5 rounded-md font-mono text-[11px] font-bold uppercase tracking-wide ${
              qualityBadge === 'HD'
                ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-sm'
                : 'bg-orange-100 dark:bg-[#2a1b12] text-orange-900 dark:text-orange-200 border border-orange-300 dark:border-orange-800'
            }`}
          >
            {qualityBadge}
          </span>
        </div>

        {data.creatorName && data.creatorName !== data.creatorHandle && (
          <p
            data-testid="profile-full-name"
            className="text-sm font-medium text-[#4a3429] dark:text-orange-100/90"
          >
            {data.creatorName}
          </p>
        )}

        {(data.followersCount || data.dimensions) && (
          <p className="text-xs font-mono text-[#6c4e40] dark:text-orange-200/75">
            {[
              data.followersCount
                ? `${data.followersCount}${t.followers ? ` ${t.followers}` : ''}`
                : null,
              data.dimensions || null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>

      {/* Enlarged Square Preview with Click-to-Zoom */}
      <div
        onClick={() => setIsZoomed((prev) => !prev)}
        className={`relative rounded-2xl overflow-hidden bg-[#1f130b] border-2 border-orange-300 dark:border-orange-800/80 shadow-md transition-all duration-200 ${
          isZoomed
            ? 'w-full max-w-lg aspect-square cursor-zoom-out'
            : 'w-60 h-60 sm:w-72 sm:h-72 cursor-zoom-in'
        }`}
      >
        <img
          src={resolveApiUrl(data.standardPreviewUrl || data.hdOriginalUrl)}
          alt={`${data.creatorName || data.creatorHandle} (${data.creatorHandle})`}
          width={640}
          height={640}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const img = e.currentTarget;
            if (img.src !== STUDIO_FALLBACK_THUMB) {
              img.src = STUDIO_FALLBACK_THUMB;
            }
          }}
          className="w-full h-full object-cover"
        />
        <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md bg-stone-900/85 text-white font-mono text-[11px] font-bold">
          {qualityBadge} · JPG
        </span>
      </div>

      {/* Action Buttons: Full-width on mobile, >= 48px */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 w-full sm:w-auto">
        <button
          type="button"
          onClick={handleDownloadDp}
          className="w-full sm:w-auto min-w-[240px] min-h-[48px] px-7 rounded-xl bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 hover:from-orange-700 hover:to-amber-600 text-white shadow-[0_4px_16px_rgba(234,88,12,0.35)] text-sm font-bold transition-all cursor-pointer"
        >
          {downloading ? t.fetchingOriginalJpg : t.downloadFullSizePhoto}
        </button>

        <button
          type="button"
          onClick={() => setIsZoomed((prev) => !prev)}
          aria-pressed={isZoomed}
          className="w-full sm:w-auto min-h-[48px] px-5 rounded-xl bg-orange-50 dark:bg-[#2a1b12] border border-orange-200 dark:border-orange-800/70 hover:bg-orange-100 dark:hover:bg-orange-950/80 text-orange-950 dark:text-orange-100 font-display text-sm font-semibold transition-all cursor-pointer"
        >
          {t.hdZoomBtn}
        </button>
      </div>

      {hasTriggeredDownload && t.iosFilesHint && (
        <p
          data-testid="ios-files-hint"
          className="w-full max-w-md px-3.5 py-2.5 rounded-xl bg-orange-50/90 dark:bg-[#231710] border border-orange-200/80 dark:border-orange-900/50 text-xs text-[#6c4e40] dark:text-orange-200/85 leading-relaxed"
        >
          {t.iosFilesHint}
        </p>
      )}
    </div>
  );
};

/* ============================================================================
 * CAROUSEL VIEW
 * ========================================================================== */
const CarouselResultView: React.FC<{
  data: CarouselMediaResult;
  t: UiDictionary['drawer'];
}> = ({ data, t }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    data.items.map((item) => item.id)
  );
  const [zipDownloading, setZipDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<string | null>(null);
  const [hasTriggeredDownload, setHasTriggeredDownload] = useState(false);

  useEffect(() => {
    setSelectedIds(data.items.map((item) => item.id));
    setHasTriggeredDownload(false);
  }, [data.id, data.items]);

  const allSelected = selectedIds.length === data.items.length;

  const handleToggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : data.items.map((item) => item.id));
  };

  const handleToggleSlide = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDownloadSelected = async () => {
    if (selectedIds.length === 0 || zipDownloading) return;
    setZipDownloading(true);
    setHasTriggeredDownload(true);
    const cleanHandle = data.creatorHandle.replace(/[^a-zA-Z0-9_-]/g, '');
    const selectedSlides = data.items.filter((i) => selectedIds.includes(i.id));

    try {
      if (selectedSlides.length === 1) {
        const slide = selectedSlides[0];
        const ext = slide.mediaType === 'video' ? 'mp4' : 'jpg';
        const singleFilename = `VIDNEX_${cleanHandle}_slide_${slide.index}.${ext}`;
        setDownloadProgress('1/1');
        const targetUrl = buildDownloadEndpointUrl(
          singleFilename,
          slide.downloadUrl
        );
        const resp = await fetch(targetUrl);
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const blob = await resp.blob();
        triggerBlobDownload(blob, singleFilename);
        return;
      }

      const zipEntries: Array<{ name: string; data: Uint8Array }> = [];
      for (let i = 0; i < selectedSlides.length; i++) {
        const slide = selectedSlides[i];
        const ext = slide.mediaType === 'video' ? 'mp4' : 'jpg';
        const entryName = `VIDNEX_${cleanHandle}_slide_${slide.index}.${ext}`;
        setDownloadProgress(`${i + 1}/${selectedSlides.length}`);

        const targetUrl = buildDownloadEndpointUrl(entryName, slide.downloadUrl);
        const resp = await fetch(targetUrl);
        if (resp.ok) {
          const buf = await resp.arrayBuffer();
          zipEntries.push({
            name: entryName,
            data: new Uint8Array(buf),
          });
        }
      }

      if (zipEntries.length > 0) {
        const zipBlob = buildUncompressedZipArchive(zipEntries);
        triggerBlobDownload(
          zipBlob,
          `VIDNEX_${cleanHandle}_carousel_${zipEntries.length}_slides.zip`
        );
      } else {
        selectedSlides.forEach((slide, idx) => {
          const ext = slide.mediaType === 'video' ? 'mp4' : 'jpg';
          setTimeout(() => {
            triggerNativeBackendDownload(
              `VIDNEX_${cleanHandle}_slide_${slide.index}.${ext}`,
              slide.downloadUrl
            );
          }, idx * 450);
        });
      }
    } catch {
      selectedSlides.forEach((slide, idx) => {
        const ext = slide.mediaType === 'video' ? 'mp4' : 'jpg';
        setTimeout(() => {
          triggerNativeBackendDownload(
            `VIDNEX_${cleanHandle}_slide_${slide.index}.${ext}`,
            slide.downloadUrl
          );
        }, idx * 450);
      });
    } finally {
      setZipDownloading(false);
      setDownloadProgress(null);
    }
  };

  return (
    <div className="space-y-4 relative z-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-12 rtl:pr-0 rtl:pl-12">
        <div>
          <span
            dir="ltr"
            className="font-display text-base font-bold text-[#1f130b] dark:text-[#fffaf5]"
          >
            {data.creatorHandle}
          </span>
          <span className="ml-2 font-mono text-xs text-orange-700 dark:text-amber-400 font-semibold">
            · {data.totalItems} {t.slidesDetected}
            {data.archiveSize ? ` (${data.archiveSize})` : ''}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleToggleSelectAll}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-orange-50 dark:bg-[#2a1b12] border border-orange-200 dark:border-orange-800/70 font-mono text-xs font-semibold text-orange-950 dark:text-orange-100 hover:bg-orange-100 transition-colors cursor-pointer"
          >
            {allSelected ? t.deselectAll : t.selectAll}
          </button>

          <button
            type="button"
            disabled={selectedIds.length === 0 || zipDownloading}
            onClick={handleDownloadSelected}
            className="min-h-[48px] px-4 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 disabled:opacity-40 text-white font-mono text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            {zipDownloading
              ? `${t.packagingZip}${downloadProgress ? ` (${downloadProgress})` : ''}`
              : selectedIds.length === 1
              ? `${t.downloadSelectedZip} (1)`
              : `${t.downloadSelectedZip} (${selectedIds.length}) .ZIP`}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {data.items.map((slide) => {
          const isSelected = selectedIds.includes(slide.id);
          const cleanHandle = data.creatorHandle.replace(/[^a-zA-Z0-9_-]/g, '');
          const ext = slide.mediaType === 'video' ? 'mp4' : 'jpg';
          const slideFilename = `VIDNEX_${cleanHandle}_slide_${slide.index}.${ext}`;

          return (
            <div
              key={slide.id}
              className={`relative aspect-[4/5] rounded-2xl overflow-hidden border-2 transition-all group ${
                isSelected
                  ? 'border-orange-500 shadow-orange-sm'
                  : 'border-orange-200/50 dark:border-orange-950/50 opacity-65 hover:opacity-100'
              }`}
            >
              <button
                type="button"
                onClick={() => handleToggleSlide(slide.id)}
                aria-pressed={isSelected}
                className="w-full h-full block text-left cursor-pointer"
              >
                <img
                  src={resolveApiUrl(slide.thumbnailUrl)}
                  alt={`${data.creatorHandle} — #${slide.index} (${slide.mediaType})`}
                  width={360}
                  height={450}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (img.src !== STUDIO_FALLBACK_THUMB) {
                      img.src = STUDIO_FALLBACK_THUMB;
                    }
                  }}
                  className="w-full h-full object-cover"
                />
                <span
                  className={`absolute top-2 left-2 w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold transition-colors ${
                    isSelected
                      ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-sm'
                      : 'bg-black/50 text-transparent border border-white/50'
                  }`}
                >
                  ✓
                </span>
                {slide.fileSize && (
                  <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/75 text-white font-mono text-[10px]">
                    {slide.fileSize}
                  </span>
                )}
              </button>

              <button
                type="button"
                title={`Download Slide #${slide.index}`}
                aria-label={`Download Slide ${slide.index}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setHasTriggeredDownload(true);
                  triggerNativeBackendDownload(slideFilename, slide.downloadUrl);
                }}
                className="absolute bottom-2 right-2 w-9 h-9 rounded-xl bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center shadow-md transition-transform active:scale-95 cursor-pointer"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  className="w-4 h-4"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {data.audioTrack && (
        <div className="pt-1 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setHasTriggeredDownload(true);
              const cleanHandle = data.creatorHandle.replace(
                /[^a-zA-Z0-9_-]/g,
                ''
              );
              const cleanVideoId = (data.id || 'video')
                .replace(/^car-|^vid-/, '')
                .replace(/[^a-zA-Z0-9_-]/g, '');
              const ext = data.audioTrack?.ext === 'mp3' ? 'mp3' : 'm4a';
              const audioFilename =
                data.platform === 'tiktok'
                  ? `tiktok_${cleanVideoId}.${ext}`
                  : `VIDNEX_${cleanHandle}_audio.${ext}`;
              triggerNativeBackendDownload(
                audioFilename,
                data.audioTrack?.downloadUrl
              );
            }}
            className="w-full sm:w-auto min-h-[48px] px-4 py-2 rounded-xl bg-orange-50/90 dark:bg-[#2a1b12] border border-orange-200 dark:border-orange-800/70 hover:bg-orange-100 text-xs font-mono font-bold text-orange-950 dark:text-orange-100 transition-colors cursor-pointer"
          >
            {t.extractAudioMp3} ({data.audioTrack.ext === 'mp3' ? 'MP3' : 'M4A'}
            {data.audioTrack.fileSize ? ` · ${data.audioTrack.fileSize}` : ''})
          </button>
        </div>
      )}

      {hasTriggeredDownload && t.iosFilesHint && (
        <p
          data-testid="ios-files-hint"
          className="px-3.5 py-2.5 rounded-xl bg-orange-50/90 dark:bg-[#231710] border border-orange-200/80 dark:border-orange-900/50 text-xs text-[#6c4e40] dark:text-orange-200/85 leading-relaxed"
        >
          {t.iosFilesHint}
        </p>
      )}
    </div>
  );
};