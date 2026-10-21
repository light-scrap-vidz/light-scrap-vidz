import { PLATFORM_META, PLATFORM_TINT } from '@/lib/platform';
import type { Platform } from '@/types';

export function PlatformBadge({ platform, compact }: { platform: Platform; compact?: boolean }) {
  const meta = PLATFORM_META[platform] ?? PLATFORM_META.unknown;
  const tint = PLATFORM_TINT[platform] ?? PLATFORM_TINT.unknown;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 4 : 5,
        padding: compact ? '1px 7px' : '2px 8px',
        borderRadius: 999,
        fontSize: '10px',
        fontWeight: 700,
        color: meta.color,
        background: meta.bgColor,
        border: `1px solid ${meta.borderColor}`,
        flexShrink: 0,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: tint }} />
      {meta.label}
    </span>
  );
}
