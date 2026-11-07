/**
 * VIDNEX Global Production Configuration
 * When ENABLE_ADS = true:
 * - If VITE_ADSENSE_CLIENT_ID is set to a real publisher ID (ca-pub-xxx), live Google AdSense units render.
 * - Until VITE_ADSENSE_CLIENT_ID is configured, clean Zero-CLS AdSense Demo placeholders (Banner & Columns) are displayed.
 */
export const ENABLE_ADS = true;

export const ADSENSE_CLIENT_ID =
  import.meta.env.VITE_ADSENSE_CLIENT_ID || 'ca-pub-0000000000000000';

export const IS_ADSENSE_CONFIGURED = Boolean(
  ADSENSE_CLIENT_ID &&
    ADSENSE_CLIENT_ID !== 'ca-pub-0000000000000000' &&
    ADSENSE_CLIENT_ID.startsWith('ca-pub-')
);

export const APP_DOMAIN = 'vidnex.space';
export const APP_VERSION = '2.5.0';
export const LEGAL_CONTACT_EMAIL = 'compliance@vidnex.space';

