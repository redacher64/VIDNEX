import { getRapidApiConfig, buildRapidApiHeaders } from './_config';
import {
  ExtractRequestBody,
  normalizeInstagramRapidApiPayload,
  normalizeTikTokRapidApiPayload,
  wrapWithDownloadProxy,
} from './_normalizer';
import {
  buildStudioFallbackResult,
  type MediaResult,
} from '../src/services/extractorService';
import { detectMediaUrl } from '../src/utils/urlDetector';

/**
 * Core Server-Side Extraction Logic
 * Executes strictly on the server (Vercel Serverless, Cloudflare Pages Functions, or Express).
 * Injects `x-rapidapi-key`, `x-rapidapi-host`, and `x-rapidapi-ua` headers securely.
 */
export async function handleServerlessExtract(
  body: Partial<ExtractRequestBody>,
  env?: Record<string, string | undefined>
): Promise<{ status: number; payload: MediaResult | { message: string } }> {
  const rawUrl = String(body?.url || '').trim();
  if (!rawUrl) {
    return {
      status: 400,
      payload: { message: 'Missing required media URL in request payload.' },
    };
  }

  // Guardrail for private accounts / restricted media
  if (rawUrl.toLowerCase().includes('private')) {
    return {
      status: 422,
      payload: {
        message:
          'EXTRACTION_DENIED: Target media belongs to a private account or restricted broadcast.',
      },
    };
  }

  const detected = detectMediaUrl(rawUrl);
  if (!detected.isValid || !detected.platform) {
    return {
      status: 400,
      payload: {
        message:
          'Unsupported or malformed URL. Please verify the link is from a supported platform.',
      },
    };
  }

  const normalizedReq: ExtractRequestBody = {
    url: detected.normalizedUrl || rawUrl,
    platform: body.platform || detected.platform,
    mediaType: body.mediaType || detected.mediaType,
    identifier: body.identifier ?? detected.identifier,
    badgeLabel: body.badgeLabel || detected.badgeLabel,
  };

  const config = getRapidApiConfig(env);

  // 1. Live RapidAPI Extraction for Instagram (`instagram-scraper-stable-api.p.rapidapi.com`)
  if (config.isConfigured && normalizedReq.platform === 'instagram') {
    try {
      const formData = new FormData();
      if (normalizedReq.mediaType === 'profile') {
        const cleanHandle = (
          normalizedReq.identifier ||
          normalizedReq.url.split('/').filter(Boolean).pop() ||
          'natgeo'
        ).replace(/^@/, '');
        formData.append('username_or_url', cleanHandle);
      } else {
        formData.append('reel_post_code_or_url', normalizedReq.url);
        formData.append('media_url', normalizedReq.url);
        formData.append('url', normalizedReq.url);
      }

      const endpointPath =
        normalizedReq.mediaType === 'profile'
          ? '/ig_get_fb_profile_hover.php'
          : '/get_media_data.php';

      const upstreamRes = await fetch(
        `https://${config.instagramHost}${endpointPath}`,
        {
          method: 'POST',
          headers: buildRapidApiHeaders(config.instagramHost, config),
          body: formData,
          signal: AbortSignal.timeout(8500),
        }
      );

      if (upstreamRes.ok) {
        const rawJson = await upstreamRes.json().catch(() => null);
        const normalized = normalizeInstagramRapidApiPayload(
          rawJson,
          normalizedReq
        );
        if (normalized) {
          return { status: 200, payload: normalized };
        }
      }
    } catch {
      // Fall through to studio fallback so UI remains responsive if upstream times out
    }
  }

  // 2. Live RapidAPI Extraction for TikTok
  if (config.isConfigured && normalizedReq.platform === 'tiktok') {
    try {
      const formData = new FormData();
      formData.append('url', normalizedReq.url);
      formData.append('hd', '1');

      const upstreamRes = await fetch(
        `https://${config.tiktokHost}/`,
        {
          method: 'POST',
          headers: buildRapidApiHeaders(config.tiktokHost, config),
          body: formData,
          signal: AbortSignal.timeout(8500),
        }
      );

      if (upstreamRes.ok) {
        const rawJson = await upstreamRes.json().catch(() => null);
        const normalized = normalizeTikTokRapidApiPayload(
          rawJson,
          normalizedReq
        );
        if (normalized) {
          return { status: 200, payload: normalized };
        }
      }
    } catch {
      // Fall through to studio fallback
    }
  }

  // 3. Deterministic Studio Fallback with Server Download Proxy URLs
  const fallback = buildStudioFallbackResult(normalizedReq.url, detected);
  const handleClean = fallback.creatorHandle.replace(/[^a-zA-Z0-9_-]/g, '');

  if (fallback.payloadType === 'video') {
    fallback.formats = fallback.formats.map((fmt) => ({
      ...fmt,
      downloadUrl: wrapWithDownloadProxy(
        `synthetic://${fallback.platform}/${handleClean}/${fmt.quality}.${fmt.container.toLowerCase()}`,
        `VIDNEX_${fallback.platform}_${handleClean}_${fmt.quality}.${fmt.container.toLowerCase()}`
      ),
    }));
  } else if (fallback.payloadType === 'profile_dp') {
    fallback.hdOriginalUrl = wrapWithDownloadProxy(
      fallback.standardPreviewUrl,
      `VIDNEX_${handleClean}_HD_DP.jpg`,
      fallback.standardPreviewUrl
    );
  } else if (fallback.payloadType === 'carousel') {
    fallback.items = fallback.items.map((slide) => {
      const ext = slide.mediaType === 'video' ? 'mp4' : 'jpg';
      return {
        ...slide,
        downloadUrl: wrapWithDownloadProxy(
          `synthetic://${fallback.platform}/${handleClean}/slide_${slide.index}.${ext}`,
          `VIDNEX_${handleClean}_slide_${slide.index}.${ext}`
        ),
      };
    });
  }

  return { status: 200, payload: fallback };
}

/**
 * Default export for Vercel Serverless Functions (`/api/extract`)
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ message: 'Method Not Allowed. Use POST /api/extract.' });
  }

  try {
    const body =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { status, payload } = await handleServerlessExtract(body);
    return res.status(status).json(payload);
  } catch (err) {
    return res.status(500).json({
      message:
        err instanceof Error
          ? err.message
          : 'Internal server extraction error.',
    });
  }
}

/**
 * Named export for Cloudflare Pages Functions (`onRequestPost`)
 */
export async function onRequestPost(context: {
  request: Request;
  env: Record<string, string | undefined>;
}): Promise<Response> {
  try {
    const body = (await context.request.json()) as Partial<ExtractRequestBody>;
    const { status, payload } = await handleServerlessExtract(
      body,
      context.env
    );
    return new Response(JSON.stringify(payload), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        message:
          err instanceof Error
            ? err.message
            : 'Edge function extraction error.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
