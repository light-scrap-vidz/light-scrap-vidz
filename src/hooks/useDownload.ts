import { useState, useCallback, useRef, useEffect } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { newId } from '@/lib/utils';
import { startDownload, cancelDownload } from '@/lib/tauri-commands';
import { parseYtdlpError } from '@/lib/error-parser';
import { EVENT_COMPLETE, EVENT_ERROR, EVENT_PROGRESS } from '@/lib/events';
import type {
  CookiesBrowser,
  DownloadStatus,
  DownloadProgress,
  DownloadComplete,
  HistoryEntry,
  Quality,
  VideoInfo,
  PlaylistInfo,
} from '@/types';
import { getPlatform } from '@/lib/url-validator';
import { useHistory } from './useHistory';
import { useT } from '@/lib/locale';
import { loadNotify } from '@/lib/notify';

interface DownloadContext {
  url: string;
  info: VideoInfo | null;
  playlistInfo: PlaylistInfo | null;
  quality: Quality;
  playlistEnd: number | null;
  cookiesBrowser: CookiesBrowser;
  audioOnly: boolean;
}

interface UseDownloadReturn {
  status: DownloadStatus;
  progress: DownloadProgress | null;
  completedPath: string | null;
  error: string | null;
  download: (
    url: string,
    outputDir: string,
    quality: Quality,
    info: VideoInfo | null,
    playlistInfo: PlaylistInfo | null,
    playlistEnd: number | null,
    cookiesBrowser: CookiesBrowser,
    audioOnly: boolean,
  ) => Promise<void>;
  cancel: () => Promise<void>;
  reset: () => void;
}

async function sendDesktopNotification(filepath: string, title: string) {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === 'granted';
    }
    if (granted) {
      const filename = filepath.split('/').at(-1) ?? 'file';
      sendNotification({ title, body: filename });
    }
  } catch {
    // notifications not critical
  }
}

export function useDownload(): UseDownloadReturn {
  const t = useT();
  const [status, setStatus] = useState<DownloadStatus>('idle');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [completedPath, setCompletedPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { addEntry } = useHistory();

  const downloadIdRef = useRef<string | null>(null);
  const unlistenRefs = useRef<UnlistenFn[]>([]);
  const currentContextRef = useRef<DownloadContext | null>(null);

  const cleanup = useCallback(() => {
    unlistenRefs.current.forEach((fn) => fn());
    unlistenRefs.current = [];
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const download = useCallback(
    async (
      url: string,
      outputDir: string,
      quality: Quality,
      info: VideoInfo | null,
      playlistInfo: PlaylistInfo | null,
      playlistEnd: number | null,
      cookiesBrowser: CookiesBrowser,
      audioOnly: boolean,
    ) => {
      cleanup();
      const id = newId();
      downloadIdRef.current = id;
      currentContextRef.current = {
        url,
        info,
        playlistInfo,
        quality,
        playlistEnd,
        cookiesBrowser,
        audioOnly,
      };
      setStatus('downloading');
      setProgress(null);
      setError(null);
      setCompletedPath(null);

      const unlistenProgress = await listen<DownloadProgress>(EVENT_PROGRESS, (event) => {
        if (event.payload.download_id === id) {
          setProgress(event.payload);
        }
      });

      const unlistenComplete = await listen<DownloadComplete>(EVENT_COMPLETE, (event) => {
        if (event.payload.download_id === id) {
          setStatus('complete');
          setCompletedPath(event.payload.filepath);
          cleanup();
          if (loadNotify()) void sendDesktopNotification(event.payload.filepath, t('dl.complete'));

          if (currentContextRef.current) {
            const ctx = currentContextRef.current;
            const platform = getPlatform(ctx.url);

            if (ctx.playlistInfo) {
              const entry: HistoryEntry = {
                id,
                url: ctx.url,
                title: ctx.playlistInfo.title || 'Playlist',
                thumbnail: '',
                platform,
                filepath: event.payload.filepath,
                downloaded_at: Date.now(),
                quality: ctx.quality,
              };
              addEntry(entry);
            } else if (ctx.info) {
              const entry: HistoryEntry = {
                id,
                url: ctx.url,
                title: ctx.info.title,
                thumbnail: ctx.info.thumbnail,
                platform,
                filepath: event.payload.filepath,
                downloaded_at: Date.now(),
                quality: ctx.quality,
              };
              addEntry(entry);
            }
          }
        }
      });

      const unlistenError = await listen<{ download_id: string; message: string }>(
        EVENT_ERROR,
        (event) => {
          if (event.payload.download_id === id) {
            setStatus('error');
            setError(parseYtdlpError(event.payload.message));
            cleanup();
          }
        },
      );

      unlistenRefs.current = [unlistenProgress, unlistenComplete, unlistenError];

      try {
        await startDownload(url, outputDir, quality, id, playlistEnd, cookiesBrowser, audioOnly);
      } catch (err) {
        setStatus('error');
        setError(parseYtdlpError(err instanceof Error ? err.message : String(err)));
        cleanup();
      }
    },
    [cleanup, addEntry, t],
  );

  const cancel = useCallback(async () => {
    if (downloadIdRef.current) {
      try {
        await cancelDownload(downloadIdRef.current);
      } catch {
        // ignore
      }
    }
    setStatus('cancelled');
    cleanup();
  }, [cleanup]);

  const reset = useCallback(() => {
    setStatus('idle');
    setProgress(null);
    setCompletedPath(null);
    setError(null);
    downloadIdRef.current = null;
    currentContextRef.current = null;
    cleanup();
  }, [cleanup]);

  return { status, progress, completedPath, error, download, cancel, reset };
}
