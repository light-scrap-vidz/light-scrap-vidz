import { useCallback, useMemo, useRef, useState } from 'react';
import { fetchPlaylistInfo } from '@/lib/tauri-commands';
import { parseYtdlpError } from '@/lib/error-parser';
import type { CookiesBrowser, PlaylistEntry, PlaylistInfo } from '@/types';
import { useFetchInfo, type UseFetchInfoReturn } from './useFetchInfo';

/** Taille d'une page de playlist, la même que côté Rust (`PAGE_SIZE`). */
export const PAGE_SIZE = 20;

export interface UsePlaylistInfoReturn extends UseFetchInfoReturn<PlaylistInfo> {
  /** D'autres entrées existent peut-être au-delà de celles déjà chargées. */
  hasMore: boolean;
  loadingMore: boolean;
  moreError: string | null;
  loadMore: (url: string, cookiesBrowser?: CookiesBrowser) => Promise<void>;
}

/** La recherche d'une playlist, par pages de 20 entrées : la première donne le titre et le
 * total, « Charger plus » ajoute les suivantes. */
export function usePlaylistInfo(): UsePlaylistInfoReturn {
  const base = useFetchInfo<PlaylistInfo>(fetchPlaylistInfo);
  const { info: first, fetchInfo: baseFetch, reset: baseReset } = base;
  const [extra, setExtra] = useState<PlaylistEntry[]>([]);
  const [lastPage, setLastPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const session = useRef(0);

  const clearPages = useCallback(() => {
    session.current++;
    setExtra([]);
    setLastPage(0);
    setLoadingMore(false);
    setMoreError(null);
  }, []);

  const fetchInfo = useCallback(
    async (url: string, cookiesBrowser?: CookiesBrowser) => {
      clearPages();
      const data = await baseFetch(url, cookiesBrowser);
      if (data) setLastPage(data.entries?.length ?? 0);
      return data;
    },
    [baseFetch, clearPages],
  );

  const reset = useCallback(() => {
    clearPages();
    baseReset();
  }, [baseReset, clearPages]);

  const info = useMemo<PlaylistInfo | null>(
    () => (first ? { ...first, entries: [...(first.entries ?? []), ...extra] } : null),
    [first, extra],
  );
  const loaded = info?.entries.length ?? 0;
  const total = first?.playlist_count ?? null;
  const hasMore = lastPage >= PAGE_SIZE && (total === null || loaded < total);

  const loadMore = useCallback(
    async (url: string, cookiesBrowser?: CookiesBrowser) => {
      const mine = session.current;
      setLoadingMore(true);
      setMoreError(null);
      const start = loaded + 1;
      try {
        const page = await fetchPlaylistInfo(url, cookiesBrowser, start, start + PAGE_SIZE - 1);
        if (mine !== session.current) return;
        const entries = page.entries ?? [];
        setExtra((prev) => {
          const seen = new Set([...(first?.entries ?? []), ...prev].map((e) => e.url));
          return [...prev, ...entries.filter((e) => !seen.has(e.url))];
        });
        setLastPage(entries.length);
      } catch (err) {
        if (mine !== session.current) return;
        setMoreError(parseYtdlpError(err instanceof Error ? err.message : String(err)));
      } finally {
        if (mine === session.current) setLoadingMore(false);
      }
    },
    [loaded, first],
  );

  return { ...base, info, fetchInfo, reset, hasMore, loadingMore, moreError, loadMore };
}
