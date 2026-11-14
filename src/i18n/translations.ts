import type { SeoToolConfig } from '../data/seoToolsConfig.ts';
import {
  DEFAULT_LOCALE,
  LOCALES_CONFIG,
  type PlatformPageKey,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from './config.ts';
import { getLocaleBundleSync } from './localeLoader.ts';

export type LanguageCode = SupportedLocale;

export const DEFAULT_LANGUAGE: LanguageCode = DEFAULT_LOCALE;

export interface LanguageOption {
  code: LanguageCode;
  shortLabel: string;
  nativeName: string;
  dir: 'ltr' | 'rtl';
  urlPrefix: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = SUPPORTED_LOCALES.map(
  (code) => {
    const meta = LOCALES_CONFIG[code];
    return {
      code: meta.code,
      shortLabel: meta.shortLabel,
      nativeName: meta.nativeName,
      dir: meta.dir,
      urlPrefix: meta.urlPrefix,
    };
  }
);

export interface UiDictionary {
  header: {
    suiteBadge: string;
    noWmBadge: string;
    shortsBadge: string;
    morePlatforms: string;
    extendedPlatforms: string;
    languageLabel: string;
    switchThemeLight: string;
    switchThemeDark: string;
  };
  omnibox: {
    endpointPrefix: string;
    modeLabel: string;
    sourceUrlLabel: string;
    awaitingValidUrl: string;
    readyForPrefix: string;
    techSpecsStrip: string;
    pasteBtn: string;
    pastedFeedback: string;
    emptyClipboard: string;
    clearInputAria: string;
    downloadBtn: string;
    extractingBtn: string;
    dismissBtn: string;
    trySampleLabel: string;
    errEmptyInput: string;
    errInvalidUrl: string;
    errClipboardBlocked: string;
  };
  drawer: {
    resolvingStream: string;
    bypassingWatermark: string;
    extractionInterrupted: string;
    closeEsc: string;
    retryExtraction: string;
    dismiss: string;
    streamReady: string;
    clearResult: string;
    noWatermarkBadge: string;
    streamCodec: string;
    duration: string;
    sourceWatermark: string;
    stripped: string;
    startingStream: string;
    saving: string;
    downloadHd1080: string;
    downloadSd720: string;
    extractAudioMp3: string;
    originalJpglBadge: string;
    resetViewBtn: string;
    hdZoomBtn: string;
    originalCdnAsset: string;
    followers: string;
    standard1to1: string;
    zoom100Hd: string;
    nativeDimensions: string;
    colorProfile: string;
    srgbUncompressed: string;
    fileSize: string;
    fetchingOriginalJpg: string;
    downloadFullSizePhoto: string;
    slidesDetected: string;
    selectAll: string;
    deselectAll: string;
    packagingZip: string;
    downloadSelectedZip: string;
    downloadSelection: string;
    downloadItem: string;
    selectedCount: string;
    photoType: string;
    videoType: string;
    activeStoriesSubtitle: string;
    profilePhotoBadge: string;
    linkedStoryBadge: string;
    limitMaxItems: string;
    limitMaxSize: string;
    progressFetching: string;
    progressZipping: string;
    progressDone: string;
    checkboxAria: string;
    iosFilesHint: string;
  };
  sections: {
    workflowProtocol: string;
    howToHeading: string;
    schemaValidated: string;
    stepOf: string;
    readyStatus: string;
    archSpecs: string;
    techMatrixHeading: string;
    losslessPipeline: string;
    knowledgeBase: string;
    faqHeading: string;
    entriesCount: string;
    siloDirectoryHeading: string;
    specializedEndpoints: string;
    bentoCards: Array<{
      id: string;
      metric: string;
      title: string;
      description?: string;
      specs?: string[];
    }>;
  };
}

export interface SelectionUiDictionary {
  slidesDetected: string;
  selectAll: string;
  deselectAll: string;
  downloadSelection: string;
  downloadItem: string;
  selectedCount: string;
  photoType: string;
  videoType: string;
  activeStoriesSubtitle: string;
  profilePhotoBadge: string;
  linkedStoryBadge: string;
  limitMaxItems: string;
  limitMaxSize: string;
  progressFetching: string;
  progressZipping: string;
  progressDone: string;
  checkboxAria: string;
}

export const SELECTION_UI_TEXTS: Record<LanguageCode, SelectionUiDictionary> = {
  fr: {
    slidesDetected: 'éléments détectés',
    selectAll: 'Tout sélectionner',
    deselectAll: 'Tout désélectionner',
    downloadSelection: 'Télécharger la sélection',
    downloadItem: 'Télécharger',
    selectedCount: '{selected} / {total} sélectionné(s)',
    photoType: 'Photo',
    videoType: 'Vidéo',
    activeStoriesSubtitle: 'Stories actives de ce compte',
    profilePhotoBadge: 'Photo de profil',
    linkedStoryBadge: 'Story du lien',
    limitMaxItems:
      'Limite atteinte : 20 éléments ou 100 Mo maximum par téléchargement groupé (ZIP).',
    limitMaxSize:
      'Taille maximale dépassée : la sélection dépasse 100 Mo (20 éléments ou 100 Mo maximum).',
    progressFetching: 'Récupération de l’élément {current} sur {total}…',
    progressZipping: 'Assemblage du fichier ZIP ({count} éléments)…',
    progressDone: 'Téléchargement de la sélection prêt ({count} élément(s)).',
    checkboxAria: 'Sélectionner l’élément #{index} ({type}, {quality})',
  },
  en: {
    slidesDetected: 'items found',
    selectAll: 'Select all',
    deselectAll: 'Deselect all',
    downloadSelection: 'Download selection',
    downloadItem: 'Download',
    selectedCount: '{selected} / {total} selected',
    photoType: 'Photo',
    videoType: 'Video',
    activeStoriesSubtitle: 'Active stories from this account',
    profilePhotoBadge: 'Profile photo',
    linkedStoryBadge: 'Linked story',
    limitMaxItems:
      'Limit reached: 20 items or 100 MB maximum per batch ZIP download.',
    limitMaxSize:
      'Maximum size exceeded: selection exceeds 100 MB (20 items or 100 MB max).',
    progressFetching: 'Fetching item {current} of {total}…',
    progressZipping: 'Building ZIP archive ({count} items)…',
    progressDone: 'Selection download ready ({count} item(s)).',
    checkboxAria: 'Select item #{index} ({type}, {quality})',
  },
  ar: {
    slidesDetected: 'عناصر تم العثور عليها',
    selectAll: 'تحديد الكل',
    deselectAll: 'إلغاء تحديد الكل',
    downloadSelection: 'تنزيل المحدد',
    downloadItem: 'تنزيل',
    selectedCount: 'تم تحديد {selected} من {total}',
    photoType: 'صورة',
    videoType: 'فيديو',
    activeStoriesSubtitle: 'القصص النشطة لهذا الحساب',
    profilePhotoBadge: 'صورة الملف الشخصي',
    linkedStoryBadge: 'قصة الرابط',
    limitMaxItems:
      'تم الوصول إلى الحد الأقصى: 20 عنصراً أو 100 ميجابايت كحد أقصى لكل تنزيل ZIP.',
    limitMaxSize:
      'تم تجاوز الحجم الأقصى: التحديد يتجاوز 100 ميجابايت (الحد الأقصى 20 عنصراً أو 100 ميجابايت).',
    progressFetching: 'جاري جلب العنصر {current} من {total}…',
    progressZipping: 'جاري تجميع ملف ZIP ({count} عناصر)…',
    progressDone: 'اكتمل تجهيز التنزيل ({count} عنصر).',
    checkboxAria: 'تحديد العنصر #{index} ({type}، {quality})',
  },
  es: {
    slidesDetected: 'elementos encontrados',
    selectAll: 'Seleccionar todo',
    deselectAll: 'Deseleccionar todo',
    downloadSelection: 'Descargar selección',
    downloadItem: 'Descargar',
    selectedCount: '{selected} / {total} seleccionados',
    photoType: 'Foto',
    videoType: 'Vídeo',
    activeStoriesSubtitle: 'Historias activas de esta cuenta',
    profilePhotoBadge: 'Foto de perfil',
    linkedStoryBadge: 'Historia del enlace',
    limitMaxItems:
      'Límite alcanzado: máximo 20 elementos o 100 MB por descarga ZIP.',
    limitMaxSize:
      'Tamaño máximo superado: la selección supera los 100 MB (máximo 20 elementos o 100 MB).',
    progressFetching: 'Obteniendo elemento {current} de {total}…',
    progressZipping: 'Creando archivo ZIP ({count} elementos)…',
    progressDone: 'Descarga de la selección lista ({count} elemento(s)).',
    checkboxAria: 'Seleccionar elemento #{index} ({type}, {quality})',
  },
  pt: {
    slidesDetected: 'itens encontrados',
    selectAll: 'Selecionar tudo',
    deselectAll: 'Desmarcar tudo',
    downloadSelection: 'Baixar seleção',
    downloadItem: 'Baixar',
    selectedCount: '{selected} / {total} selecionados',
    photoType: 'Foto',
    videoType: 'Vídeo',
    activeStoriesSubtitle: 'Stories ativos desta conta',
    profilePhotoBadge: 'Foto de perfil',
    linkedStoryBadge: 'Story do link',
    limitMaxItems:
      'Limite atingido: máximo de 20 itens ou 100 MB por download ZIP.',
    limitMaxSize:
      'Tamanho máximo excedido: a seleção ultrapassa 100 MB (máximo de 20 itens ou 100 MB).',
    progressFetching: 'Obtendo item {current} de {total}…',
    progressZipping: 'Montando arquivo ZIP ({count} itens)…',
    progressDone: 'Download da seleção pronto ({count} item(ns)).',
    checkboxAria: 'Selecionar item #{index} ({type}, {quality})',
  },
  de: {
    slidesDetected: 'Elemente gefunden',
    selectAll: 'Alle auswählen',
    deselectAll: 'Auswahl aufheben',
    downloadSelection: 'Auswahl herunterladen',
    downloadItem: 'Herunterladen',
    selectedCount: '{selected} / {total} ausgewählt',
    photoType: 'Foto',
    videoType: 'Video',
    activeStoriesSubtitle: 'Aktive Stories dieses Kontos',
    profilePhotoBadge: 'Profilbild',
    linkedStoryBadge: 'Verlinkte Story',
    limitMaxItems:
      'Limit erreicht: maximal 20 Elemente oder 100 MB pro ZIP-Download.',
    limitMaxSize:
      'Maximale Größe überschritten: Die Auswahl überschreitet 100 MB (maximal 20 Elemente oder 100 MB).',
    progressFetching: 'Element {current} von {total} wird geladen…',
    progressZipping: 'ZIP-Archiv wird erstellt ({count} Elemente)…',
    progressDone: 'Auswahl-Download bereit ({count} Element(e)).',
    checkboxAria: 'Element #{index} auswählen ({type}, {quality})',
  },
  tr: {
    slidesDetected: 'öğe bulundu',
    selectAll: 'Tümünü seç',
    deselectAll: 'Seçimi kaldır',
    downloadSelection: 'Seçimi indir',
    downloadItem: 'İndir',
    selectedCount: '{selected} / {total} seçildi',
    photoType: 'Fotoğraf',
    videoType: 'Video',
    activeStoriesSubtitle: 'Bu hesabın aktif hikayeleri',
    profilePhotoBadge: 'Profil fotoğrafı',
    linkedStoryBadge: 'Bağlantıdaki hikaye',
    limitMaxItems:
      'Sınıra ulaşıldı: toplu ZIP indirmesi başına en fazla 20 öğe veya 100 MB.',
    limitMaxSize:
      'Maksimum boyut aşıldı: seçim 100 MB sınırını aşıyor (en fazla 20 öğe veya 100 MB).',
    progressFetching: 'Öğe {current} / {total} alınıyor…',
    progressZipping: 'ZIP arşivi hazırlanıyor ({count} öğe)…',
    progressDone: 'Seçim indirmesi hazır ({count} öğe).',
    checkboxAria: 'Öğe #{index} seç ({type}, {quality})',
  },
  id: {
    slidesDetected: 'item ditemukan',
    selectAll: 'Pilih semua',
    deselectAll: 'Batalkan pilihan',
    downloadSelection: 'Unduh pilihan',
    downloadItem: 'Unduh',
    selectedCount: '{selected} / {total} dipilih',
    photoType: 'Foto',
    videoType: 'Video',
    activeStoriesSubtitle: 'Story aktif dari akun ini',
    profilePhotoBadge: 'Foto profil',
    linkedStoryBadge: 'Story tautan',
    limitMaxItems:
      'Batas tercapai: maksimal 20 item atau 100 MB per unduhan ZIP.',
    limitMaxSize:
      'Ukuran maksimum terlampaui: pilihan melebihi 100 MB (maksimal 20 item atau 100 MB).',
    progressFetching: 'Mengambil item {current} dari {total}…',
    progressZipping: 'Merakit arsip ZIP ({count} item)…',
    progressDone: 'Unduhan pilihan siap ({count} item).',
    checkboxAria: 'Pilih item #{index} ({type}, {quality})',
  },
  it: {
    slidesDetected: 'elementi trovati',
    selectAll: 'Seleziona tutto',
    deselectAll: 'Deseleziona tutto',
    downloadSelection: 'Scarica selezione',
    downloadItem: 'Scarica',
    selectedCount: '{selected} / {total} selezionati',
    photoType: 'Foto',
    videoType: 'Video',
    activeStoriesSubtitle: 'Storie attive di questo account',
    profilePhotoBadge: 'Foto profilo',
    linkedStoryBadge: 'Storia del link',
    limitMaxItems:
      'Limite raggiunto: massimo 20 elementi o 100 MB per download ZIP.',
    limitMaxSize:
      'Dimensione massima superata: la selezione supera 100 MB (massimo 20 elementi o 100 MB).',
    progressFetching: 'Recupero elemento {current} di {total}…',
    progressZipping: 'Creazione archivio ZIP ({count} elementi)…',
    progressDone: 'Download selezione pronto ({count} elemento/i).',
    checkboxAria: 'Seleziona elemento #{index} ({type}, {quality})',
  },
  ru: {
    slidesDetected: 'элементов найдено',
    selectAll: 'Выбрать все',
    deselectAll: 'Снять выделение',
    downloadSelection: 'Скачать выбранное',
    downloadItem: 'Скачать',
    selectedCount: 'Выбрано {selected} из {total}',
    photoType: 'Фото',
    videoType: 'Видео',
    activeStoriesSubtitle: 'Активные истории этого аккаунта',
    profilePhotoBadge: 'Фото профиля',
    linkedStoryBadge: 'История из ссылки',
    limitMaxItems:
      'Достигнут лимит: максимум 20 элементов или 100 МБ для одного ZIP-архива.',
    limitMaxSize:
      'Превышен максимальный размер: выбор превышает 100 МБ (максимум 20 элементов или 100 МБ).',
    progressFetching: 'Загрузка элемента {current} из {total}…',
    progressZipping: 'Сборка ZIP-архива ({count} эл.)…',
    progressDone: 'Скачивание выбранного готово ({count} эл.).',
    checkboxAria: 'Выбрать элемент #{index} ({type}, {quality})',
  },
};

export function getSelectionUiDictionary(
  lang: LanguageCode
): SelectionUiDictionary {
  return SELECTION_UI_TEXTS[lang] || SELECTION_UI_TEXTS.fr;
}

export function getUiDictionary(lang: LanguageCode): UiDictionary {
  const b = getLocaleBundleSync(lang).ui;
  const sel = getSelectionUiDictionary(lang);
  return {
    header: {
      suiteBadge: 'Suite',
      noWmBadge: b.drawer.noWatermarkBadge,
      shortsBadge: 'HD',
      morePlatforms: b.nav.morePlatforms,
      extendedPlatforms: b.nav.morePlatforms,
      languageLabel: b.nav.languageLabel,
      switchThemeLight: b.nav.switchToLight,
      switchThemeDark: b.nav.switchToDark,
    },
    omnibox: {
      endpointPrefix: 'VIDNEX',
      modeLabel: 'MODE:',
      sourceUrlLabel: b.omnibox.inputAriaLabel,
      awaitingValidUrl: b.omnibox.inputAriaLabel,
      readyForPrefix: b.sections.readyStatus,
      techSpecsStrip: 'MP4 / JPG / MP3',
      pasteBtn: b.omnibox.pasteButton,
      pastedFeedback: b.omnibox.pastedFeedback,
      emptyClipboard: '—',
      clearInputAria: b.omnibox.clearInputAria,
      downloadBtn: b.omnibox.downloadButton,
      extractingBtn: b.omnibox.extractingButton,
      dismissBtn: b.drawer.dismiss,
      trySampleLabel: b.omnibox.trySampleLabel,
      errEmptyInput: b.omnibox.errEmptyInput,
      errInvalidUrl: b.omnibox.errInvalidUrl,
      errClipboardBlocked: b.omnibox.errClipboardBlocked,
    },
    drawer: {
      resolvingStream: b.drawer.resolvingStream,
      bypassingWatermark: b.drawer.bypassingWatermark,
      extractionInterrupted: b.drawer.extractionInterrupted,
      closeEsc: b.drawer.dismiss,
      retryExtraction: b.drawer.retryExtraction,
      dismiss: b.drawer.dismiss,
      streamReady: b.sections.readyStatus,
      clearResult: b.drawer.clearResult,
      noWatermarkBadge: b.drawer.noWatermarkBadge,
      streamCodec: 'MP4',
      duration: 'DURATION',
      sourceWatermark: b.drawer.noWatermarkBadge,
      stripped: 'OK',
      startingStream: b.drawer.startingStream,
      saving: b.drawer.saving,
      downloadHd1080: b.drawer.downloadHdMp4,
      downloadSd720: b.drawer.downloadSdMp4,
      extractAudioMp3: b.drawer.extractAudioMp3,
      originalJpglBadge: b.drawer.originalJpgBadge,
      resetViewBtn: '1:1',
      hdZoomBtn: b.drawer.viewFullSizeDp,
      originalCdnAsset: b.drawer.originalJpgBadge,
      followers: '',
      standard1to1: '1:1',
      zoom100Hd: b.drawer.viewFullSizeDp,
      nativeDimensions: 'HD',
      colorProfile: 'sRGB',
      srgbUncompressed: 'sRGB',
      fileSize: 'SIZE',
      fetchingOriginalJpg: b.drawer.saving,
      downloadFullSizePhoto: b.drawer.downloadHdJpg,
      slidesDetected: sel.slidesDetected,
      selectAll: sel.selectAll,
      deselectAll: sel.deselectAll,
      packagingZip: b.drawer.buildingZip,
      downloadSelectedZip: sel.downloadSelection,
      downloadSelection: sel.downloadSelection,
      downloadItem: sel.downloadItem,
      selectedCount: sel.selectedCount,
      photoType: sel.photoType,
      videoType: sel.videoType,
      activeStoriesSubtitle: sel.activeStoriesSubtitle,
      profilePhotoBadge: sel.profilePhotoBadge,
      linkedStoryBadge: sel.linkedStoryBadge,
      limitMaxItems: sel.limitMaxItems,
      limitMaxSize: sel.limitMaxSize,
      progressFetching: sel.progressFetching,
      progressZipping: sel.progressZipping,
      progressDone: sel.progressDone,
      checkboxAria: sel.checkboxAria,
      iosFilesHint: b.drawer.iosFilesHint,
    },
    sections: {
      workflowProtocol: b.sections.workflowProtocol,
      howToHeading: b.sections.howToHeading,
      schemaValidated: 'SCHEMA.ORG',
      stepOf: b.sections.stepOf,
      readyStatus: b.sections.readyStatus,
      archSpecs: b.sections.platformsHeading,
      techMatrixHeading: b.sections.platformsHeading,
      losslessPipeline: 'VIDNEX',
      knowledgeBase: b.sections.knowledgeBase,
      faqHeading: b.sections.faqHeading,
      entriesCount: 'FAQ',
      siloDirectoryHeading: b.sections.platformsHeading,
      specializedEndpoints: b.sections.platformsSubheading,
      bentoCards: b.sections.bentoCards,
    },
  };
}

export const UI_TRANSLATIONS: Record<LanguageCode, UiDictionary> = new Proxy(
  {} as Record<LanguageCode, UiDictionary>,
  {
    get(_target, prop: string) {
      const code = (
        SUPPORTED_LOCALES.includes(prop as SupportedLocale)
          ? prop
          : DEFAULT_LOCALE
      ) as SupportedLocale;
      return getUiDictionary(code);
    },
  }
);

function mapToolPlatformToPageKey(platform: string): PlatformPageKey {
  if (platform === 'tiktok') return 'tiktok';
  if (platform === 'instagram') return 'instagram';
  if (platform === 'x' || platform === 'twitter') return 'x';
  if (platform === 'facebook') return 'facebook';
  if (platform === 'linkedin') return 'linkedin';
  return 'tiktok';
}

export function getLocalizedToolConfig(
  baseConfig: SeoToolConfig,
  lang: LanguageCode
): SeoToolConfig {
  const bundle = getLocaleBundleSync(lang);
  const pKey = mapToolPlatformToPageKey(baseConfig.platform);
  const pContent = bundle.platforms[pKey];
  if (!pContent) {
    return baseConfig;
  }
  return {
    ...baseConfig,
    shortLabel: pContent.shortLabel,
    h1: pContent.h1,
    subtitle: pContent.subtitle,
    placeholder: pContent.placeholder,
    specs: pContent.specs,
    metaTitle: pContent.metaTitle,
    metaDescription: pContent.metaDescription,
    howToSteps: pContent.howToSteps as unknown as SeoToolConfig['howToSteps'],
    faqs: pContent.faqs,
  };
}

export {
  parsePathname,
  buildLocalizedPath,
  handleLegacyQueryRedirect,
  isSupportedLanguage,
  isValidToolSlug,
} from '../utils/i18nRouting.ts';
