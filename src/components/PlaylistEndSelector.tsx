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
    <div className="flex items-center justify-between gap-[12px]">
      <span className="text-[13px] font-[600] text-fg-mid shrink-0">{t('opt.count')}</span>
      <select
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        aria-label={t('opt.countAria')}
        className={`bg-surface-2 border border-[rgba(255,255,255,0.10)] text-fg-soft rounded-[8px] text-[12.5px] font-[600] [padding:6px_10px] [outline:none] ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-surface">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
