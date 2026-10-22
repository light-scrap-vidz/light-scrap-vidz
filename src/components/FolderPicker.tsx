import { useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useT } from '@/lib/locale';

interface FolderPickerProps {
  value: string;
  onChange: (path: string) => void;
  disabled?: boolean;
}

export function FolderPicker({ value, onChange, disabled }: FolderPickerProps) {
  const t = useT();
  const handlePick = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === 'string' && selected) {
      onChange(selected);
    }
  }, [onChange]);

  return (
    <div className="flex items-center justify-between gap-[12px]">
      <span className="text-[13px] font-[600] text-fg-mid shrink-0">{t('opt.saveTo')}</span>
      <button
        onClick={handlePick}
        className={`lsv-hover-accent flex items-center gap-[8px] min-w-[0px] [max-width:70%] [padding:6px_11px] bg-surface-2 border border-[rgba(255,255,255,0.10)] rounded-[8px] [transition:all_.15s] ${(disabled ? 'cursor-default' : 'cursor-pointer') + ' ' + (value ? 'text-fg-soft' : 'text-dim')}`}
        disabled={disabled}
        aria-label={t('opt.chooseFolderAria')}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
        </svg>
        <span className="text-[12.5px] font-mono whitespace-nowrap overflow-hidden text-ellipsis [direction:rtl] text-left">
          <bdi>{value || t('opt.chooseFolder')}</bdi>
        </span>
      </button>
    </div>
  );
}
