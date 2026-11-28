import React, { useEffect, useState } from 'react';
import {
  getLocalizedPagePath,
  LEGAL_PAGE_KEYS,
  type LegalPageKey,
  PLATFORM_PAGE_KEYS,
  type PlatformPageKey,
  type SupportedLocale,
} from '../i18n/config.ts';
import {
  getLegalDocSync,
  getLocaleBundleSync,
} from '../i18n/localeLoader.ts';
import { getSplitImageContent } from '../utils/splitImageLogic.ts';
import { PlatformIcon } from './icons/PlatformIcons.tsx';
import { TurnstileWidget } from './TurnstileWidget.tsx';
import { getSecurityFormCopy } from '../utils/securityFormCopy.ts';
import {
  getPublicConfigSnapshot,
  subscribePublicConfig,
} from '../services/adsenseService.ts';

interface LegalPageViewProps {
  legalKey: LegalPageKey;
  locale: SupportedLocale;
  onNavigatePage: (
    pageKey: LegalPageKey | PlatformPageKey | 'split_image' | 'home'
  ) => void;
  onNavigatePath?: (path: string) => void;
}

const INLINE_TOKEN_REGEX =
  /(\[[^\]]+\]\(\/[a-z0-9/_-]+\)|compliance@vidnex\.space)/gi;

function renderInlineLegalText(
  text: string,
  onNavigatePath?: (path: string) => void
): React.ReactNode {
  const parts = text.split(INLINE_TOKEN_REGEX);
  if (parts.length === 1) {
    return text;
  }

  return parts.map((part, idx) => {
    if (!part) return null;

    if (part.toLowerCase() === 'compliance@vidnex.space') {
      return (
        <a
          key={idx}
          href="mailto:compliance@vidnex.space"
          className="font-mono font-semibold text-orange-700 dark:text-amber-400 underline decoration-orange-400/70 underline-offset-2 hover:text-orange-600 dark:hover:text-amber-300 transition-colors"
        >
          compliance@vidnex.space
        </a>
      );
    }

    const mdMatch = part.match(/^\[([^\]]+)\]\((\/[a-z0-9/_-]+)\)$/i);
    if (mdMatch) {
      const label = mdMatch[1];
      const href = mdMatch[2];
      return (
        <a
          key={idx}
          href={href}
          onClick={(e) => {
            if (onNavigatePath) {
              e.preventDefault();
              onNavigatePath(href);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          className="font-semibold text-orange-700 dark:text-amber-400 underline decoration-orange-400/70 underline-offset-2 hover:text-orange-600 dark:hover:text-amber-300 transition-colors"
        >
          {label}
        </a>
      );
    }

    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const LegalPageView: React.FC<LegalPageViewProps> = ({
  legalKey,
  locale,
  onNavigatePage,
  onNavigatePath,
}) => {
  const bundle = getLocaleBundleSync(locale);
  const legalDoc = getLegalDocSync(locale, legalKey);

  const homeHref = getLocalizedPagePath(locale, 'home');
  const splitImageHref = getLocalizedPagePath(locale, 'split_image');
  const splitImageData = getSplitImageContent(locale);

  const isInteractiveForm = legalKey === 'contact' || legalKey === 'dmca';
  const formCopy = getSecurityFormCopy(locale);

  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string>(() => {
    const cfg = getPublicConfigSnapshot();
    return cfg.turnstile_enabled ? cfg.turnstile_site_key || '' : '';
  });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formFeedback, setFormFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    setFormFeedback(null);
    return subscribePublicConfig((cfg) => {
      setTurnstileSiteKey(
        cfg.turnstile_enabled ? cfg.turnstile_site_key || '' : ''
      );
    });
  }, [legalKey]);

  const handleLegalFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !isInteractiveForm) return;

    if (turnstileSiteKey.trim() && !turnstileToken) {
      setFormFeedback({ type: 'error', text: formCopy.turnstileRequired });
      return;
    }

    setSubmitting(true);
    setFormFeedback(null);
    const endpoint = legalKey === 'dmca' ? '/api/dmca' : '/api/contact';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(turnstileToken ? { 'X-Turnstile-Token': turnstileToken } : {}),
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: legalKey === 'contact' ? subject.trim() : undefined,
          targetUrl: legalKey === 'dmca' ? targetUrl.trim() : undefined,
          message: message.trim(),
          website: honeypot,
          ...(turnstileToken ? { 'cf-turnstile-response': turnstileToken } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setFormFeedback({
          type: 'error',
          text: data?.error?.message || formCopy.genericError,
        });
        return;
      }

      setName('');
      setEmail('');
      setSubject('');
      setTargetUrl('');
      setMessage('');
      setHoneypot('');
      setFormFeedback({ type: 'success', text: formCopy.successMessage });
    } catch {
      setFormFeedback({ type: 'error', text: formCopy.genericError });
    } finally {
      setSubmitting(false);
      setTurnstileResetKey((k) => k + 1);
    }
  };

  return (
    <section className="w-full py-10 sm:py-14 bg-[#fffaf5] dark:bg-[#140e0a]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Visible Breadcrumb with real <a href> links */}
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex flex-wrap items-center gap-2 text-xs font-mono text-[#6c4e40] dark:text-orange-200/75"
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
            {legalDoc?.breadcrumbLabel || bundle.ui.footer[legalKey]}
          </span>
        </nav>

        {/* Legal Navigation Pills */}
        <div className="mb-8 flex flex-wrap items-center gap-2">
          {LEGAL_PAGE_KEYS.map((k) => {
            const isActive = k === legalKey;
            const href = getLocalizedPagePath(locale, k);
            const label = bundle.ui.footer[k];
            return (
              <a
                key={k}
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigatePage(k);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'bg-white dark:bg-[#1c140e] border border-orange-200/80 dark:border-orange-900/60 text-[#6c4e40] dark:text-orange-200/80 hover:border-orange-400'
                }`}
              >
                {label}
              </a>
            );
          })}
        </div>

        {/* Main Content Card */}
        {legalDoc ? (
          <article className="bg-white/95 dark:bg-[#1c140e]/95 rounded-3xl border border-orange-200/90 dark:border-orange-900/60 p-6 sm:p-10 shadow-card-warm space-y-6">
            <header className="border-b border-orange-200/70 dark:border-orange-900/50 pb-6">
              <span className="inline-block font-mono text-[11px] font-bold uppercase tracking-wider text-orange-700 dark:text-amber-400 mb-2">
                VIDNEX · {legalDoc.updatedAt}
              </span>
              <h1 className="font-display text-2xl sm:text-4xl font-bold text-[#1f130b] dark:text-[#fffaf5]">
                {legalDoc.h1}
              </h1>
              <p className="mt-3 text-sm sm:text-base text-[#6c4e40] dark:text-orange-200/85 leading-relaxed">
                {renderInlineLegalText(legalDoc.intro, onNavigatePath)}
              </p>
            </header>

            <div className="space-y-6">
              {legalDoc.sections.map((sec) => (
                <section key={sec.heading} className="space-y-3">
                  <h2 className="font-display text-lg sm:text-xl font-bold text-[#1f130b] dark:text-[#fffaf5]">
                    {sec.heading}
                  </h2>
                  {sec.paragraphs.map((p, idx) => (
                    <p
                      key={idx}
                      className="text-sm sm:text-base text-[#6c4e40] dark:text-orange-200/80 leading-relaxed"
                    >
                      {renderInlineLegalText(p, onNavigatePath)}
                    </p>
                  ))}
                </section>
              ))}
            </div>
          </article>
        ) : (
          <article
            aria-busy="true"
            className="bg-white/95 dark:bg-[#1c140e]/95 rounded-3xl border border-orange-200/90 dark:border-orange-900/60 p-6 sm:p-10 shadow-card-warm space-y-4 animate-pulse"
          >
            <div className="h-4 w-36 rounded bg-orange-200/60 dark:bg-orange-900/40" />
            <div className="h-8 w-2/3 rounded bg-orange-200/70 dark:bg-orange-900/50" />
            <div className="h-4 w-full rounded bg-orange-100/70 dark:bg-orange-900/30" />
            <div className="h-4 w-5/6 rounded bg-orange-100/70 dark:bg-orange-900/30" />
          </article>
        )}

        {/* Interactive Protected Form for Contact & DMCA (Turnstile + Honeypot + 3/h rate limit) */}
        {isInteractiveForm && (
          <section
            aria-label={legalKey === 'dmca' ? formCopy.dmcaTitle : formCopy.contactTitle}
            className="mt-8 bg-white/95 dark:bg-[#1c140e]/95 rounded-3xl border border-orange-200/90 dark:border-orange-900/60 p-6 sm:p-8 shadow-card-warm"
          >
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#1f130b] dark:text-[#fffaf5]">
              {legalKey === 'dmca' ? formCopy.dmcaTitle : formCopy.contactTitle}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-[#6c4e40] dark:text-orange-200/75">
              {legalKey === 'dmca' ? formCopy.dmcaSubtitle : formCopy.contactSubtitle}
            </p>

            {formFeedback && (
              <div
                role={formFeedback.type === 'error' ? 'alert' : 'status'}
                className={`mt-4 p-3.5 rounded-xl border text-xs sm:text-sm font-medium ${
                  formFeedback.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
                }`}
              >
                {formFeedback.text}
              </div>
            )}

            <form onSubmit={handleLegalFormSubmit} className="mt-5 space-y-4 relative">
              {/* Honeypot invisible : ne jamais remplir par un humain */}
              <div
                aria-hidden="true"
                className="absolute -left-[9999px] w-px h-px overflow-hidden opacity-0 pointer-events-none"
              >
                <label htmlFor={`hp-${legalKey}`}>Website</label>
                <input
                  id={`hp-${legalKey}`}
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor={`legal-form-name-${legalKey}`}
                    className="block text-xs font-semibold text-[#1f130b] dark:text-orange-100 mb-1.5"
                  >
                    {formCopy.nameLabel}
                  </label>
                  <input
                    id={`legal-form-name-${legalKey}`}
                    type="text"
                    required
                    minLength={2}
                    maxLength={120}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#fffaf5] dark:bg-[#140e0a] border border-orange-200 dark:border-orange-900/70 text-sm text-[#1f130b] dark:text-[#fffaf5] focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`legal-form-email-${legalKey}`}
                    className="block text-xs font-semibold text-[#1f130b] dark:text-orange-100 mb-1.5"
                  >
                    {formCopy.emailLabel}
                  </label>
                  <input
                    id={`legal-form-email-${legalKey}`}
                    type="email"
                    required
                    maxLength={160}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#fffaf5] dark:bg-[#140e0a] border border-orange-200 dark:border-orange-900/70 text-sm text-[#1f130b] dark:text-[#fffaf5] focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {legalKey === 'contact' ? (
                <div>
                  <label
                    htmlFor="legal-form-subject"
                    className="block text-xs font-semibold text-[#1f130b] dark:text-orange-100 mb-1.5"
                  >
                    {formCopy.subjectLabel}
                  </label>
                  <input
                    id="legal-form-subject"
                    type="text"
                    maxLength={160}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#fffaf5] dark:bg-[#140e0a] border border-orange-200 dark:border-orange-900/70 text-sm text-[#1f130b] dark:text-[#fffaf5] focus:outline-none focus:border-orange-500"
                  />
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="legal-form-target-url"
                    className="block text-xs font-semibold text-[#1f130b] dark:text-orange-100 mb-1.5"
                  >
                    {formCopy.targetUrlLabel}
                  </label>
                  <input
                    id="legal-form-target-url"
                    type="url"
                    required
                    maxLength={2048}
                    placeholder="https://..."
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#fffaf5] dark:bg-[#140e0a] border border-orange-200 dark:border-orange-900/70 text-sm font-mono text-[#1f130b] dark:text-[#fffaf5] focus:outline-none focus:border-orange-500"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor={`legal-form-message-${legalKey}`}
                  className="block text-xs font-semibold text-[#1f130b] dark:text-orange-100 mb-1.5"
                >
                  {formCopy.messageLabel}
                </label>
                <textarea
                  id={`legal-form-message-${legalKey}`}
                  required
                  minLength={10}
                  maxLength={4000}
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#fffaf5] dark:bg-[#140e0a] border border-orange-200 dark:border-orange-900/70 text-sm text-[#1f130b] dark:text-[#fffaf5] focus:outline-none focus:border-orange-500"
                />
              </div>

              {turnstileSiteKey.trim() && (
                <TurnstileWidget
                  siteKey={turnstileSiteKey}
                  action={legalKey}
                  resetKey={turnstileResetKey}
                  onTokenChange={setTurnstileToken}
                />
              )}

              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 disabled:opacity-60 text-white font-mono text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer"
              >
                {submitting ? formCopy.submittingLabel : formCopy.submitLabel}
              </button>
            </form>
          </section>
        )}

        {/* Internal Links to the 5 Platform Tools + Split Image Tool */}
        <div className="mt-10">
          <h2 className="font-display text-lg font-bold text-[#1f130b] dark:text-[#fffaf5] mb-4">
            {bundle.ui.footer.platformsTitle}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PLATFORM_PAGE_KEYS.map((pKey) => {
              const pData = bundle.platforms[pKey];
              const pHref = getLocalizedPagePath(locale, pKey);
              return (
                <a
                  key={pKey}
                  href={pHref}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigatePage(pKey);
                  }}
                  className="p-4 rounded-2xl bg-white dark:bg-[#1c140e] border border-orange-200/80 dark:border-orange-900/60 hover:border-orange-500 transition-all flex items-center justify-between gap-2 group"
                >
                  <span className="flex items-center gap-2 font-display text-sm font-bold text-[#1f130b] dark:text-[#fffaf5]">
                    <span className="text-orange-600 dark:text-amber-400">
                      <PlatformIcon platform={pKey} className="w-4 h-4" />
                    </span>
                    <span>{pData.shortLabel}</span>
                  </span>
                  <span className="text-orange-600 dark:text-amber-400 font-mono text-xs font-bold rtl:rotate-180 transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </a>
              );
            })}
            <a
              href={splitImageHref}
              onClick={(e) => {
                e.preventDefault();
                onNavigatePage('split_image');
              }}
              className="p-4 rounded-2xl bg-white dark:bg-[#1c140e] border border-orange-200/80 dark:border-orange-900/60 hover:border-orange-500 transition-all flex items-center justify-between gap-2 group"
            >
              <span className="flex items-center gap-2 font-display text-sm font-bold text-[#1f130b] dark:text-[#fffaf5]">
                <span className="text-orange-600 dark:text-amber-400 font-mono text-xs font-extrabold">
                  ⊞
                </span>
                <span>{splitImageData.breadcrumbLabel}</span>
              </span>
              <span className="text-orange-600 dark:text-amber-400 font-mono text-xs font-bold rtl:rotate-180 transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
