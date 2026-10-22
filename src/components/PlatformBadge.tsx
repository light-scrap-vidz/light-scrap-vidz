import { PLATFORM_META, PLATFORM_TINT } from '@/lib/platform';
import type { Platform } from '@/types';

export function PlatformBadge({ platform, compact }: { platform: Platform; compact?: boolean }) {
  const meta = PLATFORM_META[platform] ?? PLATFORM_META.unknown;
  const tint = PLATFORM_TINT[platform] ?? PLATFORM_TINT.unknown;
  return (
    <span
      className={`inline-flex items-center rounded-full text-[10px] font-[700] shrink-0 ${compact ? 'gap-1 p-[1px_7px]' : 'gap-[5px] p-[2px_8px]'}`}
      style={{
        color: meta.color,
        background: meta.bgColor,
        border: `1px solid ${meta.borderColor}`,
      }}
    >
      <span className="w-[5px] h-[5px] rounded-full" style={{ background: tint }} />
      {meta.label}
    </span>
  );
}
