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
    <div className="w-full max-w-[460px] flex flex-col gap-[16px]">
      {/* Percent + speed/eta row */}
      <div className="flex items-end justify-between">
        <div className="flex items-baseline">
          <span className="text-[52px] font-mono font-[600] text-fg-strong [letter-spacing:-0.03em] [line-height:1]">
            {percent.toFixed(0)}
          </span>
          <span className="text-[22px] font-[600] text-dim ml-[2px]">%</span>
        </div>
        <div className="flex flex-col items-end gap-[3px]">
          {speed && <span className="text-[14px] font-[600] text-accent font-mono">{speed}</span>}
          {eta && (
            <span className="text-[11.5px] text-dim font-mono">
              {t('dl.eta')} {eta}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-[10px] rounded-[6px] bg-[#26241F] overflow-hidden">
        <div
          className="h-full rounded-[6px] [background:linear-gradient(90deg,_rgba(201,242,94,0.8),_#C9F25E)] [box-shadow:0_0_18px_rgba(201,242,94,0.32)] [transition:width_0.25s_linear]"
          style={{ width: `${percent}%` }}
        />
      </div>

      {progress?.current_item != null && progress.total_items != null && (
        <span className="text-[11.5px] text-hover font-mono">
          {t('dl.item', { current: progress.current_item, total: progress.total_items })}
        </span>
      )}

      {/* Filename */}
      {progress?.filename && (
        <span className="text-[11.5px] font-mono text-dim whitespace-nowrap overflow-hidden text-ellipsis">
          {progress.filename}
        </span>
      )}
    </div>
  );
}
