import React, { useState, useEffect } from 'react';
import {
  MediaResult,
  VideoMediaResult,
  ProfileDpMediaResult,
  CarouselMediaResult,
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

async function triggerSyntheticDownload(
  filename: string,
  metadataSummary: string,
  sourceUrl?: string
) {
  try {
    if (
      sourceUrl &&
      (sourceUrl.startsWith('http://') ||
        sourceUrl.startsWith('https://') ||
        sourceUrl.startsWith('blob:') ||
        sourceUrl.startsWith('data:'))
    ) {
      const res = await fetch(sourceUrl, { mode: 'cors' });
      if (res.ok) {
        const b = await res.blob();
        const u = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href = u;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(u), 2000);
        return;
      }
    }
  } catch {}

  let mimeType = 'text/plain;charset=utf-8';
  let data: BlobPart = `VIDNEX MEDIA ARCHIVE (${new Date().toISOString()})\nFile: ${filename}\nDetails: ${metadataSummary}\n`;

  if (filename.endsWith('.mp4')) {
    mimeType = 'video/mp4';
    data = new Uint8Array([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
      0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
    ]);
  } else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
    mimeType = 'image/jpeg';
    data = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    ]);
  } else if (filename.endsWith('.mp3')) {
    mimeType = 'audio/mpeg';
    data = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  } else if (filename.endsWith('.zip')) {
    mimeType = 'application/zip';
    data = new Uint8Array([
      0x50, 0x4b, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
  }

  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
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
    <section aria-live="polite" className="w-full pb-10">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* 1. CALM SKELETON LOADER */}
        {isLoading && (
          <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 shadow-xs animate-pulse">
            <div className="flex flex-col sm:flex-row gap-5">
              <div className="w-full sm:w-40 aspect-[4/5] rounded-xl bg-slate-100 dark:bg-zinc-800" />
              <div className="flex-1 flex flex-col justify-between gap-4 py-1">
                <div className="space-y-2.5">
                  <div className="h-4 w-28 rounded-md bg-slate-100 dark:bg-zinc-800" />
                  <div className="h-4 w-full rounded-md bg-slate-100 dark:bg-zinc-800" />
                  <div className="h-4 w-2/3 rounded-md bg-slate-100 dark:bg-zinc-800" />
                </div>
                <div className="space-y-2">
                  <div className="h-11 w-full rounded-xl bg-slate-100 dark:bg-zinc-800" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-10 rounded-xl bg-slate-100 dark:bg-zinc-800" />
                    <div className="h-10 rounded-xl bg-slate-100 dark:bg-zinc-800" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. CLEAN ERROR CARD */}
        {!isLoading && error && (
          <div
            role="alert"
            className="rounded-2xl bg-white dark:bg-zinc-900 border border-red-500/40 p-5 shadow-xs text-center sm:text-start flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <p className="text-sm text-[#1f130b] dark:text-[#fffaf5]">
              {error}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="px-4 py-2 rounded-xl bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#09090B] text-xs font-medium"
                >
                  {t.retryExtraction}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-medium text-[#6c4e40] dark:text-orange-200/70 hover:text-[#0F172A] dark:hover:text-[#FAFAFA]"
              >
                {t.dismiss}
              </button>
            </div>
          </div>
        )}

        {/* 3. ACTIVE RESULT CARD */}
        {!isLoading && !error && result && (
          <div className="relative rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 shadow-xs">
            <button
              type="button"
              onClick={onClose}
              aria-label={t.clearResult}
              className="absolute top-4 end-4 w-7 h-7 rounded-full flex items-center justify-center bg-slate-100 dark:bg-zinc-800 text-[#6c4e40] dark:text-orange-200/70 hover:text-[#0F172A] dark:hover:text-[#FAFAFA] transition-colors z-10"
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

  const primaryFormat =
    data.formats.find((f) => f.isPrimary) || data.formats[0];
  const secondaryFormats = data.formats.filter(
    (f) => f.id !== primaryFormat.id
  );

  const handleDownloadClick = (
    formatId: string,
    quality: string,
    container: string,
    fileSize: string
  ) => {
    setActiveDownloadId(formatId);
    const cleanHandle = data.creatorHandle.replace(/[^a-zA-Z0-9_-]/g, '');
    const ext = container.toLowerCase();
    const filename = `VIDNEX_${data.platform}_${cleanHandle}_${quality}.${ext}`;

    triggerSyntheticDownload(filename, `${data.title} (${quality} • ${fileSize})`, data.thumbnailUrl);

    setTimeout(() => {
      setActiveDownloadId(null);
    }, 1000);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-stretch">
      {/* Left: Clean Rounded-xl Thumbnail */}
      <div className="relative w-full sm:w-44 aspect-[4/5] rounded-xl overflow-hidden bg-slate-950 shrink-0">
        <img
          src={data.thumbnailUrl}
          alt={data.title}
          className="w-full h-full object-cover"
        />
        <span
          dir="ltr"
          className="absolute bottom-2 end-2 px-2 py-0.5 rounded-md bg-black/75 text-white font-mono text-[11px] font-medium"
        >
          {data.duration}
        </span>
      </div>

      {/* Right: @handle, 2-Line Caption, and 3 Clean Action Buttons */}
      <div className="flex-1 flex flex-col justify-between w-full gap-4">
        <div className="pe-6">
          <div className="flex items-center gap-1.5">
            <span
              dir="ltr"
              className="text-sm font-semibold text-[#1f130b] dark:text-[#fffaf5]"
            >
              {data.creatorHandle}
            </span>
            <span className="text-xs text-slate-400 dark:text-zinc-500">
              • {data.creatorName}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-[#6c4e40] dark:text-orange-200/70 line-clamp-2 leading-relaxed">
            {data.title}
          </p>
        </div>

        <div className="space-y-2">
          {/* Primary Button: Download HD 1080p */}
          <button
            type="button"
            onClick={() =>
              handleDownloadClick(
                primaryFormat.id,
                primaryFormat.quality,
                primaryFormat.container,
                primaryFormat.fileSize
              )
            }
            className="w-full min-h-[46px] px-4 rounded-xl flex items-center justify-between bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white shadow-md shadow-orange-500/25 text-sm font-medium transition-colors"
          >
            <span>
              {activeDownloadId === primaryFormat.id
                ? t.startingStream
                : t.downloadHd1080}
            </span>
            <span dir="ltr" className="font-mono text-xs opacity-75">
              {primaryFormat.fileSize}
            </span>
          </button>

          {/* Compact Secondary Buttons: 720p + Audio MP3 */}
          <div className="grid grid-cols-2 gap-2">
            {secondaryFormats.map((fmt) => (
              <button
                key={fmt.id}
                type="button"
                onClick={() =>
                  handleDownloadClick(
                    fmt.id,
                    fmt.quality,
                    fmt.container,
                    fmt.fileSize
                  )
                }
                className="min-h-[42px] px-3.5 rounded-xl flex items-center justify-between bg-slate-100 hover:bg-slate-200/70 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-medium text-[#1f130b] dark:text-[#fffaf5] transition-colors"
              >
                <span>
                  {activeDownloadId === fmt.id
                    ? t.saving
                    : fmt.quality === '720p'
                    ? '720p'
                    : 'Audio MP3'}
                </span>
                <span
                  dir="ltr"
                  className="font-mono text-[11px] text-[#6c4e40] dark:text-orange-200/70"
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
    triggerSyntheticDownload(`VIDNEX_${cleanHandle}_HD_DP.jpg`, `Full-Size HD Profile Photo (${data.dimensions})`, data.hdOriginalUrl);
    setTimeout(() => setDownloading(false), 1000);
  };

  return (
    <div className="flex flex-col items-center text-center space-y-4 pt-1">
      <div>
        <h3
          dir="ltr"
          className="text-base font-semibold text-[#1f130b] dark:text-[#fffaf5]"
        >
          {data.creatorHandle}
        </h3>
        <p className="text-xs text-[#6c4e40] dark:text-orange-200/70 mt-0.5">
          {data.creatorName}
        </p>
      </div>

      {/* Centered Clean Square Preview with Click-to-Zoom */}
      <div
        onClick={() => setIsZoomed((prev) => !prev)}
        className={`relative rounded-xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-zinc-800 transition-all duration-200 ${
          isZoomed ? 'w-full max-w-md cursor-zoom-out' : 'w-56 h-56 cursor-zoom-in'
        }`}
      >
        <img
          src={data.hdOriginalUrl}
          alt={data.creatorHandle}
          className="w-full h-full object-cover"
        />
        <span className="absolute bottom-2 end-2 px-2.5 py-1 rounded-lg bg-black/75 text-white text-[11px] font-medium">
          {isZoomed ? '1:1' : 'Zoom HD'}
        </span>
      </div>

      {/* Single Primary Download Button */}
      <button
        type="button"
        onClick={handleDownloadDp}
        className="w-full sm:w-auto min-w-[260px] min-h-[46px] px-6 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white shadow-md shadow-orange-500/25 text-sm font-medium transition-colors"
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
    triggerSyntheticDownload(
      `VIDNEX_${cleanHandle}_${selectedIds.length}_ITEMS.zip`,
      `${selectedIds.length} slides from ${data.sourceUrl}`
    );
    setTimeout(() => setZipDownloading(false), 1000);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pe-8">
        <span
          dir="ltr"
          className="text-sm font-semibold text-[#1f130b] dark:text-[#fffaf5]"
        >
          {data.creatorHandle}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleSelectAll}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-medium text-[#1f130b] dark:text-[#fffaf5]"
          >
            {allSelected ? t.deselectAll : t.selectAll}
          </button>

          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={handleDownloadZip}
            className="px-4 py-1.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 disabled:opacity-40 text-white dark:bg-[#FAFAFA] dark:text-[#09090B] text-xs font-medium transition-colors"
          >
            {zipDownloading
              ? t.packagingZip
              : `${t.downloadSelectedZip} (${selectedIds.length}) .ZIP`}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {data.items.map((slide) => {
          const isSelected = selectedIds.includes(slide.id);
          return (
            <div
              key={slide.id}
              onClick={() => handleToggleSlide(slide.id)}
              className={`relative aspect-[4/5] rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                isSelected
                  ? 'border-[#0F172A] dark:border-[#FAFAFA]'
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img
                src={slide.thumbnailUrl}
                alt={`Slide ${slide.index}`}
                className="w-full h-full object-cover"
              />
              <span
                className={`absolute top-2 start-2 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-medium ${
                  isSelected
                    ? 'bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#09090B]'
                    : 'bg-black/50 text-transparent border border-white/50'
                }`}
              >
                ✓
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};