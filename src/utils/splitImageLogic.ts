import JSZip from 'jszip';
import type { SupportedLocale } from '../i18n/config.ts';
import type { EditorialBlock, FaqItem, HowToStepItem } from '../i18n/types.ts';

export const MAX_SPLIT_IMAGE_DIMENSION = 8000;
export const MIN_GRID_AXIS = 1;
export const MAX_GRID_AXIS = 10;

export type GridPresetId = '2x2' | '3x3' | '1x3' | '3x1' | 'custom';
export type SplitOutputFormat = 'png' | 'jpg';

export interface GridDimensions {
  rows: number;
  cols: number;
}

export interface DownscaledDimensions {
  width: number;
  height: number;
  wasDownscaled: boolean;
  scaleFactor: number;
}

export interface SplitGridCell {
  /** Zero-based row index from top to bottom */
  row: number;
  /** Zero-based column index from left to right */
  col: number;
  /** Zero-based sequential cell index in top-to-bottom, left-to-right reading order */
  cellIndex: number;
  /** Display & download order number (1..N). Reversed when instagramOrder is enabled. */
  orderNumber: number;
  /** Pixel X offset on the source (or downscaled) canvas */
  x: number;
  /** Pixel Y offset on the source (or downscaled) canvas */
  y: number;
  /** Pixel width of this slice */
  width: number;
  /** Pixel height of this slice */
  height: number;
  /** Output filename (e.g. image-1.png or image-1.jpg) */
  filename: string;
}

export interface GeneratedSliceItem extends SplitGridCell {
  blob: Blob;
  dataUrl: string;
  byteSize: number;
}

export function clampGridAxis(val: number): number {
  if (!Number.isFinite(val)) return MIN_GRID_AXIS;
  return Math.max(MIN_GRID_AXIS, Math.min(MAX_GRID_AXIS, Math.round(val)));
}

export function getPresetDimensions(
  preset: GridPresetId,
  customRows = 2,
  customCols = 2
): GridDimensions {
  switch (preset) {
    case '2x2':
      return { rows: 2, cols: 2 };
    case '3x3':
      return { rows: 3, cols: 3 };
    case '1x3':
      return { rows: 1, cols: 3 };
    case '3x1':
      return { rows: 3, cols: 1 };
    case 'custom':
    default:
      return {
        rows: clampGridAxis(customRows),
        cols: clampGridAxis(customCols),
      };
  }
}

export function computeDownscaledDimensions(
  sourceWidth: number,
  sourceHeight: number,
  maxDimension: number = MAX_SPLIT_IMAGE_DIMENSION
): DownscaledDimensions {
  const safeW = Math.max(1, Math.round(sourceWidth));
  const safeH = Math.max(1, Math.round(sourceHeight));
  const safeMax = Math.max(1, Math.round(maxDimension));

  if (safeW <= safeMax && safeH <= safeMax) {
    return {
      width: safeW,
      height: safeH,
      wasDownscaled: false,
      scaleFactor: 1,
    };
  }

  const scaleFactor = safeMax / Math.max(safeW, safeH);
  const width = Math.max(1, Math.round(safeW * scaleFactor));
  const height = Math.max(1, Math.round(safeH * scaleFactor));

  return {
    width,
    height,
    wasDownscaled: true,
    scaleFactor,
  };
}

export function formatSliceFilename(
  orderNumber: number,
  format: SplitOutputFormat
): string {
  const safeNum = Math.max(1, Math.round(orderNumber));
  const ext = format === 'jpg' ? 'jpg' : 'png';
  return `image-${safeNum}.${ext}`;
}

export function computeSplitGridCells(params: {
  imageWidth: number;
  imageHeight: number;
  rows: number;
  cols: number;
  instagramOrder: boolean;
  format: SplitOutputFormat;
}): SplitGridCell[] {
  const safeRows = clampGridAxis(params.rows);
  const safeCols = clampGridAxis(params.cols);
  const imgW = Math.max(safeCols, Math.round(params.imageWidth));
  const imgH = Math.max(safeRows, Math.round(params.imageHeight));
  const totalCells = safeRows * safeCols;

  const cells: SplitGridCell[] = [];

  for (let r = 0; r < safeRows; r++) {
    const y0 = Math.round((r * imgH) / safeRows);
    const y1 = Math.round(((r + 1) * imgH) / safeRows);
    const cellHeight = Math.max(1, y1 - y0);

    for (let c = 0; c < safeCols; c++) {
      const x0 = Math.round((c * imgW) / safeCols);
      const x1 = Math.round(((c + 1) * imgW) / safeCols);
      const cellWidth = Math.max(1, x1 - x0);

      const cellIndex = r * safeCols + c;
      const orderNumber = params.instagramOrder
        ? totalCells - cellIndex
        : cellIndex + 1;

      cells.push({
        row: r,
        col: c,
        cellIndex,
        orderNumber,
        x: x0,
        y: y0,
        width: cellWidth,
        height: cellHeight,
        filename: formatSliceFilename(orderNumber, params.format),
      });
    }
  }

  return cells;
}

export async function buildZipArchiveWithJSZip(
  slices: ReadonlyArray<{ filename: string; data: Blob | Uint8Array | ArrayBuffer }>
): Promise<Blob> {
  const zip = new JSZip();
  for (const slice of slices) {
    zip.file(slice.filename, slice.data);
  }
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

export interface SplitImageLocaleContent {
  navLabel: string;
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  ogImageAlt: string;
  breadcrumbLabel: string;
  badgeText: string;
  h1: string;
  subtitle: string;
  dropzoneTitle: string;
  dropzoneSubtitle: string;
  selectFileCta: string;
  loadSampleCta: string;
  changeImageCta: string;
  downscaledNotice: string;
  gridHeading: string;
  preset2x2: string;
  preset3x3: string;
  preset1x3: string;
  preset3x1: string;
  presetCustom: string;
  rowsLabel: string;
  colsLabel: string;
  instagramOrderLabel: string;
  instagramOrderHint: string;
  formatHeading: string;
  formatPng: string;
  formatJpg: string;
  qualityLabel: string;
  previewHeading: string;
  sourceDimensionsLabel: string;
  sliceCountLabel: string;
  downloadAllZipCta: string;
  buildingZipCta: string;
  downloadSingleCta: string;
  slicesListHeading: string;
  privacyNotice: string;
  errorInvalidFile: string;
  editorial: EditorialBlock;
  howToSteps: [HowToStepItem, HowToStepItem, HowToStepItem];
  faqs: FaqItem[];
}

export const SPLIT_IMAGE_I18N: Record<SupportedLocale, SplitImageLocaleContent> = {
  fr: {
    navLabel: 'Outils',
    metaTitle: 'Découper une image en ligne (Grille Instagram) — VIDNEX',
    metaDescription:
      'Découpez vos images JPG, PNG et WebP en grille 2×2, 3×3 ou personnalisée pour Instagram. Outil gratuit 100 % local avec téléchargement ZIP.',
    ogTitle: 'Découper une image en ligne (Grille Instagram) — VIDNEX',
    ogDescription:
      'Découpez vos images JPG, PNG et WebP en grille 2×2, 3×3 ou personnalisée pour Instagram. Outil gratuit 100 % local avec téléchargement ZIP.',
    ogImageAlt: 'Outil VIDNEX pour découper une image en grille Instagram 3x3 ou 2x2',
    breadcrumbLabel: 'Découper une image',
    badgeText: '100 % LOCAL (CANVAS) · AUCUN UPLOAD · GRILLES INSTAGRAM & ZIP',
    h1: 'Découper une image en grille',
    subtitle:
      'Divisez instantanément vos photos JPG, PNG et WebP en grilles 2×2, 3×3, panoramas 1×3 ou dimensions sur mesure directement dans votre navigateur.',
    dropzoneTitle: 'Glissez-déposez votre image ici',
    dropzoneSubtitle: 'Formats acceptés : JPG, PNG, WebP (redimensionnement auto > 8000 px)',
    selectFileCta: 'Choisir une image',
    loadSampleCta: 'Essayer avec un exemple',
    changeImageCta: 'Changer d’image',
    downscaledNotice:
      'Image supérieure à 8000 px réduite automatiquement à {w}×{h} px pour garantir une découpe fluide.',
    gridHeading: 'Configuration de la grille',
    preset2x2: '2×2 (4 tuiles)',
    preset3x3: '3×3 (Grille IG)',
    preset1x3: '1×3 (Carrousel)',
    preset3x1: '3×1 (Vertical)',
    presetCustom: 'Personnalisée',
    rowsLabel: 'Lignes',
    colsLabel: 'Colonnes',
    instagramOrderLabel: 'Ordre Instagram',
    instagramOrderHint:
      'Inverse la numérotation (de la dernière case vers la première) pour publier dans l’ordre exact d’une grille de profil.',
    formatHeading: 'Format de sortie & qualité',
    formatPng: 'PNG (Sans perte)',
    formatJpg: 'JPG (Léger)',
    qualityLabel: 'Qualité JPG',
    previewHeading: 'Aperçu de la découpe',
    sourceDimensionsLabel: 'Dimensions',
    sliceCountLabel: 'Morceaux générés',
    downloadAllZipCta: 'Tout télécharger (ZIP)',
    buildingZipCta: 'Création du ZIP…',
    downloadSingleCta: 'Télécharger',
    slicesListHeading: 'Télécharger chaque image séparément',
    privacyNotice:
      'Traitement 100 % côté navigateur via HTML5 Canvas. Vos images ne quittent jamais votre appareil.',
    errorInvalidFile: 'Veuillez sélectionner un fichier image valide (JPG, PNG ou WebP).',
    editorial: {
      heading: 'Découpez vos visuels pour Instagram et vos carrousels sans perte de qualité',
      subheading: 'Un studio de découpe 100 % local, rapide et respectueux de votre vie privée',
      paragraphs: [
        'L’outil Découper une image de VIDNEX vous permet de scinder n’importe quelle photo ou affiche haute définition en tuiles parfaitement alignées. Que vous prépariez une mosaïque 3×3 pour votre profil Instagram, un panorama 1×3 à faire glisser en carrousel ou une grille personnalisée, le calcul s’effectue au pixel près directement dans votre navigateur.',
        'Contrairement aux services classiques qui envoient vos fichiers sur un serveur distant, VIDNEX utilise l’API HTML5 Canvas locale. Vos photos personnelles ou créations clients restent sur votre téléphone ou votre ordinateur. Si une image dépasse 8000 pixels, elle est automatiquement ajustée en conservant ses proportions exactes.',
      ],
      formatsTitle: 'Grilles et options prises en charge',
      formatsList: [
        'Grilles prédéfinies : 2×2 (4 images), 3×3 (9 images profil Instagram), 1×3 (bandeau horizontal), 3×1 (bandeau vertical)',
        'Grille personnalisée de 1 à 10 lignes et 1 à 10 colonnes',
        'Option « Ordre Instagram » inversant la numérotation pour publier vos photos dans le bon sens sur votre profil',
        'Export individuel (image-1, image-2…) ou archive complète en un clic via JSZip (PNG ou JPG avec qualité réglable)',
      ],
      limitsTitle: 'Confidentialité & performances',
      limitsText:
        'Aucune donnée n’est envoyée sur le réseau. La limite de sécurité de 8000 px évite toute saturation mémoire sur mobile tout en préservant une netteté maximale.',
    },
    howToSteps: [
      {
        number: '01',
        title: 'Importez votre image',
        description:
          'Glissez-déposez un fichier JPG, PNG ou WebP dans la zone dédiée ou cliquez sur « Choisir une image ».',
        codeHint: 'JPG / PNG / WebP · Max 8000 px auto',
      },
      {
        number: '02',
        title: 'Choisissez la grille et le format',
        description:
          'Sélectionnez 2×2, 3×3, 1×3, 3×1 ou définissez vos lignes et colonnes. Activez l’ordre Instagram si vous préparez une grille de profil.',
        codeHint: '2×2 · 3×3 · 1×3 · 3×1 · Ordre IG',
      },
      {
        number: '03',
        title: 'Téléchargez en ZIP ou à l’unité',
        description:
          'Vérifiez l’aperçu numéroté puis téléchargez toutes les tuiles en un fichier ZIP ou cliquez sur chaque morceau (image-1, image-2…).',
        codeHint: 'image-1.jpg … + Archive .ZIP',
      },
    ],
    faqs: [
      {
        question: 'À quoi sert l’option « Ordre Instagram » ?',
        answer:
          'Sur une grille de profil Instagram, la dernière photo publiée s’affiche en haut à gauche. En activant « Ordre Instagram », la numérotation commence en bas à droite (image-1) et finit en haut à gauche : il vous suffit de publier image-1, puis image-2, etc. pour que le puzzle final soit dans le bon sens.',
      },
      {
        question: 'Mes photos sont-elles envoyées sur un serveur ?',
        answer:
          'Non. Le découpage repose intégralement sur le moteur HTML5 Canvas et JSZip de votre navigateur. Aucune image n’est téléversée ni stockée sur nos serveurs.',
      },
      {
        question: 'Que se passe-t-il si mon image dépasse 8000 pixels ?',
        answer:
          'Pour éviter de bloquer la mémoire des navigateurs mobiles, toute image dont la largeur ou la hauteur dépasse 8000 px est automatiquement réduite à 8000 px maximum en conservant son ratio d’origine.',
      },
      {
        question: 'Dois-je choisir le format PNG ou JPG ?',
        answer:
          'Choisissez PNG pour conserver une qualité sans aucune perte (idéal pour du texte, des logos ou des illustrations). Choisissez JPG avec une qualité entre 85 % et 95 % pour des photographies légères et rapides à publier.',
      },
    ],
  },
  en: {
    navLabel: 'Tools',
    metaTitle: 'Split Image Online Free (Instagram Grid Maker) — VIDNEX',
    metaDescription:
      'Split any JPG, PNG, or WebP image into a 2×2, 3×3, or custom grid for Instagram profiles and carousels. 100% browser-based with ZIP download.',
    ogTitle: 'Split Image Online Free (Instagram Grid Maker) — VIDNEX',
    ogDescription:
      'Split any JPG, PNG, or WebP image into a 2×2, 3×3, or custom grid for Instagram profiles and carousels. 100% browser-based with ZIP download.',
    ogImageAlt: 'VIDNEX online image splitter tool for Instagram 3x3 and 2x2 grids',
    breadcrumbLabel: 'Split Image',
    badgeText: '100% BROWSER CANVAS · ZERO UPLOAD · INSTAGRAM GRID & ZIP',
    h1: 'Split Image into Grid Online',
    subtitle:
      'Slice any JPG, PNG, or WebP picture into 2×2, 3×3, 1×3 panorama, or custom rows and columns right inside your browser with zero server uploads.',
    dropzoneTitle: 'Drag & drop your image here',
    dropzoneSubtitle: 'Supported: JPG, PNG, WebP (auto-downscales images over 8000 px)',
    selectFileCta: 'Select Image',
    loadSampleCta: 'Try Sample Image',
    changeImageCta: 'Change Image',
    downscaledNotice:
      'Image over 8000 px was automatically resized to {w}×{h} px for smooth browser processing.',
    gridHeading: 'Grid Layout',
    preset2x2: '2×2 (4 tiles)',
    preset3x3: '3×3 (IG Grid)',
    preset1x3: '1×3 (Carousel)',
    preset3x1: '3×1 (Vertical)',
    presetCustom: 'Custom Grid',
    rowsLabel: 'Rows',
    colsLabel: 'Columns',
    instagramOrderLabel: 'Instagram Order',
    instagramOrderHint:
      'Reverses numbering (bottom-right to top-left) so you can upload image-1, image-2... in exact sequence for your profile grid.',
    formatHeading: 'Output Format & Quality',
    formatPng: 'PNG (Lossless)',
    formatJpg: 'JPG (Compact)',
    qualityLabel: 'JPG Quality',
    previewHeading: 'Live Cut Preview',
    sourceDimensionsLabel: 'Dimensions',
    sliceCountLabel: 'Slices',
    downloadAllZipCta: 'Download All (ZIP)',
    buildingZipCta: 'Building ZIP…',
    downloadSingleCta: 'Download',
    slicesListHeading: 'Download Individual Slices',
    privacyNotice:
      '100% client-side processing via HTML5 Canvas. Your images never leave your device.',
    errorInvalidFile: 'Please select a valid image file (JPG, PNG, or WebP).',
    editorial: {
      heading: 'Slice High-Resolution Photos for Instagram Grids and Seamless Carousels',
      subheading: '100% local HTML5 Canvas image splitter with instant ZIP export',
      paragraphs: [
        'The VIDNEX Split Image tool lets you divide any photo, poster, or panoramic artwork into pixel-accurate tiles. Whether you are building a 3×3 Instagram profile mosaic, a 1×3 swipeable carousel, or a custom row-by-column grid, every slice is rendered locally in your browser.',
        'Because all rendering runs on your device via HTML5 Canvas and JSZip, your personal photos and client designs are never uploaded to any server. Oversized images above 8000 pixels are automatically scaled down proportionally so mobile and desktop browsers stay fast and responsive.',
      ],
      formatsTitle: 'Supported Grids & Export Options',
      formatsList: [
        'One-click presets: 2×2, 3×3 Instagram profile grid, 1×3 horizontal panorama, 3×1 vertical stack',
        'Custom grid mode supporting 1 to 10 rows and 1 to 10 columns',
        'Instagram Order toggle that reverses slice numbering for effortless profile grid posting',
        'Individual slice downloads (image-1, image-2…) plus one-click ZIP archive in PNG or adjustable-quality JPG',
      ],
      limitsTitle: 'Privacy & Memory Safety',
      limitsText:
        'Zero network uploads or API calls. Images larger than 8000 px are safely capped at 8000 px while preserving aspect ratio.',
    },
    howToSteps: [
      {
        number: '01',
        title: 'Choose or drop your image',
        description:
          'Drag and drop a JPG, PNG, or WebP image into the uploader or tap "Select Image" from your device.',
        codeHint: 'JPG / PNG / WebP · Auto 8000 px cap',
      },
      {
        number: '02',
        title: 'Pick your grid & numbering order',
        description:
          'Select 2×2, 3×3, 1×3, 3×1, or custom dimensions. Enable "Instagram Order" if you are posting a profile grid mosaic.',
        codeHint: '2×2 · 3×3 · 1×3 · 3×1 · IG Order',
      },
      {
        number: '03',
        title: 'Download all as ZIP or individually',
        description:
          'Preview the cut lines and numbered tiles, then download the complete ZIP archive or save each tile (image-1, image-2…) separately.',
        codeHint: 'image-1.jpg … + .ZIP Archive',
      },
    ],
    faqs: [
      {
        question: 'What does the "Instagram Order" option do?',
        answer:
          'On an Instagram profile grid, the newest post appears at the top-left. Enabling "Instagram Order" numbers the bottom-right tile as #1 and the top-left tile last, so uploading image-1, image-2, and so on assembles your profile mosaic in the right order.',
      },
      {
        question: 'Are my images uploaded to a server?',
        answer:
          'No. Everything happens locally inside your web browser using HTML5 Canvas and JSZip. Your files never leave your phone or computer.',
      },
      {
        question: 'What happens if my image is larger than 8000 pixels?',
        answer:
          'If either width or height exceeds 8000 pixels, the tool automatically scales the image down so its longest side is 8000 pixels while keeping the exact aspect ratio.',
      },
      {
        question: 'Should I export as PNG or JPG?',
        answer:
          'Use PNG for crisp graphics, typography, or lossless quality. Use JPG with the quality slider (e.g., 85%–95%) when you want smaller file sizes for social media uploads.',
      },
    ],
  },
  ar: {
    navLabel: 'أدوات',
    metaTitle: 'تقسيم الصور مجاناً أونلاين (شبكة إنستغرام) — VIDNEX',
    metaDescription:
      'قسّم أي صورة JPG أو PNG أو WebP إلى شبكة 2×2 أو 3×3 أو مخصصة لحساب إنستغرام. أداة مجانية تعمل في المتصفح 100% مع تحميل ZIP مباشر بدون رفع.',
    ogTitle: 'تقسيم الصور مجاناً أونلاين (شبكة إنستغرام) — VIDNEX',
    ogDescription:
      'قسّم أي صورة JPG أو PNG أو WebP إلى شبكة 2×2 أو 3×3 أو مخصصة لحساب إنستغرام. أداة مجانية تعمل في المتصفح 100% مع تحميل ZIP مباشر بدون رفع.',
    ogImageAlt: 'أداة VIDNEX لتقسيم الصور إلى شبكة إنستغرام 3×3 أو 2×2 أونلاين',
    breadcrumbLabel: 'تقسيم صورة',
    badgeText: 'معالجة محلية 100% · بدون رفع للخادم · شبكة إنستغرام وملف ZIP',
    h1: 'تقسيم الصور إلى شبكة أونلاين',
    subtitle:
      'قسّم صورك بصيغة JPG وPNG وWebP فوراً إلى شبكة 2×2 أو 3×3 أو 1×3 أو أبعاد مخصصة مباشرة داخل متصفحك بخصوصية تامة.',
    dropzoneTitle: 'اسحب وأفلت صورتك هنا',
    dropzoneSubtitle: 'الصيغ المدعومة: JPG وPNG وWebP (تصغير تلقائي للصور الأكبر من 8000 بكسل)',
    selectFileCta: 'اختر صورة',
    loadSampleCta: 'تجربة صورة نموذجية',
    changeImageCta: 'تغيير الصورة',
    downscaledNotice:
      'تم تصغير الصورة التي تتجاوز 8000 بكسل تلقائياً إلى {w}×{h} بكسل لضمان سرعة التقطيع.',
    gridHeading: 'إعدادات الشبكة',
    preset2x2: '2×2 (4 أجزاء)',
    preset3x3: '3×3 (شبكة إنستغرام)',
    preset1x3: '1×3 (بانوراما)',
    preset3x1: '3×1 (عمودي)',
    presetCustom: 'شبكة مخصصة',
    rowsLabel: 'الصفوف',
    colsLabel: 'الأعمدة',
    instagramOrderLabel: 'ترتيب إنستغرام',
    instagramOrderHint:
      'يعكس الترقيم (من الأسفل للأعلى) لتتمكن من نشر الصور بالترتيب الصحيح على شبكة حسابك في إنستغرام.',
    formatHeading: 'صيغة الإخراج والجودة',
    formatPng: 'PNG (بدون فقدان)',
    formatJpg: 'JPG (حجم أصغر)',
    qualityLabel: 'جودة JPG',
    previewHeading: 'معاينة التقطيع والترقيم',
    sourceDimensionsLabel: 'الأبعاد',
    sliceCountLabel: 'عدد الأجزاء',
    downloadAllZipCta: 'تحميل الكل (ZIP)',
    buildingZipCta: 'جاري إنشاء ZIP…',
    downloadSingleCta: 'تحميل',
    slicesListHeading: 'تحميل كل جزء على حدة',
    privacyNotice:
      'تتم المعالجة 100% داخل متصفحك عبر HTML5 Canvas؛ صورك لا تغادر جهازك أبداً.',
    errorInvalidFile: 'يرجى اختيار ملف صورة صالح (JPG أو PNG أو WebP).',
    editorial: {
      heading: 'قسّم صورك بدقة عالية لشبكة حساب إنستغرام والمنشورات المتعددة',
      subheading: 'أداة تقطيع صور محلية 100% في المتصفح مع تحميل ZIP فوري',
      paragraphs: [
        'تتيح لك أداة تقسيم الصور من VIDNEX تقطيع أي صورة عالية الدقة إلى مربعات متناسقة بسهولة. سواء كنت تصمم واجهة ملف شخصي 3×3 على إنستغرام، أو صورة بانورامية 1×3 للتمرير، أو شبكة مخصصة من الصفوف والأعمدة، يتم التقطيع بدقة البكسل في متصفحك.',
        'بفضل تقنية HTML5 Canvas وJSZip، لا يتم رفع صورك إلى أي خادم خارجي. وإذا تجاوزت أبعاد الصورة 8000 بكسل، تقوم الأداة بتصغيرها تلقائياً مع الحفاظ على نسبة العرض إلى الارتفاع.',
      ],
      formatsTitle: 'الميزات والشبكات المدعومة',
      formatsList: [
        'شبكات جاهزة: 2×2، 3×3، 1×3، 3×1 بالإضافة إلى الوضع المخصص (حتى 10×10)',
        'خيار «ترتيب إنستغرام» الذي يعكس الأرقام لسهولة النشر المتسلسل على الملف الشخصي',
        'تصدير بصيغة PNG عالية النقاء أو JPG مع شريط للتحكم في الجودة',
        'تحميل كل صورة منفردة (image-1, image-2...) أو تحميل جميع الأجزاء في ملف ZIP واحد',
      ],
      limitsTitle: 'الخصوصية والأداء',
      limitsText:
        'لا توجد أي طلبات خادم أو رفع ملفات. الحد الأقصى التلقائي 8000 بكسل يحمي ذاكرة الهاتف والمتصفح.',
    },
    howToSteps: [
      {
        number: '01',
        title: 'اختر الصورة من جهازك',
        description: 'اسحب صورة JPG أو PNG أو WebP إلى منطقة الرفع أو اضغط على زر اختيار صورة.',
        codeHint: 'JPG / PNG / WebP · حد 8000px تلقائي',
      },
      {
        number: '02',
        title: 'حدد حجم الشبكة والصيغة',
        description: 'اختر 2×2 أو 3×3 أو 1×3 أو 3×1 أو أدخل عدد الصفوف والأعمدة، وفعّل ترتيب إنستغرام عند الحاجة.',
        codeHint: '2×2 · 3×3 · 1×3 · 3×1 · ترتيب IG',
      },
      {
        number: '03',
        title: 'حمّل ملف ZIP أو كل صورة منفردة',
        description: 'راجع خطوط القص والأرقام في المعاينة ثم اضغط على «تحميل الكل (ZIP)» أو حمّل كل جزء لوحده.',
        codeHint: 'image-1.jpg … + أرشيف .ZIP',
      },
    ],
    faqs: [
      {
        question: 'ما فائدة خيار «ترتيب إنستغرام»؟',
        answer:
          'في شبكة الملف الشخصي على إنستغرام يظهر أحدث منشور في أعلى اليسار. عند تفعيل هذا الخيار يبدأ الترقيم من أسفل اليمين (1) حتى أعلى اليسار، بحيث تنشر image-1 ثم image-2 لتكتمل الصورة الكبيرة بالترتيب الصحيح.',
      },
      {
        question: 'هل يتم رفع صوري إلى خادم VIDNEX؟',
        answer:
          'لا، جميع عمليات القص وإنشاء ملف ZIP تتم محلياً داخل متصفحك باستخدام HTML5 Canvas، ولا تغادر صورك جهازك.',
      },
      {
        question: 'ماذا يحدث إذا كانت الصورة أكبر من 8000 بكسل؟',
        answer:
          'يتم تقليص الضلع الأكبر تلقائياً إلى 8000 بكسل مع الحفاظ على أبعاد الصورة الأصلية لضمان سرعة المتصفح وعدم استهلاك الذاكرة.',
      },
      {
        question: 'أيهما أفضل: صيغة PNG أم JPG؟',
        answer:
          'اختر PNG للحفاظ على أقصى جودة بدون ضغط خصوصاً للتصاميم والنصوص، واختر JPG مع ضبط الجودة لتقليل حجم الملفات قبل نشرها.',
      },
    ],
  },
  es: {
    navLabel: 'Herramientas',
    metaTitle: 'Dividir Imagen Online Gratis (Cuadrícula IG) — VIDNEX',
    metaDescription:
      'Divide cualquier imagen JPG, PNG o WebP en cuadrículas 2×2, 3×3 o personalizadas para Instagram. 100 % en tu navegador con descarga en ZIP.',
    ogTitle: 'Dividir Imagen Online Gratis (Cuadrícula IG) — VIDNEX',
    ogDescription:
      'Divide cualquier imagen JPG, PNG o WebP en cuadrículas 2×2, 3×3 o personalizadas para Instagram. 100 % en tu navegador con descarga en ZIP.',
    ogImageAlt: 'Herramienta VIDNEX para dividir imágenes en cuadrículas 3x3 y 2x2',
    breadcrumbLabel: 'Dividir imagen',
    badgeText: '100 % EN NAVEGADOR (CANVAS) · SIN SUBIDAS · CUADRÍCULA IG Y ZIP',
    h1: 'Dividir una imagen en cuadrícula',
    subtitle:
      'Corta tus fotos JPG, PNG y WebP en cuadrículas 2×2, 3×3, panoramas 1×3 o filas y columnas personalizadas directamente en tu navegador.',
    dropzoneTitle: 'Arrastra y suelta tu imagen aquí',
    dropzoneSubtitle: 'Formatos: JPG, PNG, WebP (reducción automática si supera 8000 px)',
    selectFileCta: 'Seleccionar imagen',
    loadSampleCta: 'Probar con ejemplo',
    changeImageCta: 'Cambiar imagen',
    downscaledNotice:
      'La imagen superior a 8000 px se redujo automáticamente a {w}×{h} px para un corte fluido.',
    gridHeading: 'Configuración de cuadrícula',
    preset2x2: '2×2 (4 partes)',
    preset3x3: '3×3 (Mosaico IG)',
    preset1x3: '1×3 (Carrusel)',
    preset3x1: '3×1 (Vertical)',
    presetCustom: 'Personalizada',
    rowsLabel: 'Filas',
    colsLabel: 'Columnas',
    instagramOrderLabel: 'Orden de Instagram',
    instagramOrderHint:
      'Invierte la numeración para que al publicar image-1, image-2... el mosaico de tu perfil de Instagram quede en el orden correcto.',
    formatHeading: 'Formato de salida y calidad',
    formatPng: 'PNG (Sin pérdida)',
    formatJpg: 'JPG (Ligero)',
    qualityLabel: 'Calidad JPG',
    previewHeading: 'Vista previa con líneas de corte',
    sourceDimensionsLabel: 'Dimensiones',
    sliceCountLabel: 'Fragmentos',
    downloadAllZipCta: 'Descargar todo (ZIP)',
    buildingZipCta: 'Creando ZIP…',
    downloadSingleCta: 'Descargar',
    slicesListHeading: 'Descargar cada imagen por separado',
    privacyNotice:
      'Procesamiento 100 % local con HTML5 Canvas. Tus imágenes nunca se suben a ningún servidor.',
    errorInvalidFile: 'Selecciona un archivo de imagen válido (JPG, PNG o WebP).',
    editorial: {
      heading: 'Corta fotos para mosaicos de Instagram y carruseles sin perder calidad',
      subheading: 'Divisor de imágenes 100 % local en el navegador con exportación ZIP',
      paragraphs: [
        'La herramienta para dividir imágenes de VIDNEX te permite fragmentar cualquier fotografía o diseño en piezas exactas. Crea cuadrículas 3×3 para tu feed de Instagram, panorámicas 1×3 para carruseles o cuadrículas a medida en segundos.',
        'Todo el proceso ocurre dentro de tu navegador mediante HTML5 Canvas y JSZip, sin enviar tus archivos a servidores externos. Si subes una imagen de más de 8000 píxeles, se reescala proporcionalmente de forma automática.',
      ],
      formatsTitle: 'Cuadrículas y funciones incluidas',
      formatsList: [
        'Ajustes rápidos 2×2, 3×3, 1×3, 3×1 y modo personalizado (1 a 10 filas × columnas)',
        'Modo «Orden de Instagram» con numeración invertida lista para publicar en tu perfil',
        'Exportación en PNG sin pérdida o JPG con control deslizante de calidad',
        'Descarga individual (image-1, image-2…) o paquete completo en ZIP con JSZip',
      ],
      limitsTitle: 'Privacidad total',
      limitsText:
        'Sin APIs externas ni subidas. El límite automático de 8000 px garantiza rapidez en móviles y escritorio.',
    },
    howToSteps: [
      {
        number: '01',
        title: 'Sube o arrastra tu foto',
        description: 'Selecciona un archivo JPG, PNG o WebP desde tu móvil u ordenador.',
        codeHint: 'JPG / PNG / WebP · Máx. 8000 px auto',
      },
      {
        number: '02',
        title: 'Elige la cuadrícula y el formato',
        description: 'Selecciona 2×2, 3×3, 1×3, 3×1 o personaliza filas y columnas. Activa el orden de Instagram si es para tu perfil.',
        codeHint: '2×2 · 3×3 · 1×3 · 3×1 · Orden IG',
      },
      {
        number: '03',
        title: 'Descarga en ZIP o pieza por pieza',
        description: 'Revisa la vista previa numerada y descarga todas las imágenes en un archivo ZIP o individualmente.',
        codeHint: 'image-1.jpg … + Archivo .ZIP',
      },
    ],
    faqs: [
      {
        question: '¿Para qué sirve la opción «Orden de Instagram»?',
        answer:
          'En el perfil de Instagram, la última foto publicada se coloca arriba a la izquierda. Al activar «Orden de Instagram», la pieza inferior derecha recibe el número 1 para que publiques en orden numérico (image-1, image-2…) y el mosaico quede perfecto.',
      },
      {
        question: '¿Mis fotos se suben a algún servidor?',
        answer:
          'No. El corte se realiza al 100 % en tu dispositivo usando HTML5 Canvas y JSZip.',
      },
      {
        question: '¿Qué ocurre si mi imagen mide más de 8000 píxeles?',
        answer:
          'Se reduce automáticamente para que su lado mayor mida 8000 px manteniendo la proporción exacta.',
      },
      {
        question: '¿Qué formato debo elegir: PNG o JPG?',
        answer:
          'Elige PNG para máxima nitidez en gráficos o textos, y JPG con calidad ajustable para fotografías listas para redes sociales.',
      },
    ],
  },
  pt: {
    navLabel: 'Ferramentas',
    metaTitle: 'Dividir Imagem Online Grátis (Mosaico Instagram) — VIDNEX',
    metaDescription:
      'Divida qualquer imagem JPG, PNG ou WebP em grade 2×2, 3×3 ou personalizada para o perfil do Instagram. 100% no navegador com download em ZIP.',
    ogTitle: 'Dividir Imagem Online Grátis (Mosaico Instagram) — VIDNEX',
    ogDescription:
      'Divida qualquer imagem JPG, PNG ou WebP em grade 2×2, 3×3 ou personalizada para o perfil do Instagram. 100% no navegador com download em ZIP.',
    ogImageAlt: 'Ferramenta VIDNEX para dividir imagem em grade 3x3 ou 2x2 para Instagram',
    breadcrumbLabel: 'Dividir imagem',
    badgeText: '100% NO NAVEGADOR (CANVAS) · SEM UPLOAD · GRADE INSTAGRAM E ZIP',
    h1: 'Dividir imagem em grade online',
    subtitle:
      'Corte fotos JPG, PNG e WebP em grades 2×2, 3×3, carrosséis 1×3 ou linhas e colunas personalizadas diretamente no navegador.',
    dropzoneTitle: 'Arraste e solte sua imagem aqui',
    dropzoneSubtitle: 'Aceita JPG, PNG e WebP (redimensionamento automático acima de 8000 px)',
    selectFileCta: 'Escolher imagem',
    loadSampleCta: 'Testar com exemplo',
    changeImageCta: 'Trocar imagem',
    downscaledNotice:
      'Imagem acima de 8000 px reduzida automaticamente para {w}×{h} px para processamento rápido.',
    gridHeading: 'Formato da grade',
    preset2x2: '2×2 (4 partes)',
    preset3x3: '3×3 (Grade IG)',
    preset1x3: '1×3 (Carrossel)',
    preset3x1: '3×1 (Vertical)',
    presetCustom: 'Personalizada',
    rowsLabel: 'Linhas',
    colsLabel: 'Colunas',
    instagramOrderLabel: 'Ordem para Instagram',
    instagramOrderHint:
      'Inverte a numeração para você postar image-1, image-2... na sequência certa para montar o mosaico no perfil.',
    formatHeading: 'Formato de saída e qualidade',
    formatPng: 'PNG (Sem perda)',
    formatJpg: 'JPG (Compacto)',
    qualityLabel: 'Qualidade JPG',
    previewHeading: 'Pré-visualização do corte',
    sourceDimensionsLabel: 'Dimensões',
    sliceCountLabel: 'Partes geradas',
    downloadAllZipCta: 'Baixar tudo (ZIP)',
    buildingZipCta: 'Gerando ZIP…',
    downloadSingleCta: 'Baixar',
    slicesListHeading: 'Baixar cada imagem separadamente',
    privacyNotice:
      'Processamento 100% local via HTML5 Canvas. Suas imagens nunca saem do seu dispositivo.',
    errorInvalidFile: 'Selecione um arquivo de imagem válido (JPG, PNG ou WebP).',
    editorial: {
      heading: 'Crie mosaicos 3×3 e carrosséis panorâmicos para o Instagram com precisão',
      subheading: 'Cortador de imagens 100% local no navegador com pacote ZIP instantâneo',
      paragraphs: [
        'Com a ferramenta Dividir Imagem do VIDNEX, você fatia qualquer foto ou arte em blocos perfeitamente alinhados. Monte grades 3×3 para o feed do Instagram, panoramas 1×3 ou grades personalizadas sem instalar aplicativos.',
        'Todo o corte utiliza HTML5 Canvas e JSZip diretamente no seu aparelho: nenhum arquivo é enviado para servidores externos. Imagens maiores que 8000 pixels são ajustadas automaticamente mantendo a proporção original.',
      ],
      formatsTitle: 'Recursos e grades disponíveis',
      formatsList: [
        'Grades prontas 2×2, 3×3, 1×3, 3×1 e grade personalizada (1 a 10 linhas × colunas)',
        'Opção «Ordem para Instagram» que numera os cortes na ordem exata de publicação',
        'Saída em PNG sem perdas ou JPG com controle de qualidade ajustável',
        'Download individual (image-1, image-2…) ou arquivo único ZIP',
      ],
      limitsTitle: 'Privacidade e velocidade',
      limitsText:
        'Zero upload para servidores. O limite automático de 8000 px mantém o navegador rápido no celular e no computador.',
    },
    howToSteps: [
      {
        number: '01',
        title: 'Envie sua imagem',
        description: 'Arraste um arquivo JPG, PNG ou WebP ou toque em «Escolher imagem».',
        codeHint: 'JPG / PNG / WebP · Máx. 8000 px auto',
      },
      {
        number: '02',
        title: 'Defina a grade e a numeração',
        description: 'Escolha 2×2, 3×3, 1×3, 3×1 ou linhas × colunas. Ative a Ordem para Instagram para mosaicos de perfil.',
        codeHint: '2×2 · 3×3 · 1×3 · 3×1 · Ordem IG',
      },
      {
        number: '03',
        title: 'Baixe tudo em ZIP ou separadamente',
        description: 'Confira a prévia numerada e clique em «Baixar tudo (ZIP)» ou salve cada fatia individualmente.',
        codeHint: 'image-1.jpg … + Arquivo .ZIP',
      },
    ],
    faqs: [
      {
        question: 'Como funciona a opção «Ordem para Instagram»?',
        answer:
          'No feed do perfil do Instagram, a foto publicada por último fica no canto superior esquerdo. Ao ativar essa opção, a fatia inferior direita vira a image-1 para que você poste na ordem 1, 2, 3... e forme o mosaico corretamente.',
      },
      {
        question: 'Minhas imagens são enviadas para algum servidor?',
        answer:
          'Não. O processamento é 100% feito no seu navegador com HTML5 Canvas e JSZip.',
      },
      {
        question: 'O que acontece se a imagem tiver mais de 8000 pixels?',
        answer:
          'Ela é redimensionada automaticamente para no máximo 8000 px mantendo a proporção exata.',
      },
      {
        question: 'Qual formato escolher: PNG ou JPG?',
        answer:
          'Use PNG para máxima fidelidade sem compressão ou JPG com qualidade ajustável para arquivos mais leves.',
      },
    ],
  },
  de: {
    navLabel: 'Tools',
    metaTitle: 'Bild teilen Online Kostenlos (Instagram Raster) — VIDNEX',
    metaDescription:
      'Teilen Sie JPG-, PNG- und WebP-Bilder in 2×2, 3×3 oder eigene Raster für Ihr Instagram-Profil. 100 % lokal im Browser mit direktem ZIP-Download.',
    ogTitle: 'Bild teilen Online Kostenlos (Instagram Raster) — VIDNEX',
    ogDescription:
      'Teilen Sie JPG-, PNG- und WebP-Bilder in 2×2, 3×3 oder eigene Raster für Ihr Instagram-Profil. 100 % lokal im Browser mit direktem ZIP-Download.',
    ogImageAlt: 'VIDNEX Online-Werkzeug zum Teilen von Bildern in 3x3 oder 2x2 Instagram-Raster',
    breadcrumbLabel: 'Bild teilen',
    badgeText: '100 % IM BROWSER (CANVAS) · KEIN UPLOAD · INSTAGRAM-RASTER & ZIP',
    h1: 'Bild online in Raster teilen',
    subtitle:
      'Schneiden Sie JPG-, PNG- und WebP-Bilder direkt im Browser in 2×2-, 3×3-, 1×3-Panorama- oder benutzerdefinierte Raster – komplett ohne Server-Upload.',
    dropzoneTitle: 'Bild hierher ziehen und ablegen',
    dropzoneSubtitle: 'Formate: JPG, PNG, WebP (automatische Skalierung über 8000 px)',
    selectFileCta: 'Bild auswählen',
    loadSampleCta: 'Beispielbild laden',
    changeImageCta: 'Anderes Bild wählen',
    downscaledNotice:
      'Bild über 8000 px wurde automatisch auf {w}×{h} px skaliert, um flüssiges Schneiden zu garantieren.',
    gridHeading: 'Raster-Einstellungen',
    preset2x2: '2×2 (4 Kacheln)',
    preset3x3: '3×3 (IG-Raster)',
    preset1x3: '1×3 (Karussell)',
    preset3x1: '3×1 (Vertikal)',
    presetCustom: 'Benutzerdefiniert',
    rowsLabel: 'Zeilen',
    colsLabel: 'Spalten',
    instagramOrderLabel: 'Instagram-Reihenfolge',
    instagramOrderHint:
      'Kehrt die Nummerierung um (von unten rechts nach oben links), damit Ihr Instagram-Profilraster beim Posten in der richtigen Reihenfolge erscheint.',
    formatHeading: 'Ausgabeformat & Qualität',
    formatPng: 'PNG (Verlustfrei)',
    formatJpg: 'JPG (Kompakt)',
    qualityLabel: 'JPG-Qualität',
    previewHeading: 'Vorschau mit Schnittlinien',
    sourceDimensionsLabel: 'Abmessungen',
    sliceCountLabel: 'Einzelbilder',
    downloadAllZipCta: 'Alle herunterladen (ZIP)',
    buildingZipCta: 'ZIP wird erstellt…',
    downloadSingleCta: 'Download',
    slicesListHeading: 'Einzelne Kacheln herunterladen',
    privacyNotice:
      '100 % lokale Verarbeitung über HTML5 Canvas. Ihre Bilder verlassen niemals Ihr Gerät.',
    errorInvalidFile: 'Bitte wählen Sie eine gültige Bilddatei (JPG, PNG oder WebP).',
    editorial: {
      heading: 'Hochauflösende Bilder für Instagram-Profile und Karussells präzise zuschneiden',
      subheading: '100 % lokaler HTML5-Canvas-Bildteiler mit sofortigem ZIP-Archiv',
      paragraphs: [
        'Mit dem VIDNEX Bild-Teilen-Tool zerlegen Sie Fotos, Poster oder Panoramen pixelgenau in gleichmäßige Kacheln. Ob 3×3-Mosaik für Ihr Instagram-Profil, 1×3-Swipe-Karussell oder ein individuelles Raster – die Berechnung erfolgt verzögerungsfrei auf Ihrem Gerät.',
        'Da das gesamte Schneiden im Browser über HTML5 Canvas und JSZip stattfindet, werden Ihre Fotos auf keinen Server hochgeladen. Bilder mit mehr als 8000 Pixeln Kantenlänge werden proportional angepasst.',
      ],
      formatsTitle: 'Unterstützte Raster & Exportfunktionen',
      formatsList: [
        'Schnellvorlagen: 2×2, 3×3, 1×3, 3×1 sowie eigene Zeilen × Spalten (1 bis 10)',
        'Option „Instagram-Reihenfolge“ für die umgekehrte Upload-Nummerierung im Profil-Feed',
        'Export als verlustfreies PNG oder JPG mit einstellbarer Qualitätsstufe',
        'Einzeldownload (image-1, image-2…) oder kompletter ZIP-Download per JSZip',
      ],
      limitsTitle: 'Datenschutz & Leistung',
      limitsText:
        'Keine Server-API, kein Upload. Die automatische 8000-px-Begrenzung schützt den Arbeitsspeicher auf Smartphones und Desktop-PCs.',
    },
    howToSteps: [
      {
        number: '01',
        title: 'Bild auswählen oder ablegen',
        description: 'Ziehen Sie eine JPG-, PNG- oder WebP-Datei in das Feld oder tippen Sie auf „Bild auswählen“.',
        codeHint: 'JPG / PNG / WebP · Max. 8000 px Auto',
      },
      {
        number: '02',
        title: 'Raster und Format festlegen',
        description: 'Wählen Sie 2×2, 3×3, 1×3, 3×1 oder eigene Maße und aktivieren Sie bei Bedarf die Instagram-Reihenfolge.',
        codeHint: '2×2 · 3×3 · 1×3 · 3×1 · IG-Order',
      },
      {
        number: '03',
        title: 'Als ZIP oder einzeln speichern',
        description: 'Prüfen Sie die nummerierte Vorschau und laden Sie alle Kacheln als ZIP-Archiv oder einzeln herunter.',
        codeHint: 'image-1.jpg … + .ZIP-Archiv',
      },
    ],
    faqs: [
      {
        question: 'Was bewirkt die Option „Instagram-Reihenfolge“?',
        answer:
          'Im Instagram-Profil erscheint der neueste Beitrag immer oben links. Mit aktivierter Instagram-Reihenfolge wird die Kachel unten rechts als image-1 nummeriert, sodass Sie einfach der Reihe nach (1, 2, 3…) posten können.',
      },
      {
        question: 'Werden meine Fotos auf einen Server hochgeladen?',
        answer:
          'Nein. Das Zuschneiden und Packen der ZIP-Datei erfolgt zu 100 % lokal im Browser.',
      },
      {
        question: 'Was passiert bei Bildern über 8000 Pixeln?',
        answer:
          'Überschreitet die Breite oder Höhe 8000 px, wird das Bild automatisch proportional auf maximal 8000 px verkleinert.',
      },
      {
        question: 'Soll ich PNG oder JPG wählen?',
        answer:
          'PNG eignet sich ideal für verlustfreie Grafiken und Text, während JPG mit einstellbarer Qualität kleinere Dateien für schnelle Uploads erzeugt.',
      },
    ],
  },
  tr: {
    navLabel: 'Araçlar',
    metaTitle: 'Ücretsiz Online Fotoğraf Bölücü (Instagram Grid) — VIDNEX',
    metaDescription:
      'JPG, PNG ve WebP görsellerini Instagram profili için 2×2, 3×3 veya özel ızgaralara bölün. %100 tarayıcı tabanlı, ücretsiz ve ZIP indirme destekli.',
    ogTitle: 'Ücretsiz Online Fotoğraf Bölücü (Instagram Grid) — VIDNEX',
    ogDescription:
      'JPG, PNG ve WebP görsellerini Instagram profili için 2×2, 3×3 veya özel ızgaralara bölün. %100 tarayıcı tabanlı, ücretsiz ve ZIP indirme destekli.',
    ogImageAlt: 'Instagram 3x3 ve 2x2 ızgara kesimi için VIDNEX online fotoğraf bölme aracı',
    breadcrumbLabel: 'Fotoğraf Bölücü',
    badgeText: '%100 TARAYICI (CANVAS) · SUNUCUYA YÜKLENMEZ · INSTAGRAM GRİD & ZIP',
    h1: 'Fotoğrafı Izgara Olarak Böl',
    subtitle:
      'JPG, PNG ve WebP görsellerinizi sunucuya yüklemeden doğrudan tarayıcınızda 2×2, 3×3, 1×3 kaydırmalı veya özel satır-sütun ızgaralarına ayırın.',
    dropzoneTitle: 'Görselinizi buraya sürükleyip bırakın',
    dropzoneSubtitle: 'Desteklenenler: JPG, PNG, WebP (8000 px üzeri otomatik küçültülür)',
    selectFileCta: 'Görsel Seç',
    loadSampleCta: 'Örnek Görselle Dene',
    changeImageCta: 'Görseli Değiştir',
    downscaledNotice:
      '8000 px üzerindeki görsel akıcı işlem için otomatik olarak {w}×{h} px boyutuna ölçeklendi.',
    gridHeading: 'Izgara Seçimi',
    preset2x2: '2×2 (4 Parça)',
    preset3x3: '3×3 (IG Profil)',
    preset1x3: '1×3 (Kaydırmalı)',
    preset3x1: '3×1 (Dikey)',
    presetCustom: 'Özel Izgara',
    rowsLabel: 'Satır',
    colsLabel: 'Sütun',
    instagramOrderLabel: 'Instagram Sırası',
    instagramOrderHint:
      'Profil ızgarasında doğru görünmesi için numaralandırmayı ters çevirir (image-1’den başlayarak sırayla paylaşabilirsiniz).',
    formatHeading: 'Çıktı Formatı ve Kalite',
    formatPng: 'PNG (Kayıpsız)',
    formatJpg: 'JPG (Düşük Boyut)',
    qualityLabel: 'JPG Kalitesi',
    previewHeading: 'Kesim Çizgili Önizleme',
    sourceDimensionsLabel: 'Boyutlar',
    sliceCountLabel: 'Parça Sayısı',
    downloadAllZipCta: 'Tümünü İndir (ZIP)',
    buildingZipCta: 'ZIP Hazırlanıyor…',
    downloadSingleCta: 'İndir',
    slicesListHeading: 'Her Parçayı Ayrı İndir',
    privacyNotice:
      '%100 HTML5 Canvas ile cihazınızda işlenir; fotoğraflarınız hiçbir sunucuya gönderilmez.',
    errorInvalidFile: 'Lütfen geçerli bir görsel dosyası seçin (JPG, PNG veya WebP).',
    editorial: {
      heading: 'Instagram Profil Izgaraları ve Kaydırmalı Gönderiler İçin Görsel Bölücü',
      subheading: '%100 yerel HTML5 Canvas kesim motoru ve tek tıkla ZIP arşivleme',
      paragraphs: [
        'VIDNEX Fotoğraf Bölücü ile yüksek çözünürlüklü fotoğraflarınızı veya tasarımlarınızı piksel hassasiyetinde eşit karelere ayırabilirsiniz. İster 3×3 Instagram profil mozaiği ister 1×3 panoramik kaydırmalı gönderi hazırlayın, tüm işlem anında gerçekleşir.',
        'Fotoğraflarınız hiçbir sunucuya yüklenmez; HTML5 Canvas ve JSZip kullanılarak doğrudan telefonunuzda veya bilgisayarınızda bölünür. 8000 pikseli aşan görseller oranı korunarak otomatik optimize edilir.',
      ],
      formatsTitle: 'Desteklenen Izgaralar ve Özellikler',
      formatsList: [
        'Hazır şablonlar: 2×2, 3×3, 1×3, 3×1 ve özel satır × sütun (1–10 arası)',
        'Instagram profil ızgarası için numaraları ters çeviren «Instagram Sırası» seçeneği',
        'Kayıpsız PNG veya kalite ayarlı JPG çıktı seçeneği',
        'Tek tek indirme (image-1, image-2…) veya JSZip ile toplu ZIP indirme',
      ],
      limitsTitle: 'Gizlilik ve Hız',
      limitsText:
        'Sunucu API çağrısı yoktur. Otomatik 8000 px sınırı mobil tarayıcılarda bellek taşmasını önler.',
    },
    howToSteps: [
      {
        number: '01',
        title: 'Görselinizi yükleyin',
        description: 'JPG, PNG veya WebP dosyanızı sürükleyin ya da «Görsel Seç» düğmesine dokunun.',
        codeHint: 'JPG / PNG / WebP · Maks 8000 px oto',
      },
      {
        number: '02',
        title: 'Izgara ve formatı seçin',
        description: '2×2, 3×3, 1×3, 3×1 veya özel boyut belirleyin; profil mozaiği için Instagram Sırası’nı açın.',
        codeHint: '2×2 · 3×3 · 1×3 · 3×1 · IG Sırası',
      },
      {
        number: '03',
        title: 'ZIP olarak veya tek tek indirin',
        description: 'Numaralı önizlemeyi kontrol edin, ardından «Tümünü İndir (ZIP)» veya tekil indirme butonlarını kullanın.',
        codeHint: 'image-1.jpg … + .ZIP Arşivi',
      },
    ],
    faqs: [
      {
        question: '«Instagram Sırası» seçeneği ne işe yarar?',
        answer:
          'Instagram profilinde en son yüklenen fotoğraf sol üstte görünür. Bu seçeneği açtığınızda sağ alt kare image-1 olarak numaralandırılır; böylece 1’den başlayıp sırayla paylaştığınızda profil vitrininiz doğru birleşir.',
      },
      {
        question: 'Fotoğraflarım sunucuya yükleniyor mu?',
        answer:
          'Hayır. Kesme ve ZIP oluşturma işlemlerinin tamamı tarayıcınızın içinde yerel olarak yapılır.',
      },
      {
        question: 'Görselim 8000 pikselden büyükse ne olur?',
        answer:
          'Tarayıcı performansını korumak için en uzun kenar orantılı biçimde otomatik olarak 8000 piksele düşürülür.',
      },
      {
        question: 'PNG mi yoksa JPG mi seçmeliyim?',
        answer:
          'Metin ve grafik içeren görsellerde kayıpsız kalite için PNG, daha küçük dosya boyutu istediğiniz fotoğraflarda ise JPG tercih edebilirsiniz.',
      },
    ],
  },
  id: {
    navLabel: 'Alat',
    metaTitle: 'Pemotong Gambar Online Gratis (Grid Instagram) — VIDNEX',
    metaDescription:
      'Potong gambar JPG, PNG, atau WebP menjadi grid 2×2, 3×3, atau kustom untuk feed Instagram. 100% diproses di browser tanpa upload dengan unduhan ZIP.',
    ogTitle: 'Pemotong Gambar Online Gratis (Grid Instagram) — VIDNEX',
    ogDescription:
      'Potong gambar JPG, PNG, atau WebP menjadi grid 2×2, 3×3, atau kustom untuk feed Instagram. 100% diproses di browser tanpa upload dengan unduhan ZIP.',
    ogImageAlt: 'Alat pemotong gambar online VIDNEX untuk membuat grid Instagram 3x3 dan 2x2',
    breadcrumbLabel: 'Potong Gambar',
    badgeText: '100% DI BROWSER (CANVAS) · TANPA UPLOAD · GRID INSTAGRAM & ZIP',
    h1: 'Potong Gambar Menjadi Grid Online',
    subtitle:
      'Bagi foto JPG, PNG, dan WebP Anda menjadi grid 2×2, 3×3, panorama 1×3, atau baris dan kolom kustom langsung di browser tanpa unggah ke server.',
    dropzoneTitle: 'Seret & lepas gambar Anda di sini',
    dropzoneSubtitle: 'Format: JPG, PNG, WebP (otomatis diperkecil jika > 8000 px)',
    selectFileCta: 'Pilih Gambar',
    loadSampleCta: 'Coba Gambar Contoh',
    changeImageCta: 'Ganti Gambar',
    downscaledNotice:
      'Gambar di atas 8000 px otomatis disesuaikan ke {w}×{h} px agar pemotongan tetap lancar.',
    gridHeading: 'Pengaturan Grid',
    preset2x2: '2×2 (4 bagian)',
    preset3x3: '3×3 (Grid IG)',
    preset1x3: '1×3 (Karosel)',
    preset3x1: '3×1 (Vertikal)',
    presetCustom: 'Kustom',
    rowsLabel: 'Baris',
    colsLabel: 'Kolom',
    instagramOrderLabel: 'Urutan Instagram',
    instagramOrderHint:
      'Membalik penomoran (dari kanan bawah ke kiri atas) agar urutan upload ke feed profil Instagram langsung rapi.',
    formatHeading: 'Format Output & Kualitas',
    formatPng: 'PNG (Tanpa Kompresi)',
    formatJpg: 'JPG (Ringan)',
    qualityLabel: 'Kualitas JPG',
    previewHeading: 'Pratinjau Garis Potong',
    sourceDimensionsLabel: 'Dimensi',
    sliceCountLabel: 'Jumlah Potongan',
    downloadAllZipCta: 'Unduh Semua (ZIP)',
    buildingZipCta: 'Membuat ZIP…',
    downloadSingleCta: 'Unduh',
    slicesListHeading: 'Unduh Setiap Potongan Secara Terpisah',
    privacyNotice:
      '100% diproses secara lokal lewat HTML5 Canvas. Gambar Anda tidak pernah dikirim ke server.',
    errorInvalidFile: 'Pilih file gambar yang valid (JPG, PNG, atau WebP).',
    editorial: {
      heading: 'Potong Foto Resolusi Tinggi untuk Feed Grid dan Carousel Instagram',
      subheading: 'Alat pemotong gambar HTML5 Canvas 100% lokal dengan unduhan ZIP instan',
      paragraphs: [
        'Alat Pemotong Gambar VIDNEX memudahkan Anda membagi foto atau poster menjadi potongan grid yang presisi. Buat puzzle profil Instagram 3×3, panorama geser 1×3, atau ukuran baris dan kolom kustom dalam hitungan detik.',
        'Seluruh proses berjalan 100% di browser menggunakan HTML5 Canvas dan JSZip sehingga foto pribadi Anda tidak pernah diunggah ke server mana pun. Gambar yang melebihi 8000 piksel akan disesuaikan secara proporsional.',
      ],
      formatsTitle: 'Pilihan Grid & Fitur Ekspor',
      formatsList: [
        'Preset cepat 2×2, 3×3, 1×3, 3×1 serta grid kustom (1 hingga 10 baris × kolom)',
        'Opsi «Urutan Instagram» untuk membalik nomor potongan sesuai urutan posting feed',
        'Output PNG tajam atau JPG dengan pengatur kualitas',
        'Unduh per potongan (image-1, image-2…) atau unduh sekaligus dalam arsip ZIP',
      ],
      limitsTitle: 'Privasi & Performa',
      limitsText:
        'Tanpa API server dan tanpa upload. Batas otomatis 8000 px menjaga memori browser ponsel tetap ringan.',
    },
    howToSteps: [
      {
        number: '01',
        title: 'Pilih atau tarik gambar Anda',
        description: 'Masukkan file JPG, PNG, atau WebP dari ponsel atau komputer Anda.',
        codeHint: 'JPG / PNG / WebP · Maks 8000 px oto',
      },
      {
        number: '02',
        title: 'Atur grid dan format output',
        description: 'Pilih 2×2, 3×3, 1×3, 3×1, atau kustom. Aktifkan Urutan Instagram jika ingin membuat grid profil.',
        codeHint: '2×2 · 3×3 · 1×3 · 3×1 · Urutan IG',
      },
      {
        number: '03',
        title: 'Unduh semua dalam ZIP atau satuan',
        description: 'Lihat pratinjau bernomor lalu klik «Unduh Semua (ZIP)» atau simpan masing-masing potongan.',
        codeHint: 'image-1.jpg … + Arsip .ZIP',
      },
    ],
    faqs: [
      {
        question: 'Apa fungsi opsi «Urutan Instagram»?',
        answer:
          'Di profil Instagram, postingan terbaru muncul di kiri atas. Dengan mengaktifkan Urutan Instagram, potongan kanan bawah diberi nomor 1 sehingga Anda cukup mengunggah image-1, image-2, dan seterusnya secara berurutan.',
      },
      {
        question: 'Apakah foto saya diunggah ke server?',
        answer:
          'Tidak. Pemotongan gambar dan pembuatan ZIP dilakukan 100% secara lokal di browser Anda.',
      },
      {
        question: 'Bagaimana jika ukuran gambar lebih dari 8000 piksel?',
        answer:
          'Sisi terpanjang gambar akan diperkecil otomatis menjadi 8000 px dengan tetap menjaga rasio aslinya.',
      },
      {
        question: 'Lebih baik pilih format PNG atau JPG?',
        answer:
          'Gunakan PNG untuk kualitas tanpa kompresi pada ilustrasi atau teks, dan JPG dengan pengatur kualitas untuk ukuran file foto yang lebih hemat.',
      },
    ],
  },
  it: {
    navLabel: 'Strumenti',
    metaTitle: 'Dividere Immagine Online Gratis (Griglia IG) — VIDNEX',
    metaDescription:
      'Dividi qualsiasi immagine JPG, PNG o WebP in una griglia 2×2, 3×3 o personalizzata per Instagram. 100% locale nel browser con download ZIP gratuito.',
    ogTitle: 'Dividere Immagine Online Gratis (Griglia IG) — VIDNEX',
    ogDescription:
      'Dividi qualsiasi immagine JPG, PNG o WebP in una griglia 2×2, 3×3 o personalizzata per Instagram. 100% locale nel browser con download ZIP gratuito.',
    ogImageAlt: 'Strumento online VIDNEX per dividere immagini in griglie 3x3 e 2x2 per Instagram',
    breadcrumbLabel: 'Dividere immagine',
    badgeText: '100% NEL BROWSER (CANVAS) · ZERO UPLOAD · GRIGLIA INSTAGRAM E ZIP',
    h1: 'Dividere un’immagine in griglia',
    subtitle:
      'Taglia istantaneamente foto JPG, PNG e WebP in griglie 2×2, 3×3, caroselli 1×3 o righe e colonne personalizzate direttamente nel tuo browser.',
    dropzoneTitle: 'Trascina e rilascia la tua immagine qui',
    dropzoneSubtitle: 'Formati: JPG, PNG, WebP (ridimensionamento automatico oltre 8000 px)',
    selectFileCta: 'Scegli immagine',
    loadSampleCta: 'Prova con un esempio',
    changeImageCta: 'Cambia immagine',
    downscaledNotice:
      'Immagine oltre 8000 px ridimensionata automaticamente a {w}×{h} px per un taglio fluido.',
    gridHeading: 'Configurazione della griglia',
    preset2x2: '2×2 (4 riquadri)',
    preset3x3: '3×3 (Griglia IG)',
    preset1x3: '1×3 (Carosello)',
    preset3x1: '3×1 (Verticale)',
    presetCustom: 'Personalizzata',
    rowsLabel: 'Righe',
    colsLabel: 'Colonne',
    instagramOrderLabel: 'Ordine Instagram',
    instagramOrderHint:
      'Inverte la numerazione (dal basso a destra verso l’alto a sinistra) per pubblicare i riquadri nell’ordine perfetto sul profilo Instagram.',
    formatHeading: 'Formato di output e qualità',
    formatPng: 'PNG (Senza perdita)',
    formatJpg: 'JPG (Leggero)',
    qualityLabel: 'Qualità JPG',
    previewHeading: 'Anteprima con linee di taglio',
    sourceDimensionsLabel: 'Dimensioni',
    sliceCountLabel: 'Porzioni generate',
    downloadAllZipCta: 'Scarica tutto (ZIP)',
    buildingZipCta: 'Creazione ZIP…',
    downloadSingleCta: 'Scarica',
    slicesListHeading: 'Scarica ogni immagine separatamente',
    privacyNotice:
      'Elaborazione 100% locale tramite HTML5 Canvas. Le tue immagini non lasciano mai il tuo dispositivo.',
    errorInvalidFile: 'Seleziona un file immagine valido (JPG, PNG o WebP).',
    editorial: {
      heading: 'Dividi foto ad alta risoluzione per mosaici Instagram e caroselli',
      subheading: 'Splitter di immagini 100% locale nel browser con esportazione ZIP immediata',
      paragraphs: [
        'Lo strumento Dividere un’immagine di VIDNEX ti permette di suddividere qualsiasi foto o locandina in riquadri perfetti al pixel. Che tu stia creando un mosaico 3×3 per il profilo Instagram, uno swipe panoramico 1×3 o una griglia su misura, tutto avviene istantaneamente.',
        'Grazie a HTML5 Canvas e JSZip, nessun file viene caricato su server esterni. Se un’immagine supera gli 8000 pixel, viene ridimensionata automaticamente mantenendo le proporzioni originali.',
      ],
      formatsTitle: 'Griglie e opzioni supportate',
      formatsList: [
        'Preset rapidi 2×2, 3×3, 1×3, 3×1 e modalità personalizzata (da 1 a 10 righe × colonne)',
        'Opzione «Ordine Instagram» con numerazione invertita per la griglia del profilo',
        'Esportazione in PNG lossless oppure JPG con cursore della qualità',
        'Download singolo (image-1, image-2…) o archivio completo ZIP con un clic',
      ],
      limitsTitle: 'Privacy e prestazioni',
      limitsText:
        'Nessuna API e nessun upload sul server. Il limite automatico di 8000 px protegge la memoria su smartphone e desktop.',
    },
    howToSteps: [
      {
        number: '01',
        title: 'Carica la tua immagine',
        description: 'Trascina un file JPG, PNG o WebP nell’area di rilascio o clicca su «Scegli immagine».',
        codeHint: 'JPG / PNG / WebP · Max 8000 px auto',
      },
      {
        number: '02',
        title: 'Scegli griglia e formato',
        description: 'Seleziona 2×2, 3×3, 1×3, 3×1 o righe × colonne. Attiva l’Ordine Instagram per i mosaici del profilo.',
        codeHint: '2×2 · 3×3 · 1×3 · 3×1 · Ordine IG',
      },
      {
        number: '03',
        title: 'Scarica in ZIP o singolarmente',
        description: 'Controlla l’anteprima numerata e scarica tutte le porzioni in un file ZIP o una per una.',
        codeHint: 'image-1.jpg … + Archivio .ZIP',
      },
    ],
    faqs: [
      {
        question: 'A cosa serve l’opzione «Ordine Instagram»?',
        answer:
          'Sul profilo Instagram l’ultimo post pubblicato compare in alto a sinistra. Attivando «Ordine Instagram», il riquadro in basso a destra diventa image-1 così puoi pubblicare in ordine numerico (1, 2, 3…) ottenendo il mosaico corretto.',
      },
      {
        question: 'Le mie foto vengono caricate su un server?',
        answer:
          'No. Il taglio e la creazione dello ZIP avvengono al 100% nel tuo browser tramite HTML5 Canvas.',
      },
      {
        question: 'Cosa succede se l’immagine supera 8000 pixel?',
        answer:
          'Viene ridotta automaticamente a un massimo di 8000 px sul lato più lungo mantenendo intatte le proporzioni.',
      },
      {
        question: 'Meglio esportare in PNG o JPG?',
        answer:
          'Usa PNG per grafica, testi e qualità senza perdita; scegli JPG con qualità regolabile per foto più leggere.',
      },
    ],
  },
  ru: {
    navLabel: 'Инструменты',
    metaTitle: 'Разделить фото онлайн бесплатно (Сетка Инстаграм) — VIDNEX',
    metaDescription:
      'Разделите любое изображение JPG, PNG или WebP на сетку 2×2, 3×3 или произвольную для профиля Instagram. 100% в браузере со скачиванием архива ZIP.',
    ogTitle: 'Разделить фото онлайн бесплатно (Сетка Инстаграм) — VIDNEX',
    ogDescription:
      'Разделите любое изображение JPG, PNG или WebP на сетку 2×2, 3×3 или произвольную для профиля Instagram. 100% в браузере со скачиванием архива ZIP.',
    ogImageAlt: 'Онлайн-инструмент VIDNEX для нарезки фото на сетку 3x3 и 2x2 для Instagram',
    breadcrumbLabel: 'Разделить изображение',
    badgeText: '100% В БРАУЗЕРЕ (CANVAS) · БЕЗ ЗАГРУЗКИ НА СЕРВЕР · СЕТКА IG И ZIP',
    h1: 'Разделить изображение на сетку онлайн',
    subtitle:
      'Мгновенно разрезайте фото JPG, PNG и WebP на сетки 2×2, 3×3, панорамы 1×3 или произвольное число строк и столбцов прямо в браузере.',
    dropzoneTitle: 'Перетащите изображение сюда',
    dropzoneSubtitle: 'Форматы: JPG, PNG, WebP (автоуменьшение свыше 8000 пикс.)',
    selectFileCta: 'Выбрать фото',
    loadSampleCta: 'Попробовать на примере',
    changeImageCta: 'Заменить фото',
    downscaledNotice:
      'Изображение больше 8000 пикс. было автоматически уменьшено до {w}×{h} пикс. для быстрой обработки.',
    gridHeading: 'Параметры сетки',
    preset2x2: '2×2 (4 части)',
    preset3x3: '3×3 (Сетка IG)',
    preset1x3: '1×3 (Карусель)',
    preset3x1: '3×1 (Вертикально)',
    presetCustom: 'Свой размер',
    rowsLabel: 'Строки',
    colsLabel: 'Столбцы',
    instagramOrderLabel: 'Порядок для Instagram',
    instagramOrderHint:
      'Обратная нумерация (от нижнего правого к верхнему левому углу) для удобной публикации мозаики в профиле Instagram.',
    formatHeading: 'Формат и качество',
    formatPng: 'PNG (Без потерь)',
    formatJpg: 'JPG (Сжатый)',
    qualityLabel: 'Качество JPG',
    previewHeading: 'Предпросмотр с линиями разреза',
    sourceDimensionsLabel: 'Размер',
    sliceCountLabel: 'Частей',
    downloadAllZipCta: 'Скачать всё (ZIP)',
    buildingZipCta: 'Сборка ZIP…',
    downloadSingleCta: 'Скачать',
    slicesListHeading: 'Скачать каждую часть отдельно',
    privacyNotice:
      'Обработка на 100% локально в браузере через HTML5 Canvas. Ваши файлы никуда не отправляются.',
    errorInvalidFile: 'Пожалуйста, выберите корректный файл изображения (JPG, PNG или WebP).',
    editorial: {
      heading: 'Нарезка фотографий для бесконечной сетки и каруселей Instagram без потери качества',
      subheading: '100% локальный инструмент на базе HTML5 Canvas с выгрузкой в ZIP',
      paragraphs: [
        'Инструмент «Разделить изображение» от VIDNEX позволяет разрезать любую фотографию или баннер на идеально ровные фрагменты. Создавайте сетку 3×3 для профиля Instagram, бесшовные панорамы 1×3 для карусели или настраивайте собственное число строк и столбцов.',
        'Вся обработка выполняется локально на вашем устройстве с помощью HTML5 Canvas и JSZip — фотографии не загружаются на сервер. Если сторона изображения превышает 8000 пикселей, оно пропорционально масштабируется.',
      ],
      formatsTitle: 'Доступные сетки и возможности',
      formatsList: [
        'Готовые пресеты 2×2, 3×3, 1×3, 3×1 и произвольная сетка (от 1 до 10 строк и столбцов)',
        'Режим «Порядок для Instagram» с обратной нумерацией для правильной выкладки в профиль',
        'Сохранение в PNG без потерь или в JPG с регулировкой качества',
        'Поштучное скачивание (image-1, image-2…) или единый архив ZIP одним нажатием',
      ],
      limitsTitle: 'Приватность и скорость',
      limitsText:
        'Никаких серверных запросов. Автоматический порог 8000 пикс. защищает браузер от нехватки памяти на смартфонах.',
    },
    howToSteps: [
      {
        number: '01',
        title: 'Загрузите изображение',
        description: 'Перетащите файл JPG, PNG или WebP в область загрузки или нажмите «Выбрать фото».',
        codeHint: 'JPG / PNG / WebP · Авто до 8000 px',
      },
      {
        number: '02',
        title: 'Выберите сетку и формат',
        description: 'Укажите 2×2, 3×3, 1×3, 3×1 или свой размер. Включите «Порядок для Instagram» для сетки профиля.',
        codeHint: '2×2 · 3×3 · 1×3 · 3×1 · Порядок IG',
      },
      {
        number: '03',
        title: 'Скачайте ZIP или отдельные файлы',
        description: 'Проверьте превью с номерами и нажмите «Скачать всё (ZIP)» либо сохраните нужные фрагменты по одному.',
        codeHint: 'image-1.jpg … + Архив .ZIP',
      },
    ],
    faqs: [
      {
        question: 'Зачем нужна опция «Порядок для Instagram»?',
        answer:
          'В сетке профиля Instagram последний опубликованный пост оказывается в левом верхнем углу. При включении этой опции правый нижний фрагмент получает номер 1 (image-1), чтобы вы загружали их по порядку 1, 2, 3… и мозаика сложилась правильно.',
      },
      {
        question: 'Загружаются ли мои фото на сервер?',
        answer:
          'Нет. Нарезка фото и упаковка в ZIP происходят на 100% локально в вашем браузере через HTML5 Canvas.',
      },
      {
        question: 'Что будет, если фото больше 8000 пикселей?',
        answer:
          'Длинная сторона автоматически уменьшится до 8000 пикселей с сохранением исходных пропорций изображения.',
      },
      {
        question: 'Какой формат выбрать: PNG или JPG?',
        answer:
          'Выбирайте PNG для графики и текста без потери качества, а JPG с настройкой качества — для лёгких фотографий.',
      },
    ],
  },
};

export function getSplitImageContent(
  locale: SupportedLocale
): SplitImageLocaleContent {
  return SPLIT_IMAGE_I18N[locale] || SPLIT_IMAGE_I18N.fr;
}
