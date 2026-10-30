import { useState } from 'react';
import { thumbnailUrl } from '@/lib/tauri-commands';
import type { Platform } from '@/types';
import { ThumbPlaceholder } from './ThumbPlaceholder';

interface ThumbProps {
  src: string;
  alt: string;
  platform: Platform;
  lazy?: boolean;
}

/** A thumbnail served by the app's own `thumb://` scheme: the backend downloads it (and
 * keeps it on disk), the webview never contacts the remote host. When the image cannot be
 * had, the striped placeholder takes its place. */
export function Thumb({ src, alt, platform, lazy }: ThumbProps) {
  // The source that failed, so a new source starts over without an effect.
  const [failedSrc, setFailedSrc] = useState('');
  if (!src || failedSrc === src) return <ThumbPlaceholder platform={platform} />;
  return (
    <img
      src={thumbnailUrl(src)}
      alt={alt}
      loading={lazy ? 'lazy' : undefined}
      className="w-full h-full [object-fit:cover]"
      onError={() => setFailedSrc(src)}
    />
  );
}
