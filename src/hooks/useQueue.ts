import { useState, useCallback, useRef, useEffect } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { v4 as uuidv4 } from 'uuid';
import { startDownload } from '@/lib/tauri-commands';
import { parseYtdlpError } from '@/lib/error-parser';
import type { CookiesBrowser, DownloadComplete, DownloadProgress, Quality, QueueItem } from '@/types';

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
  const [items, setItems] = useState<QueueItem[]>([]);
  const itemsRef = useRef<QueueItem[]>([]);
  const processingRef = useRef(false);
  const unlistenRefs = useRef<UnlistenFn[]>([]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => () => { unlistenRefs.current.forEach((fn) => fn()); }, []);

  const processNext = useCallback(async () => {
    if (processingRef.current) return;
    const next = itemsRef.current.find((i) => i.status === 'pending');
    if (!next) return;

    processingRef.current = true;
    const downloadId = uuidv4();

    setItems((prev) =>
      prev.map((i) => (i.id === next.id ? { ...i, status: 'downloading' as const } : i)),
    );

    unlistenRefs.current.forEach((fn) => fn());

    const onDone = (status: 'done' | 'error', error?: string) => {
      setItems((prev) =>
        prev.map((i) => (i.id === next.id ? { ...i, status, error, progress: undefined } : i)),
      );
      processingRef.current = false;
      // Schedule next tick to avoid re-entrancy
      setTimeout(() => { void processNext(); }, 50);
    };

    const ul1 = await listen<DownloadProgress>('download://progress', (e) => {
      if (e.payload.download_id === downloadId) {
        setItems((prev) =>
          prev.map((i) => (i.id === next.id ? { ...i, progress: e.payload.percent } : i)),
        );
      }
    });

    const ul2 = await listen<DownloadComplete>('download://complete', (e) => {
      if (e.payload.download_id === downloadId) {
        onDone('done');
      }
    });

    const ul3 = await listen<{ download_id: string; message: string }>('download://error', (e) => {
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

  const addItems = useCallback(
    (configs: QueueConfig[]) => {
      const queued: QueueItem[] = configs.map((c) => ({
        ...c,
        id: uuidv4(),
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

export type { QueueConfig, Quality, CookiesBrowser };
