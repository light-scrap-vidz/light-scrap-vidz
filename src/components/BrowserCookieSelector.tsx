import type { CookiesBrowser } from '@/types';
import { useT } from '@/lib/locale';

const ALL_OPTIONS: { value: CookiesBrowser; labelKey: string; browser: string | null }[] = [
  { value: null, labelKey: 'opt.cookiesNone', browser: null },
  { value: 'firefox', labelKey: 'Firefox', browser: 'firefox' },
  { value: 'chrome', labelKey: 'Chrome', browser: 'chrome' },
  { value: 'chromium', labelKey: 'Chromium', browser: 'chromium' },
  { value: 'safari', labelKey: 'Safari', browser: 'safari' },
];

interface BrowserCookieSelectorProps {
  value: CookiesBrowser;
  onChange: (v: CookiesBrowser) => void;
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
  const options =
    detectedBrowsers && detectedBrowsers.length > 0
      ? ALL_OPTIONS.filter((o) => o.browser === null || detectedBrowsers.includes(o.browser))
      : ALL_OPTIONS.filter((o) => o.browser !== 'safari');

  return (
    <div className="flex items-center justify-between gap-[12px]">
      <span className="text-[13px] font-[600] text-fg-mid shrink-0">{t('opt.signIn')}</span>
      <div className="flex gap-[6px] flex-wrap justify-end">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.labelKey}
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              disabled={disabled}
              className={`[padding:5px_11px] rounded-[8px] text-[12.5px] font-[600] [transition:all_.15s] ${(disabled ? 'cursor-default' : 'cursor-pointer') + ' ' + (active ? 'bg-accent text-accent-ink border border-transparent' : 'bg-surface-2 text-chip border border-[rgba(255,255,255,0.10)]')}`}
            >
              {t(opt.labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
