import { useState, useEffect } from 'react';
import { PLATFORM_META, PLATFORM_TINT } from '@/lib/platform';
import { formatDuration } from '@/lib/utils';
import { getPlatform } from '@/lib/url-validator';
import { fetchThumbnail } from '@/lib/tauri-commands';
import type { VideoInfo } from '@/types';
import { useT } from '@/lib/locale';

interface VideoPreviewProps {
  info: VideoInfo;
  url: string;
}

export function VideoPreview({ info, url }: VideoPreviewProps) {
  const t = useT();
  const platform = getPlatform(url);
  const meta = PLATFORM_META[platform];
  const tint = PLATFORM_TINT[platform];
  const [thumbSrc, setThumbSrc] = useState<string | null>(info.thumbnail ?? null);

  useEffect(() => {
    if (!info.thumbnail) return;
    setThumbSrc(info.thumbnail);
    // Proxy via Rust to bypass CORS/Referer restrictions on Instagram, TikTok, etc.
    void fetchThumbnail(info.thumbnail)
      .then((data) => setThumbSrc(data))
      .catch(() => { /* keep original URL */ });
  }, [info.thumbnail]);

  return (
    <div
      style={{
        display: 'flex',
        gap: 15,
        padding: 15,
        background: '#1A1916',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          position: 'relative',
          flexShrink: 0,
          width: 124,
          height: 78,
          borderRadius: 9,
          overflow: 'hidden',
        }}
      >
        {thumbSrc ? (
          <img
            src={thumbSrc}
            alt={info.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setThumbSrc(null)}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'repeating-linear-gradient(135deg, #211F1A 0 7px, #1A1815 7px 14px)',
              position: 'relative',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, background: tint, opacity: 0.12 }} />
          </div>
        )}
        {info.duration > 0 && (
          <span
            style={{
              position: 'absolute',
              bottom: 5,
              right: 5,
              background: 'rgba(0,0,0,0.72)',
              color: '#F1EDE6',
              fontSize: '9.5px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 500,
              padding: '1px 5px',
              borderRadius: 5,
            }}
          >
            {formatDuration(info.duration)}
          </span>
        )}
      </div>

      {/* Right column */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '2px 8px',
              borderRadius: 999,
              fontSize: '10px',
              fontWeight: 700,
              color: meta.color,
              background: meta.bgColor,
              border: `1px solid ${meta.borderColor}`,
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: tint }} />
            {meta.label}
          </span>
          <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#857F75' }}>
            {t('preview.single')}
          </span>
        </div>

        <h3
          style={{
            margin: 0,
            fontSize: '15.5px',
            fontWeight: 700,
            color: '#F1EDE6',
            letterSpacing: '-0.01em',
            lineHeight: 1.25,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {info.title}
        </h3>

        <div style={{ fontSize: '12.5px', fontFamily: "'JetBrains Mono', monospace", color: '#857F75' }}>
          {[info.uploader, info.duration > 0 ? formatDuration(info.duration) : null]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </div>
    </div>
  );
}
