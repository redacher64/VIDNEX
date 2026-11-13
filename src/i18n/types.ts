import type {
  LegalPageKey,
  PlatformPageKey,
  SupportedLocale,
} from './config.ts';

export interface HowToStepItem {
  number: string;
  title: string;
  description: string;
  codeHint: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface EditorialBlock {
  heading: string;
  subheading: string;
  paragraphs: string[];
  formatsTitle: string;
  formatsList: string[];
  limitsTitle: string;
  limitsText: string;
}

export interface PlatformPageContent {
  slug: string;
  metaTitle: string;
  metaDescription: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageAlt: string;
  h1: string;
  subtitle: string;
  shortLabel: string;
  breadcrumbLabel: string;
  placeholder: string;
  specs: [string, string, string, string];
  editorial: EditorialBlock;
  howToSteps: [HowToStepItem, HowToStepItem, HowToStepItem];
  faqs: FaqItem[];
}

export interface HomePageContent {
  metaTitle: string;
  metaDescription: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageAlt: string;
  h1: string;
  subtitle: string;
  placeholder: string;
  specs: [string, string, string, string];
  editorial: EditorialBlock;
  howToSteps: [HowToStepItem, HowToStepItem, HowToStepItem];
  faqs: FaqItem[];
}

export interface LegalPageSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalPageContent {
  metaTitle: string;
  metaDescription: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageAlt: string;
  h1: string;
  breadcrumbLabel: string;
  updatedAt: string;
  intro: string;
  sections: LegalPageSection[];
}

export interface ShareUiDictionary {
  buttonLabel: string;
  buttonAria: string;
  menuTitle: string;
  whatsapp: string;
  telegram: string;
  facebook: string;
  x: string;
  copyLink: string;
  copied: string;
  shareOnAria: string;
}

export interface ErrorMessagesDictionary {
  UNSUPPORTED_URL: string;
  NOT_FOUND: string;
  PRIVATE_OR_LOGIN_REQUIRED: string;
  IG_STORY_LOGIN_REQUIRED?: string;
  FB_STORY_LOGIN_REQUIRED?: string;
  BLOCKED_BY_PLATFORM: string;
  TIMEOUT: string;
  NO_MEDIA: string;
  MAINTENANCE: string;
  PLATFORM_DISABLED: string;
  BLOCKED: string;
  RATE_LIMITED: string;
  NETWORK_ERROR: string;
}

export interface LocaleBundle {
  locale: SupportedLocale;
  ui: {
    nav: {
      home: string;
      tiktok: string;
      instagram: string;
      x: string;
      facebook: string;
      linkedin: string;
      morePlatforms: string;
      soonBadge: string;
      languageLabel: string;
      switchToDark: string;
      switchToLight: string;
    };
    omnibox: {
      inputAriaLabel: string;
      pasteButton: string;
      pastedFeedback: string;
      clearInputAria: string;
      downloadButton: string;
      extractingButton: string;
      trySampleLabel: string;
      errEmptyInput: string;
      errInvalidUrl: string;
      errClipboardBlocked: string;
      comingSoonNotice: string;
      samples: {
        igReel: string;
        tiktokVid: string;
        xVid: string;
        fbVid: string;
        igDp: string;
        linkedinDp: string;
      };
    };
    drawer: {
      bypassingWatermark: string;
      resolvingStream: string;
      extractionInterrupted: string;
      retryExtraction: string;
      dismiss: string;
      clearResult: string;
      noWatermarkBadge: string;
      originalJpgBadge: string;
      startingStream: string;
      saving: string;
      downloadHdMp4: string;
      downloadSdMp4: string;
      extractAudioMp3: string;
      downloadAllZip: string;
      buildingZip: string;
      viewFullSizeDp: string;
      downloadHdJpg: string;
      iosFilesHint: string;
    };
    sections: {
      bentoCards: [
        { id: string; metric: string; title: string },
        { id: string; metric: string; title: string },
        { id: string; metric: string; title: string },
        { id: string; metric: string; title: string }
      ];
      workflowProtocol: string;
      howToHeading: string;
      stepOf: string;
      readyStatus: string;
      platformsHeading: string;
      platformsSubheading: string;
      openToolCta: string;
      knowledgeBase: string;
      faqHeading: string;
      breadcrumbHome: string;
    };
    footer: {
      platformsTitle: string;
      legalTitle: string;
      languagesTitle: string;
      about: string;
      privacy: string;
      terms: string;
      contact: string;
      dmca: string;
      copyrightNotice: string;
    };
    banner: {
      suggestText: string;
      switchCta: string;
      dismissAria: string;
    };
    share: ShareUiDictionary;
    notFound: {
      title: string;
      heading: string;
      description: string;
      backHomeCta: string;
      tryPlatformsLabel: string;
    };
    errors: ErrorMessagesDictionary;
  };
  home: HomePageContent;
  platforms: Record<PlatformPageKey, PlatformPageContent>;
  legal?: Record<LegalPageKey, LegalPageContent>;
}
