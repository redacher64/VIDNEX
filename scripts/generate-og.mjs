#!/usr/bin/env node
/**
 * Generates:
 * 1. Five 1200x630 OpenGraph JPEG preview images in `public/og/` with content hashes:
 *    - og-default.<hash>.jpg (Home & Legal pages)
 *    - og-tiktok.<hash>.jpg
 *    - og-instagram.<hash>.jpg
 *    - og-x.<hash>.jpg
 *    - og-facebook.<hash>.jpg
 *    All text/wordmarks ("VIDNEX", "MP4", "HD") are pure SVG vector paths (zero system font dependency).
 *    All focal elements stay strictly inside the central 80% safe zone (10%+ margin on all sides).
 * 2. Favicons & App Icons in `public/`:
 *    - favicon.svg
 *    - favicon-48x48.png (48x48 for Google Search)
 *    - favicon.ico (multi-size 32x32 + 48x48 ICO container)
 *    - apple-touch-icon.png (180x180)
 *    - icon-192.png (192x192)
 *    - icon-512.png (512x512)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const OG_DIR = path.join(PUBLIC_DIR, 'og');

/**
 * Pure vector paths for the "VIDNEX" geometric wordmark (no <text> or system fonts).
 * Drawn in a 310x36 local coordinate system.
 */
function renderVidnexVectorWordmark(color = '#fffaf5') {
  return `
    <g fill="none" stroke="${color}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round">
      <!-- V -->
      <path d="M4 4 L22 32 L40 4" />
      <!-- I -->
      <path d="M62 4 L62 32" />
      <!-- D -->
      <path d="M86 4 L86 32 L106 32 C118 32 124 25 124 18 C124 11 118 4 106 4 Z" />
      <!-- N -->
      <path d="M146 32 L146 4 L178 32 L178 4" />
      <!-- E -->
      <path d="M232 4 L202 4 L202 32 L232 32 M202 18 L224 18" />
      <!-- X -->
      <path d="M254 4 L286 32 M286 4 L254 32" />
    </g>
  `;
}

/**
 * Renders the central generic pictogram (160x160 coordinate box) per variant.
 * Strictly avoids any official third-party platform logos.
 */
function renderVariantPictogram(variant, primaryColor, secondaryColor) {
  switch (variant) {
    case 'tiktok':
      // Generic vertical video frame + audio waveform + download arrow
      return `
        <g transform="translate(0, 0)">
          <rect x="28" y="10" width="104" height="140" rx="22" fill="#0f172a" stroke="${primaryColor}" stroke-width="4" />
          <!-- Audio equalizer bars -->
          <line x1="52" y1="54" x2="52" y2="86" stroke="${primaryColor}" stroke-width="6" stroke-linecap="round" />
          <line x1="68" y1="40" x2="68" y2="100" stroke="#ffffff" stroke-width="6" stroke-linecap="round" />
          <line x1="84" y1="48" x2="84" y2="92" stroke="${secondaryColor}" stroke-width="6" stroke-linecap="round" />
          <line x1="100" y1="60" x2="100" y2="80" stroke="${primaryColor}" stroke-width="6" stroke-linecap="round" />
          <!-- Download badge bottom right -->
          <circle cx="118" cy="122" r="26" fill="${secondaryColor}" />
          <path d="M118 108 L118 130 M108 122 L118 132 L128 122" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        </g>
      `;
    case 'instagram':
      // Generic multi-slide carousel stack + play triangle + download arrow
      return `
        <g transform="translate(0, 0)">
          <rect x="42" y="14" width="96" height="116" rx="20" fill="#23121b" stroke="${secondaryColor}" stroke-width="3" opacity="0.7" />
          <rect x="22" y="26" width="96" height="116" rx="20" fill="#1a0f16" stroke="${primaryColor}" stroke-width="4" />
          <!-- Play triangle inside frame -->
          <polygon points="60,64 60,100 90,82" fill="#ffffff" />
          <!-- Download badge -->
          <circle cx="118" cy="122" r="26" fill="${primaryColor}" />
          <path d="M118 108 L118 130 M108 122 L118 132 L128 122" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        </g>
      `;
    case 'x':
      // Generic widescreen HD stream frame + bitrate bars + download arrow
      return `
        <g transform="translate(0, 0)">
          <rect x="14" y="24" width="132" height="96" rx="18" fill="#0f141c" stroke="${primaryColor}" stroke-width="4" />
          <polygon points="68,54 68,90 100,72" fill="${secondaryColor}" />
          <!-- Resolution step indicators -->
          <rect x="30" y="102" width="24" height="5" rx="2.5" fill="${secondaryColor}" />
          <rect x="60" y="102" width="40" height="5" rx="2.5" fill="${primaryColor}" />
          <!-- Download badge -->
          <circle cx="122" cy="122" r="26" fill="${secondaryColor}" />
          <path d="M122 108 L122 130 M112 122 L122 132 L132 122" stroke="#0f141c" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        </g>
      `;
    case 'facebook':
      // Generic cinema clapper / watch monitor + download arrow
      return `
        <g transform="translate(0, 0)">
          <rect x="16" y="22" width="128" height="98" rx="18" fill="#0d1829" stroke="${secondaryColor}" stroke-width="4" />
          <circle cx="80" cy="71" r="24" fill="${primaryColor}" />
          <polygon points="74,58 74,84 96,71" fill="#ffffff" />
          <!-- Download badge -->
          <circle cx="122" cy="122" r="26" fill="${secondaryColor}" />
          <path d="M122 108 L122 130 M112 122 L122 132 L132 122" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        </g>
      `;
    default:
      // Default universal media downloader (downward arrow + video play + waveform)
      return `
        <g transform="translate(0, 0)">
          <rect x="18" y="18" width="124" height="124" rx="28" fill="#21150e" stroke="${primaryColor}" stroke-width="4" />
          <path d="M80 42 L80 96 M56 76 L80 100 L104 76" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          <line x1="52" y1="116" x2="108" y2="116" stroke="${secondaryColor}" stroke-width="7" stroke-linecap="round" />
        </g>
      `;
  }
}

/**
 * Builds a 1200x630 SVG for the given variant.
 * Safe zone: [140..1060] x [75..555] (>10% margin on all 4 edges).
 */
function buildOgSvg({
  variant,
  bgStart,
  bgEnd,
  primaryColor,
  secondaryColor,
  accentGlow,
}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgStart}" />
      <stop offset="100%" stop-color="${bgEnd}" />
    </linearGradient>
    <linearGradient id="accent-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primaryColor}" />
      <stop offset="100%" stop-color="${secondaryColor}" />
    </linearGradient>
    <radialGradient id="glow-left" cx="25%" cy="30%" r="55%">
      <stop offset="0%" stop-color="${accentGlow}" stop-opacity="0.32" />
      <stop offset="100%" stop-color="${bgStart}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glow-right" cx="80%" cy="75%" r="50%">
      <stop offset="0%" stop-color="${secondaryColor}" stop-opacity="0.24" />
      <stop offset="100%" stop-color="${bgEnd}" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Full 1200x630 canvas background -->
  <rect width="1200" height="630" fill="url(#bg-grad)" />
  <rect width="1200" height="630" fill="url(#glow-left)" />
  <rect width="1200" height="630" fill="url(#glow-right)" />

  <!-- Subtle architectural grid lines -->
  <g stroke="#ffffff" stroke-opacity="0.04" stroke-width="1">
    <line x1="0" y1="126" x2="1200" y2="126" />
    <line x1="0" y1="315" x2="1200" y2="315" />
    <line x1="0" y1="504" x2="1200" y2="504" />
    <line x1="240" y1="0" x2="240" y2="630" />
    <line x1="600" y1="0" x2="600" y2="630" />
    <line x1="960" y1="0" x2="960" y2="630" />
  </g>

  <!-- Top & bottom accent bars -->
  <rect x="0" y="0" width="1200" height="10" fill="url(#accent-grad)" />
  <rect x="0" y="620" width="1200" height="10" fill="url(#accent-grad)" />

  <!-- SAFE ZONE CARD (x=140..1060, y=85..545 -> 11.6% horizontal margin, 13.5% vertical margin) -->
  <rect x="140" y="85" width="920" height="460" rx="36" fill="#18110c" fill-opacity="0.88" stroke="${primaryColor}" stroke-opacity="0.45" stroke-width="2.5" />

  <!-- Left Side: VIDNEX Emblem + Vector Wordmark + Generic Transport Bar -->
  <g transform="translate(205, 155)">
    <!-- VIDNEX Official Logo Mark (84x84) -->
    <g transform="translate(0, 0)">
      <rect width="84" height="84" rx="22" fill="url(#accent-grad)" />
      <rect x="13" y="13" width="58" height="58" rx="9" stroke="#ffffff" stroke-width="5" fill="none" />
      <path d="M26 29 L42 52 L58 29" stroke="#ffffff" stroke-width="6" stroke-linecap="square" stroke-linejoin="miter" fill="none" />
      <line x1="26" y1="60" x2="58" y2="60" stroke="#ffffff" stroke-width="5" />
    </g>

    <!-- VIDNEX Vector Wordmark -->
    <g transform="translate(108, 24)">
      ${renderVidnexVectorWordmark('#fffaf5')}
    </g>

    <!-- Accent divider bar -->
    <rect x="0" y="118" width="440" height="6" rx="3" fill="url(#accent-grad)" />

    <!-- Mock URL Omnibox Bar (Visual cue for video downloader tool) -->
    <rect x="0" y="152" width="490" height="74" rx="18" fill="#0f0a07" stroke="${primaryColor}" stroke-opacity="0.55" stroke-width="2.5" />
    <circle cx="38" cy="189" r="12" fill="${primaryColor}" />
    <rect x="66" y="182" width="270" height="14" rx="7" fill="#ffffff" fill-opacity="0.22" />
    <rect x="364" y="167" width="108" height="44" rx="12" fill="url(#accent-grad)" />
    <path d="M418 179 L418 197 M410 190 L418 198 L426 190" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />

    <!-- Bottom Quality Indicator Pills (Pure geometry: 3 stream bars + HD indicator) -->
    <g transform="translate(0, 256)">
      <rect x="0" y="0" width="136" height="44" rx="12" fill="${primaryColor}" fill-opacity="0.18" stroke="${primaryColor}" stroke-width="2" />
      <!-- Vector "MP4" glyph -->
      <path d="M24 30 L24 14 L34 24 L44 14 L44 30 M56 30 L56 14 L68 14 C73 14 73 22 68 22 L56 22 M84 26 L98 26 M94 14 L82 26 M94 14 L94 30" stroke="#fffaf5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none" />

      <rect x="154" y="0" width="116" height="44" rx="12" fill="${secondaryColor}" fill-opacity="0.18" stroke="${secondaryColor}" stroke-width="2" />
      <!-- Vector "HD" glyph -->
      <path d="M186 14 L186 30 M202 14 L202 30 M186 22 L202 22 M216 14 L216 30 L228 30 C236 30 236 14 228 14 Z" stroke="#fffaf5" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none" />

      <!-- Audio waveform pill -->
      <rect x="288" y="0" width="136" height="44" rx="12" fill="#ffffff" fill-opacity="0.06" stroke="#ffffff" stroke-opacity="0.2" stroke-width="2" />
      <line x1="316" y1="16" x2="316" y2="28" stroke="${primaryColor}" stroke-width="4" stroke-linecap="round" />
      <line x1="332" y1="11" x2="332" y2="33" stroke="#fffaf5" stroke-width="4" stroke-linecap="round" />
      <line x1="348" y1="15" x2="348" y2="29" stroke="${secondaryColor}" stroke-width="4" stroke-linecap="round" />
      <line x1="364" y1="12" x2="364" y2="32" stroke="${primaryColor}" stroke-width="4" stroke-linecap="round" />
      <line x1="380" y1="17" x2="380" y2="27" stroke="#fffaf5" stroke-width="4" stroke-linecap="round" />
      <line x1="396" y1="14" x2="396" y2="30" stroke="${secondaryColor}" stroke-width="4" stroke-linecap="round" />
    </g>
  </g>

  <!-- Right Side: Large Centered Generic Pictogram inside Studio Pod -->
  <g transform="translate(765, 195)">
    <rect x="-25" y="-25" width="210" height="210" rx="44" fill="#0f0a07" stroke="url(#accent-grad)" stroke-width="3" />
    ${renderVariantPictogram(variant, primaryColor, secondaryColor)}
  </g>
</svg>`;
}

/**
 * Builds the square VIDNEX icon SVG for favicons and PWA icons.
 */
function buildSquareIconSvg(size = 512) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">
  <defs>
    <linearGradient id="vidnex-glow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ea580c"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="7" fill="url(#vidnex-glow)"/>
  <rect x="5" y="5" width="22" height="22" rx="3.5" stroke="#ffffff" stroke-width="2" fill="none"/>
  <path d="M10 11L16 20L22 11" stroke="#ffffff" stroke-width="2.4" stroke-linecap="square" stroke-linejoin="miter" fill="none"/>
  <line x1="10" y1="23" x2="22" y2="23" stroke="#ffffff" stroke-width="2.1"/>
</svg>`;
}

/**
 * Wraps one or more PNG buffers into a standard Windows .ICO binary container.
 */
function buildIcoFromPngBuffers(entries) {
  const count = entries.length;
  const headerSize = 6 + count * 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(count, 4);

  let offset = headerSize;
  for (let i = 0; i < count; i++) {
    const { size, png } = entries[i];
    const dirOffset = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, dirOffset);
    header.writeUInt8(size >= 256 ? 0 : size, dirOffset + 1);
    header.writeUInt8(0, dirOffset + 2); // Palette
    header.writeUInt8(0, dirOffset + 3); // Reserved
    header.writeUInt16LE(1, dirOffset + 4); // Color planes
    header.writeUInt16LE(32, dirOffset + 6); // Bits per pixel
    header.writeUInt32LE(png.length, dirOffset + 8);
    header.writeUInt32LE(offset, dirOffset + 12);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries.map((e) => e.png)]);
}

async function main() {
  fs.mkdirSync(OG_DIR, { recursive: true });

  // Clean old hashed OG files in public/og/
  for (const existing of fs.readdirSync(OG_DIR)) {
    if (/^og-(default|tiktok|instagram|x|facebook)\.[a-f0-9]+\.(jpg|png)$/i.test(existing)) {
      fs.unlinkSync(path.join(OG_DIR, existing));
    }
  }

  const variants = [
    {
      key: 'default',
      bgStart: '#140e0a',
      bgEnd: '#26170e',
      primaryColor: '#ea580c',
      secondaryColor: '#f59e0b',
      accentGlow: '#ea580c',
    },
    {
      key: 'tiktok',
      bgStart: '#0b131e',
      bgEnd: '#1f1019',
      primaryColor: '#06b6d4',
      secondaryColor: '#f43f5e',
      accentGlow: '#06b6d4',
    },
    {
      key: 'instagram',
      bgStart: '#1c0e18',
      bgEnd: '#27140d',
      primaryColor: '#ec4899',
      secondaryColor: '#f97316',
      accentGlow: '#ec4899',
    },
    {
      key: 'x',
      bgStart: '#0b0f17',
      bgEnd: '#162032',
      primaryColor: '#38bdf8',
      secondaryColor: '#e2e8f0',
      accentGlow: '#38bdf8',
    },
    {
      key: 'facebook',
      bgStart: '#0a1224',
      bgEnd: '#112240',
      primaryColor: '#3b82f6',
      secondaryColor: '#60a5fa',
      accentGlow: '#2563eb',
    },
  ];

  const manifest = {};

  for (const v of variants) {
    const svg = buildOgSvg({
      variant: v.key,
      bgStart: v.bgStart,
      bgEnd: v.bgEnd,
      primaryColor: v.primaryColor,
      secondaryColor: v.secondaryColor,
      accentGlow: v.accentGlow,
    });

    const jpgBuffer = await sharp(Buffer.from(svg))
      .resize(1200, 630, { fit: 'cover' })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();

    const hash = crypto
      .createHash('sha256')
      .update(jpgBuffer)
      .digest('hex')
      .slice(0, 8);
    const filename = `og-${v.key}.${hash}.jpg`;
    const outPath = path.join(OG_DIR, filename);
    fs.writeFileSync(outPath, jpgBuffer);

    manifest[v.key] = `/og/${filename}`;
    console.log(
      `✓ Generated public/og/${filename} (1200x630, ${(
        jpgBuffer.length / 1024
      ).toFixed(1)} KB)`
    );
  }

  // Also keep public/og-default.png updated for any legacy direct link
  const defaultJpgPath = path.join(PUBLIC_DIR, manifest.default.replace(/^\//, ''));
  const defaultPngBuf = await sharp(defaultJpgPath).png({ compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(path.join(PUBLIC_DIR, 'og-default.png'), defaultPngBuf);

  // Generate Favicons & App Icons (ÉTAPE 3)
  const iconSvg512 = buildSquareIconSvg(512);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.svg'), buildSquareIconSvg(32), 'utf8');

  const png32 = await sharp(Buffer.from(iconSvg512))
    .resize(32, 32)
    .png({ compressionLevel: 9 })
    .toBuffer();
  const png48 = await sharp(Buffer.from(iconSvg512))
    .resize(48, 48)
    .png({ compressionLevel: 9 })
    .toBuffer();
  const png180 = await sharp(Buffer.from(iconSvg512))
    .resize(180, 180)
    .png({ compressionLevel: 9 })
    .toBuffer();
  const png192 = await sharp(Buffer.from(iconSvg512))
    .resize(192, 192)
    .png({ compressionLevel: 9 })
    .toBuffer();
  const png512 = await sharp(Buffer.from(iconSvg512))
    .resize(512, 512)
    .png({ compressionLevel: 9 })
    .toBuffer();

  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon-48x48.png'), png48);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'apple-touch-icon.png'), png180);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon-192.png'), png192);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon-512.png'), png512);

  const icoBuf = buildIcoFromPngBuffers([
    { size: 32, png: png32 },
    { size: 48, png: png48 },
  ]);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), icoBuf);

  console.log('✓ Generated favicons: favicon.svg, favicon.ico, favicon-48x48.png, apple-touch-icon.png, icon-192.png, icon-512.png');
  console.log('Manifest:', JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
