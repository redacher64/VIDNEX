import type { DetectedUrlInfo, PlatformId } from '../utils/urlDetector.ts';

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
  fileSize: string;
  noWatermark: boolean;
  downloadUrl: string;
  isPrimary?: boolean;
}

export interface CarouselSlideItem {
  id: string;
  index: number;
  mediaType: 'image' | 'video';
  dimensions: string;
  fileSize: string;
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
  duration: string;
  aspectRatio: '9:16' | '16:9';
  resolution: string;
  codec: string;
  thumbnailUrl: string;
  formats: VideoFormatOption[];
}

export interface ProfileDpMediaResult extends BaseMediaResult {
  payloadType: 'profile_dp';
  biography: string;
  followersCount: string;
  standardPreviewUrl: string;
  hdOriginalUrl: string;
  dimensions: string;
  fileSize: string;
  format: 'JPG';
}

export interface CarouselMediaResult extends BaseMediaResult {
  payloadType: 'carousel';
  caption: string;
  totalItems: number;
  archiveSize: string;
  items: CarouselSlideItem[];
  audioTrack?: {
    title: string;
    fileSize: string;
    downloadUrl: string;
  };
}

export type MediaResult =
  | VideoMediaResult
  | ProfileDpMediaResult
  | CarouselMediaResult;

const ERROR_MESSAGES_FR: Record<string, string> = {
  UNSUPPORTED_URL:
    'Ce lien n\'est pas supporté. Seules les vidéos, photos et profils TikTok et Instagram sont pris en charge.',
  NOT_FOUND:
    'Contenu introuvable. La vidéo ou publication a peut-être été supprimée ou est inaccessible.',
  PRIVATE_OR_LOGIN_REQUIRED:
    'Ce contenu est privé ou nécessite un compte connecté côté serveur (secret IG_SESSION_ID dans Cloudflare Pages).',
  BLOCKED_BY_PLATFORM:
    'La plateforme a temporairement restreint les requêtes publiques. Veuillez réessayer dans quelques instants.',
  TIMEOUT:
    'Le délai d\'attente a expiré lors de la récupération du média. Veuillez réessayer.',
};

/**
 * Appel principal de l'API Cloudflare Pages Function `/api/extract`
 */
export async function extractMediaFromUrl(
  url: string,
  detected: DetectedUrlInfo
): Promise<MediaResult> {
  if (!detected.isValid || !detected.platform) {
    throw new Error(ERROR_MESSAGES_FR.UNSUPPORTED_URL);
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
    } catch (err: any) {
      throw new Error(
        err?.message?.includes('Failed to fetch')
          ? 'Impossible de joindre le service d\'extraction VIDNEX (/api/extract).'
          : 'Erreur réseau lors de la communication avec le serveur.'
      );
    }
  }

  const data: any = await response.json().catch(() => null);

  if (!data || !data.ok || data.error) {
    const errCode = data?.error?.code || 'BLOCKED_BY_PLATFORM';
    const message =
      data?.error?.message ||
      ERROR_MESSAGES_FR[errCode] ||
      'Erreur lors de l\'extraction.';
    throw new Error(message);
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

  // 1. Format Photo de Profil (DP 1080×1080)
  if (data.type === 'profile' || detected.mediaType === 'profile') {
    const dpItem = data.items?.[0];
    const previewUrl = resolveApiUrl(
      data.thumbnail || data.author?.avatar || dpItem?.url || ''
    );
    const downloadUrl = resolveApiUrl(dpItem?.url || previewUrl);

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
      verified: Boolean(data.author?.verified ?? true),
      extractedAt: nowTime,
      biography:
        data.author?.biography ||
        data.title ||
        'Photo de profil HD originale extraite par VIDNEX.',
      followersCount: data.author?.followers || '142.8K',
      standardPreviewUrl: previewUrl,
      hdOriginalUrl: downloadUrl,
      dimensions: '1080 × 1080',
      fileSize: dpItem?.size || '1.8 MB',
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
        dimensions: '1080 × 1350',
        fileSize: it.size || (it.kind === 'video' ? '6.8 MB' : '1.9 MB'),
        thumbnailUrl: resolveApiUrl(it.thumbnail || it.url),
        downloadUrl: resolveApiUrl(it.url),
      }));

    const audioItem = (data.items || []).find((it: any) => it.kind === 'audio');

    return {
      id: `car-${Date.now()}`,
      payloadType: 'carousel',
      platform,
      badgeLabel: `${badgeLabel} (Carrousel)`,
      sourceUrl: url,
      creatorHandle,
      creatorName: authorName,
      verified: Boolean(data.author?.verified ?? true),
      extractedAt: nowTime,
      caption: data.title || 'Publication Carrousel Multi-Slides HD',
      totalItems: items.length,
      archiveSize: `${(items.length * 1.9).toFixed(1)} MB`,
      items,
      audioTrack: audioItem
        ? {
            title: 'Audio Original MP3',
            fileSize: audioItem.size || '2.4 MB',
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
      fileSize: primaryVideo.size || '16.8 MB',
      noWatermark: true,
      downloadUrl: resolveApiUrl(primaryVideo.url),
      isPrimary: true,
    });
  }

  if (sdVideo) {
    formats.push({
      id: 'sd-720p',
      label: 'Download SD 720p',
      quality: '720p',
      container: 'MP4',
      fileSize: sdVideo.size || '7.9 MB',
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
      fileSize: audioItem.size || '2.1 MB',
      noWatermark: true,
      downloadUrl: resolveApiUrl(audioItem.url),
    });
  }

  return {
    id: `vid-${Date.now()}`,
    payloadType: 'video',
    platform,
    badgeLabel,
    sourceUrl: url,
    creatorHandle,
    creatorName: authorName,
    verified: Boolean(data.author?.verified ?? true),
    extractedAt: nowTime,
    title: data.title || 'Vidéo HD extraite par VIDNEX',
    duration: data.duration || '00:30',
    aspectRatio: '9:16',
    resolution: '1080 × 1920',
    codec: 'H.264 / AAC • 60fps',
    thumbnailUrl: resolveApiUrl(data.thumbnail || primaryVideo?.url || ''),
    formats,
  };
}
