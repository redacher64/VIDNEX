import React from 'react';
import { PlatformId } from '../../utils/urlDetector';

interface IconProps {
  className?: string;
}

export const VidnexLogoMark: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Outer precision frame */}
    <rect
      x="2"
      y="2"
      width="20"
      height="20"
      stroke="currentColor"
      strokeWidth="2"
    />
    {/* Geometric V-Vector Extraction Mark */}
    <path
      d="M7.5 8.5L12 15.5L16.5 8.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
    />
    <line
      x1="7.5"
      y1="17.5"
      x2="16.5"
      y2="17.5"
      stroke="currentColor"
      strokeWidth="1.75"
    />
  </svg>
);

export const PlatformIcon: React.FC<{
  platform: PlatformId;
  className?: string;
}> = ({ platform, className = 'w-4 h-4' }) => {
  switch (platform) {
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
          <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
          <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
          <rect x="2" y="5" width="20" height="14" rx="3" />
          <polygon points="10 9 15 12 10 15 10 9" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'x':
    case 'twitter':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'snapchat':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
          <path
            d="M12 3c-3 0-5.5 2.2-5.5 5.5 0 1.2.2 2.3.2 2.3L5 11.5c-.6.2-.8.8-.4 1.3.5.5 1.7.9 1.7.9s-.5 1.8-2.3 2.5c-.5.2-.6.8-.1 1.2 1.2.9 3 .9 3.8 1.5.5.4.8 1.1 1.5 1.1.8 0 1.5-.5 2.8-.5s2 .5 2.8.5c.7 0 1-.7 1.5-1.1.8-.6 2.6-.6 3.8-1.5.5-.4.4-1-.1-1.2-1.8-.7-2.3-2.5-2.3-2.5s1.2-.4 1.7-.9c.4-.5.2-1.1-.4-1.3l-1.7-.7s.2-1.1.2-2.3C17.5 5.2 15 3 12 3z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
};
