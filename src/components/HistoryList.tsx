import { useEffect, useState } from 'react';
import { openFolder } from '@/lib/tauri-commands';
import type { HistoryEntry } from '@/types';
import { useLang, useT } from '@/lib/locale';
import { PlatformBadge } from './PlatformBadge';
import { Spinner } from './Spinner';
import { Thumb } from './Thumb';

interface HistoryListProps {
  entries: HistoryEntry[];
  onSelect?: (url: string) => void;
  /** Retire une ligne dont le fichier a disparu. */
  onRemove?: (id: string) => void;
  isLoading?: boolean;
}

const formatters = new Map<string, Intl.RelativeTimeFormat>();

/** One formatter per language: building one per row and per render is needlessly slow. */
function formatterFor(lang: string): Intl.RelativeTimeFormat {
  let rtf = formatters.get(lang);
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
    formatters.set(lang, rtf);
  }
  return rtf;
}

function timeAgo(ms: number, now: number, lang: string): string {
  const rtf = formatterFor(lang);
  const minutes = Math.floor((now - ms) / 60000);
  if (minutes < 1) return rtf.format(0, 'second');
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  return rtf.format(-Math.floor(hours / 24), 'day');
}

/** The current time, refreshed every minute so "2 min ago" does not stay frozen. */
function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function HistoryList({ entries, onSelect, onRemove, isLoading }: HistoryListProps) {
  const t = useT();
  const { lang } = useLang();
  const now = useNow();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [missingId, setMissingId] = useState<string | null>(null);

  // Forget the clicked row once the lookup ends (adjusting state while rendering, rather
  // than in an effect, avoids an extra render with stale state).
  const [wasLoading, setWasLoading] = useState(!!isLoading);
  if (!!isLoading !== wasLoading) {
    setWasLoading(!!isLoading);
    if (!isLoading) setPendingId(null);
  }

  const handleSelect = (entry: HistoryEntry) => {
    if (!onSelect || isLoading) return;
    setPendingId(entry.id);
    onSelect(entry.url);
  };

  const handleReveal = (entry: HistoryEntry) => {
    setMissingId(null);
    openFolder(entry.filepath).catch(() => setMissingId(entry.id));
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
        const title = entry.title || entry.filepath.split('/').at(-1) || t('dl.playlist');

        return (
          <div key={entry.id} className="flex flex-col gap-[6px]">
            <div
              className={`lsv-hover-row flex items-center gap-[13px] p-[10px] bg-surface rounded-[12px] [transition:all_.15s] border ${isPending ? 'border-[color-mix(in_srgb,var(--accent)_25%,transparent)]' : 'border-[color-mix(in_srgb,var(--text-primary)_5%,transparent)]'} ${isLoading && !isPending ? 'opacity-50' : ''}`}
              aria-disabled={!!isLoading}
            >
              {/* Selecting a row looks the link up again */}
              <button
                onClick={() => handleSelect(entry)}
                disabled={!onSelect || !!isLoading}
                className={`flex-1 min-w-[0px] flex items-center gap-[13px] bg-transparent border-0 p-0 text-left text-inherit ${onSelect && !isLoading ? 'cursor-pointer' : isLoading ? 'cursor-wait' : 'cursor-default'}`}
              >
                {/* Thumbnail / spinner */}
                <div className="w-[70px] h-[44px] rounded-[9px] overflow-hidden shrink-0 relative flex items-center justify-center">
                  {isPending ? (
                    <div className="w-full h-full bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] flex items-center justify-center">
                      <Spinner />
                    </div>
                  ) : (
                    <Thumb src={entry.thumbnail} alt="" platform={entry.platform} lazy />
                  )}
                </div>

                {/* Right column */}
                <div className="flex-1 min-w-[0px] flex flex-col gap-[4px]">
                  <p
                    className={`m-0 text-[13.5px] font-[600] whitespace-nowrap overflow-hidden text-ellipsis [transition:color_.15s] ${isPending ? 'text-accent' : 'text-fg'}`}
                  >
                    {isPending ? t('history.fetching') : title}
                  </p>
                  <div className="flex items-center gap-[8px] min-w-[0px]">
                    <PlatformBadge platform={entry.platform} compact />
                    <span className="text-[11px] text-faint font-mono shrink-0">
                      {timeAgo(entry.downloaded_at, now, lang)}
                    </span>
                  </div>
                </div>
              </button>

              {/* Reveal button */}
              <button
                onClick={() => handleReveal(entry)}
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
                  aria-hidden="true"
                >
                  <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                </svg>
              </button>
            </div>

            {missingId === entry.id && (
              <div
                role="alert"
                className="flex items-center justify-between gap-[10px] [padding:0_6px] text-[11.5px] text-danger"
              >
                <span>{t('err.fileNotFound')}</span>
                {onRemove && (
                  <button
                    onClick={() => {
                      setMissingId(null);
                      onRemove(entry.id);
                    }}
                    className="lsv-hover-link bg-transparent border-0 cursor-pointer text-[11.5px] font-semibold text-dim"
                  >
                    {t('history.removeMissing')}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
