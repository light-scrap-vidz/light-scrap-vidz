import { ProgressCard } from '@/components/ProgressCard';
import { useT } from '@/lib/locale';
import type { Flow } from '@/hooks/useAppFlow';

export function DownloadingView({ flow }: { flow: Flow }) {
  const t = useT();
  const { dl } = flow;
  return (
    <div className="lsv-view" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
      <ProgressCard status={dl.status} progress={dl.progress} error={dl.error} />
      <button
        onClick={dl.cancel}
        className="lsv-hover-danger"
        style={{ padding: '10px 22px', borderRadius: 11, background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-mid)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all .15s' }}
      >
        {t('dl.cancel')}
      </button>
    </div>
  );
}
