import React, { useState, useEffect } from 'react';
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

interface ResultDrawerProps {
  isLoading: boolean;
  error: string | null;
  result: MediaResult | null;
  onClose: () => void;
  onRetry?: () => void;
  language: LanguageCode;
}

/**
 * Triggers a native browser file download using the backend `/api/download` stream endpoint.
 * Zero fake/corrupt blobs (`mp4Box`, `wavHeader`, or canvas mocks) are ever created.
 */
function triggerNativeBackendDownload(filename: string, rawDownloadUrl?: string) {
  let targetUrl: string;

  if (
    rawDownloadUrl &&
    (rawDownloadUrl.includes('/api/download') ||
      rawDownloadUrl.startsWith('http://') ||
      rawDownloadUrl.startsWith('https://'))
  ) {
    targetUrl = rawDownloadUrl.includes('/api/download')
      ? resolveApiUrl(rawDownloadUrl)
      : resolveApiUrl(
          `/api/download?${new URLSearchParams({
            url: rawDownloadUrl,
            filename,
          }).toString()}`
        );
  } else {
    targetUrl = resolveApiUrl(
      `/api/download?${new URLSearchParams({
        url: `synthetic://media/${filename}`,
        filename,
      }).toString()}`
    );
  }

  const anchor = document.createElement('a');
  anchor.href = targetUrl;
  anchor.download = filename;
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
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

  if (!isLoading && !error && !result) {
    return null;
  }

  return (
    <section aria-live="polite" className="w-full py-8">
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
            className="rounded-3xl bg-white/95 dark:bg-[#1c140e]/95 backdrop-blur-xl border-2 border-red-300 dark:border-red-900/70 p-6 shadow-orange-glow flex flex-col sm:flex-row items-center justify-between gap-5"
          >
            <div className="flex items-start gap-4 text-center sm:text-left">
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
              <div>
                <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                  {t.extractionInterrupted}
                </div>
                <p className="mt-1 text-sm font-medium text-[#1f130b] dark:text-[#fffaf5]">
                  {error}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-mono text-xs font-bold shadow-sm transition-all"
                >
                  {t.retryExtraction}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-orange-50 dark:bg-[#2a1b12] border border-orange-200 dark:border-orange-800/70 font-mono text-xs font-semibold text-orange-950 dark:text-orange-100 hover:bg-orange-100 transition-colors"
              >
                {t.dismiss}
              </button>
            </div>
          </div>
        )}

        {/* 3. ACTIVE RESULT CARD */}
        {!isLoading && !error && result && (
          <div className="relative rounded-3xl bg-white/95 dark:bg-[#1c140e]/95 backdrop-blur-xl border-2 border-orange-200/80 dark:border-orange-900/60 p-6 shadow-orange-glow overflow-hidden">
            <div className="absolute -right-16 -top-16 w-48 h-48 bg-orange-400/10 rounded-full blur-2xl pointer-events-none" />
            <button
              type="button"
              onClick={onClose}
              aria-label={t.clearResult}
              className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center bg-orange-50 dark:bg-[#2a1b12] border border-orange-200/80 dark:border-orange-800/70 text-orange-900 dark:text-orange-200 hover:bg-orange-500 hover:text-white transition-colors z-10 font-mono text-sm font-bold"
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
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  useEffect(() => {
    setIsPlayingPreview(false);
  }, [data.id]);

  const primaryFormat =
    data.formats.find((f) => f.isPrimary) || data.formats[0];
  const secondaryFormats = data.formats.filter(
    (f) => f.id !== primaryFormat.id
  );

  const previewVideoSrc = primaryFormat?.downloadUrl
    ? resolveApiUrl(primaryFormat.downloadUrl)
    : '/samples/sample-1080p.mp4';

  const handleDownloadClick = (
    formatId: string,
    quality: string,
    container: string,
    downloadUrl?: string
  ) => {
    setActiveDownloadId(formatId);
    const cleanHandle = data.creatorHandle.replace(/[^a-zA-Z0-9_-]/g, '');
    const ext = container.toLowerCase();
    const filename = `VIDNEX_${data.platform}_${cleanHandle}_${quality}.${ext}`;

    triggerNativeBackendDownload(filename, downloadUrl);

    setTimeout(() => {
      setActiveDownloadId(null);
    }, 1000);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-stretch relative z-10">
      {/* Left: Warm Framed Media Preview Card with Click-to-Play Inline Video */}
      <div className="relative w-full sm:w-52 aspect-[4/5] rounded-2xl overflow-hidden bg-[#1f130b] shrink-0 shadow-md border-2 border-orange-300 dark:border-orange-800/80 group">
        {isPlayingPreview ? (
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
            onClick={() => setIsPlayingPreview(true)}
            aria-label="Play video preview"
            className="w-full h-full relative block text-left cursor-pointer"
          >
            <img
              src={resolveApiUrl(data.thumbnailUrl)}
              alt={data.title}
              referrerPolicy="no-referrer"
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.src.endsWith('/samples/sample-dp-1080.jpg')) {
                  img.src = '/samples/sample-dp-1080.jpg';
                }
              }}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <span
              dir="ltr"
              className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-md bg-stone-900/85 backdrop-blur-md text-white font-mono text-[11px] font-semibold"
            >
              {data.duration} • {data.resolution}
            </span>
          </button>
        )}
        <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-gradient-to-r from-orange-600 to-amber-500 text-white font-mono text-[10px] uppercase font-bold shadow-sm pointer-events-none">
          {t.noWatermarkBadge}
        </span>
      </div>

      {/* Right: Metadata & Format Transports */}
      <div className="flex-1 flex flex-col justify-between w-full gap-4 min-w-0">
        <div className="pr-8">
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
            <span>·</span>
            <span>{data.creatorName}</span>
          </div>

          <h3 className="mt-1.5 font-display text-base sm:text-lg font-bold text-[#1f130b] dark:text-[#fffaf5] line-clamp-2 leading-snug">
            {data.title}
          </h3>

          <p className="mt-1 font-mono text-xs text-[#6c4e40] dark:text-orange-200/70 font-medium">
            {data.resolution} · {data.codec} · {primaryFormat.fileSize}
          </p>
        </div>

        <div className="space-y-2.5">
          {/* Primary Button: Download HD 1080p */}
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
            className="w-full min-h-[48px] px-5 rounded-xl flex items-center justify-between bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 hover:from-orange-700 hover:to-amber-600 text-white shadow-[0_4px_16px_rgba(234,88,12,0.35)] hover:shadow-[0_6px_22px_rgba(234,88,12,0.5)] text-sm font-bold transition-all active:scale-[0.99]"
          >
            <span className="flex items-center gap-2">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-4 h-4"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>
                {activeDownloadId === primaryFormat.id
                  ? t.startingStream
                  : t.downloadHd1080}
              </span>
            </span>
            <span dir="ltr" className="font-mono text-xs opacity-90">
              {primaryFormat.fileSize}
            </span>
          </button>

          {/* Compact Secondary Buttons: 720p + Audio MP3 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                className="min-h-[44px] px-4 rounded-xl flex items-center justify-between bg-orange-50/80 dark:bg-[#2a1b12] border border-orange-200 dark:border-orange-800/70 hover:bg-orange-100 dark:hover:bg-orange-950 hover:border-orange-400 text-xs font-bold text-orange-950 dark:text-orange-100 transition-all shadow-sm"
              >
                <span>
                  {activeDownloadId === fmt.id
                    ? t.saving
                    : fmt.quality === '720p'
                    ? t.downloadSd720
                    : t.extractAudioMp3}
                </span>
                <span
                  dir="ltr"
                  className="font-mono text-[11px] text-orange-700 dark:text-amber-400"
                >
                  {fmt.fileSize}
                </span>
              </button>
            ))}
          </div>
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

  const handleDownloadDp = () => {
    setDownloading(true);
    const cleanHandle = data.creatorHandle.replace(/[^a-zA-Z0-9_-]/g, '');
    triggerNativeBackendDownload(
      `VIDNEX_${cleanHandle}_HD_DP.jpg`,
      data.hdOriginalUrl
    );
    setTimeout(() => setDownloading(false), 1000);
  };

  return (
    <div className="flex flex-col items-center text-center space-y-4 pt-1 relative z-10">
      <div>
        <h3
          dir="ltr"
          className="font-display text-lg font-bold text-[#1f130b] dark:text-[#fffaf5]"
        >
          {data.creatorHandle}
        </h3>
        <p className="text-xs text-[#6c4e40] dark:text-orange-200/75 mt-0.5">
          {data.creatorName} · {data.followersCount} {t.followers}
        </p>
      </div>

      {/* Centered Clean Square Preview with Click-to-Zoom */}
      <div
        onClick={() => setIsZoomed((prev) => !prev)}
        className={`relative rounded-2xl overflow-hidden bg-[#1f130b] border-2 border-orange-300 dark:border-orange-800/80 shadow-md transition-all duration-200 ${
          isZoomed
            ? 'w-full max-w-md cursor-zoom-out'
            : 'w-56 h-56 cursor-zoom-in'
        }`}
      >
        <img
          src={resolveApiUrl(data.standardPreviewUrl || data.hdOriginalUrl)}
          alt={data.creatorHandle}
          referrerPolicy="no-referrer"
          onError={(e) => {
            const img = e.currentTarget;
            if (!img.src.endsWith('/samples/sample-dp-1080.jpg')) {
              img.src = '/samples/sample-dp-1080.jpg';
            }
          }}
          className="w-full h-full object-cover"
        />
        <span className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-stone-900/85 text-white font-mono text-[11px] font-semibold">
          {isZoomed ? t.standard1to1 : t.zoom100Hd}
        </span>
      </div>

      {/* Single Primary Download Button */}
      <button
        type="button"
        onClick={handleDownloadDp}
        className="w-full sm:w-auto min-w-[260px] min-h-[48px] px-7 rounded-xl bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 hover:from-orange-700 hover:to-amber-600 text-white shadow-[0_4px_16px_rgba(234,88,12,0.35)] text-sm font-bold transition-all"
      >
        {downloading ? t.fetchingOriginalJpg : t.downloadFullSizePhoto}
      </button>
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

  useEffect(() => {
    setSelectedIds(data.items.map((item) => item.id));
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

  const handleDownloadZip = () => {
    if (selectedIds.length === 0) return;
    setZipDownloading(true);
    const cleanHandle = data.creatorHandle.replace(/[^a-zA-Z0-9_-]/g, '');

    // If a single slide is selected, download that slide's direct backend downloadUrl;
    // otherwise download the multi-slide .ZIP archive
    if (selectedIds.length === 1) {
      const slide = data.items.find((i) => i.id === selectedIds[0]);
      if (slide) {
        const ext = slide.mediaType === 'video' ? 'mp4' : 'jpg';
        triggerNativeBackendDownload(
          `VIDNEX_${cleanHandle}_slide_${slide.index}.${ext}`,
          slide.downloadUrl
        );
        setTimeout(() => setZipDownloading(false), 1000);
        return;
      }
    }

    triggerNativeBackendDownload(
      `VIDNEX_${cleanHandle}_${selectedIds.length}_ITEMS.zip`,
      `/api/download?url=synthetic://carousel/archive.zip&filename=VIDNEX_${cleanHandle}_${selectedIds.length}_ITEMS.zip`
    );
    setTimeout(() => setZipDownloading(false), 1000);
  };

  return (
    <div className="space-y-4 relative z-10">
      <div className="flex flex-wrap items-center justify-between gap-3 pr-10">
        <div>
          <span
            dir="ltr"
            className="font-display text-base font-bold text-[#1f130b] dark:text-[#fffaf5]"
          >
            {data.creatorHandle}
          </span>
          <span className="ml-2 font-mono text-xs text-orange-700 dark:text-amber-400 font-semibold">
            · {data.totalItems} {t.slidesDetected} ({data.archiveSize})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleSelectAll}
            className="px-3.5 py-2 rounded-xl bg-orange-50 dark:bg-[#2a1b12] border border-orange-200 dark:border-orange-800/70 font-mono text-xs font-semibold text-orange-950 dark:text-orange-100 hover:bg-orange-100 transition-colors"
          >
            {allSelected ? t.deselectAll : t.selectAll}
          </button>

          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={handleDownloadZip}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 disabled:opacity-40 text-white font-mono text-xs font-bold shadow-sm transition-all"
          >
            {zipDownloading
              ? t.packagingZip
              : `${t.downloadSelectedZip} (${selectedIds.length}) .ZIP`}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {data.items.map((slide) => {
          const isSelected = selectedIds.includes(slide.id);
          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => handleToggleSlide(slide.id)}
              aria-pressed={isSelected}
              className={`relative aspect-[4/5] rounded-2xl overflow-hidden cursor-pointer border-2 transition-all text-left ${
                isSelected
                  ? 'border-orange-500 shadow-orange-sm'
                  : 'border-orange-200/50 dark:border-orange-950/50 opacity-60 hover:opacity-100'
              }`}
            >
              <img
                src={resolveApiUrl(slide.thumbnailUrl)}
                alt={`Slide ${slide.index}`}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (!img.src.endsWith('/samples/sample-dp-1080.jpg')) {
                    img.src = '/samples/sample-dp-1080.jpg';
                  }
                }}
                className="w-full h-full object-cover"
              />
              <span
                className={`absolute top-2 left-2 w-6 h-6 rounded-lg flex items-center justify-center font-mono text-xs font-bold transition-colors ${
                  isSelected
                    ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-sm'
                    : 'bg-black/50 text-transparent border border-white/50'
                }`}
              >
                ✓
              </span>
              <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/75 text-white font-mono text-[10px]">
                {slide.fileSize}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};