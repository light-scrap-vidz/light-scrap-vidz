import { useState, useEffect } from 'react';
import { PLATFORM_META, PLATFORM_TINT } from '@/lib/platform';
import { openFolder } from '@/lib/tauri-commands';
import type { HistoryEntry } from '@/types';
import { useT } from '@/lib/locale';

interface HistoryListProps {
  entries: HistoryEntry[];
  onClear: () => void;
  onSelect?: (url: string) => void;
  isLoading?: boolean;
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function Spinner() {
  return (
    <span
      className="lsv-spin"
      style={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        border: '2.5px solid rgba(201,242,94,0.25)',
        borderTopColor: '#C9F25E',
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  );
}

export function HistoryList({ entries, onSelect, isLoading }: HistoryListProps) {
  const t = useT();
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
          color: '#5C574F',
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
        const meta = PLATFORM_META[entry.platform];
        const tint = PLATFORM_TINT[entry.platform];
        const isPending = pendingId === entry.id && isLoading;

        return (
          <div
            key={entry.id}
            onClick={() => handleSelect(entry)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 13,
              padding: 10,
              background: '#1A1916',
              border: `1px solid ${isPending ? 'rgba(201,242,94,0.25)' : 'rgba(255,255,255,0.05)'}`,
              borderRadius: 12,
              transition: 'all .15s',
              cursor: onSelect && !isLoading ? 'pointer' : isLoading ? 'wait' : 'default',
              opacity: isLoading && !isPending ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isLoading) (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.12)';
            }}
            onMouseLeave={(e) => {
              if (!isPending) (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.05)';
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
              ) : entry.thumbnail ? (
                <img
                  src={entry.thumbnail}
                  alt={entry.title}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    const img = e.currentTarget;
                    img.style.display = 'none';
                    const parent = img.parentElement;
                    if (parent) {
                      parent.style.background = `repeating-linear-gradient(135deg, #211F1A 0 7px, #1A1815 7px 14px)`;
                      const overlay = document.createElement('div');
                      overlay.style.cssText = `position:absolute;inset:0;background:${tint};opacity:0.12`;
                      parent.appendChild(overlay);
                    }
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    background: 'repeating-linear-gradient(135deg, #211F1A 0 7px, #1A1815 7px 14px)',
                    position: 'relative',
                  }}
                >
                  <div style={{ position: 'absolute', inset: 0, background: tint, opacity: 0.12 }} />
                </div>
              )}
            </div>

            {/* Right column */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: '13.5px',
                  fontWeight: 600,
                  color: isPending ? '#C9F25E' : '#EAE6DF',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  transition: 'color .15s',
                }}
              >
                {isPending ? t('history.fetching') : entry.title}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '1px 7px',
                    borderRadius: 999,
                    fontSize: '10px',
                    fontWeight: 700,
                    color: meta.color,
                    background: meta.bgColor,
                    border: `1px solid ${meta.borderColor}`,
                    flexShrink: 0,
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: tint }} />
                  {meta.label}
                </span>
                <span style={{ fontSize: '11px', color: '#5C574F', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                  {timeAgo(entry.downloaded_at)}
                </span>
              </div>
            </div>

            {/* Reveal button */}
            <button
              onClick={(e) => { e.stopPropagation(); void openFolder(entry.filepath); }}
              aria-label={t('history.reveal')}
              title={t('history.reveal')}
              disabled={!!isLoading}
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
                color: '#5C574F',
                transition: 'all .15s',
              }}
              onMouseEnter={(e) => { if (!isLoading) { (e.currentTarget as HTMLButtonElement).style.color = '#C9F25E'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; } }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#5C574F'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
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
