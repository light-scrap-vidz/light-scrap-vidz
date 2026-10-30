import { useState, useCallback, useRef } from 'react';
import { parseYtdlpError } from '@/lib/error-parser';
import type { CookiesBrowser } from '@/types';

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseFetchInfoReturn<T> {
  info: T | null;
  status: FetchStatus;
  error: string | null;
  fetchInfo: (url: string, cookiesBrowser?: CookiesBrowser) => Promise<T | null>;
  reset: () => void;
}

/** Shared lookup state for videos and playlists. A newer request (or a reset) makes any
 * older, still-pending one a no-op, so a slow answer never overwrites a fresher one. */
export function useFetchInfo<T>(
  fetcher: (url: string, cookiesBrowser?: CookiesBrowser) => Promise<T>,
): UseFetchInfoReturn<T> {
  const [info, setInfo] = useState<T | null>(null);
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const fetchInfo = useCallback(
    async (url: string, cookiesBrowser?: CookiesBrowser): Promise<T | null> => {
      const id = ++requestId.current;
      setStatus('loading');
      setError(null);
      setInfo(null);
      try {
        const data = await fetcher(url, cookiesBrowser);
        if (id !== requestId.current) return data;
        setInfo(data);
        setStatus('success');
        return data;
      } catch (err) {
        if (id !== requestId.current) return null;
        setError(parseYtdlpError(err instanceof Error ? err.message : String(err)));
        setStatus('error');
        return null;
      }
    },
    [fetcher],
  );

  const reset = useCallback(() => {
    requestId.current++;
    setInfo(null);
    setStatus('idle');
    setError(null);
  }, []);

  return { info, status, error, fetchInfo, reset };
}
