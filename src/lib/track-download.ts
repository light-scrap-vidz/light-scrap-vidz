import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EVENT_COMPLETE, EVENT_ERROR, EVENT_PROGRESS } from '@/lib/events';
import type { DownloadComplete, DownloadError, DownloadProgress } from '@/types';

export interface DownloadHandlers {
  onProgress: (progress: DownloadProgress) => void;
  onComplete: (done: DownloadComplete) => void;
  onError: (failure: DownloadError) => void;
}

/** Écoute les trois événements d'un téléchargement et ne transmet que ceux de `id`.
 * Renvoie la fonction qui arrête l'écoute. */
export async function trackDownload(id: string, handlers: DownloadHandlers): Promise<() => void> {
  const unlisteners: UnlistenFn[] = await Promise.all([
    listen<DownloadProgress>(EVENT_PROGRESS, (e) => {
      if (e.payload.download_id === id) handlers.onProgress(e.payload);
    }),
    listen<DownloadComplete>(EVENT_COMPLETE, (e) => {
      if (e.payload.download_id === id) handlers.onComplete(e.payload);
    }),
    listen<DownloadError>(EVENT_ERROR, (e) => {
      if (e.payload.download_id === id) handlers.onError(e.payload);
    }),
  ]);
  return () => unlisteners.forEach((fn) => fn());
}
