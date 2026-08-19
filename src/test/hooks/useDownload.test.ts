import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { useDownload } from '@/hooks/useDownload';
import type { PlaylistInfo, VideoInfo } from '@/types';

vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);
const mockGranted = vi.mocked(isPermissionGranted);
const mockRequest = vi.mocked(requestPermission);
const mockNotify = vi.mocked(sendNotification);

let handlers: Record<string, (e: { payload: unknown }) => void>;
let unlisten: ReturnType<typeof vi.fn>;

const HISTORY_KEY = 'light-scrap-vidz:history';

function emit(event: string, payload: unknown) {
  handlers[event]?.({ payload });
}

function downloadId(): string {
  const call = mockInvoke.mock.calls.find((c) => c[0] === 'start_download');
  return (call?.[1] as { downloadId: string }).downloadId;
}

const videoInfo: VideoInfo = {
  id: 'abc',
  title: 'A clip',
  thumbnail: 'https://img/thumb.jpg',
  duration: 30,
  uploader: 'someone',
  webpage_url: 'https://www.youtube.com/watch?v=abc',
  extractor: 'youtube',
  formats: [],
} as unknown as VideoInfo;

const playlistInfo = { title: 'A playlist', entries: [] } as unknown as PlaylistInfo;

/** Kicks off a download with the boilerplate arguments filled in. */
async function start(
  result: { current: ReturnType<typeof useDownload> },
  info: VideoInfo | null = videoInfo,
  playlist: PlaylistInfo | null = null,
) {
  await act(async () => {
    await result.current.download(
      'https://www.youtube.com/watch?v=abc',
      '/tmp/out',
      'best',
      info,
      playlist,
      null,
      null,
      false,
    );
  });
}

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
  mockGranted.mockResolvedValue(true);
  mockRequest.mockResolvedValue('granted');
});

describe('useDownload — lifecycle', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useDownload());
    expect(result.current.status).toBe('idle');
    expect(result.current.progress).toBeNull();
    expect(result.current.completedPath).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('switches to downloading and forwards the arguments to the backend', async () => {
    const { result } = renderHook(() => useDownload());
    await start(result);

    expect(result.current.status).toBe('downloading');
    expect(mockInvoke).toHaveBeenCalledWith(
      'start_download',
      expect.objectContaining({
        url: 'https://www.youtube.com/watch?v=abc',
        outputDir: '/tmp/out',
        quality: 'best',
        audioOnly: false,
        playlistEnd: null,
        cookiesBrowser: null,
      }),
    );
  });

  it('records progress for its own download only', async () => {
    const { result } = renderHook(() => useDownload());
    await start(result);

    act(() => emit('download://progress', { download_id: 'other', percent: 10 }));
    expect(result.current.progress).toBeNull();

    act(() => emit('download://progress', { download_id: downloadId(), percent: 55 }));
    await waitFor(() => expect(result.current.progress?.percent).toBe(55));
  });

  it('completes with the produced file path', async () => {
    const { result } = renderHook(() => useDownload());
    await start(result);

    act(() =>
      emit('download://complete', { download_id: downloadId(), filepath: '/tmp/out/clip.mp4' }),
    );

    await waitFor(() => expect(result.current.status).toBe('complete'));
    expect(result.current.completedPath).toBe('/tmp/out/clip.mp4');
  });

  it('reports a parsed message when the backend errors', async () => {
    const { result } = renderHook(() => useDownload());
    await start(result);

    act(() =>
      emit('download://error', {
        download_id: downloadId(),
        message: 'ERROR: This video is private',
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('err.private');
  });

  it('reports an error when start_download rejects outright', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('ERROR: Your IP is blocked from accessing'));
    const { result } = renderHook(() => useDownload());

    await start(result);

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('err.ipBlocked');
  });
});

describe('useDownload — history', () => {
  it('records a finished single video with its title and thumbnail', async () => {
    const { result } = renderHook(() => useDownload());
    await start(result);

    act(() =>
      emit('download://complete', { download_id: downloadId(), filepath: '/tmp/out/clip.mp4' }),
    );

    await waitFor(() => expect(result.current.status).toBe('complete'));
    const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      title: 'A clip',
      thumbnail: 'https://img/thumb.jpg',
      platform: 'youtube',
      filepath: '/tmp/out/clip.mp4',
      quality: 'best',
    });
  });

  it('records a playlist under its own title, with no thumbnail', async () => {
    const { result } = renderHook(() => useDownload());
    await start(result, null, playlistInfo);

    act(() =>
      emit('download://complete', { download_id: downloadId(), filepath: '/tmp/out/list' }),
    );

    await waitFor(() => expect(result.current.status).toBe('complete'));
    const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    expect(stored[0]).toMatchObject({ title: 'A playlist', thumbnail: '' });
  });

  it('falls back to "Playlist" when the playlist has no title', async () => {
    const { result } = renderHook(() => useDownload());
    await start(result, null, { title: '' } as unknown as PlaylistInfo);

    act(() =>
      emit('download://complete', { download_id: downloadId(), filepath: '/tmp/out/list' }),
    );

    await waitFor(() => expect(result.current.status).toBe('complete'));
    const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    expect(stored[0].title).toBe('Playlist');
  });

  it('writes no history entry when neither video nor playlist info is known', async () => {
    const { result } = renderHook(() => useDownload());
    await start(result, null, null);

    act(() =>
      emit('download://complete', { download_id: downloadId(), filepath: '/tmp/out/clip.mp4' }),
    );

    await waitFor(() => expect(result.current.status).toBe('complete'));
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
  });
});

describe('useDownload — notifications', () => {
  it('notifies with the file name when permission is already granted', async () => {
    const { result } = renderHook(() => useDownload());
    await start(result);

    act(() =>
      emit('download://complete', { download_id: downloadId(), filepath: '/tmp/out/clip.mp4' }),
    );

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith({
        title: 'Download complete',
        body: 'clip.mp4',
      }),
    );
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('asks for permission first when it has not been granted', async () => {
    mockGranted.mockResolvedValue(false);
    const { result } = renderHook(() => useDownload());
    await start(result);

    act(() =>
      emit('download://complete', { download_id: downloadId(), filepath: '/tmp/out/clip.mp4' }),
    );

    await waitFor(() => expect(mockRequest).toHaveBeenCalled());
    await waitFor(() => expect(mockNotify).toHaveBeenCalled());
  });

  it('stays silent when permission is refused', async () => {
    mockGranted.mockResolvedValue(false);
    mockRequest.mockResolvedValue('denied');
    const { result } = renderHook(() => useDownload());
    await start(result);

    act(() =>
      emit('download://complete', { download_id: downloadId(), filepath: '/tmp/out/clip.mp4' }),
    );

    await waitFor(() => expect(result.current.status).toBe('complete'));
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('swallows notification failures without breaking the download', async () => {
    mockGranted.mockRejectedValue(new Error('no notification backend'));
    const { result } = renderHook(() => useDownload());
    await start(result);

    act(() =>
      emit('download://complete', { download_id: downloadId(), filepath: '/tmp/out/clip.mp4' }),
    );

    await waitFor(() => expect(result.current.status).toBe('complete'));
    expect(mockNotify).not.toHaveBeenCalled();
  });
});

describe('useDownload — cancel and reset', () => {
  it('cancels the running download by id', async () => {
    const { result } = renderHook(() => useDownload());
    await start(result);

    await act(async () => {
      await result.current.cancel();
    });

    expect(mockInvoke).toHaveBeenCalledWith('cancel_download', { downloadId: downloadId() });
    expect(result.current.status).toBe('cancelled');
  });

  it('still reports cancelled when the backend rejects the cancel', async () => {
    const { result } = renderHook(() => useDownload());
    await start(result);
    mockInvoke.mockRejectedValueOnce(new Error('already gone'));

    await act(async () => {
      await result.current.cancel();
    });

    expect(result.current.status).toBe('cancelled');
  });

  it('cancelling before any download only flips the status', async () => {
    const { result } = renderHook(() => useDownload());

    await act(async () => {
      await result.current.cancel();
    });

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(result.current.status).toBe('cancelled');
  });

  it('reset clears every field back to idle', async () => {
    const { result } = renderHook(() => useDownload());
    await start(result);
    act(() =>
      emit('download://complete', { download_id: downloadId(), filepath: '/tmp/out/clip.mp4' }),
    );
    await waitFor(() => expect(result.current.status).toBe('complete'));

    act(() => result.current.reset());

    expect(result.current.status).toBe('idle');
    expect(result.current.progress).toBeNull();
    expect(result.current.completedPath).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('detaches its listeners on unmount', async () => {
    const { result, unmount } = renderHook(() => useDownload());
    await start(result);

    unmount();

    expect(unlisten).toHaveBeenCalled();
  });
});
