import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { usePlaylistInfo } from '@/hooks/usePlaylistInfo';

const mockInvoke = vi.mocked(invoke);

const playlist = { title: 'A playlist', playlist_count: 2, entries: [] };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('usePlaylistInfo', () => {
  it('starts idle with nothing loaded', () => {
    const { result } = renderHook(() => usePlaylistInfo());
    expect(result.current.status).toBe('idle');
    expect(result.current.info).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('loads a playlist and returns it to the caller', async () => {
    mockInvoke.mockResolvedValueOnce(playlist);
    const { result } = renderHook(() => usePlaylistInfo());

    let returned;
    await act(async () => {
      returned = await result.current.fetchInfo('https://list');
    });

    expect(returned).toEqual(playlist);
    expect(result.current.status).toBe('success');
    expect(result.current.info).toEqual(playlist);
    expect(mockInvoke).toHaveBeenCalledWith('fetch_playlist_info', {
      url: 'https://list',
      cookiesBrowser: null,
    });
  });

  it('forwards the selected browser', async () => {
    mockInvoke.mockResolvedValueOnce(playlist);
    const { result } = renderHook(() => usePlaylistInfo());

    await act(async () => {
      await result.current.fetchInfo('https://list', 'firefox');
    });

    expect(mockInvoke).toHaveBeenCalledWith('fetch_playlist_info', {
      url: 'https://list',
      cookiesBrowser: 'firefox',
    });
  });

  it('records the error and returns null when the backend fails', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('playlist is private'));
    const { result } = renderHook(() => usePlaylistInfo());

    let returned;
    await act(async () => {
      returned = await result.current.fetchInfo('https://list');
    });

    expect(returned).toBeNull();
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('playlist is private');
    expect(result.current.info).toBeNull();
  });

  it('stringifies a non-Error rejection', async () => {
    mockInvoke.mockRejectedValueOnce('plain string failure');
    const { result } = renderHook(() => usePlaylistInfo());

    await act(async () => {
      await result.current.fetchInfo('https://list');
    });

    expect(result.current.error).toBe('plain string failure');
  });

  it('drops the previous result when a new fetch starts', async () => {
    mockInvoke.mockResolvedValueOnce(playlist);
    const { result } = renderHook(() => usePlaylistInfo());
    await act(async () => {
      await result.current.fetchInfo('https://list');
    });

    mockInvoke.mockRejectedValueOnce(new Error('nope'));
    await act(async () => {
      await result.current.fetchInfo('https://other');
    });

    expect(result.current.info).toBeNull();
    expect(result.current.status).toBe('error');
  });

  it('reset returns the hook to its initial state', async () => {
    mockInvoke.mockResolvedValueOnce(playlist);
    const { result } = renderHook(() => usePlaylistInfo());
    await act(async () => {
      await result.current.fetchInfo('https://list');
    });

    act(() => result.current.reset());

    expect(result.current.status).toBe('idle');
    expect(result.current.info).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
