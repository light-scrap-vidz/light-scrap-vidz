import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadAudioOnly,
  loadPlaylistEnd,
  loadQuality,
  PLAYLIST_COUNTS,
  saveAudioOnly,
  savePlaylistEnd,
  saveQuality,
} from '@/lib/prefs';

beforeEach(() => localStorage.clear());

describe('preferences', () => {
  it('start from the defaults', () => {
    expect(loadQuality()).toBe('best');
    expect(loadAudioOnly()).toBe(false);
    expect(loadPlaylistEnd()).toBe(10);
  });

  it('are remembered', () => {
    saveQuality('480p');
    saveAudioOnly(true);
    savePlaylistEnd(0);

    expect(loadQuality()).toBe('480p');
    expect(loadAudioOnly()).toBe(true);
    expect(loadPlaylistEnd()).toBe(0);
  });

  it('can be switched back', () => {
    saveAudioOnly(true);
    saveAudioOnly(false);

    expect(loadAudioOnly()).toBe(false);
  });

  it('ignore a stored quality that does not exist', () => {
    localStorage.setItem('light-scrap-vidz:quality', '8k');

    expect(loadQuality()).toBe('best');
  });

  it.each(['7', '-1', 'abc', '', '1e3', '5.5'])('ignore a stored count of %j', (stored) => {
    localStorage.setItem('light-scrap-vidz:playlistEnd', stored);

    expect(loadPlaylistEnd()).toBe(10);
  });

  it.each(PLAYLIST_COUNTS)('accept the offered count %i', (count) => {
    savePlaylistEnd(count);

    expect(loadPlaylistEnd()).toBe(count);
  });
});
