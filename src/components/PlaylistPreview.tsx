import { useCallback, useMemo } from 'react';
import { getPlatform } from '@/lib/url-validator';
import type { PlaylistInfo } from '@/types';
import { useT } from '@/lib/locale';
import { PlatformBadge } from './PlatformBadge';
import { ThumbPlaceholder } from './ThumbPlaceholder';

interface PlaylistPreviewProps {
  info: PlaylistInfo;
  url: string;
  selectedUrls: string[];
  onSelectionChange: (urls: string[]) => void;
  disabled?: boolean;
  /** D'autres entrées existent peut-être après celles qui sont affichées. */
  hasMore?: boolean;
  loadingMore?: boolean;
  moreError?: string | null;
  onLoadMore?: () => void;
}

export function PlaylistPreview({
  info,
  url,
  selectedUrls,
  onSelectionChange,
  disabled,
  hasMore,
  loadingMore,
  moreError,
  onLoadMore,
}: PlaylistPreviewProps) {
  const t = useT();
  const platform = getPlatform(url);
  const entries = useMemo(() => info.entries ?? [], [info.entries]);
  // The platform did not give a total: what was read so far is a lower bound.
  const count = info.playlist_count ?? (entries.length || null);
  const countIsLowerBound = info.playlist_count == null && !!hasMore;
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
    <div className="bg-surface border border-[color-mix(in_srgb,var(--text-primary)_7%,transparent)] rounded-[14px] overflow-hidden">
      {/* Header row */}
      <div className="flex gap-[15px] p-[15px]">
        {/* Thumbnail placeholder */}
        <div className="relative shrink-0 w-[100px] h-[64px] rounded-[9px] overflow-hidden">
          <ThumbPlaceholder platform={platform} />
        </div>

        {/* Info column */}
        <div className="flex-1 min-w-[0px] flex flex-col gap-[7px]">
          <div className="flex items-center gap-[9px]">
            <PlatformBadge platform={platform} />
            <span className="text-[11px] font-[600] [text-transform:uppercase] [letter-spacing:0.04em] text-muted">
              {t('preview.playlist')}
            </span>
          </div>

          <h3 className="m-0 text-[14px] font-[700] text-fg-strong [letter-spacing:-0.01em] [line-height:1.25] [display:-webkit-box] [-webkit--line-clamp:2] [-webkit--box-orient:vertical] overflow-hidden">
            {info.title || t('preview.untitledPlaylist')}
          </h3>

          <div className="text-[12px] font-mono text-muted">
            {[
              info.uploader,
              count != null
                ? t(countIsLowerBound ? 'preview.videosPlus' : 'preview.videos', { count })
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
      </div>

      {/* Entry selection */}
      {entries.length > 0 && (
        <div className="border-t border-t-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] [padding:10px_15px_13px]">
          {/* Row header */}
          <div className="flex items-center justify-between mb-[8px]">
            <span className="text-[11px] font-[700] [text-transform:uppercase] [letter-spacing:0.05em] text-dim">
              {selectedUrls.length > 0
                ? t('preview.selected', { count: selectedUrls.length })
                : t('preview.shown', { count: entries.length })}
            </span>
            <div className="flex gap-[6px]">
              <button
                onClick={allSelected ? selectNone : selectAll}
                disabled={disabled}
                className={`[padding:3px_9px] rounded-[6px] border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-transparent text-fg-mid text-[11.5px] font-[600] ${disabled ? 'cursor-default opacity-50' : 'cursor-pointer'}`}
              >
                {allSelected ? t('preview.selectNone') : t('preview.selectAll')}
              </button>
            </div>
          </div>

          {/* Entry list */}
          <div className="flex flex-col gap-[1px] max-h-[168px] overflow-y-auto">
            {entries.map((entry, i) => {
              const checked = selectedSet.has(entry.url);
              return (
                <label
                  key={entry.id || i}
                  className={`lsv-hover-fill flex items-center gap-[10px] [padding:5px_8px] rounded-[7px] [transition:background_.1s] ${(disabled ? 'cursor-default' : 'cursor-pointer') + ' ' + (checked ? 'bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]' : 'bg-transparent')}`}
                  data-checked={checked}
                  data-disabled={!!disabled}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleEntry(entry.url)}
                    disabled={disabled}
                    className={`[accent-color:var(--accent)] w-[14px] h-[14px] shrink-0 ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
                  />
                  <span
                    className={`text-[12.5px] overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-[0px] ${checked ? 'text-fg-soft' : 'text-muted'}`}
                  >
                    {entry.title || entry.id}
                  </span>
                </label>
              );
            })}
          </div>

          {(hasMore || moreError) && (
            <div className="flex items-center gap-[10px] mt-[8px]">
              {hasMore && onLoadMore && (
                <button
                  onClick={onLoadMore}
                  disabled={disabled || loadingMore}
                  className={`[padding:4px_11px] rounded-[7px] border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-transparent text-fg-mid text-[11.5px] font-[600] ${disabled || loadingMore ? 'cursor-default opacity-50' : 'cursor-pointer'}`}
                >
                  {loadingMore ? t('preview.loadingMore') : t('preview.loadMore')}
                </button>
              )}
              {moreError && (
                <span role="alert" className="text-[11.5px] text-danger select-text">
                  {t(moreError)}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
