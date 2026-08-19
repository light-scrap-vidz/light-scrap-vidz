import { useState, useCallback } from 'react';
import { fetchPlaylistInfo } from '@/lib/tauri-commands';
import type { CookiesBrowser, PlaylistInfo } from '@/types';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface UsePlaylistInfoReturn {
  info: PlaylistInfo | null;
  status: Status;
  error: string | null;
  fetchInfo: (url: string, cookiesBrowser?: CookiesBrowser) => Promise<PlaylistInfo | null>;
  reset: () => void;
}

export function usePlaylistInfo(): UsePlaylistInfoReturn {
  const [info, setInfo] = useState<PlaylistInfo | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const fetchInfo = useCallback(
    async (url: string, cookiesBrowser?: CookiesBrowser): Promise<PlaylistInfo | null> => {
      setStatus('loading');
      setError(null);
      setInfo(null);
      try {
        const data = await fetchPlaylistInfo(url, cookiesBrowser);
        setInfo(data);
        setStatus('success');
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setStatus('error');
        return null;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setInfo(null);
    setStatus('idle');
    setError(null);
  }, []);

  return { info, status, error, fetchInfo, reset };
}
