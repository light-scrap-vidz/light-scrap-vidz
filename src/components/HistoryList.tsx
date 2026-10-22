import { useState, useEffect } from 'react';
import { openFolder } from '@/lib/tauri-commands';
import type { HistoryEntry } from '@/types';
import { useLang, useT } from '@/lib/locale';
import { PlatformBadge } from './PlatformBadge';
import { Spinner } from './Spinner';
import { Thumb } from './Thumb';

interface HistoryListProps {
  entries: HistoryEntry[];
  onClear: () => void;
  onSelect?: (url: string) => void;
  isLoading?: boolean;
}

function timeAgo(ms: number, lang: string): string {
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const minutes = Math.floor((Date.now() - ms) / 60000);
  if (minutes < 1) return rtf.format(0, 'second');
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  return rtf.format(-Math.floor(hours / 24), 'day');
}

export function HistoryList({ entries, onSelect, isLoading }: HistoryListProps) {
  const t = useT();
  const { lang } = useLang();
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading) setPendingId(null);
  }, [isLoading]);

  const handleSelect = (entry: HistoryEntry) => {
    if (!onSelect || isLoading) return;
    setPendingId(entry.id);
    onSelect(entry.url);
  };

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-faint text-[13px]">
        {t('history.empty')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[8px]">
      {entries.map((entry) => {
        const isPending = pendingId === entry.id && isLoading;

        return (
          <div
            key={entry.id}
            className={`lsv-hover-row flex items-center gap-[13px] p-[10px] bg-surface rounded-[12px] [transition:all_.15s] ${`border ${isPending ? 'border-[rgba(201,242,94,0.25)]' : 'border-[rgba(255,255,255,0.05)]'} ${onSelect && !isLoading ? 'cursor-pointer' : isLoading ? 'cursor-wait' : 'cursor-default'} ${isLoading && !isPending ? 'opacity-50' : ''}`}`}
            aria-disabled={!!isLoading}
            role="button"
            tabIndex={0}
            onClick={() => handleSelect(entry)}
            onKeyDown={(e) => {
              if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                handleSelect(entry);
              }
            }}
          >
            {/* Thumbnail / spinner */}
            <div className="w-[70px] h-[44px] rounded-[9px] overflow-hidden shrink-0 relative flex items-center justify-center">
              {isPending ? (
                <div className="w-full h-full bg-[rgba(201,242,94,0.06)] flex items-center justify-center">
                  <Spinner />
                </div>
              ) : (
                <Thumb
                  src={entry.thumbnail}
                  alt={entry.title}
                  platform={entry.platform}
                  lazy
                  proxyOnly
                />
              )}
            </div>

            {/* Right column */}
            <div className="flex-1 min-w-[0px] flex flex-col gap-[4px]">
              <p
                className={`m-0 text-[13.5px] font-[600] whitespace-nowrap overflow-hidden text-ellipsis [transition:color_.15s] ${isPending ? 'text-accent' : 'text-fg'}`}
              >
                {isPending ? t('history.fetching') : entry.title}
              </p>
              <div className="flex items-center gap-[8px] min-w-[0px]">
                <PlatformBadge platform={entry.platform} compact />
                <span className="text-[11px] text-faint font-mono shrink-0">
                  {timeAgo(entry.downloaded_at, lang)}
                </span>
              </div>
            </div>

            {/* Reveal button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                void openFolder(entry.filepath);
              }}
              aria-label={t('history.reveal')}
              title={t('history.reveal')}
              disabled={!!isLoading}
              className={`lsv-hover-accent-bg w-[30px] h-[30px] shrink-0 rounded-[8px] bg-transparent border-0 flex items-center justify-center text-faint [transition:all_.15s] ${isLoading ? 'cursor-default' : 'cursor-pointer'}`}
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
          </div>
        );
      })}
    </div>
  );
}
