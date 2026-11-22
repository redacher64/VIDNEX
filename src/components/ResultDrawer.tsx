import React, { useState, useEffect, useRef } from 'react';
import {
  MediaResult,
  VideoMediaResult,
  ProfileDpMediaResult,
  CarouselMediaResult,
  fetchAccountStories,
  resolveApiUrl,
  shouldShowRetryButton,
} from '../services/extractorService';
export { shouldShowRetryButton };
import {
  LanguageCode,
  UI_TRANSLATIONS,
  UiDictionary,
} from '../i18n/translations';
import {
  buildUncompressedZipArchive,
  MAX_SELECTION_ITEMS,
  MAX_SELECTION_TOTAL_BYTES,
  STORY_MAX_SELECTION_ITEMS,
  STORY_MAX_SELECTION_TOTAL_BYTES,
  parseEstimatedSizeBytes,
  validateSelectionLimits,
} from '../utils/zipArchive';
import type { CarouselSlideItem } from '../services/extractorService';
import { AdSlot } from './AdSlot';

export function getInitialSelectedSlideIds(
  items: CarouselSlideItem[],
  maxItems: number = MAX_SELECTION_ITEMS
): string[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const hasExplicitPartialSelection =
    items.some((it) => it.selected === true) &&
    items.some((it) => it.selected === false);
  if (hasExplicitPartialSelection) {
    return items
      .filter((it) => it.selected === true)
      .slice(0, maxItems)
      .map((it) => it.id);
  }
  return items.slice(0, maxItems).map((it) => it.id);
}

export function formatSlideDateTime(
  isoDate: string | undefined,
  language: LanguageCode
): string | null {
  if (!isoDate) return null;
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(language, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed);
  } catch {
    return parsed.toISOString().slice(0, 16).replace('T', ' ');
  }
}

interface ResultDrawerProps {
  isLoading: boolean;
  error: string | null;
  errorCode?: string | null;
  result: MediaResult | null;
  onClose: () => void;
  onRetry?: () => void;
  language: LanguageCode;
  platform?: string | null;
}

function detectClientImageMagicBytes(
  bytes: Uint8Array
): 'jpg' | 'png' | 'webp' | 'gif' | null {
  if (!bytes || bytes.length < 4) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png';
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return 'gif';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

const LinkedInManualUploadBox: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<{
    objectUrl: string;
    file: File;
    ext: 'jpg' | 'png' | 'webp' | 'gif';
    width: number;
    height: number;
    isThumbnail: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (uploadedImage?.objectUrl) {
        URL.revokeObjectURL(uploadedImage.objectUrl);
      }
    };
  }, [uploadedImage?.objectUrl]);

  const handleValidateAndPreviewFile = async (file: File) => {
    setUploadError(null);
    if (!file) return;

    if (!file.type || !file.type.toLowerCase().startsWith('image/')) {
      setUploadError(
        'Le fichier sélectionné n’est pas une image valide (type MIME image/* requis).'
      );
      return;
    }

    if (file.size < 16 || file.size > 10 * 1024 * 1024) {
      setUploadError(
        'Taille de fichier invalide (l’image doit être comprise entre 16 octets et 10 Mo).'
      );
      return;
    }

    try {
      const headerSlice = await file.slice(0, 32).arrayBuffer();
      const magicExt = detectClientImageMagicBytes(new Uint8Array(headerSlice));
      if (!magicExt) {
        setUploadError(
          'Signature binaire (magic bytes) invalide : seuls les formats JPEG, PNG, WebP et GIF réels sont acceptés.'
        );
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      const dims = await new Promise<{ width: number; height: number }>(
        (resolve, reject) => {
          const img = new Image();
          img.onload = () =>
            resolve({
              width: img.naturalWidth || 0,
              height: img.naturalHeight || 0,
            });
          img.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
          img.src = objectUrl;
        }
      );

      if (uploadedImage?.objectUrl) {
        URL.revokeObjectURL(uploadedImage.objectUrl);
      }

      const isThumbnail =
        dims.width <= 450 || dims.height <= 450 || file.size < 45_000;

      setUploadedImage({
        objectUrl,
        file,
        ext: magicExt,
        width: dims.width,
        height: dims.height,
        isThumbnail,
      });
    } catch {
      setUploadError(
        'Impossible de décoder cette image. Vérifiez que le fichier n’est pas corrompu.'
      );
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      void handleValidateAndPreviewFile(file);
    }
  };

  return (
    <div
      data-testid="linkedin-manual-upload"
      className="mt-4 rounded-2xl bg-orange-50/80 dark:bg-[#221710] border-2 border-dashed border-orange-300 dark:border-orange-800/80 p-4 sm:p-5 text-start"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h4 className="font-display text-sm sm:text-base font-bold text-[#1f130b] dark:text-[#fffaf5]">
            Import manuel d’une photo LinkedIn (glisser-déposer ou fichier)
          </h4>
        </div>
        <button
          type="button"
          data-testid="linkedin-manual-upload-btn"
          onClick={() => fileInputRef.current?.click()}
          className="min-h-[42px] px-4 py-2 rounded-xl bg-white dark:bg-[#1c140e] border border-orange-300 dark:border-orange-700 font-mono text-xs font-bold text-orange-950 dark:text-orange-100 hover:bg-orange-100 transition-colors cursor-pointer shrink-0"
        >
          Choisir une image…
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        aria-label="Importer manuellement une photo de profil"
        data-testid="linkedin-manual-upload-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleValidateAndPreviewFile(f);
        }}
        className="sr-only"
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`rounded-xl p-4 text-center transition-colors cursor-pointer border ${
          isDragging
            ? 'bg-orange-100/90 dark:bg-orange-950/50 border-orange-500'
            : 'bg-white/80 dark:bg-[#18110c] border-orange-200/80 dark:border-orange-900/50 hover:border-orange-400'
        }`}
      >
        <p className="text-xs sm:text-sm font-medium text-[#4a3429] dark:text-orange-100/90">
          Glissez et déposez une image ici ou cliquez pour sélectionner un fichier (JPEG, PNG, WebP, GIF · max 10 Mo)
        </p>
      </div>

      {uploadError && (
        <p
          role="alert"
          data-testid="linkedin-manual-upload-error"
          className="mt-2.5 text-xs font-semibold text-red-600 dark:text-red-400"
        >
          {uploadError}
        </p>
      )}

      {uploadedImage && (
        <div
          data-testid="linkedin-manual-upload-preview"
          className="mt-4 flex flex-col sm:flex-row items-center gap-4 p-3.5 rounded-xl bg-white dark:bg-[#1c140e] border border-orange-200 dark:border-orange-800/70"
        >
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-[#1f130b] border border-orange-300 dark:border-orange-800 shrink-0">
            <img
              src={uploadedImage.objectUrl}
              alt="Aperçu de l’image importée"
              width={uploadedImage.width || 112}
              height={uploadedImage.height || 112}
              decoding="async"
              className="w-full h-full object-cover"
            />
            <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-stone-900/85 text-white font-mono text-[10px] font-bold">
              {uploadedImage.isThumbnail ? 'Miniature' : 'Standard'} ·{' '}
              {uploadedImage.ext.toUpperCase()}
            </span>
          </div>

          <div className="flex-1 min-w-0 text-center sm:text-start space-y-1">
            <p className="font-mono text-xs font-bold text-[#1f130b] dark:text-[#fffaf5] truncate">
              {uploadedImage.file.name}
            </p>
            <p className="font-mono text-[11px] text-[#6c4e40] dark:text-orange-200/80">
              {uploadedImage.width} × {uploadedImage.height} px ·{' '}
              {Math.max(1, Math.round(uploadedImage.file.size / 1024))} Ko ·{' '}
              {uploadedImage.isThumbnail
                ? 'Version miniature'
                : 'Qualité standard'}
            </p>
            <div className="pt-1.5 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <button
                type="button"
                data-testid="linkedin-manual-download-btn"
                onClick={() =>
                  triggerBlobDownload(
                    uploadedImage.file,
                    `linkedin_profile_import.${uploadedImage.ext}`
                  )
                }
                className="min-h-[40px] px-4 py-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-mono text-xs font-bold shadow-sm cursor-pointer"
              >
                Enregistrer cette image ({uploadedImage.isThumbnail ? 'Miniature' : uploadedImage.ext.toUpperCase()})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const STUDIO_FALLBACK_THUMB =
  "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 720 900'%3E%3Crect width='720' height='900' fill='%231f130b'/%3E%3Ccircle cx='360' cy='420' r='56' fill='%23ea580c' fill-opacity='0.85'/%3E%3Cpolygon points='346,396 346,444 388,420' fill='%23fffaf5'/%3E%3Ctext x='360' y='535' text-anchor='middle' fill='%23fffaf5' font-family='sans-serif' font-size='26' font-weight='700'%3EVIDNEX HD STREAM%3C/text%3E%3C/svg%3E";

function buildDownloadEndpointUrl(
  filename: string,
  rawDownloadUrl?: string,
  fromSelection = false
): string {
  if (!rawDownloadUrl) return '';
  if (rawDownloadUrl.includes('/api/download')) {
    const resolved = resolveApiUrl(rawDownloadUrl);
    if (!fromSelection) return resolved;
    const sep = resolved.includes('?') ? '&' : '?';
    return `${resolved}${sep}sel=1`;
  }
  const params = new URLSearchParams({
    url: rawDownloadUrl,
    filename,
  });
  if (fromSelection) {
    params.set('sel', '1');
  }
  return resolveApiUrl(`/api/download?${params.toString()}`);
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

function triggerNativeBackendDownload(
  filename: string,
  rawDownloadUrl?: string,
  fromSelection = false
) {
  const targetUrl = buildDownloadEndpointUrl(
    filename,
    rawDownloadUrl,
    fromSelection
  );
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
  errorCode,
  result,
  onClose,
  onRetry,
  language,
  platform,
}) => {
  const t = UI_TRANSLATIONS[language].drawer;
  const sectionRef = useRef<HTMLElement>(null);
  const isLinkedInContext =
    platform === 'linkedin' || result?.platform === 'linkedin';
  const showRetryButton =
    Boolean(onRetry) &&
    shouldShowRetryButton(
      isLinkedInContext ? 'linkedin' : platform,
      errorCode
    );

  const [allStoriesResult, setAllStoriesResult] =
    useState<CarouselMediaResult | null>(null);
  const [isLoadingAllStories, setIsLoadingAllStories] = useState(false);
  const [allStoriesError, setAllStoriesError] = useState<string | null>(null);

  useEffect(() => {
    setAllStoriesResult(null);
    setIsLoadingAllStories(false);
    setAllStoriesError(null);
  }, [result?.id]);

  const handleLoadAllStories = async (
    username: string,
    linkedStoryId?: string,
    sourceUrl?: string
  ) => {
    if (!username || isLoadingAllStories) return;
    setIsLoadingAllStories(true);
    setAllStoriesError(null);
    try {
      const storiesCarousel = await fetchAccountStories(username, language, {
        linkedStoryId,
        sourceUrl,
      });
      setAllStoriesResult(storiesCarousel);
    } catch (err) {
      setAllStoriesError(
        err instanceof Error
          ? err.message
          : t.extractionInterrupted
      );
    } finally {
      setIsLoadingAllStories(false);
    }
  };

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
            className="rounded-3xl bg-white/95 dark:bg-[#1c140e]/95 backdrop-blur-xl border-2 border-red-300 dark:border-red-900/70 p-5 sm:p-6 shadow-orange-glow flex flex-col gap-4"
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 sm:gap-5">
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
                {showRetryButton && (
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

            {isLinkedInContext && <LinkedInManualUploadBox />}
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

            {allStoriesResult ? (
              <CarouselResultView
                data={allStoriesResult}
                t={t}
                language={language}
                onBackToSingleStory={() => setAllStoriesResult(null)}
              />
            ) : (
              <>
                {result.payloadType === 'video' && (
                  <VideoResultView
                    data={result}
                    t={t}
                    language={language}
                    onViewAllStories={handleLoadAllStories}
                    isLoadingAllStories={isLoadingAllStories}
                    allStoriesError={allStoriesError}
                  />
                )}
                {result.payloadType === 'profile_dp' && (
                  <ProfileDpResultView data={result} t={t} />
                )}
                {result.payloadType === 'carousel' && (
                  <CarouselResultView data={result} t={t} language={language} />
                )}
              </>
            )}
          </div>
        )}

        {/* Sous la carte de résultat : 300x250 */}
        {!isLoading && !error && result && (
          <AdSlot
            slotId="vidnex-result-rectangle"
            format="rectangle"
            language={language}
          />
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
  language: LanguageCode;
  onViewAllStories?: (
    username: string,
    linkedStoryId?: string,
    sourceUrl?: string
  ) => void;
  isLoadingAllStories?: boolean;
  allStoriesError?: string | null;
}> = ({
  data,
  t,
  language,
  onViewAllStories,
  isLoadingAllStories,
  allStoriesError,
}) => {
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

          {data.storyMeta?.takenAt && (
            <p
              data-testid="single-story-published-at"
              className="mt-1 font-mono text-xs text-orange-800/85 dark:text-amber-300/85"
            >
              {t.storyPublishedAt}{' '}
              {formatSlideDateTime(data.storyMeta.takenAt, language)}
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

          {/* Instagram Story: Bouton "Voir toutes les stories de @username" + note 24 h */}
          {data.storyMeta && (
            <div className="space-y-2.5 pt-1">
              {data.storyMeta.canListAll &&
                data.storyMeta.username &&
                onViewAllStories && (
                  <button
                    type="button"
                    data-testid="view-all-stories-btn"
                    disabled={isLoadingAllStories}
                    onClick={() =>
                      onViewAllStories(
                        data.storyMeta!.username,
                        data.storyMeta!.storyId,
                        data.sourceUrl
                      )
                    }
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 bg-orange-50 dark:bg-[#2a1b12] border-2 border-orange-300 dark:border-orange-700 hover:bg-orange-100 dark:hover:bg-orange-950 text-orange-950 dark:text-orange-100 font-display text-sm font-bold transition-all disabled:opacity-60 cursor-pointer"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                      className={`w-4 h-4 shrink-0 ${isLoadingAllStories ? 'animate-spin' : ''}`}
                    >
                      {isLoadingAllStories ? (
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      ) : (
                        <>
                          <rect x="3" y="3" width="7" height="7" rx="1" />
                          <rect x="14" y="3" width="7" height="7" rx="1" />
                          <rect x="3" y="14" width="7" height="7" rx="1" />
                          <rect x="14" y="14" width="7" height="7" rx="1" />
                        </>
                      )}
                    </svg>
                    <span>
                      {isLoadingAllStories ? (
                        t.loadingAllStories
                      ) : (
                        <>
                          {t.viewAllStoriesBtn.split('@{username}')[0]}
                          <span dir="ltr" className="font-mono">
                            @{data.storyMeta.username}
                          </span>
                          {t.viewAllStoriesBtn.split('@{username}')[1] || ''}
                        </>
                      )}
                    </span>
                  </button>
                )}

              {allStoriesError && (
                <div
                  role="alert"
                  data-testid="all-stories-error"
                  className="px-3.5 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800/80 text-xs sm:text-sm font-medium text-red-800 dark:text-red-200"
                >
                  {allStoriesError}
                </div>
              )}

              <p
                data-testid="stories-24h-notice"
                className="px-3.5 py-2.5 rounded-xl bg-amber-50/90 dark:bg-[#241911] border border-amber-200/80 dark:border-amber-900/50 text-xs text-[#5d4030] dark:text-amber-100/85 leading-relaxed"
              >
                {t.storiesNotice24h}
              </p>
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
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    setPreviewError(false);
    setHasTriggeredDownload(false);
  }, [data.id, data.hdOriginalUrl]);

  const isMiniature =
    data.quality === 'Miniature' || Boolean(data.isThumbnail);
  const qualityBadge = isMiniature
    ? 'Miniature'
    : data.quality === 'Standard'
    ? 'Standard'
    : 'HD';
  const formatUpper = data.format || 'JPG';
  const formatExt = formatUpper.toLowerCase();
  const cleanUsername = data.creatorHandle
    .replace(/^@/, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');

  const handleDownloadDp = () => {
    if (previewError && data.platform === 'linkedin') {
      return;
    }
    setDownloading(true);
    setHasTriggeredDownload(true);
    const filename =
      data.platform === 'instagram'
        ? `instagram_${cleanUsername || 'user'}_profile.${formatExt}`
        : data.platform === 'linkedin'
        ? `linkedin_${cleanUsername || 'user'}_profile.${formatExt}`
        : `VIDNEX_${cleanUsername || 'user'}_HD_DP.${formatExt}`;
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
            if (data.platform === 'linkedin') {
              setPreviewError(true);
              setHasTriggeredDownload(false);
            }
            const img = e.currentTarget;
            if (img.src !== STUDIO_FALLBACK_THUMB) {
              img.src = STUDIO_FALLBACK_THUMB;
            }
          }}
          className="w-full h-full object-cover"
        />
        <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md bg-stone-900/85 text-white font-mono text-[11px] font-bold">
          {qualityBadge} · {formatUpper}
        </span>
      </div>

      {previewError && data.platform === 'linkedin' ? (
        <div className="w-full max-w-xl space-y-3">
          <div
            role="alert"
            data-testid="linkedin-preview-error-banner"
            className="w-full px-4 py-3 rounded-xl bg-red-50/95 dark:bg-red-950/50 border border-red-300 dark:border-red-900/70 text-xs sm:text-sm font-medium text-red-900 dark:text-red-100"
          >
            Le lien de cette photo LinkedIn a expiré ou l’image renvoyée est invalide. Vous pouvez déposer une image manuellement ci-dessous.
          </div>
          <LinkedInManualUploadBox />
        </div>
      ) : (
        <>
          {/* Action Buttons: Full-width on mobile, >= 48px */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleDownloadDp}
              className="w-full sm:w-auto min-w-[240px] min-h-[48px] px-7 rounded-xl bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 hover:from-orange-700 hover:to-amber-600 text-white shadow-[0_4px_16px_rgba(234,88,12,0.35)] text-sm font-bold transition-all cursor-pointer"
            >
              {downloading
                ? t.fetchingOriginalJpg
                : isMiniature
                ? `Télécharger la miniature (${formatUpper})`
                : t.downloadFullSizePhoto}
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
        </>
      )}
    </div>
  );
};

/* ============================================================================
 * MULTI-ITEM PRE-DOWNLOAD SELECTION VIEW (CAROUSEL / STORIES / HIGHLIGHTS / PROFILE)
 * ========================================================================== */
const CarouselResultView: React.FC<{
  data: CarouselMediaResult;
  t: UiDictionary['drawer'];
  language: LanguageCode;
  onBackToSingleStory?: () => void;
}> = ({ data, t, language, onBackToSingleStory }) => {
  const isStoryMode = data.selectionContext === 'story';
  const maxSelectionItems = isStoryMode
    ? STORY_MAX_SELECTION_ITEMS
    : MAX_SELECTION_ITEMS;
  const maxSelectionBytes = isStoryMode
    ? STORY_MAX_SELECTION_TOTAL_BYTES
    : MAX_SELECTION_TOTAL_BYTES;
  const limitMaxItemsMessage = isStoryMode
    ? t.storyLimitMaxItems
    : t.limitMaxItems;
  const limitMaxSizeMessage = isStoryMode
    ? t.storyLimitMaxSize
    : t.limitMaxSize;

  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    getInitialSelectedSlideIds(data.items, maxSelectionItems)
  );
  const [zipDownloading, setZipDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');
  const [limitError, setLimitError] = useState<string | null>(null);
  const [hasTriggeredDownload, setHasTriggeredDownload] = useState(false);

  useEffect(() => {
    setSelectedIds(getInitialSelectedSlideIds(data.items, maxSelectionItems));
    setHasTriggeredDownload(false);
    setLimitError(null);
    setLiveAnnouncement('');
  }, [data.id, data.items, maxSelectionItems]);

  const selectedSlides = data.items.filter((i) => selectedIds.includes(i.id));
  const estimatedBytes = selectedSlides.reduce(
    (sum, s) => sum + parseEstimatedSizeBytes(s.fileSize),
    0
  );
  const validation = validateSelectionLimits(
    selectedSlides.length,
    estimatedBytes,
    { maxItems: maxSelectionItems, maxBytes: maxSelectionBytes }
  );

  const allSelected =
    data.items.length > 0 && selectedIds.length === data.items.length;

  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
      setLimitError(null);
      return;
    }
    const allIds = data.items.map((item) => item.id);
    const totalEst = data.items.reduce(
      (sum, s) => sum + parseEstimatedSizeBytes(s.fileSize),
      0
    );
    const check = validateSelectionLimits(allIds.length, totalEst, {
      maxItems: maxSelectionItems,
      maxBytes: maxSelectionBytes,
    });
    if (!check.valid && check.reason === 'MAX_ITEMS_EXCEEDED') {
      setSelectedIds(allIds.slice(0, maxSelectionItems));
      setLimitError(limitMaxItemsMessage);
      setLiveAnnouncement(limitMaxItemsMessage);
      return;
    }
    if (!check.valid && check.reason === 'MAX_SIZE_EXCEEDED') {
      setSelectedIds(allIds);
      setLimitError(limitMaxSizeMessage);
      setLiveAnnouncement(limitMaxSizeMessage);
      return;
    }
    setLimitError(null);
    setSelectedIds(allIds);
  };

  const handleToggleSlide = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((item) => item !== id);
        const nextSlides = data.items.filter((i) => next.includes(i.id));
        const nextBytes = nextSlides.reduce(
          (sum, s) => sum + parseEstimatedSizeBytes(s.fileSize),
          0
        );
        const check = validateSelectionLimits(next.length, nextBytes, {
          maxItems: maxSelectionItems,
          maxBytes: maxSelectionBytes,
        });
        if (check.valid || check.reason === 'EMPTY_SELECTION') {
          setLimitError(null);
        }
        return next;
      }

      const next = [...prev, id];
      const nextSlides = data.items.filter((i) => next.includes(i.id));
      const nextBytes = nextSlides.reduce(
        (sum, s) => sum + parseEstimatedSizeBytes(s.fileSize),
        0
      );
      const check = validateSelectionLimits(next.length, nextBytes, {
        maxItems: maxSelectionItems,
        maxBytes: maxSelectionBytes,
      });
      if (!check.valid && check.reason === 'MAX_ITEMS_EXCEEDED') {
        setLimitError(limitMaxItemsMessage);
        setLiveAnnouncement(limitMaxItemsMessage);
        return prev;
      }
      if (!check.valid && check.reason === 'MAX_SIZE_EXCEEDED') {
        setLimitError(limitMaxSizeMessage);
        setLiveAnnouncement(limitMaxSizeMessage);
      } else {
        setLimitError(null);
      }
      return next;
    });
  };

  const handleDownloadSelected = async () => {
    if (selectedSlides.length === 0 || zipDownloading) return;

    if (!validation.valid) {
      const msg =
        validation.reason === 'MAX_ITEMS_EXCEEDED'
          ? limitMaxItemsMessage
          : limitMaxSizeMessage;
      setLimitError(msg);
      setLiveAnnouncement(msg);
      return;
    }

    setLimitError(null);
    const cleanHandle = data.creatorHandle.replace(/[^a-zA-Z0-9_-]/g, '');

    // Si 1 élément sélectionné : téléchargement direct uniquement de l'élément choisi
    if (selectedSlides.length === 1) {
      const slide = selectedSlides[0];
      const ext = slide.mediaType === 'video' ? 'mp4' : 'jpg';
      const singleFilename = `VIDNEX_${cleanHandle}_item_${slide.index}.${ext}`;
      setHasTriggeredDownload(true);
      const doneMsg = t.progressDone.replace('{count}', '1');
      setLiveAnnouncement(doneMsg);
      triggerNativeBackendDownload(singleFilename, slide.downloadUrl, true);
      return;
    }

    // Plusieurs éléments sélectionnés = archive ZIP assemblée dans le navigateur avec fflate
    setZipDownloading(true);
    setHasTriggeredDownload(true);

    try {
      const zipEntries: Array<{ name: string; data: Uint8Array }> = [];
      let totalDownloadedBytes = 0;

      for (let i = 0; i < selectedSlides.length; i++) {
        const slide = selectedSlides[i];
        const ext = slide.mediaType === 'video' ? 'mp4' : 'jpg';
        const entryName = `VIDNEX_${cleanHandle}_${String(slide.index).padStart(2, '0')}.${ext}`;
        const stepLabel = `${i + 1}/${selectedSlides.length}`;
        setDownloadProgress(stepLabel);
        setLiveAnnouncement(
          t.progressFetching
            .replace('{current}', String(i + 1))
            .replace('{total}', String(selectedSlides.length))
        );

        const targetUrl = buildDownloadEndpointUrl(
          entryName,
          slide.downloadUrl,
          i === 0
        );
        const resp = await fetch(targetUrl);
        if (resp.ok) {
          const contentLenHeader = Number(
            resp.headers.get('Content-Length') || 0
          );
          if (
            contentLenHeader > 0 &&
            totalDownloadedBytes + contentLenHeader > maxSelectionBytes
          ) {
            setLimitError(limitMaxSizeMessage);
            setLiveAnnouncement(limitMaxSizeMessage);
            return;
          }

          const buf = await resp.arrayBuffer();
          totalDownloadedBytes += buf.byteLength;
          if (totalDownloadedBytes > maxSelectionBytes) {
            setLimitError(limitMaxSizeMessage);
            setLiveAnnouncement(limitMaxSizeMessage);
            return;
          }

          zipEntries.push({
            name: entryName,
            data: new Uint8Array(buf),
          });
        }
      }

      if (zipEntries.length > 0) {
        setLiveAnnouncement(
          t.progressZipping.replace('{count}', String(zipEntries.length))
        );
        const zipBlob = buildUncompressedZipArchive(zipEntries, {
          maxItems: maxSelectionItems,
          maxBytes: maxSelectionBytes,
        });
        triggerBlobDownload(
          zipBlob,
          `VIDNEX_${cleanHandle}_selection_${zipEntries.length}.zip`
        );
        setLiveAnnouncement(
          t.progressDone.replace('{count}', String(zipEntries.length))
        );
      } else {
        selectedSlides.forEach((slide, idx) => {
          const ext = slide.mediaType === 'video' ? 'mp4' : 'jpg';
          setTimeout(() => {
            triggerNativeBackendDownload(
              `VIDNEX_${cleanHandle}_item_${slide.index}.${ext}`,
              slide.downloadUrl,
              idx === 0
            );
          }, idx * 450);
        });
      }
    } catch (err: any) {
      if (err?.message === 'MAX_SIZE_EXCEEDED') {
        setLimitError(limitMaxSizeMessage);
        setLiveAnnouncement(limitMaxSizeMessage);
      } else if (err?.message === 'MAX_ITEMS_EXCEEDED') {
        setLimitError(limitMaxItemsMessage);
        setLiveAnnouncement(limitMaxItemsMessage);
      } else {
        selectedSlides.forEach((slide, idx) => {
          const ext = slide.mediaType === 'video' ? 'mp4' : 'jpg';
          setTimeout(() => {
            triggerNativeBackendDownload(
              `VIDNEX_${cleanHandle}_item_${slide.index}.${ext}`,
              slide.downloadUrl,
              idx === 0
            );
          }, idx * 450);
        });
      }
    } finally {
      setZipDownloading(false);
      setDownloadProgress(null);
    }
  };

  const formattedCounter = t.selectedCount
    .replace('{selected}', String(selectedIds.length))
    .replace('{total}', String(data.items.length));

  const isStoryOrProfileContext =
    data.selectionContext === 'story' ||
    data.selectionContext === 'profile' ||
    data.items.some((it) => Boolean(it.date));

  const hasSinglePreselectedStory =
    data.items.some((it) => it.selected === true) &&
    data.items.some((it) => it.selected === false);

  return (
    <div data-testid="selection-screen" className="space-y-4 relative z-10">
      {/* Live region for screen-reader announcements (ZIP progress & limits) */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="selection-aria-live"
        className="sr-only"
      >
        {liveAnnouncement}
      </div>

      {/* Header & Selection Action Bar */}
      <div className="flex flex-col gap-3 pr-12 rtl:pr-0 rtl:pl-12">
        <div className="flex flex-wrap items-center gap-2">
          <span
            dir="ltr"
            className="font-display text-base sm:text-lg font-bold text-[#1f130b] dark:text-[#fffaf5]"
          >
            {data.creatorHandle}
          </span>
          <span className="font-mono text-xs text-orange-700 dark:text-amber-400 font-semibold">
            · {data.totalItems} {t.slidesDetected}
          </span>
          {isStoryOrProfileContext && (
            <span className="px-2.5 py-0.5 rounded-md bg-orange-100/90 dark:bg-[#2a1b12] border border-orange-200 dark:border-orange-800/70 font-mono text-[11px] font-semibold text-orange-900 dark:text-orange-200">
              {t.activeStoriesSubtitle}
            </span>
          )}
          {onBackToSingleStory && (
            <button
              type="button"
              data-testid="back-to-single-story-btn"
              onClick={onBackToSingleStory}
              className="px-2.5 py-1 rounded-lg bg-orange-50 dark:bg-[#2a1b12] border border-orange-200 dark:border-orange-800/70 font-mono text-[11px] font-semibold text-orange-800 dark:text-orange-200 hover:bg-orange-100 transition-colors cursor-pointer"
            >
              ← {t.backToSingleStory}
            </button>
          )}
        </div>

        {isStoryMode && (
          <p
            data-testid="stories-24h-notice"
            className="px-3.5 py-2.5 rounded-xl bg-amber-50/90 dark:bg-[#241911] border border-amber-200/80 dark:border-amber-900/50 text-xs text-[#5d4030] dark:text-amber-100/85 leading-relaxed"
          >
            {t.storiesNotice24h}
          </p>
        )}

        {/* Action Bar: Select All, Counter, Download Selection */}
        <div
          data-testid="selection-action-bar"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-orange-50/70 dark:bg-[#241811] border border-orange-200/80 dark:border-orange-900/60"
        >
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <button
              type="button"
              data-testid="selection-select-all-btn"
              onClick={handleToggleSelectAll}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#1c140e] border border-orange-300 dark:border-orange-800 font-mono text-xs font-semibold text-orange-950 dark:text-orange-100 hover:bg-orange-100 dark:hover:bg-orange-950/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 transition-colors cursor-pointer"
            >
              {allSelected ? t.deselectAll : t.selectAll}
            </button>

            <span
              data-testid="selection-counter"
              className="font-mono text-xs sm:text-sm font-bold text-[#4a3429] dark:text-orange-200"
            >
              {formattedCounter}
            </span>
          </div>

          <button
            type="button"
            data-testid="selection-download-btn"
            disabled={
              selectedIds.length === 0 || zipDownloading || !validation.valid
            }
            onClick={handleDownloadSelected}
            className="min-h-[48px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 disabled:opacity-45 text-white font-mono text-xs sm:text-sm font-bold shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 transition-all cursor-pointer"
          >
            {zipDownloading
              ? `${t.packagingZip}${downloadProgress ? ` (${downloadProgress})` : ''}`
              : selectedIds.length <= 1
              ? `${t.downloadSelection}${selectedIds.length >= 1 ? ' (1)' : ''}`
              : `${t.downloadSelection} (${selectedIds.length} · .ZIP)`}
          </button>
        </div>
      </div>

      {/* Visible Progress or Limit Alert Banner */}
      {zipDownloading && downloadProgress && (
        <div
          data-testid="selection-progress-banner"
          className="px-4 py-2.5 rounded-xl bg-orange-100/90 dark:bg-orange-950/60 border border-orange-300 dark:border-orange-800 text-xs font-mono font-semibold text-orange-950 dark:text-orange-100 flex items-center justify-between gap-3"
        >
          <span>{liveAnnouncement || t.packagingZip}</span>
          <span dir="ltr" className="font-bold">
            {downloadProgress}
          </span>
        </div>
      )}

      {limitError && (
        <div
          role="alert"
          data-testid="selection-limit-error"
          className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800/80 text-xs sm:text-sm font-medium text-red-800 dark:text-red-200"
        >
          {limitError}
        </div>
      )}

      {/* Responsive Thumbnail Grid: 2 columns on mobile, 3 on tablet, 4 on desktop */}
      <div
        data-testid="selection-grid"
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-3.5"
      >
        {data.items.map((slide) => {
          const isSelected = selectedIds.includes(slide.id);
          const cleanHandle = data.creatorHandle.replace(/[^a-zA-Z0-9_-]/g, '');
          const ext = slide.mediaType === 'video' ? 'mp4' : 'jpg';
          const slideFilename = `VIDNEX_${cleanHandle}_item_${slide.index}.${ext}`;
          const mediaTypeLabel =
            slide.mediaType === 'video' ? t.videoType : t.photoType;
          const qualityLabel =
            slide.isThumbnail ||
            String(slide.quality || '').toLowerCase() === 'miniature'
              ? 'Miniature'
              : slide.quality || '1080p';
          const formattedDate = formatSlideDateTime(slide.date, language);
          const checkboxAriaLabel = t.checkboxAria
            .replace('{index}', String(slide.index))
            .replace('{type}', mediaTypeLabel)
            .replace('{quality}', qualityLabel);

          return (
            <article
              key={slide.id}
              data-testid={`selection-item-${slide.index}`}
              className={`flex flex-col rounded-2xl overflow-hidden border-2 bg-white dark:bg-[#221710] transition-all ${
                isSelected
                  ? 'border-orange-500 shadow-orange-sm'
                  : 'border-orange-200/70 dark:border-orange-900/50 opacity-85 hover:opacity-100'
              }`}
            >
              {/* Fixed-dimension 4:5 Thumbnail Container (Zero CLS) */}
              <div
                onClick={() => handleToggleSlide(slide.id)}
                className="relative w-full aspect-[4/5] bg-[#1f130b] overflow-hidden cursor-pointer group"
              >
                <img
                  src={resolveApiUrl(slide.thumbnailUrl)}
                  alt={`${data.creatorHandle} — #${slide.index} (${mediaTypeLabel} ${qualityLabel})`}
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
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Top-start: Accessible Checkbox + Item Number (#1, #2, ...) */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-2.5 left-2.5 rtl:left-auto rtl:right-2.5 flex items-center gap-1.5 z-10"
                >
                  <label className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-stone-950/80 backdrop-blur-sm border border-white/40 cursor-pointer focus-within:ring-2 focus-within:ring-orange-400">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSlide(slide.id)}
                      aria-label={checkboxAriaLabel}
                      data-testid={`selection-checkbox-${slide.index}`}
                      className="w-4 h-4 accent-orange-600 rounded cursor-pointer"
                    />
                  </label>
                  <span
                    dir="ltr"
                    data-testid={`selection-number-${slide.index}`}
                    className="px-2 py-1 rounded-lg bg-stone-950/80 backdrop-blur-sm text-white font-mono text-xs font-bold"
                  >
                    #{slide.index}
                  </span>
                </div>

                {/* Top-end: Media Type (Photo/Video) & Quality Badge */}
                <span
                  data-testid={`selection-badge-${slide.index}`}
                  className="absolute top-2.5 right-2.5 rtl:right-auto rtl:left-2.5 px-2 py-1 rounded-lg bg-stone-950/80 backdrop-blur-sm text-amber-300 font-mono text-[11px] font-bold"
                >
                  {mediaTypeLabel} · {qualityLabel}
                </span>

                {/* Bottom overlay: Date/Time (for active stories), Linked Story badge, or Dimensions/Size */}
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/85 via-black/45 to-transparent flex flex-col gap-1 pointer-events-none">
                  {slide.label === 'profile_photo' && (
                    <span className="self-start px-2 py-0.5 rounded bg-orange-600/90 text-white font-mono text-[10px] font-bold">
                      {t.profilePhotoBadge}
                    </span>
                  )}
                  {hasSinglePreselectedStory &&
                    slide.selected === true &&
                    slide.label !== 'profile_photo' && (
                      <span
                        data-testid={`selection-preselected-badge-${slide.index}`}
                        className="self-start px-2 py-0.5 rounded bg-orange-600/90 text-white font-mono text-[10px] font-bold"
                      >
                        {t.linkedStoryBadge}
                      </span>
                    )}
                  {formattedDate && (
                    <span
                      data-testid={`selection-date-${slide.index}`}
                      className="text-white/95 font-mono text-[11px] font-medium truncate"
                    >
                      {formattedDate}
                    </span>
                  )}
                  {(slide.dimensions || slide.fileSize) && (
                    <span
                      dir="ltr"
                      className="text-white/80 font-mono text-[10px] truncate"
                    >
                      {[slide.dimensions, slide.fileSize]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </div>
              </div>

              {/* Card Footer: Individual "Télécharger" Button */}
              <div className="p-2 bg-orange-50/50 dark:bg-[#221710] border-t border-orange-200/60 dark:border-orange-900/50 flex flex-col gap-1.5">
                <button
                  type="button"
                  data-testid={`selection-item-download-${slide.index}`}
                  aria-label={`${t.downloadItem} #${slide.index} (${mediaTypeLabel} ${qualityLabel})`}
                  onClick={() => {
                    setHasTriggeredDownload(true);
                    triggerNativeBackendDownload(
                      slideFilename,
                      slide.downloadUrl,
                      true
                    );
                  }}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-mono text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 transition-colors cursor-pointer"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    aria-hidden="true"
                    className="w-3.5 h-3.5 shrink-0"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>{t.downloadItem}</span>
                </button>
              </div>
            </article>
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