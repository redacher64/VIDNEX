import React from 'react';
import type { BlogFeaturedIllustration, BlogLocale } from '../data/blogArticles.ts';

interface BlogDiagramIllustrationProps {
  illustration: BlogFeaturedIllustration;
  locale: BlogLocale;
  compact?: boolean;
}

export const BlogDiagramIllustration: React.FC<BlogDiagramIllustrationProps> = ({
  illustration,
  locale,
  compact = false,
}) => {
  const altText =
    illustration.alt[locale] || illustration.alt.en || 'VIDNEX Technical Diagram';
  const captionText =
    illustration.caption[locale] || illustration.caption.en || '';

  const renderDiagramContent = () => {
    switch (illustration.diagramType) {
      case 'tiktok-cdn-diagnostics':
        return (
          <g>
            {/* Node 1: Share Link */}
            <rect
              x="28"
              y="52"
              width="148"
              height="76"
              rx="10"
              className="fill-orange-950/80 stroke-orange-500/70"
              strokeWidth="1.5"
            />
            <text
              x="44"
              y="78"
              className="fill-amber-400 font-mono text-[11px] font-bold"
            >
              01 · SHARE URL
            </text>
            <text
              x="44"
              y="98"
              className="fill-orange-100 font-mono text-[11px]"
            >
              vm.tiktok.com/ZGe…
            </text>
            <text
              x="44"
              y="114"
              className="fill-orange-300/70 font-mono text-[10px]"
            >
              HTTP 301/302 Redirect
            </text>

            {/* Arrow 1 -> 2 */}
            <path
              d="M178 90 L222 90"
              className="stroke-amber-400"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            <polygon points="222,85 232,90 222,95" className="fill-amber-400" />

            {/* Node 2: Visibility Gate */}
            <rect
              x="236"
              y="52"
              width="168"
              height="76"
              rx="10"
              className="fill-orange-950/80 stroke-amber-400/80"
              strokeWidth="1.5"
            />
            <text
              x="252"
              y="78"
              className="fill-amber-400 font-mono text-[11px] font-bold"
            >
              02 · PRIVACY GATE
            </text>
            <text
              x="252"
              y="98"
              className="fill-orange-100 font-mono text-[11px]"
            >
              Public ItemStruct JSON
            </text>
            <text
              x="252"
              y="114"
              className="fill-emerald-400 font-mono text-[10px]"
            >
              ✓ status: public (200)
            </text>

            {/* Arrow 2 -> 3 */}
            <path
              d="M406 90 L450 90"
              className="stroke-amber-400"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            <polygon points="450,85 460,90 450,95" className="fill-amber-400" />

            {/* Node 3: Signed Edge CDN */}
            <rect
              x="464"
              y="52"
              width="176"
              height="76"
              rx="10"
              className="fill-orange-950/90 stroke-orange-400"
              strokeWidth="1.5"
            />
            <text
              x="480"
              y="78"
              className="fill-amber-400 font-mono text-[11px] font-bold"
            >
              03 · SIGNED EDGE CDN
            </text>
            <text
              x="480"
              y="98"
              className="fill-orange-100 font-mono text-[11px]"
            >
              playAddr (MP4) + Audio
            </text>
            <text
              x="480"
              y="114"
              className="fill-orange-300/80 font-mono text-[10px]"
            >
              x-expires TTL: 15–60m
            </text>
          </g>
        );

      case 'instagram-audio-streams':
        return (
          <g>
            {/* Left Box: Split DASH */}
            <rect
              x="32"
              y="40"
              width="270"
              height="100"
              rx="10"
              className="fill-orange-950/70 stroke-orange-700/70"
              strokeWidth="1.5"
            />
            <text
              x="48"
              y="64"
              className="fill-orange-300 font-mono text-[11px] font-bold"
            >
              RAW MPEG-DASH (SPLIT TRACKS)
            </text>
            <rect
              x="48"
              y="76"
              width="238"
              height="22"
              rx="4"
              className="fill-orange-900/60"
            />
            <text
              x="58"
              y="91"
              className="fill-orange-100 font-mono text-[10px]"
            >
              video/mp4 (1080p VP9/H.264 — Video Only)
            </text>
            <rect
              x="48"
              y="104"
              width="238"
              height="22"
              rx="4"
              className="fill-red-950/70 stroke-red-500/40"
              strokeWidth="1"
            />
            <text
              x="58"
              y="119"
              className="fill-red-300 font-mono text-[10px]"
            >
              ✕ Missing audio/mp4 if unmuxed
            </text>

            {/* Right Box: Progressive Muxed MP4 */}
            <rect
              x="348"
              y="40"
              width="292"
              height="100"
              rx="10"
              className="fill-orange-950/90 stroke-amber-400"
              strokeWidth="1.75"
            />
            <text
              x="364"
              y="64"
              className="fill-amber-400 font-mono text-[11px] font-bold"
            >
              VIDNEX PROGRESSIVE MP4 (MUXED)
            </text>
            <rect
              x="364"
              y="76"
              width="260"
              height="22"
              rx="4"
              className="fill-emerald-950/70 stroke-emerald-500/50"
              strokeWidth="1"
            />
            <text
              x="374"
              y="91"
              className="fill-emerald-300 font-mono text-[10px]"
            >
              ✓ Track 1: H.264 (avc1) HD Video
            </text>
            <rect
              x="364"
              y="104"
              width="260"
              height="22"
              rx="4"
              className="fill-emerald-950/70 stroke-emerald-500/50"
              strokeWidth="1"
            />
            <text
              x="374"
              y="119"
              className="fill-emerald-300 font-mono text-[10px]"
            >
              ✓ Track 2: AAC-LC (mp4a) Stereo Audio
            </text>
          </g>
        );

      case 'mp4-vs-mp3-containers':
        return (
          <g>
            {/* MP4 Container */}
            <rect
              x="34"
              y="36"
              width="284"
              height="108"
              rx="10"
              className="fill-orange-950/85 stroke-amber-400"
              strokeWidth="1.5"
            />
            <text
              x="50"
              y="60"
              className="fill-amber-400 font-mono text-[11px] font-bold"
            >
              .MP4 CONTAINER (ISO/IEC 14496-14)
            </text>
            <text
              x="50"
              y="84"
              className="fill-orange-100 font-mono text-[10px]"
            >
              • Video Stream: H.264 / HEVC / AV1
            </text>
            <text
              x="50"
              y="104"
              className="fill-orange-100 font-mono text-[10px]"
            >
              • Audio Stream: AAC (mp4a) Stereo
            </text>
            <text
              x="50"
              y="124"
              className="fill-orange-300/80 font-mono text-[10px]"
            >
              • Typical 60s 1080p size: 8–18 MB
            </text>

            {/* MP3 / M4A Audio */}
            <rect
              x="352"
              y="36"
              width="284"
              height="108"
              rx="10"
              className="fill-orange-950/85 stroke-orange-500/80"
              strokeWidth="1.5"
            />
            <text
              x="368"
              y="60"
              className="fill-orange-300 font-mono text-[11px] font-bold"
            >
              .MP3 / .M4A AUDIO STREAM ONLY
            </text>
            <text
              x="368"
              y="84"
              className="fill-orange-100 font-mono text-[10px]"
            >
              • Audio Only: MPEG-1 Layer III or AAC
            </text>
            <text
              x="368"
              y="104"
              className="fill-orange-100 font-mono text-[10px]"
            >
              • Zero Video Frames (90% smaller)
            </text>
            <text
              x="368"
              y="124"
              className="fill-emerald-300 font-mono text-[10px]"
            >
              • Typical 60s Audio size: 0.9–1.4 MB
            </text>
          </g>
        );

      default:
        return (
          <g>
            <rect
              x="32"
              y="44"
              width="180"
              height="92"
              rx="10"
              className="fill-orange-950/80 stroke-orange-500/70"
              strokeWidth="1.5"
            />
            <text
              x="48"
              y="72"
              className="fill-amber-400 font-mono text-[11px] font-bold"
            >
              PUBLIC SOURCE URL
            </text>
            <text
              x="48"
              y="94"
              className="fill-orange-100 font-mono text-[10px]"
            >
              Canonical ID Normalization
            </text>
            <text
              x="48"
              y="114"
              className="fill-orange-300/70 font-mono text-[10px]"
            >
              Zero Account / Zero Cookies
            </text>

            <path
              d="M216 90 L248 90"
              className="stroke-amber-400"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            <polygon points="248,85 258,90 248,95" className="fill-amber-400" />

            <rect
              x="262"
              y="44"
              width="176"
              height="92"
              rx="10"
              className="fill-orange-950/85 stroke-amber-400/80"
              strokeWidth="1.5"
            />
            <text
              x="278"
              y="72"
              className="fill-amber-400 font-mono text-[11px] font-bold"
            >
              ALLOWLISTED CDN
            </text>
            <text
              x="278"
              y="94"
              className="fill-orange-100 font-mono text-[10px]"
            >
              Bitrate & MIME Verification
            </text>
            <text
              x="278"
              y="114"
              className="fill-emerald-400 font-mono text-[10px]"
            >
              ✓ HTTPS TLS 1.3 Verified
            </text>

            <path
              d="M442 90 L474 90"
              className="stroke-amber-400"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            <polygon points="474,85 484,90 474,95" className="fill-amber-400" />

            <rect
              x="488"
              y="44"
              width="152"
              height="92"
              rx="10"
              className="fill-orange-950/90 stroke-orange-400"
              strokeWidth="1.5"
            />
            <text
              x="504"
              y="72"
              className="fill-amber-400 font-mono text-[11px] font-bold"
            >
              LOCAL DEVICE
            </text>
            <text
              x="504"
              y="94"
              className="fill-orange-100 font-mono text-[10px]"
            >
              Direct MP4 / Audio
            </text>
            <text
              x="504"
              y="114"
              className="fill-orange-300/80 font-mono text-[10px]"
            >
              Original Quality
            </text>
          </g>
        );
    }
  };

  if (compact) {
    return (
      <div className="w-full overflow-hidden rounded-xl bg-[#18110c] border border-orange-900/60">
        <svg
          viewBox="0 0 672 180"
          role="img"
          aria-label={altText}
          className="w-full h-auto block"
        >
          <defs>
            <linearGradient id="vidnexBlogGridBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#140e0a" />
              <stop offset="100%" stopColor="#241710" />
            </linearGradient>
          </defs>
          <rect width="672" height="180" fill="url(#vidnexBlogGridBg)" />
          {renderDiagramContent()}
        </svg>
      </div>
    );
  }

  return (
    <figure className="my-6 rounded-2xl overflow-hidden bg-[#18110c] border border-orange-200/80 dark:border-orange-900/60 shadow-sm">
      <svg
        viewBox="0 0 672 180"
        role="img"
        aria-label={altText}
        className="w-full h-auto block"
      >
        <defs>
          <linearGradient id="vidnexBlogHeroBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#140e0a" />
            <stop offset="100%" stopColor="#261810" />
          </linearGradient>
        </defs>
        <rect width="672" height="180" fill="url(#vidnexBlogHeroBg)" />
        {renderDiagramContent()}
      </svg>
      {captionText && (
        <figcaption className="px-4 py-3 bg-orange-50/70 dark:bg-[#1c140e] border-t border-orange-200/60 dark:border-orange-900/50 font-mono text-xs text-[#6c4e40] dark:text-orange-200/80 leading-relaxed">
          {captionText}
        </figcaption>
      )}
    </figure>
  );
};
