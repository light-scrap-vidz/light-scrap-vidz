import type { Platform } from '@/types';

export interface PlatformMeta {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  youtube: {
    label: 'YouTube',
    color: '#FF7A7A',
    bgColor: 'rgba(255,59,48,0.14)',
    borderColor: 'rgba(255,59,48,0.25)',
  },
  tiktok: {
    label: 'TikTok',
    color: '#42E8DF',
    bgColor: 'rgba(37,244,238,0.14)',
    borderColor: 'rgba(37,244,238,0.25)',
  },
  instagram: {
    label: 'Instagram',
    color: '#FF86BD',
    bgColor: 'rgba(225,48,108,0.14)',
    borderColor: 'rgba(225,48,108,0.25)',
  },
  facebook: {
    label: 'Facebook',
    color: '#62A6FF',
    bgColor: 'rgba(24,119,242,0.14)',
    borderColor: 'rgba(24,119,242,0.25)',
  },
  dailymotion: {
    label: 'Dailymotion',
    color: '#B6B0A6',
    bgColor: 'rgba(138,131,120,0.14)',
    borderColor: 'rgba(138,131,120,0.25)',
  },
  twitter: {
    label: 'Twitter / X',
    color: '#74B9FF',
    bgColor: 'rgba(29,161,242,0.14)',
    borderColor: 'rgba(29,161,242,0.25)',
  },
  twitch: {
    label: 'Twitch',
    color: '#BFA3FF',
    bgColor: 'rgba(145,70,255,0.14)',
    borderColor: 'rgba(145,70,255,0.25)',
  },
  vimeo: {
    label: 'Vimeo',
    color: '#6DD4F5',
    bgColor: 'rgba(26,183,234,0.14)',
    borderColor: 'rgba(26,183,234,0.25)',
  },
  unknown: {
    label: 'Unknown',
    color: '#B6B0A6',
    bgColor: 'rgba(138,131,120,0.14)',
    borderColor: 'rgba(138,131,120,0.25)',
  },
};

export const PLATFORM_TINT: Record<Platform, string> = {
  youtube: '#FF3B30',
  tiktok: '#25F4EE',
  instagram: '#E1306C',
  facebook: '#1877F2',
  dailymotion: '#8A8378',
  twitter: '#1DA1F2',
  twitch: '#9146FF',
  vimeo: '#1AB7EA',
  unknown: '#8A8378',
};
