import { UrlInput } from '@/components/UrlInput';
import { HistoryList } from '@/components/HistoryList';
import { QueuePanel } from '@/components/QueuePanel';
import { useT } from '@/lib/locale';
import type { Flow } from '@/hooks/useAppFlow';

const tabButton = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 13px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  fontSize: '12.5px',
  fontWeight: 600,
  background: active ? 'var(--surface-3)' : 'transparent',
  color: active ? '#F0ECE4' : 'var(--text-muted)',
  transition: 'all .15s',
});

const linkButton: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: '11.5px',
  fontWeight: 600,
  color: 'var(--text-dim)',
  transition: 'all .15s',
};

export function HomeView({ flow }: { flow: Flow }) {
  const t = useT();
  const { tab, setTab, queue, entries } = flow;
  const pendingCount = queue.items.filter((i) => i.status === 'pending').length;
  const doneCount = queue.items.filter((i) => i.status === 'done' || i.status === 'error').length;

  return (
    <div className="lsv-view" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
      <UrlInput onSubmit={flow.handleFetchInfo} isLoading={flow.isFetching} showTryChips />
      {flow.fetchError && <div style={{ fontSize: '11.5px', color: 'var(--danger)', userSelect: 'text' }}>{t(flow.fetchError)}</div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 11 }}>
          <button onClick={() => setTab('recent')} style={tabButton(tab === 'recent')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            {t('tab.recent')}
          </button>
          <button onClick={() => setTab('queue')} style={tabButton(tab === 'queue')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 6h13" />
              <path d="M8 12h13" />
              <path d="M8 18h13" />
              <path d="M3 6h.01" />
              <path d="M3 12h.01" />
              <path d="M3 18h.01" />
            </svg>
            {t('tab.queue')}
            {pendingCount > 0 && (
              <span style={{ minWidth: 17, height: 17, padding: '0 4px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', fontSize: '10px', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {tab === 'recent' && entries.length > 0 && (
          <button onClick={flow.clearHistory} className="lsv-hover-link" style={linkButton}>
            {t('tab.clearAll')}
          </button>
        )}
        {tab === 'queue' && queue.items.length > 0 && (
          <button onClick={doneCount > 0 ? queue.clearDone : queue.clearAll} className="lsv-hover-link" style={linkButton}>
            {t(doneCount > 0 ? 'tab.clearDone' : 'tab.clearAll')}
          </button>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', paddingBottom: 22 }}>
        {tab === 'recent' ? (
          <HistoryList entries={entries} onClear={flow.clearHistory} onSelect={flow.handleFetchInfo} isLoading={flow.isFetching} />
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
