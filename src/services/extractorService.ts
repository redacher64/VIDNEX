import type { DetectedUrlInfo, PlatformId } from '../utils/urlDetector.ts';
import type { LanguageCode } from '../i18n/translations.ts';
import { getLocaleBundleSync } from '../i18n/localeLoader.ts';

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
  quality: 'HD' | 'Standard';
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

const PROFILE_ERROR_MESSAGES: Record<
  LanguageCode,
  {
    NOT_FOUND: string;
    BLOCKED_BY_PLATFORM: string;
    PRIVATE_OR_LOGIN_REQUIRED: string;
    TIMEOUT: string;
  }
> = {
  fr: {
    NOT_FOUND:
      "Compte introuvable. Ce profil Instagram n'existe pas ou a été supprimé.",
    BLOCKED_BY_PLATFORM:
      'Instagram bloque temporairement la demande. Réessayez dans quelques minutes.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Impossible de récupérer la photo de profil publique pour ce compte.',
    TIMEOUT:
      "Délai d'attente dépassé lors de la récupération de la photo de profil. Réessayez plus tard.",
  },
  en: {
    NOT_FOUND:
      'Account not found. This Instagram profile does not exist or has been removed.',
    BLOCKED_BY_PLATFORM:
      'Instagram is temporarily blocking the request, please try again later.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Unable to retrieve the public profile photo for this account.',
    TIMEOUT:
      'Request timed out while fetching the profile photo. Please try again.',
  },
  ar: {
    NOT_FOUND: 'الحساب غير موجود. ملف إنستغرام هذا غير موجود أو تم حذفه.',
    BLOCKED_BY_PLATFORM:
      'يحظر إنستغرام الطلب مؤقتاً، يرجى المحاولة مرة أخرى لاحقاً.',
    PRIVATE_OR_LOGIN_REQUIRED: 'تعذر جلب صورة الملف الشخصي العامة لهذا الحساب.',
    TIMEOUT: 'انتهت مهلة الاتصال أثناء جلب صورة الملف الشخصي. حاول مرة أخرى.',
  },
  es: {
    NOT_FOUND:
      'Cuenta no encontrada. Este perfil de Instagram no existe o fue eliminado.',
    BLOCKED_BY_PLATFORM:
      'Instagram está bloqueando temporalmente la solicitud, inténtalo más tarde.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'No fue posible obtener la foto de perfil pública de esta cuenta.',
    TIMEOUT:
      'Tiempo de espera agotado al obtener la foto de perfil. Inténtalo de nuevo.',
  },
  pt: {
    NOT_FOUND:
      'Conta não encontrada. Este perfil do Instagram não existe ou foi removido.',
    BLOCKED_BY_PLATFORM:
      'O Instagram está bloqueando temporariamente a solicitação, tente novamente mais tarde.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Não foi possível obter a foto de perfil pública desta conta.',
    TIMEOUT:
      'Tempo limite esgotado ao buscar a foto de perfil. Tente novamente.',
  },
  de: {
    NOT_FOUND:
      'Konto nicht gefunden. Dieses Instagram-Profil existiert nicht oder wurde gelöscht.',
    BLOCKED_BY_PLATFORM:
      'Instagram blockiert die Anfrage vorübergehend, bitte später erneut versuchen.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Das öffentliche Profilbild für dieses Konto konnte nicht abgerufen werden.',
    TIMEOUT:
      'Zeitüberschreitung beim Abrufen des Profilbilds. Bitte erneut versuchen.',
  },
  tr: {
    NOT_FOUND:
      'Hesap bulunamadı. Bu Instagram profili mevcut değil veya silinmiş.',
    BLOCKED_BY_PLATFORM:
      'Instagram isteği geçici olarak engelliyor, lütfen daha sonra tekrar deneyin.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Bu hesabın herkese açık profil fotoğrafı alınamadı.',
    TIMEOUT:
      'Profil fotoğrafı alınırken zaman aşımı oluştu. Lütfen tekrar deneyin.',
  },
  id: {
    NOT_FOUND:
      'Akun tidak ditemukan. Profil Instagram ini tidak ada atau telah dihapus.',
    BLOCKED_BY_PLATFORM:
      'Instagram memblokir permintaan sementara, silakan coba lagi nanti.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Tidak dapat mengambil foto profil publik untuk akun ini.',
    TIMEOUT:
      'Waktu tunggu habis saat mengambil foto profil. Silakan coba lagi.',
  },
  it: {
    NOT_FOUND:
      'Account non trovato. Questo profilo Instagram non esiste o è stato rimosso.',
    BLOCKED_BY_PLATFORM:
      'Instagram sta temporaneamente bloccando la richiesta, riprova più tardi.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Impossibile recuperare la foto del profilo pubblica per questo account.',
    TIMEOUT:
      'Tempo scaduto durante il recupero della foto del profilo. Riprova.',
  },
  ru: {
    NOT_FOUND:
      'Аккаунт не найден. Этот профиль Instagram не существует или был удалён.',
    BLOCKED_BY_PLATFORM:
      'Instagram временно блокирует запрос, попробуйте позже.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Не удалось получить публичное фото профиля для этого аккаунта.',
    TIMEOUT: 'Превышено время ожидания при загрузке фото профиля. Повторите попытку.',
  },
};

export function getLocalizedErrorMessage(
  code: string,
  language: LanguageCode = 'fr',
  options?: { isProfile?: boolean }
): string {
  const profileDict =
    PROFILE_ERROR_MESSAGES[language] || PROFILE_ERROR_MESSAGES.fr;

  if (code === 'PROFILE_NOT_FOUND' || (options?.isProfile && code === 'NOT_FOUND')) {
    return profileDict.NOT_FOUND;
  }
  if (
    code === 'PROFILE_BLOCKED_BY_PLATFORM' ||
    (options?.isProfile && code === 'BLOCKED_BY_PLATFORM')
  ) {
    return profileDict.BLOCKED_BY_PLATFORM;
  }
  if (
    code === 'PROFILE_PRIVATE_OR_LOGIN_REQUIRED' ||
    (options?.isProfile && code === 'PRIVATE_OR_LOGIN_REQUIRED')
  ) {
    return profileDict.PRIVATE_OR_LOGIN_REQUIRED;
  }
  if (code === 'PROFILE_TIMEOUT' || (options?.isProfile && code === 'TIMEOUT')) {
    return profileDict.TIMEOUT;
  }

  const dict = getLocaleBundleSync(language).ui.errors as unknown as Record<
    string,
    string
  >;
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
    const localized = getLocalizedErrorMessage(errCode, language, {
      isProfile: detected.mediaType === 'profile',
    });
    throw new Error(localized);
  }

  const platform: PlatformId =
    (data.platform as PlatformId) ||
    (detected.platform as PlatformId) ||
    'tiktok';
  const creatorHandle = `@${(data.author?.username || 'user').replace(/^@/, '')}`;
  const fullAuthorName =
    data.author?.full_name ||
    (data.author?.nickname && data.author.nickname !== creatorHandle
      ? data.author.nickname
      : '');
  const authorName = fullAuthorName || creatorHandle;
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
      : platform === 'facebook'
      ? 'Facebook Video'
      : 'Instagram Reel');

  // 1. Format Photo de Profil (DP)
  const isProfilePayload =
    data.type === 'profile' ||
    detected.mediaType === 'profile' ||
    (platform === 'instagram' &&
      data.type === 'image' &&
      typeof data.title === 'string' &&
      /^@[a-z0-9._]{1,30}$/i.test(data.title.trim()));

  if (isProfilePayload) {
    const dpItem = data.items?.[0];
    const previewUrl = resolveApiUrl(
      data.thumbnail || data.author?.avatar || dpItem?.url || ''
    );
    const downloadUrl = resolveApiUrl(dpItem?.url || previewUrl);
    const realDimensions =
      dpItem?.width && dpItem?.height
        ? `${dpItem.width} × ${dpItem.height}`
        : dpItem?.dimensions || undefined;
    const itemQuality: 'HD' | 'Standard' =
      String(dpItem?.quality || 'HD').toLowerCase() === 'standard'
        ? 'Standard'
        : 'HD';

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
      creatorName: fullAuthorName,
      verified: Boolean(data.author?.verified),
      extractedAt: nowTime,
      biography: data.author?.biography || data.title || '',
      followersCount: data.author?.followers || undefined,
      standardPreviewUrl: previewUrl,
      hdOriginalUrl: downloadUrl,
      quality: itemQuality,
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
      ? primaryMedia.quality === 'HD' || primaryMedia.quality === 'SD'
        ? `MP4 · ${primaryMedia.quality}`
        : `${primaryMedia.quality} HD`
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
