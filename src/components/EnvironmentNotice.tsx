import { useT } from '@/lib/locale';
import type { Warning } from '@/hooks/useDependencyCheck';

const MESSAGES: Record<Warning, string> = {
  ffmpeg: 'warn.ffmpeg',
  jsRuntime: 'warn.jsRuntime',
};

interface EnvironmentNoticeProps {
  warnings: Warning[];
  onDismiss: (warning: Warning) => void;
}

/** What is missing on this machine (ffmpeg, a JavaScript runtime), told before a download
 * fails for it. */
export function EnvironmentNotice({ warnings, onDismiss }: EnvironmentNoticeProps) {
  const t = useT();
  if (warnings.length === 0) return null;
  return (
    <div className="flex flex-col gap-[6px] [padding:10px_24px_0]">
      {warnings.map((w) => (
        <div
          key={w}
          role="alert"
          className="flex items-start gap-[10px] [padding:9px_12px] rounded-[10px] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] text-[12px] text-danger [line-height:1.4]"
        >
          <span className="flex-1 select-text">{t(MESSAGES[w])}</span>
          <button
            onClick={() => onDismiss(w)}
            aria-label={t('warn.dismiss')}
            className="shrink-0 bg-transparent border-0 cursor-pointer text-danger flex"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
