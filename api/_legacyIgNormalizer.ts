import type {
  MediaResult,
  VideoMediaResult,
  ProfileDpMediaResult,
  CarouselMediaResult,
  CarouselSlideItem,
} from '../src/services/extractorService';
import {
  ExtractRequestBody,
  wrapWithDownloadProxy,
  wrapWithImageProxy,
  formatDurationSeconds,
  formatFollowersCount,
} from './_normalizer';

export function normalizeInstagramRapidApiPayload(
  raw: any,
  req: ExtractRequestBody
): MediaResult | null {
  if (!raw || typeof raw !== 'object') return null;

  const data =
    raw.data?.xdt_shortcode_media ||
    raw.graphql?.shortcode_media ||
    raw.data?.user ||
    raw.user ||
    raw.data ||
    raw.result ||
    raw;

  if (!data || typeof data !== 'object') return null;

  const nowIso = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const hdProfilePic =
    data.hd_profile_pic_url_info?.url ||
    data.profile_pic_url_hd ||
    data.user?.hd_profile_pic_url_info?.url ||
    data.user?.profile_pic_url_hd;

  if (
    req.mediaType === 'profile' ||
    (hdProfilePic &&
      !data.video_url &&
      !data.video_versions &&
      !data.edge_sidecar_to_children &&
      !data.carousel_media)
  ) {
    const picUrl =
      hdProfilePic || data.profile_pic_url || data.user?.profile_pic_url;
    if (!picUrl) return null;

    const rawHandle =
      data.username ||
      data.user?.username ||
      (req.identifier || 'instagram').replace(/^@/, '');
    const cleanHandle = String(rawHandle).replace(/^@/, '');

    const result: ProfileDpMediaResult = {
      id: `ig-dp-${cleanHandle}-${Date.now()}`,
      payloadType: 'profile_dp',
      platform: 'instagram',
      badgeLabel: req.badgeLabel || `Instagram Profile (@${cleanHandle})`,
      sourceUrl: req.url,
      creatorHandle: `@${cleanHandle}`,
      creatorName: data.full_name || data.user?.full_name || `@${cleanHandle}`,
      verified: Boolean(data.is_verified ?? data.user?.is_verified ?? true),
      extractedAt: nowIso,
      biography:
        data.biography ||
        data.bio ||
        'Instagram creator profile resolved via VIDNEX HD DP pipeline.',
      followersCount: formatFollowersCount(
        data.follower_count ??
          data.edge_followed_by?.count ??
          data.followers_count
      ),
      standardPreviewUrl: wrapWithImageProxy(picUrl),
      hdOriginalUrl: wrapWithDownloadProxy(
        picUrl,
        `VIDNEX_${cleanHandle}_HD_DP.jpg`
      ),
      dimensions: '1080 × 1080',
      fileSize: '1.8 MB',
      format: 'JPG',
    };
    return result;
  }

  const owner = data.owner || data.user || {};
  const handle = String(
    owner.username || (req.identifier || 'instagram_creator').replace(/^@/, '')
  ).replace(/^@/, '');
  const fullName = String(owner.full_name || `@${handle}`);
  const captionText =
    data.edge_media_to_caption?.edges?.[0]?.node?.text ||
    data.caption?.text ||
    data.title ||
    'Instagram HD Original Media Stream';

  const sidecarEdges: any[] | undefined =
    data.edge_sidecar_to_children?.edges || data.carousel_media;

  if (Array.isArray(sidecarEdges) && sidecarEdges.length > 0) {
    const items: CarouselSlideItem[] = sidecarEdges.map((edge, idx) => {
      const node = edge?.node || edge || {};
      const isVideo = Boolean(
        node.is_video ||
          node.media_type === 2 ||
          node.video_url ||
          node.video_versions?.[0]?.url
      );
      const mediaUrl: string =
        (isVideo
          ? node.video_url || node.video_versions?.[0]?.url
          : node.display_url ||
            node.image_versions2?.candidates?.[0]?.url ||
            node.thumbnail_src) || '';
      const thumbUrl: string =
        node.display_url ||
        node.image_versions2?.candidates?.[0]?.url ||
        node.thumbnail_src ||
        '';
      const width = node.dimensions?.width || node.original_width || 1080;
      const height = node.dimensions?.height || node.original_height || 1350;
      const ext = isVideo ? 'mp4' : 'jpg';

      return {
        id: String(node.id || node.pk || `slide-${idx + 1}`),
        index: idx + 1,
        mediaType: isVideo ? 'video' : 'image',
        dimensions: `${width} × ${height}`,
        fileSize: isVideo ? '7.8 MB' : '2.1 MB',
        thumbnailUrl: wrapWithImageProxy(thumbUrl),
        downloadUrl: wrapWithDownloadProxy(
          mediaUrl || thumbUrl,
          `VIDNEX_${handle}_slide_${idx + 1}.${ext}`
        ),
      };
    });

    const carouselResult: CarouselMediaResult = {
      id: `ig-carousel-${data.id || Date.now()}`,
      payloadType: 'carousel',
      platform: 'instagram',
      badgeLabel: req.badgeLabel || 'Instagram Multi-Slide Carousel',
      sourceUrl: req.url,
      creatorHandle: `@${handle}`,
      creatorName: fullName,
      verified: Boolean(owner.is_verified ?? true),
      extractedAt: nowIso,
      caption: String(captionText).slice(0, 220),
      totalItems: items.length,
      archiveSize: `${(items.length * 2.6).toFixed(1)} MB`,
      items,
    };
    return carouselResult;
  }

  const videoUrl: string | undefined =
    data.video_url || data.video_versions?.[0]?.url;
  const sdVideoUrl: string | undefined =
    data.video_versions?.[1]?.url || videoUrl;
  const displayUrl: string | undefined =
    data.display_url ||
    data.thumbnail_src ||
    data.image_versions2?.candidates?.[0]?.url;

  if (!videoUrl && !displayUrl) return null;

  const primaryMediaUrl = videoUrl || displayUrl!;
  const width = data.dimensions?.width || data.original_width || 1080;
  const height = data.dimensions?.height || data.original_height || 1920;

  const videoResult: VideoMediaResult = {
    id: `ig-vid-${data.id || Date.now()}`,
    payloadType: 'video',
    platform: 'instagram',
    badgeLabel: req.badgeLabel || 'Instagram Reel',
    sourceUrl: req.url,
    creatorHandle: `@${handle}`,
    creatorName: fullName,
    verified: Boolean(owner.is_verified ?? true),
    extractedAt: nowIso,
    title: String(captionText).slice(0, 180),
    duration: formatDurationSeconds(data.video_duration ?? data.duration),
    aspectRatio: width > height ? '16:9' : '9:16',
    resolution: `${width} × ${height}`,
    codec: 'H.264 / AAC • 60fps',
    thumbnailUrl: wrapWithImageProxy(displayUrl),
    formats: [
      {
        id: 'hd-1080p',
        label: 'Download HD 1080p (No Watermark)',
        quality: '1080p',
        container: 'MP4',
        fileSize: '14.2 MB',
        noWatermark: true,
        downloadUrl: wrapWithDownloadProxy(
          primaryMediaUrl,
          `VIDNEX_instagram_${handle}_1080p.mp4`
        ),
        isPrimary: true,
      },
      {
        id: 'sd-720p',
        label: 'Download SD 720p',
        quality: '720p',
        container: 'MP4',
        fileSize: '6.8 MB',
        noWatermark: true,
        downloadUrl: wrapWithDownloadProxy(
          sdVideoUrl || primaryMediaUrl,
          `VIDNEX_instagram_${handle}_720p.mp4`
        ),
      },
      {
        id: 'audio-mp3',
        label: 'Extract Audio (MP3)',
        quality: 'MP3',
        container: 'MP3',
        fileSize: '1.4 MB',
        noWatermark: true,
        downloadUrl: wrapWithDownloadProxy(
          primaryMediaUrl,
          `VIDNEX_instagram_${handle}_audio.mp3`
        ),
      },
    ],
  };

  return videoResult;
}
