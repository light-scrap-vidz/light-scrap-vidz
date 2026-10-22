import { useState, useCallback } from 'react';
import type { QueueItem } from '@/types';
import { useT } from '@/lib/locale';
import { Spinner } from './Spinner';

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
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#C9F25E"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
    );
  if (status === 'error')
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#FF8A8A"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </svg>
    );
  if (status === 'downloading') return <Spinner />;
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#6F6960"
      strokeWidth="2"
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export function QueuePanel({ items, onAddUrls, onRemoveItem }: QueuePanelProps) {
  const t = useT();
  const [input, setInput] = useState('');

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
    <div className="flex flex-col gap-[10px]">
      {/* Input */}
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="lsv-field w-full bg-surface border border-[rgba(255,255,255,0.09)] rounded-[11px] text-fg-soft text-[12.5px] font-mono [padding:11px_12px] [resize:none] [outline:none] [transition:all_.15s]"
        placeholder={t('queue.placeholder')}
        rows={3}
      />
      <button
        onClick={handleAdd}
        disabled={!input.trim()}
        className={`w-full h-[42px] bg-surface-2 border border-[rgba(255,255,255,0.10)] rounded-[10px] text-fg-soft text-[13px] font-[600] flex items-center justify-center gap-[7px] [transition:all_.15s] ${!input.trim() ? 'cursor-default opacity-50' : 'cursor-pointer'}`}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        {t('queue.add')}
      </button>

      {/* Queue rows */}
      <div className="flex flex-col gap-[7px]">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-[11px] [padding:11px_12px] bg-surface border border-[rgba(255,255,255,0.05)] rounded-[10px]"
          >
            <div className="mt-[1px]">
              <StatusIcon status={item.status} />
            </div>
            <div className="flex-1 min-w-[0px] flex flex-col gap-[6px]">
              <span className="text-[11.5px] font-mono text-hover whitespace-nowrap overflow-hidden text-ellipsis">
                {item.url}
              </span>
              {item.status === 'downloading' && (
                <div className="h-[4px] rounded-[3px] bg-[#26241F] overflow-hidden">
                  <div
                    className="h-full bg-accent [transition:width_0.25s_linear]"
                    style={{ width: `${item.progress ?? 0}%` }}
                  />
                </div>
              )}
              {item.status === 'error' && item.error && (
                <span className="text-[11px] text-danger">{t(item.error)}</span>
              )}
            </div>
            {(item.status === 'pending' || item.status === 'downloading') && (
              <button
                onClick={() => onRemoveItem(item.id)}
                className="lsv-hover-muted shrink-0 bg-transparent border-0 cursor-pointer text-faint flex [transition:all_.15s]"
                aria-label={t('queue.remove')}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
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
