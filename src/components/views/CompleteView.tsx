import { Thumb } from '@/components/Thumb';
import { ThumbPlaceholder } from '@/components/ThumbPlaceholder';
import { openFile, openFolder } from '@/lib/tauri-commands';
import { getPlatform } from '@/lib/url-validator';
import { formatDuration } from '@/lib/utils';
import { useT } from '@/lib/locale';
import type { Flow } from '@/hooks/useAppFlow';

const ghostButton: React.CSSProperties = {
  width: 48,
  height: 48,
  padding: 0,
  borderRadius: 12,
  background: 'var(--surface-2)',
  border: '1px solid rgba(255,255,255,0.10)',
  color: 'var(--text-soft)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all .15s',
};

export function CompleteView({ flow }: { flow: Flow }) {
  const t = useT();
  const { info, plInfo, isPlaylist, dl } = flow;
  const completedPath = dl.completedPath;
  const platform = getPlatform(flow.url);

  const title = isPlaylist ? plInfo?.title || t('dl.playlist') : info?.title || t('dl.download');
  const thumb = isPlaylist ? '' : (info?.thumbnail ?? '');
  const meta = isPlaylist
    ? t('dl.playlistMeta', { count: flow.playlistCount })
    : [info?.uploader, info && info.duration > 0 ? formatDuration(info.duration) : null]
        .filter(Boolean)
        .join(' · ');

  return (
    <div className="lsv-view" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-soft)', border: '1px solid rgba(201,242,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-strong)', letterSpacing: '-0.01em' }}>{t('dl.complete')}</div>
        {completedPath && (
          <div style={{ fontSize: '11.5px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-dim)', marginTop: 5, maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', userSelect: 'text' }}>
            {completedPath}
          </div>
        )}
      </div>

      <div style={{ width: '100%', maxWidth: 420, background: 'var(--surface)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 16, padding: '13px 15px', alignItems: 'center' }}>
        <div style={{ width: 56, height: 36, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
          {thumb ? <Thumb src={thumb} alt={title} platform={platform} /> : <ThumbPlaceholder platform={platform} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          {meta && (
            <div style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta}</div>
          )}
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: 420, display: 'flex', gap: 9 }}>
        <button
          onClick={() => completedPath && void openFile(completedPath)}
          className="lsv-hover-outline"
          style={ghostButton}
          aria-label={t('dl.openFile')}
          title={t('dl.openFile')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
        <button
          onClick={() => completedPath && void openFolder(completedPath)}
          className="lsv-hover-outline"
          style={ghostButton}
          aria-label={t('dl.reveal')}
          title={t('dl.reveal')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
          </svg>
        </button>
        <button
          onClick={flow.handleReset}
          className="lsv-hover-lift"
          style={{ flex: 1, height: 48, borderRadius: 12, border: 'none', background: 'var(--accent)', color: 'var(--accent-ink)', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 10px 28px rgba(201,242,94,0.32)' }}
        >
          {t('dl.another')}
        </button>
      </div>
    </div>
  );
}
