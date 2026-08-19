import { useCallback, useMemo } from 'react';
import { PLATFORM_META, PLATFORM_TINT } from '@/lib/platform';
import { getPlatform } from '@/lib/url-validator';
import type { PlaylistInfo } from '@/types';
import { useT } from '@/lib/locale';

interface PlaylistPreviewProps {
  info: PlaylistInfo;
  url: string;
  selectedUrls: string[];
  onSelectionChange: (urls: string[]) => void;
  disabled?: boolean;
}

export function PlaylistPreview({ info, url, selectedUrls, onSelectionChange, disabled }: PlaylistPreviewProps) {
  const t = useT();
  const platform = getPlatform(url);
  const meta = PLATFORM_META[platform] ?? PLATFORM_META['unknown'];
  const tint = PLATFORM_TINT[platform] ?? PLATFORM_TINT['unknown'];
  const count = info.playlist_count ?? (info.entries?.length || null);
  const entries = useMemo(() => info.entries ?? [], [info.entries]);
  const selectedSet = useMemo(() => new Set(selectedUrls), [selectedUrls]);

  const toggleEntry = useCallback(
    (entryUrl: string) => {
      if (disabled) return;
      onSelectionChange(
        selectedSet.has(entryUrl)
          ? selectedUrls.filter((u) => u !== entryUrl)
          : [...selectedUrls, entryUrl],
      );
    },
    [selectedUrls, selectedSet, onSelectionChange, disabled],
  );

  const selectAll = useCallback(() => {
    if (disabled) return;
    onSelectionChange(entries.map((e) => e.url));
  }, [entries, onSelectionChange, disabled]);

  const selectNone = useCallback(() => {
    if (disabled) return;
    onSelectionChange([]);
  }, [onSelectionChange, disabled]);

  const allSelected = entries.length > 0 && entries.every((e) => selectedSet.has(e.url));

  return (
    <div
      style={{
        background: '#1A1916',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', gap: 15, padding: 15 }}>
        {/* Thumbnail placeholder */}
        <div
          style={{
            position: 'relative',
            flexShrink: 0,
            width: 100,
            height: 64,
            borderRadius: 9,
            overflow: 'hidden',
            background: 'repeating-linear-gradient(135deg, #211F1A 0 7px, #1A1815 7px 14px)',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, background: tint, opacity: 0.12 }} />
        </div>

        {/* Info column */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px',
                borderRadius: 999,
                fontSize: '10px',
                fontWeight: 700,
                color: meta.color,
                background: meta.bgColor,
                border: `1px solid ${meta.borderColor}`,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: tint }} />
              {meta.label}
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#857F75' }}>
              Playlist
            </span>
          </div>

          <h3
            style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 700,
              color: '#F1EDE6',
              letterSpacing: '-0.01em',
              lineHeight: 1.25,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {info.title || t('preview.untitledPlaylist')}
          </h3>

          <div style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: '#857F75' }}>
            {[info.uploader, count != null ? t('preview.videos', { count }) : null].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>

      {/* Entry selection */}
      {entries.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 15px 13px' }}>
          {/* Row header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6F6960' }}>
              {selectedUrls.length > 0
                ? t('preview.selected', { count: selectedUrls.length })
                : t('preview.shown', { count: entries.length })}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={allSelected ? selectNone : selectAll}
                disabled={disabled}
                style={{
                  padding: '3px 9px',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.10)',
                  background: 'transparent',
                  color: '#C2BCB2',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: disabled ? 'default' : 'pointer',
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                {allSelected ? t('preview.selectNone') : t('preview.selectAll')}
              </button>
            </div>
          </div>

          {/* Entry list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 168, overflowY: 'auto' }}>
            {entries.map((entry, i) => {
              const checked = selectedSet.has(entry.url);
              return (
                <label
                  key={entry.id || i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '5px 8px',
                    borderRadius: 7,
                    cursor: disabled ? 'default' : 'pointer',
                    background: checked ? 'rgba(201,242,94,0.06)' : 'transparent',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={(e) => { if (!disabled && !checked) (e.currentTarget as HTMLLabelElement).style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={(e) => { if (!checked) (e.currentTarget as HTMLLabelElement).style.background = 'transparent'; }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleEntry(entry.url)}
                    disabled={disabled}
                    style={{
                      accentColor: '#C9F25E',
                      width: 14,
                      height: 14,
                      flexShrink: 0,
                      cursor: disabled ? 'default' : 'pointer',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '12.5px',
                      color: checked ? '#D6D1C8' : '#9A9490',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {entry.title || entry.id}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
