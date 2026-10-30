import type { QueueItem } from '@/types';
import { getItem, removeItem, setItem } from './storage';

const QUEUE_KEY = 'light-scrap-vidz:queue';

/** Only what still has to be downloaded survives a restart. An item that was running when
 * the app closed starts over as pending; finished and failed rows are dropped. */
export function loadQueue(): QueueItem[] {
  try {
    const raw = getItem(QUEUE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (i): i is QueueItem =>
          !!i &&
          typeof i.id === 'string' &&
          typeof i.url === 'string' &&
          typeof i.outputDir === 'string' &&
          (i.status === 'pending' || i.status === 'downloading'),
      )
      .map((i) => ({ ...i, status: 'pending' as const, error: undefined }));
  } catch {
    return [];
  }
}

export function saveQueue(items: QueueItem[]): void {
  const remaining = items.filter((i) => i.status === 'pending' || i.status === 'downloading');
  if (remaining.length === 0) removeItem(QUEUE_KEY);
  else setItem(QUEUE_KEY, JSON.stringify(remaining));
}
