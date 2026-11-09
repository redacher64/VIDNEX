import type { SeoToolConfig, ToolSlug } from '../data/seoToolsConfig.ts';

export type LanguageCode = 'en' | 'fr' | 'es' | 'pt' | 'ar';

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export interface LanguageOption {
  code: LanguageCode;
  shortLabel: string;
  nativeName: string;
  dir: 'ltr' | 'rtl';
  urlPrefix: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', shortLabel: 'EN', nativeName: 'English', dir: 'ltr', urlPrefix: '' },
  { code: 'fr', shortLabel: 'FR', nativeName: 'Français', dir: 'ltr', urlPrefix: '/fr' },
  { code: 'es', shortLabel: 'ES', nativeName: 'Español', dir: 'ltr', urlPrefix: '/es' },
  { code: 'pt', shortLabel: 'PT', nativeName: 'Português', dir: 'ltr', urlPrefix: '/pt' },
  { code: 'ar', shortLabel: 'AR', nativeName: 'العربية', dir: 'rtl', urlPrefix: '/ar' },
];

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
      description: string;
      specs: string[];
    }>;
  };
}

type LocalizedToolText = Pick<
  SeoToolConfig,
  | 'shortLabel'
  | 'h1'
  | 'subtitle'
  | 'metaTitle'
  | 'metaDescription'
  | 'howToSteps'
  | 'faqs'
>;

export const UI_TRANSLATIONS: Record<LanguageCode, UiDictionary> = {
  /* ==========================================================================
   * ENGLISH (DEFAULT)
   * ======================================================================== */
  en: {
    header: {
      suiteBadge: 'Suite',
      noWmBadge: 'No-WM',
      shortsBadge: 'Shorts/HD',
      morePlatforms: 'More',
      extendedPlatforms: 'Extended Platforms',
      languageLabel: 'Language',
      switchThemeLight: 'Switch to light mode',
      switchThemeDark: 'Switch to dark mode',
    },
    omnibox: {
      endpointPrefix: 'ENDPOINT',
      modeLabel: 'MODE:',
      sourceUrlLabel: 'SOURCE URL',
      awaitingValidUrl: '• Awaiting valid platform URL...',
      readyForPrefix: '• Ready for',
      techSpecsStrip: '1080p • MP4 / JPG / MP3 • No Watermark',
      pasteBtn: 'Paste',
      pastedFeedback: 'Pasted',
      emptyClipboard: 'Empty',
      clearInputAria: 'Clear URL input',
      downloadBtn: 'Download',
      extractingBtn: 'Extracting...',
      dismissBtn: 'DISMISS',
      trySampleLabel: 'Try Sample Link:',
      errEmptyInput: 'Paste a valid media URL or @username to begin extraction.',
      errInvalidUrl:
        'Unrecognized link format. Supported: Instagram, TikTok, YouTube, X, Facebook, Snapchat.',
      errClipboardBlocked:
        'Clipboard permission blocked by browser. Press Ctrl+V / ⌘+V to paste directly.',
    },
    drawer: {
      resolvingStream: 'RESOLVING DIRECT CDN STREAM...',
      bypassingWatermark: 'BYPASSING WATERMARK LAYER',
      extractionInterrupted: 'EXTRACTION INTERRUPTED // STATUS 422',
      closeEsc: 'CLOSE [ESC]',
      retryExtraction: 'Retry Extraction',
      dismiss: 'Dismiss',
      streamReady: 'STREAM READY',
      clearResult: 'CLEAR RESULT',
      noWatermarkBadge: 'NO WATERMARK',
      streamCodec: 'STREAM CODEC',
      duration: 'DURATION',
      sourceWatermark: 'SOURCE WATERMARK',
      stripped: 'STRIPPED',
      startingStream: 'STARTING STREAM...',
      saving: 'SAVING...',
      downloadHd1080: 'Download HD 1080p (No Watermark)',
      downloadSd720: 'Download SD 720p',
      extractAudioMp3: 'Extract Audio (MP3)',
      originalJpglBadge: 'Original JPG',
      resetViewBtn: '[-] RESET 1:1 VIEW',
      hdZoomBtn: '[+] 100% HD ZOOM',
      originalCdnAsset: 'ORIGINAL CDN ASSET',
      followers: 'followers',
      standard1to1: 'Standard 1:1',
      zoom100Hd: '100% HD Zoom',
      nativeDimensions: 'NATIVE DIMENSIONS',
      colorProfile: 'COLOR PROFILE',
      srgbUncompressed: 'sRGB Uncompressed',
      fileSize: 'FILE SIZE',
      fetchingOriginalJpg: 'FETCHING ORIGINAL JPG...',
      downloadFullSizePhoto: 'Download Full-Size HD Photo',
      slidesDetected: 'SLIDES DETECTED',
      selectAll: 'Select All',
      deselectAll: 'Deselect All',
      packagingZip: 'PACKAGING .ZIP...',
      downloadSelectedZip: 'Download Selected',
    },
    sections: {
      workflowProtocol: 'WORKFLOW PROTOCOL',
      howToHeading: '3-Step Extraction Sequence',
      schemaValidated: 'SCHEMA.ORG/HOWTO VALIDATED',
      stepOf: 'STEP',
      readyStatus: 'READY',
      archSpecs: 'ARCHITECTURAL SPECIFICATIONS',
      techMatrixHeading: 'Technical Quality Matrix',
      losslessPipeline: 'LOSSLESS MEDIA PIPELINE',
      knowledgeBase: 'KNOWLEDGE BASE',
      faqHeading: 'Frequently Asked Questions',
      entriesCount: 'ENTRIES',
      siloDirectoryHeading: 'DEDICATED MEDIA EXTRACTION TOOLS // SILO DIRECTORY',
      specializedEndpoints: '12 SPECIALIZED ENDPOINTS',
      bentoCards: [
        {
          id: 'SPEC-01',
          metric: '0% OVERLAY',
          title: 'Zero Watermark Stream',
          description:
            'Resolves clean upstream CDN media manifests prior to platform watermark stamping or end-screen bumper injection.',
          specs: ['CLEAN H.264 / VP9', 'ORIGINAL FRAME TIMING'],
        },
        {
          id: 'SPEC-02',
          metric: '1:1 BITRATE',
          title: 'Original Bitrate & Full-Size DP',
          description:
            'Zero transcoding or lossy re-compression. Save 1080p60 vertical videos and full 1080×1080 square profile avatars.',
          specs: ['1080P60 MP4', 'UNCOMPRESSED sRGB JPG'],
        },
        {
          id: 'SPEC-03',
          metric: 'RAM PROXY',
          title: 'Zero Server Storage (Direct Proxy)',
          description:
            'Stateless pass-through architecture. VIDNEX stores zero user history, IP logs, or downloaded media payloads on disk.',
          specs: ['NO ACCOUNT LOGIN', 'EPHEMERAL STREAMING'],
        },
        {
          id: 'SPEC-04',
          metric: '< 650MS',
          title: 'Cross-Device Mobile & PC Speed',
          description:
            'Engineered for instant clipboard paste and single-tap saving across iOS Safari, Android Chrome, macOS, and Windows.',
          specs: ['IOS / ANDROID READY', 'ZERO POPUP SCRIPTS'],
        },
      ],
    },
  },

  /* ==========================================================================
   * FRANÇAIS (IDIOME SEO NATIF ULTRA-SOIGNÉ)
   * ======================================================================== */
  fr: {
    header: {
      suiteBadge: 'Suite',
      noWmBadge: 'Sans Filigrane',
      shortsBadge: 'Shorts/HD',
      morePlatforms: 'Plus',
      extendedPlatforms: 'Autres Plateformes',
      languageLabel: 'Langue',
      switchThemeLight: 'Passer au mode clair',
      switchThemeDark: 'Passer au mode sombre',
    },
    omnibox: {
      endpointPrefix: 'TERMINAL',
      modeLabel: 'OUTIL :',
      sourceUrlLabel: 'LIEN SOURCE',
      awaitingValidUrl: '• En attente d’un lien valide...',
      readyForPrefix: '• Prêt pour',
      techSpecsStrip: '1080p • MP4 / JPG / MP3 • Sans Filigrane',
      pasteBtn: 'Coller',
      pastedFeedback: 'Collé',
      emptyClipboard: 'Vide',
      clearInputAria: 'Effacer le lien',
      downloadBtn: 'Télécharger',
      extractingBtn: 'Extraction...',
      dismissBtn: 'FERMER',
      trySampleLabel: 'Tester un lien exemple :',
      errEmptyInput:
        'Collez une URL valide ou un @pseudo pour lancer le téléchargement.',
      errInvalidUrl:
        'Format de lien non reconnu. Compatibles : Instagram, TikTok, YouTube, X, Facebook, Snapchat.',
      errClipboardBlocked:
        'Accès au presse-papiers bloqué par le navigateur. Utilisez Ctrl+V / ⌘+V.',
    },
    drawer: {
      resolvingStream: 'RÉSOLUTION DU FLUX CDN DIRECT...',
      bypassingWatermark: 'SUPPRESSION DU FILIGRANE EN COURS',
      extractionInterrupted: 'EXTRACTION INTERROMPUE // ERREUR 422',
      closeEsc: 'FERMER [ÉCHAP]',
      retryExtraction: 'Réessayer',
      dismiss: 'Ignorer',
      streamReady: 'FLUX PRÊT',
      clearResult: 'FERMER LE RÉSULTAT',
      noWatermarkBadge: 'SANS FILIGRANE',
      streamCodec: 'CODEC VIDÉO',
      duration: 'DURÉE',
      sourceWatermark: 'FILIGRANE SOURCE',
      stripped: 'SUPPRIMÉ',
      startingStream: 'LANCEMENT...',
      saving: 'ENREGISTREMENT...',
      downloadHd1080: 'Télécharger HD 1080p (Sans Filigrane)',
      downloadSd720: 'Télécharger SD 720p',
      extractAudioMp3: 'Extraire l’Audio (MP3)',
      originalJpglBadge: 'JPG Original',
      resetViewBtn: '[-] VUE 1:1 NORMALE',
      hdZoomBtn: '[+] ZOOM HD 100%',
      originalCdnAsset: 'FICHIER CDN ORIGINAL',
      followers: 'abonnés',
      standard1to1: 'Standard 1:1',
      zoom100Hd: 'Zoom HD 100%',
      nativeDimensions: 'DIMENSIONS NATIVES',
      colorProfile: 'PROFIL COULEUR',
      srgbUncompressed: 'sRGB Non Compressé',
      fileSize: 'TAILLE DU FICHIER',
      fetchingOriginalJpg: 'TÉLÉCHARGEMENT JPG...',
      downloadFullSizePhoto: 'Télécharger la Photo de Profil Taille Réelle',
      slidesDetected: 'DIAPOSITIVES DÉTECTÉES',
      selectAll: 'Tout sélectionner',
      deselectAll: 'Tout désélectionner',
      packagingZip: 'CRÉATION DU .ZIP...',
      downloadSelectedZip: 'Télécharger la sélection',
    },
    sections: {
      workflowProtocol: 'PROTOCOLE D’EXTRACTION',
      howToHeading: 'Procédure de Téléchargement en 3 Étapes',
      schemaValidated: 'CONFORME SCHEMA.ORG/HOWTO',
      stepOf: 'ÉTAPE',
      readyStatus: 'ACTIF',
      archSpecs: 'SPÉCIFICATIONS TECHNIQUES',
      techMatrixHeading: 'Matrice de Qualité & Confidentialité',
      losslessPipeline: 'FLUX MÉDIA SANS PERTE',
      knowledgeBase: 'BASE DE CONNAISSANCES',
      faqHeading: 'Questions Fréquentes (FAQ)',
      entriesCount: 'QUESTIONS',
      siloDirectoryHeading:
        'OUTILS DE TÉLÉCHARGEMENT DÉDIÉS // RÉPERTOIRE DES SERVICES',
      specializedEndpoints: '12 OUTILS SPÉCIALISÉS',
      bentoCards: [
        {
          id: 'SPEC-01',
          metric: '0% FILIGRANE',
          title: 'Flux Vidéo Sans Filigrane',
          description:
            'Extraction directe du fichier maître sur le CDN avant l’ajout du logo TikTok ou Instagram.',
          specs: ['H.264 / VP9 NATIF', 'FRÉQUENCE 60 IPS'],
        },
        {
          id: 'SPEC-02',
          metric: 'BITRATE 1:1',
          title: 'Qualité Originale & Photo de Profil HD',
          description:
            'Aucun ré-encodage ni compression. Enregistrez les Reels en 1080p60 et les photos de profil en 1080×1080 taille réelle.',
          specs: ['MP4 1080P60', 'JPG sRGB SANS PERTE'],
        },
        {
          id: 'SPEC-03',
          metric: 'ZÉRO LOG',
          title: 'Aucun Stockage Serveur (Proxy Direct)',
          description:
            'Architecture éphémère sans état. VIDNEX ne conserve aucun historique, adresse IP ni fichier téléchargé.',
          specs: ['SANS COMPTE REQUIS', 'ANONYMAT TOTAL'],
        },
        {
          id: 'SPEC-04',
          metric: '< 650MS',
          title: 'Ultra-Rapide sur Mobile iOS, Android & PC',
          description:
            'Conçu pour le collage en 1 clic et l’enregistrement instantané sur Safari iPhone, Android Chrome, Mac et Windows.',
          specs: ['OPTIMISÉ IPHONE / ANDROID', 'ZÉRO FENÊTRE POPUP'],
        },
      ],
    },
  },

  /* ==========================================================================
   * ESPAÑOL
   * ======================================================================== */
  es: {
    header: {
      suiteBadge: 'Suite',
      noWmBadge: 'Sin Marca',
      shortsBadge: 'Shorts/HD',
      morePlatforms: 'Más',
      extendedPlatforms: 'Más Plataformas',
      languageLabel: 'Idioma',
      switchThemeLight: 'Cambiar a modo claro',
      switchThemeDark: 'Cambiar a modo oscuro',
    },
    omnibox: {
      endpointPrefix: 'ENDPOINT',
      modeLabel: 'MODO:',
      sourceUrlLabel: 'URL DE ORIGEN',
      awaitingValidUrl: '• Esperando enlace válido...',
      readyForPrefix: '• Listo para',
      techSpecsStrip: '1080p • MP4 / JPG / MP3 • Sin Marca de Agua',
      pasteBtn: 'Pegar',
      pastedFeedback: 'Pegado',
      emptyClipboard: 'Vacío',
      clearInputAria: 'Borrar enlace',
      downloadBtn: 'Descargar',
      extractingBtn: 'Extrayendo...',
      dismissBtn: 'CERRAR',
      trySampleLabel: 'Probar enlace de ejemplo:',
      errEmptyInput: 'Pega un enlace válido o @usuario para iniciar la descarga.',
      errInvalidUrl:
        'Formato no reconocido. Soportados: Instagram, TikTok, YouTube, X, Facebook, Snapchat.',
      errClipboardBlocked:
        'Permiso de portapapeles bloqueado. Usa Ctrl+V / ⌘+V para pegar.',
    },
    drawer: {
      resolvingStream: 'RESOLVIENDO FLUJO CDN DIRECTO...',
      bypassingWatermark: 'ELIMINANDO CAPA DE MARCA DE AGUA',
      extractionInterrupted: 'EXTRACCIÓN INTERRUMPIDA // ESTADO 422',
      closeEsc: 'CERRAR [ESC]',
      retryExtraction: 'Reintentar',
      dismiss: 'Cerrar',
      streamReady: 'FLUJO LISTO',
      clearResult: 'BORRAR RESULTADO',
      noWatermarkBadge: 'SIN MARCA DE AGUA',
      streamCodec: 'CÓDEC DE FLUJO',
      duration: 'DURACIÓN',
      sourceWatermark: 'MARCA DE AGUA',
      stripped: 'ELIMINADA',
      startingStream: 'INICIANDO...',
      saving: 'GUARDANDO...',
      downloadHd1080: 'Descargar HD 1080p (Sin Marca de Agua)',
      downloadSd720: 'Descargar SD 720p',
      extractAudioMp3: 'Extraer Audio (MP3)',
      originalJpglBadge: 'JPG Original',
      resetViewBtn: '[-] VISTA 1:1',
      hdZoomBtn: '[+] ZOOM HD 100%',
      originalCdnAsset: 'ARCHIVO CDN ORIGINAL',
      followers: 'seguidores',
      standard1to1: 'Estándar 1:1',
      zoom100Hd: 'Zoom HD 100%',
      nativeDimensions: 'DIMENSIONES NATIVAS',
      colorProfile: 'PERFIL DE COLOR',
      srgbUncompressed: 'sRGB Sin Comprimir',
      fileSize: 'TAMAÑO',
      fetchingOriginalJpg: 'DESCARGANDO JPG...',
      downloadFullSizePhoto: 'Descargar Foto de Perfil HD Tamaño Completo',
      slidesDetected: 'ARCHIVOS DETECTADOS',
      selectAll: 'Seleccionar todo',
      deselectAll: 'Deseleccionar todo',
      packagingZip: 'CREANDO .ZIP...',
      downloadSelectedZip: 'Descargar seleccionados',
    },
    sections: {
      workflowProtocol: 'PROTOCOLO DE EXTRACCIÓN',
      howToHeading: 'Proceso de Descarga en 3 Pasos',
      schemaValidated: 'VALIDADO POR SCHEMA.ORG/HOWTO',
      stepOf: 'PASO',
      readyStatus: 'LISTO',
      archSpecs: 'ESPECIFICACIONES TÉCNICAS',
      techMatrixHeading: 'Matriz de Calidad Técnica',
      losslessPipeline: 'FLUJO MULTIMEDIA SIN PÉRDIDA',
      knowledgeBase: 'BASE DE CONOCIMIENTOS',
      faqHeading: 'Preguntas Frecuentes',
      entriesCount: 'PREGUNTAS',
      siloDirectoryHeading:
        'HERRAMIENTAS DE DESCARGA DEDICADAS // DIRECTORIO SEO',
      specializedEndpoints: '12 HERRAMIENTAS ESPECIALIZADAS',
      bentoCards: [
        {
          id: 'SPEC-01',
          metric: '0% MARCA',
          title: 'Flujo Limpio Sin Marca de Agua',
          description:
            'Obtiene el archivo maestro directamente del CDN antes de que la plataforma inserte marcas de agua.',
          specs: ['H.264 / VP9 LIMPIO', '60FPS ORIGINALES'],
        },
        {
          id: 'SPEC-02',
          metric: 'BITRATE 1:1',
          title: 'Bitrate Original y Foto de Perfil HD',
          description:
            'Sin recodificación ni pérdida de calidad. Guarda videos verticales 1080p y fotos de perfil en 1080×1080.',
          specs: ['MP4 1080P60', 'JPG sRGB PURO'],
        },
        {
          id: 'SPEC-03',
          metric: 'PROXY RAM',
          title: 'Cero Almacenamiento en Servidor',
          description:
            'Arquitectura sin estado. VIDNEX no guarda historial de enlaces, direcciones IP ni archivos en disco.',
          specs: ['SIN INICIAR SESIÓN', 'PRIVACIDAD TOTAL'],
        },
        {
          id: 'SPEC-04',
          metric: '< 650MS',
          title: 'Velocidad Instantánea en Móvil y PC',
          description:
            'Optimizado para pegado en 1 clic en iOS Safari, Android Chrome, macOS y Windows.',
          specs: ['COMPATIBLE IOS / ANDROID', 'CERO VENTANAS EMERGENTES'],
        },
      ],
    },
  },

  /* ==========================================================================
   * PORTUGUÊS
   * ======================================================================== */
  pt: {
    header: {
      suiteBadge: 'Suite',
      noWmBadge: 'Sem Marca',
      shortsBadge: 'Shorts/HD',
      morePlatforms: 'Mais',
      extendedPlatforms: 'Mais Plataformas',
      languageLabel: 'Idioma',
      switchThemeLight: 'Mudar para modo claro',
      switchThemeDark: 'Mudar para modo escuro',
    },
    omnibox: {
      endpointPrefix: 'TERMINAL',
      modeLabel: 'MODO:',
      sourceUrlLabel: 'URL DE ORIGEM',
      awaitingValidUrl: '• Aguardando link válido...',
      readyForPrefix: '• Pronto para',
      techSpecsStrip: '1080p • MP4 / JPG / MP3 • Sem Marca d’Água',
      pasteBtn: 'Colar',
      pastedFeedback: 'Colado',
      emptyClipboard: 'Vazio',
      clearInputAria: 'Limpar link',
      downloadBtn: 'Baixar',
      extractingBtn: 'Extraindo...',
      dismissBtn: 'FECHAR',
      trySampleLabel: 'Testar link de exemplo:',
      errEmptyInput: 'Cole um link válido ou @usuário para iniciar a extração.',
      errInvalidUrl:
        'Formato de link não reconhecido. Suportados: Instagram, TikTok, YouTube, X, Facebook, Snapchat.',
      errClipboardBlocked:
        'Permissão da área de transferência bloqueada. Pressione Ctrl+V / ⌘+V.',
    },
    drawer: {
      resolvingStream: 'RESOLVENDO FLUXO CDN DIRETO...',
      bypassingWatermark: 'REMOVENDO CAMADA DE MARCA D’ÁGUA',
      extractionInterrupted: 'EXTRAÇÃO INTERROMPIDA // ERRO 422',
      closeEsc: 'FECHAR [ESC]',
      retryExtraction: 'Tentar Novamente',
      dismiss: 'Fechar',
      streamReady: 'FLUXO PRONTO',
      clearResult: 'LIMPAR RESULTADO',
      noWatermarkBadge: 'SEM MARCA D’ÁGUA',
      streamCodec: 'CODEC DE VÍDEO',
      duration: 'DURAÇÃO',
      sourceWatermark: 'MARCA D’ÁGUA',
      stripped: 'REMOVIDA',
      startingStream: 'INICIANDO...',
      saving: 'SALVANDO...',
      downloadHd1080: 'Baixar HD 1080p (Sem Marca d’Água)',
      downloadSd720: 'Baixar SD 720p',
      extractAudioMp3: 'Extrair Áudio (MP3)',
      originalJpglBadge: 'JPG Original',
      resetViewBtn: '[-] VISÃO 1:1',
      hdZoomBtn: '[+] ZOOM HD 100%',
      originalCdnAsset: 'ARQUIVO CDN ORIGINAL',
      followers: 'seguidores',
      standard1to1: 'Padrão 1:1',
      zoom100Hd: 'Zoom HD 100%',
      nativeDimensions: 'DIMENSÕES NATIVAS',
      colorProfile: 'PERFIL DE COR',
      srgbUncompressed: 'sRGB Sem Compressão',
      fileSize: 'TAMANHO',
      fetchingOriginalJpg: 'BAIXANDO JPG...',
      downloadFullSizePhoto: 'Baixar Foto de Perfil HD Tamanho Original',
      slidesDetected: 'SLIDES DETECTADOS',
      selectAll: 'Selecionar Tudo',
      deselectAll: 'Desmarcar Tudo',
      packagingZip: 'GERANDO .ZIP...',
      downloadSelectedZip: 'Baixar Selecionados',
    },
    sections: {
      workflowProtocol: 'PROTOCOLO DE EXTRAÇÃO',
      howToHeading: 'Sequência de Download em 3 Passos',
      schemaValidated: 'VALIDADO POR SCHEMA.ORG/HOWTO',
      stepOf: 'PASSO',
      readyStatus: 'PRONTO',
      archSpecs: 'ESPECIFICAÇÕES TÉCNICAS',
      techMatrixHeading: 'Matriz de Qualidade Técnica',
      losslessPipeline: 'PIPELINE DE MÍDIA SEM PERDAS',
      knowledgeBase: 'BASE DE CONHECIMENTO',
      faqHeading: 'Perguntas Frequentes (FAQ)',
      entriesCount: 'PERGUNTAS',
      siloDirectoryHeading:
        'FERRAMENTAS DE DOWNLOAD DEDICADAS // DIRETÓRIO DE SERVIÇOS',
      specializedEndpoints: '12 FERRAMENTAS ESPECIALIZADAS',
      bentoCards: [
        {
          id: 'SPEC-01',
          metric: '0% MARCA',
          title: 'Vídeo Limpo Sem Marca d’Água',
          description:
            'Captura o fluxo original diretamente do CDN antes da aplicação de logotipos ou marcas d’água.',
          specs: ['H.264 / VP9 PURO', 'TAXA 60FPS ORIGINAL'],
        },
        {
          id: 'SPEC-02',
          metric: 'BITRATE 1:1',
          title: 'Bitrate Original e Foto de Perfil HD',
          description:
            'Zero recompressão. Salve Reels em 1080p60 e fotos de perfil do Instagram/TikTok em 1080×1080.',
          specs: ['MP4 1080P60', 'JPG sRGB SEM PERDA'],
        },
        {
          id: 'SPEC-03',
          metric: 'PROXY RAM',
          title: 'Zero Armazenamento no Servidor',
          description:
            'Arquitetura sem estado. O VIDNEX não armazena histórico de links, IPs ou arquivos baixados.',
          specs: ['SEM LOGIN', 'STREAMING EFÊMERO'],
        },
        {
          id: 'SPEC-04',
          metric: '< 650MS',
          title: 'Alta Velocidade no Celular e PC',
          description:
            'Projetado para colagem em 1 toque e download imediato no iOS Safari, Android Chrome, Mac e PC.',
          specs: ['PRONTO PARA IOS / ANDROID', 'ZERO POPUPS'],
        },
      ],
    },
  },

  /* ==========================================================================
   * العربية (FULL RTL ARABIC SEO)
   * ======================================================================== */
  ar: {
    header: {
      suiteBadge: 'شامل',
      noWmBadge: 'بدون علامة',
      shortsBadge: 'شورتس/HD',
      morePlatforms: 'المزيد',
      extendedPlatforms: 'منصات إضافية',
      languageLabel: 'اللغة',
      switchThemeLight: 'التبديل إلى الوضع الفاتح',
      switchThemeDark: 'التبديل إلى الوضع الداكن',
    },
    omnibox: {
      endpointPrefix: 'نقطة الوصول',
      modeLabel: 'الأداة:',
      sourceUrlLabel: 'رابط المصدر',
      awaitingValidUrl: '• بانتظار رابط صالح...',
      readyForPrefix: '• جاهز لـ',
      techSpecsStrip: '1080p • MP4 / JPG / MP3 • بدون علامة مائية',
      pasteBtn: 'لصق',
      pastedFeedback: 'تم اللصق',
      emptyClipboard: 'فارغ',
      clearInputAria: 'مسح الرابط',
      downloadBtn: 'تحميل',
      extractingBtn: 'جارٍ الاستخراج...',
      dismissBtn: 'إغلاق',
      trySampleLabel: 'جرّب رابطاً تجريبياً:',
      errEmptyInput: 'يرجى لصق رابط صالح أو اسم مستخدم @ لبدء التحميل.',
      errInvalidUrl:
        'تنسيق الرابط غير مدعوم. المنصات المدعومة: إنستغرام، تيك توك، يوتيوب، إكس، فيسبوك، سناب شات.',
      errClipboardBlocked:
        'تم حظر الوصول إلى الحافظة من المتصفح. استخدم Ctrl+V أو ⌘+V للصق مباشرة.',
    },
    drawer: {
      resolvingStream: 'جارٍ الاتصال بالبث المباشر بدقة أصلية...',
      bypassingWatermark: 'تجاوز طبقة العلامة المائية',
      extractionInterrupted: 'تعذر الاستخراج // خطأ 422',
      closeEsc: 'إغلاق [ESC]',
      retryExtraction: 'إعادة المحاولة',
      dismiss: 'تجاهل',
      streamReady: 'البث جاهز',
      clearResult: 'مسح النتيجة',
      noWatermarkBadge: 'بدون علامة مائية',
      streamCodec: 'ترميز الفيديو',
      duration: 'المدة',
      sourceWatermark: 'العلامة المائية',
      stripped: 'تمت إزالتها',
      startingStream: 'جارٍ البدء...',
      saving: 'جارٍ الحفظ...',
      downloadHd1080: 'تحميل بدقة HD 1080p (بدون علامة مائية)',
      downloadSd720: 'تحميل بدقة SD 720p',
      extractAudioMp3: 'استخراج الصوت (MP3)',
      originalJpglBadge: 'JPG أصلي',
      resetViewBtn: '[-] عرض قياسي 1:1',
      hdZoomBtn: '[+] تكبير 100% HD',
      originalCdnAsset: 'ملف أصلي غير مضغوط',
      followers: 'متابع',
      standard1to1: 'قياسي 1:1',
      zoom100Hd: 'تكبير 100% HD',
      nativeDimensions: 'الأبعاد الأصلية',
      colorProfile: 'نطاق الألوان',
      srgbUncompressed: 'sRGB غير مضغوط',
      fileSize: 'حجم الملف',
      fetchingOriginalJpg: 'جارٍ جلب الصورة الأصلية...',
      downloadFullSizePhoto: 'تحميل الصورة الشخصية بالحجم الكامل HD',
      slidesDetected: 'شرائح مكتشفة',
      selectAll: 'تحديد الكل',
      deselectAll: 'إلغاء تحديد الكل',
      packagingZip: 'جارٍ ضغط ملف .ZIP...',
      downloadSelectedZip: 'تحميل المحدد',
    },
    sections: {
      workflowProtocol: 'بروتوكول الاستخراج',
      howToHeading: 'خطوات التحميل في 3 مراحل بسيطة',
      schemaValidated: 'متوافق مع معيار SCHEMA.ORG/HOWTO',
      stepOf: 'الخطوة',
      readyStatus: 'جاهز',
      archSpecs: 'المواصفات الهندسية والتقنية',
      techMatrixHeading: 'مصفوفة الجودة والخصوصية',
      losslessPipeline: 'معالجة وسائط بدون فقدان للجودة',
      knowledgeBase: 'قاعدة المعرفة',
      faqHeading: 'الأسئلة الشائعة',
      entriesCount: 'أسئلة',
      siloDirectoryHeading: 'أدوات التحميل المتخصصة // دليل المنصات',
      specializedEndpoints: '12 أداة متخصصة',
      bentoCards: [
        {
          id: 'SPEC-01',
          metric: '0% علامة مائية',
          title: 'فيديو نقي بدون علامة مائية',
          description:
            'استخراج الملف الأصلي مباشرة من خوادم المنصة قبل إضافة شعارات تيك توك أو إنستغرام.',
          specs: ['H.264 / VP9 نقي', '60 إطاراً في الثانية'],
        },
        {
          id: 'SPEC-02',
          metric: 'جودة 1:1',
          title: 'الجودة الأصلية وصور الحسابات بالحجم الكامل',
          description:
            'بدون إعادة ضغط. احفظ مقاطع ريلز بدقة 1080p وصور البروفايل الشخصية بأبعاد 1080×1080 الكاملة.',
          specs: ['MP4 1080P60', 'JPG sRGB أصلي'],
        },
        {
          id: 'SPEC-03',
          metric: 'خصوصية تامة',
          title: 'عدم تخزين الملفات على الخادم',
          description:
            'بنية تمرير مباشر لا تحفظ سجل الروابط أو عناوين IP أو الوسائط المحملة نهائياً.',
          specs: ['بدون تسجيل دخول', 'حماية كاملة للخصوصية'],
        },
        {
          id: 'SPEC-04',
          metric: '< 650 مللي ثانية',
          title: 'سرعة فائقة على الهاتف والكمبيوتر',
          description:
            'مصمم للصق الرابط بضغطة واحدة والتحميل الفوري على آيفون وأندرويد وجميع المتصفحات.',
          specs: ['يدعم iOS و Android', 'بدون نوافذ منبثقة'],
        },
      ],
    },
  },
};

/* ============================================================================
 * LOCALIZED TOOL SILO TRANSLATIONS (FR / ES / PT / AR)
 * ========================================================================== */
const TOOL_TRANSLATIONS: Record<
  Exclude<LanguageCode, 'en'>,
  Record<ToolSlug, LocalizedToolText>
> = {
  fr: {
    'instagram-reels': {
      shortLabel: 'Reels HD',
      h1: 'Télécharger Reel Instagram HD',
      subtitle:
        'Téléchargez les vidéos Reels Instagram en qualité originale MP4 1080p à 60 ips avec audio AAC studio et sans filigrane.',
      metaTitle:
        'Télécharger Reel Instagram HD — MP4 1080p Sans Filigrane | VIDNEX',
      metaDescription:
        'Téléchargez gratuitement vos Reels Instagram en MP4 1080p HD sans filigrane sur iPhone, Android et PC.',
      howToSteps: [
        {
          number: '01',
          title: 'Copier le lien du Reel Instagram',
          codeHint: 'instagram.com/reel/{ID}',
          description:
            'Ouvrez l’application ou le site Instagram, appuyez sur Partager sur un Reel public et sélectionnez Copier le lien.',
        },
        {
          number: '02',
          title: 'Coller dans la barre VIDNEX',
          codeHint: 'DÉTECTION INSTANTANÉE',
          description:
            'Collez l’URL dans le champ ci-dessus. VIDNEX identifie automatiquement le Reel sans recharger la page.',
        },
        {
          number: '03',
          title: 'Enregistrer en MP4 1080p',
          codeHint: 'FLUX CDN DIRECT',
          description:
            'Cliquez sur Télécharger HD 1080p (Sans Filigrane) ou Extraire l’Audio (MP3) pour obtenir le fichier original.',
        },
      ],
      faqs: [
        {
          question:
            'VIDNEX compresse-t-il la qualité des Reels Instagram téléchargés ?',
          answer:
            'Non. VIDNEX récupère le flux vidéo direct hébergé sur le CDN d’Instagram en conservant la résolution exacte 1080×1920 et le débit d’origine.',
        },
        {
          question:
            'Puis-je convertir un Reel Instagram uniquement en fichier audio MP3 ?',
          answer:
            'Oui. Chaque extraction propose un bouton « Extraire l’Audio (MP3) » pour sauvegarder la bande-son originale en un clic.',
        },
        {
          question: 'Dois-je me connecter à mon compte Instagram ?',
          answer:
            'Jamais. VIDNEX fonctionne de manière 100 % anonyme sur les liens publics sans demander vos identifiants.',
        },
      ],
    },
    'instagram-dp': {
      shortLabel: 'Photo de Profil',
      h1: 'Photo de Profil Instagram Taille Réelle (HD)',
      subtitle:
        'Affichez et téléchargez n’importe quelle photo de profil Instagram (DP) en haute définition 1080×1080 JPG avec zoom HD 100 %.',
      metaTitle:
        'Photo de Profil Instagram Taille Réelle — Zoom & Téléchargement HD | VIDNEX',
      metaDescription:
        'Zoomez et téléchargez les photos de profil Instagram en taille réelle 1080×1080 HD sans recadrage circulaire.',
      howToSteps: [
        {
          number: '01',
          title: 'Copier l’URL du profil Instagram',
          codeHint: 'instagram.com/{pseudo}',
          description:
            'Copiez le lien du profil Instagram depuis votre navigateur ou l’application mobile.',
        },
        {
          number: '02',
          title: 'Inspecter avec le Zoom HD 100 %',
          codeHint: 'FORMAT CARRÉ 1:1',
          description:
            'Collez le lien dans VIDNEX pour afficher l’image maîtresse complète au lieu de la miniature 150×150.',
        },
        {
          number: '03',
          title: 'Télécharger le JPG HD Original',
          codeHint: 'JPG sRGB NATIF',
          description:
            'Cliquez sur Télécharger la Photo de Profil Taille Réelle pour enregistrer l’image non compressée.',
        },
      ],
      faqs: [
        {
          question:
            'Pourquoi la photo de profil est-elle floue sur l’application Instagram ?',
          answer:
            'Instagram affiche une miniature réduite à 150×150 pixels, mais conserve le fichier original 1080×1080 sur ses serveurs. VIDNEX extrait directement cette version haute résolution.',
        },
        {
          question:
            'Puis-je voir la photo de profil HD d’un compte Instagram privé ?',
          answer:
            'Oui. La photo de profil principale étant une métadonnée publique, VIDNEX permet de l’afficher en taille réelle même pour un compte privé.',
        },
      ],
    },
    'instagram-carousel': {
      shortLabel: 'Carrousel',
      h1: 'Télécharger Photo & Carrousel Instagram',
      subtitle:
        'Extrayez jusqu’à 20 photos et vidéos haute résolution d’un post Carrousel Instagram individuellement ou en archive .ZIP.',
      metaTitle:
        'Télécharger Carrousel & Photos Instagram en HD (.ZIP) | VIDNEX',
      metaDescription:
        'Enregistrez toutes les photos et vidéos d’un carrousel Instagram en résolution native 1080×1350 ou en pack .ZIP.',
      howToSteps: [
        {
          number: '01',
          title: 'Copier le lien de la publication',
          codeHint: 'instagram.com/p/{CODE}',
          description:
            'Copiez l’URL d’une photo unique ou d’un carrousel Instagram à plusieurs diapositives.',
        },
        {
          number: '02',
          title: 'Sélectionner les diapositives',
          codeHint: 'SÉLECTION MULTIPLE',
          description:
            'Toutes les images et vidéos du carrousel s’affichent en grille. Cochez vos choix ou cliquez sur Tout sélectionner.',
        },
        {
          number: '03',
          title: 'Télécharger à l’unité ou en .ZIP',
          codeHint: 'ARCHIVE SANS PERTE',
          description:
            'Sauvegardez chaque élément séparément ou téléchargez l’ensemble du carrousel en un seul fichier .ZIP.',
        },
      ],
      faqs: [
        {
          question:
            'Combien de photos VIDNEX peut-il extraire d’un carrousel Instagram ?',
          answer:
            'VIDNEX prend en charge la limite maximale de 20 diapositives par carrousel, y compris les publications mixtes mêlant photos JPG et vidéos MP4.',
        },
      ],
    },
    'instagram-stories': {
      shortLabel: 'Stories',
      h1: 'Télécharger Story Instagram Anonymement',
      subtitle:
        'Visionnez et téléchargez les Stories publiques et Stories à la une Instagram en 1080p vertical sans apparaître dans la liste des vues.',
      metaTitle:
        'Télécharger Story Instagram en HD — Visionneuse Anonyme | VIDNEX',
      metaDescription:
        'Téléchargez les Stories Instagram publiques en MP4 1080p et JPG de façon 100 % anonyme et sans compte.',
      howToSteps: [
        {
          number: '01',
          title: 'Copier le lien de la Story',
          codeHint: 'instagram.com/stories/{user}',
          description:
            'Copiez le lien direct de la Story publique que vous souhaitez conserver.',
        },
        {
          number: '02',
          title: 'Extraction par proxy anonyme',
          codeHint: 'ZÉRO NOTIFICATION',
          description:
            'Collez le lien dans VIDNEX. Notre proxy récupère la Story sans enregistrer votre vue.',
        },
        {
          number: '03',
          title: 'Enregistrer la Story en 1080p',
          codeHint: 'FORMAT 9:16 NATIF',
          description:
            'Téléchargez la vidéo ou la photo de la Story dans sa qualité verticale d’origine.',
        },
      ],
      faqs: [
        {
          question:
            'Le créateur verra-t-il que j’ai consulté ou téléchargé sa Story ?',
          answer:
            'Non. L’extraction s’effectue via nos serveurs proxy anonymes sans aucune connexion à votre compte personnel.',
        },
      ],
    },
    'tiktok-no-watermark': {
      shortLabel: 'Vidéo Sans Filigrane',
      h1: 'Télécharger Vidéo TikTok Sans Filigrane (HD)',
      subtitle:
        'Enregistrez les vidéos TikTok en fichier maître MP4 1080p sans le logo flottant ni l’écran de fin.',
      metaTitle:
        'Télécharger TikTok Sans Filigrane — Vidéo MP4 HD 1080p | VIDNEX',
      metaDescription:
        'Téléchargez n’importe quelle vidéo TikTok sans filigrane en qualité originale MP4 1080p HD gratuitement.',
      howToSteps: [
        {
          number: '01',
          title: 'Copier le lien de la vidéo TikTok',
          codeHint: 'tiktok.com/@user/video/{ID}',
          description:
            'Sur TikTok, appuyez sur Partager puis Copier le lien (les liens courts vm.tiktok.com sont également pris en charge).',
        },
        {
          number: '02',
          title: 'Coller dans l’Omnibox VIDNEX',
          codeHint: 'CONTOURNEMENT FILIGRANE',
          description:
            'Collez l’URL ci-dessus. Notre moteur localise immédiatement le flux source non marqué.',
        },
        {
          number: '03',
          title: 'Télécharger en MP4 1080p Propre',
          codeHint: 'DÉBIT D’ORIGINE',
          description:
            'Cliquez sur Télécharger HD 1080p (Sans Filigrane) pour obtenir la vidéo nette.',
        },
      ],
      faqs: [
        {
          question:
            'Comment VIDNEX retire-t-il le filigrane TikTok sans flouter la vidéo ?',
          answer:
            'VIDNEX ne rogne ni ne floute l’image : il accède directement au fichier vidéo original sur le CDN de TikTok avant l’incrustation du filigrane.',
        },
        {
          question: 'Les liens raccourcis vm.tiktok.com fonctionnent-ils ?',
          answer:
            'Oui, tous les formats de liens mobiles et de bureau TikTok sont résolus automatiquement.',
        },
      ],
    },
    'tiktok-slideshow': {
      shortLabel: 'Carrousel Photo',
      h1: 'Télécharger Carrousel Photo TikTok (Slideshow)',
      subtitle:
        'Extrayez chaque photo haute résolution des diaporamas TikTok Photo Mode sans filigrane, ainsi que la musique MP3.',
      metaTitle:
        'Télécharger Diaporama & Carrousel Photo TikTok Sans Filigrane | VIDNEX',
      metaDescription:
        'Sauvegardez les photos des diaporamas TikTok en JPG HD sans filigrane individuellement ou en archive .ZIP.',
      howToSteps: [
        {
          number: '01',
          title: 'Copier le lien du diaporama TikTok',
          codeHint: 'tiktok.com/@user/photo/{ID}',
          description:
            'Copiez le lien de partage de la publication TikTok contenant plusieurs photos.',
        },
        {
          number: '02',
          title: 'Prévisualiser la grille de photos',
          codeHint: 'MATRICE CARROUSEL',
          description:
            'Collez l’URL dans VIDNEX pour afficher toutes les images du diaporama.',
        },
        {
          number: '03',
          title: 'Sauvegarder en JPG ou .ZIP',
          codeHint: 'PACK COMPLET',
          description:
            'Téléchargez chaque photo sans filigrane à l’unité ou en archive .ZIP complète.',
        },
      ],
      faqs: [
        {
          question:
            'Les images téléchargées depuis un diaporama TikTok ont-elles un logo ?',
          answer:
            'Non. Chaque photo est extraite en JPG 1080p parfaitement vierge de tout filigrane TikTok.',
        },
      ],
    },
    'tiktok-mp3': {
      shortLabel: 'Audio MP3',
      h1: 'Convertisseur TikTok vers MP3 (Audio Original)',
      subtitle:
        'Extrayez les sons, musiques et voix off TikTok en fichier audio MP3 haute fidélité en un seul clic.',
      metaTitle: 'Convertisseur TikTok en MP3 — Extraire Son & Musique | VIDNEX',
      metaDescription:
        'Convertissez n’importe quelle vidéo TikTok en fichier audio MP3 haute qualité instantanément.',
      howToSteps: [
        {
          number: '01',
          title: 'Copier le lien TikTok',
          codeHint: 'LIEN VIDÉO SOURCE',
          description:
            'Copiez l’URL de la vidéo TikTok dont vous souhaitez récupérer la bande sonore.',
        },
        {
          number: '02',
          title: 'Isoler la piste audio',
          codeHint: 'EXTRACTION AAC/MP3',
          description:
            'Collez le lien dans VIDNEX pour séparer le flux audio du conteneur vidéo.',
        },
        {
          number: '03',
          title: 'Télécharger le fichier MP3',
          codeHint: 'AUDIO DIRECT',
          description:
            'Cliquez sur Extraire l’Audio (MP3) pour enregistrer le son sur votre appareil.',
        },
      ],
      faqs: [
        {
          question: 'Quelle est la qualité du fichier MP3 extrait ?',
          answer:
            'VIDNEX extrait le flux audio natif au débit maximal disponible sur les serveurs de TikTok.',
        },
      ],
    },
    'tiktok-dp': {
      shortLabel: 'Profil HD',
      h1: 'Photo de Profil TikTok Taille Réelle (HD)',
      subtitle:
        'Affichez et téléchargez l’avatar de n’importe quel créateur TikTok en résolution carrée 1080×1080.',
      metaTitle:
        'Télécharger Photo de Profil TikTok HD Taille Réelle | VIDNEX',
      metaDescription:
        'Zoomez à 100 % et téléchargez les photos de profil TikTok en qualité originale 1080×1080 JPG.',
      howToSteps: [
        {
          number: '01',
          title: 'Copier le lien du profil TikTok',
          codeHint: 'tiktok.com/@{pseudo}',
          description:
            'Copiez l’URL du profil TikTok (ex. https://www.tiktok.com/@designsystems).',
        },
        {
          number: '02',
          title: 'Activer le Zoom HD 100 %',
          codeHint: 'PLEINE RÉSOLUTION',
          description:
            'Collez le lien dans VIDNEX pour inspecter l’image de profil complète.',
        },
        {
          number: '03',
          title: 'Enregistrer le JPG Original',
          codeHint: 'AVATAR 1080P',
          description:
            'Cliquez sur Télécharger la Photo de Profil Taille Réelle.',
        },
      ],
      faqs: [
        {
          question:
            'Puis-je télécharger un avatar TikTok uniquement avec le lien @pseudo ?',
          answer:
            'Oui, collez simplement l’adresse du profil TikTok dans la barre pour ouvrir la visionneuse HD.',
        },
      ],
    },
    'youtube-shorts': {
      shortLabel: 'YT Shorts / HD',
      h1: 'Télécharger YouTube Shorts & Vidéos HD',
      subtitle:
        'Extraction rapide des YouTube Shorts et vidéos publiques en MP4 1080p60, 720p ou piste audio MP3.',
      metaTitle:
        'Télécharger YouTube Shorts en MP4 1080p HD & MP3 | VIDNEX',
      metaDescription:
        'Téléchargez les YouTube Shorts et vidéos publiques en MP4 1080p60 avec son ou convertissez-les en MP3.',
      howToSteps: [
        {
          number: '01',
          title: 'Copier le lien YouTube Short',
          codeHint: 'youtube.com/shorts/{ID}',
          description:
            'Copiez l’URL du Short ou de la vidéo YouTube depuis le bouton Partager.',
        },
        {
          number: '02',
          title: 'Coller dans VIDNEX',
          codeHint: 'ANALYSE DU FLUX',
          description:
            'Collez le lien ci-dessus pour préparer les flux vidéo 1080p et audio.',
        },
        {
          number: '03',
          title: 'Choisir MP4 1080p ou MP3',
          codeHint: 'VIDÉO + AUDIO MUXÉS',
          description:
            'Téléchargez le fichier MP4 complet avec audio synchronisé ou uniquement le MP3.',
        },
      ],
      faqs: [
        {
          question:
            'Les téléchargements YouTube Shorts 1080p incluent-ils le son ?',
          answer:
            'Oui, VIDNEX fournit un fichier MP4 1080p où la vidéo haute définition et l’audio AAC sont parfaitement fusionnés.',
        },
      ],
    },
    'x-video': {
      shortLabel: 'Vidéo X / GIF',
      h1: 'Télécharger Vidéo & GIF X (Twitter) en MP4',
      subtitle:
        'Enregistrez les vidéos et GIFs animés des publications X (anciennement Twitter) directement en MP4 haute définition.',
      metaTitle:
        'Télécharger Vidéo X (Twitter) & GIF en MP4 HD | VIDNEX',
      metaDescription:
        'Téléchargez les vidéos et GIFs de X (Twitter) en MP4 1080p. Compatible avec les liens x.com et twitter.com.',
      howToSteps: [
        {
          number: '01',
          title: 'Copier le lien du post X',
          codeHint: 'x.com/{user}/status/{ID}',
          description:
            'Cliquez sur l’icône de partage sous le post X et copiez le lien.',
        },
        {
          number: '02',
          title: 'Sélection du meilleur débit',
          codeHint: 'CONVERSION HLS -> MP4',
          description:
            'Collez l’URL dans VIDNEX pour extraire la variante MP4 de plus haute résolution.',
        },
        {
          number: '03',
          title: 'Enregistrer le fichier MP4',
          codeHint: 'COMPATIBILITÉ UNIVERSELLE',
          description:
            'Téléchargez la vidéo en 1080p ou 720p sur votre appareil.',
        },
      ],
      faqs: [
        {
          question:
            'Les liens x.com et twitter.com sont-ils tous deux acceptés ?',
          answer:
            'Oui, notre détecteur reconnaît nativement les domaines x.com et twitter.com.',
        },
      ],
    },
    'facebook-reels': {
      shortLabel: 'FB Reels / Watch',
      h1: 'Télécharger Reels & Vidéos Facebook HD',
      subtitle:
        'Téléchargez les Reels Facebook publics et vidéos Watch en MP4 1080p ou 720p sans connexion.',
      metaTitle:
        'Télécharger Reel & Vidéo Facebook en MP4 1080p HD | VIDNEX',
      metaDescription:
        'Sauvegardez les vidéos publiques et Reels Facebook en MP4 1080p HD sur mobile et ordinateur.',
      howToSteps: [
        {
          number: '01',
          title: 'Copier le lien Facebook',
          codeHint: 'facebook.com/reel/{ID}',
          description:
            'Appuyez sur Partager puis Copier le lien sur n’importe quel Reel ou vidéo Facebook publique.',
        },
        {
          number: '02',
          title: 'Coller dans VIDNEX',
          codeHint: 'RÉSOLUTION FLUX HD',
          description:
            'Collez le lien dans l’Omnibox pour détecter les pistes 1080p et 720p.',
        },
        {
          number: '03',
          title: 'Télécharger le MP4 HD',
          codeHint: 'TÉLÉCHARGEMENT DIRECT',
          description:
            'Cliquez sur Télécharger HD 1080p pour enregistrer la vidéo.',
        },
      ],
      faqs: [
        {
          question: 'Les liens courts fb.watch sont-ils pris en charge ?',
          answer:
            'Oui, VIDNEX accepte aussi bien les liens facebook.com/reel/ que les liens raccourcis fb.watch.',
        },
      ],
    },
    'snapchat-spotlight': {
      shortLabel: 'Spotlight HD',
      h1: 'Télécharger Vidéo Snapchat Spotlight & Story',
      subtitle:
        'Enregistrez les vidéos verticales Snapchat Spotlight et les Stories publiques en MP4 9:16 haute définition.',
      metaTitle:
        'Télécharger Snapchat Spotlight & Story Publique en MP4 HD | VIDNEX',
      metaDescription:
        'Téléchargez les vidéos publiques Snapchat Spotlight en qualité originale MP4 9:16 sans filigrane.',
      howToSteps: [
        {
          number: '01',
          title: 'Copier le lien Snapchat Spotlight',
          codeHint: 'snapchat.com/spotlight/{ID}',
          description:
            'Appuyez sur Partager sur une vidéo publique Spotlight et copiez le lien.',
        },
        {
          number: '02',
          title: 'Coller dans VIDNEX',
          codeHint: 'ANALYSEUR SPOTLIGHT',
          description:
            'Collez l’URL Snapchat dans le champ ci-dessus.',
        },
        {
          number: '03',
          title: 'Enregistrer le MP4 vertical',
          codeHint: '9:16 ORIGINAL',
          description:
            'Sauvegardez le fichier vidéo MP4 directement sur votre téléphone ou PC.',
        },
      ],
      faqs: [
        {
          question: 'Puis-je télécharger des Snaps privés ?',
          answer:
            'Non, seuls les contenus publics Spotlight et Stories publiques disposant d’un lien partageable sont pris en charge.',
        },
      ],
    },
  },

  /* ==========================================================================
   * ESPAÑOL TOOL SILOS
   * ======================================================================== */
  es: {
    'instagram-reels': {
      shortLabel: 'Reels HD',
      h1: 'Descargar Reels de Instagram en HD',
      subtitle:
        'Extrae Reels de Instagram en MP4 1080p original a 60fps con audio AAC y sin marca de agua.',
      metaTitle: 'Descargar Reels de Instagram — MP4 1080p Sin Marca | VIDNEX',
      metaDescription:
        'Descarga Reels de Instagram en calidad original 1080p MP4 sin marca de agua en móvil y PC.',
      howToSteps: [
        {
          number: '01',
          title: 'Copiar enlace del Reel',
          codeHint: 'instagram.com/reel/{ID}',
          description: 'Toca Compartir en cualquier Reel público de Instagram y selecciona Copiar enlace.',
        },
        {
          number: '02',
          title: 'Pegar en VIDNEX',
          codeHint: 'DETECCIÓN AUTOMÁTICA',
          description: 'Pega la URL arriba. VIDNEX valida el identificador del Reel al instante.',
        },
        {
          number: '03',
          title: 'Guardar MP4 1080p Original',
          codeHint: 'FLUJO CDN DIRECTO',
          description: 'Elige Descargar HD 1080p o Extraer Audio (MP3).',
        },
      ],
      faqs: [
        {
          question: '¿VIDNEX comprime los Reels de Instagram?',
          answer: 'No. Se descarga el flujo original directamente desde el CDN de Instagram en 1080×1920.',
        },
      ],
    },
    'instagram-dp': {
      shortLabel: 'Foto de Perfil',
      h1: 'Ver y Descargar Foto de Perfil de Instagram HD',
      subtitle:
        'Visualiza y descarga cualquier foto de perfil de Instagram (DP) en tamaño completo 1080×1080 JPG con zoom HD 100%.',
      metaTitle: 'Descargar Foto de Perfil de Instagram en Tamaño Completo HD | VIDNEX',
      metaDescription: 'Haz zoom y descarga fotos de perfil de Instagram en resolución original 1080×1080 JPG.',
      howToSteps: [
        {
          number: '01',
          title: 'Copiar URL del perfil',
          codeHint: 'instagram.com/{usuario}',
          description: 'Copia el enlace del perfil de Instagram desde la app o navegador.',
        },
        {
          number: '02',
          title: 'Aplicar Zoom HD 100%',
          codeHint: 'LIENZO 1:1 NATIVO',
          description: 'Pega el enlace en VIDNEX para inspeccionar el avatar en alta resolución.',
        },
        {
          number: '03',
          title: 'Descargar JPG Original',
          codeHint: 'JPG sRGB PURO',
          description: 'Haz clic en Descargar Foto de Perfil HD Tamaño Completo.',
        },
      ],
      faqs: [
        {
          question: '¿Funciona con cuentas privadas de Instagram?',
          answer: 'Sí, la imagen de perfil principal es pública y puede descargarse en tamaño completo.',
        },
      ],
    },
    'instagram-carousel': {
      shortLabel: 'Carrusel',
      h1: 'Descargar Fotos y Carrusel de Instagram (.ZIP)',
      subtitle: 'Descarga hasta 20 fotos y videos de publicaciones carrusel de Instagram individualmente o en archivo .ZIP.',
      metaTitle: 'Descargar Carrusel y Fotos de Instagram en HD | VIDNEX',
      metaDescription: 'Guarda todas las fotos y videos de un carrusel de Instagram en resolución original 1080×1350.',
      howToSteps: [
        { number: '01', title: 'Copiar enlace del post', codeHint: 'instagram.com/p/{ID}', description: 'Copia el enlace de la publicación carrusel de Instagram.' },
        { number: '02', title: 'Seleccionar archivos', codeHint: 'CUADRÍCULA MÚLTIPLE', description: 'Marca las fotos o videos deseados o pulsa Seleccionar todo.' },
        { number: '03', title: 'Descargar individual o .ZIP', codeHint: 'ARCHIVO SIN PÉRDIDA', description: 'Guarda cada imagen o descarga el paquete completo en .ZIP.' },
      ],
      faqs: [
        { question: '¿Cuántas imágenes soporta por carrusel?', answer: 'Soporta hasta 20 elementos por carrusel, combinando fotos JPG y videos MP4.' },
      ],
    },
    'instagram-stories': {
      shortLabel: 'Historias',
      h1: 'Descargar Historias de Instagram Anónimamente',
      subtitle: 'Mira y guarda Historias públicas de Instagram en 1080p vertical sin dejar rastro en la lista de espectadores.',
      metaTitle: 'Descargar Historias de Instagram en HD de Forma Anónima | VIDNEX',
      metaDescription: 'Descarga historias públicas de Instagram en MP4 1080p sin iniciar sesión.',
      howToSteps: [
        { number: '01', title: 'Copiar enlace de la Historia', codeHint: 'instagram.com/stories/{user}', description: 'Copia la URL de la historia pública de Instagram.' },
        { number: '02', title: 'Resolver mediante proxy anónimo', codeHint: 'CERO RASTRO', description: 'Pega el enlace en VIDNEX para cargar la historia de forma privada.' },
        { number: '03', title: 'Guardar MP4 Vertical', codeHint: '9:16 ORIGINAL', description: 'Descarga el video o foto de la historia en tu dispositivo.' },
      ],
      faqs: [
        { question: '¿Sabrá el creador que vi su historia?', answer: 'No, todas las solicitudes se procesan de manera anónima sin cuenta.' },
      ],
    },
    'tiktok-no-watermark': {
      shortLabel: 'Video Sin Marca',
      h1: 'Descargar Videos de TikTok Sin Marca de Agua (HD)',
      subtitle: 'Guarda videos de TikTok en MP4 1080p original sin el logotipo flotante ni pantalla final.',
      metaTitle: 'Descargar TikTok Sin Marca de Agua — MP4 HD 1080p | VIDNEX',
      metaDescription: 'Descarga videos de TikTok sin marca de agua en calidad original 1080p MP4 gratis.',
      howToSteps: [
        { number: '01', title: 'Copiar enlace de TikTok', codeHint: 'tiktok.com/@user/video/{ID}', description: 'Toca Compartir y Copiar enlace en cualquier video de TikTok.' },
        { number: '02', title: 'Pegar en VIDNEX', codeHint: 'SIN MARCA DE AGUA', description: 'Pega el enlace arriba para localizar el flujo original limpio.' },
        { number: '03', title: 'Descargar MP4 1080p', codeHint: 'BITRATE ORIGINAL', description: 'Haz clic en Descargar HD 1080p (Sin Marca de Agua).' },
      ],
      faqs: [
        { question: '¿Funcionan los enlaces cortos vm.tiktok.com?', answer: 'Sí, los enlaces cortos móviles y de escritorio se detectan automáticamente.' },
      ],
    },
    'tiktok-slideshow': {
      shortLabel: 'Modo Foto',
      h1: 'Descargar Carrusel de Fotos de TikTok (Slideshow)',
      subtitle: 'Extrae cada imagen en alta resolución de las presentaciones de fotos de TikTok sin marca de agua.',
      metaTitle: 'Descargar Fotos de TikTok Sin Marca de Agua (.ZIP) | VIDNEX',
      metaDescription: 'Guarda las imágenes del Modo Foto de TikTok en JPG HD individuales o archivo .ZIP.',
      howToSteps: [
        { number: '01', title: 'Copiar enlace de TikTok Foto', codeHint: 'tiktok.com/@user/photo/{ID}', description: 'Copia el enlace del carrusel de fotos de TikTok.' },
        { number: '02', title: 'Seleccionar diapositivas', codeHint: 'CUADRÍCULA HD', description: 'Revisa todas las fotos sin marca de agua en la cuadrícula.' },
        { number: '03', title: 'Descargar JPGs o .ZIP', codeHint: 'DESCARGA EN LOTE', description: 'Guarda fotos individuales o descarga el archivo .ZIP completo.' },
      ],
      faqs: [
        { question: '¿Las fotos descargadas tienen el logo de TikTok?', answer: 'No, todas las imágenes se extraen en JPG 1080p limpio.' },
      ],
    },
    'tiktok-mp3': {
      shortLabel: 'Audio MP3',
      h1: 'Convertidor de TikTok a MP3 (Audio Original)',
      subtitle: 'Extrae audios, canciones y sonidos de TikTok en formato MP3 de alta calidad en un clic.',
      metaTitle: 'Descargar Audio de TikTok en MP3 | VIDNEX',
      metaDescription: 'Convierte videos de TikTok a archivos de audio MP3 de alta velocidad.',
      howToSteps: [
        { number: '01', title: 'Copiar enlace del video', codeHint: 'URL DE ORIGEN', description: 'Copia el enlace del TikTok que contiene el audio.' },
        { number: '02', title: 'Aislar pista de audio', codeHint: 'AAC -> MP3', description: 'Pega el enlace en VIDNEX.' },
        { number: '03', title: 'Guardar archivo MP3', codeHint: 'DESCARGA DIRECTA', description: 'Haz clic en Extraer Audio (MP3).' },
      ],
      faqs: [
        { question: '¿Se conserva la calidad original del sonido?', answer: 'Sí, se extrae la pista de audio directa sin pérdidas.' },
      ],
    },
    'tiktok-dp': {
      shortLabel: 'Perfil HD',
      h1: 'Descargar Foto de Perfil de TikTok en HD',
      subtitle: 'Visualiza y guarda el avatar de cualquier creador de TikTok en resolución completa 1080×1080.',
      metaTitle: 'Descargar Foto de Perfil de TikTok en Tamaño Completo | VIDNEX',
      metaDescription: 'Haz zoom al 100% y descarga avatares de TikTok en 1080×1080 JPG.',
      howToSteps: [
        { number: '01', title: 'Copiar enlace del perfil', codeHint: 'tiktok.com/@{usuario}', description: 'Copia la URL del perfil del creador en TikTok.' },
        { number: '02', title: 'Activar Zoom HD 100%', codeHint: 'RESOLUCIÓN COMPLETA', description: 'Inspecciona la imagen cuadrada completa en el visor.' },
        { number: '03', title: 'Descargar JPG HD', codeHint: 'AVATAR 1080P', description: 'Guarda la foto de perfil original en tu dispositivo.' },
      ],
      faqs: [
        { question: '¿Basta con pegar el enlace @usuario?', answer: 'Sí, VIDNEX detecta automáticamente que se trata de un perfil de TikTok.' },
      ],
    },
    'youtube-shorts': {
      shortLabel: 'YT Shorts / HD',
      h1: 'Descargar YouTube Shorts y Videos en 1080p',
      subtitle: 'Extracción directa para YouTube Shorts y videos públicos en MP4 1080p60 o audio MP3.',
      metaTitle: 'Descargar YouTube Shorts en MP4 1080p HD y MP3 | VIDNEX',
      metaDescription: 'Descarga YouTube Shorts y videos públicos en 1080p MP4 sin anuncios molestos.',
      howToSteps: [
        { number: '01', title: 'Copiar enlace de YouTube', codeHint: 'youtube.com/shorts/{ID}', description: 'Copia el enlace del Short o video de YouTube.' },
        { number: '02', title: 'Pegar en VIDNEX', codeHint: 'ANÁLISIS DE FLUJO', description: 'Pega el enlace en la barra superior.' },
        { number: '03', title: 'Descargar MP4 1080p o MP3', codeHint: 'FLUJO MULTIPLEXADO', description: 'Guarda el video con audio incluido o solo el MP3.' },
      ],
      faqs: [
        { question: '¿El video 1080p incluye sonido?', answer: 'Sí, el archivo MP4 1080p viene completamente multiplexado con su pista de audio.' },
      ],
    },
    'x-video': {
      shortLabel: 'Video X / GIF',
      h1: 'Descargar Videos y GIFs de X (Twitter) en MP4',
      subtitle: 'Convierte videos y GIFs de publicaciones de X directamente en archivos MP4 de alta definición.',
      metaTitle: 'Descargar Videos de X (Twitter) en MP4 HD | VIDNEX',
      metaDescription: 'Guarda videos y GIFs de X (Twitter) en MP4 1080p desde enlaces x.com y twitter.com.',
      howToSteps: [
        { number: '01', title: 'Copiar enlace del post en X', codeHint: 'x.com/{user}/status/{ID}', description: 'Copia el enlace de la publicación de X.' },
        { number: '02', title: 'Pegar en VIDNEX', codeHint: 'HLS A MP4', description: 'Resuelve la variante de mayor bitrate disponible.' },
        { number: '03', title: 'Guardar MP4', codeHint: 'DESCARGA DIRECTA', description: 'Descarga el archivo MP4 en tu móvil o PC.' },
      ],
      faqs: [
        { question: '¿Soporta enlaces x.com y twitter.com?', answer: 'Sí, ambos dominios son compatibles automáticamente.' },
      ],
    },
    'facebook-reels': {
      shortLabel: 'FB Reels / Watch',
      h1: 'Descargar Reels y Videos de Facebook en HD',
      subtitle: 'Guarda Reels públicos y videos de Facebook Watch en MP4 1080p o 720p sin iniciar sesión.',
      metaTitle: 'Descargar Reels y Videos de Facebook en 1080p MP4 | VIDNEX',
      metaDescription: 'Descarga videos públicos y Reels de Facebook en alta definición MP4.',
      howToSteps: [
        { number: '01', title: 'Copiar enlace de Facebook', codeHint: 'facebook.com/reel/{ID}', description: 'Copia el enlace del Reel o video público de Facebook.' },
        { number: '02', title: 'Pegar en VIDNEX', codeHint: 'DETECCIÓN HD', description: 'Pega la URL en el cuadro superior.' },
        { number: '03', title: 'Descargar MP4 1080p', codeHint: 'GUARDADO DIRECTO', description: 'Guarda el video en calidad original.' },
      ],
      faqs: [
        { question: '¿Funcionan los enlaces cortos fb.watch?', answer: 'Sí, se admiten tanto enlaces fb.watch como facebook.com/reel.' },
      ],
    },
    'snapchat-spotlight': {
      shortLabel: 'Spotlight HD',
      h1: 'Descargar Videos de Snapchat Spotlight y Stories',
      subtitle: 'Guarda videos verticales públicos de Snapchat Spotlight en resolución original 9:16 MP4.',
      metaTitle: 'Descargar Snapchat Spotlight en MP4 HD | VIDNEX',
      metaDescription: 'Descarga videos públicos de Snapchat Spotlight e historias en MP4 sin marca.',
      howToSteps: [
        { number: '01', title: 'Copiar enlace de Spotlight', codeHint: 'snapchat.com/spotlight/{ID}', description: 'Copia la URL compartible del video de Snapchat.' },
        { number: '02', title: 'Pegar en VIDNEX', codeHint: 'ANALIZADOR SNAP', description: 'Pega el enlace en la barra de entrada.' },
        { number: '03', title: 'Descargar MP4 Vertical', codeHint: '9:16 ORIGINAL', description: 'Guarda el video en tu galería.' },
      ],
      faqs: [
        { question: '¿Puedo bajar Snaps privados?', answer: 'No, solo se admiten enlaces públicos de Spotlight e Historias públicas.' },
      ],
    },
  },

  /* ==========================================================================
   * PORTUGUÊS TOOL SILOS
   * ======================================================================== */
  pt: {
    'instagram-reels': {
      shortLabel: 'Reels HD',
      h1: 'Baixar Reels do Instagram em HD (1080p)',
      subtitle: 'Extraia vídeos do Instagram Reels em MP4 1080p original a 60fps com áudio AAC e sem marca d’água.',
      metaTitle: 'Baixar Reels do Instagram — MP4 1080p Sem Marca d’Água | VIDNEX',
      metaDescription: 'Baixe Reels do Instagram em qualidade original 1080p MP4 gratuitamente no celular e PC.',
      howToSteps: [
        { number: '01', title: 'Copiar link do Reel', codeHint: 'instagram.com/reel/{ID}', description: 'Toque em Compartilhar no Reel público do Instagram e copie o link.' },
        { number: '02', title: 'Colar no VIDNEX', codeHint: 'DETECÇÃO AUTOMÁTICA', description: 'Cole a URL acima para validação imediata.' },
        { number: '03', title: 'Salvar MP4 1080p Original', codeHint: 'FLUXO CDN DIRETO', description: 'Clique em Baixar HD 1080p ou Extrair Áudio (MP3).' },
      ],
      faqs: [
        { question: 'O VIDNEX reduz a qualidade dos Reels?', answer: 'Não. O vídeo é baixado diretamente do servidor CDN do Instagram na resolução original 1080×1920.' },
      ],
    },
    'instagram-dp': {
      shortLabel: 'Foto de Perfil',
      h1: 'Baixar Foto de Perfil do Instagram em Tamanho Original HD',
      subtitle: 'Visualize e baixe qualquer foto de perfil do Instagram (DP) em 1080×1080 JPG com zoom HD de 100%.',
      metaTitle: 'Ver e Baixar Foto de Perfil do Instagram HD (Tamanho Real) | VIDNEX',
      metaDescription: 'Dê zoom de 100% e baixe fotos de perfil do Instagram em alta resolução 1080×1080 JPG.',
      howToSteps: [
        { number: '01', title: 'Copiar URL do perfil', codeHint: 'instagram.com/{usuario}', description: 'Copie o link do perfil do Instagram.' },
        { number: '02', title: 'Ativar Zoom HD 100%', codeHint: 'PROPORÇÃO 1:1', description: 'Cole no VIDNEX para ver a foto sem o corte circular.' },
        { number: '03', title: 'Baixar JPG Original', codeHint: 'JPG sRGB PURO', description: 'Clique em Baixar Foto de Perfil HD Tamanho Original.' },
      ],
      faqs: [
        { question: 'Funciona para perfis privados do Instagram?', answer: 'Sim, a foto de perfil principal é pública e pode ser visualizada em alta definição.' },
      ],
    },
    'instagram-carousel': {
      shortLabel: 'Carrossel',
      h1: 'Baixar Fotos e Carrossel do Instagram (.ZIP)',
      subtitle: 'Extraia até 20 fotos e vídeos de posts carrossel do Instagram individualmente ou em arquivo .ZIP.',
      metaTitle: 'Baixar Carrossel e Fotos do Instagram em HD (.ZIP) | VIDNEX',
      metaDescription: 'Salve todas as fotos e vídeos de um carrossel do Instagram em 1080×1350.',
      howToSteps: [
        { number: '01', title: 'Copiar link do post', codeHint: 'instagram.com/p/{ID}', description: 'Copie a URL da publicação carrossel.' },
        { number: '02', title: 'Selecionar slides', codeHint: 'GRADE INTERATIVA', description: 'Marque os itens desejados ou clique em Selecionar Tudo.' },
        { number: '03', title: 'Baixar individual ou .ZIP', codeHint: 'PACOTE COMPLETO', description: 'Salve cada arquivo ou baixe tudo em .ZIP.' },
      ],
      faqs: [
        { question: 'Quantos slides são suportados?', answer: 'Suporta o limite completo de até 20 fotos e vídeos por carrossel.' },
      ],
    },
    'instagram-stories': {
      shortLabel: 'Stories',
      h1: 'Baixar Stories do Instagram Anonimamente',
      subtitle: 'Assista e baixe Stories públicos do Instagram em 1080p vertical sem aparecer na lista de visualizações.',
      metaTitle: 'Baixar Stories do Instagram em HD Anonimamente | VIDNEX',
      metaDescription: 'Salve Stories públicos do Instagram em MP4 1080p sem precisar fazer login.',
      howToSteps: [
        { number: '01', title: 'Copiar link do Story', codeHint: 'instagram.com/stories/{user}', description: 'Copie o link do Story público.' },
        { number: '02', title: 'Processar via Proxy Anônimo', codeHint: 'ZERO RASTRO', description: 'Cole o link no VIDNEX.' },
        { number: '03', title: 'Salvar MP4 Vertical', codeHint: '9:16 NATIVO', description: 'Baixe o vídeo ou foto em qualidade original.' },
      ],
      faqs: [
        { question: 'O criador saberá que visualizei o Story?', answer: 'Não, todo o processo ocorre via proxy anônimo sem login.' },
      ],
    },
    'tiktok-no-watermark': {
      shortLabel: 'Vídeo Sem Marca',
      h1: 'Baixar Vídeo do TikTok Sem Marca d’Água (HD)',
      subtitle: 'Salve vídeos do TikTok em MP4 1080p original sem o logotipo flutuante.',
      metaTitle: 'Baixar TikTok Sem Marca d’Água — MP4 HD 1080p | VIDNEX',
      metaDescription: 'Baixe vídeos do TikTok sem marca d’água em qualidade original MP4 1080p.',
      howToSteps: [
        { number: '01', title: 'Copiar link do TikTok', codeHint: 'tiktok.com/@user/video/{ID}', description: 'Toque em Compartilhar e Copiar link no TikTok.' },
        { number: '02', title: 'Colar no VIDNEX', codeHint: 'SEM MARCA D’ÁGUA', description: 'Cole o link acima para extrair o arquivo limpo.' },
        { number: '03', title: 'Baixar MP4 1080p', codeHint: 'BITRATE ORIGINAL', description: 'Clique em Baixar HD 1080p (Sem Marca d’Água).' },
      ],
      faqs: [
        { question: 'Links curtos vm.tiktok.com funcionam?', answer: 'Sim, todos os links móveis e de computador são reconhecidos.' },
      ],
    },
    'tiktok-slideshow': {
      shortLabel: 'Modo Foto',
      h1: 'Baixar Carrossel de Fotos do TikTok (Slideshow)',
      subtitle: 'Extraia todas as imagens em alta resolução do Modo Foto do TikTok sem marca d’água.',
      metaTitle: 'Baixar Fotos de Slideshow do TikTok Sem Marca d’Água | VIDNEX',
      metaDescription: 'Salve fotos de carrossel do TikTok em JPG HD individualmente ou em .ZIP.',
      howToSteps: [
        { number: '01', title: 'Copiar link das fotos', codeHint: 'tiktok.com/@user/photo/{ID}', description: 'Copie o link do post de fotos no TikTok.' },
        { number: '02', title: 'Selecionar imagens', codeHint: 'GRADE DE FOTOS', description: 'Visualize todas as fotos sem marca d’água.' },
        { number: '03', title: 'Baixar JPGs ou .ZIP', codeHint: 'ARQUIVO LOTE', description: 'Baixe fotos individuais ou o pacote .ZIP.' },
      ],
      faqs: [
        { question: 'As fotos vêm sem o logo do TikTok?', answer: 'Sim, todas as imagens são salvas em JPG 1080p limpo.' },
      ],
    },
    'tiktok-mp3': {
      shortLabel: 'Áudio MP3',
      h1: 'Converter TikTok para MP3 (Áudio Original)',
      subtitle: 'Extraia músicas e áudios virais do TikTok em MP3 de alta qualidade em um clique.',
      metaTitle: 'Baixar Áudio do TikTok em MP3 | VIDNEX',
      metaDescription: 'Converta vídeos do TikTok em arquivos de áudio MP3 instantaneamente.',
      howToSteps: [
        { number: '01', title: 'Copiar link do vídeo', codeHint: 'LINK DE ORIGEM', description: 'Copie a URL do vídeo do TikTok.' },
        { number: '02', title: 'Extrair faixa de áudio', codeHint: 'AAC -> MP3', description: 'Cole o link no VIDNEX.' },
        { number: '03', title: 'Salvar arquivo MP3', codeHint: 'DOWNLOAD DIRETO', description: 'Clique em Extrair Áudio (MP3).' },
      ],
      faqs: [
        { question: 'Qual é a qualidade do MP3?', answer: 'Extraímos a faixa de áudio original na taxa máxima de bits disponível.' },
      ],
    },
    'tiktok-dp': {
      shortLabel: 'Perfil HD',
      h1: 'Baixar Foto de Perfil do TikTok em HD',
      subtitle: 'Visualize e salve o avatar de qualquer criador do TikTok em resolução 1080×1080.',
      metaTitle: 'Baixar Foto de Perfil do TikTok Tamanho Completo HD | VIDNEX',
      metaDescription: 'Amplie em 100% e baixe fotos de perfil do TikTok em JPG 1080×1080.',
      howToSteps: [
        { number: '01', title: 'Copiar link do perfil', codeHint: 'tiktok.com/@{usuario}', description: 'Copie a URL do perfil no TikTok.' },
        { number: '02', title: 'Ativar Zoom HD 100%', codeHint: 'RESOLUÇÃO TOTAL', description: 'Veja a imagem quadrada completa.' },
        { number: '03', title: 'Salvar JPG Original', codeHint: 'AVATAR 1080P', description: 'Baixe a foto em alta definição.' },
      ],
      faqs: [
        { question: 'Posso usar apenas o link @usuario?', answer: 'Sim, o VIDNEX abre automaticamente o visualizador de foto de perfil.' },
      ],
    },
    'youtube-shorts': {
      shortLabel: 'YT Shorts / HD',
      h1: 'Baixar YouTube Shorts e Vídeos em 1080p',
      subtitle: 'Download direto de YouTube Shorts e vídeos públicos em MP4 1080p60 ou áudio MP3.',
      metaTitle: 'Baixar YouTube Shorts em MP4 1080p HD e MP3 | VIDNEX',
      metaDescription: 'Salve YouTube Shorts e vídeos em 1080p MP4 com áudio ou converta para MP3.',
      howToSteps: [
        { number: '01', title: 'Copiar link do YouTube', codeHint: 'youtube.com/shorts/{ID}', description: 'Copie a URL do Short ou vídeo.' },
        { number: '02', title: 'Colar no VIDNEX', codeHint: 'ANÁLISE DE STREAM', description: 'Cole o link no campo principal.' },
        { number: '03', title: 'Baixar MP4 1080p ou MP3', codeHint: 'VÍDEO + ÁUDIO', description: 'Salve o arquivo MP4 completo ou apenas o áudio.' },
      ],
      faqs: [
        { question: 'O download em 1080p inclui áudio?', answer: 'Sim, entregamos o arquivo MP4 1080p já sincronizado com áudio AAC.' },
      ],
    },
    'x-video': {
      shortLabel: 'Vídeo X / GIF',
      h1: 'Baixar Vídeos e GIFs do X (Twitter) em MP4',
      subtitle: 'Converta vídeos e GIFs de posts do X diretamente em arquivos MP4 HD.',
      metaTitle: 'Baixar Vídeos do X (Twitter) em MP4 HD | VIDNEX',
      metaDescription: 'Salve vídeos e GIFs do X (Twitter) em MP4 1080p a partir de links x.com e twitter.com.',
      howToSteps: [
        { number: '01', title: 'Copiar link do post no X', codeHint: 'x.com/{user}/status/{ID}', description: 'Copie o link da publicação.' },
        { number: '02', title: 'Colar no VIDNEX', codeHint: 'HLS PARA MP4', description: 'Obtenha a versão de maior resolução.' },
        { number: '03', title: 'Salvar MP4', codeHint: 'DOWNLOAD DIRETO', description: 'Baixe o vídeo no seu dispositivo.' },
      ],
      faqs: [
        { question: 'Aceita links x.com e twitter.com?', answer: 'Sim, ambos os domínios funcionam automaticamente.' },
      ],
    },
    'facebook-reels': {
      shortLabel: 'FB Reels / Watch',
      h1: 'Baixar Reels e Vídeos do Facebook em HD',
      subtitle: 'Salve Reels públicos e vídeos do Facebook Watch em MP4 1080p ou 720p sem login.',
      metaTitle: 'Baixar Reels e Vídeos do Facebook em MP4 1080p | VIDNEX',
      metaDescription: 'Baixe vídeos públicos e Reels do Facebook em alta definição MP4.',
      howToSteps: [
        { number: '01', title: 'Copiar link do Facebook', codeHint: 'facebook.com/reel/{ID}', description: 'Copie a URL do Reel ou vídeo público.' },
        { number: '02', title: 'Colar no VIDNEX', codeHint: 'DETECÇÃO HD', description: 'Cole o link na barra acima.' },
        { number: '03', title: 'Baixar MP4 1080p', codeHint: 'DOWNLOAD DIRETO', description: 'Salve o arquivo MP4 em qualidade original.' },
      ],
      faqs: [
        { question: 'Suporta links curtos fb.watch?', answer: 'Sim, links fb.watch e facebook.com/reel são suportados.' },
      ],
    },
    'snapchat-spotlight': {
      shortLabel: 'Spotlight HD',
      h1: 'Baixar Vídeos do Snapchat Spotlight e Stories',
      subtitle: 'Salve vídeos verticais públicos do Snapchat Spotlight em MP4 9:16 original.',
      metaTitle: 'Baixar Snapchat Spotlight em MP4 HD | VIDNEX',
      metaDescription: 'Baixe vídeos públicos do Snapchat Spotlight e Stories em MP4 sem marca.',
      howToSteps: [
        { number: '01', title: 'Copiar link do Spotlight', codeHint: 'snapchat.com/spotlight/{ID}', description: 'Copie o link público do vídeo no Snapchat.' },
        { number: '02', title: 'Colar no VIDNEX', codeHint: 'PARSER SNAP', description: 'Cole a URL no campo acima.' },
        { number: '03', title: 'Salvar MP4 Vertical', codeHint: '9:16 ORIGINAL', description: 'Baixe o vídeo diretamente.' },
      ],
      faqs: [
        { question: 'Posso baixar Snaps privados?', answer: 'Não, apenas vídeos públicos do Spotlight e Stories públicos.' },
      ],
    },
  },

  /* ==========================================================================
   * العربية TOOL SILOS (FULL RTL ARABIC SEO)
   * ======================================================================== */
  ar: {
    'instagram-reels': {
      shortLabel: 'ريلز HD',
      h1: 'تحميل ريلز إنستغرام بجودة عالية HD',
      subtitle:
        'استخرج مقاطع ريلز إنستغرام بدقة 1080p MP4 الأصلية (60 إطاراً/ثانية) مع صوت نقي وبدون علامة مائية.',
      metaTitle: 'تحميل ريلز إنستغرام بدقة 1080p MP4 بدون علامة مائية | VIDNEX',
      metaDescription:
        'قم بتحميل فيديوهات ريلز إنستغرام بالجودة الأصلية 1080p HD MP4 بدون علامة مائية مجاناً للهاتف والكمبيوتر.',
      howToSteps: [
        {
          number: '01',
          title: 'نسخ رابط ريلز إنستغرام',
          codeHint: 'instagram.com/reel/{ID}',
          description:
            'افتح تطبيق أو موقع إنستغرام، اضغط على زر المشاركة في أي مقطع ريلز عام واختر نسخ الرابط.',
        },
        {
          number: '02',
          title: 'لصق الرابط في صندوق VIDNEX',
          codeHint: 'فحص تلقائي فوري',
          description:
            'الصق الرابط في الحقل أعلاه ليتم التعرف على المقطع فوراً دون إعادة تحميل الصفحة.',
        },
        {
          number: '03',
          title: 'حفظ الفيديو بدقة 1080p MP4',
          codeHint: 'بث مباشر أصلي',
          description:
            'اضغط على تحميل بدقة HD 1080p أو استخراج الصوت (MP3) لحفظ الملف الأصلي.',
        },
      ],
      faqs: [
        {
          question: 'هل يقوم VIDNEX بضغط أو تقليل جودة ريلز إنستغرام؟',
          answer:
            'لا. يقوم VIDNEX بجلب البث المباشر الأصلي من خوادم إنستغرام مع الحفاظ الكامل على أبعاد 1080×1920 ومعدل البت الأصلي.',
        },
        {
          question: 'هل يمكنني استخراج الصوت فقط بصيغة MP3 من ريلز إنستغرام؟',
          answer:
            'نعم، يوفر كل مقطع خيار "استخراج الصوت (MP3)" لتحميل الموسيقى أو الصوت الأصلي بضغطة واحدة.',
        },
      ],
    },
    'instagram-dp': {
      shortLabel: 'صورة البروفايل',
      h1: 'تحميل وتكبير صورة بروفايل إنستغرام بالحجم الكامل HD',
      subtitle:
        'شاهد وحمّل أي صورة حساب إنستغرام شخصية (DP) بدقتها الكاملة 1080×1080 JPG مع ميزة التكبير 100% HD.',
      metaTitle:
        'تكبير وتحميل صورة بروفايل إنستغرام بالحجم الكامل HD | VIDNEX',
      metaDescription:
        'استعرض وحمّل الصور الشخصية لحسابات إنستغرام بأبعادها الأصلية 1080×1080 بدون اقتصاص دائري.',
      howToSteps: [
        {
          number: '01',
          title: 'نسخ رابط الحساب الشخصي',
          codeHint: 'instagram.com/{username}',
          description: 'انسخ رابط صفحة الحساب من تطبيق إنستغرام أو المتصفح.',
        },
        {
          number: '02',
          title: 'استعراض بتكبير 100% HD',
          codeHint: 'أبعاد 1:1 الأصلية',
          description:
            'الصق الرابط في VIDNEX لتجاوز الصورة المصغرة واستعراض الصورة الكاملة عالية الدقة.',
        },
        {
          number: '03',
          title: 'تحميل صورة JPG الأصلية',
          codeHint: 'JPG غير مضغوط',
          description:
            'اضغط على تحميل الصورة الشخصية بالحجم الكامل HD لحفظها على جهازك.',
        },
      ],
      faqs: [
        {
          question: 'هل يمكنني رؤية الصورة الشخصية لحساب إنستغرام خاص (Private)؟',
          answer:
            'نعم، الصورة الشخصية الرئيسية متاحة ضمن البيانات العامة، لذا يتيح VIDNEX عرضها وتحميلها بالحجم الكامل للحسابات العامة والخاصة.',
        },
      ],
    },
    'instagram-carousel': {
      shortLabel: 'ألبوم صور',
      h1: 'تحميل صور وألبومات إنستغرام المتعددة (Carousel)',
      subtitle:
        'استخرج حتى 20 صورة وفيديو من منشورات إنستغرام المتعددة بشكل فردي أو في ملف مضغوط .ZIP واحد.',
      metaTitle: 'تحميل ألبومات وصور إنستغرام بدقة عالية (.ZIP) | VIDNEX',
      metaDescription:
        'حمّل جميع الصور والفيديوهات من منشورات الكاروسيل في إنستغرام بدقة 1080×1350 الأصلية.',
      howToSteps: [
        {
          number: '01',
          title: 'نسخ رابط منشور إنستغرام',
          codeHint: 'instagram.com/p/{ID}',
          description: 'انسخ رابط المنشور الذي يحتوي على صورة أو عدة شرائح.',
        },
        {
          number: '02',
          title: 'تحديد الصور والفيديوهات',
          codeHint: 'شبكة تحديد متعددة',
          description:
            'حدد الشرائح المطلوبة من الشبكة أو اضغط على تحديد الكل.',
        },
        {
          number: '03',
          title: 'التحميل الفردي أو بصيغة .ZIP',
          codeHint: 'أرشيف كامل',
          description:
            'احفظ كل شريحة على حدة أو حمّل جميع الشرائح المختارة في ملف .ZIP واحد.',
        },
      ],
      faqs: [
        {
          question: 'كم عدد الشرائح التي يدعمها VIDNEX في المنشور الواحد؟',
          answer:
            'يدعم استخراج حتى 20 شريحة في المنشور الواحد، سواء كانت صوراً بصيغة JPG أو مقاطع فيديو MP4.',
        },
      ],
    },
    'instagram-stories': {
      shortLabel: 'ستوري',
      h1: 'تحميل ستوري إنستغرام بشكل سري وبدون حساب',
      subtitle:
        'شاهد وحمّل قصص (Stories) إنستغرام العامة بدقة 1080p العمودية دون ظهور اسمك في قائمة المشاهدين.',
      metaTitle: 'تحميل ستوري إنستغرام بدقة HD بشكل سري | VIDNEX',
      metaDescription:
        'احفظ قصص وستوريات إنستغرام العامة بصيغة MP4 و JPG بخصوصية تامة وبدون تسجيل دخول.',
      howToSteps: [
        {
          number: '01',
          title: 'نسخ رابط الستوري العام',
          codeHint: 'instagram.com/stories/{user}',
          description: 'انسخ رابط القصة العامة من إنستغرام.',
        },
        {
          number: '02',
          title: 'الاستخراج عبر وسيط مجهول',
          codeHint: 'بدون أثر مشاهدة',
          description:
            'الصق الرابط في VIDNEX ليتم جلب الستوري دون تسجيل أي مشاهدة باسمك.',
        },
        {
          number: '03',
          title: 'حفظ الستوري بدقة 1080p',
          codeHint: 'أبعاد 9:16 أصلية',
          description: 'حمّل الفيديو أو الصورة مباشرة على هاتفك أو حاسوبك.',
        },
      ],
      faqs: [
        {
          question: 'هل سيعرف صاحب الحساب أنني شاهدت أو حمّلت الستوري؟',
          answer:
            'لا نهائياً، لأن العملية تتم عبر خادم وسيط دون تسجيل دخول إلى حسابك الشخصي.',
        },
      ],
    },
    'tiktok-no-watermark': {
      shortLabel: 'فيديو بدون علامة',
      h1: 'تحميل فيديو تيك توك بدون علامة مائية (HD)',
      subtitle:
        'احفظ مقاطع تيك توك بجودة المصدر الأصلية 1080p MP4 بدون العلامة المائية المتحركة أو شاشة النهاية.',
      metaTitle: 'تحميل تيك توك بدون علامة مائية — MP4 HD 1080p | VIDNEX',
      metaDescription:
        'حمّل فيديوهات تيك توك بدون علامة مائية بدقة 1080p HD MP4 مجاناً وبسرعة فائقة.',
      howToSteps: [
        {
          number: '01',
          title: 'نسخ رابط فيديو تيك توك',
          codeHint: 'tiktok.com/@user/video/{ID}',
          description:
            'اضغط على مشاركة ثم نسخ الرابط في تطبيق تيك توك (يدعم الروابط القصيرة vm.tiktok.com أيضاً).',
        },
        {
          number: '02',
          title: 'لصق الرابط في VIDNEX',
          codeHint: 'إزالة العلامة المائية',
          description:
            'الصق الرابط في الصندوق أعلاه للوصول إلى ملف الفيديو الخام غير المختوم.',
        },
        {
          number: '03',
          title: 'تحميل الفيديو بدقة 1080p MP4',
          codeHint: 'جودة أصلية نقية',
          description:
            'اضغط على تحميل بدقة HD 1080p (بدون علامة مائية) لحفظ الفيديو فوراً.',
        },
      ],
      faqs: [
        {
          question: 'كيف يزيل VIDNEX العلامة المائية دون تشويه الفيديو؟',
          answer:
            'لا يقوم VIDNEX بقص الفيديو أو تمويهه، بل يستخرج النسخة الأصلية النظيفة مباشرة من خوادم تيك توك قبل إضافة الشعار.',
        },
      ],
    },
    'tiktok-slideshow': {
      shortLabel: 'عرض صور',
      h1: 'تحميل صور شرائح تيك توك بدون علامة مائية (Slideshow)',
      subtitle:
        'استخرج جميع الصور عالية الدقة من منشورات وضع الصور في تيك توك بدون علامة مائية مع المقطع الصوتي.',
      metaTitle: 'تحميل صور تيك توك (Slideshow) بدون علامة مائية | VIDNEX',
      metaDescription:
        'احفظ صور شرائح تيك توك بصيغة JPG HD فردية أو كملف مضغوط .ZIP بدون علامة مائية.',
      howToSteps: [
        {
          number: '01',
          title: 'نسخ رابط صور تيك توك',
          codeHint: 'tiktok.com/@user/photo/{ID}',
          description: 'انسخ رابط المنشور الذي يحتوي على ألبوم صور في تيك توك.',
        },
        {
          number: '02',
          title: 'معاينة وتحديد الصور',
          codeHint: 'شبكة صور تفاعلية',
          description: 'استعرض جميع الشرائح بدون علامة مائية في الشبكة.',
        },
        {
          number: '03',
          title: 'حفظ الصور أو ملف .ZIP',
          codeHint: 'تحميل دفعة واحدة',
          description: 'حمّل كل صورة بصيغة JPG أو احفظ الألبوم كاملاً بصيغة .ZIP.',
        },
      ],
      faqs: [
        {
          question: 'هل الصور المحملة خالية تماماً من شعار تيك توك؟',
          answer: 'نعم، يتم استخراج كل صورة بدقة 1080p JPG نقية بدون أي شعارات.',
        },
      ],
    },
    'tiktok-mp3': {
      shortLabel: 'صوت MP3',
      h1: 'تحويل فيديو تيك توك إلى صوت MP3 أصلي',
      subtitle:
        'استخرج الأصوات والموسيقى والمؤثرات الصوتية من أي رابط تيك توك بصيغة MP3 عالية النقاء بضغطة واحدة.',
      metaTitle: 'تحويل تيك توك إلى MP3 — استخراج الصوت الأصلي | VIDNEX',
      metaDescription:
        'حوّل مقاطع تيك توك إلى ملفات صوتية MP3 عالية الجودة فوراً.',
      howToSteps: [
        {
          number: '01',
          title: 'نسخ رابط فيديو تيك توك',
          codeHint: 'رابط الفيديو المصدر',
          description: 'انسخ رابط المقطع الذي تريد استخراج صوته.',
        },
        {
          number: '02',
          title: 'فصل المسار الصوتي',
          codeHint: 'AAC -> MP3',
          description: 'الصق الرابط في VIDNEX لمعالجة البث الصوتي.',
        },
        {
          number: '03',
          title: 'تحميل ملف MP3',
          codeHint: 'حفظ صوتي مباشر',
          description: 'اضغط على استخراج الصوت (MP3) لحفظ الملف.',
        },
      ],
      faqs: [
        {
          question: 'ما هي جودة ملف MP3 المستخرج؟',
          answer:
            'يستخرج VIDNEX المسار الصوتي الأصلي بأعلى معدل بت متاح على خوادم المنصة.',
        },
      ],
    },
    'tiktok-dp': {
      shortLabel: 'بروفايل HD',
      h1: 'تحميل صورة بروفايل تيك توك بالحجم الكامل HD',
      subtitle:
        'استعرض وحمّل الصورة الشخصية لأي صانع محتوى على تيك توك بأبعاد 1080×1080 الكاملة.',
      metaTitle: 'تحميل صورة حساب تيك توك الشخصية بدقة HD | VIDNEX',
      metaDescription:
        'قم بتكبير وتحميل صور بروفايل تيك توك بدقة 1080×1080 JPG الأصلية.',
      howToSteps: [
        {
          number: '01',
          title: 'نسخ رابط حساب تيك توك',
          codeHint: 'tiktok.com/@{handle}',
          description: 'انسخ رابط ملف تعريف المستخدم على تيك توك.',
        },
        {
          number: '02',
          title: 'تفعيل تكبير 100% HD',
          codeHint: 'دقة كاملة',
          description: 'شاهد الصورة المربعة الكاملة بدون اقتصاص.',
        },
        {
          number: '03',
          title: 'حفظ صورة JPG الأصلية',
          codeHint: 'أفاتار 1080P',
          description: 'اضغط على تحميل الصورة الشخصية بالحجم الكامل HD.',
        },
      ],
      faqs: [
        {
          question: 'هل يكفي وضع رابط الحساب @username فقط؟',
          answer:
            'نعم، سيتعرف النظام تلقائياً على أنه رابط حساب شخصي ويعرض أداة تكبير الصورة.',
        },
      ],
    },
    'youtube-shorts': {
      shortLabel: 'يوتيوب شورتس',
      h1: 'تحميل يوتيوب شورتس وفيديوهات يوتيوب بدقة 1080p',
      subtitle:
        'استخراج مباشر لمقاطع YouTube Shorts والفيديوهات العامة بدقة 1080p60 MP4 أو صوت MP3.',
      metaTitle: 'تحميل يوتيوب شورتس بدقة 1080p HD MP4 و MP3 | VIDNEX',
      metaDescription:
        'حمّل مقاطع يوتيوب شورتس والفيديوهات العامة بدقة 1080p MP4 مع الصوت أو بصيغة MP3.',
      howToSteps: [
        {
          number: '01',
          title: 'نسخ رابط يوتيوب شورتس',
          codeHint: 'youtube.com/shorts/{ID}',
          description: 'انسخ رابط المقطع من تطبيق يوتيوب أو المتصفح.',
        },
        {
          number: '02',
          title: 'لصق الرابط في VIDNEX',
          codeHint: 'تحليل البث',
          description: 'الصق الرابط في الحقل العلوي.',
        },
        {
          number: '03',
          title: 'اختيار MP4 1080p أو MP3',
          codeHint: 'فيديو مدمج بالصوت',
          description: 'حمّل الفيديو كاملاً مع الصوت أو اختر ملف MP3 الصوتي.',
        },
      ],
      faqs: [
        {
          question: 'هل يتضمن تحميل 1080p الصوت مع الفيديو؟',
          answer:
            'نعم، يتم دمج مسار الفيديو 1080p مع مسار الصوت AAC في ملف MP4 واحد جاهز للتشغيل.',
        },
      ],
    },
    'x-video': {
      shortLabel: 'فيديو إكس / GIF',
      h1: 'تحميل فيديو وصور متحركة GIF من منصة X (تويتر)',
      subtitle:
        'احفظ مقاطع الفيديو والصور المتحركة من منشورات X (تويتر سابقاً) مباشرة بصيغة MP4 عالية الدقة.',
      metaTitle: 'تحميل فيديو من X (تويتر) بصيغة MP4 HD | VIDNEX',
      metaDescription:
        'حمّل الفيديوهات والصور المتحركة GIF من منصة إكس (تويتر) بدقة 1080p MP4.',
      howToSteps: [
        {
          number: '01',
          title: 'نسخ رابط التغريدة في X',
          codeHint: 'x.com/{user}/status/{ID}',
          description: 'انسخ رابط المنشور العام الذي يحتوي على الفيديو.',
        },
        {
          number: '02',
          title: 'لصق الرابط في VIDNEX',
          codeHint: 'استخراج أعلى دقة',
          description: 'يقوم النظام باستخراج أعلى نسخة MP4 متوفرة.',
        },
        {
          number: '03',
          title: 'حفظ ملف MP4',
          codeHint: 'تشغيل شامل',
          description: 'حمّل الفيديو مباشرة على جهازك.',
        },
      ],
      faqs: [
        {
          question: 'هل يدعم روابط x.com و twitter.com القديمة؟',
          answer: 'نعم، يدعم كلا النطاقين بشكل تلقائي.',
        },
      ],
    },
    'facebook-reels': {
      shortLabel: 'ريلز فيسبوك',
      h1: 'تحميل ريلز وفيديوهات فيسبوك بدقة HD',
      subtitle:
        'حمّل مقاطع ريلز فيسبوك العامة وفيديوهات Watch بدقة 1080p أو 720p MP4 بدون تسجيل دخول.',
      metaTitle: 'تحميل ريلز وفيديوهات فيسبوك بدقة 1080p MP4 | VIDNEX',
      metaDescription:
        'احفظ مقاطع ريلز وفيديوهات فيسبوك العامة بجودة عالية MP4 و MP3.',
      howToSteps: [
        {
          number: '01',
          title: 'نسخ رابط فيديو فيسبوك',
          codeHint: 'facebook.com/reel/{ID}',
          description: 'انسخ رابط المقطع العام من تطبيق فيسبوك.',
        },
        {
          number: '02',
          title: 'لصق الرابط في VIDNEX',
          codeHint: 'معالجة البث HD',
          description: 'الصق الرابط في صندوق الإدخال.',
        },
        {
          number: '03',
          title: 'تحميل الفيديو بدقة 1080p',
          codeHint: 'حفظ مباشر',
          description: 'اضغط على زر التحميل لحفظ ملف MP4.',
        },
      ],
      faqs: [
        {
          question: 'هل تعمل الروابط المختصرة fb.watch؟',
          answer: 'نعم، يدعم النظام روابط fb.watch وروابط facebook.com/reel الكاملة.',
        },
      ],
    },
    'snapchat-spotlight': {
      shortLabel: 'سناب سبوت لايت',
      h1: 'تحميل فيديوهات سناب شات Spotlight والقصص العامة',
      subtitle:
        'احفظ مقاطع سناب شات سبوت لايت العمودية والقصص العامة بدقة 9:16 HD MP4 الأصلية.',
      metaTitle: 'تحميل سناب شات Spotlight والقصص العامة بدقة HD | VIDNEX',
      metaDescription:
        'حمّل مقاطع سناب شات سبوت لايت العامة بصيغة MP4 بدون علامة مائية.',
      howToSteps: [
        {
          number: '01',
          title: 'نسخ رابط سناب شات سبوت لايت',
          codeHint: 'snapchat.com/spotlight/{ID}',
          description: 'انسخ رابط المشاركة العام للمقطع من سناب شات.',
        },
        {
          number: '02',
          title: 'لصق الرابط في VIDNEX',
          codeHint: 'محلل سناب شات',
          description: 'الصق الرابط في الحقل العلوي.',
        },
        {
          number: '03',
          title: 'تحميل ملف MP4 العمودي',
          codeHint: 'أبعاد 9:16 الأصلية',
          description: 'احفظ الفيديو مباشرة على جهازك.',
        },
      ],
      faqs: [
        {
          question: 'هل يمكن تحميل السنابات الخاصة؟',
          answer:
            'لا، يدعم VIDNEX فقط مقاطع Spotlight والقصص العامة التي تمتلك رابط مشاركة عام.',
        },
      ],
    },
  },
};

/**
 * Returns a localized SeoToolConfig for the active language while keeping
 * structural properties (slug, path, platform, placeholder, sampleUrl, specs) intact.
 */
export function getLocalizedToolConfig(
  baseConfig: SeoToolConfig,
  lang: LanguageCode
): SeoToolConfig {
  if (lang === 'en') {
    return baseConfig;
  }
  const localized = TOOL_TRANSLATIONS[lang]?.[baseConfig.slug];
  if (!localized) {
    return baseConfig;
  }
  return {
    ...baseConfig,
    ...localized,
  };
}

export {
  parsePathname,
  buildLocalizedPath,
  handleLegacyQueryRedirect,
  isSupportedLanguage,
  isValidToolSlug,
} from '../utils/i18nRouting.ts';
