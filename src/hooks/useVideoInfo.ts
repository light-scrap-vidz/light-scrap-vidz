import { useState, useCallback } from 'react';
import { fetchVideoInfo } from '@/lib/tauri-commands';
import type { CookiesBrowser, VideoInfo } from '@/types';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface UseVideoInfoReturn {
  info: VideoInfo | null;
  status: Status;
  error: string | null;
  fetchInfo: (url: string, cookiesBrowser?: CookiesBrowser) => Promise<VideoInfo | null>;
  reset: () => void;
}

export function useVideoInfo(): UseVideoInfoReturn {
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const fetchInfo = useCallback(
    async (url: string, cookiesBrowser?: CookiesBrowser): Promise<VideoInfo | null> => {
      setStatus('loading');
      setError(null);
      setInfo(null);
      try {
        const data = await fetchVideoInfo(url, cookiesBrowser);
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
