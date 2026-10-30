import { render, renderHook, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { downloadDir } from '@tauri-apps/api/path';
import App from '@/App';
import { useAppFlow } from '@/hooks/useAppFlow';
import { withHistory } from '../wrappers';

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({ readText: vi.fn() }));
vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: vi.fn(() => Promise.resolve(true)),
  requestPermission: vi.fn(() => Promise.resolve('granted')),
  sendNotification: vi.fn(),
}));
vi.mock('@tauri-apps/api/app', () => ({ getVersion: vi.fn(() => Promise.resolve('1.0.0')) }));
vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn(() => Promise.resolve(null)) }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }));

/** Bugs found by the audit that every unit test of the time missed, because they sit at the
 * junction of two functions. Each test pins the corrected behaviour. */

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);
const mockDownloadDir = vi.mocked(downloadDir);

const DIR_KEY = 'light-scrap-vidz:outputDir';
const COOKIES_KEY = 'light-scrap-vidz:cookies';

const video = {
  id: 'abc',
  title: 'A clip',
  thumbnail: '',
  duration: 60,
  uploader: 'Someone',
  webpage_url: '',
  extractor: 'youtube',
};
const playlist = { title: 'A channel', playlist_count: 2, entries: [] };

let responses: Record<string, unknown>;
let handlers: Record<string, (e: { payload: unknown }) => void>;

const callsTo = (command: string) =>
  mockInvoke.mock.calls.filter((c) => c[0] === command).map((c) => c[1] as Record<string, unknown>);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  handlers = {};
  responses = {
    detect_installed_browsers: ['chrome'],
    fetch_video_info: video,
    fetch_playlist_info: playlist,
    start_download: undefined,
    cancel_download: undefined,
    cancel_lookup: undefined,
    open_file: undefined,
    open_folder: undefined,
    check_dependencies: { ffmpeg: true, js_runtime: true },
  };
  mockInvoke.mockImplementation((command: string) =>
    command in responses
      ? Promise.resolve(responses[command])
      : Promise.reject(new Error(`unstubbed: ${command}`)),
  );
  mockListen.mockImplementation(((event: string, handler: unknown) => {
    handlers[event] = handler as (e: { payload: unknown }) => void;
    return Promise.resolve(() => {});
  }) as typeof listen);
  mockDownloadDir.mockRejectedValue(new Error('none'));
});

async function mountFlow() {
  const hook = renderHook(() => useAppFlow(), { wrapper: withHistory });
  await waitFor(() => expect(hook.result.current.detectedBrowsers).toEqual(['chrome']));
  return hook;
}

describe('B1/B2 — a YouTube channel goes to the playlist lookup', () => {
  it.each([
    'https://www.youtube.com/@chan',
    'https://www.youtube.com/@chan/',
    'https://www.youtube.com/channel/UC123',
    'https://www.youtube.com/c/chan',
    'https://www.youtube.com/user/chan',
    'https://www.youtube.com/@chan/videos',
    'https://www.youtube.com/@chan/shorts',
    'https://www.youtube.com/@chan/streams',
  ])('%s', async (typed) => {
    const { result } = await mountFlow();

    await act(() => result.current.handleFetchInfo(typed));

    expect(callsTo('fetch_video_info')).toHaveLength(0);
    expect(callsTo('fetch_playlist_info')).toHaveLength(1);
    expect(result.current.urlKind).toBe('playlist');
  });

  it('asks yt-dlp for the Videos tab of a bare channel', async () => {
    const { result } = await mountFlow();

    await act(() => result.current.handleFetchInfo('https://www.youtube.com/@chan?si=abc'));

    expect(callsTo('fetch_playlist_info')[0].url).toBe('https://www.youtube.com/@chan/videos');
  });

  it('still looks a single video up as a single video', async () => {
    const { result } = await mountFlow();

    await act(() => result.current.handleFetchInfo('https://www.youtube.com/watch?v=x'));

    expect(callsTo('fetch_video_info')).toHaveLength(1);
    expect(callsTo('fetch_playlist_info')).toHaveLength(0);
  });
});

describe('B9 — links added to the queue are normalised like the others', () => {
  it('sends a channel root to its Videos tab and as a playlist', async () => {
    localStorage.setItem(DIR_KEY, '/tmp/out');
    const { result } = await mountFlow();

    act(() => {
      result.current.handleAddToQueue(['https://www.youtube.com/@chan']);
    });

    await waitFor(() => expect(callsTo('start_download')).toHaveLength(1));
    expect(callsTo('start_download')[0]).toMatchObject({
      url: 'https://www.youtube.com/@chan/videos',
      playlistEnd: 10,
    });
  });

  it('does not make a playlist of a single video', async () => {
    localStorage.setItem(DIR_KEY, '/tmp/out');
    const { result } = await mountFlow();

    act(() => {
      result.current.handleAddToQueue(['https://youtu.be/x']);
    });

    await waitFor(() => expect(callsTo('start_download')).toHaveLength(1));
    expect(callsTo('start_download')[0].playlistEnd).toBeNull();
  });

  it('reports how many links it really added', async () => {
    localStorage.setItem(DIR_KEY, '/tmp/out');
    const { result } = await mountFlow();
    let added = 0;

    act(() => {
      added = result.current.handleAddToQueue(['https://youtu.be/x', 'https://youtu.be/x']);
    });

    expect(added).toBe(1);
  });
});

describe('B8 — "None" for the cookies is respected', () => {
  it('reads no cookies on Instagram after the user picked None, and keeps no browser for YouTube', async () => {
    const { result } = await mountFlow();
    act(() => result.current.setCookiesChoice('none'));

    await act(() => result.current.handleFetchInfo('https://www.instagram.com/p/abc/'));
    await act(() => result.current.handleFetchInfo('https://www.youtube.com/watch?v=x'));

    expect(callsTo('fetch_video_info').map((c) => c.cookiesBrowser)).toEqual([null, null]);
  });

  it('applies the automatic pick to the request only, never to the next site', async () => {
    const { result } = await mountFlow();

    await act(() => result.current.handleFetchInfo('https://www.instagram.com/p/abc/'));
    await act(() => result.current.handleFetchInfo('https://www.youtube.com/watch?v=x'));

    expect(callsTo('fetch_video_info').map((c) => c.cookiesBrowser)).toEqual(['chrome', null]);
    expect(result.current.cookiesChoice).toBe('auto');
  });

  it('reads no cookies for TikTok by default', async () => {
    const { result } = await mountFlow();

    await act(() => result.current.handleFetchInfo('https://www.tiktok.com/@u/video/1'));

    expect(callsTo('fetch_video_info')[0].cookiesBrowser).toBeNull();
  });

  it('uses the browser the user picked, everywhere', async () => {
    const { result } = await mountFlow();
    act(() => result.current.setCookiesChoice('chrome'));

    await act(() => result.current.handleFetchInfo('https://www.youtube.com/watch?v=x'));

    expect(callsTo('fetch_video_info')[0].cookiesBrowser).toBe('chrome');
  });

  it('remembers the choice across launches', async () => {
    const first = await mountFlow();
    act(() => first.result.current.setCookiesChoice('none'));
    first.unmount();

    const second = await mountFlow();

    expect(second.result.current.cookiesChoice).toBe('none');
    expect(localStorage.getItem(COOKIES_KEY)).toBe('none');
  });

  it('falls back to Auto when the stored choice is not a known browser', async () => {
    localStorage.setItem(COOKIES_KEY, 'netscape');

    const { result } = await mountFlow();

    expect(result.current.cookiesChoice).toBe('auto');
  });

  it('applies the same rule to a download started from the preview', async () => {
    localStorage.setItem(DIR_KEY, '/tmp/out');
    const { result } = await mountFlow();
    act(() => result.current.setCookiesChoice('none'));
    await act(() => result.current.handleFetchInfo('https://www.instagram.com/p/abc/'));

    await act(() => result.current.handleDownload());

    expect(callsTo('start_download')[0].cookiesBrowser).toBeNull();
  });
});

describe('F2 — preferences survive a restart', () => {
  it('remembers quality, audio-only and the playlist count', async () => {
    const first = await mountFlow();
    act(() => {
      first.result.current.setQuality('720p');
      first.result.current.setAudioOnly(true);
      first.result.current.setPlaylistEnd(0);
    });
    first.unmount();

    const second = await mountFlow();

    expect(second.result.current.quality).toBe('720p');
    expect(second.result.current.audioOnly).toBe(true);
    expect(second.result.current.playlistEnd).toBe(0);
  });

  it('ignores stored values it does not know', async () => {
    localStorage.setItem('light-scrap-vidz:quality', '4k');
    localStorage.setItem('light-scrap-vidz:playlistEnd', '7');

    const { result } = await mountFlow();

    expect(result.current.quality).toBe('best');
    expect(result.current.playlistEnd).toBe(10);
  });
});

describe('F1 — the output folder has a default', () => {
  it('offers the system Downloads folder on first launch', async () => {
    mockDownloadDir.mockResolvedValue('/home/me/Downloads');

    const { result } = await mountFlow();

    await waitFor(() => expect(result.current.outputDir).toBe('/home/me/Downloads'));
  });

  it('keeps the folder the user chose', async () => {
    localStorage.setItem(DIR_KEY, '/mnt/videos');
    mockDownloadDir.mockResolvedValue('/home/me/Downloads');

    const { result } = await mountFlow();

    expect(result.current.outputDir).toBe('/mnt/videos');
    expect(mockDownloadDir).not.toHaveBeenCalled();
  });

  it('tells the user to pick a folder when there is no default at all', async () => {
    render(<App />);
    fireEvent.change(screen.getByRole('textbox', { name: /video url/i }), {
      target: { value: 'https://youtu.be/a' },
    });
    fireEvent.keyDown(screen.getByRole('textbox', { name: /video url/i }), { key: 'Enter' });

    expect(await screen.findByText('Choose where to save the files')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download MP4/ })).toBeDisabled();
  });
});

describe('B10 — the URL box keeps its text during a new lookup', () => {
  it('still shows the link while the next lookup runs, and after it fails', async () => {
    render(<App />);
    const box = () => screen.getByRole('textbox', { name: /video url/i });
    fireEvent.change(box(), { target: { value: 'https://youtu.be/one' } });
    fireEvent.keyDown(box(), { key: 'Enter' });
    await screen.findByRole('button', { name: /Download MP4/ });

    let rejectNext: (reason: unknown) => void = () => {};
    mockInvoke.mockImplementation((command: string) =>
      command === 'fetch_video_info'
        ? new Promise((_resolve, reject) => (rejectNext = reject))
        : Promise.resolve(responses[command]),
    );
    fireEvent.change(box(), { target: { value: 'https://youtu.be/two' } });
    fireEvent.keyDown(box(), { key: 'Enter' });

    await waitFor(() => expect(box()).toBeDisabled());
    expect(box()).toHaveValue('https://youtu.be/two');

    await act(async () => rejectNext(new Error('ERROR: This video is private')));
    expect(box()).toHaveValue('https://youtu.be/two');
    expect(await screen.findByText('This video is private.')).toBeInTheDocument();
  });

  it('is emptied when the user goes back to the start', async () => {
    render(<App />);
    const box = () => screen.getByRole('textbox', { name: /video url/i });
    fireEvent.change(box(), { target: { value: 'https://youtu.be/one' } });
    fireEvent.keyDown(box(), { key: 'Enter' });
    await screen.findByRole('button', { name: /Download MP4/ });

    fireEvent.click(screen.getByLabelText('Back'));

    expect(box()).toHaveValue('');
  });
});

describe('F4 — going back abandons a running lookup', () => {
  it('tells the backend to stop it', async () => {
    mockInvoke.mockImplementation((command: string) =>
      command === 'fetch_video_info' ? new Promise(() => {}) : Promise.resolve(responses[command]),
    );
    const { result } = await mountFlow();
    act(() => {
      void result.current.handleFetchInfo('https://youtu.be/slow');
    });
    await waitFor(() => expect(result.current.isFetching).toBe(true));

    act(() => result.current.handleReset());

    expect(callsTo('cancel_lookup')).toEqual([{ kind: 'video' }]);
  });

  it('does not bother the backend when nothing is running', async () => {
    const { result } = await mountFlow();

    act(() => result.current.handleReset());

    expect(callsTo('cancel_lookup')).toHaveLength(0);
  });
});

describe('B15 — opening a file that is gone says so', () => {
  it('shows a message instead of failing silently', async () => {
    localStorage.setItem(DIR_KEY, '/tmp/out');
    render(<App />);
    const box = screen.getByRole('textbox', { name: /video url/i });
    fireEvent.change(box, { target: { value: 'https://youtu.be/a' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('button', { name: /Download MP4/ }));
    await screen.findByRole('button', { name: /Cancel/i });
    const id = (callsTo('start_download').at(-1) as { downloadId: string }).downloadId;
    act(() =>
      handlers['download://complete']({ payload: { download_id: id, filepath: '/tmp/out/a.mp4' } }),
    );
    await screen.findByLabelText('Open file');
    mockInvoke.mockImplementation((command: string) =>
      command === 'open_file'
        ? Promise.reject('File not found: /tmp/out/a.mp4')
        : Promise.resolve(undefined),
    );

    fireEvent.click(screen.getByLabelText('Open file'));

    expect(await screen.findByRole('alert')).toHaveTextContent('File not found');
  });
});

describe('S1/P1 — thumbnails never leave through the webview or the IPC', () => {
  it('draws 50 history rows without a single thumbnail call over IPC or to a remote host', async () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({
      id: `e${i}`,
      url: `https://youtu.be/${i}`,
      title: `Clip ${i}`,
      thumbnail: `https://i.ytimg.com/vi/${i}/hq.jpg`,
      platform: 'youtube',
      filepath: `/out/${i}.mp4`,
      downloaded_at: Date.now(),
      quality: 'best',
    }));
    localStorage.setItem('light-scrap-vidz:history', JSON.stringify(rows));

    const { container, unmount } = render(<App />);

    expect(container.querySelectorAll('img')).toHaveLength(50);
    for (const img of container.querySelectorAll('img')) {
      expect(img.getAttribute('src')).toMatch(/^thumb:\/\/localhost\//);
    }
    unmount();
    render(<App />);
    expect(mockInvoke.mock.calls.filter((c) => String(c[0]).includes('thumb'))).toHaveLength(0);
  });
});

describe('environment warnings', () => {
  it('warns about a missing ffmpeg before a download fails for it', async () => {
    responses.check_dependencies = { ffmpeg: false, js_runtime: true };

    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('ffmpeg was not found');
  });

  it('warns about a missing JavaScript runtime', async () => {
    responses.check_dependencies = { ffmpeg: true, js_runtime: false };

    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No JavaScript runtime');
  });

  it('says nothing when everything is there', async () => {
    render(<App />);
    await waitFor(() => expect(callsTo('check_dependencies')).toHaveLength(1));

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('lets the user dismiss a warning', async () => {
    responses.check_dependencies = { ffmpeg: false, js_runtime: true };
    render(<App />);
    await screen.findByRole('alert');

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('survives a failing check', async () => {
    delete responses.check_dependencies;

    render(<App />);
    await waitFor(() => expect(callsTo('check_dependencies')).toHaveLength(1));

    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('F7/B18 — playlists load page by page', () => {
  const entries = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => ({
      id: `v${from + i}`,
      title: `Video ${from + i}`,
      url: `https://y.tld/v${from + i}`,
    }));

  async function openChannel(count: number | null) {
    responses.fetch_playlist_info = {
      title: 'A channel',
      playlist_count: count,
      entries: entries(1, 20),
    };
    render(<App />);
    const box = screen.getByRole('textbox', { name: /video url/i });
    fireEvent.change(box, { target: { value: 'https://www.youtube.com/@chan' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await screen.findByText('Video 1');
  }

  it('shows "20+" and no number on the button when the total is unknown', async () => {
    await openChannel(null);

    expect(screen.getByText(/20\+ videos/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Number of videos to download'), {
      target: { value: '0' },
    });
    expect(screen.getByRole('button', { name: 'Download the videos' })).toBeInTheDocument();
  });

  it('shows the exact count when the platform gave one', async () => {
    await openChannel(45);

    expect(screen.getByText(/45 videos/)).toBeInTheDocument();
    expect(screen.queryByText(/45\+/)).toBeNull();
  });

  it('loads the next page on demand', async () => {
    await openChannel(45);
    responses.fetch_playlist_info = { title: 'A channel', entries: entries(21, 40) };

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Video 40')).toBeInTheDocument();
    expect(callsTo('fetch_playlist_info').at(-1)).toMatchObject({ start: 21, end: 40 });
  });
});

describe('B17 — playlist items keep their title in the history', () => {
  it('records the title of each hand-picked entry', async () => {
    localStorage.setItem(DIR_KEY, '/tmp/out');
    responses.fetch_playlist_info = {
      title: 'List',
      playlist_count: 2,
      entries: [{ id: 'a', title: 'First', url: 'https://youtu.be/a' }],
    };
    render(<App />);
    const box = screen.getByRole('textbox', { name: /video url/i });
    fireEvent.change(box, { target: { value: 'https://www.youtube.com/playlist?list=PL1' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    fireEvent.click(await screen.findByLabelText(/First/));
    fireEvent.click(screen.getByRole('button', { name: /Download 1 selected/ }));
    await waitFor(() => expect(callsTo('start_download')).toHaveLength(1));
    const id = (callsTo('start_download')[0] as { downloadId: string }).downloadId;

    act(() =>
      handlers['download://complete']({ payload: { download_id: id, filepath: '/tmp/out/a.mp4' } }),
    );

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('light-scrap-vidz:history') ?? '[]');
      expect(stored[0]).toMatchObject({ title: 'First' });
    });
  });
});
