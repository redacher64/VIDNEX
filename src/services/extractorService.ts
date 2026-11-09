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
  quality: '1080p' | '720p' | 'MP3';
  container: 'MP4' | 'MP3';
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
      'Unsupported link. Currently, Instagram (Reels, Posts, Carousels, Profiles) and TikTok (Videos, Photos, Profiles) are supported.',
    NOT_FOUND:
      'Media not found. The video or post may have been deleted or made private.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'This content is private or requires a logged-in session (IG_SESSION_ID secret in Cloudflare Pages).',
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
      'Ce lien n\'est pas supporté. Seules les vidéos, photos et profils TikTok et Instagram sont pris en charge.',
    NOT_FOUND:
      'Contenu introuvable. La vidéo ou publication a peut-être été supprimée ou est privée.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Ce contenu est privé ou nécessite une session connectée (secret IG_SESSION_ID optionnel dans Cloudflare Pages).',
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
      'Enlace no compatible. Solo se admiten vídeos, fotos y perfiles de TikTok e Instagram.',
    NOT_FOUND:
      'Contenido no encontrado. Es posible que el vídeo o la publicación se haya eliminado o sea privado.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Este contenido es privado o requiere inicio de sesión en el servidor.',
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
      'Link não suportado. Apenas vídeos, fotos e perfis do TikTok e Instagram são suportados.',
    NOT_FOUND:
      'Conteúdo não encontrado. O vídeo ou publicação pode ter sido removido ou tornado privado.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Este conteúdo é privado ou requer autenticação no servidor.',
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
      'هذا الرابط غير مدعوم. يتم حالياً دعم مقاطع الفيديو والصور والملفات الشخصية من تيك توك وإنستغرام فقط.',
    NOT_FOUND:
      'لم يتم العثور على المحتوى. ربما تم حذف الفيديو أو المنشور أو أنه خاص.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'هذا المحتوى خاص أو يتطلب تسجيل الدخول.',
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

  const queryParams = new URLSearchParams({
    url: detected.normalizedUrl || url,
    platform: detected.platform,
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
          platform: detected.platform,
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
    (platform === 'tiktok' ? 'TikTok Video' : 'Instagram Reel');

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

  // 3. Format Vidéo / Image HD
  const videoItems = (data.items || []).filter(
    (it: any) => it.kind === 'video' || it.kind === 'image'
  );
  const primaryVideo = videoItems[0] || data.items?.[0];
  const sdVideo = videoItems.find((it: any) => it.quality === '720p');
  const audioItem = (data.items || []).find((it: any) => it.kind === 'audio');

  const formats: VideoFormatOption[] = [];

  if (primaryVideo) {
    formats.push({
      id: 'hd-1080p',
      label: 'Download HD 1080p (No Watermark)',
      quality: '1080p',
      container: 'MP4',
      fileSize: primaryVideo.size || undefined,
      noWatermark: true,
      downloadUrl: resolveApiUrl(primaryVideo.url),
      isPrimary: true,
    });
  }

  if (sdVideo && sdVideo.url !== primaryVideo?.url) {
    formats.push({
      id: 'sd-720p',
      label: 'Download SD 720p',
      quality: '720p',
      container: 'MP4',
      fileSize: sdVideo.size || undefined,
      noWatermark: true,
      downloadUrl: resolveApiUrl(sdVideo.url),
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
    primaryVideo?.width && primaryVideo?.height
      ? `${primaryVideo.width} × ${primaryVideo.height}`
      : primaryVideo?.quality === '1080p'
      ? '1080p HD'
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
    aspectRatio: '9:16',
    resolution: realResolution,
    codec: undefined,
    thumbnailUrl: resolveApiUrl(data.thumbnail || primaryVideo?.url || ''),
    formats,
  };
}
