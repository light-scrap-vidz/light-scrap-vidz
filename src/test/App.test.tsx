import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import App from '@/App';

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({ readText: vi.fn() }));
vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: vi.fn(() => Promise.resolve(true)),
  requestPermission: vi.fn(() => Promise.resolve('granted')),
  sendNotification: vi.fn(),
}));
vi.mock('@tauri-apps/api/app', () => ({ getVersion: vi.fn(() => Promise.resolve('0.2.14')) }));
vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn(() => Promise.resolve(null)) }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }));

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);

const HISTORY_KEY = 'light-scrap-vidz:history';
const DIR_KEY = 'light-scrap-vidz:outputDir';

const videoInfo = {
  id: 'abc',
  title: 'A clip',
  thumbnail: '',
  duration: 212,
  uploader: 'Someone',
  webpage_url: 'https://www.youtube.com/watch?v=abc',
  extractor: 'youtube',
  formats: [],
};

const playlistInfo = {
  title: 'A playlist',
  playlist_count: 2,
  entries: [
    { url: 'https://youtu.be/a', title: 'First' },
    { url: 'https://youtu.be/b', title: 'Second' },
  ],
};

let responses: Record<string, unknown>;
let handlers: Record<string, (e: { payload: unknown }) => void>;

function emit(event: string, payload: unknown) {
  handlers[event]?.({ payload });
}

function downloadId(): string {
  const call = mockInvoke.mock.calls.filter((c) => c[0] === 'start_download').at(-1);
  return (call?.[1] as { downloadId: string }).downloadId;
}

const urlBox = () => screen.getByRole('textbox', { name: /video url/i });

/** Types a URL and waits for the fetched view. */
async function fetchUrl(url = 'https://www.youtube.com/watch?v=abc') {
  fireEvent.change(urlBox(), { target: { value: url } });
  fireEvent.keyDown(urlBox(), { key: 'Enter' });
  await screen.findByRole('button', { name: /Download/ });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  handlers = {};
  responses = {
    detect_installed_browsers: ['firefox'],
    fetch_video_info: videoInfo,
    fetch_playlist_info: playlistInfo,
    start_download: undefined,
    cancel_download: undefined,
    open_file: undefined,
    open_folder: undefined,
    install_kind: 'deb',
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
});

describe('App — home view', () => {
  it('starts on the URL form with the platform chips', async () => {
    render(<App />);
    expect(urlBox()).toBeInTheDocument();
    expect(screen.getByText('Supports:')).toBeInTheDocument();
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('detect_installed_browsers'));
  });

  it('asks the backend which browsers are installed', async () => {
    render(<App />);
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('detect_installed_browsers'));
  });

  it('survives a failure to detect browsers', async () => {
    mockInvoke.mockImplementation((command: string) =>
      command === 'detect_installed_browsers'
        ? Promise.reject(new Error('no browsers'))
        : Promise.resolve(responses[command]),
    );
    render(<App />);
    await act(async () => {});
    expect(urlBox()).toBeInTheDocument();
  });

  it('shows an empty history by default', async () => {
    render(<App />);
    expect(screen.getByText('No downloads yet')).toBeInTheDocument();
    await act(async () => {});
  });

  it('lists a stored history entry', async () => {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([
        {
          id: '1',
          url: 'https://youtu.be/a',
          title: 'Old clip',
          thumbnail: '',
          platform: 'youtube',
          filepath: '/out/old.mp4',
          downloaded_at: Date.now(),
          quality: 'best',
        },
      ]),
    );
    render(<App />);
    expect(screen.getByText('Old clip')).toBeInTheDocument();
    await act(async () => {});
  });

  it('switches between the Recent and Queue tabs', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Queue/ }));
    expect(
      screen.getByPlaceholderText('Paste one or more links, one per line…'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Recent/ }));
    expect(screen.getByText('No downloads yet')).toBeInTheDocument();
    await act(async () => {});
  });

  it('clears the history from the Recent tab', async () => {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([
        {
          id: '1',
          url: 'https://youtu.be/a',
          title: 'Old clip',
          thumbnail: '',
          platform: 'youtube',
          filepath: '/out/old.mp4',
          downloaded_at: Date.now(),
          quality: 'best',
        },
      ]),
    );
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Clear/i }));

    expect(screen.getByText('No downloads yet')).toBeInTheDocument();
    await act(async () => {});
  });

  it('reports a failed lookup', async () => {
    mockInvoke.mockImplementation((command: string) =>
      command === 'fetch_video_info'
        ? Promise.reject(new Error('video is private'))
        : Promise.resolve(responses[command]),
    );
    render(<App />);

    fireEvent.change(urlBox(), { target: { value: 'https://youtu.be/a' } });
    fireEvent.keyDown(urlBox(), { key: 'Enter' });

    expect(await screen.findByText('video is private')).toBeInTheDocument();
  });

  it('re-fetches when a history row is clicked', async () => {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([
        {
          id: '1',
          url: 'https://www.youtube.com/watch?v=abc',
          title: 'Old clip',
          thumbnail: '',
          platform: 'youtube',
          filepath: '/out/old.mp4',
          downloaded_at: Date.now(),
          quality: 'best',
        },
      ]),
    );
    render(<App />);

    fireEvent.click(screen.getByText('Old clip'));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('fetch_video_info', {
        url: 'https://www.youtube.com/watch?v=abc',
        cookiesBrowser: null,
      }),
    );
  });
});

describe('App — fetched view, single video', () => {
  it('previews the video and offers the download controls', async () => {
    render(<App />);
    await fetchUrl();

    expect(screen.getByRole('heading', { name: 'A clip' })).toBeInTheDocument();
    expect(screen.getByText('Format')).toBeInTheDocument();
    expect(screen.getByText('Save to')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download MP4/ })).toBeInTheDocument();
  });

  it('offers only the detected browsers for sign-in', async () => {
    render(<App />);
    await fetchUrl();

    expect(screen.getByRole('button', { name: 'Firefox' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chrome' })).not.toBeInTheDocument();
  });

  it('switches the button wording when audio-only is picked', async () => {
    render(<App />);
    await fetchUrl();

    fireEvent.click(screen.getByRole('button', { name: 'Audio · MP3' }));

    expect(screen.getByRole('button', { name: /Extract MP3/ })).toBeInTheDocument();
  });

  it('refuses to start without an output folder', async () => {
    render(<App />);
    await fetchUrl();

    fireEvent.click(screen.getByRole('button', { name: /Download MP4/ }));
    await act(async () => {});

    expect(mockInvoke).not.toHaveBeenCalledWith('start_download', expect.anything());
  });

  it('starts the download once a folder is remembered', async () => {
    localStorage.setItem(DIR_KEY, '/home/me/Videos');
    render(<App />);
    await fetchUrl();

    fireEvent.click(screen.getByRole('button', { name: /Download MP4/ }));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        'start_download',
        expect.objectContaining({ outputDir: '/home/me/Videos', quality: 'best' }),
      ),
    );
  });

  it('goes back home from the back button', async () => {
    render(<App />);
    await fetchUrl();

    fireEvent.click(screen.getByLabelText('Back'));

    expect(await screen.findByText('Supports:')).toBeInTheDocument();
  });
});

describe('App — fetched view, playlist', () => {
  const LIST = 'https://www.youtube.com/playlist?list=PL1';

  it('previews the playlist and its entries', async () => {
    render(<App />);
    fireEvent.change(urlBox(), { target: { value: LIST } });
    fireEvent.keyDown(urlBox(), { key: 'Enter' });

    expect(await screen.findByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(mockInvoke).toHaveBeenCalledWith('fetch_playlist_info', {
      url: LIST,
      cookiesBrowser: null,
    });
  });

  it('offers a count selector while nothing is hand-picked', async () => {
    render(<App />);
    fireEvent.change(urlBox(), { target: { value: LIST } });
    fireEvent.keyDown(urlBox(), { key: 'Enter' });
    await screen.findByText('First');

    expect(screen.getByLabelText('Number of videos to download')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download 2 videos/ })).toBeInTheDocument();
  });

  it('queues the hand-picked entries instead of downloading straight away', async () => {
    localStorage.setItem(DIR_KEY, '/home/me/Videos');
    render(<App />);
    fireEvent.change(urlBox(), { target: { value: LIST } });
    fireEvent.keyDown(urlBox(), { key: 'Enter' });
    await screen.findByText('First');

    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(await screen.findByRole('button', { name: /Download 1 selected/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Download 1 selected/ }));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        'start_download',
        expect.objectContaining({ url: 'https://youtu.be/a' }),
      ),
    );
  });

  it('honours the chosen count for a whole-playlist download', async () => {
    localStorage.setItem(DIR_KEY, '/home/me/Videos');
    render(<App />);
    fireEvent.change(urlBox(), { target: { value: LIST } });
    fireEvent.keyDown(urlBox(), { key: 'Enter' });
    await screen.findByText('First');

    fireEvent.change(screen.getByLabelText('Number of videos to download'), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Download 2 videos/ }));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        'start_download',
        expect.objectContaining({ playlistEnd: 5 }),
      ),
    );
  });
});

describe('App — downloading view', () => {
  async function startDownload() {
    localStorage.setItem(DIR_KEY, '/home/me/Videos');
    render(<App />);
    await fetchUrl();
    fireEvent.click(screen.getByRole('button', { name: /Download MP4/ }));
    await screen.findByRole('button', { name: /Cancel/i });
  }

  it('shows progress and a cancel button', async () => {
    await startDownload();

    act(() =>
      emit('download://progress', {
        download_id: downloadId(),
        percent: 42,
        speed: '1MiB/s',
        eta: '10s',
      }),
    );

    await waitFor(() => expect(screen.getByText(/42/)).toBeInTheDocument());
  });

  it('cancels on demand', async () => {
    await startDownload();

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('cancel_download', { downloadId: downloadId() }),
    );
  });

  it('locks the back button while downloading', async () => {
    await startDownload();
    expect(screen.getByLabelText('Back')).toBeDisabled();
  });

  it('drops back to the fetched view when the download fails', async () => {
    await startDownload();

    act(() =>
      emit('download://error', {
        download_id: downloadId(),
        message: 'ERROR: This video is private',
      }),
    );

    // The download button comes back, so the user can retry.
    expect(await screen.findByRole('button', { name: /Download MP4/ })).toBeInTheDocument();
  });

  it('surfaces no reason at all when the download fails', async () => {
    await startDownload();

    act(() =>
      emit('download://error', {
        download_id: downloadId(),
        message: 'ERROR: This video is private',
      }),
    );
    await screen.findByRole('button', { name: /Download MP4/ });

    // `useDownload` parses the message and App passes it to ProgressCard as `error`,
    // but ProgressCard never renders that prop and only shows itself while downloading,
    // so the failure reason is lost on the way to the screen.
    expect(screen.queryByText(/This video is private/)).not.toBeInTheDocument();
  });
});

describe('App — complete view', () => {
  async function completeDownload() {
    localStorage.setItem(DIR_KEY, '/home/me/Videos');
    render(<App />);
    await fetchUrl();
    fireEvent.click(screen.getByRole('button', { name: /Download MP4/ }));
    await screen.findByRole('button', { name: /Cancel/i });
    act(() =>
      emit('download://complete', {
        download_id: downloadId(),
        filepath: '/home/me/Videos/clip.mp4',
      }),
    );
    await screen.findByLabelText('Open file');
  }

  it('shows the produced file', async () => {
    await completeDownload();
    expect(screen.getByText(/clip\.mp4/)).toBeInTheDocument();
  });

  it('opens the file', async () => {
    await completeDownload();

    fireEvent.click(screen.getByLabelText('Open file'));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('open_file', {
        path: '/home/me/Videos/clip.mp4',
      }),
    );
  });

  it('reveals the file in its folder', async () => {
    await completeDownload();

    fireEvent.click(screen.getByLabelText('Reveal in folder'));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('open_folder', {
        path: '/home/me/Videos/clip.mp4',
      }),
    );
  });

  it('records the download in the history', async () => {
    await completeDownload();

    const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    expect(stored[0]).toMatchObject({ title: 'A clip', platform: 'youtube' });
  });

  it('returns home for another download', async () => {
    await completeDownload();

    fireEvent.click(screen.getByLabelText('Back'));

    expect(await screen.findByText('Supports:')).toBeInTheDocument();
  });
});

describe('App — settings sheet', () => {
  it('opens and closes', async () => {
    render(<App />);

    fireEvent.click(screen.getByLabelText('Settings'));
    expect(await screen.findByText('Settings')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close settings'));
    await waitFor(() => expect(screen.queryByLabelText('Close settings')).not.toBeInTheDocument());
  });

  it('remembers a folder chosen from the sheet', async () => {
    const { open } = await import('@tauri-apps/plugin-dialog');
    vi.mocked(open).mockResolvedValue('/home/me/Elsewhere');
    render(<App />);
    fireEvent.click(screen.getByLabelText('Settings'));
    await screen.findByText('Settings');

    fireEvent.click(screen.getByText('Choose folder…'));

    await waitFor(() => expect(localStorage.getItem(DIR_KEY)).toBe('/home/me/Elsewhere'));
  });
});

describe('App — queue tab', () => {
  it('adds pasted links and starts working through them', async () => {
    localStorage.setItem(DIR_KEY, '/home/me/Videos');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Queue/ }));

    const box = screen.getByPlaceholderText('Paste one or more links, one per line…');
    fireEvent.change(box, { target: { value: 'https://youtu.be/a\nhttps://youtu.be/b' } });
    fireEvent.click(screen.getByRole('button', { name: /Add to queue/ }));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        'start_download',
        expect.objectContaining({ url: 'https://youtu.be/a' }),
      ),
    );
    const queue = screen.getByPlaceholderText('Paste one or more links, one per line…')
      .parentElement!;
    expect(within(queue).getByText('https://youtu.be/b')).toBeInTheDocument();
  });

  it('shows a pending badge on the queue tab', async () => {
    localStorage.setItem(DIR_KEY, '/home/me/Videos');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Queue/ }));

    fireEvent.change(screen.getByPlaceholderText('Paste one or more links, one per line…'), {
      target: { value: 'https://youtu.be/a\nhttps://youtu.be/b\nhttps://youtu.be/c' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Add to queue/ }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Queue/ })).toHaveTextContent(/[12]/),
    );
  });
});

describe('App — retour visuel au survol', () => {
  /** Survole `el` puis le quitte, en relevant `property` à chaque étape. */
  function hoverCycle(el: HTMLElement, property: 'color' | 'background' | 'transform' | 'borderColor') {
    fireEvent.mouseEnter(el);
    const during = el.style[property];
    fireEvent.mouseLeave(el);
    return { during, after: el.style[property] };
  }

  it('éclaire le bouton retour puis le rend', async () => {
    render(<App />);
    await fetchUrl();

    const { during, after } = hoverCycle(screen.getByLabelText('Back'), 'color');

    expect(during).toBe('rgb(214, 209, 200)');
    expect(after).toBe('rgb(133, 127, 117)');
  });

  it('éclaire le bouton réglages puis le rend', async () => {
    render(<App />);
    await screen.findByLabelText('Settings');

    const { during, after } = hoverCycle(screen.getByLabelText('Settings'), 'background');

    expect(during).toBe('rgb(33, 31, 27)');
    expect(after).toBe('transparent');
  });

  it('éclaire « Clear all » de l’historique puis le rend', async () => {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([
        {
          id: 'h1',
          url: 'https://youtu.be/x',
          title: 'Déjà vu',
          thumbnail: '',
          platform: 'youtube',
          filepath: '/home/me/Videos/x.mp4',
          downloaded_at: Date.now(),
          quality: 'best',
        },
      ]),
    );
    render(<App />);

    const { during, after } = hoverCycle(await screen.findByText('Clear all'), 'color');

    expect(during).toBe('rgb(163, 157, 147)');
    expect(after).toBe('rgb(111, 105, 96)');
  });

  it('éclaire l’annulation du téléchargement puis la rend', async () => {
    localStorage.setItem(DIR_KEY, '/home/me/Videos');
    render(<App />);
    await fetchUrl();
    fireEvent.click(screen.getByRole('button', { name: /Download MP4/ }));

    const cancel = await screen.findByRole('button', { name: /Cancel download/i });
    const { during, after } = hoverCycle(cancel, 'color');

    expect(during).toBe('rgb(255, 138, 138)');
    expect(after).toBe('rgb(194, 188, 178)');
  });

  it('soulève « Download another » puis le repose', async () => {
    localStorage.setItem(DIR_KEY, '/home/me/Videos');
    render(<App />);
    await fetchUrl();
    fireEvent.click(screen.getByRole('button', { name: /Download MP4/ }));
    await screen.findByRole('button', { name: /Cancel/i });
    act(() =>
      emit('download://complete', {
        download_id: downloadId(),
        filepath: '/home/me/Videos/clip.mp4',
      }),
    );

    const again = await screen.findByRole('button', { name: 'Download another' });
    const { during, after } = hoverCycle(again, 'transform');

    expect(during).toBe('translateY(-1px)');
    expect(after).toBe('none');
  });
})
