import type { SupportedLocale } from '../i18n/config.ts';

export interface SecurityFormCopy {
  contactTitle: string;
  contactSubtitle: string;
  dmcaTitle: string;
  dmcaSubtitle: string;
  nameLabel: string;
  emailLabel: string;
  subjectLabel: string;
  targetUrlLabel: string;
  messageLabel: string;
  submitLabel: string;
  submittingLabel: string;
  successMessage: string;
  turnstileRequired: string;
  genericError: string;
}

const FR_COPY: SecurityFormCopy = {
  contactTitle: 'Envoyer un message',
  contactSubtitle: 'Formulaire protégé contre le spam (max 3 envois / heure).',
  dmcaTitle: 'Soumettre une demande DMCA',
  dmcaSubtitle: 'Indiquez l’URL publique exacte à bloquer (max 3 envois / heure).',
  nameLabel: 'Nom ou entité',
  emailLabel: 'Adresse e-mail',
  subjectLabel: 'Objet (optionnel)',
  targetUrlLabel: 'URL publique à bloquer',
  messageLabel: 'Message détaillé',
  submitLabel: 'Envoyer la demande',
  submittingLabel: 'Envoi en cours…',
  successMessage: 'Votre demande a bien été enregistrée.',
  turnstileRequired: 'Veuillez valider la vérification anti-bot avant d’envoyer.',
  genericError: 'Impossible d’envoyer le formulaire. Vérifiez vos champs et réessayez.',
};

const EN_COPY: SecurityFormCopy = {
  contactTitle: 'Send a message',
  contactSubtitle: 'Spam-protected form (max 3 submissions / hour).',
  dmcaTitle: 'Submit a DMCA Takedown Request',
  dmcaSubtitle: 'Provide the exact public URL to restrict (max 3 submissions / hour).',
  nameLabel: 'Name or organization',
  emailLabel: 'Email address',
  subjectLabel: 'Subject (optional)',
  targetUrlLabel: 'Public URL to block',
  messageLabel: 'Detailed message',
  submitLabel: 'Submit request',
  submittingLabel: 'Submitting…',
  successMessage: 'Your request has been recorded.',
  turnstileRequired: 'Please complete the anti-bot check before submitting.',
  genericError: 'Unable to submit form. Please check your inputs and try again.',
};

const LOCALE_FORM_COPIES: Partial<Record<SupportedLocale, SecurityFormCopy>> = {
  fr: FR_COPY,
  en: EN_COPY,
};

export function getSecurityFormCopy(locale: SupportedLocale): SecurityFormCopy {
  return LOCALE_FORM_COPIES[locale] || EN_COPY;
}

const TURNSTILE_PROMPT: Record<SupportedLocale, string> = {
  fr: 'Veuillez valider la vérification anti-bot Turnstile.',
  en: 'Please complete the Turnstile anti-bot check.',
  ar: 'يرجى إتمام التحقق الأمني Turnstile.',
  es: 'Completa la verificación anti-bots Turnstile.',
  pt: 'Conclua a verificação anti-bot Turnstile.',
  de: 'Bitte schließen Sie die Turnstile-Prüfung ab.',
  tr: 'Lütfen Turnstile doğrulamasını tamamlayın.',
  id: 'Silakan selesaikan verifikasi Turnstile.',
  it: 'Completa la verifica anti-bot Turnstile.',
  ru: 'Пожалуйста, пройдите проверку Turnstile.',
};

export function getTurnstileRequiredPrompt(locale: SupportedLocale): string {
  return TURNSTILE_PROMPT[locale] || TURNSTILE_PROMPT.fr;
}
