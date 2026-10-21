import { formatDuration } from '@/lib/utils';
import { getPlatform } from '@/lib/url-validator';
import type { VideoInfo } from '@/types';
import { useT } from '@/lib/locale';
import { PlatformBadge } from './PlatformBadge';
import { Thumb } from './Thumb';

interface VideoPreviewProps {
  info: VideoInfo;
  url: string;
}

export function VideoPreview({ info, url }: VideoPreviewProps) {
  const t = useT();
  const platform = getPlatform(url);

  return (
    <div
      style={{
        display: 'flex',
        gap: 15,
        padding: 15,
        background: 'var(--surface)',
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
        <Thumb src={info.thumbnail} alt={info.title} platform={platform} />
        {info.duration > 0 && (
          <span
            style={{
              position: 'absolute',
              bottom: 5,
              right: 5,
              background: 'rgba(0,0,0,0.72)',
              color: 'var(--text-strong)',
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
          <PlatformBadge platform={platform} />
          <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
            {t('preview.single')}
          </span>
        </div>

        <h3
          style={{
            margin: 0,
            fontSize: '15.5px',
            fontWeight: 700,
            color: 'var(--text-strong)',
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

        <div style={{ fontSize: '12.5px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
          {[info.uploader, info.duration > 0 ? formatDuration(info.duration) : null]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </div>
    </div>
  );
}
