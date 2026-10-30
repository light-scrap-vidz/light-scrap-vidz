import { useState, useCallback } from 'react';
import type { QueueItem } from '@/types';
import { useT } from '@/lib/locale';
import { Spinner } from './Spinner';

interface QueuePanelProps {
  items: QueueItem[];
  /** Avancement (0-100) de l'élément en cours, par identifiant. */
  progress: Record<string, number>;
  /** Ajoute les liens ; renvoie combien ont réellement été ajoutés. */
  onAddUrls: (urls: string[]) => number;
  onRemoveItem: (id: string) => void;
  onRetryItem: (id: string) => void;
  onRetryFailed: () => void;
}

function StatusIcon({ status }: { status: QueueItem['status'] }) {
  if (status === 'done')
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
        aria-hidden="true"
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
        stroke="var(--danger)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
        aria-hidden="true"
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
      stroke="var(--text-secondary)"
      strokeWidth="2"
      className="shrink-0"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

const isHttpUrl = (s: string) => /^https?:\/\/\S+$/i.test(s);

export function QueuePanel({
  items,
  progress,
  onAddUrls,
  onRemoveItem,
  onRetryItem,
  onRetryFailed,
}: QueuePanelProps) {
  const t = useT();
  const [input, setInput] = useState('');
  const [skipped, setSkipped] = useState(0);

  const handleAdd = useCallback(() => {
    // Links are separated by whitespace only: a comma can belong to a URL.
    const tokens = input.split(/\s+/).filter(Boolean);
    const valid = tokens.filter(isHttpUrl);
    const added = valid.length > 0 ? onAddUrls(valid) : 0;
    setSkipped(tokens.length - added);
    if (tokens.length > 0) setInput('');
  }, [input, onAddUrls]);

  const failed = items.filter((i) => i.status === 'error').length;

  return (
    <div className="flex flex-col gap-[10px]">
      {/* Input */}
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="lsv-field w-full bg-surface border border-[color-mix(in_srgb,var(--text-primary)_9%,transparent)] rounded-[11px] text-fg-soft text-[12.5px] font-mono [padding:11px_12px] [resize:none] [outline:none] [transition:all_.15s]"
        placeholder={t('queue.placeholder')}
        aria-label={t('queue.aria')}
        rows={3}
      />
      <button
        onClick={handleAdd}
        disabled={!input.trim()}
        className={`w-full h-[42px] bg-surface-2 border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] rounded-[10px] text-fg-soft text-[13px] font-[600] flex items-center justify-center gap-[7px] [transition:all_.15s] ${!input.trim() ? 'cursor-default opacity-50' : 'cursor-pointer'}`}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        {t('queue.add')}
      </button>
      {skipped > 0 && (
        <div role="status" className="text-[11.5px] text-muted">
          {t('queue.skipped', { count: skipped })}
        </div>
      )}
      {failed > 0 && (
        <button
          onClick={onRetryFailed}
          className="lsv-hover-link [align-self:flex-start] bg-transparent border-0 cursor-pointer text-[11.5px] font-semibold text-dim transition-all duration-150"
        >
          {t('queue.retryFailed')}
        </button>
      )}

      {/* Queue rows */}
      <div className="flex flex-col gap-[7px]">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-[11px] [padding:11px_12px] bg-surface border border-[color-mix(in_srgb,var(--text-primary)_5%,transparent)] rounded-[10px]"
          >
            <div className="mt-[1px]">
              <StatusIcon status={item.status} />
            </div>
            <div className="flex-1 min-w-[0px] flex flex-col gap-[6px]">
              <span className="text-[11.5px] font-mono text-hover whitespace-nowrap overflow-hidden text-ellipsis">
                {item.title || item.url}
              </span>
              {item.status === 'downloading' && (
                <div
                  role="progressbar"
                  aria-label={t('dl.progressAria')}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress[item.id] ?? 0)}
                  className="h-[4px] rounded-[3px] bg-surface-3 overflow-hidden"
                >
                  <div
                    className="h-full bg-accent [transition:width_0.25s_linear]"
                    style={{ width: `${progress[item.id] ?? 0}%` }}
                  />
                </div>
              )}
              {item.status === 'error' && item.error && (
                <span className="text-[11px] text-danger">{t(item.error)}</span>
              )}
            </div>
            {item.status === 'error' && (
              <button
                onClick={() => onRetryItem(item.id)}
                className="lsv-hover-link shrink-0 bg-transparent border-0 cursor-pointer text-[11.5px] font-semibold text-dim transition-all duration-150"
              >
                {t('queue.retry')}
              </button>
            )}
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
                  aria-hidden="true"
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
