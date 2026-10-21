import { useT } from '@/lib/locale';

interface PlaylistEndSelectorProps {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}

const LATEST_COUNTS = [5, 10, 20, 50];

export function PlaylistEndSelector({ value, onChange, disabled }: PlaylistEndSelectorProps) {
  const t = useT();
  const options = [
    ...LATEST_COUNTS.map((n) => ({ value: String(n), label: t('opt.latest', { count: n }) })),
    { value: '0', label: t('opt.allVideos') },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-mid)', flexShrink: 0 }}>{t('opt.count')}</span>
      <select
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        aria-label={t('opt.countAria')}
        style={{
          background: 'var(--surface-2)',
          border: '1px solid rgba(255,255,255,0.10)',
          color: 'var(--text-soft)',
          borderRadius: 8,
          fontSize: '12.5px',
          fontWeight: 600,
          padding: '6px 10px',
          cursor: disabled ? 'default' : 'pointer',
          outline: 'none',
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} style={{ background: 'var(--surface)' }}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
