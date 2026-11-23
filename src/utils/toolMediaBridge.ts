/**
 * In-memory SPA media transfer bridge between VIDNEX public media downloaders
 * (TikTok, Instagram, X, Facebook) and client-side browser tools like Video -> MP3 / WAV.
 * Keeps everything strictly in browser memory — zero re-upload, zero server storage.
 */

export interface PendingAudioExtractionPayload {
  id: string;
  platform: 'tiktok' | 'instagram' | 'x' | 'twitter' | 'facebook';
  title: string;
  creatorHandle?: string;
  /** Same-origin /api/download?...&inline=1 stream URL to fetch directly into browser memory */
  fetchUrl: string;
  /** Clean suggested base filename (without extension) */
  suggestedBaseName: string;
  /** Optional already-loaded Blob/File if available in memory */
  blob?: Blob;
  createdAt: number;
}

const PAYLOAD_TTL_MS = 10 * 60 * 1000; // 10 minutes
let pendingAudioPayload: PendingAudioExtractionPayload | null = null;

export function setPendingVideoForAudioTool(
  payload: Omit<PendingAudioExtractionPayload, 'createdAt'>
): PendingAudioExtractionPayload {
  const entry: PendingAudioExtractionPayload = {
    ...payload,
    createdAt: Date.now(),
  };
  pendingAudioPayload = entry;
  return entry;
}

export function peekPendingVideoForAudioTool(): PendingAudioExtractionPayload | null {
  if (!pendingAudioPayload) return null;
  if (Date.now() - pendingAudioPayload.createdAt > PAYLOAD_TTL_MS) {
    pendingAudioPayload = null;
    return null;
  }
  return pendingAudioPayload;
}

export function consumePendingVideoForAudioTool(): PendingAudioExtractionPayload | null {
  const current = peekPendingVideoForAudioTool();
  pendingAudioPayload = null;
  return current;
}

export function clearPendingVideoForAudioTool(): void {
  pendingAudioPayload = null;
}

export function isAudioExtractionSupportedPlatform(
  platform: string | null | undefined
): platform is 'tiktok' | 'instagram' | 'x' | 'twitter' | 'facebook' {
  return (
    platform === 'tiktok' ||
    platform === 'instagram' ||
    platform === 'x' ||
    platform === 'twitter' ||
    platform === 'facebook'
  );
}
