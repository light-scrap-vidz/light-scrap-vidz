import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useHistory } from '@/hooks/useHistory';
import { loadOutputDir, saveOutputDir } from '@/lib/output-dir';
import type { HistoryEntry } from '@/types';

const HISTORY_KEY = 'light-scrap-vidz:history';
const LEGACY_HISTORY_KEY = 'light-scrap-vidZ:history';
const DIR_KEY = 'light-scrap-vidz:outputDir';
const LEGACY_DIR_KEY = 'light-scrap-vidZ:outputDir';

const entry: HistoryEntry = {
  id: '1',
  url: 'https://youtu.be/dQw4w9WgXcQ',
  title: 'Clip',
  thumbnail: '',
  platform: 'youtube',
  filepath: '/tmp/clip.mp4',
  downloaded_at: 1_700_000_000,
  quality: 'best',
};

beforeEach(() => {
  localStorage.clear();
});

describe('history migration off the pre-rename key', () => {
  it('adopts the legacy entries and drops the legacy key', () => {
    localStorage.setItem(LEGACY_HISTORY_KEY, JSON.stringify([entry]));

    const { result } = renderHook(() => useHistory());

    expect(result.current.entries).toEqual([entry]);
    expect(localStorage.getItem(HISTORY_KEY)).toBe(JSON.stringify([entry]));
    expect(localStorage.getItem(LEGACY_HISTORY_KEY)).toBeNull();
  });

  it('prefers the current key and leaves the legacy one untouched', () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([entry]));
    localStorage.setItem(LEGACY_HISTORY_KEY, JSON.stringify([]));

    const { result } = renderHook(() => useHistory());

    expect(result.current.entries).toEqual([entry]);
    expect(localStorage.getItem(LEGACY_HISTORY_KEY)).toBe(JSON.stringify([]));
  });

  it('starts empty when neither key is set', () => {
    const { result } = renderHook(() => useHistory());
    expect(result.current.entries).toEqual([]);
  });
});

describe('output folder migration off the pre-rename key', () => {
  it('adopts the legacy folder and drops the legacy key', () => {
    localStorage.setItem(LEGACY_DIR_KEY, '/home/me/Videos');

    expect(loadOutputDir()).toBe('/home/me/Videos');
    expect(localStorage.getItem(DIR_KEY)).toBe('/home/me/Videos');
    expect(localStorage.getItem(LEGACY_DIR_KEY)).toBeNull();
  });

  it('prefers the current key and leaves the legacy one untouched', () => {
    localStorage.setItem(DIR_KEY, '/current');
    localStorage.setItem(LEGACY_DIR_KEY, '/legacy');

    expect(loadOutputDir()).toBe('/current');
    expect(localStorage.getItem(LEGACY_DIR_KEY)).toBe('/legacy');
  });

  it('returns an empty string when neither key is set', () => {
    expect(loadOutputDir()).toBe('');
  });
});

describe('history behaviour', () => {
  it('recovers from corrupted stored JSON instead of throwing', () => {
    localStorage.setItem(HISTORY_KEY, '{ not json');

    const { result } = renderHook(() => useHistory());

    expect(result.current.entries).toEqual([]);
  });

  it('prepends new entries and persists them', () => {
    const { result } = renderHook(() => useHistory());

    act(() => result.current.addEntry(entry));
    act(() => result.current.addEntry({ ...entry, id: '2', title: 'Newer' }));

    expect(result.current.entries.map((e) => e.id)).toEqual(['2', '1']);
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')).toHaveLength(2);
  });

  it('keeps at most 50 entries', () => {
    const { result } = renderHook(() => useHistory());

    act(() => {
      for (let i = 0; i < 55; i += 1) {
        result.current.addEntry({ ...entry, id: String(i) });
      }
    });

    expect(result.current.entries).toHaveLength(50);
    expect(result.current.entries[0].id).toBe('54');
  });

  it('clearHistory empties the list and the stored key', () => {
    const { result } = renderHook(() => useHistory());
    act(() => result.current.addEntry(entry));

    act(() => result.current.clearHistory());

    expect(result.current.entries).toEqual([]);
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
  });
});

describe('saveOutputDir', () => {
  it('writes the folder under the current key', () => {
    saveOutputDir('/home/me/Downloads');

    expect(localStorage.getItem(DIR_KEY)).toBe('/home/me/Downloads');
    expect(loadOutputDir()).toBe('/home/me/Downloads');
  });

  it('overwrites a previously saved folder', () => {
    saveOutputDir('/first');
    saveOutputDir('/second');

    expect(loadOutputDir()).toBe('/second');
  });
});
