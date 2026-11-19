/**
 * Configuration centralisée Adsterra pour VIDNEX.
 * Pour changer le domaine de diffusion Adsterra, modifiez uniquement `ADSTERRA_DOMAIN`.
 */

export const ADSTERRA_DOMAIN = 'https://bellnewyork.org';

export interface AdsterraBannerUnit {
  key: string;
  format: 'iframe';
  width: number;
  height: number;
}

export const ADSTERRA_CONFIG = {
  domain: ADSTERRA_DOMAIN,
  socialBar: {
    key: 'd0aaec22d250227f3813abba951b9e0a',
    path: '/14/d0aaec22d250227f3813abba951b9e0a',
  },
  nativeBanner: {
    key: 'b6b738ed32552f1fb5a38165c5c7ee4a',
    path: '/21/b6b738ed32552f1fb5a38165c5c7ee4a',
    containerId: 'container-b6b738ed32552f1fb5a38165c5c7ee4a',
  },
  banners: {
    '728x90': {
      key: '88fab04888526875ad70d3600cd20552',
      format: 'iframe',
      width: 728,
      height: 90,
    },
    '320x50': {
      key: 'be0d8adcee443989a07b21cca9731553',
      format: 'iframe',
      width: 320,
      height: 50,
    },
    '300x250': {
      key: '5c421075520bced3f83caf40d4bb3a71',
      format: 'iframe',
      width: 300,
      height: 250,
    },
    '160x600': {
      key: 'd64ffc8510f6f1d20e3d96b787b7ff34',
      format: 'iframe',
      width: 160,
      height: 600,
    },
  } satisfies Record<'728x90' | '320x50' | '300x250' | '160x600', AdsterraBannerUnit>,
} as const;

export type AdsterraBannerSize = keyof typeof ADSTERRA_CONFIG.banners;

export function getAdsterraBaseDomain(domain: string = ADSTERRA_DOMAIN): string {
  return domain.trim().replace(/\/+$/, '');
}

export function getAdsterraSocialBarScriptUrl(
  domain: string = ADSTERRA_DOMAIN
): string {
  return `${getAdsterraBaseDomain(domain)}${ADSTERRA_CONFIG.socialBar.path}`;
}

export function getAdsterraNativeBannerScriptUrl(
  domain: string = ADSTERRA_DOMAIN
): string {
  return `${getAdsterraBaseDomain(domain)}${ADSTERRA_CONFIG.nativeBanner.path}`;
}

export function getAdsterraBannerScriptUrl(
  key: string,
  domain: string = ADSTERRA_DOMAIN
): string {
  return `${getAdsterraBaseDomain(domain)}/22/${encodeURIComponent(key)}`;
}

/**
 * Génère le document HTML isolé (`srcdoc`) pour une bannière Adsterra (`window.atOptions` + script `/22/<key>`).
 */
export function buildAdsterraBannerSrcDoc(
  unit: AdsterraBannerUnit,
  domain: string = ADSTERRA_DOMAIN
): string {
  const atOptionsPayload = JSON.stringify({
    key: unit.key,
    format: 'iframe',
    height: unit.height,
    width: unit.width,
    params: {},
  });
  const scriptSrc = getAdsterraBannerScriptUrl(unit.key, domain);

  return [
    '<!DOCTYPE html>',
    '<html><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;display:flex;align-items:center;justify-content:center;}</style>',
    '</head><body>',
    `<script data-cfasync="false" type="text/javascript">window.atOptions=${atOptionsPayload};</script>`,
    `<script data-cfasync="false" type="text/javascript" src="${scriptSrc}"></script>`,
    '</body></html>',
  ].join('');
}
