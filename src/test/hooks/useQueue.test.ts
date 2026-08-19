import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useQueue, type QueueConfig } from '@/hooks/useQueue';

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);

/** Handlers registered through the mocked `listen`, keyed by event name. */
let handlers: Record<string, (e: { payload: unknown }) => void>;
let unlisten: ReturnType<typeof vi.fn>;

/** The download id the hook generated for the in-flight item. */
function currentDownloadId(): string {
  const call = mockInvoke.mock.calls.at(-1);
  return (call?.[1] as { downloadId: string }).downloadId;
}

function emit(event: string, payload: unknown) {
  handlers[event]?.({ payload });
}

const config = (url: string): QueueConfig => ({
  url,
  outputDir: '/tmp/out',
  quality: 'best',
  audioOnly: false,
  playlistEnd: null,
  cookiesBrowser: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  handlers = {};
  unlisten = vi.fn();
  mockListen.mockImplementation(((event: string, handler: unknown) => {
    handlers[event] = handler as (e: { payload: unknown }) => void;
    return Promise.resolve(unlisten);
  }) as typeof listen);
  mockInvoke.mockResolvedValue(undefined);
});

describe('useQueue — initial state', () => {
  it('starts empty and inactive', () => {
    const { result } = renderHook(() => useQueue());
    expect(result.current.items).toEqual([]);
    expect(result.current.isActive).toBe(false);
  });
});

describe('useQueue — queueing and processing', () => {
  it('queues items as pending and starts the first download', async () => {
    const { result } = renderHook(() => useQueue());

    act(() => result.current.addItems([config('https://a'), config('https://b')]));

    expect(result.current.items).toHaveLength(2);
    expect(result.current.isActive).toBe(true);

    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));
    expect(result.current.items[1].status).toBe('pending');
    expect(mockInvoke).toHaveBeenCalledWith('start_download', expect.objectContaining({
      url: 'https://a',
      outputDir: '/tmp/out',
      quality: 'best',
      audioOnly: false,
      playlistEnd: null,
      cookiesBrowser: null,
    }));
  });

  it('gives each queued item a distinct id', async () => {
    const { result } = renderHook(() => useQueue());
    act(() => result.current.addItems([config('https://a'), config('https://b')]));
    const [a, b] = result.current.items;
    expect(a.id).not.toBe(b.id);
  });

  it('tracks progress for the running item only', async () => {
    const { result } = renderHook(() => useQueue());
    act(() => result.current.addItems([config('https://a'), config('https://b')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));

    act(() => emit('download://progress', { download_id: currentDownloadId(), percent: 42 }));

    await waitFor(() => expect(result.current.items[0].progress).toBe(42));
    expect(result.current.items[1].progress).toBeUndefined();
  });

  it('ignores progress addressed to another download id', async () => {
    const { result } = renderHook(() => useQueue());
    act(() => result.current.addItems([config('https://a')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));

    act(() => emit('download://progress', { download_id: 'someone-else', percent: 99 }));

    expect(result.current.items[0].progress).toBeUndefined();
  });

  it('marks an item done on completion and moves on to the next', async () => {
    const { result } = renderHook(() => useQueue());
    act(() => result.current.addItems([config('https://a'), config('https://b')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));

    act(() => emit('download://complete', { download_id: currentDownloadId() }));

    await waitFor(() => expect(result.current.items[0].status).toBe('done'));
    await waitFor(() => expect(result.current.items[1].status).toBe('downloading'));
    expect(mockInvoke).toHaveBeenLastCalledWith(
      'start_download',
      expect.objectContaining({ url: 'https://b' }),
    );
  });

  it('clears the progress value once an item finishes', async () => {
    const { result } = renderHook(() => useQueue());
    act(() => result.current.addItems([config('https://a')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));

    act(() => emit('download://progress', { download_id: currentDownloadId(), percent: 80 }));
    await waitFor(() => expect(result.current.items[0].progress).toBe(80));
    act(() => emit('download://complete', { download_id: currentDownloadId() }));

    await waitFor(() => expect(result.current.items[0].progress).toBeUndefined());
  });

  it('becomes inactive once every item has finished', async () => {
    const { result } = renderHook(() => useQueue());
    act(() => result.current.addItems([config('https://a')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));

    act(() => emit('download://complete', { download_id: currentDownloadId() }));

    await waitFor(() => expect(result.current.isActive).toBe(false));
  });
});

describe('useQueue — failures', () => {
  it('stores a friendly message when the backend emits an error', async () => {
    const { result } = renderHook(() => useQueue());
    act(() => result.current.addItems([config('https://a')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));

    act(() =>
      emit('download://error', {
        download_id: currentDownloadId(),
        message: 'ERROR: This video is private',
      }),
    );

    await waitFor(() => expect(result.current.items[0].status).toBe('error'));
    expect(result.current.items[0].error).toBe('err.private');
  });

  it('marks the item failed when start_download itself rejects', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('ERROR: This video is unavailable'));
    const { result } = renderHook(() => useQueue());

    act(() => result.current.addItems([config('https://a')]));

    await waitFor(() => expect(result.current.items[0].status).toBe('error'));
    expect(result.current.items[0].error).toBe('err.unavailable');
  });

  it('keeps draining the queue after a failure', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useQueue());

    act(() => result.current.addItems([config('https://a'), config('https://b')]));

    await waitFor(() => expect(result.current.items[0].status).toBe('error'));
    await waitFor(() => expect(result.current.items[1].status).toBe('downloading'));
  });
});

describe('useQueue — pruning', () => {
  it('removes a pending item by id', async () => {
    const { result } = renderHook(() => useQueue());
    act(() => result.current.addItems([config('https://a'), config('https://b')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));
    const pendingId = result.current.items[1].id;

    act(() => result.current.removeItem(pendingId));

    expect(result.current.items.map((i) => i.url)).toEqual(['https://a']);
  });

  it('refuses to remove the item currently downloading', async () => {
    const { result } = renderHook(() => useQueue());
    act(() => result.current.addItems([config('https://a')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));

    act(() => result.current.removeItem(result.current.items[0].id));

    expect(result.current.items).toHaveLength(1);
  });

  it('clearDone keeps pending and downloading items', async () => {
    const { result } = renderHook(() => useQueue());
    act(() => result.current.addItems([config('https://a'), config('https://b')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));
    act(() => emit('download://complete', { download_id: currentDownloadId() }));
    await waitFor(() => expect(result.current.items[1].status).toBe('downloading'));

    act(() => result.current.clearDone());

    expect(result.current.items.map((i) => i.url)).toEqual(['https://b']);
  });

  it('clearAll keeps only the item currently downloading', async () => {
    const { result } = renderHook(() => useQueue());
    act(() => result.current.addItems([config('https://a'), config('https://b')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));

    act(() => result.current.clearAll());

    expect(result.current.items.map((i) => i.url)).toEqual(['https://a']);
  });
});

describe('useQueue — teardown', () => {
  it('detaches its event listeners on unmount', async () => {
    const { result, unmount } = renderHook(() => useQueue());
    act(() => result.current.addItems([config('https://a')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));

    unmount();

    expect(unlisten).toHaveBeenCalled();
  });
});
