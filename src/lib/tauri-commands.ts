import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import type { CookiesBrowser, DependencyStatus, PlaylistInfo, VideoInfo } from '@/types';

export const fetchVideoInfo = (url: string, cookiesBrowser?: CookiesBrowser): Promise<VideoInfo> =>
  invoke('fetch_video_info', { url, cookiesBrowser: cookiesBrowser ?? null });

export const fetchPlaylistInfo = (
  url: string,
  cookiesBrowser?: CookiesBrowser,
  start?: number,
  end?: number,
): Promise<PlaylistInfo> =>
  invoke('fetch_playlist_info', {
    url,
    cookiesBrowser: cookiesBrowser ?? null,
    start: start ?? null,
    end: end ?? null,
  });

/** Abandonne la recherche en cours (« video » ou « playlist »). */
export const cancelLookup = (kind: 'video' | 'playlist'): Promise<void> =>
  invoke('cancel_lookup', { kind });

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

/** `updated` ou `up-to-date` : l'interface traduit, le backend ne renvoie pas de phrase. */
export const updateYtDlp = (): Promise<'updated' | 'up-to-date'> => invoke('update_ytdlp');

/** URL du schéma `thumb://` qui sert la vignette de `remoteUrl` : le backend la télécharge
 * (et la met en cache) ; la webview ne contacte jamais l'hôte distant. */
export const thumbnailUrl = (remoteUrl: string): string => convertFileSrc(remoteUrl, 'thumb');

export const detectInstalledBrowsers = (): Promise<string[]> => invoke('detect_installed_browsers');

export const checkDependencies = (): Promise<DependencyStatus> => invoke('check_dependencies');

/** The app's changelog at a release tag, in `lang` (the update banner shows what is new). */
export const releaseNotes = (lang: string, version: string): Promise<string> =>
  invoke('release_notes', { lang, version });
