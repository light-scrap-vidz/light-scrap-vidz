import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { newId } from '@/lib/utils';
import { startDownload, cancelDownload } from '@/lib/tauri-commands';
import { parseYtdlpError } from '@/lib/error-parser';
import { trackDownload } from '@/lib/track-download';
import { sendDesktopNotification } from '@/lib/notify';
import { getPlatform } from '@/lib/url-validator';
import { loadQueue, saveQueue } from '@/lib/queue-store';
import { useT } from '@/lib/locale';
import { useHistory } from './useHistory';
import type { QueueItem } from '@/types';

type QueueConfig = Omit<QueueItem, 'id' | 'status' | 'error'>;

type Action =
  | { type: 'add'; items: QueueItem[] }
  | { type: 'start'; id: string }
  | { type: 'finish'; id: string; status: 'done' | 'error'; error?: string }
  | { type: 'remove'; id: string }
  | { type: 'retry'; id?: string }
  | { type: 'clearDone' }
  | { type: 'clearAll' };

function without(map: Record<string, number>, key: string): Record<string, number> {
  const next = { ...map };
  delete next[key];
  return next;
}

function reducer(items: QueueItem[], action: Action): QueueItem[] {
  switch (action.type) {
    case 'add':
      return [...items, ...action.items];
    case 'start':
      return items.map((i) => (i.id === action.id ? { ...i, status: 'downloading' } : i));
    case 'finish':
      return items.map((i) =>
        i.id === action.id ? { ...i, status: action.status, error: action.error } : i,
      );
    case 'remove':
      return items.filter((i) => i.id !== action.id);
    case 'retry':
      return items.map((i) =>
        i.status === 'error' && (!action.id || i.id === action.id)
          ? { ...i, status: 'pending', error: undefined }
          : i,
      );
    case 'clearDone':
      return items.filter((i) => i.status === 'pending' || i.status === 'downloading');
    case 'clearAll':
      return items.filter((i) => i.status === 'downloading');
  }
}

interface UseQueueReturn {
  items: QueueItem[];
  /** Avancement (0-100) de l'élément en cours, par identifiant. Séparé de `items` : la
   * progression change toutes les demi-secondes, la structure de la file rarement. */
  progress: Record<string, number>;
  isActive: boolean;
  /** Ajoute les éléments qui ne sont pas déjà en attente ou en cours ; renvoie leur nombre. */
  addItems: (configs: QueueConfig[]) => number;
  removeItem: (id: string) => void;
  retryItem: (id: string) => void;
  retryFailed: () => void;
  clearDone: () => void;
  clearAll: () => void;
}

interface Running {
  itemId: string;
  downloadId: string;
  stop: () => void;
}

export function useQueue(): UseQueueReturn {
  const t = useT();
  const { addEntry } = useHistory();
  const [items, dispatch] = useReducer(reducer, undefined, loadQueue);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const running = useRef<Running | null>(null);
  const finishedInRun = useRef({ count: 0, last: '' });
  const itemsRef = useRef(items);
  const addEntryRef = useRef(addEntry);
  const tRef = useRef(t);

  useEffect(() => {
    itemsRef.current = items;
    addEntryRef.current = addEntry;
    tRef.current = t;
  });

  // Only the structure of the queue is saved, not each progress tick.
  useEffect(() => {
    saveQueue(items);
  }, [items]);

  const run = useCallback(async (item: QueueItem) => {
    const downloadId = newId();
    const current: Running = { itemId: item.id, downloadId, stop: () => {} };
    running.current = current;

    const finish = (status: 'done' | 'error', error?: string) => {
      if (running.current !== current) return;
      current.stop();
      running.current = null;
      setProgress((prev) => without(prev, item.id));
      dispatch({ type: 'finish', id: item.id, status, error });
    };

    try {
      current.stop = await trackDownload(downloadId, {
        onProgress: (p) => setProgress((prev) => ({ ...prev, [item.id]: p.percent })),
        onComplete: ({ filepath }) => {
          addEntryRef.current({
            id: downloadId,
            url: item.url,
            title: item.title ?? '',
            thumbnail: '',
            platform: getPlatform(item.url),
            filepath,
            downloaded_at: Date.now(),
            quality: item.quality,
          });
          finishedInRun.current = {
            count: finishedInRun.current.count + 1,
            last: filepath.split('/').at(-1) ?? '',
          };
          finish('done');
        },
        onError: ({ message }) => finish('error', parseYtdlpError(message)),
      });
      if (running.current !== current) {
        // Removed while the listeners were being set up.
        current.stop();
        return;
      }
      await startDownload(
        item.url,
        item.outputDir,
        item.quality,
        downloadId,
        item.playlistEnd,
        item.cookiesBrowser,
        item.audioOnly,
      );
    } catch (err) {
      finish('error', parseYtdlpError(err instanceof Error ? err.message : String(err)));
    }
  }, []);

  // One item at a time: whenever nothing runs, the next pending one starts. The same effect
  // restores a queue left over from the previous session.
  useEffect(() => {
    if (running.current) return;
    const next = items.find((i) => i.status === 'pending');
    if (!next) {
      const { count, last } = finishedInRun.current;
      if (count > 0) {
        finishedInRun.current = { count: 0, last: '' };
        const tt = tRef.current;
        void sendDesktopNotification(
          tt('dl.complete'),
          count === 1 ? last || tt('dl.download') : tt('queue.finished', { count }),
        );
      }
      return;
    }
    dispatch({ type: 'start', id: next.id });
    void run(next);
  }, [items, run]);

  useEffect(
    () => () => {
      running.current?.stop();
    },
    [],
  );

  const addItems = useCallback((configs: QueueConfig[]) => {
    const taken = new Set(
      itemsRef.current
        .filter((i) => i.status === 'pending' || i.status === 'downloading')
        .map((i) => i.url),
    );
    const queued: QueueItem[] = [];
    for (const c of configs) {
      if (taken.has(c.url)) continue;
      taken.add(c.url);
      queued.push({ ...c, id: newId(), status: 'pending' });
    }
    if (queued.length > 0) {
      itemsRef.current = [...itemsRef.current, ...queued];
      dispatch({ type: 'add', items: queued });
    }
    return queued.length;
  }, []);

  const removeItem = useCallback((id: string) => {
    const current = running.current;
    if (current?.itemId === id) {
      // The running item: stop yt-dlp (it emits nothing once cancelled) and drop the row.
      running.current = null;
      current.stop();
      void cancelDownload(current.downloadId).catch(() => {});
      setProgress((prev) => without(prev, id));
    }
    dispatch({ type: 'remove', id });
  }, []);

  const retryItem = useCallback((id: string) => dispatch({ type: 'retry', id }), []);
  const retryFailed = useCallback(() => dispatch({ type: 'retry' }), []);
  const clearDone = useCallback(() => dispatch({ type: 'clearDone' }), []);
  const clearAll = useCallback(() => dispatch({ type: 'clearAll' }), []);

  const isActive = items.some((i) => i.status === 'pending' || i.status === 'downloading');

  return {
    items,
    progress,
    isActive,
    addItems,
    removeItem,
    retryItem,
    retryFailed,
    clearDone,
    clearAll,
  };
}

export type { QueueConfig };
