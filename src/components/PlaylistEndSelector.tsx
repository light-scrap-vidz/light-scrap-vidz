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
      <span style={{ fontSize: '13px', fontWeight: 600, color: '#C2BCB2', flexShrink: 0 }}>{t('opt.count')}</span>
      <select
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        aria-label={t('opt.countAria')}
        style={{
          background: '#211F1B',
          border: '1px solid rgba(255,255,255,0.10)',
          color: '#D6D1C8',
          borderRadius: 8,
          fontSize: '12.5px',
          fontWeight: 600,
          padding: '6px 10px',
          cursor: disabled ? 'default' : 'pointer',
          outline: 'none',
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} style={{ background: '#1A1916' }}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
