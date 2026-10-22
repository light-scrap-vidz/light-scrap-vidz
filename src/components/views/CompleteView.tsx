import { Thumb } from '@/components/Thumb';
import { ThumbPlaceholder } from '@/components/ThumbPlaceholder';
import { openFile, openFolder } from '@/lib/tauri-commands';
import { getPlatform } from '@/lib/url-validator';
import { formatDuration } from '@/lib/utils';
import { useT } from '@/lib/locale';
import type { Flow } from '@/hooks/useAppFlow';

const ghostButton =
  'lsv-hover-outline w-12 h-12 p-0 rounded-xl bg-surface-2 border border-[rgba(255,255,255,0.10)] text-fg-soft cursor-pointer flex items-center justify-center transition-all duration-150';

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
    <div className="lsv-view flex-1 flex flex-col items-center justify-center gap-[16px]">
      <div className="w-[56px] h-[56px] rounded-full bg-[var(--accent-soft)] border border-[rgba(201,242,94,0.3)] flex items-center justify-center text-accent">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      <div className="text-center">
        <div className="text-[17px] font-[700] text-fg-strong [letter-spacing:-0.01em]">
          {t('dl.complete')}
        </div>
        {completedPath && (
          <div className="text-[11.5px] font-mono text-dim mt-[5px] max-w-[420px] overflow-hidden text-ellipsis whitespace-nowrap [direction:rtl] select-text">
            <bdi>{completedPath}</bdi>
          </div>
        )}
      </div>

      <div className="w-full max-w-[420px] bg-surface rounded-[14px] border border-[rgba(255,255,255,0.07)] flex gap-[16px] [padding:13px_15px] items-center">
        <div className="w-[56px] h-[36px] rounded-[8px] overflow-hidden shrink-0">
          {thumb ? (
            <Thumb src={thumb} alt={title} platform={platform} />
          ) : (
            <ThumbPlaceholder platform={platform} />
          )}
        </div>
        <div className="flex-1 min-w-[0px]">
          <div className="text-[13.5px] font-[600] text-fg whitespace-nowrap overflow-hidden text-ellipsis">
            {title}
          </div>
          {meta && (
            <div className="text-[12px] font-mono text-muted mt-[2px] whitespace-nowrap overflow-hidden text-ellipsis">
              {meta}
            </div>
          )}
        </div>
      </div>

      <div className="w-full max-w-[420px] flex gap-[9px]">
        <button
          onClick={() => completedPath && void openFile(completedPath)}
          className={ghostButton}
          aria-label={t('dl.openFile')}
          title={t('dl.openFile')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
        <button
          onClick={() => completedPath && void openFolder(completedPath)}
          className={ghostButton}
          aria-label={t('dl.reveal')}
          title={t('dl.reveal')}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
          </svg>
        </button>
        <button
          onClick={flow.handleReset}
          className="lsv-hover-lift flex-1 h-[48px] rounded-[12px] border-0 bg-accent text-accent-ink text-[13.5px] font-[700] cursor-pointer [box-shadow:0_10px_28px_rgba(201,242,94,0.32)]"
        >
          {t('dl.another')}
        </button>
      </div>
    </div>
  );
}
