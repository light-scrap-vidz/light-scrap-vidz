import { ProgressCard } from '@/components/ProgressCard';
import { useT } from '@/lib/locale';
import type { Flow } from '@/hooks/useAppFlow';

export function DownloadingView({ flow }: { flow: Flow }) {
  const t = useT();
  const { dl } = flow;
  return (
    <div className="lsv-view flex-1 flex flex-col items-center justify-center gap-[24px]">
      <ProgressCard status={dl.status} progress={dl.progress} />
      <button
        onClick={dl.cancel}
        className="lsv-hover-danger [padding:10px_22px] rounded-[11px] bg-surface-2 border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] text-fg-mid text-[13px] font-[600] cursor-pointer [transition:all_.15s]"
      >
        {t('dl.cancel')}
      </button>
    </div>
  );
}
