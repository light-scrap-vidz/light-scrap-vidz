import type { DownloadProgress, DownloadStatus } from '@/types';
import { useT } from '@/lib/locale';

interface ProgressCardProps {
  status: DownloadStatus;
  progress: DownloadProgress | null;
}

/** Libellé d'une étape : une clé connue de `dl.stage.*`. */
const STAGES = ['merging', 'converting', 'fixing', 'processing'];

export function ProgressCard({ status, progress }: ProgressCardProps) {
  const t = useT();

  if (status !== 'downloading') return null;

  const percent = Math.min(100, Math.max(0, progress?.percent ?? 0));
  const stage = progress?.stage && STAGES.includes(progress.stage) ? progress.stage : null;
  // Size unknown (live, some HLS) or a post-processing step: there is no percentage to show.
  const indeterminate = !!stage || !!progress?.indeterminate;
  const speed = progress?.speed && progress.speed !== 'Unknown B/s' ? progress.speed : null;
  const eta = progress?.eta && progress.eta !== 'Unknown' ? progress.eta : null;
  const stageLabel = stage ? t(`dl.stage.${stage}`) : null;

  return (
    <div className="w-full max-w-[460px] flex flex-col gap-[16px]">
      {/* Percent + speed/eta row */}
      <div className="flex items-end justify-between">
        <div className="flex items-baseline">
          {stage || (indeterminate && progress?.downloaded) ? (
            <span className="text-[22px] font-mono font-[600] text-fg-strong [line-height:1.2]">
              {stageLabel ?? t('dl.downloadedSoFar', { amount: progress?.downloaded ?? '' })}
            </span>
          ) : (
            <>
              <span className="text-[52px] font-mono font-[600] text-fg-strong [letter-spacing:-0.03em] [line-height:1]">
                {percent.toFixed(0)}
              </span>
              <span className="text-[22px] font-[600] text-dim ml-[2px]">%</span>
            </>
          )}
        </div>
        <div className="flex flex-col items-end gap-[3px]">
          {speed && !stage && (
            <span className="text-[14px] font-[600] text-accent font-mono">{speed}</span>
          )}
          {eta && !stage && (
            <span className="text-[11.5px] text-dim font-mono">
              {t('dl.eta')} {eta}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-label={t('dl.progressAria')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : Math.round(percent)}
        aria-valuetext={stageLabel ?? undefined}
        className="h-[10px] rounded-[6px] bg-surface-3 overflow-hidden"
      >
        <div
          className={`h-full rounded-[6px] [background:linear-gradient(90deg,_color-mix(in_srgb,var(--accent)_80%,transparent),_var(--accent))] [box-shadow:0_0_18px_color-mix(in_srgb,var(--accent)_32%,transparent)] ${indeterminate ? 'lsv-indeterminate w-full' : '[transition:width_0.25s_linear]'}`}
          style={indeterminate ? undefined : { width: `${percent}%` }}
        />
      </div>

      {/* Announced to screen readers when the step or the item changes, not on every tick. */}
      <span role="status" className="sr-only">
        {stageLabel ??
          (progress?.current_item != null && progress.total_items != null
            ? t('dl.item', { current: progress.current_item, total: progress.total_items })
            : '')}
      </span>

      {progress?.current_item != null && progress.total_items != null && (
        <span className="text-[11.5px] text-hover font-mono" aria-hidden="true">
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
