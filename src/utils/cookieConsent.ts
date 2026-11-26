import type { SupportedLocale } from '../i18n/config.ts';

export const COOKIE_CONSENT_VERSION = 1 as const;
export const COOKIE_CONSENT_STORAGE_KEY = 'vidnex_cookie_consent_v1';

export interface CookieConsentState {
  version: typeof COOKIE_CONSENT_VERSION;
  essential: true;
  analytics: boolean;
  advertising: boolean;
  updatedAt: string;
}

export interface CookieConsentChoices {
  analytics: boolean;
  advertising: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

let cachedConsent: CookieConsentState | null | undefined = undefined;
const consentListeners = new Set<(state: CookieConsentState | null) => void>();
const openPrefsListeners = new Set<() => void>();

function getDefaultStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function parseCookieConsent(raw: string | null): CookieConsentState | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CookieConsentState> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== COOKIE_CONSENT_VERSION) return null;
    if (typeof parsed.analytics !== 'boolean' || typeof parsed.advertising !== 'boolean') {
      return null;
    }
    return {
      version: COOKIE_CONSENT_VERSION,
      essential: true,
      analytics: parsed.analytics,
      advertising: parsed.advertising,
      updatedAt:
        typeof parsed.updatedAt === 'string' && parsed.updatedAt.length > 0
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function readCookieConsent(storage?: StorageLike | null): CookieConsentState | null {
  const store = storage === undefined ? getDefaultStorage() : storage;
  if (!store) return null;
  try {
    return parseCookieConsent(store.getItem(COOKIE_CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function getCookieConsentSnapshot(): CookieConsentState | null {
  if (typeof window === 'undefined') return null;
  if (cachedConsent === undefined) {
    cachedConsent = readCookieConsent();
  }
  return cachedConsent;
}

export function hasAdvertisingConsent(storage?: StorageLike | null): boolean {
  if (storage !== undefined) {
    return Boolean(readCookieConsent(storage)?.advertising);
  }
  return Boolean(getCookieConsentSnapshot()?.advertising);
}

export function hasAnalyticsConsent(storage?: StorageLike | null): boolean {
  if (storage !== undefined) {
    return Boolean(readCookieConsent(storage)?.analytics);
  }
  return Boolean(getCookieConsentSnapshot()?.analytics);
}

export function saveCookieConsent(
  choices: CookieConsentChoices,
  storage?: StorageLike | null
): CookieConsentState {
  const next: CookieConsentState = {
    version: COOKIE_CONSENT_VERSION,
    essential: true,
    analytics: Boolean(choices.analytics),
    advertising: Boolean(choices.advertising),
    updatedAt: new Date().toISOString(),
  };

  const store = storage === undefined ? getDefaultStorage() : storage;
  if (store) {
    try {
      store.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota / private mode errors
    }
  }

  if (storage === undefined) {
    cachedConsent = next;
    for (const listener of consentListeners) {
      try {
        listener(next);
      } catch {
        // Ignore subscriber errors
      }
    }
  }

  return next;
}

export function subscribeCookieConsent(
  listener: (state: CookieConsentState | null) => void
): () => void {
  consentListeners.add(listener);
  return () => {
    consentListeners.delete(listener);
  };
}

export function openCookiePreferences(): void {
  for (const listener of openPrefsListeners) {
    try {
      listener();
    } catch {
      // Ignore subscriber errors
    }
  }
}

export function subscribeOpenCookiePreferences(listener: () => void): () => void {
  openPrefsListeners.add(listener);
  return () => {
    openPrefsListeners.delete(listener);
  };
}

export function resetCookieConsentCacheForTests(): void {
  cachedConsent = undefined;
  consentListeners.clear();
  openPrefsListeners.clear();
}

export interface CookieBannerLocaleCopy {
  footerLinkLabel: string;
  bannerAriaLabel: string;
  bannerText: string;
  privacyLinkLabel: string;
  acceptAll: string;
  rejectAll: string;
  customize: string;
  modalTitle: string;
  modalDescription: string;
  saveChoices: string;
  closeLabel: string;
  alwaysActive: string;
  categories: {
    essential: { title: string; description: string };
    analytics: { title: string; description: string };
    advertising: { title: string; description: string };
  };
}

export const COOKIE_CONSENT_COPY: Record<SupportedLocale, CookieBannerLocaleCopy> = {
  fr: {
    footerLinkLabel: 'Cookies',
    bannerAriaLabel: 'Gestion des cookies',
    bannerText:
      'Nous utilisons des cookies essentiels et, avec votre accord, des statistiques et de la publicité pour garder VIDNEX gratuit.',
    privacyLinkLabel: 'Confidentialité',
    acceptAll: 'Tout accepter',
    rejectAll: 'Tout refuser',
    customize: 'Personnaliser',
    modalTitle: 'Préférences cookies',
    modalDescription:
      'Choisissez les catégories autorisées. Vous pouvez modifier ce choix à tout moment via le lien « Cookies » en pied de page.',
    saveChoices: 'Enregistrer',
    closeLabel: 'Fermer',
    alwaysActive: 'Toujours actif',
    categories: {
      essential: {
        title: 'Essentiels',
        description:
          'Indispensables au fonctionnement du site (langue, thème, mémorisation de ce choix et sécurité).',
      },
      analytics: {
        title: 'Statistiques',
        description:
          'Mesure d’audience légère sans cookie tiers pour suivre la fréquentation globale et améliorer les outils.',
      },
      advertising: {
        title: 'Publicité',
        description:
          'Bannières et unités publicitaires Adsterra / Google AdSense permettant de financer le service gratuit.',
      },
    },
  },
  en: {
    footerLinkLabel: 'Cookies',
    bannerAriaLabel: 'Cookie consent',
    bannerText:
      'We use essential cookies and, with your consent, statistics and advertising to keep VIDNEX free.',
    privacyLinkLabel: 'Privacy',
    acceptAll: 'Accept all',
    rejectAll: 'Reject all',
    customize: 'Customize',
    modalTitle: 'Cookie preferences',
    modalDescription:
      'Choose which categories to allow. You can update your choice anytime via the "Cookies" link in the footer.',
    saveChoices: 'Save choices',
    closeLabel: 'Close',
    alwaysActive: 'Always active',
    categories: {
      essential: {
        title: 'Essential',
        description:
          'Required for core site functionality (language, theme, saving this preference, and abuse protection).',
      },
      analytics: {
        title: 'Statistics',
        description:
          'Lightweight cookie-free visit metrics to understand overall traffic and improve our tools.',
      },
      advertising: {
        title: 'Advertising',
        description:
          'Adsterra and Google AdSense ad units that help keep VIDNEX free to use.',
      },
    },
  },
  ar: {
    footerLinkLabel: 'ملفات تعريف الارتباط',
    bannerAriaLabel: 'إعدادات ملفات تعريف الارتباط',
    bannerText:
      'نستخدم ملفات تعريف ارتباط أساسية، وبموافقتك إحصاءات وإعلانات لإبقاء VIDNEX مجانياً.',
    privacyLinkLabel: 'الخصوصية',
    acceptAll: 'قبول الكل',
    rejectAll: 'رفض الكل',
    customize: 'تخصيص',
    modalTitle: 'تفضيلات ملفات تعريف الارتباط',
    modalDescription:
      'اختر الفئات المسموح بها. يمكنك تعديل اختيارك في أي وقت من رابط «ملفات تعريف الارتباط» أسفل الصفحة.',
    saveChoices: 'حفظ الاختيارات',
    closeLabel: 'إغلاق',
    alwaysActive: 'مفعّل دائماً',
    categories: {
      essential: {
        title: 'الأساسية',
        description:
          'ضرورية لعمل الموقع (اللغة، المظهر، حفظ هذا الاختيار والحماية من إساءة الاستخدام).',
      },
      analytics: {
        title: 'الإحصاءات',
        description:
          'قياس زيارات خفيف بدون ملفات تتبع لمعرفة الاستخدام العام وتحسين الأدوات.',
      },
      advertising: {
        title: 'الإعلانات',
        description:
          'وحدات Adsterra وGoogle AdSense الإعلانية التي تساعد في تمويل الخدمة المجانية.',
      },
    },
  },
  es: {
    footerLinkLabel: 'Cookies',
    bannerAriaLabel: 'Consentimiento de cookies',
    bannerText:
      'Usamos cookies esenciales y, con tu permiso, estadísticas y publicidad para mantener VIDNEX gratuito.',
    privacyLinkLabel: 'Privacidad',
    acceptAll: 'Aceptar todo',
    rejectAll: 'Rechazar todo',
    customize: 'Personalizar',
    modalTitle: 'Preferencias de cookies',
    modalDescription:
      'Elige qué categorías permitir. Puedes cambiar tu decisión en cualquier momento desde «Cookies» en el pie de página.',
    saveChoices: 'Guardar',
    closeLabel: 'Cerrar',
    alwaysActive: 'Siempre activo',
    categories: {
      essential: {
        title: 'Esenciales',
        description:
          'Necesarias para el funcionamiento básico (idioma, tema, guardar esta elección y seguridad).',
      },
      analytics: {
        title: 'Estadísticas',
        description:
          'Medición ligera de visitas sin cookies de terceros para entender el tráfico general y mejorar el servicio.',
      },
      advertising: {
        title: 'Publicidad',
        description:
          'Anuncios de Adsterra y Google AdSense que financian el acceso gratuito a VIDNEX.',
      },
    },
  },
  pt: {
    footerLinkLabel: 'Cookies',
    bannerAriaLabel: 'Consentimento de cookies',
    bannerText:
      'Usamos cookies essenciais e, com o seu consentimento, estatísticas e publicidade para manter o VIDNEX gratuito.',
    privacyLinkLabel: 'Privacidade',
    acceptAll: 'Aceitar tudo',
    rejectAll: 'Recusar tudo',
    customize: 'Personalizar',
    modalTitle: 'Preferências de cookies',
    modalDescription:
      'Escolha quais categorias permitir. Você pode alterar sua escolha a qualquer momento pelo link "Cookies" no rodapé.',
    saveChoices: 'Salvar',
    closeLabel: 'Fechar',
    alwaysActive: 'Sempre ativo',
    categories: {
      essential: {
        title: 'Essenciais',
        description:
          'Necessários para o funcionamento do site (idioma, tema, salvar esta escolha e segurança).',
      },
      analytics: {
        title: 'Estatísticas',
        description:
          'Medição leve de visitas sem cookies de terceiros para acompanhar o tráfego global e melhorar as ferramentas.',
      },
      advertising: {
        title: 'Publicidade',
        description:
          'Unidades de anúncio Adsterra e Google AdSense que ajudam a manter o serviço gratuito.',
      },
    },
  },
  de: {
    footerLinkLabel: 'Cookies',
    bannerAriaLabel: 'Cookie-Einstellungen',
    bannerText:
      'Wir verwenden essenzielle Cookies sowie mit Ihrer Zustimmung Statistiken und Werbung, um VIDNEX kostenlos anzubieten.',
    privacyLinkLabel: 'Datenschutz',
    acceptAll: 'Alle akzeptieren',
    rejectAll: 'Alle ablehnen',
    customize: 'Anpassen',
    modalTitle: 'Cookie-Einstellungen',
    modalDescription:
      'Wählen Sie die gewünschten Kategorien. Sie können Ihre Auswahl jederzeit über „Cookies“ im Footer ändern.',
    saveChoices: 'Speichern',
    closeLabel: 'Schließen',
    alwaysActive: 'Immer aktiv',
    categories: {
      essential: {
        title: 'Essenziell',
        description:
          'Erforderlich für Grundfunktionen (Sprache, Design, Speicherung dieser Auswahl und Missbrauchsschutz).',
      },
      analytics: {
        title: 'Statistiken',
        description:
          'Leichtgewichtige, cookiefreie Besuchszählung zur Verbesserung unserer Werkzeuge.',
      },
      advertising: {
        title: 'Werbung',
        description:
          'Werbeeinheiten von Adsterra und Google AdSense zur Finanzierung des kostenlosen Angebots.',
      },
    },
  },
  tr: {
    footerLinkLabel: 'Çerezler',
    bannerAriaLabel: 'Çerez onayı',
    bannerText:
      'VIDNEX’i ücretsiz tutmak için zorunlu çerezler ve onayınızla istatistik ve reklam teknolojileri kullanıyoruz.',
    privacyLinkLabel: 'Gizlilik',
    acceptAll: 'Tümünü kabul et',
    rejectAll: 'Tümünü reddet',
    customize: 'Özelleştir',
    modalTitle: 'Çerez tercihleri',
    modalDescription:
      'İzin vermek istediğiniz kategorileri seçin. Seçiminizi alt bilgideki «Çerezler» bağlantısından dilediğiniz zaman değiştirebilirsiniz.',
    saveChoices: 'Kaydet',
    closeLabel: 'Kapat',
    alwaysActive: 'Her zaman aktif',
    categories: {
      essential: {
        title: 'Zorunlu',
        description:
          'Temel site işlevleri için gereklidir (dil, tema, bu tercihin kaydı ve güvenlik).',
      },
      analytics: {
        title: 'İstatistikler',
        description:
          'Genel trafiği anlamak ve araçları geliştirmek için çerezsiz hafif ziyaret ölçümü.',
      },
      advertising: {
        title: 'Reklam',
        description:
          'Ücretsiz hizmeti finanse etmeye yardımcı olan Adsterra ve Google AdSense reklam birimleri.',
      },
    },
  },
  id: {
    footerLinkLabel: 'Cookie',
    bannerAriaLabel: 'Persetujuan cookie',
    bannerText:
      'Kami menggunakan cookie esensial serta, dengan persetujuan Anda, statistik dan iklan agar VIDNEX tetap gratis.',
    privacyLinkLabel: 'Privasi',
    acceptAll: 'Terima semua',
    rejectAll: 'Tolak semua',
    customize: 'Sesuaikan',
    modalTitle: 'Preferensi cookie',
    modalDescription:
      'Pilih kategori yang diizinkan. Anda dapat mengubah pilihan kapan saja melalui tautan "Cookie" di footer.',
    saveChoices: 'Simpan',
    closeLabel: 'Tutup',
    alwaysActive: 'Selalu aktif',
    categories: {
      essential: {
        title: 'Esensial',
        description:
          'Diperlukan untuk fungsi utama situs (bahasa, tema, penyimpanan pilihan ini, dan keamanan).',
      },
      analytics: {
        title: 'Statistik',
        description:
          'Pengukuran kunjungan ringan tanpa cookie pihak ketiga untuk memahami trafik dan meningkatkan alat.',
      },
      advertising: {
        title: 'Iklan',
        description:
          'Unit iklan Adsterra dan Google AdSense yang membantu menjaga layanan tetap gratis.',
      },
    },
  },
  it: {
    footerLinkLabel: 'Cookies',
    bannerAriaLabel: 'Consenso ai cookie',
    bannerText:
      'Usiamo cookie essenziali e, con il tuo consenso, statistiche e pubblicità per mantenere VIDNEX gratuito.',
    privacyLinkLabel: 'Privacy',
    acceptAll: 'Accetta tutto',
    rejectAll: 'Rifiuta tutto',
    customize: 'Personalizza',
    modalTitle: 'Preferenze cookie',
    modalDescription:
      'Scegli quali categorie autorizzare. Puoi modificare la scelta in qualsiasi momento dal link «Cookies» nel footer.',
    saveChoices: 'Salva',
    closeLabel: 'Chiudi',
    alwaysActive: 'Sempre attivo',
    categories: {
      essential: {
        title: 'Essenziali',
        description:
          'Necessari al funzionamento del sito (lingua, tema, salvataggio di questa scelta e sicurezza).',
      },
      analytics: {
        title: 'Statistiche',
        description:
          'Misurazione leggera delle visite senza cookie di terze parti per migliorare gli strumenti.',
      },
      advertising: {
        title: 'Pubblicità',
        description:
          'Spazi pubblicitari Adsterra e Google AdSense che finanziano il servizio gratuito.',
      },
    },
  },
  ru: {
    footerLinkLabel: 'Cookies',
    bannerAriaLabel: 'Настройки cookies',
    bannerText:
      'Мы используем обязательные файлы cookie, а с вашего согласия — статистику и рекламу, чтобы VIDNEX оставался бесплатным.',
    privacyLinkLabel: 'Конфиденциальность',
    acceptAll: 'Принять все',
    rejectAll: 'Отклонить все',
    customize: 'Настроить',
    modalTitle: 'Настройки cookies',
    modalDescription:
      'Выберите разрешённые категории. Изменить выбор можно в любой момент по ссылке «Cookies» в подвале сайта.',
    saveChoices: 'Сохранить',
    closeLabel: 'Закрыть',
    alwaysActive: 'Всегда активно',
    categories: {
      essential: {
        title: 'Обязательные',
        description:
          'Необходимы для работы сайта (язык, тема, сохранение этого выбора и защита от злоупотреблений).',
      },
      analytics: {
        title: 'Статистика',
        description:
          'Лёгкий подсчёт посещений без сторонних cookie для анализа трафика и улучшения инструментов.',
      },
      advertising: {
        title: 'Реклама',
        description:
          'Рекламные блоки Adsterra и Google AdSense, поддерживающие бесплатную работу сервиса.',
      },
    },
  },
};

export function getCookieConsentCopy(locale: SupportedLocale): CookieBannerLocaleCopy {
  return COOKIE_CONSENT_COPY[locale] || COOKIE_CONSENT_COPY.fr;
}
