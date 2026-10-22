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

interface ThumbState {
  src: string;
  shown: string;
  failed: boolean;
}

/** A thumbnail that starts from the remote URL, upgrades to the Rust-proxied (and cached)
 * copy — which gets past the Referer/CORS checks of Instagram, TikTok… — and falls back
 * to the striped placeholder when the image cannot be shown. */
export function Thumb({ src, alt, platform, lazy, proxyOnly }: ThumbProps) {
  const fresh = (): ThumbState => ({ src, shown: proxyOnly ? '' : src, failed: false });
  const [state, setState] = useState<ThumbState>(fresh);
  // A new source starts over from its own initial state (adjusted while rendering).
  if (state.src !== src) setState(fresh());

  useEffect(() => {
    if (!src) return;
    let current = true;
    const apply = (patch: Partial<ThumbState>) =>
      setState((s) => (current && s.src === src ? { ...s, ...patch } : s));
    void fetchThumbnail(src)
      .then((data) => {
        if (typeof data === 'string' && data) apply({ shown: data });
        else if (proxyOnly) apply({ failed: true });
      })
      .catch(() => {
        if (proxyOnly) apply({ failed: true });
      });
    return () => {
      current = false;
    };
  }, [src, proxyOnly]);

  const { shown, failed } = state;
  if (!src || failed || !shown) return <ThumbPlaceholder platform={platform} />;
  return (
    <img
      src={shown}
      alt={alt}
      loading={lazy ? 'lazy' : undefined}
      className="w-full h-full [object-fit:cover]"
      onError={() => setState((s) => ({ ...s, failed: true }))}
    />
  );
}
