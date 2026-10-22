import { useEffect, useState } from 'react';
import { fetchThumbnail } from '@/lib/tauri-commands';
import type { Platform } from '@/types';
import { ThumbPlaceholder } from './ThumbPlaceholder';

interface ThumbProps {
  src: string;
  alt: string;
  platform: Platform;
  lazy?: boolean;
  /** Never contact the remote host from the webview: show the placeholder until the
   * proxied copy arrives. Used for the history, so old entries do not phone home. */
  proxyOnly?: boolean;
}

/** A thumbnail that starts from the remote URL, upgrades to the Rust-proxied (and cached)
 * copy — which gets past the Referer/CORS checks of Instagram, TikTok… — and falls back
 * to the striped placeholder when the image cannot be shown. */
export function Thumb({ src, alt, platform, lazy, proxyOnly }: ThumbProps) {
  const [shown, setShown] = useState(proxyOnly ? '' : src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setShown(proxyOnly ? '' : src);
    setFailed(false);
    if (!src) return;
    let current = true;
    void fetchThumbnail(src)
      .then((data) => {
        if (!current) return;
        if (typeof data === 'string' && data) setShown(data);
        else if (proxyOnly) setFailed(true);
      })
      .catch(() => {
        if (current && proxyOnly) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [src, proxyOnly]);

  if (!src || failed || !shown) return <ThumbPlaceholder platform={platform} />;
  return (
    <img
      src={shown}
      alt={alt}
      loading={lazy ? 'lazy' : undefined}
      className="w-full h-full [object-fit:cover]"
      onError={() => setFailed(true)}
    />
  );
}
