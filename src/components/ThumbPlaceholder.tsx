import { PLATFORM_TINT } from '@/lib/platform';
import type { Platform } from '@/types';

/** Striped stand-in for a missing thumbnail, tinted with the platform colour. */
export function ThumbPlaceholder({ platform }: { platform: Platform }) {
  return (
    <div className="w-full h-full [background:repeating-linear-gradient(135deg,_#211F1A_0_7px,_#1A1815_7px_14px)] relative">
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{ background: PLATFORM_TINT[platform] ?? PLATFORM_TINT.unknown }}
      />
    </div>
  );
}
