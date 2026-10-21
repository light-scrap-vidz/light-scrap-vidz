import { PLATFORM_TINT } from '@/lib/platform';
import type { Platform } from '@/types';

/** Striped stand-in for a missing thumbnail, tinted with the platform colour. */
export function ThumbPlaceholder({ platform }: { platform: Platform }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'repeating-linear-gradient(135deg, #211F1A 0 7px, #1A1815 7px 14px)',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: PLATFORM_TINT[platform] ?? PLATFORM_TINT.unknown,
          opacity: 0.12,
        }}
      />
    </div>
  );
}
