import { useState, useCallback, useRef, useEffect } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { newId } from '@/lib/utils';
import { startDownload, cancelDownload } from '@/lib/tauri-commands';
import { parseYtdlpError } from '@/lib/error-parser';
import { EVENT_COMPLETE, EVENT_ERROR, EVENT_PROGRESS } from '@/lib/events';
import { getPlatform } from '@/lib/url-validator';
import { loadQueue, saveQueue } from '@/lib/queue-store';
import { useHistory } from './useHistory';
import type { DownloadComplete, DownloadProgress, QueueItem } from '@/types';

type QueueConfig = Omit<QueueItem, 'id' | 'status' | 'error' | 'progress'>;

interface UseQueueReturn {
  items: QueueItem[];
  isActive: boolean;
  addItems: (configs: QueueConfig[]) => void;
  removeItem: (id: string) => void;
  clearDone: () => void;
  clearAll: () => void;
}

export function useQueue(): UseQueueReturn {
  const { addEntry } = useHistory();
  const [items, setItems] = useState<QueueItem[]>(loadQueue);
  const itemsRef = useRef<QueueItem[]>(items);
  const processingRef = useRef(false);
  const unlistenRefs = useRef<UnlistenFn[]>([]);
  const currentDownload = useRef<{ itemId: string; downloadId: string; abort: () => void } | null>(
    null,
  );
  const addEntryRef = useRef(addEntry);
  addEntryRef.current = addEntry;

  useEffect(() => {
    itemsRef.current = items;
    saveQueue(items);
  }, [items]);

  useEffect(() => () => { unlistenRefs.current.forEach((fn) => fn()); }, []);

  const processNext = useCallback(async () => {
    if (processingRef.current) return;
    const next = itemsRef.current.find((i) => i.status === 'pending');
    if (!next) return;

    processingRef.current = true;
    const downloadId = newId();

    setItems((prev) =>
      prev.map((i) => (i.id === next.id ? { ...i, status: 'downloading' as const } : i)),
    );

    unlistenRefs.current.forEach((fn) => fn());

    const onDone = (status: 'done' | 'error', error?: string, remove = false) => {
      currentDownload.current = null;
      setItems((prev) =>
        remove
          ? prev.filter((i) => i.id !== next.id)
          : prev.map((i) => (i.id === next.id ? { ...i, status, error, progress: undefined } : i)),
      );
      processingRef.current = false;
      // Schedule next tick to avoid re-entrancy
      setTimeout(() => { void processNext(); }, 50);
    };

    currentDownload.current = {
      itemId: next.id,
      downloadId,
      abort: () => onDone('error', undefined, true),
    };

    const ul1 = await listen<DownloadProgress>(EVENT_PROGRESS, (e) => {
      if (e.payload.download_id === downloadId) {
        setItems((prev) =>
          prev.map((i) => (i.id === next.id ? { ...i, progress: e.payload.percent } : i)),
        );
      }
    });

    const ul2 = await listen<DownloadComplete>(EVENT_COMPLETE, (e) => {
      if (e.payload.download_id === downloadId) {
        addEntryRef.current({
          id: downloadId,
          url: next.url,
          title: next.url,
          thumbnail: '',
          platform: getPlatform(next.url),
          filepath: e.payload.filepath,
          downloaded_at: Date.now(),
          quality: next.quality,
        });
        onDone('done');
      }
    });

    const ul3 = await listen<{ download_id: string; message: string }>(EVENT_ERROR, (e) => {
      if (e.payload.download_id === downloadId) {
        onDone('error', parseYtdlpError(e.payload.message));
      }
    });

    unlistenRefs.current = [ul1, ul2, ul3];

    try {
      await startDownload(
        next.url,
        next.outputDir,
        next.quality,
        downloadId,
        next.playlistEnd,
        next.cookiesBrowser,
        next.audioOnly,
      );
    } catch (err) {
      onDone('error', parseYtdlpError(err instanceof Error ? err.message : String(err)));
    }
  }, []);

  // Rows restored from the previous session pick up where they left off.
  useEffect(() => {
    if (itemsRef.current.some((i) => i.status === 'pending')) {
      const timer = setTimeout(() => {
        void processNext();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [processNext]);

  const addItems = useCallback(
    (configs: QueueConfig[]) => {
      const queued: QueueItem[] = configs.map((c) => ({
        ...c,
        id: newId(),
        status: 'pending' as const,
      }));
      setItems((prev) => {
        const updated = [...prev, ...queued];
        itemsRef.current = updated;
        return updated;
      });
      setTimeout(() => { void processNext(); }, 50);
    },
    [processNext],
  );

  const removeItem = useCallback((id: string) => {
    const current = currentDownload.current;
    if (current?.itemId === id) {
      // The running item: stop yt-dlp (it emits nothing once cancelled) and drop the row.
      void cancelDownload(current.downloadId).catch(() => {});
      current.abort();
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id || i.status === 'downloading'));
  }, []);

  const clearDone = useCallback(() => {
    setItems((prev) => prev.filter((i) => i.status === 'pending' || i.status === 'downloading'));
  }, []);

  const clearAll = useCallback(() => {
    setItems((prev) => prev.filter((i) => i.status === 'downloading'));
  }, []);

  const isActive = items.some((i) => i.status === 'pending' || i.status === 'downloading');

  return { items, isActive, addItems, removeItem, clearDone, clearAll };
}

export type { QueueConfig };
