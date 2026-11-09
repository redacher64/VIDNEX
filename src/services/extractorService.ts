import type { DetectedUrlInfo, PlatformId } from '../utils/urlDetector.ts';
import type { LanguageCode } from '../i18n/translations.ts';

/**
 * Configuration API Cloudflare Pages Functions (`/functions/api`)
 * Les routes `/api/extract` et `/api/download` sont relatives au domaine Cloudflare Pages.
 */
export const API_BASE_URL = (
  import.meta.env?.VITE_API_BASE_URL ?? ''
).replace(/\/+$/, '');

export function resolveApiUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('blob:')) {
    return pathOrUrl;
  }
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${API_BASE_URL}${cleanPath}`;
}

export type ResultPayloadType = 'video' | 'profile_dp' | 'carousel';

export interface VideoFormatOption {
  id: string;
  label: string;
  quality: string;
  container: 'MP4' | 'MP3' | 'JPG' | 'PNG';
  fileSize?: string;
  noWatermark: boolean;
  downloadUrl: string;
  isPrimary?: boolean;
}

export interface CarouselSlideItem {
  id: string;
  index: number;
  mediaType: 'image' | 'video';
  dimensions?: string;
  fileSize?: string;
  thumbnailUrl: string;
  downloadUrl: string;
}

export interface BaseMediaResult {
  id: string;
  payloadType: ResultPayloadType;
  platform: PlatformId;
  badgeLabel: string;
  sourceUrl: string;
  creatorHandle: string;
  creatorName: string;
  verified: boolean;
  extractedAt: string;
}

export interface VideoMediaResult extends BaseMediaResult {
  payloadType: 'video';
  title: string;
  duration?: string;
  aspectRatio: '9:16' | '16:9';
  resolution?: string;
  codec?: string;
  thumbnailUrl: string;
  formats: VideoFormatOption[];
}

export interface ProfileDpMediaResult extends BaseMediaResult {
  payloadType: 'profile_dp';
  biography: string;
  followersCount?: string;
  standardPreviewUrl: string;
  hdOriginalUrl: string;
  dimensions?: string;
  fileSize?: string;
  format: 'JPG';
}

export interface CarouselMediaResult extends BaseMediaResult {
  payloadType: 'carousel';
  caption: string;
  totalItems: number;
  archiveSize?: string;
  items: CarouselSlideItem[];
  audioTrack?: {
    title: string;
    fileSize?: string;
    downloadUrl: string;
  };
}

export type MediaResult =
  | VideoMediaResult
  | ProfileDpMediaResult
  | CarouselMediaResult;

const ERROR_MESSAGES_I18N: Record<LanguageCode, Record<string, string>> = {
  en: {
    UNSUPPORTED_URL:
      'Unsupported link. Currently, Instagram, TikTok, and X (Twitter) links are supported.',
    NOT_FOUND:
      'Media not found. The tweet, video, or post may have been deleted.',
    NO_MEDIA:
      'This tweet does not contain any video or image.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'This content is private, deleted, age-restricted, or marked as sensitive media.',
    RATE_LIMITED:
      'Rate limit reached on upstream gateway. Please retry in a few seconds.',
    BLOCKED_BY_PLATFORM:
      'The platform temporarily restricted public extraction requests. Please try again shortly.',
    TIMEOUT:
      'Upstream media extraction timed out. Please try again.',
    MAINTENANCE:
      'VIDNEX is temporarily undergoing scheduled maintenance. Please try again shortly.',
    PLATFORM_DISABLED:
      'This platform extractor is temporarily disabled by the administrator.',
    BLOCKED:
      'This request or resource has been restricted by the administrator.',
    NETWORK_ERROR:
      'Unable to reach the VIDNEX extraction API (/api/extract).',
  },
  fr: {
    UNSUPPORTED_URL:
      'Ce lien n\'est pas supporté. Seuls les liens TikTok, Instagram et X (Twitter) sont pris en charge.',
    NOT_FOUND:
      'Contenu introuvable. Le tweet, la vidéo ou la publication a peut-être été supprimé.',
    NO_MEDIA:
      'Ce tweet ne contient ni vidéo ni image.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Ce contenu est privé, restreint par l\'âge, marqué comme sensible ou nécessite une session connectée.',
    RATE_LIMITED:
      'Limite de requêtes atteinte. Veuillez patienter quelques secondes avant de relancer une extraction.',
    BLOCKED_BY_PLATFORM:
      'La plateforme a temporairement restreint les requêtes publiques. Veuillez réessayer dans quelques instants.',
    TIMEOUT:
      'Le délai d\'attente a expiré lors de la récupération du média. Veuillez réessayer.',
    MAINTENANCE:
      'VIDNEX est temporairement en maintenance programmée. Veuillez réessayer dans quelques instants.',
    PLATFORM_DISABLED:
      'L\'extraction pour cette plateforme est temporairement désactivée par l\'administrateur.',
    BLOCKED:
      'Cette requête ou ressource a été bloquée par l\'administrateur.',
    NETWORK_ERROR:
      'Impossible de joindre le service d\'extraction VIDNEX (/api/extract).',
  },
  es: {
    UNSUPPORTED_URL:
      'Enlace no compatible. Solo se admiten enlaces de TikTok, Instagram y X (Twitter).',
    NOT_FOUND:
      'Contenido no encontrado. Es posible que el tweet, vídeo o publicación haya sido eliminado.',
    NO_MEDIA:
      'Este tweet no contiene ningún vídeo ni imagen.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Este contenido es privado, sensible o tiene restricción de edad.',
    RATE_LIMITED:
      'Límite de solicitudes alcanzado temporalmente. Inténtalo de nuevo en unos segundos.',
    BLOCKED_BY_PLATFORM:
      'La plataforma restringió temporalmente las solicitudes públicas. Inténtalo de nuevo en unos momentos.',
    TIMEOUT:
      'Se agotó el tiempo de espera al recuperar el archivo multimedia. Inténtalo de nuevo.',
    MAINTENANCE:
      'VIDNEX está temporalmente en mantenimiento. Inténtalo de nuevo en unos momentos.',
    PLATFORM_DISABLED:
      'La extracción para esta plataforma está desactivada temporalmente por el administrador.',
    BLOCKED:
      'Esta solicitud o recurso ha sido bloqueado por el administrador.',
    NETWORK_ERROR:
      'No se pudo conectar con el servicio de extracción VIDNEX (/api/extract).',
  },
  pt: {
    UNSUPPORTED_URL:
      'Link não suportado. Apenas links do TikTok, Instagram e X (Twitter) são suportados.',
    NOT_FOUND:
      'Conteúdo não encontrado. O tweet, vídeo ou publicação pode ter sido removido.',
    NO_MEDIA:
      'Este tweet não contém nenhum vídeo ou imagem.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Este conteúdo é privado, sensível ou possui restrição de idade.',
    RATE_LIMITED:
      'Limite de requisições atingido temporariamente. Tente novamente em alguns segundos.',
    BLOCKED_BY_PLATFORM:
      'A plataforma restringiu temporariamente as requisições públicas. Tente novamente em instantes.',
    TIMEOUT:
      'O tempo limite expirou ao buscar a mídia. Tente novamente.',
    MAINTENANCE:
      'O VIDNEX está temporariamente em manutenção. Tente novamente em instantes.',
    PLATFORM_DISABLED:
      'A extração para esta plataforma está temporariamente desativada pelo administrador.',
    BLOCKED:
      'Esta solicitação ou recurso foi bloqueado pelo administrador.',
    NETWORK_ERROR:
      'Não foi possível conectar ao serviço de extração VIDNEX (/api/extract).',
  },
  ar: {
    UNSUPPORTED_URL:
      'هذا الرابط غير مدعوم. يتم حالياً دعم تيك توك وإنستغرام وإكس (تويتر) فقط.',
    NOT_FOUND:
      'لم يتم العثور على المحتوى. ربما تم حذف التغريدة أو الفيديو أو المنشور.',
    NO_MEDIA:
      'هذه التغريدة لا تحتوي على أي فيديو أو صورة.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'هذا المحتوى خاص أو مقيد بالعمر أو مصنف كمحتوى حساس.',
    RATE_LIMITED:
      'تم تجاوز حد الطلبات المؤقت. يرجى المحاولة مرة أخرى بعد ثوانٍ.',
    BLOCKED_BY_PLATFORM:
      'قامت المنصة بتقييد الطلبات العامة مؤقتاً. يرجى المحاولة مرة أخرى بعد قليل.',
    TIMEOUT:
      'انتهت مهلة الاتصال أثناء جلب الوسائط. يرجى المحاولة مرة أخرى.',
    MAINTENANCE:
      'الخدمة في وضع الصيانة المؤقتة. يرجى المحاولة مرة أخرى قريباً.',
    PLATFORM_DISABLED:
      'تم تعطيل الاستخراج لهذه المنصة مؤقتاً من قبل المسؤول.',
    BLOCKED:
      'تم حظر هذا الطلب أو الرابط من قبل المسؤول.',
    NETWORK_ERROR:
      'تعذر الاتصال بخدمة الاستخراج VIDNEX (/api/extract).',
  },
};

export function getLocalizedErrorMessage(
  code: string,
  language: LanguageCode = 'en'
): string {
  const dict = ERROR_MESSAGES_I18N[language] || ERROR_MESSAGES_I18N.en;
  return dict[code] || dict.BLOCKED_BY_PLATFORM;
}

/**
 * Appel principal de l'API Cloudflare Pages Function `/api/extract`
 */
export async function extractMediaFromUrl(
  url: string,
  detected: DetectedUrlInfo,
  language: LanguageCode = 'en'
): Promise<MediaResult> {
  if (!detected.isValid || !detected.platform) {
    throw new Error(getLocalizedErrorMessage('UNSUPPORTED_URL', language));
  }

  const normalizedPlatform =
    detected.platform === 'twitter' ? 'x' : detected.platform;

  const queryParams = new URLSearchParams({
    url: detected.normalizedUrl || url,
    platform: normalizedPlatform,
  });

  const queryUrl = resolveApiUrl(`/api/extract?${queryParams.toString()}`);

  let response: Response;
  try {
    response = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
  } catch {
    try {
      response = await fetch(resolveApiUrl('/api/extract'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          url: detected.normalizedUrl || url,
          platform: normalizedPlatform,
        }),
      });
    } catch {
      throw new Error(getLocalizedErrorMessage('NETWORK_ERROR', language));
    }
  }

  const data: any = await response.json().catch(() => null);

  if (!data || !data.ok || data.error) {
    const errCode = data?.error?.code || 'BLOCKED_BY_PLATFORM';
    const localized = getLocalizedErrorMessage(errCode, language);
    throw new Error(localized);
  }

  const platform: PlatformId =
    (data.platform as PlatformId) ||
    (detected.platform as PlatformId) ||
    'tiktok';
  const authorName =
    data.author?.nickname || `@${data.author?.username || 'user'}`;
  const creatorHandle = `@${(data.author?.username || 'user').replace(/^@/, '')}`;
  const nowTime = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const badgeLabel =
    detected.badgeLabel ||
    (platform === 'tiktok'
      ? 'TikTok Video'
      : platform === 'x' || platform === 'twitter'
      ? `X Post (${creatorHandle})`
      : 'Instagram Reel');

  // 1. Format Photo de Profil (DP)
  if (data.type === 'profile' || detected.mediaType === 'profile') {
    const dpItem = data.items?.[0];
    const previewUrl = resolveApiUrl(
      data.thumbnail || data.author?.avatar || dpItem?.url || ''
    );
    const downloadUrl = resolveApiUrl(dpItem?.url || previewUrl);
    const realDimensions =
      dpItem?.width && dpItem?.height
        ? `${dpItem.width} × ${dpItem.height}`
        : dpItem?.dimensions || undefined;

    return {
      id: `dp-${Date.now()}`,
      payloadType: 'profile_dp',
      platform,
      badgeLabel:
        platform === 'tiktok'
          ? `TikTok Profile (${creatorHandle})`
          : `Instagram Profile (${creatorHandle})`,
      sourceUrl: url,
      creatorHandle,
      creatorName: authorName,
      verified: Boolean(data.author?.verified),
      extractedAt: nowTime,
      biography: data.author?.biography || data.title || '',
      followersCount: data.author?.followers || undefined,
      standardPreviewUrl: previewUrl,
      hdOriginalUrl: downloadUrl,
      dimensions: realDimensions,
      fileSize: dpItem?.size || undefined,
      format: 'JPG',
    };
  }

  // 2. Format Carrousel Multi-Slides
  if (data.type === 'carousel') {
    const items: CarouselSlideItem[] = (data.items || [])
      .filter((it: any) => it.kind === 'image' || it.kind === 'video')
      .map((it: any, idx: number) => ({
        id: `slide-${idx + 1}`,
        index: idx + 1,
        mediaType: it.kind === 'video' ? 'video' : 'image',
        dimensions:
          it.width && it.height
            ? `${it.width} × ${it.height}`
            : it.dimensions || undefined,
        fileSize: it.size || undefined,
        thumbnailUrl: resolveApiUrl(it.thumbnail || it.url),
        downloadUrl: resolveApiUrl(it.url),
      }));

    const audioItem = (data.items || []).find((it: any) => it.kind === 'audio');

    return {
      id: `car-${Date.now()}`,
      payloadType: 'carousel',
      platform,
      badgeLabel: `${badgeLabel} (Carousel)`,
      sourceUrl: url,
      creatorHandle,
      creatorName: authorName,
      verified: Boolean(data.author?.verified),
      extractedAt: nowTime,
      caption: data.title || `${creatorHandle}`,
      totalItems: items.length,
      archiveSize: undefined,
      items,
      audioTrack: audioItem
        ? {
            title: 'Original Audio MP3',
            fileSize: audioItem.size || undefined,
            downloadUrl: resolveApiUrl(audioItem.url),
          }
        : undefined,
    };
  }

  // 3. Format Vidéo (multi-qualités MP4) ou Image Unique HD
  const mediaItems = (data.items || []).filter(
    (it: any) => it.kind === 'video' || it.kind === 'image'
  );
  const primaryMedia = mediaItems[0] || data.items?.[0];
  const audioItem = (data.items || []).find((it: any) => it.kind === 'audio');

  const formats: VideoFormatOption[] = [];

  if (mediaItems.length > 0) {
    mediaItems.forEach((it: any, index: number) => {
      const isImage = it.kind === 'image' || data.type === 'image';
      const extUpper = String(it.ext || (isImage ? 'jpg' : 'mp4')).toUpperCase();
      const container: VideoFormatOption['container'] =
        extUpper === 'PNG' ? 'PNG' : isImage ? 'JPG' : 'MP4';
      const qualityLabel = String(
        it.quality || (isImage ? 'Original' : index === 0 ? '1080p' : '720p')
      );

      let label: string;
      if (isImage) {
        label = `Download Original Image (${container} ${qualityLabel})`;
      } else if (index === 0) {
        label = `Download HD ${qualityLabel} (MP4)`;
      } else {
        label = `Download MP4 ${qualityLabel}`;
      }

      formats.push({
        id: `fmt-${index}-${qualityLabel}`,
        label,
        quality: qualityLabel,
        container,
        fileSize: it.size || undefined,
        noWatermark: true,
        downloadUrl: resolveApiUrl(it.url),
        isPrimary: index === 0,
      });
    });
  } else if (primaryMedia) {
    formats.push({
      id: 'hd-1080p',
      label: 'Download HD 1080p (No Watermark)',
      quality: '1080p',
      container: 'MP4',
      fileSize: primaryMedia.size || undefined,
      noWatermark: true,
      downloadUrl: resolveApiUrl(primaryMedia.url),
      isPrimary: true,
    });
  }

  if (audioItem) {
    formats.push({
      id: 'audio-mp3',
      label: 'Extract Audio (MP3)',
      quality: 'MP3',
      container: 'MP3',
      fileSize: audioItem.size || undefined,
      noWatermark: true,
      downloadUrl: resolveApiUrl(audioItem.url),
    });
  }

  const realResolution =
    primaryMedia?.width && primaryMedia?.height
      ? `${primaryMedia.width} × ${primaryMedia.height}`
      : primaryMedia?.quality
      ? `${primaryMedia.quality} HD`
      : undefined;

  return {
    id: `vid-${Date.now()}`,
    payloadType: 'video',
    platform,
    badgeLabel,
    sourceUrl: url,
    creatorHandle,
    creatorName: authorName,
    verified: Boolean(data.author?.verified),
    extractedAt: nowTime,
    title: data.title || creatorHandle,
    duration: data.duration || undefined,
    aspectRatio:
      primaryMedia?.width &&
      primaryMedia?.height &&
      primaryMedia.width >= primaryMedia.height
        ? '16:9'
        : '9:16',
    resolution: realResolution,
    codec: undefined,
    thumbnailUrl: resolveApiUrl(data.thumbnail || primaryMedia?.url || ''),
    formats,
  };
}
