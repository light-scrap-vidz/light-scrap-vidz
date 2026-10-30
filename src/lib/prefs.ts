import { getItem, setItem } from '@/lib/storage';
import type { Quality } from '@/types';

const QUALITY_KEY = 'light-scrap-vidz:quality';
const AUDIO_ONLY_KEY = 'light-scrap-vidz:audioOnly';
const PLAYLIST_END_KEY = 'light-scrap-vidz:playlistEnd';

const QUALITIES: readonly Quality[] = ['best', '1080p', '720p', '480p'];

export function loadQuality(): Quality {
  const saved = getItem(QUALITY_KEY);
  return QUALITIES.includes(saved as Quality) ? (saved as Quality) : 'best';
}

export function saveQuality(quality: Quality): void {
  setItem(QUALITY_KEY, quality);
}

export function loadAudioOnly(): boolean {
  return getItem(AUDIO_ONLY_KEY) === 'on';
}

export function saveAudioOnly(on: boolean): void {
  setItem(AUDIO_ONLY_KEY, on ? 'on' : 'off');
}

/** Nombres de vidéos proposés pour une playlist ; 0 veut dire « toutes ». */
export const PLAYLIST_COUNTS = [5, 10, 20, 50, 0];

export function loadPlaylistEnd(): number {
  const saved = getItem(PLAYLIST_END_KEY);
  const count = saved === null || saved.trim() === '' ? NaN : Number(saved);
  return PLAYLIST_COUNTS.includes(count) ? count : 10;
}

export function savePlaylistEnd(count: number): void {
  setItem(PLAYLIST_END_KEY, String(count));
}
