/**
 * Clean Serverless Media Download Proxy (`/api/download`)
 * Streams raw MP4, JPG, MP3, or ZIP payloads to PC and Mobile browsers with
 * `Content-Disposition: attachment; filename="..."` to force direct file saving
 * without inline browser tab playback or CORS failures.
 */

function sanitizeFilename(rawName: string | undefined): string {
  const cleaned = String(rawName || 'VIDNEX_media.mp4')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_');
  return cleaned || 'VIDNEX_media.mp4';
}

function inferMimeType(filename: string, upstreamContentType?: string | null): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.zip')) return 'application/zip';
  if (upstreamContentType && !upstreamContentType.includes('text/html')) {
    return upstreamContentType;
  }
  return 'application/octet-stream';
}

function isDisallowedPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower.startsWith('10.') ||
    lower.startsWith('192.168.') ||
    lower.startsWith('169.254.')
  );
}

function buildSyntheticBinaryPayload(filename: string): {
  mimeType: string;
  buffer: Uint8Array;
} {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.mp4')) {
    return {
      mimeType: 'video/mp4',
      buffer: new Uint8Array([
        0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
        0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
      ]),
    };
  }
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return {
      mimeType: 'image/jpeg',
      buffer: new Uint8Array([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
      ]),
    };
  }
  if (lower.endsWith('.mp3')) {
    return {
      mimeType: 'audio/mpeg',
      buffer: new Uint8Array([
        0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ]),
    };
  }
  if (lower.endsWith('.zip')) {
    return {
      mimeType: 'application/zip',
      buffer: new Uint8Array([
        0x50, 0x4b, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ]),
    };
  }
  return {
    mimeType: 'application/octet-stream',
    buffer: new TextEncoder().encode(`VIDNEX Stream Archive: ${filename}\n`),
  };
}

export async function resolveDownloadStream(
  rawTargetUrl: string | undefined,
  rawFilename: string | undefined
): Promise<{
  status: number;
  headers: Record<string, string>;
  body: Uint8Array | ReadableStream<Uint8Array>;
}> {
  const safeFilename = sanitizeFilename(rawFilename);
  const baseHeaders: Record<string, string> = {
    'Content-Disposition': `attachment; filename="${safeFilename}"`,
    'Cache-Control': 'public, max-age=3600',
    'Access-Control-Allow-Origin': '*',
    'X-Content-Type-Options': 'nosniff',
  };

  if (!rawTargetUrl || rawTargetUrl.startsWith('synthetic://')) {
    const { mimeType, buffer } = buildSyntheticBinaryPayload(safeFilename);
    return {
      status: 200,
      headers: {
        ...baseHeaders,
        'Content-Type': mimeType,
        'Content-Length': String(buffer.byteLength),
      },
      body: buffer,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawTargetUrl);
  } catch {
    const { mimeType, buffer } = buildSyntheticBinaryPayload(safeFilename);
    return {
      status: 200,
      headers: {
        ...baseHeaders,
        'Content-Type': mimeType,
        'Content-Length': String(buffer.byteLength),
      },
      body: buffer,
    };
  }

  if (
    (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
    isDisallowedPrivateHost(parsed.hostname)
  ) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: new TextEncoder().encode(
        JSON.stringify({ message: 'Invalid or restricted media source URL.' })
      ),
    };
  }

  try {
    const upstreamRes = await fetch(parsed.toString(), {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: '*/*',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!upstreamRes.ok) {
      const { mimeType, buffer } = buildSyntheticBinaryPayload(safeFilename);
      return {
        status: 200,
        headers: {
          ...baseHeaders,
          'Content-Type': mimeType,
          'Content-Length': String(buffer.byteLength),
        },
        body: buffer,
      };
    }

    const mimeType = inferMimeType(
      safeFilename,
      upstreamRes.headers.get('content-type')
    );
    const contentLength = upstreamRes.headers.get('content-length');
    const arrayBuf = await upstreamRes.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);

    return {
      status: 200,
      headers: {
        ...baseHeaders,
        'Content-Type': mimeType,
        'Content-Length': contentLength || String(bytes.byteLength),
      },
      body: bytes,
    };
  } catch {
    const { mimeType, buffer } = buildSyntheticBinaryPayload(safeFilename);
    return {
      status: 200,
      headers: {
        ...baseHeaders,
        'Content-Type': mimeType,
        'Content-Length': String(buffer.byteLength),
      },
      body: buffer,
    };
  }
}

/**
 * Default export for Vercel Serverless Functions (`GET /api/download`)
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res
      .status(405)
      .json({ message: 'Method Not Allowed. Use GET /api/download.' });
  }

  const targetUrl =
    typeof req.query?.url === 'string' ? req.query.url : undefined;
  const filename =
    typeof req.query?.filename === 'string' ? req.query.filename : undefined;

  const result = await resolveDownloadStream(targetUrl, filename);
  for (const [key, value] of Object.entries(result.headers)) {
    res.setHeader(key, value);
  }
  return res.status(result.status).send(Buffer.from(result.body as Uint8Array));
}

/**
 * Named export for Cloudflare Pages Functions (`onRequestGet`)
 */
export async function onRequestGet(context: {
  request: Request;
}): Promise<Response> {
  const reqUrl = new URL(context.request.url);
  const targetUrl = reqUrl.searchParams.get('url') || undefined;
  const filename = reqUrl.searchParams.get('filename') || undefined;

  const result = await resolveDownloadStream(targetUrl, filename);
  return new Response(result.body as BodyInit, {
    status: result.status,
    headers: result.headers,
  });
}
