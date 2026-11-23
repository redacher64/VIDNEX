import {
  getLocalizedPagePath,
  type PageKey,
  type SupportedLocale,
} from '../i18n/config.ts';
import { getLocaleBundleSync } from '../i18n/localeLoader.ts';
import { getSplitImageContent } from '../utils/splitImageLogic.ts';
import { getVideoToMp3Content } from '../utils/videoToMp3Logic.ts';

export type RegisteredToolCategory = 'video' | 'image' | 'downloader';

export interface RegisteredToolEntry {
  id:
    | 'video_to_mp3'
    | 'split_image'
    | 'tiktok'
    | 'instagram'
    | 'x'
    | 'facebook'
    | 'linkedin';
  pageKey: PageKey;
  category: RegisteredToolCategory;
  executionMode: 'browser_local' | 'public_resolver';
  badges: string[];
  featured?: boolean;
}

/**
 * Registre central des outils VIDNEX (outils créateurs 100 % navigateur + téléchargeurs publics).
 */
export const VIDNEX_TOOLS_REGISTRY: readonly RegisteredToolEntry[] = [
  {
    id: 'video_to_mp3',
    pageKey: 'video_to_mp3',
    category: 'video',
    executionMode: 'browser_local',
    badges: ['MP3 128–320 kbps', 'WAV PCM', '100% Local'],
    featured: true,
  },
  {
    id: 'split_image',
    pageKey: 'split_image',
    category: 'image',
    executionMode: 'browser_local',
    badges: ['2×2 / 3×3', 'PNG / JPG / ZIP', '100% Local'],
    featured: true,
  },
  {
    id: 'tiktok',
    pageKey: 'tiktok',
    category: 'downloader',
    executionMode: 'public_resolver',
    badges: ['MP4 HD', 'MP3 / M4A', 'ZIP'],
  },
  {
    id: 'instagram',
    pageKey: 'instagram',
    category: 'downloader',
    executionMode: 'public_resolver',
    badges: ['Reels', 'Carousels', 'Stories'],
  },
  {
    id: 'x',
    pageKey: 'x',
    category: 'downloader',
    executionMode: 'public_resolver',
    badges: ['MP4', 'GIF → MP4', 'HD'],
  },
  {
    id: 'facebook',
    pageKey: 'facebook',
    category: 'downloader',
    executionMode: 'public_resolver',
    badges: ['Reels', 'Watch', 'HD / SD'],
  },
  {
    id: 'linkedin',
    pageKey: 'linkedin',
    category: 'downloader',
    executionMode: 'public_resolver',
    badges: ['Profile HD', 'JPG / PNG'],
  },
] as const;

export interface ToolsHubLocaleContent {
  navLabel: string;
  allToolsLinkLabel: string;
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  ogImageAlt: string;
  breadcrumbLabel: string;
  badgeText: string;
  h1: string;
  subtitle: string;
  filterAll: string;
  filterVideo: string;
  filterImage: string;
  filterDownloader: string;
  browserToolsHeading: string;
  browserToolsSubheading: string;
  downloadersHeading: string;
  downloadersSubheading: string;
  localBadge: string;
  publicBadge: string;
  openToolCta: string;
}

export const TOOLS_HUB_I18N: Record<SupportedLocale, ToolsHubLocaleContent> = {
  fr: {
    navLabel: 'Outils',
    allToolsLinkLabel: 'Tous les outils (/tools)',
    metaTitle: 'Tous les outils créateurs vidéo, audio et image — VIDNEX',
    metaDescription:
      'Explorez tous les outils VIDNEX gratuits : convertisseur Vidéo vers MP3/WAV 100 % navigateur, découpe d’image en grille et téléchargeurs publics.',
    ogTitle: 'Tous les outils créateurs vidéo, audio et image — VIDNEX',
    ogDescription:
      'Explorez tous les outils VIDNEX gratuits : convertisseur Vidéo vers MP3/WAV 100 % navigateur, découpe d’image en grille et téléchargeurs publics.',
    ogImageAlt: 'Hub des outils VIDNEX : Vidéo vers MP3/WAV, découpe d’image et téléchargeurs',
    breadcrumbLabel: 'Outils',
    badgeText: 'BOÎTE À OUTILS CRÉATEURS · GRATUIT · SANS COMPTE',
    h1: 'Boîte à outils VIDNEX',
    subtitle:
      'Accédez à nos outils 100 % locaux côté navigateur (Vidéo → MP3 / WAV, Découper une image) ainsi qu’à nos téléchargeurs de médias publics.',
    filterAll: 'Tous les outils',
    filterVideo: 'Vidéo & Audio',
    filterImage: 'Image',
    filterDownloader: 'Téléchargeurs',
    browserToolsHeading: 'Outils 100 % navigateur (zéro upload serveur)',
    browserToolsSubheading:
      'Traitement local sur votre appareil via Web Audio API, lamejs et HTML5 Canvas.',
    downloadersHeading: 'Téléchargeurs de médias publics',
    downloadersSubheading:
      'Enregistrez des contenus publics depuis TikTok, Instagram, X, Facebook et LinkedIn.',
    localBadge: '100 % Local',
    publicBadge: 'Médias publics',
    openToolCta: 'Ouvrir l’outil',
  },
  en: {
    navLabel: 'Tools',
    allToolsLinkLabel: 'All Tools (/tools)',
    metaTitle: 'All Free Creator Tools (Video, Audio & Image) — VIDNEX',
    metaDescription:
      'Browse all free VIDNEX tools: 100% browser Video to MP3/WAV converter, Instagram grid Image Splitter, and public social media downloaders.',
    ogTitle: 'All Free Creator Tools (Video, Audio & Image) — VIDNEX',
    ogDescription:
      'Browse all free VIDNEX tools: 100% browser Video to MP3/WAV converter, Instagram grid Image Splitter, and public social media downloaders.',
    ogImageAlt: 'VIDNEX Creator Tools Hub for Video to MP3/WAV, Image Splitting, and Downloads',
    breadcrumbLabel: 'Tools',
    badgeText: 'CREATOR TOOLKIT · FREE · NO ACCOUNT REQUIRED',
    h1: 'VIDNEX Creator Tools Hub',
    subtitle:
      'Launch 100% browser-based utilities (Video → MP3 / WAV, Split Image) alongside our public social media downloaders without registration.',
    filterAll: 'All tools',
    filterVideo: 'Video & Audio',
    filterImage: 'Image',
    filterDownloader: 'Downloaders',
    browserToolsHeading: '100% Browser Tools (Zero Server Upload)',
    browserToolsSubheading:
      'Processed locally on your device using Web Audio API, lamejs, and HTML5 Canvas.',
    downloadersHeading: 'Public Media Downloaders',
    downloadersSubheading:
      'Save public media from TikTok, Instagram, X, Facebook, and LinkedIn.',
    localBadge: '100% Local',
    publicBadge: 'Public Media',
    openToolCta: 'Open tool',
  },
  ar: {
    navLabel: 'الأدوات',
    allToolsLinkLabel: 'كل الأدوات (/tools)',
    metaTitle: 'جميع أدوات الفيديو والصوت والصور المجانية — VIDNEX',
    metaDescription:
      'استكشف جميع أدوات VIDNEX المجانية: تحويل الفيديو إلى MP3/WAV في المتصفح، تقسيم الصور إلى شبكة، وأدوات تنزيل الوسائط العامة دون تسجيل.',
    ogTitle: 'جميع أدوات الفيديو والصوت والصور المجانية — VIDNEX',
    ogDescription:
      'استكشف جميع أدوات VIDNEX المجانية: تحويل الفيديو إلى MP3/WAV في المتصفح، تقسيم الصور إلى شبكة، وأدوات تنزيل الوسائط العامة دون تسجيل.',
    ogImageAlt: 'مركز أدوات VIDNEX لتحويل الفيديو إلى MP3 وتقسيم الصور وتنزيل الوسائط',
    breadcrumbLabel: 'الأدوات',
    badgeText: 'مجموعة أدوات صناع المحتوى · مجانية · بدون حساب',
    h1: 'مركز أدوات VIDNEX',
    subtitle:
      'استخدم أدوات المعالجة المحلية 100% داخل المتصفح (فيديو ← MP3/WAV وتقسيم الصور) إلى جانب أدوات تنزيل الوسائط العامة.',
    filterAll: 'كل الأدوات',
    filterVideo: 'فيديو وصوت',
    filterImage: 'صور',
    filterDownloader: 'أدوات التنزيل',
    browserToolsHeading: 'أدوات 100% في المتصفح (بدون رفع للخادم)',
    browserToolsSubheading:
      'معالجة محلية على جهازك عبر Web Audio API وlamejs وHTML5 Canvas.',
    downloadersHeading: 'أدوات تنزيل الوسائط العامة',
    downloadersSubheading:
      'احفظ المنشورات العامة من تيك توك وإنستغرام وإكس وفيسبوك ولينكدإن.',
    localBadge: 'محلي 100%',
    publicBadge: 'وسائط عامة',
    openToolCta: 'فتح الأداة',
  },
  es: {
    navLabel: 'Herramientas',
    allToolsLinkLabel: 'Todas las herramientas (/tools)',
    metaTitle: 'Todas las herramientas de vídeo, audio e imagen — VIDNEX',
    metaDescription:
      'Descubre todas las herramientas gratuitas de VIDNEX: conversor Vídeo a MP3/WAV 100 % en navegador, divisor de imágenes y descargadores públicos.',
    ogTitle: 'Todas las herramientas de vídeo, audio e imagen — VIDNEX',
    ogDescription:
      'Descubre todas las herramientas gratuitas de VIDNEX: conversor Vídeo a MP3/WAV 100 % en navegador, divisor de imágenes y descargadores públicos.',
    ogImageAlt: 'Centro de herramientas VIDNEX para Vídeo a MP3/WAV, imágenes y descargas',
    breadcrumbLabel: 'Herramientas',
    badgeText: 'SUITE PARA CREADORES · GRATIS · SIN CUENTA',
    h1: 'Centro de herramientas VIDNEX',
    subtitle:
      'Accede a nuestras herramientas 100 % locales en el navegador (Vídeo → MP3 / WAV, Dividir imagen) y a los descargadores de medios públicos.',
    filterAll: 'Todas',
    filterVideo: 'Vídeo y Audio',
    filterImage: 'Imagen',
    filterDownloader: 'Descargadores',
    browserToolsHeading: 'Herramientas 100 % navegador (sin subidas)',
    browserToolsSubheading:
      'Procesamiento local en tu dispositivo con Web Audio API, lamejs y HTML5 Canvas.',
    downloadersHeading: 'Descargadores de medios públicos',
    downloadersSubheading:
      'Guarda publicaciones públicas de TikTok, Instagram, X, Facebook y LinkedIn.',
    localBadge: '100 % Local',
    publicBadge: 'Medios públicos',
    openToolCta: 'Abrir herramienta',
  },
  pt: {
    navLabel: 'Ferramentas',
    allToolsLinkLabel: 'Todas as ferramentas (/tools)',
    metaTitle: 'Todas as ferramentas de vídeo, áudio e imagem — VIDNEX',
    metaDescription:
      'Explore todas as ferramentas gratuitas do VIDNEX: conversor Vídeo para MP3/WAV 100% no navegador, divisor de imagens e downloaders públicos.',
    ogTitle: 'Todas as ferramentas de vídeo, áudio e imagem — VIDNEX',
    ogDescription:
      'Explore todas as ferramentas gratuitas do VIDNEX: conversor Vídeo para MP3/WAV 100% no navegador, divisor de imagens e downloaders públicos.',
    ogImageAlt: 'Hub de ferramentas VIDNEX para Vídeo em MP3/WAV, dividir imagem e downloads',
    breadcrumbLabel: 'Ferramentas',
    badgeText: 'KIT PARA CRIADORES · GRÁTIS · SEM CONTA',
    h1: 'Hub de ferramentas VIDNEX',
    subtitle:
      'Use ferramentas 100% locais no navegador (Vídeo → MP3 / WAV, Dividir imagem) e nossos downloaders de mídias públicas sem cadastro.',
    filterAll: 'Todas',
    filterVideo: 'Vídeo e Áudio',
    filterImage: 'Imagem',
    filterDownloader: 'Downloaders',
    browserToolsHeading: 'Ferramentas 100% navegador (zero upload)',
    browserToolsSubheading:
      'Processamento local no seu dispositivo com Web Audio API, lamejs e HTML5 Canvas.',
    downloadersHeading: 'Downloaders de mídias públicas',
    downloadersSubheading:
      'Salve conteúdos públicos do TikTok, Instagram, X, Facebook e LinkedIn.',
    localBadge: '100% Local',
    publicBadge: 'Mídia pública',
    openToolCta: 'Abrir ferramenta',
  },
  de: {
    navLabel: 'Tools',
    allToolsLinkLabel: 'Alle Tools (/tools)',
    metaTitle: 'Alle kostenlosen Video-, Audio- & Bild-Tools — VIDNEX',
    metaDescription:
      'Entdecke alle kostenlosen VIDNEX-Tools: Video-zu-MP3/WAV-Konverter lokal im Browser, Bild-Raster-Teiler und Downloader für öffentliche Medien.',
    ogTitle: 'Alle kostenlosen Video-, Audio- & Bild-Tools — VIDNEX',
    ogDescription:
      'Entdecke alle kostenlosen VIDNEX-Tools: Video-zu-MP3/WAV-Konverter lokal im Browser, Bild-Raster-Teiler und Downloader für öffentliche Medien.',
    ogImageAlt: 'VIDNEX Tools-Übersicht für Video zu MP3/WAV, Bild-Teiler und Downloader',
    breadcrumbLabel: 'Tools',
    badgeText: 'CREATOR-TOOLKIT · KOSTENLOS · OHNE KONTO',
    h1: 'VIDNEX Tools-Übersicht',
    subtitle:
      'Nutze unsere 100 % lokalen Browser-Tools (Video → MP3 / WAV, Bild teilen) sowie unsere Downloader für öffentliche Beiträge ohne Anmeldung.',
    filterAll: 'Alle Tools',
    filterVideo: 'Video & Audio',
    filterImage: 'Bild',
    filterDownloader: 'Downloader',
    browserToolsHeading: '100 % Browser-Tools (kein Server-Upload)',
    browserToolsSubheading:
      'Lokale Verarbeitung auf deinem Gerät per Web Audio API, lamejs und HTML5 Canvas.',
    downloadersHeading: 'Downloader für öffentliche Medien',
    downloadersSubheading:
      'Speichere öffentliche Inhalte von TikTok, Instagram, X, Facebook und LinkedIn.',
    localBadge: '100 % Lokal',
    publicBadge: 'Öffentliche Medien',
    openToolCta: 'Tool öffnen',
  },
  tr: {
    navLabel: 'Araçlar',
    allToolsLinkLabel: 'Tüm Araçlar (/tools)',
    metaTitle: 'Tüm Ücretsiz Video, Ses ve Görsel Araçları — VIDNEX',
    metaDescription:
      'Tüm ücretsiz VIDNEX araçlarını keşfedin: %100 tarayıcı içi Video MP3/WAV dönüştürücü, görsel ızgara bölücü ve herkese açık medya indiriciler.',
    ogTitle: 'Tüm Ücretsiz Video, Ses ve Görsel Araçları — VIDNEX',
    ogDescription:
      'Tüm ücretsiz VIDNEX araçlarını keşfedin: %100 tarayıcı içi Video MP3/WAV dönüştürücü, görsel ızgara bölücü ve herkese açık medya indiriciler.',
    ogImageAlt: 'VIDNEX Araç Merkezi: Video MP3/WAV, görsel bölme ve medya indiriciler',
    breadcrumbLabel: 'Araçlar',
    badgeText: 'İÇERİK ÜRETİCİ ARAÇLARI · ÜCRETSİZ · HESAPSIZ',
    h1: 'VIDNEX Araç Merkezi',
    subtitle:
      'Kayıt olmadan %100 yerel tarayıcı araçlarına (Video → MP3 / WAV, Görsel Böl) ve herkese açık sosyal medya indiricilerine erişin.',
    filterAll: 'Tümü',
    filterVideo: 'Video ve Ses',
    filterImage: 'Görsel',
    filterDownloader: 'İndiriciler',
    browserToolsHeading: '%100 Tarayıcı Araçları (Sunucuya Yükleme Yok)',
    browserToolsSubheading:
      'Web Audio API, lamejs ve HTML5 Canvas ile cihazınızda yerel işlem.',
    downloadersHeading: 'Herkese Açık Medya İndiricileri',
    downloadersSubheading:
      'TikTok, Instagram, X, Facebook ve LinkedIn’deki herkese açık medyaları kaydedin.',
    localBadge: '%100 Yerel',
    publicBadge: 'Herkese açık',
    openToolCta: 'Aracı aç',
  },
  id: {
    navLabel: 'Alat',
    allToolsLinkLabel: 'Semua Alat (/tools)',
    metaTitle: 'Semua Alat Video, Audio & Gambar Gratis — VIDNEX',
    metaDescription:
      'Jelajahi semua alat gratis VIDNEX: konverter Video ke MP3/WAV 100% di browser, pemotong grid gambar, serta pengunduh media publik tanpa akun.',
    ogTitle: 'Semua Alat Video, Audio & Gambar Gratis — VIDNEX',
    ogDescription:
      'Jelajahi semua alat gratis VIDNEX: konverter Video ke MP3/WAV 100% di browser, pemotong grid gambar, serta pengunduh media publik tanpa akun.',
    ogImageAlt: 'Hub Alat VIDNEX untuk Video ke MP3/WAV, Potong Gambar, dan Pengunduh',
    breadcrumbLabel: 'Alat',
    badgeText: 'ALAT KREATOR · GRATIS · TANPA AKUN',
    h1: 'Pusat Alat VIDNEX',
    subtitle:
      'Gunakan alat 100% lokal di browser (Video → MP3 / WAV, Potong Gambar) beserta pengunduh media sosial publik tanpa perlu mendaftar.',
    filterAll: 'Semua alat',
    filterVideo: 'Video & Audio',
    filterImage: 'Gambar',
    filterDownloader: 'Pengunduh',
    browserToolsHeading: 'Alat 100% Browser (Tanpa Upload Server)',
    browserToolsSubheading:
      'Diproses lokal di perangkat Anda lewat Web Audio API, lamejs, dan HTML5 Canvas.',
    downloadersHeading: 'Pengunduh Media Publik',
    downloadersSubheading:
      'Simpan konten publik dari TikTok, Instagram, X, Facebook, dan LinkedIn.',
    localBadge: '100% Lokal',
    publicBadge: 'Media Publik',
    openToolCta: 'Buka alat',
  },
  it: {
    navLabel: 'Strumenti',
    allToolsLinkLabel: 'Tutti gli strumenti (/tools)',
    metaTitle: 'Tutti gli strumenti gratuiti video, audio e foto — VIDNEX',
    metaDescription:
      'Esplora tutti gli strumenti gratuiti VIDNEX: convertitore Video in MP3/WAV 100% nel browser, divisore immagini in griglia e downloader pubblici.',
    ogTitle: 'Tutti gli strumenti gratuiti video, audio e foto — VIDNEX',
    ogDescription:
      'Esplora tutti gli strumenti gratuiti VIDNEX: convertitore Video in MP3/WAV 100% nel browser, divisore immagini in griglia e downloader pubblici.',
    ogImageAlt: 'Hub strumenti VIDNEX per Video in MP3/WAV, griglia foto e downloader',
    breadcrumbLabel: 'Strumenti',
    badgeText: 'SUITE CREATOR · GRATIS · SENZA ACCOUNT',
    h1: 'Hub degli strumenti VIDNEX',
    subtitle:
      'Accedi agli strumenti 100% locali nel browser (Video → MP3 / WAV, Dividi immagine) insieme ai nostri downloader per media pubblici.',
    filterAll: 'Tutti',
    filterVideo: 'Video e Audio',
    filterImage: 'Immagine',
    filterDownloader: 'Downloader',
    browserToolsHeading: 'Strumenti 100% browser (zero upload)',
    browserToolsSubheading:
      'Elaborazione locale sul tuo dispositivo con Web Audio API, lamejs e HTML5 Canvas.',
    downloadersHeading: 'Downloader di media pubblici',
    downloadersSubheading:
      'Salva contenuti pubblici da TikTok, Instagram, X, Facebook e LinkedIn.',
    localBadge: '100% Locale',
    publicBadge: 'Media pubblici',
    openToolCta: 'Apri strumento',
  },
  ru: {
    navLabel: 'Инструменты',
    allToolsLinkLabel: 'Все инструменты (/tools)',
    metaTitle: 'Все бесплатные инструменты для видео и аудио — VIDNEX',
    metaDescription:
      'Все бесплатные инструменты VIDNEX: конвертер Видео в MP3/WAV локально в браузере, нарезка изображений в сетку и загрузчики публичных медиа.',
    ogTitle: 'Все бесплатные инструменты для видео и аудио — VIDNEX',
    ogDescription:
      'Все бесплатные инструменты VIDNEX: конвертер Видео в MP3/WAV локально в браузере, нарезка изображений в сетку и загрузчики публичных медиа.',
    ogImageAlt: 'Центр инструментов VIDNEX: Видео в MP3/WAV, нарезка фото и загрузчики',
    breadcrumbLabel: 'Инструменты',
    badgeText: 'ИНСТРУМЕНТЫ ДЛЯ АВТОРОВ · БЕСПЛАТНО · БЕЗ АККАУНТА',
    h1: 'Центр инструментов VIDNEX',
    subtitle:
      'Используйте локальные браузерные утилиты (Видео → MP3 / WAV, Нарезка изображений) и загрузчики публичных медиа без регистрации.',
    filterAll: 'Все',
    filterVideo: 'Видео и Аудио',
    filterImage: 'Изображения',
    filterDownloader: 'Загрузчики',
    browserToolsHeading: '100% браузерные инструменты (без загрузки на сервер)',
    browserToolsSubheading:
      'Локальная обработка на вашем устройстве через Web Audio API, lamejs и HTML5 Canvas.',
    downloadersHeading: 'Загрузчики публичных медиа',
    downloadersSubheading:
      'Сохраняйте публичные публикации из TikTok, Instagram, X, Facebook и LinkedIn.',
    localBadge: '100% Локально',
    publicBadge: 'Публичные медиа',
    openToolCta: 'Открыть инструмент',
  },
};

export function getToolsHubContent(
  locale: SupportedLocale
): ToolsHubLocaleContent {
  return TOOLS_HUB_I18N[locale] || TOOLS_HUB_I18N.fr;
}

export interface ResolvedToolCard {
  entry: RegisteredToolEntry;
  href: string;
  title: string;
  shortLabel: string;
  description: string;
}

export function getLocalizedRegisteredTools(
  locale: SupportedLocale
): ResolvedToolCard[] {
  const bundle = getLocaleBundleSync(locale);
  const splitCopy = getSplitImageContent(locale);
  const videoCopy = getVideoToMp3Content(locale);

  return VIDNEX_TOOLS_REGISTRY.map((entry) => {
    const href = getLocalizedPagePath(locale, entry.pageKey);
    if (entry.id === 'video_to_mp3') {
      return {
        entry,
        href,
        title: videoCopy.h1,
        shortLabel: videoCopy.breadcrumbLabel,
        description: videoCopy.subtitle,
      };
    }
    if (entry.id === 'split_image') {
      return {
        entry,
        href,
        title: splitCopy.h1,
        shortLabel: splitCopy.breadcrumbLabel,
        description: splitCopy.subtitle,
      };
    }
    const pData = bundle.platforms[entry.id];
    return {
      entry,
      href,
      title: pData.h1,
      shortLabel: pData.shortLabel,
      description: pData.subtitle,
    };
  });
}
