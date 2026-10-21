import type { DownloadProgress, DownloadStatus } from '@/types';
import { useT } from '@/lib/locale';

interface ProgressCardProps {
  status: DownloadStatus;
  progress: DownloadProgress | null;
  error: string | null;
}

export function ProgressCard({ status, progress }: ProgressCardProps) {
  const t = useT();

  if (status !== 'downloading') return null;

  const percent = progress?.percent ?? 0;
  const speed = progress?.speed && progress.speed !== 'Unknown B/s' ? progress.speed : null;
  const eta = progress?.eta && progress.eta !== 'Unknown' ? progress.eta : null;

  return (
    <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Percent + speed/eta row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span
            style={{
              fontSize: '52px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 600,
              color: 'var(--text-strong)',
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}
          >
            {percent.toFixed(0)}
          </span>
          <span style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-dim)', marginLeft: 2 }}>%</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          {speed && (
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace" }}>
              {speed}
            </span>
          )}
          {eta && (
            <span style={{ fontSize: '11.5px', color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>
              {t('dl.eta')} {eta}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 10, borderRadius: 6, background: '#26241F', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${percent}%`,
            borderRadius: 6,
            background: 'linear-gradient(90deg, rgba(201,242,94,0.8), #C9F25E)',
            boxShadow: '0 0 18px rgba(201,242,94,0.32)',
            transition: 'width 0.25s linear',
          }}
        />
      </div>

      {progress?.current_item != null && progress.total_items != null && (
        <span style={{ fontSize: '11.5px', color: 'var(--text-hover)', fontFamily: "'JetBrains Mono', monospace" }}>
          {t('dl.item', { current: progress.current_item, total: progress.total_items })}
        </span>
      )}

      {/* Filename */}
      {progress?.filename && (
        <span
          style={{
            fontSize: '11.5px',
            fontFamily: "'JetBrains Mono', monospace",
            color: 'var(--text-dim)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {progress.filename}
        </span>
      )}
    </div>
  );
}
