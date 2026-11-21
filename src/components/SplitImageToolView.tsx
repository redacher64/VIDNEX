import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  getLocalizedPagePath,
  PLATFORM_PAGE_KEYS,
  type PageKey,
  type SupportedLocale,
} from '../i18n/config.ts';

type SvgIconProps = { className?: string };
const Upload: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
);
const Grid: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
);
const Download: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);
const Archive: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
);
const Sparkles: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
);
const CheckCircle2: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
);
const Sliders: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
);
const ShieldCheck: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
);
const RefreshCw: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
);
const ArrowUpDown: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/></svg>
);
const HelpCircle: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
);
const ChevronDown: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><polyline points="6 9 12 15 18 9"/></svg>
);
const ImageIcon: React.FC<SvgIconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
);
import { getLocaleBundleSync } from '../i18n/localeLoader.ts';
import {
  buildZipArchiveWithJSZip,
  clampGridAxis,
  computeDownscaledDimensions,
  computeSplitGridCells,
  getPresetDimensions,
  getSplitImageContent,
  MAX_SPLIT_IMAGE_DIMENSION,
  type GeneratedSliceItem,
  type GridPresetId,
  type SplitOutputFormat,
} from '../utils/splitImageLogic.ts';
import { AdSlot } from './AdSlot.tsx';

interface SplitImageToolViewProps {
  locale: SupportedLocale;
  onNavigatePage: (page: PageKey) => void;
}

interface SourceCanvasState {
  canvas: HTMLCanvasElement;
  previewUrl: string;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  wasDownscaled: boolean;
  sourceName: string;
}

function createSampleStudioCanvas(): SourceCanvasState {
  const width = 1200;
  const height = 1200;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#c2410c');
    grad.addColorStop(0.5, '#ea580c');
    grad.addColorStop(1, '#fb923c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle geometric studio rings
    ctx.strokeStyle = 'rgba(255, 250, 245, 0.22)';
    ctx.lineWidth = 6;
    for (let r = 140; r <= 520; r += 120) {
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Center badge
    ctx.fillStyle = 'rgba(20, 14, 10, 0.28)';
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 220, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fffaf5';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 88px system-ui, -apple-system, sans-serif';
    ctx.fillText('VIDNEX', width / 2, height / 2 - 28);
    ctx.font = '600 34px ui-monospace, monospace';
    ctx.fillText('1200 × 1200 STUDIO GRID', width / 2, height / 2 + 54);
  }

  return {
    canvas,
    previewUrl: canvas.toDataURL('image/jpeg', 0.92),
    originalWidth: width,
    originalHeight: height,
    width,
    height,
    wasDownscaled: false,
    sourceName: 'vidnex-sample-grid.jpg',
  };
}

function canvasToBlobAndUrl(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve) => {
    const dataUrl = canvas.toDataURL(mimeType, quality);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve({ blob, dataUrl });
          return;
        }
        // Fallback from dataUrl if toBlob returned null
        const parts = dataUrl.split(',');
        const byteString = atob(parts[1] || '');
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        resolve({
          blob: new Blob([ab], { type: mimeType }),
          dataUrl,
        });
      },
      mimeType,
      quality
    );
  });
}

export const SplitImageToolView: React.FC<SplitImageToolViewProps> = ({
  locale,
  onNavigatePage,
}) => {
  const copy = getSplitImageContent(locale);
  const bundle = getLocaleBundleSync(locale);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [sourceImage, setSourceImage] = useState<SourceCanvasState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [preset, setPreset] = useState<GridPresetId>('3x3');
  const [customRows, setCustomRows] = useState<number>(3);
  const [customCols, setCustomCols] = useState<number>(3);
  const [instagramOrder, setInstagramOrder] = useState<boolean>(false);
  const [outputFormat, setOutputFormat] = useState<SplitOutputFormat>('jpg');
  const [jpgQuality, setJpgQuality] = useState<number>(92);

  const [slices, setSlices] = useState<GeneratedSliceItem[]>([]);
  const [isGeneratingSlices, setIsGeneratingSlices] = useState<boolean>(false);
  const [isBuildingZip, setIsBuildingZip] = useState<boolean>(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const { rows, cols } = getPresetDimensions(preset, customRows, customCols);

  const handleLoadImageElement = useCallback(
    (img: HTMLImageElement, fileName: string) => {
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;
      if (!origW || !origH) {
        setErrorMsg(copy.errorInvalidFile);
        return;
      }

      const downscaled = computeDownscaledDimensions(
        origW,
        origH,
        MAX_SPLIT_IMAGE_DIMENSION
      );

      const workCanvas = document.createElement('canvas');
      workCanvas.width = downscaled.width;
      workCanvas.height = downscaled.height;
      const ctx = workCanvas.getContext('2d');
      if (!ctx) {
        setErrorMsg(copy.errorInvalidFile);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, downscaled.width, downscaled.height);

      const previewUrl = workCanvas.toDataURL('image/jpeg', 0.9);
      setErrorMsg(null);
      setSourceImage({
        canvas: workCanvas,
        previewUrl,
        originalWidth: origW,
        originalHeight: origH,
        width: downscaled.width,
        height: downscaled.height,
        wasDownscaled: downscaled.wasDownscaled,
        sourceName: fileName,
      });
    },
    [copy.errorInvalidFile]
  );

  const processSelectedFile = useCallback(
    (file: File | null | undefined) => {
      if (!file) return;
      const isSupportedMime =
        file.type === 'image/jpeg' ||
        file.type === 'image/png' ||
        file.type === 'image/webp' ||
        /\.(jpe?g|png|webp)$/i.test(file.name);

      if (!isSupportedMime) {
        setErrorMsg(copy.errorInvalidFile);
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        handleLoadImageElement(img, file.name);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setErrorMsg(copy.errorInvalidFile);
      };
      img.src = objectUrl;
    },
    [copy.errorInvalidFile, handleLoadImageElement]
  );

  const handleLoadSample = useCallback(() => {
    setErrorMsg(null);
    setSourceImage(createSampleStudioCanvas());
  }, []);

  // Re-slice whenever sourceImage, rows, cols, instagramOrder, outputFormat, or jpgQuality changes
  useEffect(() => {
    if (!sourceImage) {
      setSlices([]);
      return;
    }

    let cancelled = false;
    setIsGeneratingSlices(true);

    const cells = computeSplitGridCells({
      imageWidth: sourceImage.width,
      imageHeight: sourceImage.height,
      rows,
      cols,
      instagramOrder,
      format: outputFormat,
    });

    const mimeType = outputFormat === 'png' ? 'image/png' : 'image/jpeg';
    const qualityRatio =
      outputFormat === 'jpg'
        ? Math.max(0.1, Math.min(1, jpgQuality / 100))
        : undefined;

    (async () => {
      const results: GeneratedSliceItem[] = [];

      for (const cell of cells) {
        if (cancelled) return;
        const tileCanvas = document.createElement('canvas');
        tileCanvas.width = cell.width;
        tileCanvas.height = cell.height;
        const tCtx = tileCanvas.getContext('2d');

        if (tCtx) {
          if (outputFormat === 'jpg') {
            // Fill white background for transparent PNGs exported as JPG
            tCtx.fillStyle = '#ffffff';
            tCtx.fillRect(0, 0, cell.width, cell.height);
          }
          tCtx.drawImage(
            sourceImage.canvas,
            cell.x,
            cell.y,
            cell.width,
            cell.height,
            0,
            0,
            cell.width,
            cell.height
          );
        }

        const { blob, dataUrl } = await canvasToBlobAndUrl(
          tileCanvas,
          mimeType,
          qualityRatio
        );
        results.push({
          ...cell,
          blob,
          dataUrl,
          byteSize: blob.size,
        });
      }

      if (!cancelled) {
        setSlices(results);
        setIsGeneratingSlices(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sourceImage, rows, cols, instagramOrder, outputFormat, jpgQuality]);

  const handleTriggerSingleDownload = useCallback((slice: GeneratedSliceItem) => {
    const url = URL.createObjectURL(slice.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = slice.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, []);

  const handleDownloadAllZip = useCallback(async () => {
    if (slices.length === 0 || isBuildingZip) return;
    setIsBuildingZip(true);
    try {
      const zipBlob = await buildZipArchiveWithJSZip(
        slices.map((s) => ({
          filename: s.filename,
          data: s.blob,
        }))
      );
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vidnex-split-${rows}x${cols}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } finally {
      setIsBuildingZip(false);
    }
  }, [slices, isBuildingZip, rows, cols]);

  const previewCells = computeSplitGridCells({
    imageWidth: sourceImage?.width || 1200,
    imageHeight: sourceImage?.height || 1200,
    rows,
    cols,
    instagramOrder,
    format: outputFormat,
  });

  const sortedSlicesForDownload = [...slices].sort(
    (a, b) => a.orderNumber - b.orderNumber
  );

  const homeHref = getLocalizedPagePath(locale, 'home');

  return (
    <div className="w-full">
      {/* Top AdSlot (above the tool: compact 320x50 on mobile, 728x90 leaderboard on desktop, never overlapping preview or download buttons) */}
      <div className="max-w-6xl mx-auto px-4 pt-3">
        <AdSlot
          slotId="vidnex-split-top-mobile-banner"
          format="mobile-banner"
          language={locale}
        />
        <AdSlot
          slotId="vidnex-split-top-leaderboard"
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
              slotId="vidnex-split-left-skyscraper"
              format="skyscraper"
              language={locale}
            />
          </aside>

          {/* Center Tool Container */}
          <div className="w-full max-w-4xl mx-auto">
            {/* Breadcrumb */}
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-2 text-xs font-mono text-[#7c4a2d] dark:text-[#d6b8a3] mb-4"
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
              <span className="text-[#c2410c] dark:text-[#fb923c] font-semibold">
                {copy.breadcrumbLabel}
              </span>
            </nav>

            {/* Header Hero */}
            <div className="text-center sm:text-start mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/25 text-[#c2410c] dark:text-[#fb923c] font-mono text-[11px] font-bold tracking-wide mb-3">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
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
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              data-testid="split-file-input"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                processSelectedFile(file);
                e.target.value = '';
              }}
            />

            {/* Error Banner */}
            {errorMsg && (
              <div
                role="alert"
                data-testid="split-error-banner"
                className="mb-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs sm:text-sm font-medium"
              >
                {errorMsg}
              </div>
            )}

            {/* Auto-Downscale > 8000px Notice */}
            {sourceImage?.wasDownscaled && (
              <div
                role="status"
                data-testid="split-downscaled-notice"
                className="mb-4 p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/35 text-[#9a3412] dark:text-amber-300 text-xs sm:text-sm font-medium flex items-center gap-2.5"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#c2410c] dark:text-amber-400" />
                <span>
                  {copy.downscaledNotice
                    .replace('{w}', String(sourceImage.width))
                    .replace('{h}', String(sourceImage.height))}
                </span>
              </div>
            )}

            {/* Step 1: Dropzone (shown prominently when no image is loaded, or compact bar when loaded) */}
            {!sourceImage ? (
              <div
                data-testid="split-dropzone"
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  processSelectedFile(file);
                }}
                className={`rounded-2xl border-2 border-dashed p-6 sm:p-10 text-center transition-all ${
                  isDragging
                    ? 'border-[#c2410c] bg-orange-500/10'
                    : 'border-orange-300/80 dark:border-orange-900/50 bg-white/90 dark:bg-[#1d140e]/90 hover:border-[#c2410c]/70'
                } shadow-sm mb-6`}
              >
                <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-4 text-[#c2410c] dark:text-[#fb923c]">
                  <Upload className="w-7 h-7" />
                </div>
                <h2 className="font-display text-lg sm:text-xl font-bold text-[#1f130b] dark:text-[#fffaf5] mb-1">
                  {copy.dropzoneTitle}
                </h2>
                <p className="text-xs sm:text-sm text-[#7c4a2d] dark:text-[#d6b8a3] mb-6">
                  {copy.dropzoneSubtitle}
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    data-testid="split-select-file-btn"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#c2410c] hover:bg-[#9a3412] text-white font-display font-bold text-sm shadow-sm transition-colors cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>{copy.selectFileCta}</span>
                  </button>

                  <button
                    type="button"
                    data-testid="split-load-sample"
                    onClick={handleLoadSample}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/25 text-[#9a3412] dark:text-[#fb923c] font-mono text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{copy.loadSampleCta}</span>
                  </button>
                </div>
              </div>
            ) : null}

            {/* Tool Controls + Interactive Preview Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Controls Card */}
              <div className="lg:col-span-5 rounded-2xl border border-orange-200/80 dark:border-orange-950/70 bg-white/95 dark:bg-[#1d140e]/95 p-5 shadow-sm space-y-6">
                {/* Grid Selection */}
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#7c4a2d] dark:text-[#d6b8a3] mb-3">
                    <Grid className="w-3.5 h-3.5 text-[#c2410c] dark:text-[#fb923c]" />
                    <span>{copy.gridHeading}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2">
                    {(
                      [
                        { id: '2x2', label: copy.preset2x2 },
                        { id: '3x3', label: copy.preset3x3 },
                        { id: '1x3', label: copy.preset1x3 },
                        { id: '3x1', label: copy.preset3x1 },
                        { id: 'custom', label: copy.presetCustom },
                      ] as const
                    ).map((item) => {
                      const active = preset === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          data-testid={`split-preset-${item.id}`}
                          onClick={() => setPreset(item.id)}
                          className={`px-3 py-2.5 rounded-xl font-mono text-xs font-bold border text-start transition-all cursor-pointer ${
                            active
                              ? 'bg-[#c2410c] text-white border-[#c2410c] shadow-sm'
                              : 'bg-[#fffaf5] dark:bg-[#140e0a] text-[#432818] dark:text-[#f5ebe4] border-orange-200/80 dark:border-orange-900/50 hover:border-[#c2410c]/60'
                          } ${item.id === 'custom' ? 'col-span-2 sm:col-span-1 lg:col-span-2' : ''}`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Rows x Columns inputs */}
                  {preset === 'custom' && (
                    <div
                      data-testid="split-custom-dimensions"
                      className="mt-3 grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#fffaf5] dark:bg-[#140e0a] border border-orange-200/70 dark:border-orange-900/50"
                    >
                      <label className="block">
                        <span className="block text-[11px] font-mono font-semibold text-[#7c4a2d] dark:text-[#d6b8a3] mb-1">
                          {copy.rowsLabel} (1–10)
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={customRows}
                          data-testid="split-custom-rows"
                          onChange={(e) =>
                            setCustomRows(clampGridAxis(Number(e.target.value)))
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-orange-300/80 dark:border-orange-900/60 bg-white dark:bg-[#1d140e] font-mono text-sm font-bold text-[#1f130b] dark:text-[#fffaf5]"
                        />
                      </label>
                      <label className="block">
                        <span className="block text-[11px] font-mono font-semibold text-[#7c4a2d] dark:text-[#d6b8a3] mb-1">
                          {copy.colsLabel} (1–10)
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={customCols}
                          data-testid="split-custom-cols"
                          onChange={(e) =>
                            setCustomCols(clampGridAxis(Number(e.target.value)))
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-orange-300/80 dark:border-orange-900/60 bg-white dark:bg-[#1d140e] font-mono text-sm font-bold text-[#1f130b] dark:text-[#fffaf5]"
                        />
                      </label>
                    </div>
                  )}
                </div>

                {/* Instagram Order Toggle */}
                <div className="p-3.5 rounded-xl bg-[#fffaf5] dark:bg-[#140e0a] border border-orange-200/70 dark:border-orange-900/50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <ArrowUpDown className="w-4 h-4 text-[#c2410c] dark:text-[#fb923c] shrink-0" />
                      <span className="font-display text-sm font-bold text-[#1f130b] dark:text-[#fffaf5]">
                        {copy.instagramOrderLabel}
                      </span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={instagramOrder}
                      data-testid="split-instagram-order-toggle"
                      onClick={() => setInstagramOrder((prev) => !prev)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        instagramOrder
                          ? 'bg-[#c2410c]'
                          : 'bg-orange-200 dark:bg-orange-950'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          instagramOrder
                            ? locale === 'ar'
                              ? '-translate-x-5'
                              : 'translate-x-5'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-[#7c4a2d] dark:text-[#d6b8a3] leading-relaxed">
                    {copy.instagramOrderHint}
                  </p>
                </div>

                {/* Output Format & JPG Quality */}
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#7c4a2d] dark:text-[#d6b8a3] mb-3">
                    <Sliders className="w-3.5 h-3.5 text-[#c2410c] dark:text-[#fb923c]" />
                    <span>{copy.formatHeading}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      data-testid="split-format-png"
                      onClick={() => setOutputFormat('png')}
                      className={`px-3 py-2.5 rounded-xl font-mono text-xs font-bold border transition-all cursor-pointer ${
                        outputFormat === 'png'
                          ? 'bg-[#c2410c] text-white border-[#c2410c] shadow-sm'
                          : 'bg-[#fffaf5] dark:bg-[#140e0a] text-[#432818] dark:text-[#f5ebe4] border-orange-200/80 dark:border-orange-900/50'
                      }`}
                    >
                      {copy.formatPng}
                    </button>
                    <button
                      type="button"
                      data-testid="split-format-jpg"
                      onClick={() => setOutputFormat('jpg')}
                      className={`px-3 py-2.5 rounded-xl font-mono text-xs font-bold border transition-all cursor-pointer ${
                        outputFormat === 'jpg'
                          ? 'bg-[#c2410c] text-white border-[#c2410c] shadow-sm'
                          : 'bg-[#fffaf5] dark:bg-[#140e0a] text-[#432818] dark:text-[#f5ebe4] border-orange-200/80 dark:border-orange-900/50'
                      }`}
                    >
                      {copy.formatJpg}
                    </button>
                  </div>

                  {outputFormat === 'jpg' && (
                    <div className="mt-3 p-3 rounded-xl bg-[#fffaf5] dark:bg-[#140e0a] border border-orange-200/70 dark:border-orange-900/50">
                      <div className="flex items-center justify-between text-xs font-mono font-bold mb-1.5">
                        <span className="text-[#7c4a2d] dark:text-[#d6b8a3]">
                          {copy.qualityLabel}
                        </span>
                        <span
                          data-testid="split-jpg-quality-value"
                          className="text-[#c2410c] dark:text-[#fb923c]"
                        >
                          {jpgQuality}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        step={1}
                        value={jpgQuality}
                        data-testid="split-jpg-quality-slider"
                        onChange={(e) => setJpgQuality(Number(e.target.value))}
                        className="w-full accent-[#c2410c] cursor-pointer"
                      />
                    </div>
                  )}
                </div>

                {/* Privacy reassurance */}
                <div className="flex items-start gap-2.5 pt-2 border-t border-orange-200/60 dark:border-orange-950/60 text-[11px] text-[#7c4a2d] dark:text-[#d6b8a3]">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{copy.privacyNotice}</span>
                </div>
              </div>

              {/* Right Column: Interactive Cut Preview + ZIP & Individual Downloads */}
              <div className="lg:col-span-7 rounded-2xl border border-orange-200/80 dark:border-orange-950/70 bg-white/95 dark:bg-[#1d140e]/95 p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm sm:text-base font-bold text-[#1f130b] dark:text-[#fffaf5]">
                      {copy.previewHeading}
                    </span>
                    <span
                      data-testid="split-grid-badge"
                      className="px-2 py-0.5 rounded-md bg-orange-500/15 text-[#c2410c] dark:text-[#fb923c] font-mono text-xs font-bold"
                    >
                      {rows}×{cols} ({rows * cols})
                    </span>
                  </div>

                  {sourceImage && (
                    <div className="flex items-center gap-2">
                      <span
                        data-testid="split-source-dimensions"
                        className="font-mono text-xs text-[#7c4a2d] dark:text-[#d6b8a3]"
                      >
                        {sourceImage.width}×{sourceImage.height} px
                      </span>
                      <button
                        type="button"
                        data-testid="split-change-image-btn"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-[#c2410c] dark:text-[#fb923c] font-mono text-xs font-bold transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>{copy.changeImageCta}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Preview Canvas Overlay Container */}
                <div
                  data-testid="split-preview-stage"
                  className="relative w-full rounded-xl overflow-hidden bg-[#140e0a] border border-orange-300/60 dark:border-orange-900/60 flex items-center justify-center min-h-[260px] sm:min-h-[340px]"
                >
                  {sourceImage ? (
                    <div className="relative inline-block max-w-full max-h-[520px]">
                      <img
                        src={sourceImage.previewUrl}
                        alt={copy.previewHeading}
                        className="block max-w-full max-h-[520px] w-auto h-auto select-none"
                      />

                      {/* Cut lines & numbered cells overlay */}
                      <div
                        data-testid="split-preview-grid-overlay"
                        className="absolute inset-0 grid pointer-events-none"
                        style={{
                          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
                          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                        }}
                      >
                        {previewCells.map((cell) => (
                          <div
                            key={`${cell.row}-${cell.col}`}
                            data-testid={`split-preview-cell-${cell.cellIndex}`}
                            className="relative border border-dashed border-white/85 shadow-[inset_0_0_0_1px_rgba(20,14,10,0.45)] flex items-start justify-start p-1.5 sm:p-2"
                          >
                            <span
                              data-testid={`split-preview-badge-${cell.cellIndex}`}
                              className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md bg-[#140e0a]/85 text-[#fffaf5] border border-orange-400/70 font-mono text-[11px] font-bold shadow-sm"
                            >
                              {cell.orderNumber}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Placeholder Grid Schematic when no image is selected yet */
                    <div
                      data-testid="split-preview-placeholder"
                      className="w-full aspect-square max-w-[340px] p-4 flex flex-col items-center justify-center"
                    >
                      <div
                        className="w-full h-full rounded-lg border border-orange-500/40 bg-gradient-to-br from-orange-500/20 via-amber-500/10 to-orange-900/20 grid"
                        style={{
                          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
                          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                        }}
                      >
                        {previewCells.map((cell) => (
                          <div
                            key={`${cell.row}-${cell.col}`}
                            data-testid={`split-preview-cell-${cell.cellIndex}`}
                            className="border border-dashed border-orange-400/50 flex items-center justify-center"
                          >
                            <span
                              data-testid={`split-preview-badge-${cell.cellIndex}`}
                              className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-[#140e0a]/80 text-[#fb923c] border border-orange-500/40 font-mono text-xs font-bold"
                            >
                              {cell.orderNumber}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Primary Download All (ZIP) Button & Individual Slice Downloads */}
                {sourceImage && (
                  <div className="mt-5 space-y-5">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl bg-orange-500/10 border border-orange-500/25">
                      <div>
                        <div className="font-display text-sm font-bold text-[#1f130b] dark:text-[#fffaf5]">
                          {copy.sliceCountLabel} :{' '}
                          <span className="font-mono text-[#c2410c] dark:text-[#fb923c]">
                            {slices.length}
                          </span>{' '}
                          ({outputFormat.toUpperCase()})
                        </div>
                        <div className="text-xs font-mono text-[#7c4a2d] dark:text-[#d6b8a3]">
                          image-1.{outputFormat} → image-{slices.length}.
                          {outputFormat}
                        </div>
                      </div>

                      <button
                        type="button"
                        data-testid="split-download-zip"
                        disabled={
                          isGeneratingSlices ||
                          isBuildingZip ||
                          slices.length === 0
                        }
                        onClick={handleDownloadAllZip}
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#c2410c] hover:bg-[#9a3412] disabled:opacity-50 text-white font-display font-bold text-sm shadow-sm transition-colors cursor-pointer"
                      >
                        <Archive className="w-4 h-4" />
                        <span>
                          {isBuildingZip
                            ? copy.buildingZipCta
                            : copy.downloadAllZipCta}
                        </span>
                      </button>
                    </div>

                    {/* Individual Slices List */}
                    <div>
                      <h3 className="font-display text-xs sm:text-sm font-bold uppercase tracking-wider text-[#7c4a2d] dark:text-[#d6b8a3] mb-3">
                        {copy.slicesListHeading}
                      </h3>

                      <div
                        data-testid="split-slices-list"
                        className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1"
                      >
                        {sortedSlicesForDownload.map((slice) => (
                          <div
                            key={slice.filename}
                            data-testid={`split-slice-card-${slice.orderNumber}`}
                            className="rounded-xl border border-orange-200/80 dark:border-orange-900/50 bg-[#fffaf5] dark:bg-[#140e0a] p-2.5 flex flex-col justify-between gap-2"
                          >
                            <div className="relative rounded-lg overflow-hidden bg-black/20 aspect-square flex items-center justify-center">
                              <img
                                src={slice.dataUrl}
                                alt={slice.filename}
                                className="max-w-full max-h-full object-contain"
                              />
                              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-[#140e0a]/85 text-white font-mono text-[10px] font-bold">
                                #{slice.orderNumber}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-1 text-[11px] font-mono text-[#7c4a2d] dark:text-[#d6b8a3]">
                              <span className="truncate font-bold text-[#1f130b] dark:text-[#fffaf5]">
                                {slice.filename}
                              </span>
                              <span>
                                {slice.width}×{slice.height}
                              </span>
                            </div>

                            <button
                              type="button"
                              data-testid={`split-download-item-${slice.orderNumber}`}
                              onClick={() => handleTriggerSingleDownload(slice)}
                              className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-500/15 hover:bg-[#c2410c] text-[#9a3412] dark:text-[#fb923c] hover:text-white font-mono text-xs font-bold transition-colors cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>{copy.downloadSingleCta}</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Ads (below the tool, never overlapping preview or download buttons) */}
            <div className="mt-8 space-y-6">
              <AdSlot
                slotId="vidnex-split-bottom-rectangle"
                format="rectangle"
                language={locale}
              />
              <AdSlot
                slotId="vidnex-split-native"
                format="native"
                language={locale}
              />
            </div>

            {/* How-To 3 Steps Section */}
            <div className="mt-12">
              <div className="text-xs font-mono font-bold uppercase tracking-widest text-[#c2410c] dark:text-[#fb923c] mb-2">
                {bundle.ui.sections.workflowProtocol}
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#1f130b] dark:text-[#fffaf5] mb-6">
                {bundle.ui.sections.howToHeading}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {copy.howToSteps.map((step) => (
                  <div
                    key={step.number}
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

            {/* Editorial Guide Block */}
            <article className="mt-12 rounded-2xl border border-orange-200/80 dark:border-orange-950/70 bg-white/90 dark:bg-[#1d140e]/90 p-6 sm:p-8 shadow-sm">
              <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#1f130b] dark:text-[#fffaf5] mb-2">
                {copy.editorial.heading}
              </h2>
              <p className="text-xs sm:text-sm font-mono font-semibold text-[#c2410c] dark:text-[#fb923c] mb-4">
                {copy.editorial.subheading}
              </p>

              <div className="space-y-3 text-sm text-[#432818] dark:text-[#e7d5c9] leading-relaxed mb-6">
                {copy.editorial.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-orange-200/60 dark:border-orange-950/60">
                <div>
                  <h3 className="font-display text-sm font-bold text-[#1f130b] dark:text-[#fffaf5] mb-2">
                    {copy.editorial.formatsTitle}
                  </h3>
                  <ul className="space-y-1.5 text-xs sm:text-sm text-[#6e472b] dark:text-[#d6b8a3] list-disc list-inside">
                    {copy.editorial.formatsList.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-[#1f130b] dark:text-[#fffaf5] mb-2">
                    {copy.editorial.limitsTitle}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#6e472b] dark:text-[#d6b8a3] leading-relaxed">
                    {copy.editorial.limitsText}
                  </p>
                </div>
              </div>
            </article>

            {/* FAQ Section */}
            <div className="mt-12">
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-[#c2410c] dark:text-[#fb923c] mb-2">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{bundle.ui.sections.knowledgeBase}</span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#1f130b] dark:text-[#fffaf5] mb-6">
                {bundle.ui.sections.faqHeading}
              </h2>

              <div className="space-y-3">
                {copy.faqs.map((faq, idx) => {
                  const isOpen = openFaqIndex === idx;
                  return (
                    <div
                      key={idx}
                      className="rounded-2xl border border-orange-200/80 dark:border-orange-950/70 bg-white/90 dark:bg-[#1d140e]/90 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenFaqIndex(isOpen ? null : idx)
                        }
                        className="w-full px-5 py-4 text-start flex items-center justify-between gap-4 font-display text-sm sm:text-base font-bold text-[#1f130b] dark:text-[#fffaf5] cursor-pointer"
                      >
                        <span>{faq.question}</span>
                        <ChevronDown
                          className={`w-4 h-4 shrink-0 text-[#c2410c] dark:text-[#fb923c] transition-transform ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-4 text-xs sm:text-sm text-[#6e472b] dark:text-[#d6b8a3] leading-relaxed">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Internal Cross-Links to Platform Downloaders */}
            <div className="mt-12 pt-8 border-t border-orange-200/60 dark:border-orange-950/60">
              <h2 className="font-display text-base sm:text-lg font-bold text-[#1f130b] dark:text-[#fffaf5] mb-4">
                {bundle.ui.sections.platformsHeading}
              </h2>
              <div className="flex flex-wrap gap-2.5">
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
              slotId="vidnex-split-right-skyscraper"
              format="skyscraper"
              language={locale}
            />
          </aside>
        </div>
      </section>
    </div>
  );
};
