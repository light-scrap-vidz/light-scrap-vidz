import { useCallback } from 'react';
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import { useT } from '@/lib/locale';
import { Spinner } from './Spinner';
import { PLATFORM_META, PLATFORM_TINT } from '@/lib/platform';
import type { Platform } from '@/types';

interface UrlInputProps {
  /** What is typed: owned by the caller, so it survives the screen changing around it. */
  value: string;
  onChange: (value: string) => void;
  onSubmit: (url: string) => void;
  isLoading: boolean;
  showTryChips?: boolean;
}

const SUPPORTED_PLATFORMS: Platform[] = [
  'youtube',
  'tiktok',
  'instagram',
  'facebook',
  'twitter',
  'twitch',
  'vimeo',
  'dailymotion',
];

export function UrlInput({ value, onChange, onSubmit, isLoading, showTryChips }: UrlInputProps) {
  const t = useT();

  const handleSubmit = useCallback(() => {
    const url = value.trim();
    if (!url) return;
    onSubmit(url);
  }, [value, onSubmit]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await readText();
      if (text) onChange(text.trim());
    } catch {
      // clipboard access denied
    }
  }, [onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSubmit();
    },
    [handleSubmit],
  );

  const inputDisabled = isLoading;

  return (
    <div className="flex flex-col gap-[12px]">
      <div className="flex gap-[8px]">
        {/* Input */}
        <div className="lsv-field flex-1 h-[54px] flex items-center gap-[11px] [padding:0_16px] bg-surface-2 rounded-[13px] border border-[color-mix(in_srgb,var(--text-primary)_8%,transparent)] [transition:all_.15s]">
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-secondary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('url.placeholder')}
            disabled={inputDisabled}
            aria-label={t('url.aria')}
            className="flex-1 min-w-[0px] bg-transparent border-0 [outline:none] text-fg text-[14px] font-sans"
          />
        </div>

        {/* Paste button */}
        <button
          onClick={handlePaste}
          className={`lsv-hover-outline w-[54px] h-[54px] shrink-0 rounded-[13px] bg-surface-2 border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] flex items-center justify-center text-hover [transition:all_.15s] ${inputDisabled ? 'cursor-default' : 'cursor-pointer'}`}
          disabled={inputDisabled}
          aria-label={t('url.paste')}
          title={t('url.paste')}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          </svg>
        </button>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          className={`lsv-hover-lift w-[54px] h-[54px] shrink-0 rounded-[13px] bg-accent border-0 flex items-center justify-center text-accent-ink [box-shadow:0_6px_20px_color-mix(in_srgb,var(--accent)_32%,transparent)] [transition:all_.15s] ${(inputDisabled || !value.trim() ? 'cursor-default' : 'cursor-pointer') + ' ' + (!value.trim() ? 'opacity-50' : '')}`}
          disabled={inputDisabled || !value.trim()}
          aria-label={t('url.fetch')}
        >
          {isLoading ? (
            <Spinner tone="ink" />
          ) : (
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </div>

      {showTryChips && (
        <div className="flex flex-wrap items-center gap-[6px]">
          <span className="text-[11.5px] text-faint font-[500] mr-[2px]">{t('url.supports')}</span>
          {SUPPORTED_PLATFORMS.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-[5px] [padding:3px_9px] bg-surface border border-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] rounded-[7px] text-muted text-[11px] font-[600] select-none"
            >
              <span
                className="w-[5px] h-[5px] rounded-full shrink-0 opacity-[0.85]"
                style={{ background: PLATFORM_TINT[p] }}
              />
              {PLATFORM_META[p].label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
