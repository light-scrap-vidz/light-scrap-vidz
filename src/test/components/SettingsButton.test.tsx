import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { getVersion } from '@tauri-apps/api/app';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { SettingsButton } from '@/components/SettingsButton';

vi.mock('@tauri-apps/api/app', () => ({ getVersion: vi.fn() }));
vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn() }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }));

const mockInvoke = vi.mocked(invoke);
const mockOpen = vi.mocked(open);
const mockGetVersion = vi.mocked(getVersion);
const mockCheck = vi.mocked(check);
const mockRelaunch = vi.mocked(relaunch);

/** Per-command backend responses. */
let responses: Record<string, unknown>;

function setup(props: Partial<Parameters<typeof SettingsButton>[0]> = {}) {
  const onClose = vi.fn();
  const onOutputDirChange = vi.fn();
  const onCookiesBrowserChange = vi.fn();
  const view = render(
    <SettingsButton
      open
      onClose={onClose}
      outputDir="/home/me/Videos"
      onOutputDirChange={onOutputDirChange}
      cookiesBrowser={null}
      onCookiesBrowserChange={onCookiesBrowserChange}
      detectedBrowsers={['firefox']}
      {...props}
    />,
  );
  return { onClose, onOutputDirChange, onCookiesBrowserChange, ...view };
}

const updateButton = () =>
  screen.getByRole('button', {
    name: /Check for updates|Checking…|Downloading|Installing…|Up to date|Retry|Update/,
  });

beforeEach(() => {
  vi.clearAllMocks();
  responses = { install_kind: 'deb', update_ytdlp: 'ok', download_deb_update: '/tmp/u.deb', install_deb_update: undefined };
  mockInvoke.mockImplementation((command: string) =>
    command in responses
      ? Promise.resolve(responses[command])
      : Promise.reject(new Error(`unstubbed: ${command}`)),
  );
  mockGetVersion.mockResolvedValue('0.2.14');
  mockCheck.mockResolvedValue(null);
  mockOpen.mockResolvedValue(null);
});

describe('SettingsButton — visibility', () => {
  it('renders nothing while closed', () => {
    const { container } = setup({ open: false });
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the panel when open', async () => {
    setup();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    await waitFor(() => expect(mockGetVersion).toHaveBeenCalled());
  });

  it('closes from the close button', async () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByLabelText('Close settings'));
    expect(onClose).toHaveBeenCalled();
    await waitFor(() => expect(mockGetVersion).toHaveBeenCalled());
  });

  it('closes when the overlay is clicked', async () => {
    const { onClose, container } = setup();
    const overlay = container.querySelector('div[style*="rgba(0, 0, 0, 0.55)"]');
    fireEvent.click(overlay!);
    expect(onClose).toHaveBeenCalled();
    await waitFor(() => expect(mockGetVersion).toHaveBeenCalled());
  });
});

describe('SettingsButton — app info', () => {
  it('shows the app version once loaded', async () => {
    setup();
    expect(await screen.findByText('v0.2.14')).toBeInTheDocument();
  });

  it('shows a placeholder when the version cannot be read', async () => {
    mockGetVersion.mockRejectedValue(new Error('no tauri'));
    setup();
    expect(await screen.findByText('…')).toBeInTheDocument();
  });

  it('assumes a deb install when the install kind cannot be read', async () => {
    responses = { ...responses };
    delete responses.install_kind;
    setup();
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('install_kind'));
  });
});

describe('SettingsButton — output folder', () => {
  it('shows the current folder', async () => {
    setup();
    expect(screen.getByText('/home/me/Videos')).toBeInTheDocument();
    await waitFor(() => expect(mockGetVersion).toHaveBeenCalled());
  });

  it('reports a newly picked folder', async () => {
    mockOpen.mockResolvedValue('/home/me/Downloads');
    const { onOutputDirChange } = setup();

    fireEvent.click(screen.getByText('/home/me/Videos'));

    await waitFor(() => expect(onOutputDirChange).toHaveBeenCalledWith('/home/me/Downloads'));
  });

  it('reports nothing when the folder dialog is dismissed', async () => {
    const { onOutputDirChange } = setup();

    fireEvent.click(screen.getByText('/home/me/Videos'));
    await waitFor(() => expect(mockOpen).toHaveBeenCalled());

    expect(onOutputDirChange).not.toHaveBeenCalled();
  });
});

describe('SettingsButton — notification toggle', () => {
  it('starts on and flips when clicked', async () => {
    setup();
    const toggle = screen.getByLabelText('Toggle notification');
    expect(toggle).toHaveStyle({ background: '#C9F25E' });

    fireEvent.click(toggle);

    expect(toggle).toHaveStyle({ background: '#211F1B' });
    await waitFor(() => expect(mockGetVersion).toHaveBeenCalled());
  });
});

describe('SettingsButton — browser cookies', () => {
  it('offers only the detected browsers', async () => {
    setup();
    expect(screen.getByRole('button', { name: 'Firefox' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chrome' })).not.toBeInTheDocument();
    await waitFor(() => expect(mockGetVersion).toHaveBeenCalled());
  });

  it('reports the picked browser', async () => {
    const { onCookiesBrowserChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Firefox' }));
    expect(onCookiesBrowserChange).toHaveBeenCalledWith('firefox');
    await waitFor(() => expect(mockGetVersion).toHaveBeenCalled());
  });
});

describe('SettingsButton — update check', () => {
  it('reports being up to date and refreshes yt-dlp on the way', async () => {
    setup();

    fireEvent.click(updateButton());

    expect(await screen.findByText('Up to date ✓')).toBeInTheDocument();
    expect(mockInvoke).toHaveBeenCalledWith('update_ytdlp');
    expect(await screen.findByText('yt-dlp up to date')).toBeInTheDocument();
  });

  it('reports a failed yt-dlp refresh without blocking the check', async () => {
    responses.update_ytdlp = undefined;
    mockInvoke.mockImplementation((command: string) =>
      command === 'update_ytdlp'
        ? Promise.reject(new Error('network'))
        : Promise.resolve(responses[command]),
    );
    setup();

    fireEvent.click(updateButton());

    expect(await screen.findByText('yt-dlp update failed')).toBeInTheDocument();
    expect(await screen.findByText('Up to date ✓')).toBeInTheDocument();
  });

  it('downloads and installs a deb update, then relaunches', async () => {
    mockCheck.mockResolvedValue({ available: true, version: '0.3.0' } as never);
    setup();
    await screen.findByText('v0.2.14');

    fireEvent.click(updateButton());

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('download_deb_update', { version: '0.3.0' }),
    );
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('install_deb_update', { version: '0.3.0' }),
    );
    await waitFor(() => expect(mockRelaunch).toHaveBeenCalled());
  });

  it('installs an AppImage update in place, tracking progress', async () => {
    responses.install_kind = 'appimage';
    const downloadAndInstall = vi.fn(
      async (onEvent: (e: Record<string, unknown>) => void) => {
        onEvent({ event: 'Started', data: { contentLength: 200 } });
        onEvent({ event: 'Progress', data: { chunkLength: 100 } });
        onEvent({ event: 'Finished', data: {} });
      },
    );
    mockCheck.mockResolvedValue({ available: true, version: '0.3.0', downloadAndInstall } as never);
    setup();
    await screen.findByText('v0.2.14');

    fireEvent.click(updateButton());

    await waitFor(() => expect(downloadAndInstall).toHaveBeenCalled());
    await waitFor(() => expect(mockRelaunch).toHaveBeenCalled());
    expect(mockInvoke).not.toHaveBeenCalledWith('download_deb_update', expect.anything());
  });

  it('leaves progress at zero when the download reports no total size', async () => {
    responses.install_kind = 'appimage';
    const downloadAndInstall = vi.fn(
      async (onEvent: (e: Record<string, unknown>) => void) => {
        onEvent({ event: 'Started', data: {} });
        onEvent({ event: 'Progress', data: { chunkLength: 50 } });
      },
    );
    mockCheck.mockResolvedValue({ available: true, version: '0.3.0', downloadAndInstall } as never);
    setup();
    await screen.findByText('v0.2.14');

    fireEvent.click(updateButton());

    await waitFor(() => expect(mockRelaunch).toHaveBeenCalled());
  });

  it('offers a retry and the reason when the check fails', async () => {
    mockCheck.mockRejectedValue(new Error('update server unreachable'));
    setup();

    fireEvent.click(updateButton());

    expect(await screen.findByText('Retry')).toBeInTheDocument();
    expect(screen.getByText('update server unreachable')).toBeInTheDocument();
  });

  it('stringifies a non-Error failure', async () => {
    mockCheck.mockRejectedValue('plain failure');
    setup();

    fireEvent.click(updateButton());

    expect(await screen.findByText('plain failure')).toBeInTheDocument();
  });

  it('ignores extra clicks while an update is in flight', async () => {
    mockCheck.mockImplementation(() => new Promise(() => {}));
    setup();

    fireEvent.click(updateButton());
    await screen.findByText('Checking…');
    fireEvent.click(updateButton());

    await waitFor(() => expect(mockCheck).toHaveBeenCalledTimes(1));
  });

  it('treats an update object that is not available as up to date', async () => {
    mockCheck.mockResolvedValue({ available: false } as never);
    setup();

    fireEvent.click(updateButton());

    expect(await screen.findByText('Up to date ✓')).toBeInTheDocument();
  });
});
