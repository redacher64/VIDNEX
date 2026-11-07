import type { DetectedUrlInfo, PlatformId } from '../utils/urlDetector.ts';

/**
 * Configuration API Cloudflare Pages Functions
 * Les routes /api/extract et /api/download sont relatives au domaine Cloudflare Pages.
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
    'Ce lien n\'est pas supporté. Seules les vidéos TikTok et les publications Instagram publiques sont prises en charge.',
  NOT_FOUND:
    'Contenu introuvable. La vidéo ou publication a peut-être été supprimée ou est inaccessible.',
  PRIVATE_OR_LOGIN_REQUIRED:
    'Ce contenu est privé ou nécessite une connexion. Impossible d\'y accéder sans compte connecté.',
  BLOCKED_BY_PLATFORM:
    'La plateforme a temporairement restreint les requêtes publiques. Veuillez réessayer dans quelques instants.',
  TIMEOUT:
    'Le délai d\'attente a expiré lors de la récupération du média. Veuillez réessayer.',
};

/**
 * Appel principal de l'API /api/extract
 */
export async function extractMediaFromUrl(
  url: string,
  detected: DetectedUrlInfo
): Promise<MediaResult> {
  if (!detected.isValid || !detected.platform) {
    throw new Error(ERROR_MESSAGES_FR.UNSUPPORTED_URL);
  }

  const queryUrl = resolveApiUrl(
    `/api/extract?${new URLSearchParams({ url: detected.normalizedUrl || url }).toString()}`
  );

  let response: Response;
  try {
    response = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
  } catch {
    // Tentative en POST si GET échoue
    try {
      response = await fetch(resolveApiUrl('/api/extract'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ url: detected.normalizedUrl || url }),
      });
    } catch (err: any) {
      throw new Error(
        err?.message?.includes('Failed to fetch')
          ? 'Impossible de joindre le service d\'extraction VIDNEX.'
          : 'Erreur réseau lors de la communication avec le serveur.'
      );
    }
  }

  const data: any = await response.json().catch(() => null);

  if (!data || !data.ok || data.error) {
    const errCode = data?.error?.code || 'BLOCKED_BY_PLATFORM';
    const message = ERROR_MESSAGES_FR[errCode] || data?.error?.message || 'Erreur lors de l\'extraction.';
    throw new Error(message);
  }

  const platform: PlatformId = (data.platform as PlatformId) || (detected.platform as PlatformId) || 'tiktok';
  const authorName = data.author?.nickname || `@${data.author?.username || 'user'}`;
  const creatorHandle = `@${(data.author?.username || 'user').replace(/^@/, '')}`;
  const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const badgeLabel = detected.badgeLabel || (platform === 'tiktok' ? 'TikTok Video' : 'Instagram Reel');

  // Format Carrousel
  if (data.type === 'carousel') {
    const items: CarouselSlideItem[] = (data.items || [])
      .filter((it: any) => it.kind === 'image' || it.kind === 'video')
      .map((it: any, idx: number) => ({
        id: `slide-${idx + 1}`,
        index: idx + 1,
        mediaType: it.kind === 'video' ? 'video' : 'image',
        dimensions: '1080 × 1350',
        fileSize: it.size || '1.8 MB',
        thumbnailUrl: resolveApiUrl(it.url),
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
      verified: true,
      extractedAt: nowTime,
      caption: data.title || 'Publication Carrousel Multi-Photos',
      totalItems: items.length,
      archiveSize: `${(items.length * 1.8).toFixed(1)} MB`,
      items,
      audioTrack: audioItem
        ? {
            title: 'Audio Original',
            fileSize: '2.4 MB',
            downloadUrl: resolveApiUrl(audioItem.url),
          }
        : undefined,
    };
  }

  // Format Vidéo
  const videoItem = (data.items || []).find((it: any) => it.kind === 'video') || data.items?.[0];
  const audioItem = (data.items || []).find((it: any) => it.kind === 'audio');

  const formats: VideoFormatOption[] = [];

  if (videoItem) {
    formats.push({
      id: 'hd-1080p',
      label: 'Télécharger HD 1080p (Sans Filigrane)',
      quality: '1080p',
      container: 'MP4',
      fileSize: videoItem.size || '17.9 MB',
      noWatermark: true,
      downloadUrl: resolveApiUrl(videoItem.url),
      isPrimary: true,
    });
  }

  if (audioItem) {
    formats.push({
      id: 'audio-mp3',
      label: 'Extraire Audio (MP3)',
      quality: 'MP3',
      container: 'MP3',
      fileSize: audioItem.size || '2.4 MB',
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
    verified: true,
    extractedAt: nowTime,
    title: data.title || 'Vidéo HD extraite par VIDNEX',
    duration: '00:30',
    aspectRatio: '9:16',
    resolution: '1080 × 1920',
    codec: 'H.264 / AAC • 60fps',
    thumbnailUrl: resolveApiUrl(data.thumbnail || videoItem?.url || ''),
    formats,
  };
}
