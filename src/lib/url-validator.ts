import type { Platform, UrlKind } from '@/types';

const PLATFORM_PATTERNS: Array<{ platform: Platform; patterns: RegExp[] }> = [
  {
    platform: 'youtube',
    patterns: [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?.*v=/,
      /^https?:\/\/youtu\.be\//,
      /^https?:\/\/(www\.)?youtube\.com\/shorts\//,
    ],
  },
  {
    platform: 'tiktok',
    patterns: [
      /^https?:\/\/(www\.)?tiktok\.com\/@[^/?#]+\/video\//,
      /^https?:\/\/vm\.tiktok\.com\//,
      /^https?:\/\/vt\.tiktok\.com\//,
    ],
  },
  {
    platform: 'instagram',
    patterns: [/^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\//],
  },
  {
    platform: 'facebook',
    patterns: [
      /^https?:\/\/(www\.)?facebook\.com\/.+\/videos\//,
      /^https?:\/\/(www\.)?facebook\.com\/watch/,
      /^https?:\/\/fb\.watch\//,
    ],
  },
  {
    platform: 'dailymotion',
    patterns: [
      /^https?:\/\/(www\.)?dailymotion\.com\/video\//,
      /^https?:\/\/dai\.ly\//,
    ],
  },
  {
    platform: 'twitter',
    patterns: [
      /^https?:\/\/(www\.)?twitter\.com\/.+\/status\//,
      /^https?:\/\/(www\.)?x\.com\/.+\/status\//,
    ],
  },
  {
    platform: 'twitch',
    patterns: [
      /^https?:\/\/(www\.)?twitch\.tv\/videos\//,
      /^https?:\/\/clips\.twitch\.tv\//,
      /^https?:\/\/(www\.)?twitch\.tv\/[^/?#]+\/clip\//,
    ],
  },
  {
    platform: 'vimeo',
    patterns: [
      /^https?:\/\/(www\.)?vimeo\.com\/\d+/,
    ],
  },
];

// Profile / channel / playlist URLs (ordered newest-first by most platforms)
const PLAYLIST_PATTERNS: Array<{ platform: Platform; pattern: RegExp }> = [
  { platform: 'youtube', pattern: /^https?:\/\/(www\.)?youtube\.com\/@[^/?#]+\/?$/ },
  {
    platform: 'youtube',
    pattern: /^https?:\/\/(www\.)?youtube\.com\/channel\/[^/?#]+\/?$/,
  },
  { platform: 'youtube', pattern: /^https?:\/\/(www\.)?youtube\.com\/c\/[^/?#]+\/?$/ },
  { platform: 'youtube', pattern: /^https?:\/\/(www\.)?youtube\.com\/user\/[^/?#]+\/?$/ },
  { platform: 'youtube', pattern: /^https?:\/\/(www\.)?youtube\.com\/playlist\?list=/ },
  { platform: 'tiktok', pattern: /^https?:\/\/(www\.)?tiktok\.com\/@[^/?#]+\/?$/ },
  {
    platform: 'instagram',
    pattern: /^https?:\/\/(www\.)?instagram\.com\/[^/?#]+\/?$/,
  },
  {
    platform: 'instagram',
    pattern: /^https?:\/\/(www\.)?instagram\.com\/[^/?#]+\/reels\/?$/,
  },
];

export function getPlatform(url: string): Platform {
  for (const { platform, patterns } of PLATFORM_PATTERNS) {
    if (patterns.some((p) => p.test(url))) return platform;
  }
  // Also return platform for playlist URLs
  for (const { platform, pattern } of PLAYLIST_PATTERNS) {
    if (pattern.test(url)) return platform;
  }
  return 'unknown';
}

export function isPlaylistUrl(url: string): boolean {
  try {
    new URL(url);
  } catch {
    return false;
  }
  return PLAYLIST_PATTERNS.some(({ pattern }) => pattern.test(url));
}

export function getUrlKind(url: string): UrlKind {
  return isPlaylistUrl(url) ? 'playlist' : 'single';
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
  } catch {
    return false;
  }
  return getPlatform(url) !== 'unknown';
}
