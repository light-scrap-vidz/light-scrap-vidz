import type { Quality } from '@/types';
import { useT } from '@/lib/locale';

interface FormatSelectorProps {
  audioOnly: boolean;
  onAudioOnlyChange: (v: boolean) => void;
  quality: Quality;
  onQualityChange: (q: Quality) => void;
  disabled?: boolean;
}

const QUALITIES: { value: Quality; labelKey?: string }[] = [
  { value: 'best', labelKey: 'opt.qualityBest' },
  { value: '1080p' },
  { value: '720p' },
  { value: '480p' },
];

export function FormatSelector({
  audioOnly,
  onAudioOnlyChange,
  quality,
  onQualityChange,
  disabled,
}: FormatSelectorProps) {
  const t = useT();

  return (
    <div className="flex flex-col gap-[13px]">
      {/* Format row */}
      <div className="flex items-center justify-between gap-[12px]">
        <span className="text-[13px] font-[600] text-fg-mid">{t('opt.format')}</span>
        <div className="flex gap-[3px] p-[3px] bg-surface-2 border border-[rgba(255,255,255,0.07)] rounded-[10px]">
          {[
            { v: false, label: t('opt.video') },
            { v: true, label: t('opt.audio') },
          ].map((seg) => {
            const active = audioOnly === seg.v;
            return (
              <button
                key={seg.label}
                onClick={() => onAudioOnlyChange(seg.v)}
                aria-pressed={active}
                disabled={disabled}
                className={`[padding:6px_14px] rounded-[8px] border-0 text-[12.5px] font-[600] [transition:all_.15s] ${(disabled ? 'cursor-default' : 'cursor-pointer') + ' ' + (active ? 'bg-accent text-accent-ink [box-shadow:0_2px_8px_rgba(201,242,94,0.25)]' : 'bg-transparent text-[#9C968C] shadow-none')}`}
              >
                {seg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quality row */}
      {!audioOnly && (
        <>
          <div className="h-[1px] bg-[rgba(255,255,255,0.06)]" />
          <div className="flex items-center justify-between gap-[12px]">
            <span className="text-[13px] font-[600] text-fg-mid">{t('opt.quality')}</span>
            <div className="flex gap-[6px]">
              {QUALITIES.map((q) => {
                const active = quality === q.value;
                return (
                  <button
                    key={q.value}
                    onClick={() => onQualityChange(q.value)}
                    aria-pressed={active}
                    disabled={disabled}
                    className={`[padding:5px_11px] rounded-[8px] text-[12.5px] font-[600] [transition:all_.15s] ${(disabled ? 'cursor-default' : 'cursor-pointer') + ' ' + (active ? 'bg-accent text-accent-ink border border-transparent' : 'bg-surface-2 text-chip border border-[rgba(255,255,255,0.10)]')}`}
                  >
                    {q.labelKey ? t(q.labelKey) : q.value}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
