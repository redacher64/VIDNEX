import React, { useState, useRef, useEffect } from 'react';
import {
  detectMediaUrl,
  DetectedUrlInfo,
  PlatformId,
} from '../utils/urlDetector';
import {
  getToolsByPlatform,
  SeoToolConfig,
  ToolSlug,
} from '../data/seoToolsConfig';
import {
  getLocalizedToolConfig,
  LanguageCode,
  UI_TRANSLATIONS,
} from '../i18n/translations';
import { PlatformIcon } from './icons/PlatformIcons';

interface HeroOmniboxProps {
  activeTool: SeoToolConfig;
  onSelectTool: (slug: ToolSlug) => void;
  onSelectPlatform: (platform: PlatformId) => void;
  onSubmitUrl: (url: string, detected: DetectedUrlInfo) => void;
  onEscapeClear?: () => void;
  isExtracting?: boolean;
  language: LanguageCode;
}

export const HeroOmnibox: React.FC<HeroOmniboxProps> = ({
  activeTool,
  onSelectTool,
  onSelectPlatform,
  onSubmitUrl,
  onEscapeClear,
  isExtracting = false,
  language,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [clipboardFeedback, setClipboardFeedback] = useState<string | null>(
    null
  );
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const t = UI_TRANSLATIONS[language].omnibox;
  const detected = detectMediaUrl(urlInput, activeTool.platform);
  const siblingSubTools = getToolsByPlatform(activeTool.platform).map((tool) =>
    getLocalizedToolConfig(tool, language)
  );

  // Auto-focus on desktop mount
  useEffect(() => {
    if (window.innerWidth >= 768) {
      inputRef.current?.focus();
    }
  }, []);

  // Global Keyboard Shortcuts: Ctrl+V / Cmd+V focuses input; Esc clears
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingInField =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (!isTypingInField) {
          inputRef.current?.focus();
        }
      } else if (e.key === 'Escape') {
        setUrlInput('');
        setValidationMessage(null);
        onEscapeClear?.();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onEscapeClear]);

  // Automatically sync sub-tool or platform when user pastes a recognized link or @handle
  useEffect(() => {
    if (detected.isValid && detected.platform) {
      if (detected.platform === 'instagram') {
        if (
          detected.mediaType === 'profile' &&
          activeTool.slug !== 'instagram-dp'
        ) {
          onSelectTool('instagram-dp');
        } else if (
          detected.mediaType === 'post' &&
          activeTool.slug !== 'instagram-carousel'
        ) {
          onSelectTool('instagram-carousel');
        } else if (
          detected.mediaType === 'story' &&
          activeTool.slug !== 'instagram-stories'
        ) {
          onSelectTool('instagram-stories');
        } else if (
          detected.mediaType === 'reel' &&
          activeTool.slug !== 'instagram-reels'
        ) {
          onSelectTool('instagram-reels');
        }
      } else if (detected.platform === 'tiktok') {
        if (
          detected.mediaType === 'slideshow' &&
          activeTool.slug !== 'tiktok-slideshow'
        ) {
          onSelectTool('tiktok-slideshow');
        } else if (
          detected.mediaType === 'profile' &&
          activeTool.slug !== 'tiktok-dp'
        ) {
          onSelectTool('tiktok-dp');
        } else if (
          detected.mediaType === 'video' &&
          activeTool.platform !== 'tiktok'
        ) {
          onSelectTool('tiktok-no-watermark');
        }
      } else if (detected.platform !== activeTool.platform) {
        onSelectPlatform(detected.platform);
      }
    }

    if (urlInput.trim() === '') {
      setValidationMessage(null);
    }
  }, [
    urlInput,
    detected.isValid,
    detected.platform,
    detected.mediaType,
    activeTool.slug,
    activeTool.platform,
    onSelectTool,
    onSelectPlatform,
  ]);

  const handlePasteClipboard = async () => {
    setValidationMessage(null);
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        throw new Error('Clipboard API unavailable');
      }
      const text = await navigator.clipboard.readText();
      if (text) {
        const trimmed = text.trim();
        setUrlInput(trimmed);
        setClipboardFeedback(t.pastedFeedback);
        setTimeout(() => setClipboardFeedback(null), 1500);
        inputRef.current?.focus();

        const pastedDetected = detectMediaUrl(trimmed, activeTool.platform);
        if (pastedDetected.isValid) {
          onSubmitUrl(pastedDetected.normalizedUrl, pastedDetected);
        }
      }
    } catch {
      inputRef.current?.focus();
      setValidationMessage(t.errClipboardBlocked);
    }
  };

  const handleClearInput = () => {
    setUrlInput('');
    setValidationMessage(null);
    inputRef.current?.focus();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) {
      setValidationMessage(t.errEmptyInput);
      inputRef.current?.focus();
      return;
    }

    if (!detected.isValid) {
      setValidationMessage(t.errInvalidUrl);
      return;
    }

    setValidationMessage(null);
    onSubmitUrl(detected.normalizedUrl, detected);
  };

  return (
    <section className="w-full">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center pt-14 sm:pt-20 pb-10">
        {/* 1. Clean Title + Concise Subtitle */}
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#1f130b] dark:text-[#fffaf5]">
          {activeTool.h1}
        </h1>
        <p className="mt-3 text-sm sm:text-base text-[#6c4e40] dark:text-orange-200/70 max-w-xl mx-auto line-clamp-2">
          {activeTool.subtitle}
        </p>

        {/* 2. Sleek Elevated Rounded-2xl Omnibox */}
        <form onSubmit={handleFormSubmit} noValidate className="mt-8 w-full">
          <div
            className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 rounded-2xl bg-white/95 dark:bg-[#1c140e] border shadow-xs transition-all ${
              detected.isValid
                ? 'border-emerald-500/70 dark:border-emerald-500/60'
                : validationMessage
                ? 'border-red-500/70'
                : 'border-orange-200/90 dark:border-orange-950/70 focus-within:border-orange-500 focus-within:ring-4 focus-within:ring-orange-500/20 shadow-[0_4px_24px_rgba(234,88,12,0.08)]'
            }`}
          >
            {/* URL Input + Subtle Detected Platform Icon */}
            <div
              className="relative flex-1 flex items-center min-h-[48px]"
              dir="ltr"
            >
              <div className="pl-3.5 pr-2 flex items-center justify-center text-slate-400 dark:text-zinc-500">
                {detected.isValid && detected.platform ? (
                  <span
                    title={detected.badgeLabel}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 transition-all"
                  >
                    <PlatformIcon
                      platform={detected.platform}
                      className="w-3.5 h-3.5"
                    />
                  </span>
                ) : (
                  <PlatformIcon
                    platform={activeTool.platform}
                    className="w-4 h-4 opacity-50"
                  />
                )}
              </div>

              <input
                ref={inputRef}
                type="text"
                dir="ltr"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder={activeTool.placeholder}
                aria-label={t.sourceUrlLabel}
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                className="w-full h-12 pr-3 bg-transparent font-mono text-sm text-left text-[#1f130b] dark:text-[#fffaf5] placeholder:text-orange-900/40 dark:placeholder:text-orange-200/40 focus:outline-none"
              />
            </div>

            {/* Right Controls: Paste (when empty) OR Clear × (when filled) + Download */}
            <div className="flex items-center gap-2 shrink-0">
              {urlInput.length === 0 ? (
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="min-h-[48px] px-3.5 rounded-xl flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200/70 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-medium text-[#0F172A] dark:text-[#FAFAFA] transition-colors"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  <span>{clipboardFeedback || t.pasteBtn}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleClearInput}
                  aria-label={t.clearInputAria}
                  title={t.clearInputAria}
                  className="min-h-[48px] w-11 rounded-xl flex items-center justify-center bg-slate-100 hover:bg-slate-200/70 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-[#FAFAFA] transition-colors"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="w-4 h-4"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}

              <button
                type="submit"
                disabled={isExtracting}
                className="flex-1 sm:flex-initial min-h-[48px] px-6 rounded-xl flex items-center justify-center gap-2 bg-[#0F172A] hover:bg-slate-800 disabled:opacity-50 text-white dark:bg-[#FAFAFA] dark:hover:bg-zinc-200 dark:text-[#09090B] text-sm font-medium transition-colors"
              >
                <span>{isExtracting ? t.extractingBtn : t.downloadBtn}</span>
              </button>
            </div>
          </div>

          {/* Gentle Inline Validation Message */}
          {validationMessage && (
            <p
              role="alert"
              className="mt-2.5 text-xs text-red-600 dark:text-red-400"
            >
              {validationMessage}
            </p>
          )}
        </form>

        {/* 3. Quiet Centered Row of Sub-Tool Pills Directly Under Omnibox */}
        {siblingSubTools.length > 1 && (
          <div
            role="tablist"
            aria-label={`${activeTool.platform} tools`}
            className="mt-4 flex flex-wrap items-center justify-center gap-1.5"
          >
            {siblingSubTools.map((subTool) => {
              const isSelected = subTool.slug === activeTool.slug;
              return (
                <button
                  key={subTool.slug}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => onSelectTool(subTool.slug)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#09090B]'
                      : 'bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 border border-slate-200/90 dark:border-zinc-800 hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
                  }`}
                >
                  {subTool.shortLabel}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};