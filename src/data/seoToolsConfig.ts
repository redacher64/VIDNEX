import type { PlatformId } from '../utils/urlDetector.ts';

export type ToolSlug =
  // Instagram Suite (4 Sub-Tools)
  | 'instagram-reels'
  | 'instagram-dp'
  | 'instagram-carousel'
  | 'instagram-stories'
  // TikTok Suite (4 Sub-Tools)
  | 'tiktok-no-watermark'
  | 'tiktok-slideshow'
  | 'tiktok-mp3'
  | 'tiktok-dp'
  // Extended Platforms (4 Sub-Tools)
  | 'youtube-shorts'
  | 'x-video'
  | 'facebook-reels'
  | 'snapchat-spotlight';

export interface ToolHowToStep {
  number: '01' | '02' | '03';
  title: string;
  codeHint: string;
  description: string;
}

export interface ToolFaqItem {
  question: string;
  answer: string;
}

export interface SeoToolConfig {
  slug: ToolSlug;
  path: string;
  platform: PlatformId;
  shortLabel: string;
  h1: string;
  subtitle: string;
  placeholder: string;
  sampleUrl: string;
  metaTitle: string;
  metaDescription: string;
  specs: string[];
  howToSteps: [ToolHowToStep, ToolHowToStep, ToolHowToStep];
  faqs: ToolFaqItem[];
}

export const DEFAULT_TOOL_BY_PLATFORM: Record<PlatformId, ToolSlug> = {
  instagram: 'instagram-reels',
  tiktok: 'tiktok-no-watermark',
  x: 'x-video',
  twitter: 'x-video',
  youtube: 'youtube-shorts',
  facebook: 'facebook-reels',
  snapchat: 'snapchat-spotlight',
};

export const SEO_TOOLS_CONFIG: Record<ToolSlug, SeoToolConfig> = {
  /* ==========================================================================
   * 1. INSTAGRAM SUITE
   * ======================================================================== */
  'instagram-reels': {
    slug: 'instagram-reels',
    path: '/instagram-reels',
    platform: 'instagram',
    shortLabel: 'Reels HD',
    h1: 'Instagram Reels Downloader',
    subtitle:
      'Extract Instagram Reels in original 1080p MP4 at 60fps with unedited AAC studio audio and zero watermarks.',
    placeholder: 'https://www.instagram.com/reel/C8x9kLmN2pQ/',
    sampleUrl: 'https://www.instagram.com/reel/C8x9kLmN2pQ/',
    metaTitle: 'Instagram Reels Downloader — 1080p MP4 No Watermark | VIDNEX',
    metaDescription:
      'Download Instagram Reels in original 1080p HD MP4 without watermarks. Instant direct CDN stream extraction for mobile and desktop.',
    specs: ['REELS 1080P', '60FPS H.264', 'AAC AUDIO', 'NO WATERMARK'],
    howToSteps: [
      {
        number: '01',
        title: 'Copy Instagram Reel Link',
        codeHint: 'instagram.com/reel/{ID}',
        description:
          'Open the Instagram app or web client, tap the Share icon on any public Reel, and select Copy Link.',
      },
      {
        number: '02',
        title: 'Paste into VIDNEX Omnibox',
        codeHint: 'AUTO-REGEX PARSE',
        description:
          'Paste the URL into the input field above. VIDNEX validates the Reel ID in real time without page reloads.',
      },
      {
        number: '03',
        title: 'Save Original 1080p MP4',
        codeHint: 'DIRECT CDN STREAM',
        description:
          'Choose Download HD 1080p (No Watermark) or Extract Audio (MP3) to save the unedited master file.',
      },
    ],
    faqs: [
      {
        question: 'Does VIDNEX re-encode or compress Instagram Reels?',
        answer:
          'No. VIDNEX resolves the direct CDN video stream uploaded by the creator, preserving the exact 1080×1920 resolution, frame rate, and bitrate.',
      },
      {
        question: 'Can I extract only the MP3 audio from an Instagram Reel?',
        answer:
          'Yes. Every Reel extraction includes an instant "Extract Audio (MP3)" option that demuxes the original audio track without quality loss.',
      },
      {
        question: 'Do I need to log in with my Instagram account?',
        answer:
          'Never. VIDNEX operates anonymously on public links and never requests your Instagram credentials or cookies.',
      },
    ],
  },

  'instagram-dp': {
    slug: 'instagram-dp',
    path: '/instagram-dp',
    platform: 'instagram',
    shortLabel: 'Profile DP',
    h1: 'Instagram Profile Picture (DP) Viewer HD',
    subtitle:
      'View and download any Instagram profile picture in uncompressed full-size 1080×1080 JPG with interactive 100% HD zoom.',
    placeholder: 'https://www.instagram.com/natgeo/ or @username',
    sampleUrl: 'https://www.instagram.com/natgeo/',
    metaTitle: 'Instagram DP Viewer — Full-Size HD Profile Picture Downloader | VIDNEX',
    metaDescription:
      'Zoom and download Instagram profile pictures (DP) in full original 1080×1080 HD resolution. Paste any profile URL or @handle.',
    specs: ['1080×1080 PX', '100% HD ZOOM', 'UNCOMPRESSED JPG', 'NO LOGIN'],
    howToSteps: [
      {
        number: '01',
        title: 'Copy Profile URL',
        codeHint: 'instagram.com/{username}',
        description:
          'Copy the link to any Instagram profile page from your browser or mobile app.',
      },
      {
        number: '02',
        title: 'Inspect with 100% HD Zoom',
        codeHint: '1:1 NATIVE CANVAS',
        description:
          'Paste the profile URL into VIDNEX to bypass the tiny 150×150 circular crop and inspect the full-size image.',
      },
      {
        number: '03',
        title: 'Download Original HD JPG',
        codeHint: 'sRGB MASTER JPG',
        description:
          'Click Download Full-Size HD Photo to save the uncompressed square JPG directly to your device.',
      },
    ],
    faqs: [
      {
        question: 'Why are Instagram profile pictures blurry in the official app?',
        answer:
          'Instagram displays a downscaled 150×150 circular thumbnail in the UI, even though a higher-resolution 1080×1080 master image is stored on their CDN. VIDNEX fetches that original master file.',
      },
      {
        question: 'Can I view the HD Profile Picture of a private Instagram account?',
        answer:
          'Yes. Profile pictures (avatars) are publicly accessible metadata on Instagram, so VIDNEX can display full-size DPs for both public and private profiles.',
      },
      {
        question: 'Does the user know I viewed or downloaded their profile picture?',
        answer:
          'No. All profile picture lookups are routed through our zero-log proxy; the account owner receives zero notifications.',
      },
    ],
  },

  'instagram-carousel': {
    slug: 'instagram-carousel',
    path: '/instagram-carousel',
    platform: 'instagram',
    shortLabel: 'Carousel',
    h1: 'Instagram Photo & Carousel Downloader',
    subtitle:
      'Batch-extract up to 20 high-resolution photos and videos from multi-slide Instagram Carousel posts individually or as a single .ZIP archive.',
    placeholder: 'https://www.instagram.com/p/C9aBcDeFgHi/',
    sampleUrl: 'https://www.instagram.com/p/C9aBcDeFgHi/',
    metaTitle: 'Instagram Carousel & Multi-Photo Downloader (.ZIP) | VIDNEX',
    metaDescription:
      'Download all photos and videos from Instagram Carousel posts in original 1080×1350 resolution. Save individual slides or batch download as ZIP.',
    specs: ['MULTI-SLIDE GRID', 'BATCH .ZIP', '1080×1350 RAW', 'MIXED MEDIA'],
    howToSteps: [
      {
        number: '01',
        title: 'Copy Instagram Post URL',
        codeHint: 'instagram.com/p/{SHORTCODE}',
        description:
          'Copy the link to any single photo or multi-slide Instagram Carousel post.',
      },
      {
        number: '02',
        title: 'Select Desired Slides',
        codeHint: 'BATCH CHECKBOXES',
        description:
          'VIDNEX renders every photo and video slide in a clean grid. Select individual plates or click Select All.',
      },
      {
        number: '03',
        title: 'Save Individual Files or .ZIP',
        codeHint: 'LOSSLESS ARCHIVE',
        description:
          'Download single slides in 1 click or package all selected carousel items into a single .ZIP bundle.',
      },
    ],
    faqs: [
      {
        question: 'How many slides can VIDNEX extract from a single Instagram Carousel?',
        answer:
          'VIDNEX supports Instagram’s expanded 20-slide carousel limit, including mixed carousels that combine both 1080p MP4 videos and JPG photos.',
      },
      {
        question: 'Are photos converted from WebP to standard JPG?',
        answer:
          'Yes. While Instagram serves WebP images to browsers, VIDNEX normalizes all photo downloads into universally compatible, maximum-quality sRGB JPG files.',
      },
    ],
  },

  'instagram-stories': {
    slug: 'instagram-stories',
    path: '/instagram-stories',
    platform: 'instagram',
    shortLabel: 'Stories',
    h1: 'Instagram Public Stories Saver',
    subtitle:
      'Anonymously view and save public Instagram Stories and Highlights in original 9:16 vertical HD before they expire.',
    placeholder: 'https://www.instagram.com/stories/natgeo/',
    sampleUrl: 'https://www.instagram.com/stories/natgeo/34019283746/',
    metaTitle: 'Instagram Story Downloader — Anonymous Public Story Saver | VIDNEX',
    metaDescription:
      'Download public Instagram Stories anonymously in 1080p MP4 and JPG. Zero viewer footprint and no account login required.',
    specs: ['ANONYMOUS VIEW', '9:16 VERTICAL', '24H ARCHIVE', 'ZERO FOOTPRINT'],
    howToSteps: [
      {
        number: '01',
        title: 'Copy Public Story Link',
        codeHint: 'instagram.com/stories/{user}',
        description:
          'Copy the direct Instagram Story URL or enter the public creator’s story link.',
      },
      {
        number: '02',
        title: 'Resolve Story Stream',
        codeHint: 'ZERO-VIEW PROXY',
        description:
          'Paste the link into VIDNEX. Our proxy fetches the active story segments without registering your view.',
      },
      {
        number: '03',
        title: 'Download 1080p Story MP4',
        codeHint: 'ORIGINAL 9:16',
        description:
          'Save the vertical video or photo story directly to your device in original quality.',
      },
    ],
    faqs: [
      {
        question: 'Will my username appear in the creator’s Story viewers list?',
        answer:
          'No. Because you never log in to VIDNEX and our server fetches the public stream anonymously, your personal account never appears in the viewer list.',
      },
      {
        question: 'Can VIDNEX download Stories from private Instagram accounts?',
        answer:
          'No. In strict compliance with privacy laws and platform terms, VIDNEX only processes publicly accessible media.',
      },
    ],
  },

  /* ==========================================================================
   * 2. TIKTOK SUITE
   * ======================================================================== */
  'tiktok-no-watermark': {
    slug: 'tiktok-no-watermark',
    path: '/tiktok-no-watermark',
    platform: 'tiktok',
    shortLabel: 'Video No-WM',
    h1: 'TikTok Downloader (HD No Watermark)',
    subtitle:
      'Save TikTok videos in clean source 1080p MP4 without the bouncing username watermark or end-screen bumper.',
    placeholder: 'https://www.tiktok.com/@designsystems/video/7384920192837465',
    sampleUrl: 'https://www.tiktok.com/@designsystems/video/7384920192837465',
    metaTitle: 'TikTok Downloader Without Watermark — 1080p HD MP4 | VIDNEX',
    metaDescription:
      'Download TikTok videos without watermark in original 1080p HD MP4. Fast, ad-free TikTok video saver for iPhone, Android, Mac, and PC.',
    specs: ['NO WATERMARK', '1080P SOURCE', 'NO END-BUMPER', 'INSTANT MP4'],
    howToSteps: [
      {
        number: '01',
        title: 'Copy TikTok Video Link',
        codeHint: 'tiktok.com/@user/video/{ID}',
        description:
          'In the TikTok app or website, tap Share on any public video and press Copy Link (both vm.tiktok.com and full URLs work).',
      },
      {
        number: '02',
        title: 'Paste in VIDNEX',
        codeHint: 'WATERMARK BYPASS',
        description:
          'Paste the link into the VIDNEX Omnibox. Our parser locates the clean unwatermarked source stream.',
      },
      {
        number: '03',
        title: 'Download Clean 1080p MP4',
        codeHint: 'ORIGINAL BITRATE',
        description:
          'Click Download HD 1080p (No Watermark) to save the pristine video file without any overlays.',
      },
    ],
    faqs: [
      {
        question: 'How does VIDNEX remove the TikTok watermark without blurring the video?',
        answer:
          'VIDNEX does not crop or blur the video. Instead, it retrieves the original unwatermarked master stream directly from TikTok’s media CDN before the overlay is applied.',
      },
      {
        question: 'Do shortened vm.tiktok.com and vt.tiktok.com links work?',
        answer:
          'Yes. Our URL detector and backend automatically resolve shortened mobile share links as well as standard desktop URLs.',
      },
      {
        question: 'How do I save TikTok videos to my iPhone Camera Roll on iOS?',
        answer:
          'In Safari on iOS, tap Download HD 1080p, tap the blue download arrow in the address bar, open the downloaded MP4, and tap "Save Video" to send it to your Photos app.',
      },
    ],
  },

  'tiktok-slideshow': {
    slug: 'tiktok-slideshow',
    path: '/tiktok-slideshow',
    platform: 'tiktok',
    shortLabel: 'Slideshow',
    h1: 'TikTok Photo Slideshow Downloader',
    subtitle:
      'Extract every individual high-resolution image from TikTok Photo Mode carousels without watermarks, plus the background audio track.',
    placeholder: 'https://www.tiktok.com/@minimal.archive/photo/7391029384756',
    sampleUrl: 'https://www.tiktok.com/@minimal.archive/photo/7391029384756',
    metaTitle: 'TikTok Slideshow & Photo Mode Downloader (No Watermark) | VIDNEX',
    metaDescription:
      'Download TikTok Photo Mode slideshows as individual watermark-free HD JPG images or a batch .ZIP archive.',
    specs: ['PHOTO MODE HD', 'WATERMARK-FREE JPG', 'BATCH .ZIP', 'AUDIO TRACK'],
    howToSteps: [
      {
        number: '01',
        title: 'Copy TikTok Photo Link',
        codeHint: 'tiktok.com/@user/photo/{ID}',
        description:
          'Copy the share link of any multi-photo TikTok carousel post.',
      },
      {
        number: '02',
        title: 'Preview Unwatermarked Plates',
        codeHint: 'CAROUSEL MATRIX',
        description:
          'Paste the URL into VIDNEX to view all slideshow photos in an interactive selection grid.',
      },
      {
        number: '03',
        title: 'Download Individual JPGs or .ZIP',
        codeHint: 'BATCH ARCHIVE',
        description:
          'Save individual watermark-free JPG slides or download the entire slideshow as a .ZIP archive.',
      },
    ],
    faqs: [
      {
        question: 'Are downloaded TikTok slideshow images free of the TikTok logo?',
        answer:
          'Yes. Every photo extracted from TikTok Photo Mode is saved in its original 1080p JPG format with zero watermark stamps.',
      },
      {
        question: 'Can I also download the music playing in the TikTok slideshow?',
        answer:
          'Yes. VIDNEX detects the accompanying background audio stream so you can save the photos and the MP3 soundtrack separately.',
      },
    ],
  },

  'tiktok-mp3': {
    slug: 'tiktok-mp3',
    path: '/tiktok-mp3',
    platform: 'tiktok',
    shortLabel: 'Audio MP3',
    h1: 'TikTok to MP3 Audio Extractor',
    subtitle:
      'Extract original high-bitrate MP3 audio, trending sounds, and voiceovers directly from any TikTok link in one click.',
    placeholder: 'https://www.tiktok.com/@designsystems/video/7384920192837465',
    sampleUrl: 'https://www.tiktok.com/@designsystems/video/7384920192837465',
    metaTitle: 'TikTok to MP3 Converter — Extract Original TikTok Audio | VIDNEX',
    metaDescription:
      'Convert TikTok videos to high-bitrate MP3 audio files instantly. Save original TikTok sounds, music, and voiceovers for offline editing.',
    specs: ['MP3 320KBPS', 'ORIGINAL SOUND', 'ID3 METADATA', 'INSTANT DEMUX'],
    howToSteps: [
      {
        number: '01',
        title: 'Copy TikTok Video URL',
        codeHint: 'SOURCE VIDEO LINK',
        description:
          'Copy the link to the TikTok video containing the audio or sound you want to extract.',
      },
      {
        number: '02',
        title: 'Demux Audio Stream',
        codeHint: 'AAC -> MP3',
        description:
          'Paste the URL into VIDNEX to isolate the audio stream from the video container.',
      },
      {
        number: '03',
        title: 'Save Clean MP3 File',
        codeHint: 'DIRECT AUDIO SAVE',
        description:
          'Click Extract Audio (MP3) in the result drawer to download the sound file immediately.',
      },
    ],
    faqs: [
      {
        question: 'What audio quality does the TikTok MP3 extractor provide?',
        answer:
          'VIDNEX extracts the highest-bitrate audio stream available on TikTok’s CDN and packages it into a universally compatible MP3 file.',
      },
    ],
  },

  'tiktok-dp': {
    slug: 'tiktok-dp',
    path: '/tiktok-dp',
    platform: 'tiktok',
    shortLabel: 'Profile HD',
    h1: 'TikTok Profile Picture (DP) Downloader HD',
    subtitle:
      'Inspect and save any TikTok creator’s profile picture in full 1080×1080 resolution without circular cropping.',
    placeholder: 'https://www.tiktok.com/@designsystems',
    sampleUrl: 'https://www.tiktok.com/@designsystems',
    metaTitle: 'TikTok Profile Picture Downloader — Full-Size HD Avatar | VIDNEX',
    metaDescription:
      'View and download TikTok profile pictures in full 1080×1080 HD JPG. Zoom in 100% on any TikTok @username avatar.',
    specs: ['1080×1080 AVATAR', '100% HD ZOOM', 'SQUARE JPG', 'ZERO CROP'],
    howToSteps: [
      {
        number: '01',
        title: 'Copy TikTok Profile Link',
        codeHint: 'tiktok.com/@{handle}',
        description:
          'Copy the URL of any TikTok creator profile (e.g., https://www.tiktok.com/@username).',
      },
      {
        number: '02',
        title: 'Toggle 100% HD Zoom',
        codeHint: 'FULL RESOLUTION',
        description:
          'Paste the profile URL into VIDNEX to inspect the square HD avatar in our 1:1 viewer.',
      },
      {
        number: '03',
        title: 'Save Original JPG',
        codeHint: '1080P AVATAR',
        description:
          'Click Download Full-Size HD Photo to save the creator’s uncompressed profile image.',
      },
    ],
    faqs: [
      {
        question: 'Can I download a TikTok avatar using only the @handle URL?',
        answer:
          'Yes. Simply paste https://www.tiktok.com/@username into the Omnibox and VIDNEX will automatically switch to the Profile DP viewer.',
      },
    ],
  },

  /* ==========================================================================
   * 3. EXTENDED PLATFORMS (YouTube, X, Facebook, Snapchat)
   * ======================================================================== */
  'youtube-shorts': {
    slug: 'youtube-shorts',
    path: '/youtube-shorts',
    platform: 'youtube',
    shortLabel: 'YT Shorts / HD',
    h1: 'YouTube Shorts & Video Downloader',
    subtitle:
      'High-speed extraction for YouTube Shorts and public videos in 1080p60 MP4, 720p HD, or isolated MP3 audio.',
    placeholder: 'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    sampleUrl: 'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    metaTitle: 'YouTube Shorts Downloader — 1080p 60fps MP4 & MP3 | VIDNEX',
    metaDescription:
      'Download YouTube Shorts and public videos in 1080p HD MP4 or convert to MP3 audio with zero popups or watermarks.',
    specs: ['SHORTS 1080P60', '16:9 & 9:16 MP4', 'MP3 AUDIO', 'ZERO POPUPS'],
    howToSteps: [
      {
        number: '01',
        title: 'Copy YouTube Short or Video URL',
        codeHint: 'youtube.com/shorts/{ID}',
        description:
          'Copy the link from the YouTube address bar or tap Share -> Copy Link on mobile.',
      },
      {
        number: '02',
        title: 'Paste in VIDNEX Omnibox',
        codeHint: 'STREAM MANIFEST',
        description:
          'Paste the link above. VIDNEX parses both vertical Shorts and standard 16:9 YouTube videos.',
      },
      {
        number: '03',
        title: 'Select 1080p MP4 or MP3',
        codeHint: 'MUXED STREAM',
        description:
          'Download the muxed 1080p video with audio or extract the standalone MP3 track.',
      },
    ],
    faqs: [
      {
        question: 'Does VIDNEX include audio in 1080p YouTube Shorts downloads?',
        answer:
          'Yes. Unlike basic grabbers that separate video and audio above 720p, VIDNEX delivers a fully muxed 1080p MP4 with synchronized AAC audio.',
      },
    ],
  },

  'x-video': {
    slug: 'x-video',
    path: '/x-video',
    platform: 'x',
    shortLabel: 'X Video / GIF',
    h1: 'X (Twitter) Video & GIF Downloader',
    subtitle:
      'Save public videos and animated GIFs from X (formerly Twitter) posts directly as high-definition MP4 files.',
    placeholder: 'https://x.com/linear_updates/status/1802938475610293',
    sampleUrl: 'https://x.com/linear_updates/status/1802938475610293',
    metaTitle: 'X (Twitter) Video Downloader — Save Tweet Videos & GIFs as MP4 | VIDNEX',
    metaDescription:
      'Download videos and GIFs from X (Twitter) posts in 1080p HD MP4. Supports both x.com and twitter.com status links.',
    specs: ['X.COM & TWITTER', '1080P TWEET MP4', 'GIF TO MP4', 'MULTI-BITRATE'],
    howToSteps: [
      {
        number: '01',
        title: 'Copy X Post Link',
        codeHint: 'x.com/{user}/status/{ID}',
        description:
          'Click the Share icon on any public X post containing a video or GIF and copy the link.',
      },
      {
        number: '02',
        title: 'Resolve Highest Bitrate Variant',
        codeHint: 'HLS TO MP4',
        description:
          'Paste the status URL into VIDNEX to extract the highest-resolution MP4 variant from the post.',
      },
      {
        number: '03',
        title: 'Save MP4 to Device',
        codeHint: 'UNIVERSAL MP4',
        description:
          'Download the 1080p or 720p MP4 file directly for offline viewing or sharing.',
      },
    ],
    faqs: [
      {
        question: 'Do both x.com and legacy twitter.com links work?',
        answer:
          'Yes. VIDNEX natively recognizes both x.com and twitter.com status URLs without requiring manual editing.',
      },
    ],
  },

  'facebook-reels': {
    slug: 'facebook-reels',
    path: '/facebook-reels',
    platform: 'facebook',
    shortLabel: 'FB Reels / Watch',
    h1: 'Facebook Reels & Watch Video Downloader',
    subtitle:
      'Download public Facebook Reels and Watch videos in full 1080p HD or 720p MP4 without logging into Facebook.',
    placeholder: 'https://www.facebook.com/reel/129384756012',
    sampleUrl: 'https://www.facebook.com/reel/129384756012',
    metaTitle: 'Facebook Reels & Video Downloader — 1080p HD MP4 | VIDNEX',
    metaDescription:
      'Save public Facebook Reels and Watch videos in 1080p HD MP4 and MP3 audio. Supports facebook.com/reel and fb.watch URLs.',
    specs: ['FB REELS 1080P', 'FB.WATCH SUPPORT', 'CLEAN MP4', 'NO LOGIN'],
    howToSteps: [
      {
        number: '01',
        title: 'Copy Facebook Reel or Watch Link',
        codeHint: 'facebook.com/reel/{ID}',
        description:
          'Tap Share -> Copy Link on any public Facebook Reel or Watch broadcast.',
      },
      {
        number: '02',
        title: 'Paste into VIDNEX',
        codeHint: 'HD STREAM RESOLVE',
        description:
          'Paste the link into the Omnibox to locate the 1080p HD video and audio tracks.',
      },
      {
        number: '03',
        title: 'Download 1080p MP4',
        codeHint: 'DIRECT SAVE',
        description:
          'Click Download HD 1080p to save the video directly to your phone or computer.',
      },
    ],
    faqs: [
      {
        question: 'Does VIDNEX support shortened fb.watch links?',
        answer:
          'Yes. Both full facebook.com/reel/ URLs and shortened fb.watch/ share links are detected automatically.',
      },
    ],
  },

  'snapchat-spotlight': {
    slug: 'snapchat-spotlight',
    path: '/snapchat-spotlight',
    platform: 'snapchat',
    shortLabel: 'Spotlight HD',
    h1: 'Snapchat Spotlight & Public Story Downloader',
    subtitle:
      'Save public Snapchat Spotlight vertical videos and public creator stories in clean 9:16 HD MP4.',
    placeholder: 'https://www.snapchat.com/spotlight/W7_EDlXWTBiXAEEniNoMPwAAY',
    sampleUrl: 'https://www.snapchat.com/spotlight/W7_EDlXWTBiXAEEniNoMPwAAY',
    metaTitle: 'Snapchat Spotlight & Story Downloader — HD MP4 | VIDNEX',
    metaDescription:
      'Download public Snapchat Spotlight videos and creator stories in original 9:16 HD MP4 without watermarks.',
    specs: ['SPOTLIGHT 9:16', 'PUBLIC STORIES', 'CLEAN MP4', 'FAST EXTRACT'],
    howToSteps: [
      {
        number: '01',
        title: 'Copy Snapchat Spotlight Link',
        codeHint: 'snapchat.com/spotlight/{ID}',
        description:
          'Tap the Share button on any public Snapchat Spotlight video and copy the URL.',
      },
      {
        number: '02',
        title: 'Paste in VIDNEX Omnibox',
        codeHint: 'SPOTLIGHT PARSER',
        description:
          'Paste the Snapchat link into the input bar above for instant stream resolution.',
      },
      {
        number: '03',
        title: 'Download Vertical MP4',
        codeHint: '9:16 ORIGINAL',
        description:
          'Save the clean vertical MP4 file directly to your device.',
      },
    ],
    faqs: [
      {
        question: 'Can I download private Snaps sent directly to me?',
        answer:
          'No. VIDNEX only supports public Snapchat Spotlight videos and public creator stories that have a shareable web URL.',
      },
    ],
  },
};

export const ALL_TOOL_CONFIGS: SeoToolConfig[] = Object.values(SEO_TOOLS_CONFIG);

export function getToolsByPlatform(platform: PlatformId): SeoToolConfig[] {
  const normalized = platform === 'twitter' ? 'x' : platform;
  return ALL_TOOL_CONFIGS.filter((tool) => tool.platform === normalized);
}
