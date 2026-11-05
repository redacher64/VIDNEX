import React, { useEffect } from 'react';
import { APP_DOMAIN, LEGAL_CONTACT_EMAIL } from '../config/appConfig';
import { LanguageCode } from '../i18n/translations';

export type LegalDocType = 'terms' | 'privacy' | 'dmca';

interface LegalModalProps {
  activeDoc: LegalDocType | null;
  onSelectDoc: (doc: LegalDocType) => void;
  onClose: () => void;
  language: LanguageCode;
}

const LEGAL_TAB_LABELS: Record<
  LanguageCode,
  Record<LegalDocType, string> & { closeLabel: string }
> = {
  en: {
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    dmca: 'DMCA / Copyright',
    closeLabel: 'Close',
  },
  fr: {
    terms: 'Conditions',
    privacy: 'Confidentialité',
    dmca: 'DMCA',
    closeLabel: 'Fermer',
  },
  es: {
    terms: 'Términos',
    privacy: 'Privacidad',
    dmca: 'DMCA',
    closeLabel: 'Cerrar',
  },
  pt: {
    terms: 'Termos',
    privacy: 'Privacidade',
    dmca: 'DMCA',
    closeLabel: 'Fechar',
  },
  ar: {
    terms: 'شروط الخدمة',
    privacy: 'سياسة الخصوصية',
    dmca: 'حقوق النشر DMCA',
    closeLabel: 'إغلاق',
  },
};

export const LegalModal: React.FC<LegalModalProps> = ({
  activeDoc,
  onSelectDoc,
  onClose,
  language,
}) => {
  useEffect(() => {
    if (!activeDoc) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDoc, onClose]);

  if (!activeDoc) return null;

  const labels = LEGAL_TAB_LABELS[language] || LEGAL_TAB_LABELS.en;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[82vh] flex flex-col rounded-2xl bg-white dark:bg-zinc-900 border border-orange-200/80 dark:border-orange-950/60 text-[#1f130b] dark:text-[#fffaf5] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-orange-200/80 dark:border-orange-950/60">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(['terms', 'privacy', 'dmca'] as LegalDocType[]).map((docKey) => {
              const isSelected = activeDoc === docKey;
              return (
                <button
                  key={docKey}
                  type="button"
                  onClick={() => onSelectDoc(docKey)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#09090B]'
                      : 'text-[#6c4e40] dark:text-orange-200/70 hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
                  }`}
                >
                  {labels[docKey]}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-xs font-medium text-[#6c4e40] dark:text-orange-200/70 hover:text-[#0F172A] dark:hover:text-[#FAFAFA]"
          >
            {labels.closeLabel}
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
          {activeDoc === 'terms' && (
            <>
              <h2
                id="legal-modal-title"
                className="font-display text-lg font-bold text-[#1f130b] dark:text-[#fffaf5]"
              >
                {labels.terms} — {APP_DOMAIN}
              </h2>
              <p>
                VIDNEX ({APP_DOMAIN}) operates strictly as a client-initiated,
                stateless technical resolver for publicly accessible social
                media URLs. VIDNEX does not host, archive, or redistribute any
                video, audio, or image files on its servers.
              </p>
              <p>
                Users are solely responsible for ensuring they have permission
                to download media from any URL submitted. Private accounts and
                DRM-protected streams are strictly unsupported.
              </p>
            </>
          )}

          {activeDoc === 'privacy' && (
            <>
              <h2
                id="legal-modal-title"
                className="font-display text-lg font-bold text-[#1f130b] dark:text-[#fffaf5]"
              >
                {labels.privacy}
              </h2>
              <p>
                URLs pasted into VIDNEX are processed in volatile memory solely
                to resolve the direct stream for your session. We never log your
                submitted links, social handles, or downloaded files.
              </p>
              <p>
                Browser <code className="font-mono text-xs">localStorage</code>{' '}
                is used exclusively to remember your display language and
                Light/Dark theme preference.
              </p>
            </>
          )}

          {activeDoc === 'dmca' && (
            <>
              <h2
                id="legal-modal-title"
                className="font-display text-lg font-bold text-[#1f130b] dark:text-[#fffaf5]"
              >
                {labels.dmca}
              </h2>
              <p>
                VIDNEX hosts zero media files on its infrastructure. Rights
                holders who wish to block their public @handle or specific URLs
                from being resolved through VIDNEX may contact:
              </p>
              <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-zinc-800 font-mono text-xs text-[#1f130b] dark:text-[#fffaf5]">
                {LEGAL_CONTACT_EMAIL}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};