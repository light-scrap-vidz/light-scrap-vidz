import { invoke } from '@tauri-apps/api/core';
import type { CookiesBrowser, PlaylistInfo, VideoInfo } from '@/types';

export const fetchVideoInfo = (url: string, cookiesBrowser?: CookiesBrowser): Promise<VideoInfo> =>
  invoke('fetch_video_info', { url, cookiesBrowser: cookiesBrowser ?? null });

export const fetchPlaylistInfo = (
  url: string,
  cookiesBrowser?: CookiesBrowser,
): Promise<PlaylistInfo> =>
  invoke('fetch_playlist_info', { url, cookiesBrowser: cookiesBrowser ?? null });

export const startDownload = (
  url: string,
  outputDir: string,
  quality: string,
  downloadId: string,
  playlistEnd?: number | null,
  cookiesBrowser?: CookiesBrowser,
  audioOnly?: boolean,
): Promise<void> =>
  invoke('start_download', {
    url,
    outputDir,
    quality,
    downloadId,
    playlistEnd: playlistEnd ?? null,
    cookiesBrowser: cookiesBrowser ?? null,
    audioOnly: audioOnly ?? false,
  });

export const cancelDownload = (downloadId: string): Promise<void> =>
  invoke('cancel_download', { downloadId });

export const openFolder = (path: string): Promise<void> => invoke('open_folder', { path });

export const openFile = (path: string): Promise<void> => invoke('open_file', { path });

export const updateYtDlp = (): Promise<string> => invoke('update_ytdlp');

export const fetchThumbnail = (url: string): Promise<string> =>
  invoke('fetch_thumbnail', { url });

export const detectInstalledBrowsers = (): Promise<string[]> =>
  invoke('detect_installed_browsers');

export const getInstallKind = (): Promise<'appimage' | 'deb'> =>
  invoke('install_kind');

export const downloadDebUpdate = (version: string): Promise<string> =>
  invoke('download_deb_update', { version });

export const installDebUpdate = (version: string): Promise<void> =>
  invoke('install_deb_update', { version });
