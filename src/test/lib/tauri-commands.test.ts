import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import * as commands from '@/lib/tauri-commands';

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
  mockInvoke.mockResolvedValue(undefined);
});

describe('tauri-commands — argument shape', () => {
  it('fetchVideoInfo defaults the browser to null', async () => {
    await commands.fetchVideoInfo('https://a');
    expect(mockInvoke).toHaveBeenCalledWith('fetch_video_info', {
      url: 'https://a',
      cookiesBrowser: null,
    });
  });

  it('fetchVideoInfo forwards an explicit browser', async () => {
    await commands.fetchVideoInfo('https://a', 'firefox');
    expect(mockInvoke).toHaveBeenCalledWith('fetch_video_info', {
      url: 'https://a',
      cookiesBrowser: 'firefox',
    });
  });

  it('fetchPlaylistInfo defaults the browser to null', async () => {
    await commands.fetchPlaylistInfo('https://list');
    expect(mockInvoke).toHaveBeenCalledWith('fetch_playlist_info', {
      url: 'https://list',
      cookiesBrowser: null,
    });
  });

  it('fetchPlaylistInfo forwards an explicit browser', async () => {
    await commands.fetchPlaylistInfo('https://list', 'chrome');
    expect(mockInvoke).toHaveBeenCalledWith('fetch_playlist_info', {
      url: 'https://list',
      cookiesBrowser: 'chrome',
    });
  });

  it('startDownload fills in defaults for the optional arguments', async () => {
    await commands.startDownload('https://a', '/out', 'best', 'id-1');
    expect(mockInvoke).toHaveBeenCalledWith('start_download', {
      url: 'https://a',
      outputDir: '/out',
      quality: 'best',
      downloadId: 'id-1',
      playlistEnd: null,
      cookiesBrowser: null,
      audioOnly: false,
    });
  });

  it('startDownload forwards every optional argument when given', async () => {
    await commands.startDownload('https://a', '/out', '720p', 'id-2', 5, 'chromium', true);
    expect(mockInvoke).toHaveBeenCalledWith('start_download', {
      url: 'https://a',
      outputDir: '/out',
      quality: '720p',
      downloadId: 'id-2',
      playlistEnd: 5,
      cookiesBrowser: 'chromium',
      audioOnly: true,
    });
  });

  it.each([
    ['cancelDownload', () => commands.cancelDownload('id-3'), 'cancel_download', { downloadId: 'id-3' }],
    ['openFolder', () => commands.openFolder('/out'), 'open_folder', { path: '/out' }],
    ['openFile', () => commands.openFile('/out/f.mp4'), 'open_file', { path: '/out/f.mp4' }],
    ['fetchThumbnail', () => commands.fetchThumbnail('https://img'), 'fetch_thumbnail', { url: 'https://img' }],
    ['downloadDebUpdate', () => commands.downloadDebUpdate('1.2.3'), 'download_deb_update', { version: '1.2.3' }],
    ['installDebUpdate', () => commands.installDebUpdate('1.2.3'), 'install_deb_update', { version: '1.2.3' }],
  ])('%s passes its payload through', async (_name, call, command, payload) => {
    await call();
    expect(mockInvoke).toHaveBeenCalledWith(command, payload);
  });

  it.each([
    ['updateYtDlp', () => commands.updateYtDlp(), 'update_ytdlp'],
    ['detectInstalledBrowsers', () => commands.detectInstalledBrowsers(), 'detect_installed_browsers'],
    ['getInstallKind', () => commands.getInstallKind(), 'install_kind'],
  ])('%s takes no payload', async (_name, call, command) => {
    await call();
    expect(mockInvoke).toHaveBeenCalledWith(command);
  });
});

describe('tauri-commands — results', () => {
  it('returns whatever the backend resolves with', async () => {
    mockInvoke.mockResolvedValueOnce(['firefox', 'chrome']);
    await expect(commands.detectInstalledBrowsers()).resolves.toEqual(['firefox', 'chrome']);
  });

  it('propagates backend rejections to the caller', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('backend exploded'));
    await expect(commands.updateYtDlp()).rejects.toThrow('backend exploded');
  });
});
