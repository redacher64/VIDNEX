import { DetectedUrlInfo, PlatformId } from '../utils/urlDetector';

/**
 * Production Backend Configuration
 * Set DEMO_MODE = false when connecting to your self-hosted FastAPI yt-dlp / Cobalt service.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://api.vidnex.space';
export const DEMO_MODE = true;

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

/**
 * Main extraction dispatcher.
 * Calls POST `${API_BASE_URL}/api/extract` in production or returns deterministic
 * Swiss-grade mock payloads in 650ms when DEMO_MODE = true.
 */
export async function extractMediaFromUrl(
  url: string,
  detected: DetectedUrlInfo
): Promise<MediaResult> {
  if (!detected.isValid || !detected.platform) {
    throw new Error(
      'Unsupported or malformed URL. Please verify the link is from a supported platform.'
    );
  }

  // Simulate private account error if URL explicitly contains "/private"
  if (url.toLowerCase().includes('private')) {
    await new Promise((resolve) => setTimeout(resolve, 450));
    throw new Error(
      'EXTRACTION_DENIED: Target media belongs to a private account or restricted broadcast.'
    );
  }

  if (!DEMO_MODE) {
    const response = await fetch(`${API_BASE_URL}/api/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        url: detected.normalizedUrl,
        platform: detected.platform,
        mediaType: detected.mediaType,
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(
        errBody.message ||
          `Upstream extraction failed with status ${response.status}`
      );
    }

    return (await response.json()) as MediaResult;
  }

  // Simulated 650ms extraction latency in DEMO_MODE
  await new Promise((resolve) => setTimeout(resolve, 650));

  return buildMockMediaResult(url, detected);
}

function createStudioArtworkDataUri(
  title: string,
  subtitle: string,
  accentStart = '#ea580c',
  accentEnd = '#f59e0b',
  aspect: 'square' | 'portrait' = 'portrait'
): string {
  const width = 720;
  const height = aspect === 'square' ? 720 : 900;
  const isPhotoOrAvatar =
    aspect === 'square' || subtitle.toUpperCase().includes('JPG');
  const centerEmblem = isPhotoOrAvatar
    ? `<circle cx="${width / 2}" cy="${height * 0.46}" r="62" fill="${accentStart}" fill-opacity="0.18" stroke="${accentEnd}" stroke-width="2.5"/>
       <circle cx="${width / 2}" cy="${height * 0.46}" r="34" fill="none" stroke="#fffaf5" stroke-width="2.5" stroke-opacity="0.85"/>
       <circle cx="${width / 2 + 18}" cy="${height * 0.46 - 18}" r="6" fill="${accentEnd}"/>`
    : `<circle cx="${width / 2}" cy="${height * 0.48}" r="54" fill="${accentStart}" fill-opacity="0.22" stroke="${accentEnd}" stroke-width="2"/>
       <polygon points="${width / 2 - 12},${height * 0.48 - 18} ${width / 2 + 20},${height * 0.48} ${width / 2 - 12},${height * 0.48 + 18}" fill="#fffaf5"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1f130b"/>
        <stop offset="55%" stop-color="#2e1a10"/>
        <stop offset="100%" stop-color="#431407"/>
      </linearGradient>
      <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${accentStart}" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="${accentEnd}" stop-opacity="0.25"/>
      </linearGradient>
      <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
        <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#fdba74" stroke-width="1" stroke-opacity="0.08"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <rect width="100%" height="100%" fill="url(#grid)"/>
    <circle cx="${width * 0.75}" cy="${height * 0.28}" r="220" fill="url(#glow)" opacity="0.55"/>
    <circle cx="${width * 0.25}" cy="${height * 0.72}" r="180" fill="${accentEnd}" opacity="0.18"/>
    <rect x="56" y="${height * 0.2}" width="${width - 112}" height="${height * 0.56}" rx="24" fill="#140e0a" fill-opacity="0.55" stroke="#fdba74" stroke-opacity="0.28" stroke-width="2"/>
    <line x1="96" y1="${height * 0.34}" x2="${width - 96}" y2="${height * 0.34}" stroke="${accentStart}" stroke-width="3" stroke-opacity="0.6"/>
    ${centerEmblem}
    <text x="88" y="${height * 0.64}" fill="#fffaf5" font-family="Space Grotesk, sans-serif" font-size="28" font-weight="700">${title}</text>
    <text x="88" y="${height * 0.69}" fill="#fdba74" font-family="JetBrains Mono, monospace" font-size="17" font-weight="500">${subtitle}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function buildMockMediaResult(
  url: string,
  detected: DetectedUrlInfo
): MediaResult {
  const platform = detected.platform!;
  const mediaType = detected.mediaType;
  const nowIso = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // 1. PROFILE PICTURE / DP FULL-SIZE VIEW (Instagram & TikTok Profiles)
  if (mediaType === 'profile') {
    const cleanHandle = (detected.identifier || '@natgeo').replace(/^@/, '');
    const isTikTok = platform === 'tiktok';
    const dpDataUri = createStudioArtworkDataUri(
      `@${cleanHandle}`,
      '1080 × 1080 • sRGB MASTER DP',
      '#ea580c',
      '#f59e0b',
      'square'
    );

    return {
      id: `dp-${cleanHandle}-${Date.now()}`,
      payloadType: 'profile_dp',
      platform,
      badgeLabel: detected.badgeLabel,
      sourceUrl: url,
      creatorHandle: `@${cleanHandle}`,
      creatorName:
        cleanHandle.toLowerCase() === 'natgeo'
          ? 'National Geographic'
          : `${cleanHandle.charAt(0).toUpperCase()}${cleanHandle.slice(1)} Studio`,
      verified: true,
      extractedAt: nowIso,
      biography: isTikTok
        ? 'Visual engineering, kinetic typography & industrial design systems.'
        : 'Experience the world through the eyes of National Geographic photographers and explorers.',
      followersCount: isTikTok ? '418.2K' : '281.4M',
      standardPreviewUrl: dpDataUri,
      hdOriginalUrl: dpDataUri,
      dimensions: '1080 × 1080',
      fileSize: '1.84 MB',
      format: 'JPG',
    };
  }

  // 2. CAROUSEL / SLIDESHOW VIEW (IG Post/Carousel & TikTok Photo Mode)
  if (mediaType === 'post' || mediaType === 'slideshow') {
    const isTikTok = platform === 'tiktok';
    const slides: CarouselSlideItem[] = [
      {
        id: 'slide-1',
        index: 1,
        mediaType: 'image',
        dimensions: '1080 × 1350',
        fileSize: '2.1 MB',
        thumbnailUrl: createStudioArtworkDataUri('PLATE 01 // KYOTO', '1080×1350 RAW JPG', '#ea580c', '#fb923c'),
        downloadUrl: '#slide-1',
      },
      {
        id: 'slide-2',
        index: 2,
        mediaType: 'image',
        dimensions: '1080 × 1350',
        fileSize: '1.9 MB',
        thumbnailUrl: createStudioArtworkDataUri('PLATE 02 // ZÜRICH', '1080×1350 RAW JPG', '#d97706', '#f59e0b'),
        downloadUrl: '#slide-2',
      },
      {
        id: 'slide-3',
        index: 3,
        mediaType: 'video',
        dimensions: '1080 × 1350',
        fileSize: '8.4 MB',
        thumbnailUrl: createStudioArtworkDataUri('PLATE 03 // MOTION', '1080p60 MP4 STREAM', '#c2410c', '#ea580c'),
        downloadUrl: '#slide-3',
      },
      {
        id: 'slide-4',
        index: 4,
        mediaType: 'image',
        dimensions: '1080 × 1350',
        fileSize: '2.4 MB',
        thumbnailUrl: createStudioArtworkDataUri('PLATE 04 // CONCRETE', '1080×1350 RAW JPG', '#ea580c', '#fbbf24'),
        downloadUrl: '#slide-4',
      },
      {
        id: 'slide-5',
        index: 5,
        mediaType: 'image',
        dimensions: '1080 × 1350',
        fileSize: '1.7 MB',
        thumbnailUrl: createStudioArtworkDataUri('PLATE 05 // STUDIO', '1080×1350 RAW JPG', '#b45309', '#f97316'),
        downloadUrl: '#slide-5',
      },
    ];

    return {
      id: `carousel-${Date.now()}`,
      payloadType: 'carousel',
      platform,
      badgeLabel: isTikTok
        ? 'TikTok Photo Slideshow'
        : 'Instagram Multi-Slide Carousel',
      sourceUrl: url,
      creatorHandle: isTikTok ? '@minimal.archive' : '@zurich.architecture',
      creatorName: isTikTok ? 'Minimal Design Archive' : 'Zürich Brutalist Index',
      verified: true,
      extractedAt: nowIso,
      caption:
        'Monolithic concrete geometry and natural daylight studies across five architectural plates. Uncompressed 1080p archive.',
      totalItems: slides.length,
      archiveSize: '16.5 MB',
      items: slides,
      audioTrack: isTikTok
        ? {
            title: 'Original Sound — @minimal.archive ( Ambient Tape Loop )',
            fileSize: '3.2 MB',
            downloadUrl: '#slideshow-mp3',
          }
        : undefined,
    };
  }

  // 3. VIDEO RESULT VIEW (IG Reels/Stories, TikTok Video, YT Shorts/Video, X, FB, Snap)
  const isHorizontal =
    (platform === 'youtube' && mediaType === 'video') ||
    platform === 'twitter' ||
    (platform === 'facebook' && mediaType === 'video');

  const platformConfigs: Record<
    PlatformId,
    {
      handle: string;
      name: string;
      title: string;
      duration: string;
      thumb: string;
      hdSize: string;
      sdSize: string;
      mp3Size: string;
    }
  > = {
    instagram: {
      handle: '@dieter.industrial',
      name: 'Industrial Design Lab',
      title:
        'Precision CNC anodized aluminum chassis milling — 60fps macro studio reel with raw mechanical acoustics.',
      duration: '00:34',
      thumb: createStudioArtworkDataUri('IG REEL 1080P', '60FPS • H.264 MASTER', '#ea580c', '#f59e0b'),
      hdSize: '14.2 MB',
      sdSize: '6.8 MB',
      mp3Size: '1.4 MB',
    },
    tiktok: {
      handle: '@designsystems',
      name: 'Swiss Grid Systems',
      title:
        'How modular typographic scales and hairline 1px borders eliminate interface clutter in modern developer tools.',
      duration: '00:48',
      thumb: createStudioArtworkDataUri('TIKTOK LOSSLESS', 'NO WATERMARK • 1080P', '#f97316', '#fbbf24'),
      hdSize: '18.6 MB',
      sdSize: '8.9 MB',
      mp3Size: '1.9 MB',
    },
    youtube: {
      handle: '@veritas_engineering',
      name: 'Veritas Engineering',
      title: isHorizontal
        ? 'Inside the Optical Clock: Measuring Picoseconds with Zero Drift (4K Downsampled Master)'
        : 'Why High-Frequency Mechanical Shutters Never Wear Out #shorts',
      duration: isHorizontal ? '04:12' : '00:58',
      thumb: createStudioArtworkDataUri('YOUTUBE 4K HDR', 'AV1 / OPUS 320KBPS', '#ea580c', '#dc2626'),
      hdSize: isHorizontal ? '64.5 MB' : '21.4 MB',
      sdSize: isHorizontal ? '28.1 MB' : '9.6 MB',
      mp3Size: isHorizontal ? '5.8 MB' : '2.1 MB',
    },
    twitter: {
      handle: '@linear_updates',
      name: 'Product Engineering',
      title:
        'Sub-millisecond keyboard navigation and instant local state synchronization demo in production.',
      duration: '00:29',
      thumb: createStudioArtworkDataUri('X BROADCAST', '1080P NATIVE STREAM', '#c2410c', '#f97316'),
      hdSize: '11.4 MB',
      sdSize: '5.2 MB',
      mp3Size: '1.1 MB',
    },
    facebook: {
      handle: '@motorsport.telemetry',
      name: 'Motorsport Telemetry HD',
      title:
        'Onboard Porsche 911 GT3 RS Nürburgring Nordschleife telemetry overlay in full 1080p60.',
      duration: '01:15',
      thumb: createStudioArtworkDataUri('FB REELS HD', '1080P60 TELEMETRY', '#ea580c', '#fb923c'),
      hdSize: '29.8 MB',
      sdSize: '13.4 MB',
      mp3Size: '2.7 MB',
    },
    snapchat: {
      handle: '@alpine.expedition',
      name: 'Zermatt Alpine Club',
      title:
        'First light ridge traverse at 4,000m elevation — raw unedited Spotlight vertical feed.',
      duration: '00:22',
      thumb: createStudioArtworkDataUri('SNAP SPOTLIGHT', '9:16 VERTICAL MASTER', '#d97706', '#facc15'),
      hdSize: '9.8 MB',
      sdSize: '4.5 MB',
      mp3Size: '0.9 MB',
    },
  };

  const cfg = platformConfigs[platform];

  return {
    id: `vid-${platform}-${Date.now()}`,
    payloadType: 'video',
    platform,
    badgeLabel: detected.badgeLabel,
    sourceUrl: url,
    creatorHandle: cfg.handle,
    creatorName: cfg.name,
    verified: true,
    extractedAt: nowIso,
    title: cfg.title,
    duration: cfg.duration,
    aspectRatio: isHorizontal ? '16:9' : '9:16',
    resolution: isHorizontal ? '1920 × 1080' : '1080 × 1920',
    codec: 'H.264 / AAC • 60fps',
    thumbnailUrl: cfg.thumb,
    formats: [
      {
        id: 'hd-1080p',
        label: 'Download HD 1080p (No Watermark)',
        quality: '1080p',
        container: 'MP4',
        fileSize: cfg.hdSize,
        noWatermark: true,
        downloadUrl: '#download-1080p',
        isPrimary: true,
      },
      {
        id: 'sd-720p',
        label: 'Download SD 720p',
        quality: '720p',
        container: 'MP4',
        fileSize: cfg.sdSize,
        noWatermark: true,
        downloadUrl: '#download-720p',
      },
      {
        id: 'audio-mp3',
        label: 'Extract Audio (MP3)',
        quality: 'MP3',
        container: 'MP3',
        fileSize: cfg.mp3Size,
        noWatermark: true,
        downloadUrl: '#download-mp3',
      },
    ],
  };
}
