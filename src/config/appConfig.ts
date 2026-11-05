/**
 * VIDNEX Global Production Configuration
 * Keep ENABLE_ADS = false at launch for a 100% ad-free, ultra-fast experience.
 * Flipping ENABLE_ADS = true activates pre-sized Zero-CLS AdSense containers.
 */
export const ENABLE_ADS = false;

export const ADSENSE_CLIENT_ID =
  import.meta.env.VITE_ADSENSE_CLIENT_ID || 'ca-pub-0000000000000000';

export const APP_DOMAIN = 'vidnex.space';
export const APP_VERSION = '2.5.0';
export const LEGAL_CONTACT_EMAIL = 'compliance@vidnex.space';
