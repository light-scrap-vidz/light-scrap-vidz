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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: '13px', fontWeight: 600, color: '#C2BCB2', flexShrink: 0 }}>{t('opt.saveTo')}</span>
      <button
        onClick={handlePick}
        disabled={disabled}
        aria-label={t('opt.chooseFolderAria')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 0,
          maxWidth: '70%',
          padding: '6px 11px',
          background: '#211F1B',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 8,
          cursor: disabled ? 'default' : 'pointer',
          color: value ? '#D6D1C8' : '#6F6960',
          transition: 'all .15s',
        }}
        onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.color = '#C9F25E'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = value ? '#D6D1C8' : '#6F6960'; }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
        </svg>
        <span
          style={{
            fontSize: '12.5px',
            fontFamily: "'JetBrains Mono', monospace",
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            direction: 'rtl',
            textAlign: 'left',
          }}
        >
          {value || t('opt.chooseFolder')}
        </span>
      </button>
    </div>
  );
}
