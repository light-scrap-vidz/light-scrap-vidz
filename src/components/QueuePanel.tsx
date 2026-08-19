import { useState, useCallback } from 'react';
import type { QueueItem } from '@/types';
import { useT } from '@/lib/locale';

interface QueuePanelProps {
  items: QueueItem[];
  onAddUrls: (urls: string[]) => void;
  onRemoveItem: (id: string) => void;
  onClearDone: () => void;
  onClearAll: () => void;
}

function StatusIcon({ status }: { status: QueueItem['status'] }) {
  if (status === 'done')
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C9F25E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M20 6L9 17l-5-5" />
      </svg>
    );
  if (status === 'error')
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF8A8A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </svg>
    );
  if (status === 'downloading')
    return (
      <span
        className="lsv-spin"
        style={{
          width: 18,
          height: 18,
          flexShrink: 0,
          borderRadius: '50%',
          border: '2.5px solid rgba(201,242,94,0.25)',
          borderTopColor: '#C9F25E',
          display: 'inline-block',
        }}
      />
    );
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6F6960" strokeWidth="2" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export function QueuePanel({ items, onAddUrls, onRemoveItem }: QueuePanelProps) {
  const t = useT();
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);

  const handleAdd = useCallback(() => {
    const urls = input
      .split(/[\n\s,]+/)
      .map((s) => s.trim())
      .filter((s) => s.startsWith('http'));
    if (urls.length === 0) return;
    onAddUrls(urls);
    setInput('');
  }, [input, onAddUrls]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Input */}
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={t('queue.placeholder')}
        rows={3}
        style={{
          width: '100%',
          background: '#1A1916',
          border: `1px solid ${focused ? '#C9F25E' : 'rgba(255,255,255,0.09)'}`,
          borderRadius: 11,
          color: '#D6D1C8',
          fontSize: '12.5px',
          fontFamily: "'JetBrains Mono', monospace",
          padding: '11px 12px',
          resize: 'none',
          outline: 'none',
          transition: 'all .15s',
        }}
      />
      <button
        onClick={handleAdd}
        disabled={!input.trim()}
        style={{
          width: '100%',
          height: 42,
          background: '#211F1B',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 10,
          color: '#D6D1C8',
          fontSize: '13px',
          fontWeight: 600,
          cursor: !input.trim() ? 'default' : 'pointer',
          opacity: !input.trim() ? 0.5 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          transition: 'all .15s',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        {t('queue.add')}
      </button>

      {/* Queue rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 11,
              padding: '11px 12px',
              background: '#1A1916',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 10,
            }}
          >
            <div style={{ marginTop: 1 }}>
              <StatusIcon status={item.status} />
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span
                style={{
                  fontSize: '11.5px',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#A39D93',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.url}
              </span>
              {item.status === 'downloading' && (
                <div style={{ height: 4, borderRadius: 3, background: '#26241F', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${item.progress ?? 0}%`,
                      background: '#C9F25E',
                      transition: 'width 0.25s linear',
                    }}
                  />
                </div>
              )}
              {item.status === 'error' && item.error && (
                <span style={{ fontSize: '11px', color: '#FF8A8A' }}>{t(item.error)}</span>
              )}
            </div>
            {item.status === 'pending' && (
              <button
                onClick={() => onRemoveItem(item.id)}
                aria-label={t('queue.remove')}
                style={{
                  flexShrink: 0,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#5C574F',
                  display: 'flex',
                  transition: 'all .15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#C2BCB2'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#5C574F'; }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
