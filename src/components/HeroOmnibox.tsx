import React, { useState, useRef, useEffect } from 'react';
import {
  detectMediaUrl,
  DetectedUrlInfo,
  PlatformId,
  SAMPLE_LINKS,
  SampleLink,
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

const COMING_SOON_MESSAGE_BY_LANG: Record<LanguageCode, string> = {
  en: 'This platform is coming soon! Currently, Instagram (Reels, Posts, Carousels, Profiles) and TikTok (Videos, Photos, Profiles) are active.',
  fr: 'Cette plateforme arrive bientôt ! Actuellement, Instagram (Reels, Posts, Carrousels, Profils) et TikTok (Vidéos, Photos, Profils) sont disponibles.',
  es: '¡Esta plataforma estará disponible pronto! Actualmente admitimos Instagram y TikTok.',
  pt: 'Esta plataforma estará disponível em breve! Atualmente suportamos Instagram e TikTok.',
  ar: 'هذه المنصة ستتوفر قريباً! حالياً ندعم إنستغرام وتيك توك بالكامل.',
};

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
        if (pastedDetected.isComingSoon) {
          setValidationMessage(
            COMING_SOON_MESSAGE_BY_LANG[language] ||
              COMING_SOON_MESSAGE_BY_LANG.en
          );
        } else if (pastedDetected.isValid) {
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

  const handleSampleClick = (sample: SampleLink) => {
    setValidationMessage(null);
    setUrlInput(sample.url);
    const sampleDetected = detectMediaUrl(sample.url, sample.platform);
    if (sampleDetected.isValid) {
      onSubmitUrl(sampleDetected.normalizedUrl, sampleDetected);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) {
      setValidationMessage(t.errEmptyInput);
      inputRef.current?.focus();
      return;
    }

    if (detected.isComingSoon) {
      setValidationMessage(
        COMING_SOON_MESSAGE_BY_LANG[language] || COMING_SOON_MESSAGE_BY_LANG.en
      );
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
    <section className="relative w-full overflow-hidden bg-gradient-to-b from-orange-50/70 via-[#fffaf5] to-[#fffaf5] dark:from-orange-950/20 dark:via-[#140e0a] dark:to-[#140e0a] pt-12 sm:pt-16 pb-12 border-b border-orange-200/40 dark:border-orange-900/30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center relative z-10">
        {/* Eyebrow Technical Specs Line */}
        <div className="inline-flex items-center gap-2 text-orange-800 dark:text-amber-400 font-mono text-[11px] font-semibold tracking-widest uppercase mb-4">
          <span>{activeTool.specs.join(' · ')}</span>
        </div>

        {/* Main Headline */}
        <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#1f130b] dark:text-[#fffaf5] max-w-2xl mx-auto leading-tight">
          {activeTool.h1}
        </h1>

        {/* Subtitle */}
        <p className="mt-3.5 text-base sm:text-lg text-[#6c4e40] dark:text-orange-200/75 max-w-2xl mx-auto leading-relaxed">
          {activeTool.subtitle}
        </p>

        {/* Master URL Input Omnibox */}
        <form onSubmit={handleFormSubmit} noValidate className="mt-8 w-full">
          <div
            className={`bg-white/95 dark:bg-[#1c140e]/95 backdrop-blur-xl p-2.5 sm:p-3 rounded-2xl shadow-orange-glow border-2 transition-all flex flex-col sm:flex-row items-stretch sm:items-center gap-2 ${
              detected.isValid
                ? 'border-orange-500 dark:border-amber-500'
                : validationMessage
                ? 'border-red-500/80'
                : 'border-orange-300/80 dark:border-orange-800/70 hover:border-orange-500 focus-within:border-orange-500 focus-within:ring-4 focus-within:ring-orange-500/20'
            }`}
          >
            {/* Protocol / Platform Status Box */}
            <div className="hidden sm:flex items-center gap-2 px-3.5 py-2.5 bg-orange-50 dark:bg-[#2a1b12] border border-orange-200/80 dark:border-orange-900/60 rounded-xl shrink-0 shadow-inner">
              <span className="text-orange-600 dark:text-amber-400">
                <PlatformIcon
                  platform={
                    detected.platform ? detected.platform : activeTool.platform
                  }
                  className="w-4 h-4"
                />
              </span>
              <span className="font-mono text-xs text-orange-900 dark:text-orange-100 font-semibold tracking-normal whitespace-nowrap">
                {detected.badgeLabel
                  ? detected.badgeLabel
                  : activeTool.shortLabel}
              </span>
            </div>

            {/* URL Input */}
            <div
              className="relative flex-1 flex items-center min-h-[48px] min-w-0 px-2"
              dir="ltr"
            >
              <span className="sm:hidden pr-2 text-orange-500 dark:text-amber-400 shrink-0">
                <PlatformIcon
                  platform={
                    detected.platform ? detected.platform : activeTool.platform
                  }
                  className="w-4 h-4"
                />
              </span>

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
                className="w-full h-12 pr-2 bg-transparent font-mono text-sm text-left text-[#1f130b] dark:text-[#fffaf5] placeholder:text-orange-900/40 dark:placeholder:text-orange-200/40 focus:outline-none font-medium"
              />
            </div>

            {/* Right Controls: Paste (when empty) OR Clear × (when filled) + Download */}
            <div className="flex items-center gap-2 shrink-0">
              {urlInput.length === 0 ? (
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="min-h-[48px] px-4 rounded-xl flex items-center justify-center gap-1.5 bg-orange-50 dark:bg-[#2a1b12] border border-orange-200 dark:border-orange-800/70 text-orange-950 dark:text-orange-100 hover:bg-orange-100 dark:hover:bg-orange-950 hover:border-orange-300 transition-all font-mono text-xs font-semibold active:scale-95 shadow-sm whitespace-nowrap"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    className="w-3.5 h-3.5 text-orange-600 dark:text-amber-400"
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
                  className="min-h-[48px] w-11 rounded-xl flex items-center justify-center bg-orange-50 dark:bg-[#2a1b12] border border-orange-200 dark:border-orange-800/70 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-950 hover:text-orange-950 transition-colors"
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
                className="flex-1 sm:flex-initial min-h-[48px] px-7 rounded-xl flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 text-white hover:from-orange-700 hover:to-orange-600 disabled:opacity-50 transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(234,88,12,0.4)] hover:shadow-[0_6px_22px_rgba(234,88,12,0.55)] font-mono text-xs sm:text-sm font-bold tracking-wide whitespace-nowrap"
              >
                <span>{isExtracting ? t.extractingBtn : t.downloadBtn}</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-4 h-4"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>

          {/* Gentle Inline Validation Message */}
          {validationMessage && (
            <p
              role="alert"
              className="mt-2.5 font-mono text-xs font-medium text-red-600 dark:text-red-400"
            >
              {validationMessage}
            </p>
          )}
        </form>

        {/* Sub-Tool Selector Row */}
        {siblingSubTools.length > 1 && (
          <div
            role="tablist"
            aria-label={`${activeTool.platform} tools`}
            className="mt-5 flex flex-wrap items-center justify-center gap-2"
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
                  className={`px-3.5 py-1.5 rounded-lg font-mono text-xs transition-all duration-200 whitespace-nowrap ${
                    isSelected
                      ? 'bg-orange-600 text-white font-bold border border-orange-600 shadow-orange-sm'
                      : 'bg-white dark:bg-[#1c140e] border border-orange-200/90 dark:border-orange-900/60 text-orange-900 dark:text-orange-200/80 font-medium shadow-sm hover:border-orange-400 hover:shadow-orange-sm'
                  }`}
                >
                  {subTool.shortLabel}
                </button>
              );
            })}
          </div>
        )}

        {/* Quick Sample Test Links */}
        <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-orange-900/60 dark:text-orange-200/60 font-medium">
            {t.trySampleLabel}
          </span>
          {SAMPLE_LINKS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => handleSampleClick(sample)}
              className="font-mono text-[11px] px-2.5 py-1 rounded-md bg-orange-100/70 dark:bg-[#2a1b12] border border-orange-200/80 dark:border-orange-900/60 hover:bg-orange-500 hover:text-white dark:hover:bg-orange-600 text-orange-900 dark:text-orange-200 font-semibold transition-all shadow-sm whitespace-nowrap"
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};