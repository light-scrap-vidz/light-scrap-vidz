import type { CookiesChoice } from '@/types';
import { useT } from '@/lib/locale';

const BROWSER_LABELS: Record<string, string> = {
  firefox: 'Firefox',
  chrome: 'Chrome',
  chromium: 'Chromium',
  safari: 'Safari',
  brave: 'Brave',
  edge: 'Edge',
  opera: 'Opera',
  vivaldi: 'Vivaldi',
};

/** Browsers offered before detection finds anything (Safari only exists on macOS, where
 * detection always reports it). */
const FALLBACK_BROWSERS = ['firefox', 'chrome', 'chromium'];

interface BrowserCookieSelectorProps {
  value: CookiesChoice;
  onChange: (v: CookiesChoice) => void;
  disabled?: boolean;
  detectedBrowsers?: string[];
}

export function BrowserCookieSelector({
  value,
  onChange,
  disabled,
  detectedBrowsers,
}: BrowserCookieSelectorProps) {
  const t = useT();
  const browsers = (
    detectedBrowsers && detectedBrowsers.length > 0 ? detectedBrowsers : FALLBACK_BROWSERS
  ).filter((b) => b in BROWSER_LABELS);
  // A saved choice stays visible even when its browser is no longer detected.
  if (value !== 'auto' && value !== 'none' && !browsers.includes(value)) browsers.push(value);

  const options: { value: CookiesChoice; label: string }[] = [
    { value: 'auto', label: t('opt.cookiesAuto') },
    { value: 'none', label: t('opt.cookiesNone') },
    ...browsers.map((b) => ({ value: b as CookiesChoice, label: BROWSER_LABELS[b] })),
  ];

  return (
    <div className="flex items-center justify-between gap-[12px]">
      <span className="text-[13px] font-[600] text-fg-mid shrink-0">{t('opt.signIn')}</span>
      <div className="flex gap-[6px] flex-wrap justify-end">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              disabled={disabled}
              className={`[padding:5px_11px] rounded-[8px] text-[12.5px] font-[600] [transition:all_.15s] ${(disabled ? 'cursor-default' : 'cursor-pointer') + ' ' + (active ? 'bg-accent text-accent-ink border border-transparent' : 'bg-surface-2 text-chip border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)]')}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
