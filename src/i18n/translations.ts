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

export function getUiDictionary(lang: LanguageCode): UiDictionary {
  const b = getLocaleBundleSync(lang).ui;
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
      slidesDetected: 'items',
      selectAll: 'Select all',
      deselectAll: 'Deselect all',
      packagingZip: b.drawer.buildingZip,
      downloadSelectedZip: b.drawer.downloadAllZip,
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
