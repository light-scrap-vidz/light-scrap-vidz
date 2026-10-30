import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { sendNotification } from '@tauri-apps/plugin-notification';
import { useQueue, type QueueConfig } from '@/hooks/useQueue';
import { withHistory } from '../wrappers';

vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: vi.fn(() => Promise.resolve(true)),
  requestPermission: vi.fn(() => Promise.resolve('granted')),
  sendNotification: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);
const mockNotify = vi.mocked(sendNotification);

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
  localStorage.clear();
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
    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });
    expect(result.current.items).toEqual([]);
    expect(result.current.isActive).toBe(false);
  });
});

describe('useQueue — queueing and processing', () => {
  it('queues items as pending and starts the first download', async () => {
    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });

    act(() => result.current.addItems([config('https://a'), config('https://b')]));

    expect(result.current.items).toHaveLength(2);
    expect(result.current.isActive).toBe(true);

    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));
    expect(result.current.items[1].status).toBe('pending');
    expect(mockInvoke).toHaveBeenCalledWith(
      'start_download',
      expect.objectContaining({
        url: 'https://a',
        outputDir: '/tmp/out',
        quality: 'best',
        audioOnly: false,
        playlistEnd: null,
        cookiesBrowser: null,
      }),
    );
  });

  it('gives each queued item a distinct id', async () => {
    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });
    act(() => result.current.addItems([config('https://a'), config('https://b')]));
    const [a, b] = result.current.items;
    expect(a.id).not.toBe(b.id);
  });

  it('tracks progress for the running item only', async () => {
    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });
    act(() => result.current.addItems([config('https://a'), config('https://b')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));

    act(() => emit('download://progress', { download_id: currentDownloadId(), percent: 42 }));

    await waitFor(() => expect(result.current.progress[result.current.items[0].id]).toBe(42));
    expect(result.current.progress[result.current.items[1].id]).toBeUndefined();
  });

  it('ignores progress addressed to another download id', async () => {
    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });
    act(() => result.current.addItems([config('https://a')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));

    act(() => emit('download://progress', { download_id: 'someone-else', percent: 99 }));

    expect(result.current.progress[result.current.items[0].id]).toBeUndefined();
  });

  it('marks an item done on completion and moves on to the next', async () => {
    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });
    act(() => result.current.addItems([config('https://a'), config('https://b')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));

    act(() =>
      emit('download://complete', { download_id: currentDownloadId(), filepath: '/x/f.mp4' }),
    );

    await waitFor(() => expect(result.current.items[0].status).toBe('done'));
    await waitFor(() => expect(result.current.items[1].status).toBe('downloading'));
    expect(mockInvoke).toHaveBeenLastCalledWith(
      'start_download',
      expect.objectContaining({ url: 'https://b' }),
    );
  });

  it('clears the progress value once an item finishes', async () => {
    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });
    act(() => result.current.addItems([config('https://a')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));

    act(() => emit('download://progress', { download_id: currentDownloadId(), percent: 80 }));
    await waitFor(() => expect(result.current.progress[result.current.items[0].id]).toBe(80));
    act(() =>
      emit('download://complete', { download_id: currentDownloadId(), filepath: '/x/f.mp4' }),
    );

    await waitFor(() =>
      expect(result.current.progress[result.current.items[0].id]).toBeUndefined(),
    );
  });

  it('becomes inactive once every item has finished', async () => {
    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });
    act(() => result.current.addItems([config('https://a')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));

    act(() =>
      emit('download://complete', { download_id: currentDownloadId(), filepath: '/x/f.mp4' }),
    );

    await waitFor(() => expect(result.current.isActive).toBe(false));
  });
});

describe('useQueue — failures', () => {
  it('stores a friendly message when the backend emits an error', async () => {
    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });
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
    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });

    act(() => result.current.addItems([config('https://a')]));

    await waitFor(() => expect(result.current.items[0].status).toBe('error'));
    expect(result.current.items[0].error).toBe('err.unavailable');
  });

  it('keeps draining the queue after a failure', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });

    act(() => result.current.addItems([config('https://a'), config('https://b')]));

    await waitFor(() => expect(result.current.items[0].status).toBe('error'));
    await waitFor(() => expect(result.current.items[1].status).toBe('downloading'));
  });
});

describe('useQueue — pruning', () => {
  it('removes a pending item by id', async () => {
    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });
    act(() => result.current.addItems([config('https://a'), config('https://b')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));
    const pendingId = result.current.items[1].id;

    act(() => result.current.removeItem(pendingId));

    expect(result.current.items.map((i) => i.url)).toEqual(['https://a']);
  });

  it('cancels and drops the item currently downloading', async () => {
    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });
    act(() => result.current.addItems([config('https://a')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));
    const downloadId = currentDownloadId();

    act(() => result.current.removeItem(result.current.items[0].id));

    expect(mockInvoke).toHaveBeenCalledWith('cancel_download', { downloadId });
    await waitFor(() => expect(result.current.items).toHaveLength(0));
  });

  it('records a finished item in the history', async () => {
    localStorage.clear();
    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });
    act(() => result.current.addItems([config('https://youtu.be/a')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));

    act(() =>
      emit('download://complete', { download_id: currentDownloadId(), filepath: '/x/a.mp4' }),
    );

    const stored = JSON.parse(localStorage.getItem('light-scrap-vidz:history') ?? '[]');
    expect(stored[0]).toMatchObject({
      url: 'https://youtu.be/a',
      filepath: '/x/a.mp4',
      platform: 'youtube',
    });
  });

  it('clearDone keeps pending and downloading items', async () => {
    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });
    act(() => result.current.addItems([config('https://a'), config('https://b')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));
    act(() =>
      emit('download://complete', { download_id: currentDownloadId(), filepath: '/x/f.mp4' }),
    );
    await waitFor(() => expect(result.current.items[1].status).toBe('downloading'));

    act(() => result.current.clearDone());

    expect(result.current.items.map((i) => i.url)).toEqual(['https://b']);
  });

  it('clearAll keeps only the item currently downloading', async () => {
    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });
    act(() => result.current.addItems([config('https://a'), config('https://b')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));

    act(() => result.current.clearAll());

    expect(result.current.items.map((i) => i.url)).toEqual(['https://a']);
  });
});

describe('useQueue — teardown', () => {
  it('detaches its event listeners on unmount', async () => {
    const { result, unmount } = renderHook(() => useQueue(), { wrapper: withHistory });
    act(() => result.current.addItems([config('https://a')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));

    unmount();

    expect(unlisten).toHaveBeenCalled();
  });
});

describe('useQueue — surviving a restart', () => {
  const stored = (status: string) => ({
    id: `id-${status}`,
    url: `https://youtu.be/${status}`,
    outputDir: '/tmp/out',
    quality: 'best',
    audioOnly: false,
    playlistEnd: null,
    cookiesBrowser: null,
    status,
  });

  it('restores waiting items and resumes downloading them', async () => {
    localStorage.setItem('light-scrap-vidz:queue', JSON.stringify([stored('pending')]));

    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });

    expect(result.current.items).toHaveLength(1);
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        'start_download',
        expect.objectContaining({ url: 'https://youtu.be/pending' }),
      ),
    );
  });

  it('puts an interrupted download back to pending and drops finished rows', async () => {
    localStorage.setItem(
      'light-scrap-vidz:queue',
      JSON.stringify([stored('downloading'), stored('done'), stored('error')]),
    );

    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });

    expect(result.current.items.map((i) => i.url)).toEqual(['https://youtu.be/downloading']);
  });

  it('writes the remaining items down and clears the key once the queue is empty', async () => {
    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });
    act(() => result.current.addItems([config('https://youtu.be/a')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));
    expect(JSON.parse(localStorage.getItem('light-scrap-vidz:queue') ?? '[]')).toHaveLength(1);

    act(() =>
      emit('download://complete', { download_id: currentDownloadId(), filepath: '/x/a.mp4' }),
    );
    await waitFor(() => expect(result.current.items[0].status).toBe('done'));

    expect(localStorage.getItem('light-scrap-vidz:queue')).toBeNull();
  });

  it('ignores a corrupted stored queue', () => {
    localStorage.setItem('light-scrap-vidz:queue', '{not json');

    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });

    expect(result.current.items).toEqual([]);
  });
});

describe('useQueue — duplicates', () => {
  it('ignores a link that is already waiting or running, and says how many it added', async () => {
    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });
    let added = 0;
    act(() => {
      added = result.current.addItems([config('https://a'), config('https://b')]);
    });
    expect(added).toBe(2);
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));

    act(() => {
      added = result.current.addItems([
        config('https://a'),
        config('https://b'),
        config('https://c'),
      ]);
    });

    expect(added).toBe(1);
    expect(result.current.items.map((i) => i.url)).toEqual(['https://a', 'https://b', 'https://c']);
  });

  it('ignores the same link twice in one batch', () => {
    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });
    let added = 0;

    act(() => {
      added = result.current.addItems([config('https://a'), config('https://a')]);
    });

    expect(added).toBe(1);
  });

  it('accepts again a link whose earlier attempt is over', async () => {
    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });
    act(() => {
      result.current.addItems([config('https://a')]);
    });
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));
    act(() =>
      emit('download://complete', { download_id: currentDownloadId(), filepath: '/x/a.mp4' }),
    );
    await waitFor(() => expect(result.current.items[0].status).toBe('done'));

    let added = 0;
    act(() => {
      added = result.current.addItems([config('https://a')]);
    });

    expect(added).toBe(1);
  });
});

describe('useQueue — retrying', () => {
  async function failFirst() {
    mockInvoke.mockRejectedValueOnce(new Error('ERROR: This video is private'));
    const hook = renderHook(() => useQueue(), { wrapper: withHistory });
    act(() => {
      hook.result.current.addItems([config('https://a'), config('https://b')]);
    });
    await waitFor(() => expect(hook.result.current.items[0].status).toBe('error'));
    await waitFor(() => expect(hook.result.current.items[1].status).toBe('downloading'));
    return hook;
  }

  it('puts one failed item back to pending and downloads it again', async () => {
    const { result } = await failFirst();
    act(() =>
      emit('download://complete', { download_id: currentDownloadId(), filepath: '/x/b.mp4' }),
    );
    await waitFor(() => expect(result.current.items[1].status).toBe('done'));

    act(() => result.current.retryItem(result.current.items[0].id));

    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));
    expect(result.current.items[0].error).toBeUndefined();
    expect(mockInvoke).toHaveBeenLastCalledWith(
      'start_download',
      expect.objectContaining({ url: 'https://a' }),
    );
  });

  it('retryFailed requeues every failed item and leaves the others alone', async () => {
    const { result } = await failFirst();

    act(() => result.current.retryFailed());

    expect(result.current.items[0].status).toBe('pending');
    expect(result.current.items[1].status).toBe('downloading');
  });
});

describe('useQueue — history and notification', () => {
  it('records the title known from the playlist preview', async () => {
    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });
    act(() => {
      result.current.addItems([{ ...config('https://youtu.be/a'), title: 'Episode 1' }]);
    });
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));

    act(() =>
      emit('download://complete', { download_id: currentDownloadId(), filepath: '/x/a.mp4' }),
    );

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('light-scrap-vidz:history') ?? '[]');
      expect(stored[0]).toMatchObject({ title: 'Episode 1' });
    });
  });

  it('notifies once, when the whole queue is done', async () => {
    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });
    act(() => {
      result.current.addItems([config('https://a'), config('https://b')]);
    });
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));
    act(() =>
      emit('download://complete', { download_id: currentDownloadId(), filepath: '/x/a.mp4' }),
    );
    await waitFor(() => expect(result.current.items[1].status).toBe('downloading'));
    expect(mockNotify).not.toHaveBeenCalled();

    act(() =>
      emit('download://complete', { download_id: currentDownloadId(), filepath: '/x/b.mp4' }),
    );

    await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
    expect(mockNotify).toHaveBeenCalledWith({
      title: 'Download complete',
      body: '2 downloads finished',
    });
  });

  it('names the file when a single download finished', async () => {
    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });
    act(() => {
      result.current.addItems([config('https://a')]);
    });
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));

    act(() =>
      emit('download://complete', { download_id: currentDownloadId(), filepath: '/x/a.mp4' }),
    );

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith({ title: 'Download complete', body: 'a.mp4' }),
    );
  });

  it('stays silent when the user switched notifications off', async () => {
    localStorage.setItem('light-scrap-vidz:notify', 'off');
    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });
    act(() => {
      result.current.addItems([config('https://a')]);
    });
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));

    act(() =>
      emit('download://complete', { download_id: currentDownloadId(), filepath: '/x/a.mp4' }),
    );
    await waitFor(() => expect(result.current.items[0].status).toBe('done'));

    expect(mockNotify).not.toHaveBeenCalled();
  });
});

describe('useQueue — storage writes', () => {
  it('does not rewrite the stored queue on every progress tick', async () => {
    const { result } = renderHook(() => useQueue(), { wrapper: withHistory });
    act(() => {
      result.current.addItems([config('https://a')]);
    });
    await waitFor(() => expect(result.current.items[0].status).toBe('downloading'));
    const write = vi.spyOn(Storage.prototype, 'setItem');

    for (const percent of [10, 20, 30, 40, 50]) {
      act(() => emit('download://progress', { download_id: currentDownloadId(), percent }));
    }

    await waitFor(() => expect(result.current.progress[result.current.items[0].id]).toBe(50));
    expect(write).not.toHaveBeenCalled();
    write.mockRestore();
  });
});
