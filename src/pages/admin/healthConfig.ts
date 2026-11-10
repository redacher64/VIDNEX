export const DEFAULT_X_TEST_URL =
  'https://x.com/reactiive_/status/2040511285998313827';

export const DEFAULT_ENGINE_TEST_URLS: Record<
  'tiktok' | 'instagram' | 'x' | 'facebook',
  string
> = {
  tiktok: 'https://www.tiktok.com/@tiktok/video/7106594312292453675',
  instagram: 'https://www.instagram.com/reel/C8x9kLmN2pQ/',
  x: DEFAULT_X_TEST_URL,
  facebook: '',
};

export function getEngineStatusLabel(
  lastTestOk: number | null | undefined
): 'En ligne' | 'Hors ligne' {
  return lastTestOk !== 0 ? 'En ligne' : 'Hors ligne';
}
