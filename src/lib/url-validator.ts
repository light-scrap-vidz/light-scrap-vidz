import type { Platform, UrlKind } from '@/types';

const PLATFORM_PATTERNS: Array<{ platform: Platform; patterns: RegExp[] }> = [
  {
    platform: 'youtube',
    patterns: [
      /^https?:\/\/(?:www\.|m\.)?youtube\.com\/watch\?.*v=/,
      /^https?:\/\/youtu\.be\//,
      /^https?:\/\/(?:www\.|m\.)?youtube\.com\/shorts\//,
      /^https?:\/\/(?:www\.|m\.)?youtube\.com\/live\//,
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
      /^https?:\/\/(www\.)?facebook\.com\/(reel|share\/[vr])\//,
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
      /^https?:\/\/(www\.|player\.)?vimeo\.com\/(video\/)?\d+/,
    ],
  },
];

// Profile / channel / playlist URLs (ordered newest-first by most platforms)
const PLAYLIST_PATTERNS: Array<{ platform: Platform; pattern: RegExp }> = [
  { platform: 'youtube', pattern: /^https?:\/\/(?:www\.|m\.)?youtube\.com\/@[^/?#]+\/?$/ },
  {
    platform: 'youtube',
    pattern: /^https?:\/\/(?:www\.|m\.)?youtube\.com\/channel\/[^/?#]+\/?$/,
  },
  { platform: 'youtube', pattern: /^https?:\/\/(?:www\.|m\.)?youtube\.com\/c\/[^/?#]+\/?$/ },
  { platform: 'youtube', pattern: /^https?:\/\/(?:www\.|m\.)?youtube\.com\/user\/[^/?#]+\/?$/ },
  { platform: 'youtube', pattern: /^https?:\/\/(?:www\.|m\.)?youtube\.com\/playlist\?list=/ },
  { platform: 'tiktok', pattern: /^https?:\/\/(www\.)?tiktok\.com\/@[^/?#]+\/?$/ },
  // Instagram profiles are not listed: yt-dlp's profile extractor is marked as broken.
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
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  // Share links append tracking parameters (?si=…, ?_t=…) to profile and channel URLs.
  const withoutQuery = `${parsed.origin}${parsed.pathname}`;
  return PLAYLIST_PATTERNS.some(({ pattern }) => pattern.test(url) || pattern.test(withoutQuery));
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

const YOUTUBE_CHANNEL_ROOT =
  /^(https?:\/\/(?:www\.|m\.)?youtube\.com\/(?:@[^/?#]+|channel\/[^/?#]+|c\/[^/?#]+|user\/[^/?#]+))\/?$/;

/** URL à confier à yt-dlp. La racine d'une chaîne YouTube se résout en une « playlist
 * d'onglets » (Vidéos, Shorts, Live) : on vise directement l'onglet Vidéos. Les paramètres
 * de partage (?si=…) sont retirés au passage. */
export function normalizeUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const root = YOUTUBE_CHANNEL_ROOT.exec(`${parsed.origin}${parsed.pathname}`);
  return root ? `${root[1]}/videos` : url;
}
