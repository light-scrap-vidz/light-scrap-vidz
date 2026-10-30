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
      start: null,
      end: null,
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
      start: null,
      end: null,
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

describe('usePlaylistInfo — stale answers', () => {
  it('ignores a slow answer that a newer lookup superseded', async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    mockInvoke
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce({ title: 'second', entries: [] });
    const { result } = renderHook(() => usePlaylistInfo());

    let first!: Promise<unknown>;
    act(() => {
      first = result.current.fetchInfo('https://a');
    });
    await act(async () => {
      await result.current.fetchInfo('https://b');
    });
    await act(async () => {
      resolveFirst({ title: 'first', entries: [] });
      await first;
    });

    expect(result.current.info?.title).toBe('second');
  });
});

describe('usePlaylistInfo — paging', () => {
  const entry = (n: number) => ({ id: `v${n}`, title: `Video ${n}`, url: `https://y.tld/v${n}` });
  const page = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => entry(from + i));

  async function loadFirstPage(count: number | null, size = 20) {
    mockInvoke.mockResolvedValueOnce({
      title: 'List',
      playlist_count: count,
      entries: page(1, size),
    });
    const hook = renderHook(() => usePlaylistInfo());
    await act(async () => {
      await hook.result.current.fetchInfo('https://list');
    });
    return hook;
  }

  it('offers more when a full page came back and the total is not reached', async () => {
    const { result } = await loadFirstPage(45);

    expect(result.current.hasMore).toBe(true);
  });

  it('offers nothing more for a short playlist', async () => {
    const { result } = await loadFirstPage(8, 8);

    expect(result.current.hasMore).toBe(false);
  });

  it('assumes there may be more when the platform gives no total and the page is full', async () => {
    const { result } = await loadFirstPage(null);

    expect(result.current.hasMore).toBe(true);
  });

  it('asks for the next window and appends its entries', async () => {
    const { result } = await loadFirstPage(45);
    mockInvoke.mockResolvedValueOnce({ title: 'List', entries: page(21, 40) });

    await act(async () => {
      await result.current.loadMore('https://list', 'firefox');
    });

    expect(mockInvoke).toHaveBeenLastCalledWith('fetch_playlist_info', {
      url: 'https://list',
      cookiesBrowser: 'firefox',
      start: 21,
      end: 40,
    });
    expect(result.current.info?.entries).toHaveLength(40);
    expect(result.current.info?.title).toBe('List');
    expect(result.current.hasMore).toBe(true);
  });

  it('stops offering more once the last page is short or the total is reached', async () => {
    const { result } = await loadFirstPage(null);
    mockInvoke.mockResolvedValueOnce({ title: 'List', entries: page(21, 27) });

    await act(async () => {
      await result.current.loadMore('https://list');
    });

    expect(result.current.info?.entries).toHaveLength(27);
    expect(result.current.hasMore).toBe(false);
  });

  it('does not add an entry twice', async () => {
    const { result } = await loadFirstPage(null);
    mockInvoke.mockResolvedValueOnce({ title: 'List', entries: page(15, 30) });

    await act(async () => {
      await result.current.loadMore('https://list');
    });

    expect(result.current.info?.entries).toHaveLength(30);
  });

  it('reports a failed page without losing the ones already loaded', async () => {
    const { result } = await loadFirstPage(null);
    mockInvoke.mockRejectedValueOnce(new Error('ERROR: HTTP Error 429: Too Many Requests'));

    await act(async () => {
      await result.current.loadMore('https://list');
    });

    expect(result.current.moreError).toBe('err.rateLimited');
    expect(result.current.info?.entries).toHaveLength(20);
    expect(result.current.loadingMore).toBe(false);
  });

  it('forgets the extra pages when a new playlist is looked up', async () => {
    const { result } = await loadFirstPage(45);
    mockInvoke.mockResolvedValueOnce({ title: 'List', entries: page(21, 40) });
    await act(async () => {
      await result.current.loadMore('https://list');
    });

    mockInvoke.mockResolvedValueOnce({ title: 'Other', playlist_count: 3, entries: page(1, 3) });
    await act(async () => {
      await result.current.fetchInfo('https://other');
    });

    expect(result.current.info?.entries).toHaveLength(3);
    expect(result.current.hasMore).toBe(false);
  });

  it('ignores a page that arrives after a reset', async () => {
    const { result } = await loadFirstPage(45);
    let resolvePage: (v: unknown) => void = () => {};
    mockInvoke.mockImplementationOnce(() => new Promise((r) => (resolvePage = r)));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.loadMore('https://list');
    });

    act(() => result.current.reset());
    await act(async () => {
      resolvePage({ title: 'List', entries: page(21, 40) });
      await pending;
    });

    expect(result.current.info).toBeNull();
  });
});
