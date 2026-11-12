import React, { useState, useRef, useEffect } from 'react';
import {
  detectMediaUrl,
  DetectedUrlInfo,
  isPlatformSupported,
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
    if (isExtracting) return;
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
    if (isExtracting) return;
    setValidationMessage(null);
    setUrlInput(sample.url);
    const sampleDetected = detectMediaUrl(sample.url, sample.platform);
    if (sampleDetected.isValid) {
      onSubmitUrl(sampleDetected.normalizedUrl, sampleDetected);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isExtracting) return;

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
    <section className="relative w-full overflow-hidden bg-gradient-to-b from-orange-50/70 via-[#fffaf5] to-[#fffaf5] dark:from-orange-950/20 dark:via-[#140e0a] dark:to-[#140e0a] pt-3 sm:pt-10 pb-5 sm:pb-10 border-b border-orange-200/40 dark:border-orange-900/30">
      <div className="max-w-[1380px] mx-auto px-3.5 sm:px-6 relative z-10 flex items-start justify-center gap-6">
        {/* Main Hero Content FIRST in DOM order (ÉTAPE 1 & ÉTAPE 2) */}
        <div className="w-full max-w-3xl text-center">
          {/* Visible Breadcrumb on Platform Pages */}
          {isPlatformPageKey(pageKey) && (
            <nav
              aria-label="Breadcrumb"
              className="mb-1.5 sm:mb-3 flex items-center justify-center gap-2 text-xs font-mono text-[#6c4e40] dark:text-orange-200/75"
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
          <div className="inline-flex items-center gap-1.5 text-orange-800 dark:text-amber-400 font-mono text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase mb-1.5 sm:mb-3">
            <span>{pageContent.specs.map((s) => s.trim()).join(' · ')}</span>
          </div>

          {/* Main Headline (2-3 lines max on mobile, visible above the fold) */}
          <h1 className="font-display text-[22px] sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#1f130b] dark:text-[#fffaf5] max-w-2xl mx-auto leading-[1.2] sm:leading-tight">
            {pageContent.h1}
          </h1>

          {/* Subtitle */}
          <p className="mt-1.5 sm:mt-3 text-[13px] sm:text-base text-[#6c4e40] dark:text-orange-200/80 max-w-2xl mx-auto leading-snug sm:leading-relaxed">
            {pageContent.subtitle}
          </p>

          {/* Master URL Input Omnibox (ÉTAPE 2 & ÉTAPE 4) */}
          <form onSubmit={handleFormSubmit} noValidate className="mt-3.5 sm:mt-7 w-full">
            <div
              className={`bg-white/95 dark:bg-[#1c140e]/95 backdrop-blur-xl p-2 sm:p-3 rounded-2xl shadow-orange-glow border-2 transition-all flex flex-col sm:flex-row items-stretch sm:items-center gap-2 ${
                detected.isValid
                  ? 'border-orange-500 dark:border-amber-500'
                  : validationMessage
                  ? 'border-red-500/80'
                  : 'border-orange-300/80 dark:border-orange-800/70 hover:border-orange-500 focus-within:border-orange-500 focus-within:ring-4 focus-within:ring-orange-500/20'
              }`}
            >
              {/* Protocol / Platform Status Box (Desktop) */}
              <div className="hidden sm:flex items-center gap-2 px-3.5 py-2.5 bg-orange-50 dark:bg-[#2a1b12] border border-orange-200/80 dark:border-orange-900/60 rounded-xl shrink-0 max-w-[240px] shadow-inner">
                <span className="text-orange-600 dark:text-amber-400 shrink-0">
                  <PlatformIcon
                    platform={
                      detected.platform ? detected.platform : activePlatform
                    }
                    className="w-4 h-4"
                  />
                </span>
                <span
                  title={
                    detected.badgeLabel
                      ? detected.badgeLabel
                      : currentBadgeLabel
                  }
                  className="font-mono text-xs text-orange-900 dark:text-orange-100 font-semibold tracking-normal whitespace-nowrap truncate"
                >
                  {detected.badgeLabel
                    ? detected.badgeLabel
                    : currentBadgeLabel}
                </span>
              </div>

              {/* URL Input Row + Paste / Clear Button (16px font on mobile to prevent iOS auto-zoom) */}
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
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
                    id="omnibox-url-input"
                    ref={inputRef}
                    type="url"
                    inputMode="url"
                    dir="ltr"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder={pageContent.placeholder}
                    aria-label={t.inputAriaLabel}
                    spellCheck={false}
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    className="w-full h-12 pr-1 bg-transparent font-mono text-base text-left text-[#1f130b] dark:text-[#fffaf5] placeholder:text-orange-900/40 dark:placeholder:text-orange-200/40 focus:outline-none font-medium"
                  />
                </div>

                {urlInput.length === 0 ? (
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="min-h-[44px] min-w-[44px] px-3 sm:px-4 rounded-xl flex items-center justify-center gap-1.5 bg-orange-50 dark:bg-[#2a1b12] border border-orange-200 dark:border-orange-800/70 text-orange-950 dark:text-orange-100 hover:bg-orange-100 dark:hover:bg-orange-950 hover:border-orange-300 transition-all font-mono text-xs font-semibold active:scale-95 shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      aria-hidden="true"
                      className="w-4 h-4 text-orange-600 dark:text-amber-400 shrink-0"
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
                    className="min-h-[44px] min-w-[44px] w-11 rounded-xl flex items-center justify-center bg-orange-50 dark:bg-[#2a1b12] border border-orange-200 dark:border-orange-800/70 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-950 hover:text-orange-950 transition-colors shrink-0 cursor-pointer"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                      className="w-4 h-4"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Full-width Download Button on mobile, inline on sm+ (height >= 48px) */}
              <button
                type="submit"
                disabled={isExtracting}
                aria-busy={isExtracting}
                className="w-full sm:w-auto min-h-[48px] px-6 sm:px-7 rounded-xl flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 text-white hover:from-orange-700 hover:to-orange-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(234,88,12,0.4)] hover:shadow-[0_6px_22px_rgba(234,88,12,0.55)] font-mono text-sm font-bold tracking-wide whitespace-nowrap cursor-pointer shrink-0"
              >
                {isExtracting ? (
                  <>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.25"
                      aria-hidden="true"
                      className="w-4 h-4 animate-spin shrink-0"
                    >
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    <span>{t.extractingButton}</span>
                  </>
                ) : (
                  <>
                    <span>{t.downloadButton}</span>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                      className="w-4 h-4 rtl:rotate-180 shrink-0"
                    >
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </>
                )}
              </button>
            </div>

            {validationMessage && (
              <p
                role="alert"
                className="mt-2 font-mono text-xs font-medium text-red-600 dark:text-red-400"
              >
                {validationMessage}
              </p>
            )}
          </form>

          {/* Supported Platform Chips (smooth horizontal snap-x scroll on mobile, single centered line on sm+ without clipping) */}
          <div className="mt-3.5 sm:mt-5 flex items-center justify-start sm:justify-center sm:flex-wrap gap-2 overflow-x-auto sm:overflow-visible snap-x snap-mandatory no-scrollbar py-0.5">
            {PLATFORM_PAGE_KEYS.filter((pKey) => isPlatformSupported(pKey)).map(
              (pKey) => {
                const pInfo = bundle.platforms[pKey];
                const isSelected =
                  pageKey === pKey || detected.platform === pKey;
                const href = getLocalizedPagePath(language, pKey);
                return (
                  <a
                    key={pKey}
                    href={href}
                    data-testid={`chip-${pKey}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigatePage(pKey);
                    }}
                    className={`snap-start shrink-0 min-h-[44px] px-3 sm:px-3.5 py-2 rounded-xl font-mono text-xs transition-all duration-200 whitespace-nowrap inline-flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-orange-600 text-white font-bold border border-orange-600 shadow-orange-sm'
                        : 'bg-white dark:bg-[#1c140e] border border-orange-200/90 dark:border-orange-900/60 text-orange-900 dark:text-orange-200/85 font-medium shadow-sm hover:border-orange-400 hover:shadow-orange-sm'
                    }`}
                  >
                    <PlatformIcon
                      platform={pKey}
                      className="w-3.5 h-3.5 shrink-0"
                    />
                    <span>{pInfo.shortLabel}</span>
                  </a>
                );
              }
            )}
            <div className="snap-start shrink-0">
              <ShareButton pageKey={pageKey} language={language} />
            </div>
          </div>

          {/* Quick Sample Test Links with localized human-friendly labels */}
          <div className="mt-2.5 sm:mt-3 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
            <span className="text-xs text-orange-900/70 dark:text-orange-200/70 font-medium">
              {t.trySampleLabel}
            </span>
            {SAMPLE_LINKS.filter((s) => isPlatformSupported(s.platform)).map(
              (sample) => {
                const localizedLabel =
                  t.samples?.[sample.labelKey] || sample.label;
                return (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => handleSampleClick(sample)}
                    className="min-h-[36px] font-mono text-xs px-2.5 py-1.5 rounded-lg bg-orange-100/70 dark:bg-[#2a1b12] border border-orange-200/80 dark:border-orange-900/60 hover:bg-orange-500 hover:text-white dark:hover:bg-orange-600 text-orange-900 dark:text-orange-200 font-semibold transition-all shadow-sm whitespace-nowrap cursor-pointer"
                  >
                    {localizedLabel}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* Left Vertical Column Ad (placed AFTER main content in DOM order, visually ordered left on xl+ via xl:order-first) */}
        <div className="hidden xl:block xl:order-first pt-2">
          <AdSlot
            slotId="vidnex-left-column-160x600"
            format="skyscraper"
            language={language}
          />
        </div>

        {/* Right Vertical Column Ad (placed AFTER main content in DOM order, desktop xl+ only) */}
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