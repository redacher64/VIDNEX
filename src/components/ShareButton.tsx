import React, { useState, useRef, useEffect } from 'react';
import type { PlatformPageKey, SupportedLocale } from '../i18n/config.ts';
import {
  buildSocialShareUrls,
  type ShareUrls,
} from '../i18n/hreflang.ts';
import { getLocaleBundleSync } from '../i18n/localeLoader.ts';

export { buildSocialShareUrls, type ShareUrls };

interface ShareButtonProps {
  pageKey: 'home' | PlatformPageKey;
  language: SupportedLocale;
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  pageKey,
  language,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const bundle = getLocaleBundleSync(language);
  const s = bundle.ui.share;
  const pageData =
    pageKey === 'home' ? bundle.home : bundle.platforms[pageKey];
  const shareTitle = pageData.ogTitle || pageData.metaTitle;
  const shareDesc = pageData.ogDescription || pageData.metaDescription;
  const urls = buildSocialShareUrls(language, pageKey);

  useEffect(() => {
    setIsOpen(false);
    setCopied(false);
  }, [pageKey, language]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handlePrimaryClick = async () => {
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function'
    ) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareDesc,
          url: urls.canonicalUrl,
        });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        // Fall through to popover menu if native share fails
      }
    }
    setIsOpen((prev) => !prev);
  };

  const handleCopyCanonical = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(urls.canonicalUrl);
      } else {
        const ta = document.createElement('textarea');
        ta.value = urls.canonicalUrl;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const socialNetworks = [
    {
      id: 'whatsapp',
      label: s.whatsapp,
      href: urls.whatsapp,
      badge: 'WA',
    },
    {
      id: 'telegram',
      label: s.telegram,
      href: urls.telegram,
      badge: 'TG',
    },
    {
      id: 'facebook',
      label: s.facebook,
      href: urls.facebook,
      badge: 'FB',
    },
    {
      id: 'x',
      label: s.x,
      href: urls.x,
      badge: 'X',
    },
  ];

  return (
    <div ref={containerRef} className="relative inline-block text-start">
      <button
        type="button"
        onClick={handlePrimaryClick}
        aria-label={s.buttonAria}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="min-h-[44px] px-3.5 py-2 rounded-xl font-mono text-xs transition-all duration-200 whitespace-nowrap inline-flex items-center gap-1.5 bg-orange-50/90 dark:bg-[#2a1b12] border border-orange-300/90 dark:border-orange-800/80 text-orange-950 dark:text-orange-100 font-semibold shadow-sm hover:border-orange-500 hover:bg-orange-100 dark:hover:bg-orange-950 cursor-pointer"
      >
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          className="w-3.5 h-3.5 text-orange-600 dark:text-amber-400"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        <span>{s.buttonLabel}</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={s.menuTitle}
          className="absolute z-50 bottom-full mb-2.5 end-0 w-60 rounded-2xl bg-white dark:bg-[#1c140e] border-2 border-orange-200 dark:border-orange-800/80 shadow-2xl p-2.5"
        >
          <div className="px-2.5 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-orange-800 dark:text-amber-400 border-b border-orange-100 dark:border-orange-900/50 mb-1.5">
            {s.menuTitle}
          </div>

          <div className="space-y-1">
            {socialNetworks.map((net) => (
              <a
                key={net.id}
                role="menuitem"
                href={net.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.shareOnAria.replace('{network}', net.label)}
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono font-semibold text-[#1f130b] dark:text-[#fffaf5] hover:bg-orange-50 dark:hover:bg-[#2a1b12] transition-colors"
              >
                <span>{net.label}</span>
                <span className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950/70 text-[10px] font-bold text-orange-700 dark:text-amber-400">
                  {net.badge}
                </span>
              </a>
            ))}

            <button
              type="button"
              role="menuitem"
              onClick={handleCopyCanonical}
              aria-label={s.copyLink}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono font-bold text-orange-950 dark:text-orange-100 bg-orange-50/80 dark:bg-[#2a1b12] hover:bg-orange-100 dark:hover:bg-orange-950/80 border border-orange-200/70 dark:border-orange-800/60 transition-colors mt-1"
            >
              <span>{copied ? s.copied : s.copyLink}</span>
              <span className="text-[11px] text-orange-600 dark:text-amber-400">
                {copied ? '✓' : '⧉'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
