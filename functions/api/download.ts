/**
 * Cloudflare Pages Function: `GET /api/download`
 * Zero-buffering media & thumbnail stream proxy for VIDNEX.
 *
 * Query Parameters:
 * - `url` (required): Direct upstream CDN URL (or relative TikWM path)
 * - `filename` (default: `VIDNEX_media.mp4`): Sanitized download filename
 * - `inline` (`1` for inline thumbnail/video preview, `0` or omitted for file attachment download)
 */

interface Env {
  TIKWM_API_KEY?: string;
  COBALT_API_URL?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

/**
 * Allowed upstream media CDN domain suffixes to prevent SSRF abuse.
 */
const ALLOWED_CDN_HOST_SUFFIXES = [
  'tiktokcdn.com',
  'tiktokcdn-us.com',
  'tiktokcdn-eu.com',
  'tiktokv.com',
  'tiktok.com',
  'tikwm.com',
  'musical.ly',
  'byteoversea.com',
  'ibytedtos.com',
  'ibyteimg.com',
  'cdninstagram.com',
  'instagram.com',
  'fbcdn.net',
  'facebook.com',
  'fbsbx.com',
  'twimg.com',
  'video.twimg.com',
  'pbs.twimg.com',
  'twitter.com',
  'x.com',
  ' vxtwitter.com',
  'fxtwitter.com',
  'googlevideo.com',
  'youtube.com',
  'ytimg.com',
  'ggpht.com',
  'sc-cdn.net',
  'snapchat.com',
  'impala-media-production.s3.amazonaws.com',
];

export function isAllowedMediaCdnHost(hostname: string): boolean {
  const lower = hostname.trim().toLowerCase();
  if (
    !lower ||
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower.startsWith('10.') ||
    lower.startsWith('192.168.') ||
    lower.startsWith('169.254.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(lower)
  ) {
    return false;
  }

  return ALLOWED_CDN_HOST_SUFFIXES.some((suffix) => {
    const cleanSuffix = suffix.trim();
    return lower === cleanSuffix || lower.endsWith(`.${cleanSuffix}`);
  });
}

export function sanitizeDownloadFilename(rawName: string | null): string {
  const cleaned = String(rawName || 'VIDNEX_media.mp4')
    .replace(/\.{2,}/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_');
  return cleaned || 'VIDNEX_media.mp4';
}

function inferRefererForHost(hostname: string, protocol: string): string {
  const lower = hostname.toLowerCase();
  if (
    lower.includes('instagram') ||
    lower.includes('cdninstagram') ||
    lower.includes('fbcdn')
  ) {
    return 'https://www.instagram.com/';
  }
  if (
    lower.includes('tiktok') ||
    lower.includes('byte') ||
    lower.includes('tikwm')
  ) {
    return 'https://www.tiktok.com/';
  }
  if (lower.includes('twimg') || lower.includes('twitter') || lower.includes('x.com')) {
    return 'https://x.com/';
  }
  if (lower.includes('googlevideo') || lower.includes('ytimg') || lower.includes('youtube')) {
    return 'https://www.youtube.com/';
  }
  return `${protocol}//${hostname}/`;
}

function inferFallbackMimeType(
  filename: string,
  inline: boolean,
  upstreamContentType: string | null
): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.mp4')) {
    if (
      upstreamContentType &&
      (upstreamContentType.includes('video/') ||
        upstreamContentType.includes('application/octet-stream'))
    ) {
      return upstreamContentType;
    }
    return 'video/mp4';
  }
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.zip')) return 'application/zip';
  if (inline) return 'image/jpeg';
  return (
    upstreamContentType &&
    !upstreamContentType.includes('text/html') &&
    !upstreamContentType.includes('text/plain')
      ? upstreamContentType
      : 'application/octet-stream'
  );
}

export const onRequestOptions = async (): Promise<Response> => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Accept',
      'Access-Control-Max-Age': '86400',
    },
  });
};

export const onRequestGet = async (context: PagesContext): Promise<Response> => {
  const reqUrl = new URL(context.request.url);
  let rawTargetUrl = (reqUrl.searchParams.get('url') || '').trim();
  const safeFilename = sanitizeDownloadFilename(reqUrl.searchParams.get('filename'));
  const isInline = reqUrl.searchParams.get('inline') === '1';

  if (!rawTargetUrl) {
    return new Response(
      JSON.stringify({ message: 'Missing required "url" query parameter.' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  // Handle local samples or synthetic test URLs
  if (
    rawTargetUrl.startsWith('synthetic://') ||
    rawTargetUrl.startsWith('/samples/')
  ) {
    let sampleFile = '/samples/sample-1080p.mp4';
    const lowerFilename = safeFilename.toLowerCase();
    if (lowerFilename.endsWith('.mp3')) {
      sampleFile = '/samples/sample-audio.mp3';
    } else if (
      lowerFilename.endsWith('.jpg') ||
      lowerFilename.endsWith('.jpeg') ||
      lowerFilename.endsWith('.png')
    ) {
      sampleFile = '/samples/sample-dp-1080.jpg';
    } else if (lowerFilename.endsWith('.zip')) {
      sampleFile = '/samples/sample-carousel.zip';
    } else if (lowerFilename.includes('720p')) {
      sampleFile = '/samples/sample-720p.mp4';
    }

    if (
      context.env &&
      'ASSETS' in context.env &&
      typeof (context.env as any).ASSETS?.fetch === 'function'
    ) {
      const assetUrl = new URL(sampleFile, reqUrl.origin);
      const assetRes = await (context.env as any).ASSETS.fetch(
        new Request(assetUrl.toString(), {
          headers: context.request.headers,
        })
      );
      if (assetRes.ok) {
        const headers = new Headers(assetRes.headers);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set(
          'Content-Disposition',
          isInline
            ? `inline; filename="${safeFilename}"`
            : `attachment; filename="${safeFilename}"`
        );
        return new Response(assetRes.body, {
          status: assetRes.status,
          headers,
        });
      }
    }
    return Response.redirect(new URL(sampleFile, reqUrl.origin).toString(), 302);
  }

  // Normalize protocol-relative or TikWM-relative paths
  if (rawTargetUrl.startsWith('//')) {
    rawTargetUrl = `https:${rawTargetUrl}`;
  } else if (rawTargetUrl.startsWith('/')) {
    rawTargetUrl = `https://www.tikwm.com${rawTargetUrl}`;
  }

  let parsedTarget: URL;
  try {
    parsedTarget = new URL(rawTargetUrl);
  } catch {
    return new Response(
      JSON.stringify({ message: 'Malformed media URL parameter.' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  if (
    (parsedTarget.protocol !== 'https:' && parsedTarget.protocol !== 'http:') ||
    !isAllowedMediaCdnHost(parsedTarget.hostname)
  ) {
    return new Response(
      JSON.stringify({
        message: `Blocked disallowed media CDN host: ${parsedTarget.hostname}`,
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  const upstreamHeaders = new Headers({
    'User-Agent': BROWSER_USER_AGENT,
    Accept: isInline
      ? 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
      : '*/*',
    Referer: inferRefererForHost(parsedTarget.hostname, parsedTarget.protocol),
  });

  // Forward HTTP Range header for iOS Safari / Android Chrome / Desktop video seeking & streaming
  const rangeHeader = context.request.headers.get('Range');
  if (rangeHeader) {
    upstreamHeaders.set('Range', rangeHeader);
  }

  try {
    const upstreamRes = await fetch(parsedTarget.toString(), {
      method: context.request.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: upstreamHeaders,
      redirect: 'follow',
    });

    const isVideoRequested = safeFilename.toLowerCase().endsWith('.mp4');
    const isAudioRequested = safeFilename.toLowerCase().endsWith('.mp3');
    const upstreamContentType = (upstreamRes.headers.get('Content-Type') || '').toLowerCase();

    // If upstream returns an error, bot protection challenge (HTML), or a placeholder image when a video was requested:
    // Seamlessly redirect the user's browser (302) to the direct CDN target so their residential IP / browser cookies
    // can stream/download it directly without getting stuck on Cloudflare edge block or downloading a corrupted file!
    if (
      !isInline &&
      (isVideoRequested || isAudioRequested) &&
      (!upstreamRes.ok ||
        upstreamContentType.includes('text/html') ||
        upstreamContentType.includes('text/plain') ||
        (isVideoRequested && upstreamContentType.startsWith('image/')))
    ) {
      return Response.redirect(parsedTarget.toString(), 302);
    }

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return new Response(
        JSON.stringify({
          message: `Upstream media CDN returned HTTP ${upstreamRes.status}.`,
        }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const contentType = inferFallbackMimeType(
      safeFilename,
      isInline,
      upstreamRes.headers.get('Content-Type')
    );

    const responseHeaders = new Headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers':
        'Content-Disposition, Content-Length, Content-Range, Accept-Ranges',
      'Content-Type': contentType,
      'Cache-Control': isInline
        ? 'public, max-age=86400'
        : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    });

    if (isInline) {
      responseHeaders.set(
        'Content-Disposition',
        `inline; filename="${safeFilename}"`
      );
    } else {
      responseHeaders.set(
        'Content-Disposition',
        `attachment; filename="${safeFilename}"`
      );
    }

    const contentLength = upstreamRes.headers.get('Content-Length');
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength);
    }

    const contentRange = upstreamRes.headers.get('Content-Range');
    if (contentRange) {
      responseHeaders.set('Content-Range', contentRange);
    }

    const acceptRanges = upstreamRes.headers.get('Accept-Ranges');
    if (acceptRanges) {
      responseHeaders.set('Accept-Ranges', acceptRanges);
    } else if (!isInline) {
      responseHeaders.set('Accept-Ranges', 'bytes');
    }

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (err) {
    if (
      !isInline &&
      (safeFilename.toLowerCase().endsWith('.mp4') ||
        safeFilename.toLowerCase().endsWith('.mp3'))
    ) {
      return Response.redirect(parsedTarget.toString(), 302);
    }
    return new Response(
      JSON.stringify({
        message:
          err instanceof Error
            ? `Media stream proxy failed: ${err.message}`
            : 'Media stream proxy error.',
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
};
