import { UrlInput } from '@/components/UrlInput';
import { HistoryList } from '@/components/HistoryList';
import { QueuePanel } from '@/components/QueuePanel';
import { useT } from '@/lib/locale';
import type { Flow } from '@/hooks/useAppFlow';

const tabButton = (active: boolean) =>
  `flex items-center gap-1.5 px-[13px] py-1.5 rounded-lg border-0 cursor-pointer text-[12.5px] font-semibold transition-all duration-150 ${
    active ? 'bg-surface-3 text-fg-strong' : 'bg-transparent text-muted'
  }`;

const linkButton =
  'lsv-hover-link bg-transparent border-0 cursor-pointer text-[11.5px] font-semibold text-dim transition-all duration-150';

export function HomeView({ flow }: { flow: Flow }) {
  const t = useT();
  const { tab, setTab, queue, entries } = flow;
  const pendingCount = queue.items.filter((i) => i.status === 'pending').length;
  const doneCount = queue.items.filter((i) => i.status === 'done' || i.status === 'error').length;

  return (
    <div className="lsv-view flex-1 flex flex-col gap-[16px] min-h-[0px]">
      <UrlInput onSubmit={flow.handleFetchInfo} isLoading={flow.isFetching} showTryChips />
      {flow.fetchError && (
        <div className="text-[11.5px] text-danger select-text">{t(flow.fetchError)}</div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-[4px] p-[4px] bg-surface border border-[rgba(255,255,255,0.06)] rounded-[11px]">
          <button onClick={() => setTab('recent')} className={tabButton(tab === 'recent')}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            {t('tab.recent')}
          </button>
          <button onClick={() => setTab('queue')} className={tabButton(tab === 'queue')}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 6h13" />
              <path d="M8 12h13" />
              <path d="M8 18h13" />
              <path d="M3 6h.01" />
              <path d="M3 12h.01" />
              <path d="M3 18h.01" />
            </svg>
            {t('tab.queue')}
            {pendingCount > 0 && (
              <span className="min-w-[17px] h-[17px] [padding:0_4px] rounded-full bg-accent text-accent-ink text-[10px] font-[800] font-mono inline-flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {tab === 'recent' && entries.length > 0 && (
          <button onClick={flow.clearHistory} className={linkButton}>
            {t('tab.clearAll')}
          </button>
        )}
        {tab === 'queue' && queue.items.length > 0 && (
          <button onClick={doneCount > 0 ? queue.clearDone : queue.clearAll} className={linkButton}>
            {t(doneCount > 0 ? 'tab.clearDone' : 'tab.clearAll')}
          </button>
        )}
      </div>

      <div className="flex-1 min-h-[0px] overflow-y-auto flex flex-col [padding-bottom:22px]">
        {tab === 'recent' ? (
          <HistoryList
            entries={entries}
            onClear={flow.clearHistory}
            onSelect={flow.handleFetchInfo}
            isLoading={flow.isFetching}
          />
        ) : (
          <QueuePanel
            items={queue.items}
            onAddUrls={flow.handleAddToQueue}
            onRemoveItem={queue.removeItem}
            onClearDone={queue.clearDone}
            onClearAll={queue.clearAll}
          />
        )}
      </div>
    </div>
  );
}
