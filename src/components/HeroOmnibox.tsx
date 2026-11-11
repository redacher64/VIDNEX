import React, { useState, useRef, useEffect } from 'react';
import {
  detectMediaUrl,
  DetectedUrlInfo,
  PlatformId,
  SAMPLE_LINKS,
  SampleLink,
} from '../utils/urlDetector.ts';
import {
  getLocalizedPagePath,
  isPlatformPageKey,
  PLATFORM_PAGE_KEYS,
  type PlatformPageKey,
  type SupportedLocale,
} from '../i18n/config.ts';
import { getLocaleBundleSync } from '../i18n/localeLoader.ts';
import { PlatformIcon } from './icons/PlatformIcons.tsx';
import { AdSlot } from './AdSlot.tsx';
import { ShareButton } from './ShareButton.tsx';

interface HeroOmniboxProps {
  pageKey: 'home' | PlatformPageKey;
  activePlatform: PlatformId;
  onNavigatePage: (pageKey: 'home' | PlatformPageKey) => void;
  onSubmitUrl: (url: string, detected: DetectedUrlInfo) => void;
  onEscapeClear?: () => void;
  isExtracting?: boolean;
  language: SupportedLocale;
}

export const HeroOmnibox: React.FC<HeroOmniboxProps> = ({
  pageKey,
  activePlatform,
  onNavigatePage,
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

  const bundle = getLocaleBundleSync(language);
  const t = bundle.ui.omnibox;
  const pageContent =
    pageKey === 'home' ? bundle.home : bundle.platforms[pageKey];
  const currentBadgeLabel =
    pageKey === 'home' ? 'VIDNEX' : bundle.platforms[pageKey].shortLabel;

  const detected = detectMediaUrl(urlInput, activePlatform);

  useEffect(() => {
    if (window.innerWidth >= 768) {
      inputRef.current?.focus();
    }
  }, []);

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

  useEffect(() => {
    if (urlInput.trim() === '') {
      setValidationMessage(null);
    }
  }, [urlInput]);

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

        const pastedDetected = detectMediaUrl(trimmed, activePlatform);
        if (pastedDetected.isComingSoon) {
          setValidationMessage(t.comingSoonNotice);
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
      setValidationMessage(t.comingSoonNotice);
      return;
    }

    if (!detected.isValid) {
      setValidationMessage(t.errInvalidUrl);
      return;
    }

    setValidationMessage(null);
    onSubmitUrl(detected.normalizedUrl, detected);
  };

  const homeHref = getLocalizedPagePath(language, 'home');

  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-b from-orange-50/70 via-[#fffaf5] to-[#fffaf5] dark:from-orange-950/20 dark:via-[#140e0a] dark:to-[#140e0a] pt-6 sm:pt-12 pb-8 sm:pb-10 border-b border-orange-200/40 dark:border-orange-900/30">
      <div className="max-w-[1380px] mx-auto px-4 sm:px-6 relative z-10 flex items-start justify-center gap-6">
        {/* Left Vertical Column Ad (160×600 Skyscraper) */}
        <div className="hidden xl:block pt-2">
          <AdSlot
            slotId="vidnex-left-column-160x600"
            format="skyscraper"
            language={language}
          />
        </div>

        <div className="w-full max-w-3xl text-center">
          {/* Visible Breadcrumb on Platform Pages (ÉTAPE 4) */}
          {isPlatformPageKey(pageKey) && (
            <nav
              aria-label="Breadcrumb"
              className="mb-3 sm:mb-4 flex items-center justify-center gap-2 text-xs font-mono text-[#6c4e40] dark:text-orange-200/75"
            >
              <a
                href={homeHref}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigatePage('home');
                }}
                className="hover:text-orange-600 dark:hover:text-amber-400 font-semibold transition-colors"
              >
                {bundle.ui.sections.breadcrumbHome}
              </a>
              <span aria-hidden="true" className="opacity-60">
                /
              </span>
              <span
                aria-current="page"
                className="text-orange-700 dark:text-amber-400 font-bold"
              >
                {bundle.platforms[pageKey].breadcrumbLabel}
              </span>
            </nav>
          )}

          {/* Eyebrow Technical Specs Line */}
          <div className="inline-flex items-center gap-2 text-orange-800 dark:text-amber-400 font-mono text-[10px] sm:text-[11px] font-semibold tracking-widest uppercase mb-3 sm:mb-4">
            <span>{pageContent.specs.join(' · ')}</span>
          </div>

          {/* Main Headline */}
          <h1 className="font-display text-2xl sm:text-5xl font-bold tracking-tight text-[#1f130b] dark:text-[#fffaf5] max-w-2xl mx-auto leading-tight">
            {pageContent.h1}
          </h1>

          {/* Subtitle */}
          <p className="mt-2.5 sm:mt-3.5 text-sm sm:text-lg text-[#6c4e40] dark:text-orange-200/75 max-w-2xl mx-auto leading-relaxed">
            {pageContent.subtitle}
          </p>

          {/* Master URL Input Omnibox */}
          <form onSubmit={handleFormSubmit} noValidate className="mt-6 sm:mt-8 w-full">
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
                      detected.platform ? detected.platform : activePlatform
                    }
                    className="w-4 h-4"
                  />
                </span>
                <span className="font-mono text-xs text-orange-900 dark:text-orange-100 font-semibold tracking-normal whitespace-nowrap">
                  {detected.badgeLabel
                    ? detected.badgeLabel
                    : currentBadgeLabel}
                </span>
              </div>

              {/* URL Input (always LTR for URLs) */}
              <div
                className="relative flex-1 flex items-center min-h-[48px] min-w-0 px-2"
                dir="ltr"
              >
                <span className="sm:hidden pr-2 text-orange-500 dark:text-amber-400 shrink-0">
                  <PlatformIcon
                    platform={
                      detected.platform ? detected.platform : activePlatform
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
                  placeholder={pageContent.placeholder}
                  aria-label={t.inputAriaLabel}
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="off"
                  className="w-full h-12 pr-2 bg-transparent font-mono text-sm text-left text-[#1f130b] dark:text-[#fffaf5] placeholder:text-orange-900/40 dark:placeholder:text-orange-200/40 focus:outline-none font-medium"
                />
              </div>

              {/* Action Controls: Paste OR Clear + Download */}
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
                    <span>{clipboardFeedback || t.pasteButton}</span>
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
                  <span>
                    {isExtracting ? t.extractingButton : t.downloadButton}
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="w-4 h-4 rtl:rotate-180"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
            </div>

            {validationMessage && (
              <p
                role="alert"
                className="mt-2.5 font-mono text-xs font-medium text-red-600 dark:text-red-400"
              >
                {validationMessage}
              </p>
            )}
          </form>

          {/* Mobile-First Wrapping Tool Selection Bar (TikTok, Instagram, X, Facebook, YouTube, Snapchat + ShareButton) */}
          <div className="mt-4 sm:mt-5 tool-selection-bar">
            {PLATFORM_PAGE_KEYS.map((pKey) => {
              const pInfo = bundle.platforms[pKey];
              const isSelected = pageKey === pKey;
              const href = getLocalizedPagePath(language, pKey);
              return (
                <a
                  key={pKey}
                  href={href}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigatePage(pKey);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-orange-600 text-white font-bold border border-orange-600 shadow-orange-sm'
                      : 'bg-white dark:bg-[#1c140e] border border-orange-200/90 dark:border-orange-900/60 text-orange-900 dark:text-orange-200/80 font-medium shadow-sm hover:border-orange-400 hover:shadow-orange-sm'
                  }`}
                >
                  <PlatformIcon platform={pKey} className="w-3.5 h-3.5" />
                  <span>{pInfo.shortLabel}</span>
                </a>
              );
            })}
            {(['youtube', 'snapchat'] as const).map((upcomingId) => {
              const label = upcomingId === 'youtube' ? 'YouTube' : 'Snapchat';
              return (
                <button
                  key={upcomingId}
                  type="button"
                  onClick={() => setValidationMessage(t.comingSoonNotice)}
                  title={`${label} — ${bundle.ui.nav.soonBadge}`}
                  className="px-3 py-1.5 rounded-lg font-mono text-xs transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 bg-white/75 dark:bg-[#1c140e]/75 border border-orange-200/70 dark:border-orange-900/50 text-[#6c4e40] dark:text-orange-200/65 font-medium hover:border-orange-300 cursor-pointer"
                >
                  <PlatformIcon platform={upcomingId} className="w-3.5 h-3.5" />
                  <span>{label}</span>
                  <span className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950/80 text-[9px] font-mono uppercase tracking-wider text-orange-800 dark:text-amber-400">
                    {bundle.ui.nav.soonBadge}
                  </span>
                </button>
              );
            })}
            <ShareButton pageKey={pageKey} language={language} />
          </div>

          {/* Quick Sample Test Links */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
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

        {/* Right Vertical Column Ad (160×600 Skyscraper) */}
        <div className="hidden xl:block pt-2">
          <AdSlot
            slotId="vidnex-right-column-160x600"
            format="skyscraper"
            language={language}
          />
        </div>
      </div>
    </section>
  );
};