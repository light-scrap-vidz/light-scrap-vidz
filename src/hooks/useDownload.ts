import { useState, useCallback, useRef, useEffect } from 'react';
import { newId } from '@/lib/utils';
import { startDownload, cancelDownload } from '@/lib/tauri-commands';
import { parseYtdlpError } from '@/lib/error-parser';
import { trackDownload } from '@/lib/track-download';
import { sendDesktopNotification } from '@/lib/notify';
import type {
  CookiesBrowser,
  DownloadStatus,
  DownloadProgress,
  HistoryEntry,
  Quality,
  VideoInfo,
  PlaylistInfo,
} from '@/types';
import { getPlatform } from '@/lib/url-validator';
import { useHistory } from './useHistory';
import { useT } from '@/lib/locale';

interface DownloadContext {
  url: string;
  info: VideoInfo | null;
  playlistInfo: PlaylistInfo | null;
  quality: Quality;
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

export function useDownload(): UseDownloadReturn {
  const t = useT();
  const [status, setStatus] = useState<DownloadStatus>('idle');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [completedPath, setCompletedPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { addEntry } = useHistory();

  const downloadIdRef = useRef<string | null>(null);
  const stopTrackingRef = useRef<(() => void) | null>(null);
  const currentContextRef = useRef<DownloadContext | null>(null);

  const cleanup = useCallback(() => {
    stopTrackingRef.current?.();
    stopTrackingRef.current = null;
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
      currentContextRef.current = { url, info, playlistInfo, quality };
      setStatus('downloading');
      setProgress(null);
      setError(null);
      setCompletedPath(null);

      stopTrackingRef.current = await trackDownload(id, {
        onProgress: setProgress,
        onComplete: ({ filepath }) => {
          setStatus('complete');
          setCompletedPath(filepath);
          cleanup();
          void sendDesktopNotification(
            t('dl.complete'),
            filepath.split('/').at(-1) || t('dl.download'),
          );

          const ctx = currentContextRef.current;
          if (!ctx) return;
          const platform = getPlatform(ctx.url);
          // An empty title is translated when displayed, so a language switch applies to
          // entries saved earlier.
          const entry: HistoryEntry | null = ctx.playlistInfo
            ? {
                id,
                url: ctx.url,
                title: ctx.playlistInfo.title,
                thumbnail: '',
                platform,
                filepath,
                downloaded_at: Date.now(),
                quality: ctx.quality,
              }
            : ctx.info
              ? {
                  id,
                  url: ctx.url,
                  title: ctx.info.title,
                  thumbnail: ctx.info.thumbnail,
                  platform,
                  filepath,
                  downloaded_at: Date.now(),
                  quality: ctx.quality,
                }
              : null;
          if (entry) addEntry(entry);
        },
        onError: ({ message }) => {
          setStatus('error');
          setError(parseYtdlpError(message));
          cleanup();
        },
      });

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
