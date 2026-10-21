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
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-faint)',
          fontSize: '13px',
        }}
      >
        {t('history.empty')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {entries.map((entry) => {
        const isPending = pendingId === entry.id && isLoading;

        return (
          <div
            key={entry.id}
            className="lsv-hover-row"
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
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 13,
              padding: 10,
              background: 'var(--surface)',
              border: `1px solid ${isPending ? 'rgba(201,242,94,0.25)' : 'rgba(255,255,255,0.05)'}`,
              borderRadius: 12,
              transition: 'all .15s',
              cursor: onSelect && !isLoading ? 'pointer' : isLoading ? 'wait' : 'default',
              opacity: isLoading && !isPending ? 0.5 : 1,
            }}
          >
            {/* Thumbnail / spinner */}
            <div
              style={{
                width: 70,
                height: 44,
                borderRadius: 9,
                overflow: 'hidden',
                flexShrink: 0,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isPending ? (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    background: 'rgba(201,242,94,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Spinner />
                </div>
              ) : (
                <Thumb src={entry.thumbnail} alt={entry.title} platform={entry.platform} lazy proxyOnly />
              )}
            </div>

            {/* Right column */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: '13.5px',
                  fontWeight: 600,
                  color: isPending ? 'var(--accent)' : 'var(--text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  transition: 'color .15s',
                }}
              >
                {isPending ? t('history.fetching') : entry.title}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <PlatformBadge platform={entry.platform} compact />
                <span style={{ fontSize: '11px', color: 'var(--text-faint)', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                  {timeAgo(entry.downloaded_at, lang)}
                </span>
              </div>
            </div>

            {/* Reveal button */}
            <button
              onClick={(e) => { e.stopPropagation(); void openFolder(entry.filepath); }}
              aria-label={t('history.reveal')}
              title={t('history.reveal')}
              disabled={!!isLoading}
              className="lsv-hover-accent-bg"
              style={{
                width: 30,
                height: 30,
                flexShrink: 0,
                borderRadius: 8,
                background: 'transparent',
                border: 'none',
                cursor: isLoading ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-faint)',
                transition: 'all .15s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
